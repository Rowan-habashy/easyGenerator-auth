# AI Usage Report

This file documents how AI assistance was used for this task, what worked, and what was revised manually.

## Where AI was used

- **Scaffolding and structure**
  - Initial organization of frontend/backend modules and docs.
  - README setup guidance for local development (Mongo replica set, backend/frontend run flow).

- **Frontend auth module**
  - Sign up/sign in page structure, route guards, auth session orchestration.
  - Form validation helper layout and unit test scaffolding.

- **Backend auth module**
  - NestJS controller/service flow review, DTO validation improvements, protected endpoint checks.
  - Swagger/OpenAPI annotation verification.

- **Testing and hardening**
  - Unit test additions and updates for middleware/validators/api-client behavior.
  - Regression tests around auth refresh/guard behavior.

## Prompts/approaches that were effective

- Asking AI to **map requirements into an explicit checklist** before edits.
- Asking AI to **compare current implementation vs task brief** and output pass/fail gaps.
- Requesting **small, focused patches** per concern (validation, guard behavior, docs), then validating with tests.
- Using AI for **test-first or test-updated changes**, especially for validator contracts.

## What required correction/rework

- **Welcome refresh UX behavior**
  - Several approaches were explored (blank while loading, spinner, optimistic state). The final approach was aligned back to architecture constraints (C3/API-driven startup restore).

- **Validation parity with brief**
  - Password complexity and name minimum initially did not exactly match the task statement; these were tightened manually in both frontend and backend.

- **Route-guard tests under SSR/static markup**
  - Redirect assertion strategy had to be adjusted because `Navigate` renders empty markup in server rendering tests.

- **Repository hygiene**
  - Local runtime artifacts and DB data paths were documented and ignored appropriately to avoid accidental commits.

## Final judgement and ownership

AI was used as a force multiplier for speed, but all generated code and docs were reviewed and adjusted to match:

- the explicit task requirements,
- architecture constraints in project docs,
- and practical runtime behavior observed during local tests.

All final decisions (especially auth-flow behavior and validation strictness) were human-reviewed and intentionally chosen.
