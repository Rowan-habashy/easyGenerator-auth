# C3 – Component Diagram

## Backend API (NestJS)

```mermaid
flowchart TB
    client([Frontend SPA])

    subgraph api[Backend API]
        direction TB
        main["main.ts<br/>Helmet, CORS, ValidationPipe, Swagger"]
        subgraph common[Common]
            filter["HttpExceptionFilter"]
            logger["LoggingInterceptor"]
            throttle["ThrottlerGuard"]
        end
        subgraph auth[AuthModule]
            ac["AuthController<br/>POST /auth/signup<br/>POST /auth/signin"]
            as["AuthService<br/>hash, verify, sign JWT"]
            js["JwtStrategy"]
            jg["JwtAuthGuard"]
        end
        subgraph users[UsersModule]
            uc["UsersController<br/>GET /users/me (protected)"]
            us["UsersService"]
            ur["User schema (Mongoose)"]
        end
        cfg["ConfigModule<br/>env validation"]
    end
    db[("MongoDB")]

    client --> main --> throttle --> ac
    client --> jg --> uc
    ac --> as --> us --> ur --> db
    uc --> us
    jg --> js
    js --> us
    as -. "uses" .-> cfg
    filter -.-> ac
    logger -.-> ac
```

## Frontend SPA (React)

```mermaid
flowchart TB
    subgraph spa[Frontend SPA]
        router["Router<br/>/signup /signin /app"]
        pr["ProtectedRoute"]
        su["SignUpPage + SignUpForm"]
        si["SignInPage + SignInForm"]
        app["ApplicationPage<br/>'Welcome to the application.' + Logout"]
        val["validation schemas (zod)"]
        ctx["AuthContext / useAuth"]
        http["API client (axios + auth interceptor)"]
        store["Token storage"]
    end
    api([Backend API])

    router --> su & si
    router --> pr --> app
    su & si --> val
    su & si --> ctx --> http --> api
    ctx --> store
    http --> store
    app --> ctx
```
