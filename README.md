# Codeyoung trial-class booking

Parents book a free trial class in their own time zone; the system assigns an available mentor
and emails both sides. Design docs live in [`docs/`](docs/README.md).

## Repository layout

| Path                 | What                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `apps/api`           | NestJS 11 API, background worker and ops CLI (three entry points) |
| `apps/web`           | React 19 + Vite web app, design system and component gallery      |
| `packages/contracts` | `@app/contracts`: shared zod schemas, types and error codes       |
| `packages/time`      | `@app/time`: Temporal-based time zone and DST helpers             |
| `infra/`             | Local infrastructure support files (database init script)         |
| `docs/`              | Requirements, architecture, backend/frontend design, ADRs         |

npm workspaces, TypeScript 6 (strict), ESLint 10 (flat config), Prettier, Vitest.

## Quick start (backend)

Prerequisites: Node 22 (`nvm use`), npm 10, Docker.

```sh
npm install
npm run infra:up                           # PostgreSQL 17 on :5433, Mailpit on :1025 / :8025
cp apps/api/.env.example apps/api/.env     # local settings; real env vars always win
npm run dev                                # builds packages, then watches packages + API + worker + web
curl localhost:3000/api/v1/health/ready    # {"status":"ok",...}
```

- API: `http://localhost:3000/api/v1`, OpenAPI UI at `http://localhost:3000/api/docs` (not in production).
- Mailpit UI: `http://localhost:8025`.
- Ops CLI (after `npm run build`): `npm run cli -- --help`, e.g. `npm run cli -- config:print`.

`docker compose` uses the project name `codeyoung`, so every worktree on a machine shares one
PostgreSQL and one Mailpit. The init script creates `codeyoung_dev` (backend, API on 3000),
`codeyoung_fe` (frontend's API instance on 3001) and `codeyoung_test`.

## Quick start (web)

```sh
npm install
cp apps/web/.env.example apps/web/.env   # optional: VITE_API_PROXY_TARGET (default http://localhost:3001)
npm run dev:web                          # http://localhost:5173, /api proxied to the API
```

- Component gallery (development only): `http://localhost:5173/dev/gallery`, every component and
  state in both themes. The theme switch sits in its header.
- `npm run icons -w @app/web` regenerates the icon components after adding a name to
  `apps/web/scripts/generate-icons.mjs`; a unit test fails if the committed file is stale.
- Design rules live in [docs/07](docs/07-design-system.md); screens and architecture in [docs/05](docs/05-frontend-design.md).

## Scripts (root)

| Script                            | What it does                                                    |
| --------------------------------- | --------------------------------------------------------------- |
| `npm run dev`                     | Build packages, then watch packages, API, worker and web        |
| `npm run build`                   | Build every workspace (packages first)                          |
| `npm run lint` / `lint:fix`       | ESLint, zero warnings allowed                                   |
| `npm run format` / `format:check` | Prettier                                                        |
| `npm run typecheck`               | `tsc` for every workspace                                       |
| `npm test`                        | Unit tests in every workspace                                   |
| `npm run test:int`                | Integration tests (Testcontainers starts its own PostgreSQL 17) |
| `npm run infra:up` / `infra:down` | Start / stop local PostgreSQL and Mailpit                       |
| `npm run cli -- <command>`        | Ops CLI (requires `npm run build`)                              |

CI (`.github/workflows/ci.yml`) runs lint, format, typecheck, unit and integration tests under both
`TZ=UTC` and `TZ=America/New_York`, and the build.

## API configuration

Validated with zod at boot; the process refuses to start on invalid values. See
[`apps/api/.env.example`](apps/api/.env.example) for every key with its default.

| Key                     | Default                 | Meaning                                               |
| ----------------------- | ----------------------- | ----------------------------------------------------- |
| `NODE_ENV`              | `development`           | `development`, `test` or `production`                 |
| `PORT`                  | `3000`                  | HTTP port                                             |
| `DATABASE_URL`          | (required)              | PostgreSQL connection string                          |
| `WEB_BASE_URL`          | `http://localhost:5173` | Web app origin: email links and default CORS origin   |
| `CORS_ORIGINS`          | web origin              | Comma-separated CORS allow-list                       |
| `LOG_LEVEL`             | `info`                  | Pino level (`silent` in tests)                        |
| `LOG_PRETTY`            | `true` in development   | Human-readable logs instead of JSON                   |
| `TRUST_PROXY_HOPS`      | `0`                     | Reverse-proxy hops trusted for client IPs             |
| `RATE_LIMIT_MULTIPLIER` | `1`                     | Scales every rate limit (e2e); must be `<= 1` in prod |

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
