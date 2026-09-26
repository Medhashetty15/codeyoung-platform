# 04 — Time Zones & Daylight Saving Time

This is the part of the brief most likely to cause subtle bugs, so the rules are explicit.

## 1. Golden rules

1. **Store instants, not wall-clock times.** Every class time is a `timestamptz` (UTC instant).
2. **Store zones as IANA names**, never as offsets or abbreviations. `+05:30` or `EST` cannot tell
   you what happens next March; `America/New_York` can.
3. **Wall-clock time is only stored where it is the user's intent**: mentor weekly availability
   (`19:00–23:00` every Monday *in Asia/Kolkata*). It is converted to instants per concrete date,
   never with a cached offset.
4. **Convert at the edges.** API returns ISO-8601 UTC instants; the client formats them for the
   viewer's zone; emails are rendered per recipient zone.
5. **One library, one wrapper.** All zone math goes through `packages/time` (Temporal API). No
   `new Date('2026-10-24 17:00')`, no `getTimezoneOffset()`, no manual `+ 5.5 * 3600 * 1000`.
   Enforced by an ESLint `no-restricted-syntax` rule.
6. **Processes and DB sessions run in UTC** (`TZ=UTC`, `timezone = 'UTC'`), and CI also runs the
   suite under `TZ=America/New_York` to catch leaks.

## 2. Why DST matters here (2026 calendar)

India (IST, UTC+5:30) has no DST. The US and UK both do, on **different dates**:

| Zone | DST starts | DST ends |
|------|-----------|----------|
| `America/New_York` (and other US zones) | Sun 8 Mar 2026, 02:00 → 03:00 | Sun 1 Nov 2026, 02:00 → 01:00 |
| `Europe/London` | Sun 29 Mar 2026, 01:00 → 02:00 | Sun 25 Oct 2026, 02:00 → 01:00 |
| `Asia/Kolkata` | — | — |

So the gap between a mentor and a parent is not constant:

| Period (2026) | New York ↔ IST | London ↔ IST | New York ↔ London |
|---------------|----------------|--------------|-------------------|
| 1 Jan – 7 Mar | 10 h 30 | 5 h 30 | 5 h |
| 8 Mar – 28 Mar | **9 h 30** | 5 h 30 | **4 h** |
| 29 Mar – 24 Oct | 9 h 30 | 4 h 30 | 5 h |
| 25 Oct – 31 Oct | 9 h 30 | **5 h 30** | **4 h** |
| 1 Nov – 31 Dec | 10 h 30 | 5 h 30 | 5 h |

### Worked example

Mentor Priya (Asia/Kolkata) is available **every Sunday 01:30–05:30 IST**.
Her 01:30 IST Sunday slot appears to parents as:

| Sunday (IST) | UTC | New York sees | London sees |
|--------------|-----|---------------|-------------|
| 18 Oct 2026 | Sat 20:00 | **Sat 4:00 PM EDT** | Sat 9:00 PM BST |
| 25 Oct 2026 | Sat 20:00 | Sat 4:00 PM EDT | **Sat 9:00 PM BST** *(London switches the next morning)* |
| 1 Nov 2026  | Sat 20:00 | Sat 4:00 PM EDT *(NY switches Sunday 06:00 UTC)* | **Sat 8:00 PM GMT** |
| 8 Nov 2026  | Sat 20:00 | **Sat 3:00 PM EST** | Sat 8:00 PM GMT |

Same mentor wall-clock time, different parent wall-clock times. Anything that caches an offset
per zone, or computes "tomorrow at the same time" by adding 24 h, gets these weeks wrong.

## 3. Disambiguation policy (for zones that observe DST)

Mentors are in IST today, but the system must not assume that (future mentors, parents' zones,
and the "same local time next week" logic). Rules for converting a local wall time to an instant:

| Situation | Example | Policy |
|-----------|---------|--------|
| **Gap** (time doesn't exist) | London, 29 Mar 2026, 01:30 | Availability window start: move **forward** to the first valid instant (02:00 BST). Window end in a gap: clip to the gap start. A window entirely inside the gap produces nothing. |
| **Overlap** (time occurs twice) | London, 25 Oct 2026, 01:30 | Window start → **earlier** occurrence (BST); window end → **later** occurrence (GMT). The window covers the full wall-clock span the mentor meant; its real duration can be 1 h longer. |
| Slot generation | — | Always done on the **UTC grid** from real instants, so a slot can never land in a gap or be counted twice. |
| Parent-entered times | — | Parents never type times; they pick instants from the list. No ambiguity possible. |

Temporal makes this explicit: `PlainDateTime#toZonedDateTime(zone, { disambiguation })` with
`'earlier' | 'later' | 'reject'` — `'reject'` throws for both gaps and overlaps, which lets us detect
them and apply the policy deliberately. That's the main reason for choosing Temporal over libraries
with implicit behaviour.

## 4. "Day" semantics

| Question | Whose day? |
|----------|------------|
| Which date tab does a slot appear under in the picker? | Parent's zone. |
| Which "day" counts toward the 2-per-day cap? | Mentor's zone (`mentor_local_date`, A-1). |
| "Today"/"Tomorrow" labels in emails and UI | Recipient's zone. |
| Ops CLI booking lists | Mentor's zone (IST) with the parent's local time alongside. |

A slot at `2026-10-24T20:00Z` is Saturday in New York, Saturday in London and **Sunday** in India.
The UI groups it under Saturday for the parent; the cap counts it on Sunday for the mentor.

## 5. Communicating time to humans

- Always show zone context next to times: **"5:00 PM BST (UTC+1) · London time"**.
  Abbreviations alone are ambiguous (IST = India/Israel/Irish), so we pair them with the offset
  and a city name.
- The picker header says **"Times shown in London time (GMT+1) · Change"**.
- If a DST transition falls inside the visible date range, show a notice:
  *"Clocks in London go back 1 hour on Sun 25 Oct. Times after that are already adjusted."*
- If the parent's chosen zone differs from the browser zone, show a warning on the review step.
- Emails include an `.ics` invite (UTC `DTSTART`) so the calendar app does its own conversion, plus
  a "view in your time zone" link to the manage page.
- Mentor emails also state the parent's zone ("Parent is in Europe/London") for context.

## 6. `packages/time` API (sketch)

```ts
export type IanaZone = string & { __brand: 'IanaZone' };

isValidZone(zone: string): zone is IanaZone
toInstant(iso: string): Temporal.Instant
localDateOf(instant, zone): Temporal.PlainDate
wallWindowToInstants(date: PlainDate, start: PlainTime, end: PlainTime, zone): [Instant, Instant] | null
                                                  // applies gap/overlap policy, handles end < start
startOfLocalDay(date, zone): Instant                // not always 00:00 (some zones skip midnight)
dstTransitionsBetween(from: Instant, to: Instant, zone): Transition[]
formatForHumans(instant, zone, locale): { date, time, abbr, offset, city }
```

## 7. Test fixtures (must pass)

- Rule expansion across US spring-forward (8 Mar 2026) and fall-back (1 Nov 2026).
- Rule expansion across UK transitions (29 Mar, 25 Oct 2026).
- The 25 Oct – 31 Oct 2026 "mismatch week": same IST slot renders at correct times in NY and London.
- DST-observing mentor zone: window in a gap, window spanning an overlap, window crossing midnight.
- Cap bucketing: a class Saturday evening US time counts on Sunday IST.
- `startOfLocalDay` for a zone whose DST transition happens at midnight (e.g. `America/Santiago`).
- Full suite green under `TZ=UTC` **and** `TZ=America/New_York`.
- Playwright: booking flow with browser `timezoneId` = `America/Los_Angeles` and `Europe/London`
  shows the expected labels and the email (Mailpit API) contains matching times.
