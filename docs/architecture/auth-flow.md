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
        S->>S: sign JWT {sub, email}
        S-->>F: 201 {accessToken, user}
        F->>F: store token, navigate /app
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
        S-->>F: 200 {accessToken, user}
        F->>F: store token, navigate /app
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
        F->>F: clear token, redirect /signin
    end
    Note over F: Logout = clear token and redirect to /signin
```

## Security notes

- Passwords hashed with bcrypt (cost 12); never returned (`select: false`).
- Same generic error for unknown email and wrong password; rate limiting on auth routes.
- JWT signed with secret from env, short expiry (e.g. 15m–1h); validated by Passport-JWT.
- Helmet, restricted CORS, whitelist `ValidationPipe` (`forbidNonWhitelisted`).
- Token storage: in-memory + sessionStorage for simplicity; production hardening option is an httpOnly, SameSite cookie.
