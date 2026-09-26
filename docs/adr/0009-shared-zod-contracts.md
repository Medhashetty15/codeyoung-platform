# 0009 - Shared zod contracts package for API and web

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Author
- **Related:** ADR 0010

## Context

- The web app and API live in one repository and change together.
- Request validation, response typing and form validation should never drift (e.g. password policy,
  child age range, slot payload).
- External consumers (reviewers, future clients) still benefit from OpenAPI docs.

## Decision

Create `packages/contracts` (`@app/contracts`) holding zod schemas and inferred TypeScript types for every
request, response and error payload.

- API validates input with `nestjs-zod` using these schemas; OpenAPI is generated from them for `/api/docs`.
- Web parses responses with the same schemas (strict in dev, report-and-continue in prod) and uses them as
  React Hook Form resolvers.
- Error `code` values are a shared enum; the UI branches on codes only.

## Alternatives considered

| Option | Why not |
|--------|---------|
| class-validator DTOs + OpenAPI codegen for the client | Two sources (decorators + generated client), a codegen step, and forms still need separate validation. |
| Hand-written types on both sides | Drift is guaranteed over time. |
| tRPC | Changes the API style to RPC; REST was chosen for clarity and external consumers. |

## Consequences

**Positive**
- One definition per contract; compile errors on both sides when it changes.
- Client-side validation matches server validation exactly.

**Negative / accepted trade-offs**
- Server-only rules (common-password list) cannot live in the shared schema; they stay server-side.
- Couples web and API releases, which is acceptable in one monorepo.

## Revisit when

A third-party client needs a stable versioned contract independent of our release cycle.
