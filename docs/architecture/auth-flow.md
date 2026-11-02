# Authentication Flow (overview)

What the system does, at a high level. Technical rules live in the C4 docs: `c2-container.md` (platform and security settings), `c3-component.md` (components and request pipeline), `c4-code.md` (classes, data, detailed rules).

Conventions: a `break` block means the request ends there. Every request first passes the shared checks (HTTPS, CORS, size limit, rate limit, validation). Details in `c3-component.md`.

| # | Flow | Summary |
|---|---|---|
| 1 | Sign up | Create the account, start a session, return tokens |
| 2 | Sign in | Check credentials, start a session, return tokens |
| 3 | Session and refresh | Call protected endpoints, renew tokens when the access token expires |
| 4 | Logout | End the session and clear the cookie |

Tokens in one line: a short-lived access token kept in browser memory, and a rotating refresh token kept in a secure cookie. A used refresh token is never accepted again.

## 1. Sign up

```mermaid
sequenceDiagram
    actor U as User
    participant F as Frontend
    participant B as Backend
    participant D as MongoDB

    U->>F: email, name, password
    break form invalid
        F-->>U: show field errors
    end
    F->>B: sign up request
    break rejected by shared checks (invalid body, too many requests, service busy)
        B-->>F: 400, 422, 429 or 503
    end
    B->>D: email already registered?
    break email exists
        B-->>F: 409 Conflict
    end
    B->>D: create user and session together (all or nothing)
    break database failure
        B-->>F: 503 Service Unavailable
    end
    B-->>F: 201 access token + user, refresh token in secure cookie
    F->>F: keep access token in memory, open the app
```

## 2. Sign in

```mermaid
sequenceDiagram
    actor U as User
    participant F as Frontend
    participant B as Backend
    participant D as MongoDB

    U->>F: email, password
    break form invalid
        F-->>U: show field errors
    end
    F->>B: sign in request
    break rejected by shared checks (invalid body, too many requests, too many failed attempts, service busy)
        B-->>F: 400, 422, 429 or 503
    end
    B->>D: find user and check password
    break user unknown or wrong password
        B-->>F: 401 same generic message for both
    end
    break account disabled
        B-->>F: 403 Forbidden
    end
    B->>D: create session
    break database failure
        B-->>F: 503 Service Unavailable
    end
    B-->>F: 200 access token + user, refresh token in secure cookie
    F->>F: keep access token in memory, open the app
```

## 3. Session and refresh

```mermaid
sequenceDiagram
    participant F as Frontend
    participant B as Backend
    participant D as MongoDB

    F->>B: protected request with access token
    alt token valid and session active
        B-->>F: 200 data
    else token expired or session ended
        B-->>F: 401
        F->>B: refresh request (cookie)
        break refresh token invalid, used, expired or session ended
            B-->>F: 401, cookie cleared
            F->>F: clear state, go to sign in
        end
        break too many requests or service busy
            B-->>F: 429 or 503
            F->>F: keep session, retry later with a limit
        end
        B->>D: replace the old refresh token with a new one (single use)
        B-->>F: new access token + new refresh token in cookie
        F->>B: repeat the original request once
        B-->>F: 200 data, or 401 then go to sign in (no second refresh)
    end
    Note over F,B: A refresh token that was already used never gets new tokens. Reuse of an old token can end the whole session. If a refresh response is lost, the frontend retries once, then asks the user to sign in again.
```

## 4. Logout

```mermaid
sequenceDiagram
    actor U as User
    participant F as Frontend
    participant B as Backend
    participant D as MongoDB

    U->>F: click Logout
    F->>B: logout request
    break rejected by shared checks (too many requests, untrusted origin)
        B-->>F: 429 or 403
    end
    B->>D: end the session if the caller proves it owns it
    break database failure
        B-->>F: 503 (client still clears its own state)
    end
    B-->>F: 204 cookie cleared
    F->>F: remove access token, go to sign in
```

## What we implement, in levels

| Level | Scope |
|---|---|
| 1 | Sign up, sign in, protected "welcome" endpoint, validation, error handling |
| 2 | Refresh tokens with rotation, logout, secure cookie, session checks |
| 3 | Rate limiting (Redis), audit logging, reuse detection |
| 4 | Tests, API docs, hardening from the C4 docs |

Security goals: no tokens in localStorage, no raw refresh tokens stored, no user enumeration beyond the sign up conflict, no permanent lockouts, and failures never issue tokens.
