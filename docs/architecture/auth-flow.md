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
    S->>D: revoke familyId
    S-->>F: 204 + clear cookie
    F->>F: drop in-memory access token, redirect /signin
```

`POST /api/auth/logout-all` (optional) and password change revoke every family of the user.

## Session bootstrap on page load

The access token is memory-only, so a reload loses it. The SPA calls `POST /api/auth/refresh` first. On success it calls `GET /api/users/me`. On failure it redirects to `/signin`.

## Security notes

- Passwords hashed with bcrypt (cost 12); never returned (`select: false`).
- Same generic error for unknown email and wrong password; rate limiting on auth routes.
- JWT signed with secret from env, short expiry (e.g. 15m–1h); validated by Passport-JWT.
- Helmet, restricted CORS, whitelist `ValidationPipe` (`forbidNonWhitelisted`).
- Token storage: access token in JS memory only (never localStorage/sessionStorage); refresh token in an httpOnly, Secure, SameSite=Strict cookie scoped to `Path=/api/auth`.

## Token model

| Token | Lifetime | Client storage | Transport |
|---|---|---|---|
| Access JWT | 10-15 min | Memory only | `Authorization: Bearer` |
| Refresh token (opaque, 256-bit random) | 7 days sliding, 30 days absolute max | httpOnly cookie | Cookie, auth routes only |

`refresh_tokens` collection: `userId`, `tokenHash` (SHA-256, raw token never stored), `familyId`, `expiresAt` (TTL index), `revokedAt`, `replacedBy`, `userAgent`, `ip`.

## XSS mitigation

- Refresh token is httpOnly, so scripts cannot read it.
- Access token is memory-only and short-lived, which limits the impact of a leak.
- Helmet with a strict CSP; React output escaping; no `dangerouslySetInnerHTML`.
- Residual risk: XSS can still make authenticated calls while the page is open.

## CSRF mitigation

Only the cookie-based endpoints (`/refresh`, `/logout`) are CSRF-relevant. Business endpoints use the Bearer header, which cross-site requests cannot attach.

- `SameSite=Strict` and `Path=/api/auth` on the cookie.
- Strict CORS: exact origin allowlist with `credentials: true`, never `*`.
- `OriginGuard` validates `Origin`/`Referer` on `/refresh` and `/logout`.
- Optional: double-submit CSRF header.
- Dev: Vite (:5173) and API (:3000) are same-site (localhost). In production, serve both under one domain or behind a reverse proxy.

## Config

`JWT_ACCESS_EXPIRES_IN`, `REFRESH_TTL_DAYS`, `REFRESH_ABSOLUTE_TTL_DAYS`, `COOKIE_SECURE`, `CORS_ORIGIN`.

## Required tests

Rotation, reuse detection revokes the family, expired token rejected, logout revokes the family, and concurrent refresh handled by the single-flight client.
