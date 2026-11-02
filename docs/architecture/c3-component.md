# C3 – Component Diagram

## Backend API (NestJS)

```mermaid
flowchart TB
    client([Frontend SPA])

    subgraph api[Backend API]
        direction TB
        subgraph pipe[Request pipeline, in order]
            direction TB
            p1["1 CORS allowlist, body size limit, JSON parse<br/>(413, 400)"]
            p2["2 IpThrottlerGuard<br/>(429, 503 if Redis down)"]
            p3["3 OriginGuard, cookie routes only<br/>(403)"]
            p4["4 JwtAuthGuard, protected routes only<br/>token + session check (401, 503)"]
            p5["5 UserThrottlerGuard, protected routes only<br/>(429, fails open)"]
            p6["6 ValidationPipe<br/>(422)"]
            p1 --> p2 --> p3 --> p4 --> p5 --> p6
        end
        subgraph auth[AuthModule]
            ac["AuthController<br/>signup, signin, refresh, logout"]
            as["AuthService<br/>orchestrates the flows"]
            ss["SessionService<br/>create, check, revoke sessions<br/>runs MongoDB transactions"]
            rts["RefreshTokenService<br/>issue, rotate, reuse policy"]
            ts["TokenService<br/>sign and verify access JWT"]
            lat["LoginAttemptService<br/>failed sign in counters and delays"]
        end
        subgraph users[UsersModule]
            uc["UsersController<br/>GET /users/me"]
            us["UsersService"]
        end
        subgraph shared[Shared]
            rl["RateLimitStore (interface)<br/>RedisStore default, MemoryStore for tests"]
            al["AuditLogger<br/>events, never secrets"]
            ef["HttpExceptionFilter<br/>mapped status, generic 500"]
        end
    end
    db[("MongoDB replica set")]
    redis[("Redis")]

    client --> p1
    p6 --> ac --> as
    p6 --> uc --> us
    as --> us
    as --> ss --> db
    as --> rts --> db
    as --> ts
    as --> lat --> rl
    p2 --> rl
    p5 --> rl
    rl --> redis
    us --> db
    p4 --> ss
    p4 --> ts
    as --> al
    rts --> al
    ef -.-> ac
```

## Responsibilities

| Component | Responsibility |
|---|---|
| Request pipeline | The same ordered checks for every endpoint. Per-user limits run only after authentication, so `userId` is never taken from an unverified token |
| AuthService | Runs sign up, sign in, refresh and logout. No database details inside |
| SessionService | One session per login. Starts, checks and revokes sessions. Owns the MongoDB transactions and their retry rules |
| RefreshTokenService | Creates tokens (random value first, then hash), rotates them in one transaction, applies the reuse policy |
| TokenService | Signs the access JWT only after the transaction commits. Verifies signature, algorithm, `iss`, `aud`, `exp` |
| LoginAttemptService | Counts failed sign ins per email hash, applies the progressive delay. Unknown emails are counted the same way |
| RateLimitStore | One interface for all counters. Redis is the default, memory is for tests |
| AuditLogger | Records sign up, sign in success and failure, throttling, logout, refresh reuse and Redis or commit outages |

## Frontend SPA (React)

```mermaid
flowchart TB
    subgraph spa[Frontend SPA]
        router["Router<br/>/signup /signin /app"]
        pr["ProtectedRoute"]
        su["SignUpPage + form"]
        si["SignInPage + form"]
        app["ApplicationPage<br/>Welcome + Logout"]
        val["Validation schemas (zod)"]
        ctx["AuthContext / useAuth"]
        http["API client (axios, withCredentials)<br/>RefreshCoordinator"]
        store["In-memory access token store"]
        boot["Session bootstrap<br/>refresh, then GET /users/me"]
    end
    api([Backend API])

    router --> su & si
    router --> pr --> app
    su & si --> val
    su & si --> ctx --> http --> api
    ctx --> store
    http --> store
    ctx --> boot --> http
    app --> ctx
```

| Component | Responsibility |
|---|---|
| RefreshCoordinator | One refresh at a time (single-flight). Each request is retried at most once after a refresh. A 401 from refresh means sign in again, with no more refresh attempts |
| Error handling | 429 and 503 keep the session and retry with capped backoff. A lost refresh response gets one retry, then a "please sign in" message |
