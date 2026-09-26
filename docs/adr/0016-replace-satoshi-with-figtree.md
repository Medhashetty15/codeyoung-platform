# 0016 - Replace Satoshi with Figtree (licence)

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Author
- **Related:** ADR 0015 (typography line amended), [07 - Design system §3](../07-design-system.md), [05 - Frontend design §2](../05-frontend-design.md)

## Context

- ADR 0015 and doc 07 §3 chose Satoshi Variable (Fontshare) as the display and UI face, self-hosted.
- Satoshi ships under the ITF Free Font License v2.0. Section 01 allows self-hosting for our own
  website, but section 02 forbids making the font files available to anyone else "through ... repository
  ... publicly accessible servers". This repository is handed to reviewers, so committing the woff2
  files would be redistribution. Section 02 also forbids subsetting or converting the files.
- The alternatives that keep Satoshi either fetch it at setup time from an undocumented download URL
  (network needed in CI and Docker, a fresh clone renders the fallback until fetched) or load it from
  the Fontshare CDN (a third-party font request, which doc 05 §2 rules out, and a privacy cost on a
  children's product).
- Doc 07 requires tabular figures for times and countdowns and no layout shift on font swap.

## Decision

- Use **Figtree Variable** (SIL Open Font License 1.1) for display and UI, installed from npm as
  `@fontsource-variable/figtree` and bundled by Vite. No font binaries of ours are committed.
- Keep JetBrains Mono for booking references (unchanged).
- Keep a metric-matched local fallback face (`size-adjust`, `ascent-override`, `descent-override`,
  `line-gap-override` computed from the Figtree and Arial font files) so the swap causes no layout shift.
- ADR 0015's typography line is amended by this record; everything else in 0015 stands.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Keep Satoshi, committed to the repo | Violates ITF FFL section 02 (redistribution through a repository). |
| Keep Satoshi, downloaded by a setup script into a git-ignored folder | Compliant, but depends on an undocumented URL and network access in CI and Docker; fresh clones render the fallback until the script runs. |
| Satoshi from the Fontshare CDN | Third-party font request (doc 05 §2), visitor privacy, extra connection before first text paint. |
| Manrope (OFL) | Also has tabular figures; slightly wider and more technical in tone, and a larger file (24 KB vs 19 KB for the latin subset). |
| Inter, Plus Jakarta Sans, Geist | Banned or rejected in doc 07 §3 as generic or cold. |

## Consequences

**Positive**
- Licence-clean: OFL permits bundling and redistribution; nothing proprietary in the repository.
- Smaller: the latin variable woff2 is about 19 KB (Satoshi about 41 KB), which helps LCP.
- Tabular figures (`tnum`) verified in the font file, so times align and countdown digits do not jitter.
- Reproducible from a clean clone with `npm install` alone.

**Negative / accepted trade-offs**
- Figtree is slightly less distinctive than Satoshi; the brand character rests more on colour, the
  Time Tray and the copy.

## Revisit when

Codeyoung supplies brand typography, or a Satoshi licence covering repository distribution is obtained.
