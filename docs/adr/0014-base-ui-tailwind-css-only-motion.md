# 0014 - Base UI + Tailwind v4 + cva, CSS-only motion

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Author
- **Related:** ADR 0015, [05 - Frontend design §2](../05-frontend-design.md), [07 - Design system §6, §7](../07-design-system.md)

## Context

- The UI must be production grade and must not look like a generic template.
- Dialogs, popovers, menus, a combobox (zone picker), tabs and an accordion need correct accessibility
  (focus trapping, dismissal, keyboard navigation).
- Motion should be purposeful and cheap: most of it is feedback, popovers and sheets.
- Library picks follow the curated `pick-ui-library` list.

## Decision

- **Primitives:** Base UI (unstyled, accessible; exposes `data-starting-style`, `data-ending-style` and
  `--transform-origin` for correct, origin-aware motion). Verify the package name at install.
- **Styling:** Tailwind CSS v4 with design tokens as CSS variables (both themes); **cva** for component
  variants, **clsx** + `tailwind-merge` for conditional classes.
- **Supporting libraries:** Sonner (toasts, headless), Phosphor (icons), NumberFlow (countdown), zustand (client state).
- **Motion:** CSS transitions, `@starting-style` and Base UI data attributes only. **No Motion (Framer)
  dependency** in the MVP. Every animation is listed in doc 07 §7.3 with frequency, purpose, spec and a
  reduced-motion variant.

## Alternatives considered

| Option | Why not |
|--------|---------|
| shadcn/ui on Radix | Fast start, but its default look is the recognisable template aesthetic; Base UI is the curated pick and gives the motion hooks we need. |
| Full design system (MUI, Chakra, Mantine) | Heavy, opinionated visuals to fight; bundle cost. |
| Motion (Framer) for all animation | No springs, gestures or layout animations are needed; JS animation drops frames under load; adds bundle weight. |
| Hand-rolled primitives | Accessibility bugs (focus, dismissal, ARIA) are almost guaranteed. |

## Consequences

**Positive**
- Accessible behaviour from a maintained library, visuals fully ours.
- Smaller bundle; animations run off the main thread and stay smooth while the page loads.

**Negative / accepted trade-offs**
- More styling work up front than a pre-styled kit (paid once in the design-system milestone).
- `@starting-style` needs modern browsers; older ones simply skip the entrance animation.

## Revisit when

A gesture-driven interaction (drag-to-dismiss sheet, swipe carousel) or shared-layout animation is added; then introduce Motion for that component only.
