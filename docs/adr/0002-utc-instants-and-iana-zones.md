# 0002 - Store UTC instants and IANA zones, never offsets

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Author
- **Related:** [04 - Time zones & DST](../04-timezones-and-dst.md), ADR 0003

## Context

- Parents are in the US and UK, mentors in India. Every time must be shown and emailed in the
  viewer's local time.
- The US and UK switch DST on different dates; India never switches. The IST to US/UK gap changes
  several times a year (e.g. 25 Oct to 1 Nov 2026, New York and London are 4 hours apart instead of 5).
- Offsets (`+05:30`) and abbreviations (`EST`, `IST`) cannot predict future rules and are ambiguous
  (`IST` is India, Israel or Irish time).

## Decision

1. Every point in time (class start/end, time off, token expiry) is stored as `timestamptz` and handled
   as a UTC instant in code.
2. Every zone is stored as an **IANA name** (`Asia/Kolkata`, `America/New_York`), validated against
   `Intl.supportedValuesOf('timeZone')`.
3. Wall-clock time is stored only where it is the user's intent: mentor weekly availability
   (`weekday`, `start_local`, `end_local` in the mentor's zone). It is converted to instants per concrete
   date, never with a cached offset.
4. The API exchanges ISO-8601 UTC instants. Conversion to local time happens at the edges: the SPA for
   display, email rendering per recipient.
5. Processes run with `TZ=UTC`; DB sessions use `timezone = 'UTC'`; CI runs the suite under both
   `TZ=UTC` and `TZ=America/New_York` to catch leaks.
6. The mentor daily cap is bucketed by the **mentor-local date** of the class start, stored as
   `mentor_local_date` on the booking.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Store local time + offset | Offset is correct only for that instant; recurring rules and "same time next week" break across DST. |
| Store everything in mentor local time (IST) | Parent display still needs conversion; breaks the moment a mentor outside India joins. |
| Store naive timestamps (`timestamp without time zone`) | Meaning depends on convention; one mis-set session zone silently corrupts data. |

## Consequences

**Positive**
- DST is handled by the IANA database, per instant, with no special cases in business code.
- Adding mentors or parents in any zone requires no schema change.

**Negative / accepted trade-offs**
- Every read path must convert for display; enforced by a single shared time package and lint rules.
- IANA data must stay current (Node/ICU and browser updates); a rule change by a government needs a runtime update.

## Revisit when

Never for the core rule. Revisit the cap bucketing (item 6) only if product redefines "a day".
