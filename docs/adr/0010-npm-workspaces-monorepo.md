# 0010 - npm workspaces monorepo

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Author
- **Related:** ADR 0009

## Context

- Four packages: `apps/api`, `apps/web`, `packages/contracts`, `packages/time`. Shared code must be
  consumed by both apps without publishing.
- The local toolchain has Node 22 and npm; no pnpm installed.

## Decision

Use **npm workspaces** (`"workspaces": ["apps/*", "packages/*"]`) with root scripts that fan out
(`npm run dev|test|build --workspaces --if-present`). Internal packages are referenced as `@app/*`
with TypeScript project references. No additional monorepo tool.

## Alternatives considered

| Option | Why not |
|--------|---------|
| pnpm workspaces | Stricter dependency isolation and faster installs; not installed locally and not required at this size. |
| Turborepo / Nx | Task caching and graphs pay off with many packages; four packages do not need them. |
| Separate repositories | Shared contracts would need publishing and version coordination. |

## Consequences

**Positive**
- Zero extra tooling; works everywhere Node works.

**Negative / accepted trade-offs**
- Hoisting can hide undeclared dependencies; mitigated by lint rule `import/no-extraneous-dependencies`.
- No task caching; CI time grows linearly with packages.

## Revisit when

CI time or package count grows enough that caching (Turborepo) or strict isolation (pnpm) pays for itself.
