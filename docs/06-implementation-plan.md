# 06 — Implementation Plan

> Status: **Final for MVP.**

Vertical slices, each ending in something runnable and tested. Nothing moves on with a red CI.

## M0 — Foundations

- npm workspaces: `apps/api`, `apps/web`, `packages/contracts`, `packages/time`.
- TypeScript strict, ESLint (incl. rules banning unsafe `Date` APIs), Prettier, Husky + lint-staged.
- `docker-compose.yml`: Postgres 17, Mailpit. `.env.example`.
- Nest skeleton with three entry points (API, worker, CLI); zod config; pino; problem+json filter;
  Helmet; CORS; throttler; Swagger; health endpoints; injectable `Clock`.
- Vite React skeleton (details after frontend sign-off).
- GitHub Actions: lint → typecheck → test → build.

**Done when:** infra + API + worker + web start locally; `/api/v1/health/ready` green; CI green.

## M1 — Time package & schema

- `packages/time` on `temporal-polyfill` + full DST fixture suite (doc 04 §7).
- TypeORM data source, `SnakeNamingStrategy`, entities, hand-reviewed migrations (extensions,
  exclusion constraint, partial indexes, CHECKs); CI drift check.
- `db:seed` CLI command: 10 IST mentors with realistic windows, demo parent.

**Done when:** migrations apply to an empty DB, drift check passes, time package ≥ 90 % coverage.

## M2 — Auth & profile

- Register, login (lockout, equal timing), refresh rotation (grace + reuse detection), logout,
  forgot/reset/change password (outbox emails), `/me`, `/me/students`.
- Global stateless JWT guard (`@Public()` opt-out); rate limits.

**Done when:** e2e suite covers every auth path incl. rotation, reuse detection and session revocation on password change.

## M3 — Availability engine & slots API

- Pure slot engine + unit tests (midnight-crossing rules, time off, buffer, cap, lead, horizon, DST).
- `GET /availability/slots`, `/meta/timezones`, `/meta/booking-config`.

**Done when:** slots for seeded data match hand-computed expectations for NY / London / Kolkata.

## M4 — Booking core

- `CreateBooking` (locks, savepoints, exclusion, cap, idempotency, alternatives), `LeastLoadedStrategy`,
  list/detail, cancel, reschedule, `.ics` download, audit events, outbox writes.
- Race integration tests.

**Done when:** 50 concurrent requests never violate overlap/cap; replays return the same booking;
reschedule is atomic.

## M5 — Worker & notifications

- Outbox relay, backoff, dead letter, reaper, completion job, token cleanup.
- All templates (HTML + text) with zone-correct times; `.ics` REQUEST/CANCEL with sequence.
- Classroom: `DummyMeetingProvider`, `GET /classroom/:token`.

**Done when:** each booking lifecycle event produces the right emails in Mailpit, in the right zones.

## M6 — Ops CLI & waitlist

- All commands in doc 03 §10 incl. reassign, time off with `--reassign`, outbox retry, anonymise.
- `POST /waitlist`.

**Done when:** "mentor is sick" scenario runs end-to-end via CLI with correct emails.

## M7 — Frontend

Component tests always use MSW handlers built from `@app/contracts` fixtures; the dev server can opt in
to the same handlers with `VITE_API_MOCKS=1` while an endpoint is not merged yet (default: real API);
Playwright e2e always runs against the real API. Slices, each shippable:

0. **Design system** — tokens (both themes), motion tokens, mobile baseline, fonts, `shared/ui` components
   from doc 07 §6 with a local component gallery route (dev only).
1. **Shell** — AppShell, router with lazy routes, error boundaries, API client (`ApiError`, refresh-and-retry),
   auth store + boot refresh, TimezoneProvider/Chip/Picker, `LocalTime`, design tokens.
2. **Auth** — login, register, forgot/reset, guards, `returnTo` sanitiser, cross-tab sync, logout cache clear.
3. **Slot picker** — date strip, slot grid, day notices, next-available jump, DST notice, horizon-empty → waitlist.
4. **Booking wizard** — inline AuthPanel, child step, review with zone checks, re-validation,
   idempotency keys, conflict dialog, confirmation.
5. **My bookings** — list/detail, calendar actions, cancel, reschedule.
6. **Account & classroom** — profile, children, change password; classroom states + countdown.
7. **Landing** — hero with live Time Tray, how it works, time readout, FAQ, closing CTA (needs assets from doc 07 §10).

**Done when:** Playwright suite (doc 05 §13) green in two emulated zones; axe clean; budgets met;
doc 07 pre-flight checklist passes; real-device pass done.

## M8 — Hardening & docs

- Playwright e2e in two emulated zones; axe a11y checks.
- k6 smoke test (burst of concurrent bookings).
- Root `README.md` (quick start, demo script), ADRs, `docs/runbook.md`, multi-stage Dockerfiles.

## Definition of done (every PR)

- Lint, typecheck, tests green; new logic has tests.
- Time handling only through `@app/time`.
- Every error path returns a documented `code`.
- Migrations reviewed by hand; drift check green.
- Docs updated when behaviour or contracts change.
