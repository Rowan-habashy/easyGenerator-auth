# C4 – Code-Level Design

## 1. SOLID applied pragmatically

```mermaid
flowchart LR
    s["Single responsibility<br/>controller routes, service decides,<br/>repository stores"]
    o["Open/closed<br/>new rate-limit store without<br/>changing guards or services"]
    l["Liskov<br/>Redis and memory stores pass<br/>the same test suite"]
    i["Interface segregation<br/>each repository exposes only<br/>what its feature uses"]
    d["Dependency inversion<br/>services depend on interfaces<br/>through injection tokens"]
    no["Not used on purpose<br/>CQRS, event sourcing, generic repositories,<br/>factories, microservices"]

    s --> o --> l --> i --> d --> no
```

## 2. Backend classes

```mermaid
classDiagram
    class AuthController {
        +signUp(dto)
        +signIn(dto)
        +refresh(req, res)
        +logout(req, res)
    }
    class AuthService {
        +signUp(dto, meta) AuthSession
        +signIn(dto, meta) AuthSession
        +refresh(rawToken, meta) AuthSession
        +logout(rawToken, accessToken) void
    }
    class UsersService {
        +register(dto, tx) User
        +verifyCredentials(email, password) User
        +findById(id) User
    }
    class SessionsService {
        +start(userId, tx) Session
        +isActive(sid) boolean
        +revoke(sid, tx) void
    }
    class RefreshTokensService {
        +issue(sid, tx) RawToken
        +rotate(rawToken, meta) RotationResult
        +revokeAllForSession(sid, tx) void
    }
    class TokenService {
        +signAccess(userId, sid) string
        +verifyAccess(token) Claims
    }
    class LoginAttemptService {
        +check(emailHash) void
        +recordFailure(emailHash) void
        +reset(emailHash) void
    }
    class AuditLogger {
        +log(event, fields) void
    }

    class UsersRepository {
        <<interface>>
        +findByEmail(email) User
        +findById(id) User
        +create(data, tx) User
    }
    class SessionsRepository {
        <<interface>>
        +create(data, tx) Session
        +findById(sid) Session
        +revoke(sid, tx) void
    }
    class RefreshTokensRepository {
        <<interface>>
        +create(data, tx) RefreshToken
        +findByHash(hash) RefreshToken
        +markUsedIfActive(hash, meta, replacedBy, tx) boolean
        +incrementReuseAttempts(id) int
        +revokeAllBySid(sid, tx) void
    }
    class TransactionRunner {
        <<interface>>
        +run(work) T
    }
    class RateLimitStore {
        <<interface>>
        +hit(key, limit, windowSec) HitResult
    }

    class MongooseUsersRepository
    class MongooseSessionsRepository
    class MongooseRefreshTokensRepository
    class MongooseTransactionRunner
    class RedisRateLimitStore
    class MemoryRateLimitStore

    AuthController --> AuthService
    AuthService --> UsersService
    AuthService --> SessionsService
    AuthService --> RefreshTokensService
    AuthService --> TokenService
    AuthService --> LoginAttemptService
    AuthService --> TransactionRunner
    AuthService --> AuditLogger
    RefreshTokensService --> AuditLogger
    UsersService --> UsersRepository
    SessionsService --> SessionsRepository
    RefreshTokensService --> RefreshTokensRepository
    LoginAttemptService --> RateLimitStore
    MongooseUsersRepository ..|> UsersRepository
    MongooseSessionsRepository ..|> SessionsRepository
    MongooseRefreshTokensRepository ..|> RefreshTokensRepository
    MongooseTransactionRunner ..|> TransactionRunner
    RedisRateLimitStore ..|> RateLimitStore
    MemoryRateLimitStore ..|> RateLimitStore
```

## 3. Dependency injection tokens

```mermaid
flowchart LR
    subgraph tokens[Injection tokens]
        t1["USERS_REPOSITORY"]
        t2["SESSIONS_REPOSITORY"]
        t3["REFRESH_TOKENS_REPOSITORY"]
        t4["TRANSACTION_RUNNER"]
        t5["RATE_LIMIT_STORE"]
    end
    subgraph impl[Bound to]
        i1["MongooseUsersRepository<br/>UsersModule"]
        i2["MongooseSessionsRepository<br/>SessionsModule"]
        i3["MongooseRefreshTokensRepository<br/>RefreshTokensModule"]
        i4["MongooseTransactionRunner<br/>DatabaseModule, global"]
        i5["RedisRateLimitStore by default<br/>MemoryRateLimitStore when RATE_LIMIT_STORE=memory<br/>RateLimitModule, factory provider"]
    end
    subgraph users[Consumers use Inject with the token]
        c1["UsersService"]
        c2["SessionsService"]
        c3["RefreshTokensService"]
        c4["AuthService"]
        c5["LoginAttemptService, guards"]
    end

    t1 --> i1
    t2 --> i2
    t3 --> i3
    t4 --> i4
    t5 --> i5
    c1 --> t1
    c2 --> t2
    c3 --> t3
    c4 --> t4
    c5 --> t5
    note["Unit tests bind fakes to the same tokens,<br/>so service tests need no database"]
    tokens -.-> note
```

## 4. Data model

```mermaid
classDiagram
    class User {
        +_id
        +email unique lowercase
        +name
        +passwordHash
        +disabled
        +createdAt
    }
    class Session {
        +_id as sid
        +userId
        +expiresAt 30 days TTL
        +revokedAt
    }
    class RefreshToken {
        +sid
        +tokenHash unique
        +expiresAt 7 days TTL
        +usedAt
        +replacedBy
        +reuseAttempts
        +consumedIp
        +consumedUaHash
        +revokedAt
    }
    User "1" --> "many" Session
    Session "1" --> "many" RefreshToken
```

## 5. Transaction boundary

```mermaid
flowchart TB
    as["AuthService<br/>owns the boundary"] --> run["TransactionRunner.run(work)"]
    run --> sess["start Mongoose session<br/>withTransaction"]
    sess --> ctx["pass opaque TxContext to work"]
    ctx --> w1["repository writes receive tx<br/>only Mongoose repositories unwrap it"]
    w1 --> commit(["commit"])
    commit --> jwt["sign access JWT after commit"]

    note1["Without tx, a repository write<br/>runs on its own"]
    w1 -.-> note1
    note2["Exception: RefreshTokensService.rotate<br/>touches only its own repository"]
    as -.-> note2
```

## 6. Transaction errors

```mermaid
flowchart TB
    start["transaction fails"] --> kind{"error label"}
    kind -- "TransientTransactionError<br/>nothing committed" --> retry["withTransaction re-runs the callback<br/>within its time limit"]
    retry --> rep["callback must be repeatable:<br/>tokens generated before it,<br/>no responses or side effects inside"]
    kind -- "UnknownTransactionCommitResult<br/>commit may have applied" --> commitonly["driver retries only the commit<br/>never repeat the rotation by hand"]
    commitonly --> still{"still unknown?"}
    still -- "yes" --> r503a(["503, no tokens<br/>log refresh_commit_unknown"])
    still -- "no" --> okc(["result known, continue"])
    kind -- "other error" --> r503b(["abort, 503, no tokens"])
    kind -- "duplicate key 11000 on email" --> r409(["409 Conflict"])

    r503a --> after["next refresh with the old token:<br/>unused means rotation runs normally<br/>used means reuse policy, no tokens"]
```

## 7. Sign up and sign in rules

```mermaid
flowchart TB
    subgraph su[Sign up]
        s1["validate, trim and lowercase email"] --> s2["count signup limits<br/>email hash + IP, email hash ceiling"]
        s2 --> s3["create user, session, first refresh token<br/>in one transaction"]
        s3 --> s4{"duplicate email?"}
        s4 -- "yes" --> s409(["409<br/>only place a registered email is revealed"])
        s4 -- "no" --> s5(["201 + cookie"])
    end
    subgraph si[Sign in]
        i1["check failure counter<br/>before the user lookup"] --> i2{"throttled?"}
        i2 -- "yes" --> i429(["429, same for known and unknown emails"])
        i2 -- "no" --> i3["find user<br/>dummy password check if unknown"]
        i3 --> i4{"credentials valid?"}
        i4 -- "no" --> i401(["401 generic message<br/>record failure"])
        i4 -- "yes" --> i5{"account disabled?"}
        i5 -- "yes" --> i403(["403, only after a correct password"])
        i5 -- "no" --> i6["reset counter<br/>session + refresh token in one transaction"]
        i6 --> i7(["200 + cookie<br/>database errors are not counted as failed logins"])
    end
```

## 8. Refresh rotation

```mermaid
flowchart TB
    a["refresh request with cookie"] --> b["generate next token and hash<br/>before the transaction"]
    b --> c["transaction: markUsedIfActive(old hash)<br/>matches only unused, not revoked, not expired"]
    c --> d{"matched?"}
    d -- "yes, only one concurrent request wins" --> e["create next token"]
    e --> f(["commit, sign JWT, 200 + new cookie"])
    d -- "no" --> g["read token state<br/>increment reuseAttempts<br/>apply reuse policy"]
```

## 9. Refresh reuse policy

A used token never gets new tokens. Every presentation is logged as `refresh_reuse_attempt`.

```mermaid
flowchart TB
    start["presented refresh token"] --> q1{"missing or unknown?"}
    q1 -- "yes" --> a1(["401 + clear cookie<br/>no session action"])
    q1 -- "no" --> q2{"expired and never used?"}
    q2 -- "yes" --> a1
    q2 -- "no" --> q3{"session revoked, past 30 day cap,<br/>or user disabled?"}
    q3 -- "yes" --> a1
    q3 -- "no" --> q4{"token revoked?"}
    q4 -- "yes" --> a1
    q4 -- "no" --> q5{"token used?"}
    q5 -- "no" --> rot(["normal rotation"])
    q5 -- "yes" --> q6{"used under 10 s ago,<br/>same IP and UA hash,<br/>at most 3 attempts?"}
    q6 -- "yes" --> a2(["409 + Retry-After 1<br/>no tokens, no revocation"])
    q6 -- "no" --> a3["revoke session and all its tokens"]
    a3 --> a4(["401 + clear cookie, no tokens"])
    a3 -. "revocation fails" .-> a5["still 401, critical log,<br/>next replay retries the revocation"]

    note["The 10 s window is only a heuristic.<br/>A matching IP and UA hash does not prove the caller<br/>is legitimate, so the benign case never gives tokens."]
    q6 -.-> note
```

## 10. Logout authorization

```mermaid
flowchart TB
    start["logout request"] --> q1{"refresh token active?<br/>found, unused, not revoked,<br/>not expired, session active"}
    q1 -- "yes" --> sid["sid resolved"]
    q1 -- "no" --> q2{"access token fully valid,<br/>not expired, session active?"}
    q2 -- "yes" --> sid
    q2 -- "no" --> none(["204, clear cookie only<br/>nothing revoked, logout_no_session"])
    sid --> tx["one transaction:<br/>revoke session and all its tokens"]
    tx --> r{"database failure?"}
    r -- "yes" --> r503(["503, client clears its own state anyway"])
    r -- "no" --> ok(["204, clear cookie"])

    note["A used, expired or revoked refresh token<br/>alone never authorizes revocation"]
    q1 -.-> note
```

## 11. Rate limit store

```mermaid
flowchart LR
    call["hit(key, limit, windowSec)"] --> store{"strategy"}
    store -- "Redis" --> lua["one atomic Lua script<br/>increment, set TTL on first hit,<br/>return count and TTL"]
    store -- "Memory" --> mem["locked map<br/>same contract"]
    lua --> res["count + remaining TTL<br/>Retry-After comes from the TTL"]
    mem --> res

    keys["Key format<br/>rl:route:type:value<br/>value is IP, email hash, email hash + IP,<br/>sid or userId<br/>raw emails never stored"]
    fails["Sign-in failures<br/>counter + blockedUntil key<br/>delay 1, 2, 4 min, max 15"]
    down["Redis down<br/>sign up, sign in, logout, refresh fail closed 503<br/>per-user limit fails open"]
    call -.-> keys
    res -.-> fails
    store -.-> down
```

## 12. Frontend classes

```mermaid
classDiagram
    class AuthProvider {
        +user
        +signIn(creds) Promise
        +signUp(data) Promise
        +signOut() void
        +bootstrap() Promise
    }
    class TokenStore {
        -accessToken memory only
        +get()
        +set(token)
        +clear()
    }
    class ApiClient {
        +post(url, body)
        +get(url)
        withCredentials true
    }
    class RefreshCoordinator {
        +refreshOnce() Promise
        +retryOnce(request) Promise
    }
    class authSchemas {
        +signUpSchema
        +signInSchema
    }
    class ProtectedRoute
    AuthProvider --> ApiClient
    AuthProvider --> TokenStore
    ApiClient --> TokenStore
    ApiClient --> RefreshCoordinator
    SignUpForm --> authSchemas
    SignInForm --> authSchemas
    SignUpForm --> AuthProvider
    SignInForm --> AuthProvider
    ProtectedRoute --> AuthProvider
```

## 13. Frontend retry and lost response

```mermaid
flowchart TB
    r1["one refresh at a time<br/>waiting requests share the result"]
    r2["each request retried at most once<br/>after a successful refresh"]
    r3["retry returns 401"] --> r3a(["clear state, go to sign in<br/>never refresh again for that request"])
    r4["refresh returns 401"] --> r4a(["sign in again<br/>no more refresh attempts until a new sign in"])
    r5["429 or 503"] --> r5a(["keep session, capped backoff<br/>max 3 attempts, then show an error"])
    r6["lost refresh response<br/>server used the old token,<br/>browser still holds it"] --> r6a["retry once"]
    r6a --> r6b{"result"}
    r6b -- "409 once, or second network failure" --> r6c(["stop, clear in-memory state<br/>show: Session could not be restored, please sign in"])
    r6b -- "401" --> r4a
```

## 14. Folder layout

```mermaid
flowchart LR
    root["repo"] --> be["backend/src"]
    root --> fe["frontend/src"]
    be --> b0["main.ts, app.module.ts"]
    be --> b1["config/<br/>env validation"]
    be --> b2["database/<br/>DatabaseModule, transaction runner"]
    be --> b3["rate-limit/<br/>store interface + token,<br/>redis and memory strategies, guards"]
    be --> b4["users/<br/>controller, service, repository interface,<br/>Mongoose schema + repository, dto"]
    be --> b5["sessions/<br/>service, repository interface,<br/>Mongoose schema + repository"]
    be --> b6["refresh-tokens/<br/>service, repository interface,<br/>Mongoose schema + repository"]
    be --> b7["auth/<br/>controller, service, token service,<br/>login-attempt service, guards, dto"]
    be --> b8["common/<br/>audit logger, exception filter, origin guard"]
    fe --> f1["api/"]
    fe --> f2["auth/"]
    fe --> f3["pages/"]
    fe --> f4["components/"]
    fe --> f5["validation/"]
```
