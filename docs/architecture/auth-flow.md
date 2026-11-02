# Authentication Flow

Three flows: Sign Up, Sign In, Logout. Session model: one `sessions` document per login (`sid`), many `refresh_tokens` per session (rotation). Only SHA-256 hashes of refresh tokens are stored.

## Sign Up

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    box rgb(255,243,224) Browser - untrusted
        participant F as Frontend SPA
    end
    box rgb(227,242,253) NestJS API - trusted
        participant T as Edge guards (CORS, Throttler)
        participant A as AuthController + ValidationPipe
        participant S as AuthService
        participant L as AuditLogger
    end
    box rgb(232,245,233) Data
        participant D as MongoDB
    end

    U->>F: Fill email, name, password
    F->>F: Zod schema: email format, name trimmed min 3, password min 8 + letter + digit + special char
    alt Zod invalid
        F-->>U: Inline field errors, no request sent
    end

    Note over F,T: TRUST BOUNDARY. HTTPS only. Frontend validation is UX only and is never trusted.
    F->>T: POST /api/auth/signup JSON {email, name, password}
    T->>T: CORS exact origin allowlist, body size limit
    T->>T: Rate limit per IP (5 per hour)
    alt limit exceeded
        T-->>F: 429 Too Many Requests + Retry-After
    end
    alt malformed JSON or wrong Content-Type
        T-->>F: 400 Bad Request
    end
    T->>A: allowed

    A->>A: ValidationPipe (whitelist, forbidNonWhitelisted, transform) on SignUpDto
    A->>A: Re-validate: IsEmail, name MinLength 3, password regex (min 8, letter, digit, special)
    A->>A: Normalize: email trim + lowercase, name trim, password left untouched
    alt DTO invalid
        A-->>F: 422 Unprocessable Entity {statusCode, message, details per field} (password never echoed)
    end
    A->>S: signUp(normalizedDto, ip, userAgent)

    S->>D: findOne({email})
    alt email already exists
        D-->>S: user
        S->>L: log signup_conflict (email hash, ip)
        S-->>F: 409 Conflict
    else email is new
        D-->>S: null
        S->>S: bcrypt.hash(password, cost 12) or Argon2id
        S->>D: insert users {email, name, passwordHash, status active, createdAt}
        Note over S,D: Unique index on users.email prevents duplicates when two requests race
        alt duplicate key error E11000 (race)
            D-->>S: duplicate key
            S->>L: log signup_conflict
            S-->>F: 409 Conflict
        else database unavailable or timeout
            D-->>S: error
            S->>L: log db_error (no secrets)
            S-->>F: 503 Service Unavailable + Retry-After
        else user created
            D-->>S: userId
            S->>D: insert sessions {sid, userId, ip, userAgent, createdAt, expiresAt}
            S->>S: Sign access JWT {sub userId, sid, iss, aud, iat, exp +15m}
            S->>S: Refresh token = crypto.randomBytes(32) base64url (opaque, not a JWT)
            S->>D: insert refresh_tokens {sid, tokenHash SHA-256, expiresAt +7d, usedAt null}
            alt session or refresh token insert fails
                D-->>S: error
                S->>L: log db_error
                S-->>F: 503 Service Unavailable (user exists, client can sign in)
            else persisted
                S->>L: log signup_success (userId, sid, ip) no passwords or tokens
                S-->>A: accessToken, refreshToken, safe user
                A-->>F: 201 Created {accessToken, user {id, email, name}} (no passwordHash)
                Note over A,F: Set-Cookie refresh_token (HttpOnly, Secure, SameSite=Strict, Path=/api/auth, Max-Age 7d)
                F->>F: Keep access token in memory only, set user state, navigate /app
            end
        end
    end

    Note over A,S: Any unhandled error goes to HttpExceptionFilter: 500 with a generic message, details only in server logs
    Note over S,D: Trade-off: 409 reveals that an email is registered. Mitigated by the per-IP rate limit.
```

## Sign In

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    box rgb(255,243,224) Browser - untrusted
        participant F as Frontend SPA
    end
    box rgb(227,242,253) NestJS API - trusted
        participant T as Edge guards (CORS, Throttler)
        participant A as AuthController + ValidationPipe
        participant LA as LoginAttemptService
        participant S as AuthService
        participant L as AuditLogger
        participant G as JwtAuthGuard
    end
    box rgb(232,245,233) Data
        participant D as MongoDB
    end

    U->>F: Email + password
    F->>F: Zod: email format, password not empty (no complexity rules on sign in)
    alt Zod invalid
        F-->>U: Inline field errors, no request sent
    end

    Note over F,T: TRUST BOUNDARY. HTTPS only.
    F->>T: POST /api/auth/signin JSON {email, password}
    T->>T: Layer 1: rate limit per IP (5 per minute)
    alt IP limit exceeded
        T-->>F: 429 Too Many Requests + Retry-After
    end
    T->>A: allowed

    A->>A: ValidationPipe on SignInDto, normalize email (trim + lowercase)
    alt DTO invalid
        A-->>F: 422 Unprocessable Entity {details per field}
    end
    A->>LA: Layer 2: isLocked(email + IP)
    alt locked (5 failures in 15 min, lock doubles on repeat)
        LA-->>F: 429 Too Many Requests + Retry-After
    end
    A->>S: signIn(normalizedDto, ip, userAgent)

    S->>D: findOne({email}) select +passwordHash
    alt database unavailable or timeout
        D-->>S: error
        S->>L: log db_error
        S-->>F: 503 Service Unavailable + Retry-After
    end
    alt user not found
        S->>S: bcrypt.compare(password, DUMMY_HASH) same cost 12, equalizes timing
        S->>LA: recordFailure(email + IP) progressive delay
        S->>L: log login_failed (email hash, ip, reason internal only)
        S-->>F: 401 Unauthorized "Invalid credentials" (generic)
    else user found
        D-->>S: user + passwordHash
        S->>S: Layer 3: bcrypt.compare(password, passwordHash)
        alt password wrong
            S->>LA: recordFailure(email + IP) progressive delay
            S->>L: log login_failed (userId, ip) no credentials
            S-->>F: 401 Unauthorized "Invalid credentials" (same body as unknown email)
        else password correct
            alt account disabled, suspended or unverified (if supported)
                S->>L: log login_blocked (userId, status)
                S-->>F: 403 Forbidden "Account unavailable" (checked after password, so no enumeration)
            else account active
                S->>LA: reset failures
                S->>D: insert sessions {sid, userId, ip, userAgent, createdAt, expiresAt}
                S->>S: Sign access JWT {sub userId, sid, iss, aud, iat, exp +15m}
                S->>S: Refresh token = crypto.randomBytes(32) base64url
                S->>D: insert refresh_tokens {sid, tokenHash SHA-256, expiresAt +7d, usedAt null}
                alt session or token insert fails
                    D-->>S: error
                    S->>L: log db_error
                    S-->>F: 503 Service Unavailable
                else persisted
                    S->>L: log login_success (userId, sid, ip)
                    S-->>A: accessToken, refreshToken, safe user
                    A-->>F: 200 OK {accessToken, user {id, email, name}}
                    Note over A,F: Set-Cookie refresh_token (HttpOnly, Secure, SameSite=Strict, Path=/api/auth, Max-Age 7d)
                    F->>F: Keep access token in memory only, set user state, navigate /app
                end
            end
        end
    end

    Note over F,D: Later: using the session. Access token A1 (15 min) lives in memory, refresh token R1 is the cookie.
    F->>T: GET /api/users/me (Authorization Bearer A1)
    T->>T: Rate limit per user (60 per minute)
    alt limit exceeded
        T-->>F: 429 Too Many Requests + Retry-After + security log
    end
    T->>G: verify signature, iss, aud, exp
    G->>D: session sid active and not revoked?
    alt A1 valid and session active
        G-->>F: 200 OK {id, email, name}
    else A1 expired or session revoked
        G-->>F: 401 Unauthorized
        F->>T: Single-flight POST /api/auth/refresh (cookie R1, Origin header)
        T->>T: Rate limit per IP (10 per minute)
        T->>A: allowed
        A->>A: OriginGuard: Origin or Referer must be in the allowlist
        alt origin not allowed
            A-->>F: 403 Forbidden
        end
        A->>S: refresh(R1)
        S->>D: find refresh_tokens by SHA-256(R1)
        alt not found, expired or session revoked
            S-->>F: 401 + clear cookie, redirect /signin
        else R1 already used (REUSE DETECTED)
            S->>D: revoke session sid and all its refresh tokens
            S->>L: log refresh_reuse_detected (userId, sid, ip)
            S-->>F: 401 + clear cookie, redirect /signin
        else R1 valid
            S->>D: mark R1 used (usedAt, replacedBy R2), insert R2 (same sid)
            S->>S: Sign new access JWT A2 {sub, sid, iss, aud, iat, exp +15m}
            S-->>F: 200 OK {accessToken A2}
            Note over S,F: Set-Cookie refresh_token R2 (HttpOnly, Secure, SameSite=Strict, Path=/api/auth)
            F->>F: Retry original request with A2
        end
    end
```

## Logout

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    box rgb(255,243,224) Browser - untrusted
        participant F as Frontend SPA
    end
    box rgb(227,242,253) NestJS API - trusted
        participant T as Edge guards (CORS, Throttler)
        participant A as AuthController + OriginGuard
        participant S as AuthService
        participant L as AuditLogger
        participant G as JwtAuthGuard
    end
    box rgb(232,245,233) Data
        participant D as MongoDB
    end

    U->>F: Click Logout
    Note over F,T: TRUST BOUNDARY. HTTPS only. Cookie is sent automatically, so CSRF protection is required.
    F->>T: POST /api/auth/logout (Authorization Bearer A, cookie refresh_token, Origin header)
    T->>T: Rate limit per IP
    alt limit exceeded
        T-->>F: 429 Too Many Requests + Retry-After
    end
    T->>A: allowed

    A->>A: CSRF check: Origin or Referer in allowlist, SameSite=Strict cookie, optional X-CSRF-Token double submit
    alt origin or CSRF token invalid
        A-->>F: 403 Forbidden (nothing revoked)
    end
    A->>S: logout(accessToken, refreshToken, ip)

    S->>S: Identify session: verify JWT signature, iss, aud but ignore exp, read sid
    alt access token missing, malformed or bad signature
        S->>S: Fall back to the refresh cookie
    end
    S->>D: find refresh_tokens by SHA-256(cookie) to get sid
    alt no valid credential at all
        S->>L: log logout_no_session (ip)
        S-->>F: 204 No Content + clear cookie (idempotent, nothing to revoke)
    else sid from JWT differs from sid of refresh token
        S->>L: log logout_sid_mismatch (ip)
        S-->>F: 401 Unauthorized (nothing revoked)
    else session identified
        S->>D: Atomic: set sessions.revokedAt and set revokedAt on all active refresh_tokens of sid (transaction)
        alt database unavailable or timeout
            D-->>S: error
            S->>L: log db_error (no token values)
            S-->>F: 503 Service Unavailable + Retry-After (cookie kept so logout can be retried)
            F->>F: Clear in-memory access token and user state anyway (fail safe)
        else commit succeeded or session already revoked
            D-->>S: committed (matched 0 means already revoked)
            S->>L: log logout_success (userId, sid, ip) never token values
            S-->>A: done
            A-->>F: 204 No Content
            Note over A,F: Set-Cookie refresh_token= (empty, Max-Age 0, HttpOnly, Secure, SameSite=Strict, Path=/api/auth) same attributes as when set
            F->>F: Remove in-memory access token, clear user state, cancel in-flight requests
            F-->>U: Redirect /signin
        end
    end

    Note over F,D: After logout, before the old access token A expires
    F->>T: POST /api/auth/refresh (replayed R)
    T->>A: allowed
    A->>S: refresh(R)
    S->>D: refresh token revoked
    S-->>F: 401 Unauthorized, user must sign in again
    F->>T: GET /api/users/me (stolen A, not expired yet)
    T->>G: verify signature, iss, aud, exp
    G->>D: session sid revoked?
    G-->>F: 401 Unauthorized (one DB read per request closes the 15 min window)
    Note over F,D: Repeated logout is safe. Password change and logout-all revoke every session of the user.
```
