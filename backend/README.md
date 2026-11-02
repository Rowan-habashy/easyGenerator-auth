# Backend (NestJS + MongoDB)

Implements the design in `../docs/architecture`.

## Setup
1. `cp .env.example .env` and set `JWT_SECRET`.
2. Start MongoDB as a **replica set** (transactions require it), e.g.
   `mongod --replSet rs0` then `rs.initiate()` in `mongosh`.
3. Redis is optional. The default `RATE_LIMIT_STORE=memory` needs no Redis (see [Rate limit store](#rate-limit-store)).
4. For local HTTP development set `COOKIE_SECURE=false`.
4. `npm install && npm run start:dev`

## Configuration
All tunable values (TTLs, limits, cookie settings, JWT, bcrypt cost, Redis/Mongo URLs) are read from environment variables in one place: `src/config/app-config.ts`. Required: `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_ORIGIN`. `REDIS_URL` is required only when `RATE_LIMIT_STORE=redis`. Everything else has a documented default; see `.env.example` for the full list.
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
- Rate limits (general per-IP and failed sign-in) use the store chosen by `RATE_LIMIT_STORE` (below). Failed sign-ins are limited per IP (5) and per email (10) per 15 minutes. With the Redis store, if Redis is down the failed sign-in limiter falls back to a per-instance in-memory counter and the general throttler fails open, with a warning logged.
- TTL indexes purge sessions and refresh tokens 7 days after they expire.

## Rate limit store

Rate-limit counters (general per-IP limit and failed sign-in limits) are kept in one of two stores, chosen with `RATE_LIMIT_STORE`.

| Value | Use when | Needs Redis |
| ----- | -------- | ----------- |
| `memory` (default) | Local development, a single instance. Free, nothing to run. | No |
| `redis` | Several instances behind a load balancer, so they share one set of counters. | Yes |

Single instance (default):

```env
RATE_LIMIT_STORE=memory
```

Multi-instance deployment:

```env
RATE_LIMIT_STORE=redis
REDIS_URL=redis://your-redis-host:6379
```

Notes:

- With `memory`, counters live in each process, reset on restart, and are not shared. Two instances each allow their own limit, so the effective limit is the limit times the number of instances. Use `redis` before running more than one instance.
- With `memory`, no Redis connection is opened and `REDIS_URL` is ignored.
- With `redis`, `REDIS_URL` is required and the app fails at startup without it. An invalid `RATE_LIMIT_STORE` value also fails at startup.
- Redis can be self-hosted (`docker run -p 6379:6379 redis`) or a managed service. A free option is not needed unless you run multiple instances.
