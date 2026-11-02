# Authentication Flow

## Sign up

```mermaid
sequenceDiagram
    actor U as User
    participant F as Frontend SPA
    participant A as AuthController
    participant S as AuthService
    participant D as UsersService / MongoDB

    U->>F: Fill email, name, password
    F->>F: zod validation (email, name>=3, password rules)
    F->>A: POST /api/auth/signup
    A->>A: ValidationPipe (SignUpDto)
    A->>S: signUp(dto)
    S->>D: findByEmail(email)
    alt email exists
        D-->>S: user
        S-->>F: 409 Conflict
    else new
        S->>S: bcrypt.hash(password, 12)
        S->>D: create({email, name, passwordHash})
        S->>S: sign access JWT {sub, email} (15m)
        S->>D: create refresh token (new familyId, store SHA-256 hash)
        S-->>F: 201 {accessToken, user} + Set-Cookie refresh_token (httpOnly, Secure, SameSite=Strict, Path=/api/auth)
        F->>F: keep accessToken in memory only, navigate /app
    end
```

## Sign in

```mermaid
sequenceDiagram
    actor U as User
    participant F as Frontend SPA
    participant A as AuthController
    participant S as AuthService
    participant D as MongoDB

    U->>F: Email + password
    F->>A: POST /api/auth/signin
    A->>S: signIn(dto)
    S->>D: find user (with passwordHash)
    S->>S: bcrypt.compare
    alt invalid
        S-->>F: 401 "Invalid credentials" (generic)
    else valid
        S->>D: create refresh token (new familyId, store hash)
        S-->>F: 200 {accessToken, user} + Set-Cookie refresh_token (httpOnly)
        F->>F: keep accessToken in memory only, navigate /app
    end
```

## Protected request and logout

```mermaid
sequenceDiagram
    participant F as Frontend SPA
    participant G as JwtAuthGuard
    participant C as UsersController

    F->>G: GET /api/users/me (Authorization: Bearer JWT)
    alt valid token
        G->>C: request.user
        C-->>F: 200 {id, email, name}
    else missing/expired
        G-->>F: 401
        F->>F: single-flight POST /api/auth/refresh, retry request once
        Note over F: if refresh fails: clear memory token, redirect /signin
    end
```

## Token refresh with rotation and reuse detection

```mermaid
sequenceDiagram
    participant F as Frontend SPA
    participant A as AuthController
    participant O as OriginGuard
    participant S as AuthService
    participant D as MongoDB (refresh_tokens)

    F->>O: POST /api/auth/refresh (cookie refresh_token, withCredentials)
    O->>O: verify Origin/Referer in allowlist
    O->>A: ok
    A->>S: refresh(rawToken)
    S->>D: find by SHA-256(rawToken)
    alt not found or expired
        S-->>F: 401 + clear cookie
    else already used/revoked (REUSE DETECTED)
        S->>D: revoke ALL tokens in familyId
        S-->>F: 401 + clear cookie (user must sign in again)
    else valid
        S->>D: mark current used (revokedAt, replacedBy)
        S->>D: insert new token (same familyId, new hash)
        S-->>F: 200 {accessToken} + Set-Cookie new refresh_token
    end
```

## Logout

```mermaid
sequenceDiagram
    participant F as Frontend SPA
    participant A as AuthController
    participant S as AuthService
    participant D as MongoDB

    F->>A: POST /api/auth/logout (cookie, Origin checked)
    A->>S: logout(rawToken)
    S->>D: revoke familyId (all refresh tokens of this session)
    S-->>F: 204 + clear cookie
    F->>F: drop in-memory access token, redirect /signin
    Note over F,D: A1 stays valid until its own exp (max 15m). R1/R2 are dead immediately.
```

## Token lifecycle: A1, R1, A2, R2

A = access JWT (15 min, memory only). R = opaque refresh token (httpOnly cookie, hash stored in `refresh_tokens`).

```mermaid
sequenceDiagram
    participant F as Frontend SPA
    participant API as Backend API
    participant D as MongoDB (refresh_tokens)

    F->>API: signin
    API->>D: insert R1 (familyId=X, active)
    API-->>F: A1 + cookie R1
    F->>API: GET /users/me with A1
    API-->>F: 200
    Note over F: A1 expires
    F->>API: GET /users/me with A1
    API-->>F: 401 (expired)
    F->>API: POST /auth/refresh with R1
    API->>D: R1 active -> mark R1 used (replacedBy=R2), insert R2 (familyId=X)
    API-->>F: A2 + cookie R2
    F->>API: GET /users/me with A2
    API-->>F: 200
    Note over F,API: Someone replays R1 (stolen token or old tab)
    F->>API: POST /auth/refresh with R1
    API->>D: R1 is already used -> revoke ALL tokens of familyId X (R1, R2)
    API-->>F: 401 + clear cookie
    F->>F: redirect /signin
```

### What happens in each case

| # | Situation | Server decision | Result |
|---|---|---|---|
| 1 | A1 valid, R1 active | No refresh needed | Request succeeds |
| 2 | A1 expired, R1 active | Client gets 401, calls `/auth/refresh` once (single-flight) | Continues at case 3 |
| 3 | Refresh with R1 (active, not expired) | Mark R1 `used`, insert R2 (same family), issue A2 | Client gets A2 + R2, retries original request |
| 4 | After case 3, client or attacker sends R1 again | R1 is `used` -> reuse detected -> revoke whole family | 401, R2 is also dead, user must sign in |
| 5 | After case 3, old A1 is used before its `exp` | A1 is a stateless JWT, signature and exp still valid | Accepted until `exp` (max 15 min). R1 is already rejected |
| 6 | Logout while A1 not yet expired | Revoke family (R1 or R2, whichever is current), clear cookie | Refresh is impossible immediately. A1 still works until `exp` (max 15 min) |
| 7 | Refresh after logout (R1 or R2 replayed) | Token is `revoked` | 401, user must sign in |
| 8 | R expired (7 days sliding, 30 days absolute) | `expiresAt` passed (TTL index also deletes it) | 401, user must sign in |
| 9 | Page reload | A is memory-only and lost, cookie R still present | Bootstrap: `/auth/refresh` (rotation as case 3), then `/users/me` |
| 10 | Two tabs refresh with the same R1 at once | Reuse of R1 within a short grace window (about 10 s) returns an error without revoking the family. Outside the window it is treated as case 4 | Avoids logging out a legitimate user |
| 11 | Password change or `logout-all` | Revoke every family of the user | All sessions end, A tokens expire naturally |

Optional strict logout (case 6): put `familyId` as `sid` in A and have `JwtAuthGuard` check that the family is not revoked (one DB read per request). A1 then dies at logout.

### What the `refresh_tokens` table stores

Raw tokens are never stored, only the SHA-256 hash. This is what blocks R1 after rotation.

| Field | Purpose |
|---|---|
| `userId` | Owner |
| `tokenHash` | SHA-256 of the token (unique index) |
| `familyId` | One per login session, used to revoke all tokens of that session |
| `expiresAt` | TTL index removes expired rows |
| `revokedAt` | Set when used by rotation, or revoked by logout or reuse detection |
| `replacedBy` | Points to the next token (R1 -> R2) |
| `userAgent`, `ip` | Audit |

State of the rows through the scenario:

| Step | R1 | R2 | Can R1 be used? |
|---|---|---|---|
| After signin | active | - | Yes |
| After refresh (A2 issued) | used (`revokedAt` set, `replacedBy`=R2) | active | No (triggers case 4) |
| After R1 replay | revoked | revoked | No |
| After logout (instead of replay) | revoked | revoked | No |
