# C4 – Code-Level Design

## Backend classes

```mermaid
classDiagram
    class AuthController {
        +signUp(dto: SignUpDto) AuthResponse
        +signIn(dto: SignInDto) AuthResponse
        +refresh(req, res) AccessTokenResponse
        +logout(req, res) void
        +logoutAll(req, res) void
    }
    class AuthService {
        -usersService: UsersService
        -jwtService: JwtService
        -refreshTokens: RefreshTokensService
        +signUp(dto, meta) AuthSession
        +signIn(dto, meta) AuthSession
        +refresh(rawToken, meta) AuthSession
        +logout(rawToken) void
        -issueAccessToken(user) string
    }
    class AuthSession {
        +accessToken: string
        +refreshToken: string
        +user: UserResponse
    }
    class RefreshTokensService {
        +issue(userId, meta) RawToken
        +rotate(rawToken, meta) RotationResult
        +revokeFamily(familyId) void
        +revokeAllForUser(userId) void
        -hash(raw) string  SHA-256
    }
    class RefreshToken {
        +userId: ObjectId
        +tokenHash: string  unique
        +familyId: string
        +expiresAt: Date  TTL index
        +revokedAt: Date?
        +replacedBy: ObjectId?
        +userAgent: string?
        +ip: string?
    }
    class OriginGuard {
        +canActivate(ctx) boolean
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
    AuthService --> RefreshTokensService
    AuthService ..> AuthSession
    AuthController ..> OriginGuard
    RefreshTokensService --> RefreshToken
    UsersController --> UsersService
    UsersController ..> JwtAuthGuard
    JwtAuthGuard --> JwtStrategy
    UsersService --> User
```

## Frontend modules

```mermaid
classDiagram
    class AuthProvider {
        +user: User | null
        +signIn(creds) Promise
        +signUp(data) Promise
        +signOut() void
        +bootstrap() Promise  refresh then GET /users/me, else /signin
    }
    class TokenStore {
        -accessToken: string | null  memory only
        +get() string | null
        +set(token) void
        +clear() void
    }
    class ApiClient {
        +post(url, body)
        +get(url)
        withCredentials: true
        interceptor: attach Bearer
        interceptor: 401 -> single-flight refresh, retry once, else signOut
    }
    class authSchemas {
        +signUpSchema
        +signInSchema
    }
    class ProtectedRoute {
        redirects to /signin when unauthenticated
    }
    AuthProvider --> ApiClient
    AuthProvider --> TokenStore
    ApiClient --> TokenStore
    SignUpForm --> authSchemas
    SignInForm --> authSchemas
    SignUpForm --> AuthProvider
    SignInForm --> AuthProvider
    ProtectedRoute --> AuthProvider
```

## Suggested folder layout

```
backend/src/{auth,users,refresh-tokens,common,config}/ , app.module.ts, main.ts
frontend/src/{api,auth,pages,components,validation}/ , App.tsx, main.tsx
```
