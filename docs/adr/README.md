# Architecture Decision Records

Format: lightweight MADR. Each record states the context, the decision, the alternatives we rejected
and why, the consequences (good and bad), and the signal that should make us revisit it.
Records are immutable once accepted; a change of mind is a new ADR that supersedes the old one.

| # | Title | Status | Area |
|---|-------|--------|------|
| [0001](0001-modular-monolith-with-api-worker-cli.md) | Modular monolith with API, worker and CLI entry points | Accepted | Architecture |
| [0002](0002-utc-instants-and-iana-zones.md) | Store UTC instants and IANA zones, never offsets | Accepted | Time |
| [0003](0003-temporal-api-for-zone-math.md) | Temporal API (polyfill) with explicit DST disambiguation | Accepted | Time |
| [0004](0004-db-enforced-booking-invariants.md) | Enforce booking invariants in PostgreSQL | Accepted | Data / concurrency |
| [0005](0005-transactional-outbox.md) | Transactional outbox + worker instead of Redis/BullMQ | Accepted | Messaging |
| [0006](0006-typeorm-with-reviewed-migrations.md) | TypeORM with hand-reviewed migrations and explicit transactions | Accepted | Data |
| [0007](0007-jwt-access-and-rotating-refresh-tokens.md) | Email/password auth with stateless JWT access and rotating opaque refresh tokens | Accepted | Security |
| [0008](0008-ops-cli-instead-of-admin-ui.md) | Ops CLI instead of an admin UI for the MVP | Accepted | Operations |
| [0009](0009-shared-zod-contracts.md) | Shared zod contracts package for API and web | Accepted | API |
| [0010](0010-npm-workspaces-monorepo.md) | npm workspaces monorepo | Accepted | Tooling |
| [0011](0011-least-loaded-assignment-strategy.md) | Pluggable mentor assignment, least-loaded first | Accepted | Domain |
| [0012](0012-account-required-booking-public-browsing.md) | Public slot browsing, account required to book | Accepted | Product |
| [0013](0013-no-slot-holds-url-driven-wizard.md) | No slot holds; URL-driven wizard with conflict alternatives | Accepted | Product / UX |
| [0014](0014-base-ui-tailwind-css-only-motion.md) | Base UI + Tailwind v4 + cva, CSS-only motion | Accepted | Frontend |
| [0015](0015-design-system-as-source-of-truth.md) | Design system doc as the single source of visual truth | Accepted, amended by 0016 | Frontend / design |
| [0016](0016-replace-satoshi-with-figtree.md) | Replace Satoshi with Figtree (licence) | Accepted | Frontend / design |

Template for new records: [template.md](template.md).
