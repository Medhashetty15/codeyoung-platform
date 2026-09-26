# Codeyoung trial-class booking

Parents book a free trial class in their own time zone; the system assigns an available mentor
and emails both sides. Design docs live in [`docs/`](docs/README.md).

## Run it (Docker only)

```sh
docker compose --profile app up --build   # PostgreSQL, Mailpit, migrate + demo data, API, worker, web
```

If port 8080 is taken, choose another: `APP_PORT=8088 docker compose --profile app up --build`
(then open that port instead).

Open http://localhost:8080 and book a trial as the demo parent `hannah.okafor@example.com` /
`violet-harbour-lantern` (local seed data only), or register. Every email lands in Mailpit at
http://localhost:8025. The API and worker run in production mode behind Caddy, which serves the
web app and proxies `/api`. Use Chrome or Firefox (Safari drops Secure cookies on plain http).
Details, ops commands and deployment: [docs/runbook.md](docs/runbook.md).

## Repository layout

| Path                 | What                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `apps/api`           | NestJS 11 API, background worker and ops CLI (three entry points) |
| `apps/web`           | React 19 + Vite web app, design system and component gallery      |
| `packages/contracts` | `@app/contracts`: shared zod schemas, types and error codes       |
| `packages/time`      | `@app/time`: Temporal-based time zone and DST helpers             |
| `infra/`             | Database init script, Caddy config for the web image              |
| `Dockerfile`         | Multi-stage build: `api` image (API, worker, CLI) and `web` image |
| `docs/`              | Requirements, architecture, backend/frontend design, ADRs         |

npm workspaces, TypeScript 6 (strict), ESLint 10 (flat config), Prettier, Vitest.

## Develop: backend

Prerequisites: Node 22 (`nvm use`), npm 10, Docker.

```sh
npm install
npm run infra:up                           # PostgreSQL 17 on :5433, Mailpit on :1025 / :8025
cp apps/api/.env.example apps/api/.env     # local settings; real env vars always win
npm run db:migrate                         # create the schema (reviewed migrations)
npm run db:seed                            # 10 IST mentors + demo parent (safe to re-run)
npm run dev                                # builds packages, then watches packages + API + worker + web
curl localhost:3000/api/v1/health/ready    # {"status":"ok",...}
```

- API: `http://localhost:3000/api/v1`, OpenAPI UI at `http://localhost:3000/api/docs` (not in production).
- Mailpit UI: `http://localhost:8025`. The worker sends every email there locally: booking
  confirmations, cancellations, reschedules and reminders to parent and mentor (each in their own
  zone, with a calendar invite), and password emails.
- Classroom page data: `GET /api/v1/classroom/<join token>` (the token from a booking's join link).
- Demo parent login: `hannah.okafor@example.com` / `violet-harbour-lantern` (children Leo 9 and
  Maya 12; override the password with `SEED_DEMO_PASSWORD`).
- Ops CLI: `npm run cli -- --help` (builds, then runs), e.g. `npm run cli -- config:print`; see
  [Operations](#operations).

`docker compose` uses the project name `codeyoung`, so every worktree on a machine shares one
PostgreSQL and one Mailpit. The init script creates `codeyoung_dev` (backend, API on 3000),
`codeyoung_fe` (frontend's API instance on 3001), `codeyoung_test` and `codeyoung_app` (the
Docker `app` profile; `db:create` adds it to an older volume).

## Develop: web

```sh
npm install
cp apps/web/.env.example apps/web/.env   # optional: VITE_API_PROXY_TARGET (default http://localhost:3001), VITE_SUPPORT_EMAIL
npm run dev:web                          # http://localhost:5173, /api proxied to the API
```

- Component gallery (development only): `http://localhost:5173/dev/gallery`, every component and
  state in both themes. The theme switch sits in its header.
- `npm run icons -w @app/web` regenerates the icon components after adding a name to
  `apps/web/scripts/generate-icons.mjs`; a unit test fails if the committed file is stale.
- Design rules live in [docs/07](docs/07-design-system.md); screens and architecture in [docs/05](docs/05-frontend-design.md).
- Without an API: `VITE_API_MOCKS=1 npm run dev:web` serves MSW handlers built from the contract
  fixtures; add `?mock=signed-in` to any URL to browse as a signed-in parent.
- The production build: `npm run build -w @app/web`, then `npm run preview -w @app/web`
  (http://localhost:4173, same `/api` proxy).

## Testing: web, e2e and a11y

| Command                     | What it covers                                                                                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test -w @app/web`      | Vitest, Testing Library and MSW (handlers from `@app/contracts` fixtures): every screen's states, error mapping, time zone logic, plus a copy lint (no em/en dashes, emojis or filler words) and the CSP guards. |
| `npm run build -w @app/web` | Fails if any route's first load (entry + route chunk + preloads) exceeds 180 KB gzip, or if `apps/web/csp.json` no longer matches the inline script in the built `index.html`.                                   |
| `npm run e2e -w @app/web`   | Playwright against the real API, worker and Mailpit, in `Europe/London` and `America/Los_Angeles`, then axe on every route in both themes and screenshots at 375 and 1280 px, light and dark.                    |

End-to-end prerequisites (the frontend's API instance, see above):

```sh
docker compose up -d                  # PostgreSQL and Mailpit (http://localhost:8025)
# apps/api/.env: PORT=3001, DATABASE_URL=.../codeyoung_fe, COOKIE_SECURE=false, RATE_LIMIT_MULTIPLIER=100
npm run db:migrate
npm run dev:api                       # API on 3001
SMTP_URL=smtp://localhost:1025 OUTBOX_POLL_MS=500 npm run dev:worker   # emails land in Mailpit
npm run e2e -w @app/web               # starts, or reuses, the web dev server on 5173
npx playwright show-report apps/web/e2e-report   # results, traces and the attached screenshots
```

Each zone project first runs the built CLI (`node apps/api/dist/cli.js db:seed --scenario e2e --tz <zone>`;
`npm run dev:api` or `npm run build -w @app/api` produces it), which **resets** the database in
`apps/api/.env`; never point it at data you want to keep. Per zone it books as a new parent and checks
the parent email (their zone) and the mentor email (IST plus the family's time), races two families
for the last free mentor, moves and cancels a trial, and resets a password from the Mailpit link. In CI
the `e2e` job runs the same suite against the built app (`vite preview` on 4173). `E2E_WEB`, `E2E_API`
and `E2E_MAILPIT` point it elsewhere. The Docker `app` profile is not an e2e target: it runs in
production mode, where the rate limits stay strict and would stop the suite's repeated sign-ups.

## Frontend architecture notes

- **The URL is the state** for the booking flow (`?tz=&date=&slot=`), so refresh, Back and shared
  links all work; server data lives in TanStack Query, the session in a small zustand store.
- **Session:** the access token stays in memory, the refresh token in an httpOnly SameSite=Strict
  cookie. Refresh is single-flight (a Web Lock across tabs), proactive 60 s before expiry and reactive
  on a 401; login and logout are broadcast to other tabs.
- **Time:** every date and time goes through `@app/time` (Temporal); ESLint bans `Date` elsewhere. The
  display zone resolves URL, then the chosen zone, the profile, the saved zone and the device, and is
  shown next to every time.
- **First load:** routes are lazy; React Hook Form, zod, Base UI menus and dialogs load after the page.
  A deferred control shows its real button and mounts the loaded version already open on press, so
  no click is lost. Response validation with zod runs in development and tests only.
- **Content Security Policy:** Caddy sends a strict policy (`infra/web/Caddyfile`): no
  `'unsafe-inline'` scripts and no `'unsafe-eval'`. The only inline script sets the theme before first
  paint; its hash lives in `apps/web/csp.json` (`npm run csp-hash -w @app/web`), which a unit test keeps
  equal to `index.html`, the build to `dist/index.html`, and `apps/web/scripts/csp.spec.ts` to the
  Caddyfile, along with the hashes of the styles Sonner and NumberFlow inject; upgrading either library
  may need a Caddyfile update. zod runs `jitless` (`src/zod-config.ts`) so it never probes `eval`.

## Scripts (root)

| Script                                                       | What it does                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `npm run dev`                                                | Build packages, then watch packages, API, worker and web                            |
| `npm run build`                                              | Build every workspace (packages first)                                              |
| `npm run lint` / `lint:fix`                                  | ESLint, zero warnings allowed                                                       |
| `npm run format` / `format:check`                            | Prettier                                                                            |
| `npm run typecheck`                                          | `tsc` for every workspace                                                           |
| `npm test`                                                   | Unit tests in every workspace                                                       |
| `npm run test:int`                                           | Integration tests; needs Docker (Testcontainers starts PostgreSQL 17 and Mailpit)   |
| `npm run infra:up` / `infra:down`                            | Start / stop local PostgreSQL and Mailpit                                           |
| `npm run db:migrate`                                         | Apply pending migrations                                                            |
| `npm run db:revert`                                          | Undo the last migration (asks first; `-- --yes` in scripts)                         |
| `npm run db:drift`                                           | Exit 1 if entities and migrations disagree                                          |
| `npm run db:seed`                                            | Demo data; `-- --reset` empties every table first (asks first)                      |
| `npm run db:seed -- --scenario e2e --tz Europe/London --yes` | End-to-end data relative to now (one-slot-left and fully booked days), JSON summary |
| `npm run cli -- <command>`                                   | Build, then run an ops CLI command                                                  |

CI (`.github/workflows/ci.yml`) runs lint, format, typecheck, unit and integration tests under both
`TZ=UTC` and `TZ=America/New_York`, the build, and builds both Docker images. Integration tests
need Docker: Testcontainers starts PostgreSQL 17 and Mailpit.

## API configuration

Validated with zod at boot; the process refuses to start on invalid values. See
[`apps/api/.env.example`](apps/api/.env.example) for every key with its default.

| Key                                                          | Default                            | Meaning                                                       |
| ------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------- |
| `NODE_ENV`                                                   | `development`                      | `development`, `test` or `production`                         |
| `PORT`                                                       | `3000`                             | HTTP port                                                     |
| `DATABASE_URL`                                               | (required)                         | PostgreSQL connection string                                  |
| `WEB_BASE_URL`                                               | `http://localhost:5173`            | Web app origin: email links and default CORS origin           |
| `CORS_ORIGINS`                                               | web origin                         | Comma-separated CORS allow-list                               |
| `LOG_LEVEL`                                                  | `info`                             | Pino level (`silent` in tests)                                |
| `LOG_PRETTY`                                                 | `true` in development              | Human-readable logs instead of JSON                           |
| `TRUST_PROXY_HOPS`                                           | `0`                                | Reverse-proxy hops trusted for client IPs                     |
| `RATE_LIMIT_MULTIPLIER`                                      | `1`                                | Scales every rate limit (e2e); must be `<= 1` in prod         |
| `SEED_DEMO_PASSWORD`                                         | `violet-harbour-lantern`           | Demo parent password for `db:seed` (never production)         |
| `JWT_ACCESS_SECRET`                                          | (required)                         | HS256 key for access tokens, at least 32 characters           |
| `JWT_ACCESS_TTL_SEC`                                         | `900`                              | Access token lifetime                                         |
| `REFRESH_TTL_DAYS` / `SESSION_MAX_DAYS`                      | `7` / `30`                         | Refresh token lifetime / absolute session cap                 |
| `REFRESH_REUSE_GRACE_SEC`                                    | `20`                               | Parallel-tab window before a reused token revokes the session |
| `PASSWORD_RESET_TTL_MIN`                                     | `30`                               | Reset link lifetime                                           |
| `LOGIN_LOCK_THRESHOLD` / `LOGIN_LOCK_MINUTES`                | `10` / `15`                        | Failures per window before a temporary lock                   |
| `COOKIE_SECURE`                                              | `true`                             | Secure refresh cookie; `false` only for local http            |
| `TRIAL_DURATION_MIN` / `SLOT_GRID_MIN` / `MENTOR_BUFFER_MIN` | `60` / `30` / `15`                 | Class length, UTC slot grid, changeover after each class      |
| `BOOKING_LEAD_TIME_MIN` / `BOOKING_HORIZON_DAYS`             | `240` / `14`                       | Bookable window, counted from the server clock                |
| `RESCHEDULE_CUTOFF_MIN` / `DEFAULT_MAX_TRIALS_PER_DAY`       | `120` / `2`                        | Reschedule cutoff, default mentor daily cap                   |
| `CLASSROOM_OPENS_MIN_BEFORE` / `MENTOR_DISPLAY_TIMEZONE`     | `10` / `Asia/Kolkata`              | Classroom opening, mentor zone shown in the UI                |
| `SMTP_URL`                                                   | `smtp://localhost:1025`            | Outgoing mail (Mailpit locally); required in production       |
| `MAIL_FROM`                                                  | `Codeyoung <trials@codeyoung.dev>` | Sender and calendar invite organizer                          |
| `OUTBOX_POLL_MS` / `OUTBOX_MAX_ATTEMPTS`                     | `2000` / `8`                       | Worker poll interval / attempts before a message is `DEAD`    |

## Worker

`apps/api/src/worker.ts` (`npm run dev` watches it; `npm run start:worker -w @app/api` after a
build) runs the background jobs of docs/03 §7.1, each in its own loop that never overlaps itself:

| Job                | Every | What                                                                       |
| ------------------ | ----- | -------------------------------------------------------------------------- |
| outbox-relay       | 2 s   | Claims due outbox rows (`SKIP LOCKED`), sends their emails once, backs off |
| outbox-reaper      | 1 min | Requeues rows stuck in `PROCESSING` for 5 minutes (a worker died)          |
| complete-bookings  | 5 min | Confirmed classes that ended over an hour ago become `COMPLETED`           |
| credential-cleanup | 1 day | Deletes expired refresh and reset tokens and sessions expired over 30 days |

Several workers can run at once. `SIGTERM` stops scheduling and waits for runs in progress.

## Operations

Everything ops does runs through the CLI (`npm run cli -- <command>` locally,
`node apps/api/dist/cli.js <command>` in the `api` image). Writes show a summary and ask first.
The [runbook](docs/runbook.md) walks through each situation.

| Situation                        | Commands                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Daily view                       | `booking:list` (today in IST, with each family's time), `mentor:list`, `waitlist:list`                |
| Mentor ill for one class / a day | `booking:reassign <ref>` / `mentor:time-off:add <email> --from … --to … --reassign`                   |
| Nobody can cover                 | `booking:cancel <ref> --reason "…"` (family gets an apology and a rebook link)                        |
| New mentor                       | `mentor:add`, `mentor:availability:set <email> --file availability.json` (preview in IST, NY, London) |
| Mentor leaves                    | `mentor:update <email> --active false --reassign`                                                     |
| Emails failed                    | `outbox:list`, `outbox:retry <id>` or `--all-dead`                                                    |
| Deletion request                 | `user:anonymise <email>`                                                                              |

## Conventions that CI enforces

- All time zone math goes through `@app/time`; ESLint rejects `new Date(...)`, `Date.now()` and
  local-time `Date` getters elsewhere (docs/04). Business code reads time from the injected `Clock`.
- Shared packages stay browser safe (no Node built-ins, no `process`); `domain/` folders never
  import NestJS or TypeORM.
- Every error response is RFC 7807 `application/problem+json` with a stable `code` and `traceId`
  (docs/03 §9).

## Credits

| Asset                                                                                                   | Source                                                                                                                            | Licence                                           |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Photo: child in a live class ([`apps/web/src/assets/photos/trial-class-*`](apps/web/src/assets/photos)) | Katerina Holmes, [Pexels](https://www.pexels.com/photo/ethnic-girl-having-video-chat-with-teacher-online-on-laptop-5905709/)      | [Pexels License](https://www.pexels.com/license/) |
| Photo: parent and child at a laptop (`parent-and-child-*`)                                              | Timur Weber, [Pexels](https://www.pexels.com/photo/father-and-son-sitting-on-the-floor-9127073/)                                  | [Pexels License](https://www.pexels.com/license/) |
| Icons                                                                                                   | [Phosphor Icons](https://phosphoricons.com) (`@phosphor-icons/core`)                                                              | MIT, Copyright (c) 2023 Phosphor Icons            |
| Fonts                                                                                                   | [Figtree](https://github.com/erikdkennedy/figtree), [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) (via Fontsource) | SIL Open Font License 1.1                         |

Photos are cropped and re-encoded (AVIF, WebP, JPEG) with metadata stripped; the people shown are
stock models, not Codeyoung families or mentors.
