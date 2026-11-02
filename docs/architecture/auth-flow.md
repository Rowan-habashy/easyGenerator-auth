# Authentication Flow (overview)

Technical rules live in `c2-container.md` (platform, deployment and security) and `c3-component.md` (modules, repositories, transactions, request pipeline), and the data model is in `database-design.md`

| # | Flow | Summary |
|---|---|---|
| 1 | Sign up | Create the account, start a session, return tokens |
| 2 | Sign in | Check credentials, start a session, return tokens |
| 3 | Session and refresh | Call protected endpoints, renew tokens when the access token expires |
| 4 | Logout | End the session and clear the cookie |

**Cookie rule (applies to sign up, sign in, refresh and logout):** the refresh token is sent in an HttpOnly, Secure, SameSite=Strict cookie, Path=/api/auth, 7-day expiration. MongoDB stores only its hash. Logout clears the cookie with the same path and attributes.

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
    B->>D: create user, session and refresh-token record (hash only) in one MongoDB transaction
    break database failure
        B-->>F: 503 Service Unavailable
    end
    B-->>F: 201 access token + user, refresh token in cookie (see Cookie rule)
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
    B->>D: get user and password hash
    B->>B: verify password with bcrypt
    break user unknown or wrong password
        B-->>F: 401 same generic message for both
    end
    break account disabled
        B-->>F: 403 Forbidden
    end
    B->>D: create session and refresh-token record (hash only) in one MongoDB transaction
    break database failure
        B-->>F: 503 Service Unavailable
    end
    B-->>F: 200 access token + user, refresh token in cookie (see Cookie rule)
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
        break token used a moment ago (recent replay)
            B-->>F: 409, no new tokens
            F->>F: clear state, go to sign in (no retry)
        end
        break network error, outcome unknown
            F->>F: do not resend the same token, go to sign in
        end
        break too many requests or service busy
            B-->>F: 429 or 503
            F->>F: keep session, retry later with a limit
        end
        B->>D: check session is still active, replace the old refresh token with a new one (single use)
        B-->>F: new access token + new refresh token in cookie
        F->>B: repeat the original request once
        B-->>F: 200 data, or 401 then go to sign in (no second refresh)
    end
    Note over F,B: A refresh token that was already used never gets new tokens. Reuse of an old token can end the whole session. If a refresh response is lost, the server may already have issued R2 while the browser still holds R1. This cannot be recovered, because resending R1 can never return R2 and can trigger session revocation. The frontend never resends the same token and asks the user to sign in again.
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
