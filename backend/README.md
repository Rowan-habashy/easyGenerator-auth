# Backend (NestJS + MongoDB)

Implements the design in `../docs/architecture`.

## Setup
1. `cp .env.example .env` and set `JWT_SECRET`.
2. Start MongoDB as a **replica set** (transactions require it), e.g.
   `mongod --replSet rs0` then `rs.initiate()` in `mongosh`.
3. Start Redis (`docker run -p 6379:6379 redis`) and set `REDIS_URL`. It holds the shared rate-limit counters.
4. For local HTTP development set `COOKIE_SECURE=false`.
4. `npm install && npm run start:dev`

## Configuration
All tunable values (TTLs, limits, cookie settings, JWT, bcrypt cost, Redis/Mongo URLs) are read from environment variables in one place: `src/config/app-config.ts`. Required: `MONGODB_URI`, `REDIS_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`. Everything else has a documented default; see `.env.example` for the full list.
Fixed protocol values (Mongo error codes, collection names, route bases, validation limits) live in `src/common/constants.ts`.

## Endpoints
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/signup` | 201, access token in body, refresh token in cookie |
| POST | `/api/auth/signin` | 200, same as above |
| POST | `/api/auth/refresh` | 200, rotates refresh token (single use) |
| POST | `/api/auth/logout` | 204, ends session, clears cookie |
| GET | `/api/users/me` | Bearer access token required |

Sample calls are in `requests.http`.

## Layout
`common` (errors, filter, origin guard, limiter), `users`, `sessions`, `tokens`, `auth`.

## Notes
- Rate limits (general per-IP and failed sign-in) are counted in Redis, so they are shared by all instances. Failed sign-ins are limited per IP (5) and per email (10) per 15 minutes. If Redis is down the failed sign-in limiter falls back to a per-instance in-memory counter and the general throttler fails open, with a warning logged.
- TTL indexes purge sessions and refresh tokens 7 days after they expire.
