# 0008 - Ops CLI instead of an admin UI for the MVP

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Author
- **Related:** ADR 0001, [03 - Backend design §10](../03-backend-design.md)

## Context

- The MVP scope is the parent product only; no mentor portal, no admin UI.
- A real product still needs operations: onboard mentors, set availability, add time off, reassign a
  class when a mentor is sick, retry failed emails, follow up the waitlist, handle deletion requests.
- Operator volume is low and operators are internal and technical.

## Decision

Provide an **ops CLI** (`nest-commander`, entry `cli.ts`) that reuses the same application services and
invariants as the API. Commands include `db:seed`, `mentor:add|update|list`, `mentor:availability:set`,
`mentor:time-off:add|remove` (with `--reassign`), `booking:list|reassign|cancel`, `outbox:list|retry`,
`waitlist:list|mark`, `user:anonymise`. Writes print a dry-run summary and ask for confirmation
(`--yes` for scripts). Actions are audited in `booking_events` as `ops:<os-user>`.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Admin UI | Significant frontend + auth-role scope for a handful of weekly operations. |
| Admin REST API only (Swagger) | Needs admin accounts and roles now; CLI access is already restricted to people with server access. |
| Direct SQL by ops | Bypasses invariants (locks, reassignment emails, audit); error-prone. |

## Consequences

**Positive**
- Operations go through the same domain services, so invariants, emails and audit trail apply.
- Zero additional attack surface on the public API.

**Negative / accepted trade-offs**
- Only people with server/container access can operate; no self-serve for non-technical staff.

## Revisit when

Non-technical staff need to operate the system, or operation frequency grows beyond a few per day; then build an admin API + UI on the same services.
