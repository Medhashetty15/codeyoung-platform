# Codeyoung Trial Booking — Design Docs

| Doc | Contents | Status |
|-----|----------|--------|
| [01 — Requirements](01-requirements.md) | Brief, capacity analysis, MVP scope, FR/NFR, assumptions, edge cases | Final |
| [02 — Architecture](02-architecture.md) | Modular monolith (API / worker / CLI), layout, stack, flows | Final |
| [03 — Backend design](03-backend-design.md) | TypeORM rules, schema & invariants, slot engine, booking algorithm, auth, notifications, API, CLI | Final |
| [04 — Time zones & DST](04-timezones-and-dst.md) | Rules, 2026 DST calendar, disambiguation, "whose day", fixtures | Final |
| [05 — Frontend design](05-frontend-design.md) | Landing, booking flow & error states, screens, session handling, time-zone UX, SPA architecture, testing | Final |
| [06 — Implementation plan](06-implementation-plan.md) | Milestones M0–M8, definition of done | Final |
| [07 — Design system](07-design-system.md) | Design read, colour, type, shape, components, motion inventory, mobile baseline, copy rules, QA | Final |
| [Runbook](runbook.md) | Running the product: processes, Docker stack, deploys, ops CLI situations (sick mentor, emails, deletion requests), secrets, backups | Final |
| [ADRs](adr/README.md) | 15 architecture decision records (context, decision, alternatives, consequences, revisit triggers) | Accepted |

## Decisions

| # | Decision | Outcome |
|---|----------|---------|
| D1 | ORM | TypeORM (hand-reviewed migrations, explicit transactions, raw SQL for locking) |
| D2 | MVP scope | Parent product only: accounts, booking, my bookings, cancel/reschedule, reminders, classroom page, waitlist. Ops via CLI. No mentor/admin UI. |
| D3 | Auth | Email + password (argon2id), 15-min JWT access token, 7-day opaque rotating refresh token (httpOnly cookie) with reuse detection; forgot/reset/change password; stateless access tokens. No email verification or "log out all devices" in MVP. |
| D4 | Background jobs | Postgres transactional outbox + separate worker process |
| D5 | Product knobs | 60-min class, 30-min UTC grid, 15-min buffer, 4 h lead, 14-day horizon, reschedule until 2 h before |
| D6 | Time library | Temporal API via `temporal-polyfill` |
| D7 | UI kit | Tailwind v4 tokens + Base UI primitives + cva; Sonner, Phosphor, NumberFlow, zustand; CSS-only motion (no Motion lib in MVP) |
| D8 | Test runner | Vitest everywhere (+ Testcontainers, Supertest, Playwright) |
| D9 | Monorepo | npm workspaces |
| D10 | Visual language | Calm / exact / warm. Zinc neutrals + single Forest accent, Figtree + JetBrains Mono, light + dark themes (doc 07) |
