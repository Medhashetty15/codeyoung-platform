# 0015 - Design system doc as the single source of visual truth

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Author
- **Related:** ADR 0014, [07 - Design system](../07-design-system.md)

## Context

- Parents booking a child's class need to trust the product; the audience and a kids' education
  context call for a calm, trust-first language that is still warm.
- Without explicit rules, UI drifts toward generic AI-template tells (purple gradients, three equal
  cards, eyebrows everywhere, em-dash copy, spinners, ungated hover, `transition: all`).
- Several design skills were applied and conflicted in places; the resolution must be written down once.

## Decision

`docs/07-design-system.md` is the single source of truth for visual language, motion and copy:

- **Personality:** calm, exact, warm. Dials: landing 6/4/3, product flows 3/3/5, classroom 3/3/3.
- **Colour:** Zinc neutrals + a single Forest accent (`#166A4E` light / `#3DBE8B` dark); semantic danger
  and caution only for meaning; light and dark themes following system preference with a manual switch.
- **Type:** Satoshi Variable (self-hosted) for display and UI; JetBrains Mono for booking references;
  tabular figures for all times.
- **Shape:** 10px controls, 16px surfaces, 22px tray shell, pills only for badges and the zone chip.
- **Signature element:** the Time Tray, used only on the landing hero and the booking summary.
- **Motion:** the inventory in §7.3 is exhaustive; anything not listed does not animate.
- **Copy:** no em/en dashes, no emojis, sentence case, one label per intent, every time shown with its zone.
- **QA:** pre-flight checklist on every UI PR; real-device pass and fresh-eyes review before release.

Changes to tokens or rules happen in the doc first, then in code.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Decide visuals per component during implementation | Inconsistency and slow reviews; no shared bar. |
| Adopt a third-party design language wholesale (Material, Fluent) | Recognisable as someone else's product; poor fit for a warm consumer brand. |
| Use Codeyoung's real brand assets | Not provided; tokens are structured so real brand colours and fonts can replace ours in one place. |

## Consequences

**Positive**
- Every screen and review is measured against the same written bar.
- Brand swap later is a token change, not a redesign.

**Negative / accepted trade-offs**
- Real photography is required before launch (doc 07 §10); placeholders until then.
- The doc must be kept current as the product evolves.

## Revisit when

Codeyoung brand guidelines are supplied, or user research shows the visual language hurts trust or clarity.
