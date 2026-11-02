# Frontend

React + TypeScript + Vite + Tailwind. Pages: Welcome, Log in, Sign up, Profile.

```bash
cp .env.example .env
npm install
npm run dev     # http://localhost:5173
npm run build
```

The dev server proxies `/api` to the backend (`VITE_BACKEND_URL`), so the browser sees one origin and the SameSite=Strict refresh cookie works. Backend `.env`: `FRONTEND_ORIGIN=http://localhost:5173`, `COOKIE_SECURE=false`.

## Structure

- `src/api.ts`: base URL, in-memory access token, `request()`, single-flight refresh, backoff.
- `src/errors.ts`: `HTTP_STATUS`, `ERROR_CODE`, `ERROR_MESSAGES`, `ApiError`, `getErrorMessage`.
- `src/validation.ts`: form limits, same as the backend DTOs.
- `src/components/ui.tsx`: shared UI components.
- `src/pages/`: one file per page. Login and Sign up use `react-hook-form`.
- `src/App.tsx`: session restore, logout, routes.

## C3 behaviour

- Startup: `POST /api/auth/refresh`, then `GET /api/users/me`. Any failure goes to sign in.
- 401 `ACCESS_TOKEN_INVALID` on a protected call: refresh once, repeat once. A second 401 is not refreshed again. If the refresh fails, the session ends.
- Refresh 401, 409, 503 `REFRESH_OUTCOME_UNKNOWN`, network or timeout: never resent.
- 429 and 503 `SERVICE_UNAVAILABLE` on refresh and protected calls: session kept, retried with backoff and a limit. Sign in and sign up show the error immediately.
- Logout always clears local state, even on 503.
