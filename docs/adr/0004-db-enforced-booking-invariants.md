# 0004 - Enforce booking invariants in PostgreSQL

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Author
- **Related:** [03 - Backend design §3.4, §5.1](../03-backend-design.md)

## Context

- Supply equals demand (10 mentors x 2 = 20 seats/day, 20 parents/day), so the last free seat is
  contested often. Races are the normal case, not an edge case.
- Invariants that must never break:
  1. A mentor never has overlapping classes (including a 15-minute buffer).
  2. A mentor never exceeds `max_trials_per_day` (default 2) on a mentor-local date.
  3. A child has at most one upcoming confirmed trial.
  4. A retried request never creates a second booking.
- Application-level "check then insert" is racy under concurrent requests.

## Decision

| Invariant | Mechanism |
|-----------|-----------|
| No overlap | `EXCLUDE USING gist (mentor_id WITH =, tstzrange(starts_at, blocked_until, '[)') WITH &&) WHERE (status = 'CONFIRMED')` (`btree_gist`). |
| Daily cap | Inside the booking transaction, `SELECT ... FOR UPDATE` on the mentor row, then count confirmed bookings for that mentor-local date. Every capacity-consuming write (create, reschedule, reassign, time-off/availability changes) takes this lock. Capacity-releasing writes (cancel) do not need it. |
| One upcoming trial per child | Partial unique index on `bookings(student_id) WHERE status = 'CONFIRMED'`. |
| Idempotency | `UNIQUE (parent_id, idempotency_key)` + request fingerprint. |

Candidate mentors are tried in ranked order, each inside a `SAVEPOINT`; a skipped candidate is rolled
back to its savepoint, releasing its lock, so **at most one mentor lock is held at a time** and
mentor-lock deadlocks cannot occur. `lock_timeout = 3s`; serialization/deadlock errors retried once.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Application checks only | Racy; two requests both see capacity and both insert. |
| `SERIALIZABLE` isolation everywhere | Correct but produces retry storms under contention and makes every query pay; locks are targeted. |
| Per-day counter table with `CHECK (booked <= cap)` | Also correct, but duplicates state that must be kept in sync on cancel/reschedule and hardcodes the cap into a constraint. Kept as the documented fallback. |
| Redis distributed locks | Extra infrastructure and a second source of truth for something Postgres does natively. |
| Advisory locks | Work, but are invisible in schema, easy to forget in new code paths; row locks are self-documenting. |

## Consequences

**Positive**
- Overlap is physically impossible even if a future code path forgets the lock (defence in depth).
- Concurrency correctness is testable: parallel integration tests against real Postgres.
- Bookings for different mentors proceed in parallel; plain reads are never blocked.

**Negative / accepted trade-offs**
- Ties the design to PostgreSQL features (`btree_gist`, exclusion constraints).
- Every new capacity-consuming write path must remember the mentor lock (covered by code review and tests).

## Revisit when

Booking volume per mentor makes the row lock a measurable bottleneck (it will not at current scale), or the cap rule becomes more complex than a per-day count.
