---
version: alpha
name: Pocket on Otari
description: Pocket's Beebah product system (canvas, white cards, deep forest action colour) extended for the Otari AI layer. Started from the Wise analysis on getdesign.md (sage canvas, white rounded cards, one dark green action, full semantic palette) and changed to Pocket's own brand values from src/styles.css.

colors:
  canvas: "#f7f7f3"
  surface: "#ffffff"
  field: "#eef1ee"
  line: "#dde2de"
  line-strong: "#c5cdc8"
  ink: "#111513"
  ink-2: "#66706c"
  primary: "#123c32"
  forest: "#123c32"
  on-forest: "#f7f7f3"
  forest-tint: "#e7efe9"
  warn-ink: "#6f4800"
  warn-bg: "#fbf1dc"
  warn-bar: "#c98a10"
  danger-ink: "#a32c2c"
  danger-bg: "#fbeceb"
  danger-bar: "#c83c3c"

typography:
  display:
    fontFamily: Manrope, Plus Jakarta Sans, system-ui, sans-serif
    fontSize: 36px
    fontWeight: 700
    lineHeight: 40px
  h2:
    fontFamily: Plus Jakarta Sans, DM Sans, system-ui, sans-serif
    fontSize: 18px
    fontWeight: 600
    lineHeight: 24px
  body:
    fontFamily: Plus Jakarta Sans, DM Sans, system-ui, sans-serif
    fontSize: 15.5px
    fontWeight: 400
    lineHeight: 25px
  body-sm:
    fontFamily: Plus Jakarta Sans, DM Sans, system-ui, sans-serif
    fontSize: 13.5px
    fontWeight: 400
    lineHeight: 20px
  caption:
    fontFamily: Plus Jakarta Sans, DM Sans, system-ui, sans-serif
    fontSize: 12.5px
    fontWeight: 400
    lineHeight: 18px
  figure:
    fontFamily: ui-monospace, SF Mono, Menlo, monospace
    fontSize: 12px
    fontWeight: 600
    lineHeight: 18px

rounded:
  sm: 8px
  md: 12px
  lg: 16px
  pill: 999px

spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 48px

components:
  receipt-strip:
    textColor: "{colors.ink-2}"
    typography: "{typography.caption}"
    padding: "{spacing.md} 0 0"
  receipt-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xs} 10px"
  receipt-chip-ok:
    backgroundColor: "{colors.forest-tint}"
    textColor: "{colors.forest}"
    rounded: "{rounded.sm}"
  receipt-chip-warn:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn-ink}"
    rounded: "{rounded.sm}"
  receipt-chip-bad:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger-ink}"
    rounded: "{rounded.sm}"
  receipt-slip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
    rounded: "{rounded.md}"
    padding: "18px {spacing.lg} {spacing.md}"
  notice-info:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  notice-warn:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn-ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  notice-danger:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger-ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.on-forest}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: 44px
  allowance-meter:
    backgroundColor: "{colors.field}"
    textColor: "{colors.forest}"
    rounded: "{rounded.pill}"
    height: 10px
  meter-low:
    backgroundColor: "{colors.warn-bar}"
    rounded: "{rounded.pill}"
  meter-used:
    backgroundColor: "{colors.danger-bar}"
    rounded: "{rounded.pill}"
  receipt-rule:
    backgroundColor: "{colors.line-strong}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  divider:
    backgroundColor: "{colors.line}"
---

## Overview

Pocket is a chat money assistant. Open-weight models on Otari read and explain; the policy engine plus the member's tap move money. The design job of the Otari layer is to make the AI accountable the same way money is: every answer carries a receipt.

One signature: the **AI receipt**. A dashed rule under each assistant answer, then a single line of chips (model, safety check, tools), which unfolds into a receipt slip with a torn top edge, dotted leaders and monospaced figures (routing policy, model, provider, models tried, time, cost, request id). It echoes Pocket's payment receipt card.

Quiet techniques: live tool chips while Otari runs a tool; a flat allowance meter with the real 80 percent lighter-model tick; tone-tinted notices.

## Colors

- **Canvas** `#f7f7f3` page, **Surface** `#ffffff` cards, **Field** `#eef1ee` meter track and hovers.
- **Forest** `#123c32` is the one action colour (buttons, ok chips, meter fill). On canvas it is 11.4:1.
- **Ink 2** `#66706c` is the lowest text tone used by this layer (4.8:1 on canvas, 5.1:1 on white, 4.5:1 on field). `ink-3` is never used for text here.
- Warning family (`warn-ink` on `warn-bg` 7.2:1) is for degraded but safe states: backup model, assistant resting, safety check offline, models failed.
- Danger family (`danger-ink` on `danger-bg` 6.2:1) only for a stopped message, a mismatched projection or an answer that talks as if money moved.
- Routine states (allowance used up for you, not configured) are calm surface notices, never red: money still works.

## Typography

Plus Jakarta Sans for UI (DM Sans fallback, self hosted), Manrope for the page title. Figures that come from Otari (model ids, costs, timings, request ids, timestamps) are monospaced and tabular so they read as data, not prose. Labels are sentence case, untracked.

## Layout

4 px grid. Chat column max 760 px. Settings cards in an auto-fill grid of min 320 px on desktop, one column at 390. Every tap target is at least 44 px (Details, Try again, Dismiss).

## Elevation & Depth

Flat. Cards are separated by a 1 px inset ring in `line`, never by shadows. Tinted notices drop the ring.

## Shapes

Chips 8 px, slip 12 px, cards and notices 16 px, buttons pill. Pocket's chat bubbles keep their existing radii.

## Motion

Emil Kowalski timings, ease-out `cubic-bezier(.23,1,.32,1)` only:
- press 120 ms, scale .97
- receipt unfold 200 ms from scale(.95), opacity 0, origin top left
- notice entry 200 ms from scale(.95)
- sheet 250 ms
- nothing animates on chat send (runs many times a day)
- `prefers-reduced-motion: reduce` turns every animation and transition off

## Components

- **Receipt strip**: `Answered by <model>` or `Served by backup model <model>` with an `attempt N` flag; the strip rule turns amber when a backup served. Tool chips: wallet, `Read www.ecb.europa.eu`, `Computed in sandbox` (forest outline). Projection recheck ok or mismatch.
- **Receipt slip**: dotted-leader rows, values right aligned in mono. ECB answers cite "European Central Bank daily reference rates (ecb.europa.eu)".
- **Notices**: 36 px icon tile, title 15 px, body 13.5 px, retry pill 44 px, dismiss 44 px.
- **Allowance meter**: percentage in mono 22 px, 10 px track, a tick at 80 percent labelled "Lighter model from 80%" (from `src/lib/ai/otari/allowance.ts`), forest under 80, amber 80 to 99, red at 100.
- **Resilience drill**: card labelled with a Test tag, one primary button, result shown with its own receipt.

## Do's and Don'ts

- Do show only what Otari reported; "Not reported" when a header is missing.
- Do label example data on the review page.
- Don't use red for a state that leaves money working.
- Don't invent users, numbers or testimonials.
- Don't use tracked capitals, middle-dot meta strings or decorative status dots.
