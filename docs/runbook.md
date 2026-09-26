# Runbook: operating the trial booking system

> For whoever runs the product day to day. Design background: [02 Architecture](02-architecture.md),
> [03 Backend design](03-backend-design.md) (§7 worker, §10 CLI, §11 configuration).

## 1. What runs

| Process | Command (in the `api` image) | Scale | Health |
|---------|------------------------------|-------|--------|
| API | `node apps/api/dist/main.js` | **One instance** while rate limits use in-memory storage (docs/03 §6.5) | `GET /api/v1/health/live` (process), `/health/ready` (database) |
| Worker | `node apps/api/dist/worker.js` | Any number; outbox claims use `SKIP LOCKED` | Logs `Jobs scheduled`, then one line per email |
| Ops CLI | `node apps/api/dist/cli.js <command>` | One-off | Exit code 0, or 1 with a message |
| Web | `web` image (Caddy): static app, `/api/*` proxied to the API | Any number | `GET /` returns the app |

PostgreSQL 17 holds everything, including the email queue (`outbox_messages`). SMTP is the only
other dependency (Mailpit locally, SES or SendGrid SMTP in production). All servers run in UTC;
times are converted per person at the edges.

Logs are JSON on stdout (`LOG_PRETTY=false`): each request has an `x-request-id`, echoed as
`traceId` in every error body, so a parent's screenshot of an error finds its log line. Passwords,
tokens, cookies and join links are redacted; emails are masked (`h***@example.com`).

## 2. Run the whole product locally (Docker only)

```sh
docker compose --profile app up --build     # first build takes a few minutes
```

- App: http://localhost:8080 (demo parent `hannah.okafor@example.com` / `violet-harbour-lantern`;
  local seed data, never present in production). Emails: http://localhost:8025 (Mailpit).
- The one-off `migrate` service creates the `codeyoung_app` database if needed, applies
  migrations and loads the demo mentors and parent (idempotent). API and worker then start in
  production mode behind Caddy.
- Ops commands: `docker compose --profile app run --rm migrate node apps/api/dist/cli.js mentor:list`.
- Fresh demo data: `docker compose --profile app run --rm migrate node apps/api/dist/cli.js db:seed --reset --yes`.
- Stop: `docker compose --profile app stop`. `docker compose down -v` also deletes the database
  volume, which other local work may share.
- `APP_PORT=8088` (any free port) when 8080 is taken; `JWT_ACCESS_SECRET` overrides the local
  placeholder secret.
  Safari drops Secure cookies on plain http, so use Chrome or Firefox locally (PD-10).

## 3. Deploying

1. Build both images from the repository root: `docker build --target api .` and
   `docker build --target web .` (CI builds them on every push).
2. Required production settings (the process refuses to start otherwise):
   `DATABASE_URL`, `JWT_ACCESS_SECRET` (32+ random characters from the secret store),
   `SMTP_URL`, `WEB_BASE_URL` (the public origin, used in email links), `COOKIE_SECURE=true`,
   `RATE_LIMIT_MULTIPLIER` 1 or lower. Set `TRUST_PROXY_HOPS` to the number of proxies in front of
   the API (1 behind the web image alone, 2 with a load balancer in front) so rate limits see
   real client addresses. `MAIL_FROM` must be a sender the SMTP provider accepts.
3. Run migrations once per release before the new API starts:
   `node apps/api/dist/cli.js db:migrate`. Migrations are forward-only in production; to undo a
   release, deploy the previous images and leave the (backward compatible) schema.
4. Start or roll API, worker and web. `SIGTERM` drains: the API finishes open requests, the worker
   finishes the emails in flight.
5. `node apps/api/dist/cli.js config:print` shows the effective settings without secrets.

## 4. Everyday operations

All commands print what they will do and ask before writing; `--yes` skips the question in
scripts. Changes to bookings are recorded in `booking_events` as `ops:<your OS user>`.

| Task | Command |
|------|---------|
| Today's classes (IST, with the family's time) | `booking:list` · other days `--from 2026-10-24 --to 2026-10-25` · `--mentor <email>` |
| Families waiting for a slot | `waitlist:list`, then `waitlist:mark <id> CONTACTED` or `CLOSED` |
| Mentor load | `mentor:list` (today's classes per cap, upcoming classes) |

## 5. Situations

### A mentor is ill or unavailable (E-25)

- One class: `booking:reassign <reference>` moves it to the least-loaded free mentor, same time,
  even inside the parents' 4-hour lead time. Parent, old and new mentor are emailed; the old
  mentor's class link stops working.
- The whole day or longer: `mentor:time-off:add <email> --from 2026-10-24T00:00+05:30
  --to 2026-10-25T00:00+05:30 --reason "Sick" --reassign`. Every booked class in the period moves,
  or nothing changes (all or nothing). Without `--reassign` the command lists the classes and stops.
- Nobody free: the command says which class has no cover. Cancel it with an apology to the family:
  `booking:cancel <reference> --reason "Mentor ill, no cover"` (the reason stays internal; the
  email links to booking a new time). Then re-run the time off.
- Back early: `mentor:time-off:remove <id>` (the id is printed when it was added).

### Adding a mentor

1. `mentor:add --name "Meera Pillai" --email meera@codeyoung.dev --tz Asia/Kolkata [--cap 2]`.
2. Write their weekly windows in the mentor's own zone, e.g. `availability.json`:
   `[{"weekday": "Mon", "start": "19:00", "end": "23:00"}, {"weekday": "Sat", "start": "22:00", "end": "01:00"}]`
   (an end before the start crosses midnight).
3. `mentor:availability:set meera@codeyoung.dev --file availability.json [--from 2026-11-01]`
   previews each window in IST, New York and London time (DST included) before saving.
   Replacing windows later is refused if a booked class would no longer fit; move or cancel it
   first.

### A mentor leaves

`mentor:update <email> --active false --reassign` moves every upcoming class to other mentors (all
or nothing), then hides the mentor from new bookings. `--cap` and `--tz` change the daily limit
and the zone the windows are read in.

### Emails are not arriving

1. Worker running? Its log shows `Email sent` per email and `Outbox message failed` with the
   reason and the next attempt.
2. `outbox:list` shows messages that gave up (`DEAD`, after 8 attempts over about 3 hours);
   `outbox:list --status PENDING` shows the queue.
3. Fix the cause (SMTP credentials, provider outage, sender not verified), then
   `outbox:retry <id>` or `outbox:retry --all-dead`. Already delivered emails of a message are not
   sent again.
4. Password reset messages cannot be retried: the token is deleted once handled. The parent asks
   for a new link.

### Deletion request (A-14)

`user:anonymise <email>`. If the account has classes ahead, cancel them first
(`booking:cancel ... --reason "Account deletion"`) and wait for the worker to send the emails. The
command then removes name, email, phone, password, children's names, sessions and waitlist entries
in one transaction; booking rows stay, without personal details, for mentor history.

### Rotating the JWT secret

Set a new `JWT_ACCESS_SECRET` and restart the API (worker and CLI read it too, but do not use it).
Access tokens signed with the old secret stop working at once; browsers get a new one through the
refresh cookie, which does not depend on the secret, so nobody is logged out. Rotate on any
suspicion of exposure; there is no need to revoke sessions unless refresh tokens leaked too.

### Many `503 TEMPORARILY_UNAVAILABLE` responses

Bookings wait at most 3 seconds for a mentor's lock, then answer 503 with `Retry-After: 2`. A burst
on one popular slot is expected and self-healing; a steady stream points at a slow database (check
`/health/ready`, connections, long transactions).

## 6. Data and backups

- Back up PostgreSQL daily with point-in-time recovery (a managed service, or `pg_dump` plus WAL
  archiving). Test a restore quarterly. Everything, including queued emails, is in that one
  database.
- Personal data: `users` (parent name, email, phone), `students` (first name, age),
  `waitlist_entries`, `email_deliveries` (recipient addresses). Password hashes are argon2id;
  refresh and reset tokens are stored only as hashes.
- The worker deletes expired refresh and reset tokens and sessions expired over 30 days, daily.
  `outbox_messages` and `email_deliveries` keep growing (a few rows per booking); archive rows older
  than a year if they ever matter.
- Time zone rules come from the runtime (Node's ICU data). When a country changes its rules,
  rebuild the images on a Node release that includes the update.
