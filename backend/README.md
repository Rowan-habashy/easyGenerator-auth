# Backend (NestJS + MongoDB)

This backend implements the architecture in `../docs/architecture`.

This guide is meant for **developers/reviewers** to quickly:
- understand the project structure,
- configure local or production-backed runs,
- run and test safely,
- and deploy with the expected environment.

## Architecture at a glance

Main feature modules:
- `auth` (module surface: controller/service/guard/dto/constants)
- `users`
- `sessions`
- `tokens`

Shared code:
- `common/errors`, `common/filters`, `common/guards`, `common/http`, `common/middleware`, `common/helpers`
- `database` (transaction runner + mongo error classifier)
- `config` (typed environment loading)
- `redis` (redis provider + throttler storage)

## Quick start (local)

1. Copy env file and set required variables:
   - `cp .env.example .env`
   - set `JWT_SECRET`
2. Start MongoDB as a **replica set** (required for transactions):
   - `mongod --replSet rs0`
   - then run `rs.initiate()` in `mongosh` (first time only)
3. For local HTTP development:
   - set `COOKIE_SECURE=false`
4. Install and run:
   - `npm install`
   - `npm run start:dev`

## Configuration

All runtime config is centralized in `src/config/app-config.ts`.

Required values:
- `MONGODB_URI`
- `JWT_SECRET`
- `FRONTEND_ORIGIN`

Conditionally required:
- `REDIS_URL` only when `RATE_LIMIT_STORE=redis`

All other values have defaults in `.env.example`.

## Local DB vs Production DB connection profiles

You can run this backend locally while pointing to either local or production services.

### Option A: local app + local database (recommended for development)

Use in `.env`:

```env
MONGODB_URI=mongodb://localhost:27017/easygenerator?replicaSet=rs0
RATE_LIMIT_STORE=memory
# REDIS_URL not required in memory mode
```

### Option B: local app + production database (review/debug mode)

Use in `.env`:

```env
MONGODB_URI=<production-mongodb-uri>
RATE_LIMIT_STORE=redis
REDIS_URL=<production-redis-uri>
COOKIE_SECURE=true
```



Sample requests can be kept in `requests.http` or Postman.

## Run, test, and build

- Dev run: `npm run start:dev`
- Run tests: `npm test`
- Coverage: `npm run test:cov`
- Build: `npm run build`
- Run built app: `npm run start`

## API documentation (Swagger)

Swagger is enabled for this backend.

- Swagger UI: `/api/docs`
- OpenAPI JSON: `/api/docs-json`

When running locally, open:
- `http://localhost:3000/api/docs`

Auth notes in Swagger:
- Bearer JWT is documented for protected endpoints (for example `GET /api/users/me`).
- Refresh flow uses an HTTP-only cookie (`refresh_token` by default), documented as cookie auth.

## Deploy checklist

1. Build artifacts:
   - `npm ci`
   - `npm run build`
2. Set environment variables in deployment platform:
   - required vars above
   - `RATE_LIMIT_STORE=redis` for multi-instance deployments
   - `COOKIE_SECURE=true` in production
3. Provide reachable infrastructure:
   - MongoDB replica set
   - Redis (if redis rate-limit store is enabled)
4. Start command:
   - `npm run start`

## Rate-limit store behavior

| Value | Use when | Needs Redis |
| ----- | -------- | ----------- |
| `memory` (default) | single instance, local development | No |
| `redis` | multi-instance / shared counters | Yes |

Notes:
- In `memory` mode, counters are per process and reset on restart.
- In `redis` mode, `REDIS_URL` is mandatory and startup fails without it.
- Failed sign-in limiter can fallback to in-memory per instance if Redis is unavailable; warnings are logged.
