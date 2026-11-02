# C2 – Container Diagram

System level only: what runs, how containers talk, where secrets live, what happens when a container fails. Internals of the backend and frontend are in `c3-component.md`.

## 1. Containers

```mermaid
flowchart LR
    user([User])

    subgraph browser[Browser]
        spa["Frontend SPA<br/>React + TypeScript + Vite"]
    end

    subgraph backend[Backend, private network]
        api["Backend API<br/>NestJS + TypeScript<br/>one or many instances"]
    end

    subgraph data[Data stores, private network]
        mongo[("MongoDB replica set<br/>users, sessions, refresh_tokens<br/>transactions + TTL")]
        redis[("Redis<br/>rate-limit counters only<br/>TTL on every key")]
    end

    user -- "uses" --> spa
    spa -- "HTTPS only, HSTS, exact-origin CORS<br/>JSON + Bearer access token<br/>refresh cookie (HttpOnly, Secure, SameSite=Strict)" --> api
    api -- "Mongoose (27017)" --> mongo
    api -- "Redis client (6379)<br/>password" --> redis
```

## 2. Where each secret lives

```mermaid
flowchart TB
    subgraph browser[Browser]
        mem["JS memory<br/>access token (15 min)"]
        cookie["HttpOnly cookie<br/>refresh token (7 days)<br/>Path /api/auth"]
        nostore["Never used<br/>localStorage, sessionStorage"]
    end
    subgraph api[Backend API]
        jwt["Signs access JWT<br/>algorithm pinned"]
        gen["Generates refresh token<br/>256-bit random"]
    end
    subgraph mongo[MongoDB]
        hash["refresh_tokens<br/>SHA-256 hash only"]
        pw["users<br/>password hash only<br/>bcrypt cost 12"]
    end
    subgraph redis[Redis]
        cnt["counters keyed by<br/>IP, email hash, sid, userId<br/>no raw emails"]
    end

    jwt -- "issues" --> mem
    gen -- "Set-Cookie" --> cookie
    gen -- "stores hash, never the raw value" --> hash
    api -- "stores hash" --> pw
    api -- "increments" --> cnt
```

## 3. Why Redis: shared counters across instances

```mermaid
flowchart LR
    u1["Attacker, IP 1<br/>5 failed sign ins"] --> b1["Backend instance A"]
    u2["Attacker, IP 2<br/>5 more failed sign ins"] --> b2["Backend instance B"]
    b1 -- "increment signin:hash(email)" --> redis[("Redis<br/>one counter per key<br/>atomic script per hit")]
    b2 -- "increment the same key" --> redis
    redis --> r["Count passes 5 in 15 min"]
    r --> d["429 + Retry-After<br/>for every IP and instance"]
    note["Without a shared store, each instance<br/>would see only 5 failures<br/>and the limit would be doubled"]
    redis -.-> note
```

## 4. Failure behavior

```mermaid
flowchart TB
    api["Backend API"]

    api -- "Redis down" --> r{"Which route?"}
    r -- "sign up, sign in,<br/>logout, refresh" --> closed["Fail closed<br/>503 + Retry-After<br/>critical log"]
    r -- "per-user limit on<br/>protected routes" --> open["Fail open<br/>critical log<br/>session still checked in MongoDB"]

    api -- "MongoDB down" --> m["503<br/>no tokens issued<br/>session check fails closed"]
    api -- "backend restart" --> s["Redis counters survive<br/>sessions and tokens live in MongoDB"]
```
