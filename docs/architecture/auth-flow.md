# Authentication Flow

Session model: one `sessions` document per login (`sid`), many `refresh_tokens` per session (rotation). Only SHA-256 hashes of refresh tokens are stored. Consumed and revoked records are kept until their TTL so reuse can be detected.

Diagram convention: a `break` block means the request ends there. Nothing after it runs, and no token is issued.

| # | Diagram | Scope |
|---|---|---|
| 0 | Request pipeline | Checks shared by every endpoint, in order |
| 1 | Sign Up | Create user, session and tokens in one transaction |
| 2 | Sign In | Verify credentials, create session and tokens in one transaction |
| 3 | Logout | Revoke session, clear cookie |
| 4 | Session and refresh | Protected requests, transactional refresh rotation, reuse handling |

## Rate limits

| Route | Key | Limit | Applied |
|---|---|---|---|
| All routes | IP | per route, below | First, before any authentication |
| `POST /auth/signup` | IP | 5 per hour | Pipeline |
| `POST /auth/signup` | SHA-256(normalized email) + IP | 3 per hour | After DTO validation and normalization |
| `POST /auth/signup` | SHA-256(normalized email), all IPs | 15 per hour (safety ceiling) | After DTO validation and normalization |
| `POST /auth/signin` | IP | 10 per minute | Pipeline |
| `POST /auth/signin` | SHA-256(normalized email), all IPs | 5 failures in 15 min, then progressive delay (1, 2, 4 min, max 15 min) | Before the user lookup |
| `POST /auth/logout` | IP | 20 per minute | Pipeline |
| `POST /auth/refresh` | IP | 10 per minute | Pipeline |
| `POST /auth/refresh` | `sid` | 10 per minute | Only after the refresh token resolved a real session |
| Protected routes | `userId` | 60 per minute | Only after JWT and session were verified |

Every limit answers `429 Too Many Requests` with `Retry-After`, and the request stops there. No limit is a permanent lock: all counters are time windows that expire by themselves.

Signup throttling and denial of service. A counter keyed only on the email would let an attacker block a victim from registering with three requests. So the strict counter is keyed on email hash plus IP: an attacker only blocks their own IP for that email. The email-only counter is a high ceiling (15 per hour) that needs several IPs to reach. Signup counters never affect sign in, only requests that passed DTO validation are counted, and every window is one hour at most.

Storage: all counters live in Redis behind the `RateLimitStore` interface. Redis is shared by every backend instance, so limits are exact however many instances run, and counters survive a backend restart.

- Every hit is one atomic Lua script (`INCR`, then `EXPIRE` on first hit, returns count and TTL), so concurrent requests cannot race. `Retry-After` comes from the key TTL.
- Key format: `rl:{route}:{type}:{value}`, where the value is the IP, the SHA-256 email hash, the email hash plus IP, the `sid` or the `userId`. Raw emails are never stored. Sign in failures use a counter plus a `blockedUntil` key with a TTL (1, 2, 4 min, max 15 min).
- Every key has a TTL, so nothing is permanent and no cleanup job is needed.
- Redis holds only rate-limit data. Sessions, refresh tokens and users stay in MongoDB, and rotation, reuse detection and revocation never depend on Redis.
- Redis unavailable (short command timeout, then): sign up, sign in, logout and refresh fail closed with `503` + `Retry-After`, so brute force protection is never silently off. The per-user limit on protected routes fails open with a critical log, because the session is still verified in MongoDB. Every outage is logged and alerted.
- Redis needs a password and a private network only (no public port). Local setup: one `redis` service in docker-compose.
- The in-memory implementation remains available for unit tests (`RATE_LIMIT_STORE=memory`). Default is `redis`.

## MongoDB and token rules

- Transactions need a replica set (Atlas, or a single-node replica set in local Docker). Signup, sign in, rotation and revocation each use one transaction.
- Transaction errors: use the driver's transaction helper semantics. `TransientTransactionError` means nothing was committed, so the whole transaction may be retried (max 2). `UnknownTransactionCommitResult` means the commit may or may not have applied, so only the commit is retried (max 2, time limited), never the body. If still unknown, return 503 and issue no tokens. A later refresh with R1 then either finds it unconsumed (rotation runs normally) or consumed (reuse policy applies, no tokens). Other errors are treated as failed and aborted. Signup, sign in, logout and revocation follow the same rules, and the unique index on email plus the conditional `updateOne` keep retries idempotent.
- Refresh token creation order: generate the random 256-bit token R first, compute `tokenHash = SHA-256(R)`, store only the hash, and send R only in the cookie. The access JWT is signed after the transaction commits.
- Access JWT: `{sub, sid, iss, aud, iat, exp +15m}`, algorithm pinned, kept in memory only.
- Cookie `refresh_token`: HttpOnly, Secure, SameSite=Strict, Path=/api/auth, Max-Age 7d. Session capped at 30 days.

## Refresh reuse policy

Every presentation of a consumed token is logged as `refresh_reuse_attempt` (sid, ip, user agent hash, token age, outcome). A consumed token never gets new tokens, in any case below.

| Presented token state | Action on the session | Response |
|---|---|---|
| Cookie missing or token unknown | None (cannot be attributed to a session) | 401 + clear cookie |
| Token expired, never consumed | None (normal expiry) | 401 + clear cookie |
| Session revoked, past the 30 day cap, or user disabled | None (session already dead) | 401 + clear cookie |
| Token revoked (for example by logout) | None (session already revoked) | 401 + clear cookie |
| Consumed less than 10 s ago, same IP and user agent hash as the request that consumed it, and at most 3 attempts | None (benign concurrent tab or lost response) | 409 + `Retry-After: 1`, no tokens |
| Consumed less than 10 s ago, but a different IP or user agent hash, or more than 3 attempts | Revoke session and all its tokens | 401 + clear cookie |
| Consumed 10 s ago or more | Revoke session and all its tokens | 401 + clear cookie |

The 10 s same-IP and user-agent window is only a heuristic for concurrent tabs and lost responses. A matching IP and user agent hash does not prove the caller is legitimate, since both can be copied by an attacker. So the benign branch gives no tokens, only a 409 telling the client to wait, and the attempt cap (3) bounds it. Consumed tokens never issue new tokens in any branch.

If the revocation transaction fails, the response is still 401 with no tokens, a critical log is written, and the next presentation of the consumed token takes the same path and retries the revocation.

## 0. Request pipeline (shared)

```mermaid
sequenceDiagram
    participant F as Frontend SPA
    participant C as CORS + body parser
    participant T as IP Throttler (Redis)
    participant O as OriginGuard
    participant J as JwtAuthGuard
    participant TU as User Throttler (Redis)
    participant V as ValidationPipe
    participant H as Controller
    participant X as HttpExceptionFilter
    participant D as MongoDB

    Note over F,C: Trust boundary. HTTPS only.
    F->>C: HTTP request
    C->>C: CORS exact origin allowlist, body size limit, JSON parse
    break body too large
        C-->>F: 413 Payload Too Large
    end
    break malformed JSON or wrong Content-Type
        C-->>F: 400 Bad Request
    end
    C->>T: pass
    T->>T: IP limit for this route (atomic Redis script), before any authentication
    break Redis unavailable (fail closed on public and cookie routes)
        T-->>F: 503 Service Unavailable + Retry-After + critical log
    end
    break IP limit exceeded
        T-->>F: 429 Too Many Requests + Retry-After
    end

    opt cookie routes (refresh, logout)
        T->>O: Origin or Referer must be in the allowlist
        break header missing or not allowed
            O-->>F: 403 Forbidden
        end
    end

    opt protected routes (Bearer access token)
        T->>J: verify access token
        J->>J: signature with pinned algorithm, exp, iss, aud
        break token missing, invalid or expired
            J-->>F: 401 Unauthorized
        end
        J->>D: session sid exists, not revoked, not expired?
        break session store unavailable (fail closed)
            D-->>J: error
            J-->>F: 503 Service Unavailable
        end
        break session revoked or expired
            J-->>F: 401 Unauthorized
        end
        J->>TU: userId from the verified token and active session
        TU->>TU: user limit 60 per minute (Redis)
        opt Redis unavailable (fail open, session already verified in MongoDB)
            TU->>TU: critical log, skip the user limit, request continues
        end
        break user limit exceeded
            TU-->>F: 429 Too Many Requests + Retry-After + security log
        end
    end

    T->>V: only requests that passed every check above
    V->>V: whitelist, forbidNonWhitelisted, trim and normalize
    break DTO invalid
        V-->>F: 422 Unprocessable Entity {details per field}
    end
    V->>H: handler runs
    H-->>X: any thrown error
    X-->>F: mapped status, or 500 with a generic message (details only in logs)
    Note over T,TU: Per-user limits run only after authentication, so userId is never taken from an unverified token. Public routes use IP, email hash or sid keys only.
```

## 1. Sign Up

```mermaid
sequenceDiagram
    actor U as User
    participant F as Frontend SPA
    participant P as Pipeline (0)
    participant RL as RateLimitStore (Redis)
    participant S as AuthService
    participant D as MongoDB

    U->>F: email, name, password
    F->>F: Zod: email format, name min 3, password min 8 + letter + digit + special
    break Zod invalid
        F-->>U: inline errors, no request sent
    end
    F->>P: POST /api/auth/signup
    break pipeline rejects (400, 413, 429 IP 5 per hour, 422 DTO)
        P-->>F: error status, see pipeline
    end
    P->>S: signUp(dto) with email trimmed and lowercased, name trimmed

    S->>RL: hit signup:hash(email + IP) limit 3 per hour, and signup:hash(email) ceiling 15 per hour
    break Redis unavailable (fail closed)
        RL-->>S: error
        S-->>F: 503 Service Unavailable + Retry-After + critical log
    end
    break either counter exceeded
        S-->>F: 429 + Retry-After (same answer for known and unknown emails)
    end

    S->>D: findOne({email})
    break database failure
        D-->>S: error
        S-->>F: 503 Service Unavailable + Retry-After
    end
    alt email exists
        S-->>F: 409 Conflict
    else email is new
        S->>S: bcrypt.hash(password, cost 12) or Argon2id
        S->>S: generate refresh token R (randomBytes 32) and sid, then tokenHash = SHA-256(R)
        S->>D: transaction: insert user (unique index on email), insert session {sid, userId, expiresAt +30d}, insert refresh token {tokenHash, expiresAt +7d}
        alt duplicate key E11000 (race)
            D-->>S: transaction aborted, nothing written
            S-->>F: 409 Conflict
        else database failure
            D-->>S: transaction aborted, nothing written
            S-->>F: 503 Service Unavailable + Retry-After
        else committed
            S->>S: sign access JWT (only after commit)
            S-->>F: 201 Created {accessToken, user {id, email, name}} + Set-Cookie refresh_token = R
            F->>F: keep token in memory, set user, navigate /app
        end
    end
    Note over S,D: AuditLogger records the outcome (userId, sid, ip). Never passwords or tokens. The raw R is never stored.
    Note over RL,S: Counters are incremented before the lookup, so the 429 is identical for known and unknown emails. A 409 still reveals that an email is registered. That is bounded by the signup limits. Hiding it fully needs an email verification flow, which is out of scope.
```

## 2. Sign In

```mermaid
sequenceDiagram
    actor U as User
    participant F as Frontend SPA
    participant P as Pipeline (0)
    participant LA as LoginAttemptService (Redis)
    participant S as AuthService
    participant D as MongoDB

    U->>F: email, password
    F->>F: Zod: email format, password not empty
    break Zod invalid
        F-->>U: inline errors, no request sent
    end
    F->>P: POST /api/auth/signin
    break pipeline rejects (400, 413, 429 IP 10 per minute, 422 DTO)
        P-->>F: error status, see pipeline
    end

    P->>LA: check(SHA-256(normalized email)), all IPs, same key whether the user exists or not
    break Redis unavailable (fail closed)
        LA-->>F: 503 Service Unavailable + Retry-After + critical log
    end
    break temporarily throttled (5 failures in 15 min, delay 1, 2, 4 min up to 15 min)
        LA-->>F: 429 + Retry-After (no lookup, no bcrypt, identical for unknown emails)
    end

    P->>S: signIn(dto) with email trimmed and lowercased
    S->>D: findOne({email}) with passwordHash
    break database failure
        D-->>S: error
        S-->>F: 503 Service Unavailable + Retry-After (not counted as a failed login)
    end
    alt user not found
        S->>S: bcrypt.compare against a dummy hash, same cost and timing
        S->>LA: recordFailure(email hash)
        S-->>F: 401 Unauthorized "Invalid credentials"
    else user found
        S->>S: bcrypt.compare(password, passwordHash)
        alt password wrong
            S->>LA: recordFailure(email hash)
            S-->>F: 401 Unauthorized "Invalid credentials" (same body)
        else password correct
            alt account disabled or suspended
                S-->>F: 403 Forbidden "Account unavailable" (only after a correct password)
            else account active
                S->>LA: reset(email hash)
                S->>S: generate refresh token R (randomBytes 32) and sid, then tokenHash = SHA-256(R)
                S->>D: transaction: insert session {sid, userId, expiresAt +30d}, insert refresh token {tokenHash, expiresAt +7d}
                alt database failure
                    D-->>S: transaction aborted, nothing written
                    S-->>F: 503 Service Unavailable
                else committed
                    S->>S: sign access JWT (only after commit)
                    S-->>F: 200 OK {accessToken, user} + Set-Cookie refresh_token = R
                    F->>F: keep token in memory, set user, navigate /app
                end
            end
        end
    end
    Note over S,D: AuditLogger records login_success, login_failed, login_throttled and login_blocked (userId or email hash, ip). Never credentials.
    Note over LA,S: Failures are counted per hashed email across all IPs, and unknown emails are counted the same way, so the 429 never reveals whether an account exists. The delay is progressive and capped at 15 minutes, so there is no permanent lockout. Trade-off: someone can slow a victim's sign in for up to 15 minutes. The cap and Retry-After keep that bounded.
```

## 3. Logout

Logout is authorized only by an active refresh credential (hash found, not consumed, not revoked, not expired, session active) or a fully verified, unexpired access JWT whose session is active. A consumed, expired or revoked refresh token alone never authorizes a revocation. In that case the server falls back to the access token, and if that is not valid either it only clears the cookie (204, nothing revoked, logged as `logout_no_session`). The client always clears its own state.

```mermaid
sequenceDiagram
    actor U as User
    participant F as Frontend SPA
    participant P as Pipeline (0)
    participant S as AuthService
    participant D as MongoDB

    U->>F: click Logout
    F->>P: POST /api/auth/logout (cookie R, optional Bearer A, Origin header)
    break pipeline rejects (429 IP 20 per minute, 403 Origin or Referer missing or not allowed)
        P-->>F: error status, see pipeline
    end
    P->>S: logout(R, A)

    opt refresh cookie R present
        S->>D: find refresh token by SHA-256(R), load its session
        break database failure
            D-->>S: error
            S-->>F: 503 Service Unavailable + Retry-After (not reported as logged out, cookie kept so the client can retry)
            F->>F: clear in-memory token and user state anyway
        end
        S->>S: sid = record sid only if the token is not consumed, not revoked, not expired and the session is active. Otherwise R authorizes nothing.
    end
    opt no sid yet (cookie missing, or R consumed, expired, revoked or unknown)
        S->>S: verify A (pinned algorithm, signature, iss, aud, exp not past) and check its session is active
        S->>S: sid = sid claim only if A is fully valid and its session is active, otherwise no session
    end

    alt no session resolved
        S-->>F: 204 No Content + clear cookie (idempotent, nothing to revoke)
    else sid resolved
        S->>D: transaction: set sessions.revokedAt where revokedAt is null, revoke all refresh tokens of sid
        alt database failure
            D-->>S: transaction aborted, nothing changed
            S-->>F: 503 Service Unavailable + Retry-After (not reported as logged out)
            F->>F: clear in-memory token and user state anyway
        else committed, or session was already revoked
            S-->>F: 204 No Content + Set-Cookie refresh_token= (Max-Age 0, same attributes as when set)
            F->>F: remove access token and user, cancel in-flight requests
            F-->>U: redirect /signin
        end
    end
    Note over S,D: AuditLogger records logout_success and logout_no_session (userId, sid, ip). Never token values.
```

## 4. Session and refresh

```mermaid
sequenceDiagram
    participant F as Frontend SPA
    participant P as Pipeline (0)
    participant S as AuthService
    participant RL as RateLimitStore (Redis)
    participant L as AuditLogger
    participant D as MongoDB

    Note over F,D: A. Protected request
    opt page reload, no access token in memory
        F->>F: go straight to B (refresh first)
    end
    F->>P: GET /api/users/me (Bearer A1)
    Note over P: Pipeline 0 runs in order: IP limit, JWT verify, session status, then the user limit
    alt IP limit or user limit (60 per minute) exceeded
        P-->>F: 429 + Retry-After (client keeps the session and waits)
    else A1 expired, invalid or session revoked
        P-->>F: 401 Unauthorized (client goes to B)
    else session store unavailable
        P-->>F: 503 Service Unavailable (client keeps the session and retries with backoff)
    else authenticated
        P-->>F: 200 OK {id, email, name}
    end

    Note over F,D: B. Refresh, single-flight in the frontend
    F->>P: POST /api/auth/refresh (cookie R1, Origin header)
    break pipeline rejects (429 IP 10 per minute, 403 Origin or Referer missing or not allowed)
        P-->>F: error status, see pipeline (keep session on 429)
    end
    P->>S: refresh(R1)
    break cookie missing
        S-->>F: 401 + clear cookie
    end
    S->>D: find refresh token by SHA-256(R1), load its session and user
    break database failure
        D-->>S: error
        S-->>F: 503 Service Unavailable (keep session, retry with backoff)
    end
    break token unknown or expired
        S-->>F: 401 + clear cookie (no session is attributed, nothing is revoked)
    end
    break session revoked, past 30 day cap, or user disabled
        S-->>F: 401 + clear cookie
    end

    S->>RL: hit refresh:sid, limit 10 per minute, only now that a real session is resolved
    break Redis unavailable (fail closed, R1 not consumed)
        RL-->>S: error
        S-->>F: 503 Service Unavailable (keep session, retry with backoff)
    end
    break session limit exceeded
        S-->>F: 429 + Retry-After (R1 not consumed, keep session)
    end

    S->>S: generate R2 (randomBytes 32), tokenHash2 = SHA-256(R2), R2 id, before the transaction
    S->>D: BEGIN transaction
    S->>D: updateOne({tokenHash, usedAt null, revokedAt null, expiresAt in the future}, set usedAt, consumedIp, consumedUaHash, replacedBy R2 id)
    alt matched 1 (this request consumed R1, only one concurrent request can win)
        S->>D: insert R2 {sid, tokenHash2, expiresAt +7d} then COMMIT
        alt TransientTransactionError before commit
            D-->>S: error labelled TransientTransactionError, nothing committed
            S->>S: abort, retry the whole transaction (re-read R1, same R2) at most 2 times
            S-->>F: 503 Service Unavailable + Retry-After if retries are exhausted (R1 still unconsumed)
        else UnknownTransactionCommitResult
            D-->>S: commit outcome unknown
            S->>S: retry only the commit (never the updateOne), at most 2 times, within a time limit
            S-->>F: 503 Service Unavailable + Retry-After if still unknown, no tokens issued, no rotation re-run. Logged as refresh_commit_unknown
        else other insert or commit failure with no commit label
            D-->>S: transaction aborted, R1 stays unconsumed, R2 not stored
            S-->>F: 503 Service Unavailable (keep session, retry with backoff)
        else committed
            S->>S: sign access JWT A2 {sub, sid, iss, aud, iat, exp +15m} (only after commit)
            S-->>F: 200 OK {accessToken A2} + Set-Cookie refresh_token = R2
            F->>F: retry the original request once with A2
        end
    else matched 0 (R1 was already consumed, revoked or expired)
        S->>D: ABORT transaction, nothing written
        S->>D: read R1 state and atomically increment R1.reuseAttempts
        alt database failure
            D-->>S: error
            S-->>F: 503 Service Unavailable (no tokens issued, keep session)
        else R1 revoked or expired in the meantime
            S-->>F: 401 + clear cookie (no tokens issued)
        else R1 consumed and policy says benign (under 10 s, same IP and UA hash, at most 3 attempts)
            S->>L: log refresh_reuse_attempt outcome benign (sid, ip, ua hash, age)
            S-->>F: 409 Conflict + Retry-After 1 (no tokens issued, no revocation)
            F->>F: wait 1 s, re-read state, and retry refresh at most once (see lost-response rules below)
        else R1 consumed and policy says suspicious (see the reuse policy table)
            S->>L: log refresh_reuse_attempt outcome revoked (sid, ip, ua hash, age)
            S->>D: transaction: revoke the session and all its refresh tokens
            S-->>F: 401 + clear cookie (no tokens issued, a failed revoke is logged critical and retried on the next replay)
            F->>F: clear state, redirect /signin
        end
    end

    Note over F,S: Frontend rules. Single-flight refresh: one refresh at a time, all waiting requests share its result. Each API request is retried at most once after a successful refresh (flag retried=true on the request). If that retry returns 401, clear state and redirect, never refresh again for it. A 401 from refresh itself means sign in again, with no further refresh attempts until a new sign in. 429 and 503 keep the session and retry with capped backoff (max 3 attempts, then show an error).
    Note over F,S: Lost refresh response. If R1 was rotated to R2 but the response never reached the browser (timeout or network error), the browser still holds R1 and the server has consumed it. The frontend retries refresh once. The server sees consumed R1 and never issues tokens for it: within the grace heuristic it answers 409, otherwise it revokes the session with 401. After one 409 retry, or on a second network failure, the frontend stops, clears in-memory state, and shows "Session could not be restored, please sign in" with a sign in link. No infinite retries. Signing in again creates a new session.
    Note over S,D: A stolen access token dies at logout, because every request checks the session. A consumed refresh token never yields new tokens, in any branch.
```
