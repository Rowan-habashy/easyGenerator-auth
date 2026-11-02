# C3 – Component Diagram

## 1. Modules and imports

Feature-based modules. Only `AuthModule` combines them. No cycles.

```mermaid
flowchart TB
    app["AppModule"]
    auth["AuthModule<br/>controller, AuthService, TokenService,<br/>LoginAttemptService, guards"]
    users["UsersModule<br/>UsersService"]
    sessions["SessionsModule<br/>SessionsService"]
    rtokens["RefreshTokensModule<br/>RefreshTokensService"]
    rl["RateLimitModule<br/>RATE_LIMIT_STORE, throttler guards"]
    db["DatabaseModule, global<br/>Mongoose connection<br/>TRANSACTION_RUNNER"]
    cfg["ConfigModule, global<br/>env validation"]
    common["CommonModule<br/>AuditLogger, HttpExceptionFilter, OriginGuard"]

    app --> auth & users & sessions & rtokens & rl & db & cfg & common
    auth --> users & sessions & rtokens & rl
    users --> db
    sessions --> db
    rtokens --> db
    rl --> cfg
```

## 2. Request pipeline

```mermaid
flowchart LR
    client([Frontend SPA])
    p1["1 CORS, body size,<br/>JSON parse<br/>413, 400"]
    p2["2 IpThrottlerGuard<br/>429, 503"]
    p3["3 OriginGuard<br/>cookie routes only<br/>403"]
    p4["4 JwtAuthGuard<br/>protected routes only<br/>401, 503"]
    p5["5 UserThrottlerGuard<br/>protected routes only<br/>429, fails open"]
    p6["6 ValidationPipe<br/>422"]
    ctl["Controller"]
    filt["HttpExceptionFilter<br/>maps errors, generic 500"]

    client --> p1 --> p2 --> p3 --> p4 --> p5 --> p6 --> ctl
    ctl -. "any error" .-> filt
    filt --> client
```

## 3. Layering inside a feature module

Dependency direction: controller, then service, then repository interface. The Mongoose class implements the interface.

```mermaid
flowchart LR
    ctl["Controller<br/>thin"]
    svc["Service<br/>business rules"]
    iface(["Repository interface<br/>+ injection token"])
    impl["Mongoose repository<br/>+ schema"]
    db[("MongoDB")]

    ctl --> svc --> iface
    impl -. "implements" .-> iface
    impl --> db
```

## 4. Backend components

```mermaid
flowchart TB
    subgraph authm[AuthModule]
        ac["AuthController"]
        as["AuthService<br/>orchestrates the four flows<br/>owns the transaction boundary"]
        ts["TokenService<br/>access JWT"]
        lat["LoginAttemptService"]
    end
    subgraph usersm[UsersModule]
        us["UsersService"]
        ur(["UsersRepository"])
        urm["MongooseUsersRepository"]
        uc["UsersController<br/>GET /users/me"]
    end
    subgraph sessm[SessionsModule]
        ss["SessionsService"]
        sr(["SessionsRepository"])
        srm["MongooseSessionsRepository"]
    end
    subgraph rtm[RefreshTokensModule]
        rts["RefreshTokensService<br/>generate, rotate, reuse policy"]
        rr(["RefreshTokensRepository"])
        rrm["MongooseRefreshTokensRepository"]
    end
    subgraph dbm[DatabaseModule]
        tr(["TransactionRunner"])
        trm["MongooseTransactionRunner"]
    end
    subgraph rlm[RateLimitModule]
        rl(["RateLimitStore<br/>strategy"])
        redisS["RedisRateLimitStore<br/>default"]
        memS["MemoryRateLimitStore<br/>tests"]
    end
    al["AuditLogger"]
    mongo[("MongoDB replica set")]
    redis[("Redis")]

    ac --> as
    as --> us & ss & rts & ts & lat & tr & al
    uc --> us
    us --> ur
    ss --> sr
    rts --> rr
    rts --> al
    lat --> rl
    urm -. implements .-> ur
    srm -. implements .-> sr
    rrm -. implements .-> rr
    trm -. implements .-> tr
    redisS -. implements .-> rl
    memS -. implements .-> rl
    urm & srm & rrm & trm --> mongo
    redisS --> redis
```

## 5. Transaction boundary per flow

`AuthService` opens one transaction through `TransactionRunner`. Each repository write joins it. The access JWT is signed only after the commit.

```mermaid
flowchart LR
    subgraph signup[Sign up]
        a1["register user"] --> a2["start session"] --> a3["issue refresh token"]
    end
    subgraph signin[Sign in]
        b1["start session"] --> b2["issue refresh token"]
    end
    subgraph refresh[Refresh rotation]
        c1["mark old token used<br/>only if still active"] --> c2["create next token"]
    end
    subgraph logout[Logout and reuse revocation]
        d1["revoke session"] --> d2["revoke all its tokens"]
    end

    a3 --> commit(["commit"])
    b2 --> commit
    c2 --> commit
    d2 --> commit
    commit --> jwt["then sign access JWT"]
```

## 6. Rate-limit strategy

```mermaid
flowchart LR
    ipg["IpThrottlerGuard"]
    ug["UserThrottlerGuard"]
    lat["LoginAttemptService"]
    as["AuthService<br/>signup and refresh counters"]
    rl(["RateLimitStore<br/>hit(key, limit, window)"])
    cfg{"RATE_LIMIT_STORE"}
    redisS["RedisRateLimitStore<br/>one atomic script per hit"]
    memS["MemoryRateLimitStore<br/>unit tests"]
    redis[("Redis")]

    ipg & ug & lat & as --> rl
    cfg -- "redis, default" --> redisS
    cfg -- "memory" --> memS
    redisS -. implements .-> rl
    memS -. implements .-> rl
    redisS --> redis
```

## 7. Frontend components

```mermaid
flowchart TB
    subgraph spa[Frontend SPA]
        router["Router<br/>/signup /signin /app"]
        pr["ProtectedRoute"]
        su["SignUpPage + form"]
        si["SignInPage + form"]
        app["ApplicationPage<br/>Welcome + Logout"]
        val["Validation schemas, zod"]
        ctx["AuthContext / useAuth"]
        http["ApiClient<br/>axios, withCredentials"]
        rc["RefreshCoordinator"]
        store["TokenStore<br/>memory only"]
        boot["Session bootstrap<br/>refresh, then GET /users/me"]
    end
    api([Backend API])

    router --> su & si
    router --> pr --> app
    su & si --> val
    su & si --> ctx --> http --> api
    ctx --> store
    http --> store
    http --> rc
    ctx --> boot --> http
    app --> ctx
```

## 8. RefreshCoordinator behavior

```mermaid
flowchart TB
    req["API request"] --> send["send with access token"]
    send --> ok{"response"}
    ok -- "2xx" --> done(["return data"])
    ok -- "401 and not yet retried" --> flight{"refresh already<br/>in flight?"}
    flight -- "yes" --> wait["wait for its result"]
    flight -- "no" --> doref["refresh once"]
    doref --> rres{"refresh result"}
    wait --> rres
    rres -- "success" --> retry["retry request once<br/>mark retried"]
    retry --> r2{"response"}
    r2 -- "2xx" --> done
    r2 -- "401" --> out(["clear state, go to sign in"])
    rres -- "401" --> out
    rres -- "409 or network error" --> once{"second failure?"}
    once -- "no" --> doref
    once -- "yes" --> msg(["clear state, show<br/>please sign in"])
    rres -- "429 or 503" --> back["capped backoff<br/>max 3 attempts, keep session"]
    ok -- "401 already retried" --> out
```
