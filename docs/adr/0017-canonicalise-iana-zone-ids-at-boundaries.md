# 0017 - Canonicalise IANA zone ids at every boundary

- **Status:** Accepted (amends ADR 0002 item 2)
- **Date:** 2026-09-26
- **Deciders:** Author
- **Related:** ADR 0002, ADR 0003, [04 - Time zones & DST](../04-timezones-and-dst.md), PD-19

## Context

- ADR 0002 item 2 says zones are validated against `Intl.supportedValuesOf('timeZone')`.
- ICU (used by Node and every browser engine) keeps some renamed zones under their **legacy** ids for
  CLDR stability. On Node 22 (ICU 77) and current Chromium, `supportedValuesOf` lists `Asia/Calcutta`
  but not `Asia/Kolkata`, `Europe/Kiev` but not `Europe/Kyiv`, and so on, and
  `new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata' }).resolvedOptions().timeZone` returns
  `Asia/Calcutta`. A browser in India reports its device zone as `Asia/Calcutta`.
- A `supportedValuesOf().includes(id)` check would therefore reject `Asia/Kolkata`: every mentor, the
  seed data and `MENTOR_DISPLAY_TIMEZONE`. String equality between device and profile zones would
  misfire for users in India, Ukraine, Nepal, Vietnam and a few other places.
- CLDR's `common/bcp47/timezone.xml` records, for each renamed zone, its current IANA name (`iana`
  attribute). There are 19 such groups today.

## Decision

1. **Validation** accepts a zone when `Intl.DateTimeFormat` accepts it as a named zone (not an offset
   such as `+05:30`), in any letter case. Never `supportedValuesOf().includes()`.
2. **Canonicalisation**: `canonicalZone(id)` in `@app/time` resolves the id the way the runtime's ICU
   does (letter case, links such as `US/Eastern`), then maps legacy ICU ids to the current IANA name
   with a table derived from CLDR (`Asia/Calcutta` to `Asia/Kolkata`, `Europe/Kiev` to `Europe/Kyiv`,
   ...). `sameZone(a, b)` compares canonical ids.
3. **Every boundary canonicalises**: `IanaZoneSchema` in `@app/contracts` validates and transforms, so
   API and CLI inputs, stored rows and API responses only ever hold current IANA names. The web app
   canonicalises the device zone before comparing or sending it.
4. An unknown zone is reported as `400 INVALID_TIMEZONE` (the schema marks the issue with that code).
5. A unit test checks the table against the CLDR data and against every zone the running ICU reports
   (no result is ever a legacy id; canonicalisation is idempotent).

## Alternatives considered

| Option | Why not |
|--------|---------|
| `supportedValuesOf().includes(id)` (ADR 0002 as written) | Rejects the current names of real zones, including the one every mentor uses. |
| Store whatever id the client sent | Two spellings of one zone break equality checks, grouping and reporting. |
| Store ICU's legacy ids | Correct for Intl but surprising for people and other systems; would leak `Asia/Calcutta` into emails, the CLI and exports. |
| Bundle the full tzdb link table | Large for the browser bundle, and would also follow tzdb's merged-zone links (e.g. `Europe/Amsterdam` to `Europe/Brussels`), which changes the city people recognise. |

## Consequences

**Positive**
- One spelling per zone everywhere; `Asia/Kolkata` works on every engine.
- Device and profile zones compare correctly for all users.

**Negative / accepted trade-offs**
- The alias table must follow CLDR renames (rare; the test fails when the runtime reports a new legacy id).
- Engines that stop canonicalising links in `resolvedOptions()` would keep rare link names such as
  `US/Eastern` as sent. They are still valid zones; only `sameZone` against the primary name would differ.

## Revisit when

CLDR adds a rename, or engines ship `Intl` time-zone canonicalisation changes that make ICU report
current IANA names directly.
