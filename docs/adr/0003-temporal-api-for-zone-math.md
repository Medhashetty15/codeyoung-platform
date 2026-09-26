# 0003 - Temporal API (polyfill) with explicit DST disambiguation

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Author
- **Related:** ADR 0002, [04 - Time zones & DST](../04-timezones-and-dst.md)

## Context

- Expanding mentor availability rules into instants means converting local wall times to instants
  on specific dates. In DST-observing zones some local times do not exist (spring-forward gap) and
  some occur twice (fall-back overlap).
- Many date libraries resolve gaps and overlaps implicitly, with behaviour that is easy to misremember
  and hard to test.
- The same formatting must produce identical strings in the SPA and in emails.

## Decision

Use the **Temporal API** via `temporal-polyfill`, wrapped in a shared package `packages/time`
(`@app/time`) that is the only place zone math happens. Conversions use explicit disambiguation:

- Detect gaps/overlaps with `disambiguation: 'reject'`, then apply the documented policy: window start
  moves forward out of a gap; overlap start takes the earlier occurrence, overlap end the later one.
- Slots are generated on a UTC grid from real instants, so a slot can never land in a gap or repeat.
- Human formatting (`formatForHumans`, `zoneLabel`, range formatter) lives in the same package and is used
  by both the web app and email templates.
- ESLint bans `new Date(string)` parsing and `Date#get*` outside the time package / timezone feature.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Luxon | Mature, but gap/overlap resolution is implicit; explicit policy needs workarounds. |
| date-fns + date-fns-tz | Works on `Date` objects that carry the host zone, the exact leak we want to prevent. |
| Native `Date` + `Intl` only | No zone-aware arithmetic; conversions from wall time to instant need hand-rolled offset search. |

## Consequences

**Positive**
- DST behaviour is explicit, reviewable and unit-tested against pinned 2026 transition dates.
- Future-proof: swap the polyfill for native Temporal when Node and target browsers ship it.

**Negative / accepted trade-offs**
- Polyfill adds bundle weight (~20 KB gzip) to the SPA.
- Temporal is more verbose; the wrapper package absorbs that.

## Revisit when

Native Temporal is available in Node LTS and all target browsers (drop the polyfill), or bundle budget pressure demands a lighter formatter-only path on the client.
