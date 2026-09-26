# 0011 - Pluggable mentor assignment, least-loaded first

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Author
- **Related:** ADR 0004, [03 - Backend design §5.2](../03-backend-design.md)

## Context

- Parents pick a time; the system assigns the mentor. Several mentors are often eligible for one slot.
- Mentors should share load fairly, and results must be reproducible in tests.
- Future needs are likely: matching by subject, language or grade; maximising total bookings when
  supply is tight.

## Decision

Define `AssignmentStrategy.rank(slot, candidates)` as a domain interface. The MVP implementation
`LeastLoadedStrategy` orders eligible mentors by:

1. fewest confirmed trials on that mentor-local date,
2. fewest trials in the trailing 7 days,
3. oldest `last_assigned_at` (round-robin),
4. mentor id (deterministic tie-break).

The booking transaction tries candidates in this order (ADR 0004).

## Alternatives considered

| Option | Why not |
|--------|---------|
| Random choice | Unfair streaks; non-deterministic tests. |
| Strict round-robin | Ignores daily load; can give one mentor both seats early while others idle. |
| Scarcity-aware optimisation now | Maximises coverage at 100 % utilisation, but needs a forward-looking model of free slots; premature before real demand data. |

## Consequences

**Positive**
- Fair, explainable, deterministic assignment.
- New strategies (scarcity-aware, skill matching) plug in without touching the booking transaction.

**Negative / accepted trade-offs**
- Least-loaded can occasionally consume the only mentor covering a scarce hour, reducing total bookings on tight days.

## Revisit when

Utilisation data shows lost bookings due to assignment choices, or product introduces subject/language/grade matching.
