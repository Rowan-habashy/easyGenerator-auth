# C2 – Container Diagram

```mermaid
flowchart LR
    user([User<br/>Browser])

    subgraph system[Auth Application]
        spa["Frontend SPA<br/>React + TypeScript + Vite<br/>Sign up / Sign in / Welcome page<br/>Access token in memory only"]
        api["Backend API<br/>NestJS + TypeScript<br/>REST, JWT access + rotating refresh,<br/>validation, Swagger"]
        db[("MongoDB<br/>users, refresh_tokens (TTL)")]
    end

    user -- "HTTPS" --> spa
    spa -- "JSON over HTTPS, withCredentials<br/>Bearer access token +<br/>httpOnly SameSite=Strict refresh cookie<br/>/api/auth/*, /api/users/me" --> api
    api -- "Mongoose (TCP 27017)" --> db
```

| Container | Tech | Responsibility |
|---|---|---|
| Frontend SPA | React, TypeScript, Vite, react-hook-form, zod, React Router, axios | Forms + client validation, in-memory access token, single-flight refresh on 401, bootstrap via `/auth/refresh`, route guarding |
| Backend API | NestJS, class-validator, Passport-JWT, bcrypt, cookie-parser, Helmet, Throttler | Sign up/in, access JWT (15m), opaque refresh token rotation with reuse detection, logout, Origin check, protected endpoints, logging, error handling |
| MongoDB | MongoDB 7 via Mongoose | Persists users (unique email index, hashed password) and `refresh_tokens` (SHA-256 hash, `familyId`, TTL index) |

Cross-cutting: the refresh cookie is `httpOnly; Secure; SameSite=Strict; Path=/api/auth`. CORS uses an exact origin allowlist with credentials. See `auth-flow.md` for XSS/CSRF details.
