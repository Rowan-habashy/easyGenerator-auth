# C2 – Container Diagram

```mermaid
flowchart LR
    user([User<br/>Browser])

    subgraph system[Auth Application]
        spa["Frontend SPA<br/>React + TypeScript + Vite<br/>Sign up / Sign in / Welcome page"]
        api["Backend API<br/>NestJS + TypeScript<br/>REST, JWT, validation, Swagger"]
        db[("MongoDB<br/>users collection")]
    end

    user -- "HTTPS" --> spa
    spa -- "JSON over HTTPS<br/>/api/auth/*, /api/users/me" --> api
    api -- "Mongoose (TCP 27017)" --> db
```

| Container | Tech | Responsibility |
|---|---|---|
| Frontend SPA | React, TypeScript, Vite, react-hook-form, zod, React Router | Forms + client validation, token storage, route guarding |
| Backend API | NestJS, class-validator, Passport-JWT, bcrypt, Helmet, Throttler | Sign up/in, JWT issuing, protected endpoints, logging, error handling |
| MongoDB | MongoDB 7 via Mongoose | Persists users (unique email index, hashed password) |
