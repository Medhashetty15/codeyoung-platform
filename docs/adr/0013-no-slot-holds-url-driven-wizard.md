# 0013 - No slot holds; URL-driven wizard with conflict alternatives

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Author
- **Related:** ADR 0004, [05 - Frontend design §5](../05-frontend-design.md)

## Context

- Between choosing a time and confirming, another parent can take the last mentor for that time.
- Holding (reserving) a slot during checkout prevents that, but at 100 % utilisation abandoned holds
  would block real parents, and holds need expiry jobs and extra state.
- Parents refresh, go back, and share links; wizard state must survive that.

## Decision

- **No holds.** The booking is decided atomically at `POST /bookings`.
- The wizard state (zone, date, slot) lives in **URL search params**; the idempotency key per
  (slot, child) selection lives in `sessionStorage`.
- The Confirm step **re-validates the slot on mount**; if it is gone, alternatives are shown before the parent submits.
- A lost race returns `409 NO_MENTOR_AVAILABLE` with the three nearest free times; the UI offers them in one tap.
- Slot lists refresh on focus and every 60 s; a vanished selection is cleared with a notice.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Soft hold with TTL (e.g. 5 minutes) | Abandoned carts block capacity when supply equals demand; extra table, expiry job and edge cases (hold expires mid-form). |
| Hold only during the final confirm screen | Still needs hold state; the re-validate + alternatives path covers the same risk. |
| Wizard state in React state/local storage | Breaks refresh, back button and shareable links. |

## Consequences

**Positive**
- No capacity locked by people who never finish; simpler backend.
- Refresh-safe, shareable, back-button friendly flow.

**Negative / accepted trade-offs**
- A parent can occasionally lose a time at the last step; mitigated by pre-submit re-validation and one-tap alternatives.

## Revisit when

Data shows frequent last-step conflicts (then add short holds at the Confirm step only).
