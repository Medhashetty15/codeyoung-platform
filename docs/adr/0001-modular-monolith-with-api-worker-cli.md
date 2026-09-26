# 0001 - Modular monolith with API, worker and CLI entry points

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Author
- **Related:** [02 - Architecture](../02-architecture.md), ADR 0005, ADR 0008

## Context

- Load is tiny: about 20 bookings per day, 10 mentors. Even 100x growth is modest.
- The work splits into three kinds: request/response HTTP, asynchronous delivery (emails, reminders,
  housekeeping) and occasional operator actions (mentor onboarding, reassignment).
- Correctness depends on transactions spanning several concepts (booking, audit event, outbox row),
  which is simplest inside one process and one database.
- A small team must be able to run, test and deploy it without platform overhead.

## Decision

Build one NestJS codebase organised as a **modular monolith** (each module owns its tables and exposes
services; no module reads another's tables directly) with **three entry points**:

| Entry | Bootstrap | Responsibility |
|-------|-----------|----------------|
| `main.ts` | `NestFactory.create(ApiModule)` | HTTP API |
| `worker.ts` | `NestFactory.createApplicationContext(WorkerModule)` | Outbox relay, reminders, housekeeping |
| `cli.ts` | `CommandFactory.run(CliModule)` | Ops commands |

API and worker deploy as separate processes from the same image.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Microservices (booking, notification, identity) | Distributed transactions or sagas for a problem one Postgres transaction solves; more infra, more failure modes, no scale need. |
| Single process doing HTTP and background jobs | Email retries and polling compete with request latency; cannot scale or restart independently; a stuck job affects the API. |
| Serverless functions | Cold starts, connection pooling pain with Postgres, harder local development, and the outbox poller wants a long-lived process. |

## Consequences

**Positive**
- One transaction covers booking + audit + outbox; invariants stay simple.
- One repository, one CI pipeline, one deployable image; fast local setup.
- Clear module boundaries make later extraction (e.g. notifications) mechanical.

**Negative / accepted trade-offs**
- Module boundaries are enforced by convention and lint rules, not by the network; discipline required.
- Worker and API share a release cadence.

## Revisit when

A module needs an independent scaling profile or release cadence (e.g. notifications serving other
products), or team size makes a shared codebase a coordination bottleneck.
