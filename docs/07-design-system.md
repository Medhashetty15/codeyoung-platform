# 07 - Design System

> Status: **Final for MVP.**
> Single source of truth for visual language, motion and copy. Doc 05 covers screens and architecture;
> this doc covers how they look, move and read. Built against: `design-taste-frontend`, `emil-design-eng`,
> `animate` (+ recipes), `pick-ui-library`, `mobile-native`, `apple-design`, `minimalist-ui`,
> `high-end-visual-design`, `stitch-design-taste`, `ask-sonner`, `review-animations`.

## 1. Design read

**Reading this as:** a booking product (one landing page + a short multi-step flow) for parents in the
US and UK booking a live coding class for their child, with a calm, trust-first language that still
feels warm, leaning toward Tailwind v4 tokens + Base UI primitives + restrained, purposeful CSS motion.

Why this read:
- **Audience is parents**, often on a phone, often in the evening, deciding whether to trust a stranger
  with their child's time. Clarity and confidence beat spectacle.
- **Quiet constraint: a kids' education product.** Trust-first constraints override aesthetic preference
  (design-taste §0.A.6). No agency tricks, no scroll hijacking, no glass everywhere.
- **The product's hard problem is time.** The design's signature is how clearly it shows *when*: large,
  calm, tabular times, always with their zone.

### Dials

| Surface | DESIGN_VARIANCE | MOTION_INTENSITY | VISUAL_DENSITY | Reason |
|---------|-----------------|------------------|----------------|--------|
| Landing page | 6 | 4 | 3 | Trust-first consumer landing: offset, not chaotic; motion present but quiet. |
| Booking flow, My bookings, Account | 3 | 3 | 5 | Functional product UI used under time pressure: predictable layout, motion only as feedback. |
| Classroom page | 3 | 3 | 3 | One job (join on time); airy and focused. |

### Personality in three words

**Calm. Exact. Warm.** Calm layout and motion; exact times and states; warm copy and colour temperature.

## 2. Colour

One neutral family (Zinc), one accent (Forest), semantic colours used only for meaning.
Chosen deliberately away from the LLM defaults (AI purple/indigo, blue SaaS, beige + brass).
Green reads as growth and learning, and as "go / confirmed", which is exactly the product's success state.

### 2.1 Light theme

| Token | Name | Hex | Role | Contrast note |
|-------|------|-----|------|---------------|
| `--canvas` | Canvas | `#FAFAFA` | Page background | |
| `--surface` | Surface | `#FFFFFF` | Panels, dialogs, inputs | |
| `--surface-sunken` | Sunken | `#F4F4F5` | Skeletons, subtle bands, tray shells | |
| `--ink` | Ink | `#18181B` | Primary text | 17.7:1 on surface |
| `--ink-muted` | Muted ink | `#52525B` | Secondary text, metadata | 7.7:1 on surface |
| `--ink-faint` | Faint ink | `#71717A` | Disabled labels, large meta only | 4.8:1 on surface |
| `--line` | Hairline | `#E4E4E7` | Dividers, panel borders | decorative |
| `--line-control` | Control edge | `#8A8A93` | Input, slot and checkbox borders | 3.4:1 (WCAG 1.4.11) |
| `--accent` | Forest 700 | `#166A4E` | Primary CTA, selected slot, focus ring, links | white text 6.5:1 |
| `--accent-hover` | Forest 800 | `#11573F` | CTA hover/active | |
| `--accent-tint` | Forest wash | `#E7F3EE` | Selected slot fill, confirmed badge fill | |
| `--accent-ink` | Forest ink | `#0F4E39` | Text on accent tint | 8.5:1 on tint |
| `--danger` | Brick | `#B42318` | Errors, destructive actions | 6.5:1 on surface |
| `--danger-tint` | Brick wash | `#FDECEA` | Error banners | |
| `--on-danger` | On brick | `#FFFFFF` | Text on danger fills (danger button) | 6.5:1 on danger |
| `--caution` | Amber ink | `#8A4B08` | Zone-mismatch warnings | 6.2:1 on tint |
| `--caution-tint` | Amber wash | `#FEF3E2` | Warning banners | |

### 2.2 Dark theme

| Token | Hex | Notes |
|-------|-----|-------|
| `--canvas` | `#0E0E10` | Off-black, never `#000` |
| `--surface` | `#17171A` | |
| `--surface-sunken` | `#1F1F23` | |
| `--ink` | `#F4F4F5` | Off-white, never `#FFF` |
| `--ink-muted` | `#A1A1AA` | |
| `--ink-faint` | `#8B8B94` | |
| `--line` | `#2A2A2F` | |
| `--line-control` | `#6B6B73` | 3.4:1 on surface |
| `--accent` | `#3DBE8B` | Text on accent uses `#08261B` |
| `--accent-hover` | `#52CB9A` | |
| `--accent-tint` | `#12291F` | |
| `--accent-ink` | `#7FDDB5` | |
| `--danger` / `--danger-tint` | `#F97066` / `#2A1413` | |
| `--on-danger` | `#1F0A08` | Dark text on the coral danger fill |
| `--caution` / `--caution-tint` | `#FDB022` / `#2A1E0A` | |

### 2.3 Rules

- **Accent lock:** Forest is the only accent on every screen. Status badges use neutrals + icon + text,
  except `Confirmed` (accent tint) and errors (danger). No blue links, no purple anything.
- **No gradients** on surfaces or text. No glows. Shadows are tinted to Zinc, never pure black.
- **Colour never carries meaning alone:** every state also has text and/or an icon ("Full", "No classes").
- **Theme:** follows `prefers-color-scheme` by default; manual System / Light / Dark switch in the account
  menu and footer. One theme per page, sections never invert. An inline script in `index.html` applies
  the saved theme before first paint (no flash). `theme-color` meta per scheme matches the header surface.
- **Reduced transparency / high contrast:** under `prefers-reduced-transparency` the translucent header
  becomes solid; under `prefers-contrast: more` hairlines switch to `--line-control`.

## 3. Typography

| Role | Face | Why |
|------|------|-----|
| Display + UI | **Figtree Variable** (SIL OFL 1.1, `@fontsource-variable/figtree`, bundled) | Geometric but humane; warmer than Geist, less generic than Inter / Plus Jakarta. Reads well at small sizes on phones. Replaced Satoshi for licence reasons ([ADR 0016](adr/0016-replace-satoshi-with-figtree.md)). |
| Mono (reference codes only) | **JetBrains Mono** (`@fontsource-variable/jetbrains-mono`) | `CY-7K3Q9P` must be unambiguous when read over the phone. |

Banned: Inter, Roboto, Open Sans, Arial as the brand face; any serif (this is product UI, not editorial).

### 3.1 Scale (rem, 16px root)

| Token | Size / line-height / tracking / weight | Use |
|-------|----------------------------------------|-----|
| `display` | `clamp(2.25rem, 1.6rem + 2.6vw, 3.5rem)` / 1.05 / -0.03em / 700 | Landing hero headline only |
| `h1` | 2rem (1.75rem < 640px) / 1.15 / -0.02em / 700 | Page titles |
| `h2` | 1.375rem / 1.25 / -0.01em / 700 | Section titles |
| `h3` | 1.0625rem / 1.35 / 0 / 500 | Group titles ("Evening"), card titles |
| `time-xl` | 1.75rem / 1.1 / -0.02em / 700, tabular | The selected class time in summaries |
| `body` | 1rem / 1.6 / 0 / 400 | Default |
| `small` | 0.875rem / 1.5 / 0.005em / 400 | Metadata, helper text |
| `micro` | 0.75rem / 1.4 / 0.02em / 500 | Badges only |

- Hierarchy through **weight and colour before size** (apple-design §15).
- **Times, dates, countdowns: `font-variant-numeric: tabular-nums`** so times in a grid align and
  countdown digits don't jitter. Figtree's `tnum` feature is verified in the font file.
- Body copy max 65ch. Inputs always 16px (prevents iOS zoom).
- Font loading: preload the variable woff2, `font-display: swap`, fallback `@font-face` with
  `size-adjust`/`ascent-override` computed from the Figtree and Arial files so the swap causes no layout shift (CLS < 0.1).

## 4. Space, layout, shape, depth

- **Spacing:** 4px base. Component gaps 8 / 12 / 16 / 24. App page padding `py-10` (mobile `py-6`),
  landing sections `py-24` (mobile `py-16`), `px-4` gutter on mobile, content max width 1120px.
- **Grid over flex math.** Every multi-column layout declares its < 768px collapse to one column in the same component.
- **Viewport:** `min-h-[100svh]` for the landing hero, `100dvh` for full-height app shells. Never `h-screen`.
- **Shape lock (documented rule):**
  - Controls (buttons, inputs, slot chips, date chips, menus): **10px** radius.
  - Surfaces (panels, dialogs, cards, tray inner core): **16px**.
  - Tray outer shell: **22px** (inner 16px + 6px padding, concentric).
  - Pills (`9999px`): status badges and the zone chip only. Never primary buttons.
- **Depth:** flat by default, hairline borders. Elevation only where it means something:
  - `--shadow-float`: `0 1px 2px rgb(24 24 27 / 0.04), 0 12px 32px -16px rgb(24 24 27 / 0.18)` for
    popovers, dialogs, sticky mobile bar.
  - Cards in lists have no shadow.
- **Signature element: the Time Tray.** A double-bezel container (outer `--surface-sunken` shell, 6px
  padding, hairline ring; inner `--surface` core with a 1px inset top highlight) used in exactly two
  places: the landing hero "Next free times" panel and the booking summary panel. It frames *the time*.
  Nowhere else, so it stays meaningful.
- **Z-index scale** (constants file): header 40, sticky CTA bar 30, popover 50, dialog 60, toast 70.

## 5. Iconography & imagery

- **Icons: Phosphor**, weight `regular` only, 20px default, 16px in dense rows. Components are generated from
  `@phosphor-icons/core` SVGs (`npm run icons -w @app/web`); the React package ships all six weights per icon.
  One family only. No hand-drawn SVG icons. Lucide is not used.
- **No emojis** anywhere in UI, copy or emails.
- **Avatars:** mentor and parent initials on a neutral disc. No generic person glyphs.
- **Photography:** real photos only, never div-built fake screenshots. Needed assets (see §10) are
  listed explicitly; until supplied, dev builds use labelled placeholder slots, never random stock in production.
- **The landing hero visual is a real, working component** (live "Next free times" Time Tray fed by
  the API), not an illustration. The product's value (your local times) is the hero image.

## 6. Components (Base UI + our styling)

Primitives from **Base UI** (unstyled, accessible, exposes `data-starting-style`, `data-ending-style`
and `--transform-origin` for motion). Variants via **cva**, conditional classes via **clsx** +
`tailwind-merge`. Toasts via **Sonner** (headless `toast.custom` wrapped in our own `notify()` API).

| Component | Spec |
|-----------|------|
| **Button** | Heights 44 (default) / 36 (compact, desktop only). Variants: `primary` (accent fill, white text), `secondary` (surface, `--line-control` border, ink text), `ghost` (text only, sunken on hover), `danger`. Label one line, sentence case, max 3 words for primaries. Pending state: label stays, a 14px inline spinner replaces the leading icon, width locked (no layout jump). Disabled: sunken fill + faint ink for every variant (never reduced opacity, which reads as another colour). `:active` scale 0.97. |
| **Input / Select / Textarea** | Label above, helper below label, error below input with icon. 44px height, 16px text, `--line-control` border, focus: 2px accent ring + 2px offset. No placeholder-as-label. Correct `type`, `autocomplete`, `inputmode`, `enterkeyhint`. |
| **Password field** | Show/hide toggle (button with `aria-pressed`), live policy checklist (length, not common, not your email) that turns each rule accent when met. |
| **Zone chip** | Pill, Phosphor `GlobeHemisphereWest` + "London time (GMT+1)". Opens the Zone picker. |
| **Zone picker** | Base UI Combobox in a Popover (desktop) or bottom sheet (mobile). Pinned groups: United States, United Kingdom, India; then all zones. Search by city, country, abbreviation or offset. Each row: zone label + current offset for the dates being viewed. |
| **Date chip** | 72px high, 64px minimum width (grows for "No classes"): weekday (micro), day number (h2, tabular), availability line ("4 times" / "Full" / "No classes"). States: default, selected (ink fill, canvas text), muted (unavailable, still focusable to show the day notice). |
| **Slot chip** | 48px high, time in tabular figures. States: default (surface + control edge), hover (sunken), selected (accent tint + accent edge + check icon), focus ring. |
| **Time Tray** | See §4. Header: zone chip. Body: time in `time-xl`, date in `h3`, "60 min live class". Footer: primary action. |
| **Stepper** | Three labelled states, text first: "Time", "Account", "Confirm". Done = check icon + ink, current = accent underline, upcoming = faint. No "Step 1 of 3" labels. |
| **Status badge** | Pill, micro text, icon + label: Confirmed (accent tint), Cancelled (sunken + X icon), Moved (sunken + arrow icon), Completed (sunken + check). |
| **Notice** | Inline banner with icon, title, one sentence, optional action. Tones: neutral (DST info), caution (zone mismatch), danger (errors). Never a toast for persistent info. |
| **Dialog** | Centered modal on >= 640px; bottom sheet on smaller screens. Title, one sentence, actions right-aligned (stacked full-width on mobile, primary on top). |
| **Menu** | Base UI Menu for account and "Add to calendar". Origin-aware popover. |
| **Accordion** | FAQ only. No boxes, `--line` bottom border per item, plus/minus icon. |
| **Skeleton** | Same shapes as the final layout (date chips, slot grid, booking rows). Subtle shimmer (see motion). No circular spinners for page loads. |
| **Empty state** | Icon (32px, muted), one-line title, one sentence, one action. Composed, left-aligned inside its panel. |
| **Toast** | Sonner, one `<Toaster />` at root, bottom-center on mobile (above the sticky bar and safe area), bottom-right on desktop, `theme` wired to our theme, headless custom rendering using our Notice styling. Only for transient confirmations ("Link copied", "Trial cancelled"). |
| **Countdown** | NumberFlow digits (`@number-flow/react`), tabular, respects reduced motion. |

## 7. Motion

### 7.1 Tokens

```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);       /* entrances, presses, popovers */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);   /* on-screen movement (tab indicator) */
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);    /* bottom sheets, sticky bar */
  --dur-press: 140ms;
  --dur-color: 160ms;
  --dur-popover: 200ms;
  --dur-modal: 250ms;
  --dur-sheet: 400ms;
  --dur-reveal: 600ms;                               /* landing page only */
}
```

No `ease-in` on UI. No `transition: all`. No `scale(0)`. Only `transform`, `opacity` (and `clip-path`
for reveals/indicators). UI durations stay under 300ms except sheets and landing reveals.

### 7.2 Tool choice

CSS transitions, `@starting-style`, and Base UI's `data-starting-style` / `data-ending-style` cover
every animation in the MVP. **No Motion (Framer) dependency**: nothing here needs springs, gestures or
layout animations. NumberFlow handles digits. Revisit only if a drag gesture (swipe-to-dismiss sheet) is added.

### 7.3 Inventory (every animation in the product, gated)

| # | Element | Frequency | Purpose | Spec | Reduced motion |
|---|---------|-----------|---------|------|----------------|
| 1 | Button / chip press | Tens per visit | Feedback | `:active` `scale(0.97)`, `--dur-press` `--ease-out` | Background darkens, no scale |
| 2 | Hover states | Tens per visit | Feedback | Background/border colour, `--dur-color` `ease`; only inside `@media (hover: hover) and (pointer: fine)` | Same |
| 3 | Slot select | Tens per visit | State | Fill/border colour `--dur-color`; check icon opacity 0 to 1. No movement. | Same |
| 4 | Slot grid after date change (pointer) | Tens per visit | Prevent jarring swap | Incoming grid: opacity 0 to 1 + `translateY(4px)` to 0, 160ms `--ease-out`, no stagger | Opacity only |
| 4b | Slot grid after date change (**arrow keys**) | 100+ per visit | None | **No animation** (keyboard-initiated) | Same |
| 5 | Skeleton to content | Per load | Prevent jarring swap | Content opacity 0 to 1, 160ms | Same |
| 6 | Skeleton shimmer | While loading | Status | Linear 1.4s gradient sweep via `transform` on a pseudo-element, low contrast | Static sunken fill |
| 7 | Mobile summary bar (first slot pick) | Once per visit | Spatial consistency | `translateY(100%)` to 0, 300ms `--ease-drawer`; leaves the same way in 200ms | Opacity |
| 8 | Popovers, menus, zone picker (desktop) | Occasional | Spatial (origin at trigger) | `data-starting-style`/`data-ending-style`: `scale(0.95)` + opacity, `--dur-popover` `--ease-out`, `transform-origin: var(--transform-origin)`; exit 150ms | Opacity |
| 9 | Dialog (>= 640px) | Occasional | Focus shift | `scale(0.96)` + opacity, `--dur-modal`, centered origin; backdrop opacity in sync | Opacity |
| 10 | Bottom sheet (< 640px) | Occasional | Spatial | `translateY(100%)` to 0, `--dur-sheet` `--ease-drawer`; exit same path 250ms | Opacity |
| 11 | Toasts | Occasional | Feedback | Sonner defaults (transition-based, interruptible), slide from the edge they live on | Sonner handles |
| 12 | Wizard swap (Account panel to Confirm panel) | Once per booking | Prevent jarring change | Outgoing: opacity to 0 + `blur(2px)` 150ms; incoming: `@starting-style` opacity 0 + `translateY(8px)`, 250ms `--ease-out` | Opacity |
| 13 | Tab indicator (Create account / Log in, Upcoming / Past) | Occasional | Spatial | Clip-path tab recipe (duplicated active list), 250ms `--ease-in-out` | Instant |
| 14 | Copy link button | Occasional | Feedback | Icon crossfade Copy to Check with `blur(2px)` mask, 200ms; reverts after 2s | Opacity |
| 15 | Header scroll edge | On scroll | Hierarchy | Hairline + `--shadow-float` fade in when content scrolls under, 160ms; driven by an IntersectionObserver sentinel, never a scroll listener | Same |
| 16 | Booking confirmed mark | Once per booking | Delight (rare tier) | Circle `scale(0.9)` to 1 + opacity 250ms, then check stroke draws via `stroke-dashoffset` 400ms `--ease-out`; headline fades up 8px, 80ms after | Static check, opacity only |
| 17 | Classroom countdown | Continuous | State | NumberFlow digit roll | Instant digits |
| 18 | Classroom "Live" indicator | Only while live | Real semantic state | Dot opacity pulse 2s `ease-in-out` infinite (the only perpetual loop in the product) | Solid dot |
| 19 | Landing hero entrance | First view | Hierarchy | `@starting-style` opacity + `translateY(8px)`, 500ms `--ease-out`, 60ms stagger across headline, subtext, CTA, tray | Opacity only |
| 20 | Landing section reveals | Once per section | Storytelling | IntersectionObserver (`once`, rootMargin -80px): opacity + `translateY(12px)`, `--dur-reveal` `--ease-out` | None |

### 7.4 Deliberately not animated

Focus movement, keyboard navigation, form error appearance (instant, announced via `aria-live`),
zone changes (times are data being read; they update in place), theme switch, route changes,
list reordering, number values other than the countdown.

## 8. Mobile-native baseline (ships before the first component)

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#FAFAFA" />
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0E0E10" />
<meta name="color-scheme" content="light dark" />
```

- `-webkit-tap-highlight-color: transparent` + every tappable has an `:active` state.
- `touch-action: manipulation` and `user-select: none` on buttons, chips, tabs (never on content:
  booking references and emails stay selectable).
- Inputs 16px. `type="email"`, `autocomplete="email" | "current-password" | "new-password" | "name" | "tel"`,
  `inputmode="numeric"` for age, `enterkeyhint="next" | "done"`.
- Safe areas: sticky header `padding-top: env(safe-area-inset-top)`, sticky summary bar and sheets
  `padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px))`, toasts offset above the bar.
- Date strip: native horizontal scroll with `scroll-snap-type: x mandatory`, `overscroll-behavior-x: contain`.
- Sheets' inner scroll: `overscroll-behavior: contain`. Root keeps default overscroll (the slot page
  is a document; pull-to-refresh refreshing slots is welcome).
- Never disable zoom. Hover styles only behind `(hover: hover) and (pointer: fine)`.
- Verified on real hardware (an older iPhone on Safari, a mid-range Android on Chrome) before sign-off.

## 9. Copy

**Voice:** plain, warm, specific. Talk like a helpful person at the front desk, not a brand.

Hard rules (enforced in code review and by a lint check on locale strings):
- **Zero em dashes and en dashes** in any UI string or email. Ranges use "to" ("5:00 to 6:00 PM") or a hyphen.
  `Intl.DateTimeFormat#formatRange` emits an en dash, so ranges go through our own formatter.
- **Middle dot at most once per line.**
- **No emojis.** No AI filler verbs (elevate, seamless, unleash, empower, next-gen, revolutionize).
- **Sentence case** everywhere. Primary CTAs max 3 words, one line.
- **One label per intent across the app:** booking = "Book a free trial"; auth = "Log in", "Create account", "Log out".
- **Times always carry their zone** the first time they appear on a screen.
- **Errors say what happened and what to do next**, never "Something went wrong" alone.
- **No section-number eyebrows, no "Step 1/2/3", no scroll cues, no decorative dots.**

### 9.1 Key strings

| Context | Copy |
|---------|------|
| Landing headline | Book a free coding class for your child |
| Landing subtext | Choose a time in your time zone and your child gets a live one-on-one class with a mentor. |
| Primary CTA | Book a free trial |
| Zone chip | London time (GMT+1) |
| DST notice | Clocks in London go back one hour on Sunday 25 October. Times after that are already adjusted. |
| Day fully booked | Every mentor is booked on Sunday 25 October. |
| Day without classes | There are no trial classes on Monday 26 October. |
| Next available action | Next free time: Tue 27 Oct, 5:00 PM |
| Horizon empty title | All trial classes for the next two weeks are taken |
| Horizon empty body | Join the waitlist and we will email you as soon as a time opens up. |
| Slot taken (conflict) | That time was just booked by another family. These times are still free: |
| Zone mismatch | Your device is set to New York time. Are you booking in London time? |
| Profile zone switch | Your profile uses New York time. We will switch it to London time so your emails match. |
| Child already booked | Maya already has a trial on Tue 27 Oct. |
| Confirmation headline | Leo's trial is booked |
| Confirmation body | Saturday 24 October, 5:00 PM London time. We have emailed the details to hannah@okafor.co.uk. |
| Cancel dialog | Cancel Leo's trial on Sat 24 Oct? The time will be offered to another family. |
| Login error | That email and password don't match. |
| Locked | Too many attempts. Try again in 12 minutes. |
| Session expired | You were logged out. Log in again to continue. |
| Generic failure | We couldn't reach our servers. Check your connection and try again. Reference: 7F3A-91C2 |

Fixture and demo names are realistic and locale-appropriate (parents: Hannah Okafor, Daniel Reyes,
Sophie Lindqvist; children: Leo, Maya, Arjun; mentors: Priya Raghavan, Karthik Menon, Ananya Iyer).

## 10. Asset requirements

No image-generation tool is available in this environment, so these need real assets before launch:

| # | Placement | Content | Ratio / size |
|---|-----------|---------|--------------|
| 1 | Landing "How the trial works" | A child (8 to 12) at a laptop at home in a live class, natural light, mentor visible on screen | 4:3, 1600x1200 |
| 2 | Auth pages side panel (desktop) | Parent and child together looking at a laptop, calm and warm | 4:5, 1200x1500 |
| 3 | Classroom demo tiles (optional) | Mentor portrait (real mentor, with consent) | 1:1, 512x512 |

Until provided: labelled placeholder slots (`TODO(asset-1)`), sunken fill, correct aspect ratio reserved (no CLS).

## 11. Anti-patterns (banned)

AI purple/indigo or blue-SaaS gradients; glows; pure black or white; gradient text; custom cursors;
Inter as brand face; serif in product UI; emojis; em/en dashes in copy; three equal feature cards;
centered hero; eyebrow above every section (max one on the landing page, currently zero); section numbers;
"Step 1 of 3"; scroll cues; decorative status dots (only the real "Live" indicator); fake product
screenshots built from divs; generic names ("John Doe", "Acme"); fake-precise stats; `h-screen`;
`transition: all`; `scale(0)`; `ease-in`; ungated hover; `window` scroll listeners; circular page spinners;
toasts for persistent information; placeholder-as-label; disabled zoom.

## 12. Design QA

- **Per PR (UI):** pre-flight checklist below; motion diffs reviewed with the `review-animations` bar;
  screenshots at 375px and 1280px in both themes attached.
- **Before release:** real-device pass (mobile-native §11), axe clean, Lighthouse >= 90, motion played at
  2 to 5x duration in DevTools, and a next-day fresh-eyes review.
- **Exploration:** where a component's feel is uncertain (slot picker, Time Tray), build 2 to 3 variants
  with the `prototype` skill and pick by feel, not by description.

### Pre-flight checklist

- [ ] Accent lock: Forest only; shape lock: 10 / 16 / 22 / pill rules followed.
- [ ] Every CTA readable (AA), one line, one label per intent.
- [ ] Forms: label above, helper, error below, 16px inputs, correct `autocomplete`/`inputmode`.
- [ ] Every time shows its zone on first appearance; tabular figures; ranges without dashes.
- [ ] Loading (skeleton), empty (composed), error (inline, actionable) states exist for every data view.
- [ ] Motion matches §7.3 exactly; nothing in §7.4 animates; reduced motion variant present.
- [ ] Hover gated; `:active` feedback on every tappable; safe areas respected.
- [ ] Both themes checked; no pure black/white; contrast verified.
- [ ] Copy audit: no em/en dashes, max one middle dot per line, no emojis, no filler verbs.
- [ ] No banned pattern from §11.
