# C3: Component Diagram

```mermaid
flowchart TB
    FE["Frontend SPA"]

    subgraph BE["Backend API"]
        direction TB
        subgraph Pipeline["Request pipeline"]
            MW["Security middleware<br/>HTTPS, CORS, origin check,<br/>rate limit, body validation"]
            GD["AuthGuard<br/>verify access token +<br/>session active"]
            EF["Exception filter<br/>maps errors to status codes"]
        end

        AC["AuthController<br/>signup, signin, refresh, logout<br/>sets and clears the refresh cookie<br/>HttpOnly, Secure, SameSite=Strict, Path=/api/auth"]
        AS["AuthService<br/>orchestrates the 4 flows<br/>and transactions"]
        US["UsersService<br/>email normalize, create, find"]
        SS["SessionsService<br/>create, check, revoke"]
        TS["TokensService<br/>sign access token,<br/>generate and hash refresh token,<br/>rotate and detect reuse"]
        PH["PasswordHasher<br/>bcrypt"]

        UR[("UsersRepository")]
        SR[("SessionsRepository")]
        RR[("RefreshTokensRepository")]
    end

    DB[("MongoDB")]

    FE --> MW --> AC
    FE --> MW --> GD
    AC --> AS
    AS --> US
    AS --> SS
    AS --> TS
    AS --> PH
    US --> UR
    SS --> SR
    TS --> RR
    GD --> SS
    UR --> DB
    SR --> DB
    RR --> DB
    EF -.-> AC
```

## Components

| Component | Responsibility |
|---|---|
| Security middleware | Rate limit (429), body validation (400/422), origin check on refresh and logout (403) |
| AuthGuard | Verifies the access token and that its session is active and not expired. Otherwise 401 |
| AuthController | HTTP only. Reads the refresh cookie, calls `AuthService`, sets or clears the cookie with HttpOnly, Secure, SameSite=Strict, Path=/api/auth (same attributes when clearing) |
| AuthService | Runs each flow and owns the transaction boundary |
| UsersService / Repository | Trim and lowercase email, unique index, find by email |
| SessionsService / Repository | Create (30 days), check active, revoke |
| TokensService / RefreshTokensRepository | Random token, SHA-256 hash, 7 days or session expiry, rotation, reuse detection |
| PasswordHasher | bcrypt hash and compare |
| Exception filter | Single place that maps errors to status codes and a generic body |

## Sign up

```mermaid
sequenceDiagram
    participant C as Controller
    participant A as AuthService
    participant U as UsersService
    participant T as TokensService
    participant D as MongoDB

    C->>A: signUp(email, name, password)
    A->>U: findByEmail
    alt exists
        A-->>C: 409
    end
    A->>A: bcrypt hash
    A->>D: start transaction
    A->>U: create user
    A->>D: create session (30 days)
    A->>T: issue refresh token (hash only)
    A->>D: commit
    alt duplicate email key (race)
        A-->>C: 409
    else DB failure
        A-->>C: 503
    end
    A-->>C: access token, refresh token, user
    C-->>C: set cookie (HttpOnly, Secure, SameSite=Strict), return 201
```

## Sign in

```mermaid
sequenceDiagram
    participant C as Controller
    participant A as AuthService
    participant D as MongoDB

    C->>A: signIn(email, password)
    A->>D: find user
    A->>A: bcrypt compare (dummy compare if user unknown)
    alt unknown user or wrong password
        A-->>C: 401 same message
    else isDisabled
        A-->>C: 403
    end
    A->>D: transaction: create session and refresh token
    alt DB failure
        A-->>C: 503
    end
    A-->>C: access token, refresh token, user
    C-->>C: set cookie (HttpOnly, Secure, SameSite=Strict), return 200
```

## Refresh (rotation)

```mermaid
sequenceDiagram
    participant C as Controller
    participant A as AuthService
    participant D as MongoDB

    C->>A: refresh(cookie token)
    A->>A: SHA-256 hash
    A->>D: find token by hash
    alt not found, expired or revoked
        A-->>C: 401, clear cookie
    else session ended or expired, or user disabled
        A-->>C: 401, clear cookie
    else already used
        alt used within the grace window
            A-->>C: 409, no new tokens
        else older replay
            A->>D: revoke session
            A-->>C: 401, clear cookie
        end
    end
    A->>D: transaction start
    A->>D: update token set usedAt where usedAt null, revokedAt null (conditional)
    alt matched 0 documents (concurrent rotation lost)
        A-->>C: 409
    end
    A->>D: insert new token, set replacedBy, update session lastUsedAt
    A->>D: commit
    alt DB failure
        A-->>C: 503
    end
    A-->>C: new access token and refresh token
    C-->>C: set cookie (HttpOnly, Secure, SameSite=Strict), return 200
```

## Protected request and logout

```mermaid
sequenceDiagram
    participant G as AuthGuard
    participant S as SessionsService
    participant C as Controller
    participant A as AuthService
    participant D as MongoDB

    G->>G: verify JWT signature and expiry
    G->>S: session active?
    alt invalid, expired or session ended
        G-->>G: 401
    end
    G->>C: continue to handler

    C->>A: logout(sessionId)
    A->>D: set sessions.revokedAt, revokedReason = logout
    A->>D: set revokedAt on the session's active refresh tokens
    alt DB failure
        A-->>C: 503
    end
    C-->>C: clear cookie, return 204
```
