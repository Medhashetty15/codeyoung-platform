# 0005 - Transactional outbox + worker instead of Redis/BullMQ

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Author
- **Related:** ADR 0001, [03 - Backend design §7](../03-backend-design.md)

## Context

- Every booking lifecycle event (confirm, cancel, reschedule, reassign) must email both parent and mentor.
  Reminders fire 24 h and 1 h before class. Password resets send emails.
- Sending email inside the HTTP request couples latency and success to the mail provider.
- Enqueueing to an external queue after commit risks losing the message if the process dies between
  commit and enqueue; enqueueing before commit risks emails for bookings that rolled back.

## Decision

- Write an `outbox_messages` row **in the same transaction** as the business change.
- A separate **worker process** polls due rows (`run_after <= now()`) with
  `FOR UPDATE SKIP LOCKED`, marks them `PROCESSING`, handles them, then `DONE`.
- Failures back off exponentially (`min(2^attempts, 60)` minutes); after 8 attempts the row becomes
  `DEAD` and is visible to ops via CLI. A reaper resets rows stuck in `PROCESSING` > 5 minutes.
- Per-recipient deliveries are recorded in `email_deliveries` with a unique
  `(outbox_message_id, template, recipient_email)` so retries never resend a successful email.
- Reminders are outbox rows scheduled in the future; the worker re-checks booking state before sending.
- Secrets in payloads (password-reset token) are scrubbed once the message is `DONE`.

## Alternatives considered

| Option | Why not |
|--------|---------|
| BullMQ + Redis | Extra infrastructure; enqueue is not atomic with the Postgres transaction without an outbox anyway. |
| pg-boss | Good Postgres queue, but transactional enqueue needs its executor wired into our transaction; our needs fit one table. |
| Send email synchronously in the request | Provider outage fails bookings; slow SMTP slows the API; no retries. |
| Cloud queue (SQS) | Same atomicity problem; vendor coupling for local dev. |

## Consequences

**Positive**
- A booking and its notifications are atomic: no lost emails, no emails for rolled-back bookings.
- No Redis; one database to back up and operate. Multiple worker replicas are safe.
- Scheduled reminders reuse the same mechanism.

**Negative / accepted trade-offs**
- Polling adds small latency (~2 s) and constant light DB load.
- Delivery is at-least-once: a crash between SMTP accept and recording can send one duplicate email.
- We own retry/backoff/dead-letter code instead of a library.

## Revisit when

Message volume or fan-out grows to where polling load matters, other services need to consume events
(then relay the outbox to a broker), or we need features such as rate-limited queues per provider.
