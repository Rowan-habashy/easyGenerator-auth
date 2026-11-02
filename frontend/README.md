# Frontend

React + TypeScript + Vite + Tailwind frontend for auth/session flow.

## Features

- Welcome page
- Sign up / Sign in
- Protected profile page
- Session restore + refresh
- Request middleware support
- Retry with backoff for transient API failures

## Tech stack

- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Vitest (unit tests)

## Getting started

```bash
cp .env.example .env
npm install
npm run dev
```

Dev URL: `http://localhost:5173`

## Environment variables

Important variables used by the frontend:

- `VITE_API_BASE_URL` (default: `/api`)
- `VITE_BACKEND_URL` (used by Vite dev proxy)
- `VITE_DEV_PORT` (default: `5173`)
- `VITE_RETRY_MAX_ATTEMPTS`
- `VITE_RETRY_BASE_DELAY_MS`
- `VITE_REQUEST_TIMEOUT_MS`

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm test
npm run test:watch
```

## Project structure

```text
src/
	api.ts                  # thin facade used by UI/auth hooks
	contexts/auth/          # Auth context, provider, route guards
	hooks/                  # reusable hooks (use-auth, use-auth-session, use-form)
	services/               # stateful orchestration (api-client, request executor)
	lib/                    # pure helpers/utilities (retry, api helpers)
	middleware/             # request middleware contract + runner (index.ts)
	design-system/          # reusable UI kit components
	pages/                  # route pages
	routes/                 # route constants
	validation/             # limits + validators
	errors/                 # API/domain error mapping
```

## Architecture notes

- `api.ts` keeps app-facing API methods simple.
- `services/api-client.ts` manages token/session flow.
- `services/api-request-executor.ts` handles request execution details.
- `middleware/index.ts` defines middleware contracts and runner.
- `lib/` contains stateless helpers only.

This split keeps responsibilities clear without over-engineering.

## Testing

Unit tests are in `__tests__/` and currently cover:

- error message mapping
- retry/backoff logic
- middleware runner behavior
- validators

Run:

```bash
npm test
```

## Backend integration note

In local dev, Vite proxies `/api` to backend (`VITE_BACKEND_URL`) so browser and API appear under one origin. This helps cookie-based refresh/session behavior work correctly.