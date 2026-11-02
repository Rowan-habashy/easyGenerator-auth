# C4 – Code-Level Design

## Backend classes

```mermaid
classDiagram
    class AuthController {
        +signUp(dto: SignUpDto) AuthResponse
        +signIn(dto: SignInDto) AuthResponse
    }
    class AuthService {
        -usersService: UsersService
        -jwtService: JwtService
        +signUp(dto) AuthResponse
        +signIn(dto) AuthResponse
        -issueToken(user) string
    }
    class UsersController {
        +me(req) UserResponse
    }
    class UsersService {
        +create(data) UserDocument
        +findByEmail(email) UserDocument
        +findById(id) UserDocument
    }
    class JwtStrategy {
        +validate(payload) JwtUser
    }
    class JwtAuthGuard
    class SignUpDto {
        +email: string  @IsEmail
        +name: string  @MinLength(3)
        +password: string  @Matches(letter, digit, special; min 8)
    }
    class SignInDto {
        +email: string
        +password: string
    }
    class User {
        +_id: ObjectId
        +email: string  unique, lowercase
        +name: string
        +passwordHash: string  select:false
        +createdAt: Date
    }
    AuthController --> AuthService
    AuthController ..> SignUpDto
    AuthController ..> SignInDto
    AuthService --> UsersService
    UsersController --> UsersService
    UsersController ..> JwtAuthGuard
    JwtAuthGuard --> JwtStrategy
    UsersService --> User
```

Password rule (shared by backend DTO and frontend zod schema):
`^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$`

## Frontend modules

```mermaid
classDiagram
    class AuthProvider {
        +user: User | null
        +signIn(creds) Promise
        +signUp(data) Promise
        +signOut() void
    }
    class ApiClient {
        +post(url, body)
        +get(url)
        interceptor: attach Bearer, 401 -> signOut
    }
    class authSchemas {
        +signUpSchema
        +signInSchema
    }
    class ProtectedRoute {
        redirects to /signin when unauthenticated
    }
    AuthProvider --> ApiClient
    SignUpForm --> authSchemas
    SignInForm --> authSchemas
    SignUpForm --> AuthProvider
    SignInForm --> AuthProvider
    ProtectedRoute --> AuthProvider
```

## Suggested folder layout

```
backend/src/{auth,users,common,config}/ , app.module.ts, main.ts
frontend/src/{api,auth,pages,components,validation}/ , App.tsx, main.tsx
```
