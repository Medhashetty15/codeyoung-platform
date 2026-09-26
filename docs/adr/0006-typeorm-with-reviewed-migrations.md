# 0006 - TypeORM with hand-reviewed migrations and explicit transactions

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Author
- **Related:** ADR 0004, [03 - Backend design §2](../03-backend-design.md)

## Context

- NestJS is the backend framework; the schema relies on PostgreSQL-specific features (exclusion
  constraint, partial indexes, `tstzrange`, `citext`) and the booking path uses row locks and savepoints.
- Drizzle, Prisma and TypeORM were compared. Drizzle offers stronger query typing; TypeORM offers the
  official Nest integration and familiarity for reviewers.

## Decision

Use **TypeORM** via `@nestjs/typeorm`, under these rules:

1. `synchronize: false`, `migrationsRun: false`. Migrations run as an explicit deploy step.
2. Migrations are generated, then reviewed and edited by hand. Extensions, the exclusion constraint and
   CHECKs are written in SQL inside migrations.
3. Entities still declare `@Exclusion`, `@Check`, partial `@Index` so the generator sees no drift;
   CI fails on drift (`migration:generate --check`).
4. Status columns are `text` + `CHECK`, not Postgres enums (TypeORM migrates enum changes by drop/recreate).
5. `SnakeNamingStrategy`; no eager or lazy relations; no cascades; explicit joins.
6. Repositories are our own classes constructed from an `EntityManager`; transactions are opened
   explicitly and the manager is passed down. No ambient transaction magic.
7. Locking and performance-critical queries use QueryBuilder or parameterised raw SQL in repositories.
8. `timestamptz` maps to `Date` at the ORM edge and to `Temporal.Instant` inside repositories.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Drizzle | Better type safety; no official Nest module and drizzle-kit cannot express the exclusion constraint. Close second. |
| Prisma | Poor support for range types and exclusion constraints; interactive transactions and row locks require raw SQL anyway. |
| Knex/Kysely + plain SQL | Maximum control, but more boilerplate and less familiar in Nest codebases. |

## Consequences

**Positive**
- Idiomatic NestJS; reviewers know it; DI integration out of the box.
- The rules remove TypeORM's main foot-guns (sync, eager loading, enum migrations, hidden transactions).

**Negative / accepted trade-offs**
- Weaker compile-time typing for QueryBuilder/raw results; mitigated by typed repository return values and integration tests.
- Migration generation needs human review every time.

## Revisit when

Query-typing bugs recur in repositories, or TypeORM maintenance stalls; Drizzle is the planned replacement and repositories are the only layer that would change.
