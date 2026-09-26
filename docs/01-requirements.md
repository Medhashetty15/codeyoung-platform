# 01 — Requirements, Assumptions & Edge Cases

> Status: **Final for MVP.** Frontend specifics in docs 05 and 07.

## 1. Problem restated

Parents book a free **trial class** for their child. The parent picks a time that suits them, the
system assigns an available mentor, and both parties get an email with a link to the live class.

Given constraints:

| # | Constraint | What it really means for the system |
|---|------------|-------------------------------------|
| C1 | 10 mentors, ~20 parents/day | Small scale, but correctness under concurrency still matters: the last free slot is exactly where races happen. |
| C2 | Parents in US/UK, mentors in India | Every time shown or emailed must be rendered in the **viewer's** time zone. The server stores only absolute instants. |
| C3 | Handle DST | US and UK change clocks on **different dates**; India does not change at all. The IST↔US/UK offset changes several times a year. No fixed offsets anywhere. |
| C4 | Dummy class link | Pluggable `MeetingProvider`; v1 generates a unique link to our own "demo classroom" page. |
| C5 | Mentor max 2 trials/day | A hard invariant. Must hold under concurrent bookings, so it is enforced in the database transaction, not only in application code. |
| C6 | No mentor available | Must be a designed, first-class state, not an exception message. |

## 2. Capacity analysis (why C6 is the common path, not an edge case)

- Max supply: 10 mentors × 2 trials = **20 trials/day**.
- Demand: **20 parents/day**.

The system runs at a theoretical **100 % utilisation**. In practice demand clusters in parent-friendly
hours (US after-school, UK evenings, weekends) while mentor windows are fixed in IST, so many
parents *will* hit a fully booked slot or day. Consequences for the design:

1. Slot listing must expose "fully booked" days and the **next available** slot.
2. A booking can lose a race for the last mentor → `409 NO_MENTOR_AVAILABLE` **with alternatives**.
3. When the whole horizon is full, capture demand on a **waitlist** instead of a dead end.
4. Cancellations free capacity immediately; reminders reduce no-shows (a no-show wastes 1 of 20 daily seats).
5. Mentor assignment balances load and is pluggable so it can later optimise for coverage.

## 3. MVP scope

**In scope (MVP)** — the parent product, end to end, plus the operational tooling needed to run it:

- Parent accounts (email + password, JWT access/refresh, forgot/reset password).
- Children (students) under a parent account.
- Browse available slots in local time (public, no login needed to look).
- Book a trial (login required), automatic mentor assignment.
- Confirmation, cancellation, reschedule and reminder emails to parent **and** mentor, each in their own zone, with `.ics`.
- My bookings: list, detail, cancel, reschedule, calendar download.
- Demo classroom page behind the join link (parent and mentor each get a personal link).
- Waitlist when no slots exist in the horizon.
- **Ops CLI** (no UI): manage mentors, availability, time off, reassign a booking, inspect/retry failed emails.

**Out of scope (MVP)** — deferred, design leaves room for them:

Mentor portal, admin UI, email verification, "log out of all devices", social login/MFA, payments, real video, SMS/WhatsApp,
i18n, skill/language/grade matching, recurring paid classes, account self-deletion (handled manually
by ops on request; see §7), CAPTCHA.

## 4. Actors

| Actor | Access | Main goals |
|-------|--------|------------|
| Parent | Account (role `PARENT`) | Find a slot in local time, book, manage bookings, join class. |
| Mentor | No account in MVP. Receives emails + personal join link. | Know when/where to teach, in IST. |
| Ops | Server CLI (`npm run cli -- …`) | Onboard mentors, maintain availability/time off, reassign classes, handle failed emails. |
| System worker | n/a | Deliver emails reliably, send reminders, mark past classes completed. |

## 5. Functional requirements

### Accounts & auth
| ID | Requirement |
|----|-------------|
| FR-A1 | Parent registers with full name, email, password, optional phone and time zone (pre-filled from browser). |
| FR-A2 | Parent logs in with email + password; receives a short-lived JWT access token and a rotating refresh token. |
| FR-A3 | Sessions refresh silently; refresh-token reuse is detected and kills the session. |
| FR-A4 | Parent can log out (revokes the current session). |
| FR-A5 | Forgot password emails a single-use, time-limited reset link; resetting revokes all sessions. |
| FR-A6 | Logged-in parent can change password (other sessions revoked) and update name, phone, time zone. |

### Children
| ID | Requirement |
|----|-------------|
| FR-C1 | Parent can add and edit children (first name, age 4–18). A child can also be created inline while booking. |

### Availability & booking
| ID | Requirement |
|----|-------------|
| FR-B1 | Anyone can list bookable slots for the next 14 days, grouped by **their local date**, with day status (available / fully booked / no classes), next available slot and DST transitions. |
| FR-B2 | Logged-in parent books a slot for a child; the system **auto-assigns** a mentor. Parent never picks the mentor. |
| FR-B3 | A mentor never has overlapping classes (incl. buffer) and never more than `max_trials_per_day` (default 2) per **mentor-local calendar day**. |
| FR-B4 | No mentor available → `409` with nearest alternatives; empty horizon → waitlist. |
| FR-B5 | A child has at most one upcoming confirmed trial. |
| FR-B6 | Booking creation is idempotent per `Idempotency-Key`. |
| FR-B7 | Parent lists upcoming/past bookings and views a booking in their zone. |
| FR-B8 | Parent cancels a booking any time before start; capacity is freed immediately. |
| FR-B9 | Parent reschedules until 2 h before start; atomic (old booking kept if new slot fails). New slot may get a different mentor. |
| FR-B10 | Parent downloads an `.ics` for any upcoming booking. |

### Notifications
| ID | Requirement |
|----|-------------|
| FR-N1 | On confirm / cancel / reschedule, parent and mentor get an email in **their own** zone (abbreviation + UTC offset + city), with the join link and an `.ics` (cancel uses `METHOD:CANCEL`). |
| FR-N2 | Reminders 24 h and 1 h before start to both; skipped if booking no longer confirmed. |
| FR-N3 | Password-reset emails. |
| FR-N4 | Delivery is at-least-once with retries; a given email for a given booking is never sent twice after success. |

### Classroom
| ID | Requirement |
|----|-------------|
| FR-R1 | Personal join link per participant opens a demo classroom page (role, class time in viewer's zone, countdown, live/ended state). No login needed — the token is the credential. |

### Waitlist
| ID | Requirement |
|----|-------------|
| FR-W1 | Anyone can join the waitlist with name, email, zone and preferred times (deduplicated per email while open). |

### Operations (CLI)
| ID | Requirement |
|----|-------------|
| FR-O1 | Seed demo data (10 IST mentors with realistic windows). |
| FR-O2 | Add / update / deactivate a mentor; set weekly availability from a JSON file; add/remove time off. |
| FR-O3 | Adding time off or deactivating a mentor that conflicts with bookings is rejected unless `--reassign` is given, which reassigns each affected booking to another mentor (or reports those that could not be reassigned). |
| FR-O4 | Reassign a single booking by reference; parent and both mentors are emailed. |
| FR-O5 | List dead-lettered emails and retry them. |
| FR-O6 | List bookings for a date range (for daily ops checks). |

## 6. Non-functional requirements

| Area | Requirement |
|------|-------------|
| Correctness | Double-booking and cap violations impossible under concurrency (DB constraints + row locks), proven by parallel integration tests. |
| Time | All instants `timestamptz` (UTC); zones are IANA names; processes and DB sessions run in UTC; test suite also runs under `TZ=America/New_York`. |
| Security | argon2id password hashing; short-lived access JWT; opaque, hashed, rotating refresh tokens with reuse detection; httpOnly refresh cookie; rate limiting + login lockout; no user enumeration on login/forgot; ownership checks on every booking route (404 for others' resources); Helmet; strict CORS; validated input everywhere; secrets only from env. |
| Privacy | Minimal PII (parent name/email/phone, child first name + age). Mentor sees parent first name, child first name + age, parent's city/zone. Emails masked in logs. |
| Reliability | Transactional outbox; worker retries with exponential backoff; dead-letter state; stuck-job reaper; multiple worker replicas safe. |
| Observability | Structured JSON logs with request IDs; health/readiness; append-only `booking_events` audit trail. |
| Performance | Slot listing p95 < 300 ms; booking p95 < 500 ms. Design tolerates 100× load without architecture change. |
| Operability | `docker compose up` for infra; one command each for migrate, seed, run; ops CLI for day-to-day tasks; runbook. |
| Maintainability | Strict TS, lint rules banning unsafe date APIs, ≥ 90 % coverage on domain + time packages, documented error codes, OpenAPI docs. |

## 7. Assumptions

| ID | Assumption | Rationale |
|----|------------|-----------|
| A-1 | The daily cap counts classes by the **mentor-local calendar date of the class start**. | The cap protects mentor workload. |
| A-2 | Trial duration **60 min** (config). | Single product. |
| A-3 | Slot grid **30 min, aligned in UTC**. | Clean local times for IST (+5:30) and whole-hour US/UK zones. |
| A-4 | **15 min buffer** after each mentor class (config). | Changeover time. |
| A-5 | Lead time **4 h**, horizon **14 days** (config). | Prep time; bounded queries. |
| A-6 | Browsing slots is public; booking requires an account. | Let parents see value before signing up. |
| A-7 | One **upcoming** confirmed trial per child; a child may book again after a trial is completed/cancelled/no-show. | Prevents hoarding at 100 % utilisation without blocking legit re-trials. |
| A-8 | Mentors are interchangeable for trials. | Not in the brief; strategy is pluggable. |
| A-9 | Mentor first name is revealed after booking. | Parent picks time, not mentor. |
| A-10 | Mentor availability = weekly recurring windows in mentor's zone + time-off ranges. | Mirrors how mentors plan. |
| A-11 | Emails to a parent use the parent's **current profile zone**; the zone at booking time is snapshotted on the booking for audit. Booking with a different zone than the profile updates the profile (parent confirmed it on the review step). | If a family moves or corrects their zone, reminders follow. |
| A-12 | No email verification in MVP. Typos are mitigated by showing all booking details on screen and the "My bookings" page. | Lower funnel friction; add later. |
| A-13 | Registering with an existing email returns a conflict (not silent). | Standard UX trade-off; login and forgot-password do not leak existence. |
| A-14 | Account deletion is an ops task on request in MVP (anonymise parent + children, keep booking rows for mentor history). | Legal requirement handled manually until self-serve exists. |
| A-15 | Completed status is set automatically 1 h after class end (no mentor portal). No-show tracking deferred. | Keeps state accurate without mentor tooling. |

## 8. Edge-case catalogue

| # | Scenario | Handling |
|---|----------|----------|
| E-1 | Two parents submit the same last free slot concurrently | Per-mentor row lock + exclusion constraint → exactly one wins; loser gets `409 NO_MENTOR_AVAILABLE` + 3 nearest alternatives. |
| E-2 | Double-click / network retry on booking | Same `Idempotency-Key` → same booking returned. Same key with different payload → `422`. |
| E-3 | Mentor already has 2 classes that IST day | Excluded from all remaining slots that IST day. |
| E-4 | Slot is Saturday for the parent, Sunday for the mentor | Display grouping uses parent zone; cap uses mentor zone; both from the same UTC instant. |
| E-5 | US/UK DST mismatch weeks (25 Oct – 1 Nov 2026, 8 – 29 Mar 2026) | Offsets resolved per instant from IANA data; tests pin these dates. |
| E-6 | Gap / overlap local times in a DST-observing zone | Explicit disambiguation policy (doc 04). |
| E-7 | Browser zone differs from profile zone | Review step shows both and asks; chosen zone saved to profile. |
| E-8 | Invalid zone string | `400 INVALID_TIMEZONE`. |
| E-9 | Slot off-grid / in past / beyond horizon | `400` / `422` codes; server clock authoritative. |
| E-10 | Ops adds time off over an existing booking | Rejected unless `--reassign`; reassignment emails parent + both mentors. |
| E-11 | Mentor deactivated with future bookings | Same as E-10. |
| E-12 | Parent cancels | `CANCELLED`, capacity freed, both emailed (`.ics` cancel), reminders skipped. |
| E-13 | Reschedule to a full slot | Transaction rolls back; old booking intact; `409` + alternatives. |
| E-14 | SMTP down | Outbox retries with backoff; `DEAD` after max attempts; booking unaffected; ops CLI retry. |
| E-15 | Child already has an upcoming trial | `409 STUDENT_ALREADY_HAS_TRIAL` with the existing booking id. |
| E-16 | Whole horizon full | `nextAvailable = null` → client shows waitlist. |
| E-17 | Reminder due for cancelled/rescheduled booking | Worker re-checks status at send time and skips. |
| E-18 | Two browser tabs refresh the access token at the same moment | Refresh-token rotation has a short grace window (20 s) so a concurrent refresh with the just-rotated token doesn't trigger reuse detection. Reuse outside the window revokes the session. |
| E-19 | Stolen refresh token used after the real client rotated it | Reuse detected → whole session revoked → both parties must log in again. |
| E-20 | Brute-force login | Per-IP and per-email rate limits; account locked for 15 min after 10 failures in 15 min (`429` + `Retry-After`); same response for wrong email and wrong password; dummy hash for unknown emails keeps timing equal. The lock answer itself shows that the email has an account; accepted, since registration already reveals existence (A-13) and the per-email limit makes probing slow. |
| E-21 | Forgot password for unknown email | Always `202`, no email sent. |
| E-22 | Reset link used twice or expired | `400 RESET_TOKEN_INVALID`; tokens single-use, 30 min TTL; new request invalidates older tokens. |
| E-23 | Parent accesses another parent's booking id | `404 BOOKING_NOT_FOUND` (no existence leak). |
| E-24 | Password change / reset while other sessions are active | Other sessions' refresh tokens revoked at once; their already-issued access tokens (stateless) expire within ≤ 15 min. |
| E-25 | Mentor becomes unavailable on the day (sick) | Ops `booking:reassign <ref>` (or `mentor:time-off:add <email> --from --to --reassign` for the whole day); if no mentor free, CLI reports it and ops cancels with a reason → parent emailed with apology + rebook link. |
