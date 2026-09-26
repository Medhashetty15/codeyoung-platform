# 0012 - Public slot browsing, account required to book

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Author
- **Related:** ADR 0007, [01 - Requirements A-6, A-11, A-12](../01-requirements.md)

## Context

- Parents need to manage bookings (list, cancel, reschedule) and belong to a durable identity with
  children and a time zone.
- A trial funnel loses parents at every extra step; asking for an account before showing value hurts conversion.
- Guest booking with secret manage links was the earlier design; accounts were chosen instead.

## Decision

- **Browsing available times is public.** No login to see what is free.
- **Booking requires an account.** Login or sign-up happens inline on the Account step of the booking
  flow; the chosen slot is preserved in the URL and the Time Tray.
- The parent's profile time zone drives emails; booking in a different zone updates the profile after
  the parent confirms it on the review step (snapshot kept on the booking for audit).
- No email verification in the MVP.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Guest booking with manage links | No durable identity; harder to prevent duplicate trials per child; separate manage-link security model. |
| Account first, then browse | Asks for commitment before showing value; lower conversion. |
| Email verification before booking | Adds an inbox round-trip at the most fragile point of the funnel. |

## Consequences

**Positive**
- Parents see value first; one identity for bookings, children and zone; simple ownership checks.

**Negative / accepted trade-offs**
- An extra step before confirming compared with guest checkout.
- Unverified emails can be mistyped.

## Revisit when

Funnel data shows significant drop-off at the Account step (consider guest checkout with account creation after booking), or abuse requires email verification.
