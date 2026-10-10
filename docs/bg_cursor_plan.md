# Kiln Watch: page ground and cursor plan

> *Historical design record — built on 6 Oct 2026 as noted inside. The cursor assets it specifies still live in `web/src/assets/cursors/`. Index: [docs/README.md](README.md).*

**Date:** 6 Oct 2026. **Status:** built on 6 Oct 2026 (see §7).

**Extends:** `ui_ux_plan.md` §4 (direction) and §9 (cursor). **Written against:** `ff1bf72`, which includes the SVG `BdMap` that replaced Leaflet.

**Skills applied:**
- `frontend-design`: one bold move, review against generic defaults.
- `emil-design-eng`: frequency gate, purpose and cost for anything that moves or follows the pointer.

## 0. Short answer

**Yes, both can improve, but by a small amount, and each change has to carry meaning.**

**Ground.** Today the page is a flat `--color-bg` (`#f3f7f9` by day, `#0e1321` at night). It is clean, but it says nothing about the subject. Every other surface in the system (the ramp, the reticle, the ritu band) is tied to satellites over Bangladesh; the ground is the one place that isn't.

**Cursors.** These are mostly right, but they have five real gaps:
- The reticle doesn't change with the theme.
- The reticle is blurry on HiDPI screens.
- Panning the map shows no grab cursor.
- Drawing an area uses a generic crosshair.
- There is no fallback for forced-colors mode.

Nothing here adds a JS cursor follower or animates the background. `ui_ux_plan.md` §4.1 rejected both, and that still holds: a background is on screen 100% of the time, so it gets no motion at all.

---

## 1. What exists now (measured, not assumed)

| Surface | Now | Source |
|---|---|---|
| Page ground | Flat `--color-bg` | `index.css:117` |
| Header | `bg/90` with `backdrop-blur-md`, hairline bottom | `ui.tsx` AppShell |
| Panels and chart plates | Opaque `--color-surface`, 1px line, 10px radius | `.panel`, `Section` |
| Buttons, options, summary, select | `pointer` (restored after Tailwind preflight) | `index.css:124` |
| Heatmaps, Ledger, kiln calendar | 24px SVG **reticle**: ink core and paper halo, the same in both themes, 1× only | `.measure`, `index.css:206` |
| Line, bar and area charts | Arrow; ECharts `axisPointer` is the cursor | §9 decision, still right |
| `BdMap` districts | `pointer` (`.bd-feat`) | `index.css:223` |
| `BdMap` empty water/background (pans on drag) | **Arrow, both idle and while dragging**: no affordance that it pans | `BdMap.tsx:155` |
| `BdMap` draw mode | Inline `el.style.cursor = 'crosshair'` | `BdMap.tsx:206` |
| Glossary terms | `help` | `.term` |
| Disabled | `not-allowed` | `index.css:125` |
| Slow fetch (> 300 ms) | `progress` on `<html>` | `data.ts` |
| Forced colors (Windows high contrast) | Reticle still drawn with fixed hex colours | nothing |

---

## 2. Ground: "survey sheet, satellite pass"

### 2.1 Idea

The instrument metaphor already says the chrome is the observer. The ground becomes the **sheet the observer draws on**. It takes two quiet structural marks, both from the vocabulary of remote sensing, never from the data.

1. **Neatline (every page, wide screens only).** On a printed survey sheet, a thin frame with graduation ticks borders the mapped area. Here, two 1px rules run down the page gutters just outside the 1200px content column, with a 6px tick every 48px. They show only where gutters exist (`min-width: 1360px`), so they never touch content or narrow screens.
2. **The pass (Story hero only).** This is the one bold move. A single broad band of slightly cooler ground crosses behind the Story headline, tilted at the **real S-NPP ground-track angle over Bangladesh**:
   - By day it is the 13:30 ascending pass, heading **N13°W**, so the band's top leans west.
   - At night it is the 01:30 descending pass. The band mirrors and its top leans east.

   Derivation: inclination 98.7°, 101.4-minute period, Earth rotation, latitude 23.7°N. The inertial heading is −9.5°, and the ground heading is **−13.1°**.

   The band's edges are fine dashed lines, which echo a sensor's scan edge. That is the satellite that made every number on the page, drawn at its true angle. Theme switching becomes "the 13:30 pass and the 01:30 pass", which is literally what the day/night split means for VIIRS.

```
 Story hero, day (band top leans west, N13°W)        Story hero, night (mirrored, S13°W pass)
┌───────────────────────────────────────────┐       ┌───────────────────────────────────────────┐
│ ░░░╲                                       │       │                                       ╱░░░ │
│  ░░░░╲  Twenty-three years of fire,        │       │  Twenty-three years of fire,        ╱░░░░  │
│   ░░░░░╲ on one honest scale.              │       │  on one honest scale.              ╱░░░░░  │
│    ░░░░░░╲ When NASA's sharper VIIRS…      │       │  When NASA's sharper VIIRS…      ╱░░░░░░   │
│ ┌──────────────── Ledger (opaque) ───────┐ │       │ ┌──────────────── Ledger (opaque) ───────┐ │
│ └────────────────────────────────────────┘ │       │ └────────────────────────────────────────┘ │
└───────────────────────────────────────────┘       └───────────────────────────────────────────┘
  ░ = swath ground (+4–6% orbit mixed into bg)   ╲ ╱ = dashed scan edge at 8% ink
```

```
 Any page, ≥ 1360px: neatline in the gutters only
 │┤                                                          ├│
 │   ┌──────────── 1200px content column ────────────────┐    │
 │┤  │ (panels, charts: opaque, untouched)               │   ├│
 │   │                                                   │    │
 │┤  └───────────────────────────────────────────────────┘   ├│
   ↑ 1px rule + 6px tick every 48px, ink at 6% (day) / 9% (night)
```

### 2.2 Rules (they decide every edge case)

1. **Never resembles data.**
   - No warm hue: the ground uses only `orbit` and `ink` mixes.
   - No dots or cells, because those read as detections or grid cells.
   - No coordinate labels on the neatline, because fake coordinates would be a false claim.
2. **Never behind data.** Charts, the Ledger, the map and tables sit on opaque surfaces already. The band lives only in the Story hero's text area, and the neatline only in gutters.
3. **Static.** No parallax and no load animation. The Ledger keeps the motion budget (§4 principle 6). The band arrives with the theme toggle's existing view-transition circle and needs no motion of its own.
4. **Contrast floor holds.** Body and muted text over the band keep their AA ratios. `muted` on `bg` is 5.6:1 today (day), and the band shifts the ground by at most ΔL 0.02. Verify by axe, not by eye.
5. **Off where it can't help.** Hidden in `print`, under `forced-colors: active` and below the breakpoints.

### 2.3 Tokens and implementation sketch

```css
@theme {
  --color-ground-rule: color-mix(in oklch, var(--color-ink) 6%, transparent);
  --color-swath: color-mix(in oklch, var(--color-orbit) 5%, var(--color-bg));
  --color-swath-edge: color-mix(in oklch, var(--color-ink) 8%, transparent);
  --swath-tilt: -13deg;               /* 13:30 ascending pass over 23.7°N */
}
:root[data-theme="night"] {           /* also mirrored in the prefers-color-scheme block */
  --color-ground-rule: color-mix(in oklch, var(--color-ink) 9%, transparent);
  --color-swath: color-mix(in oklch, var(--color-orbit) 9%, var(--color-bg));
  --swath-tilt: 13deg;                /* 01:30 descending pass */
}

/* Neatline: one non-repainting layer, never under content. */
@media (min-width: 1360px) {
  body::before {
    content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none;
    --edge: calc(50% - 600px - 24px);
    background:
      linear-gradient(var(--color-ground-rule), var(--color-ground-rule)) var(--edge) 0 / 1px 100% no-repeat,
      linear-gradient(var(--color-ground-rule), var(--color-ground-rule)) calc(100% - var(--edge)) 0 / 1px 100% no-repeat,
      repeating-linear-gradient(var(--color-ground-rule) 0 1px, transparent 1px 48px) calc(var(--edge) - 6px) 0 / 6px 100% no-repeat,
      repeating-linear-gradient(var(--color-ground-rule) 0 1px, transparent 1px 48px) calc(100% - var(--edge)) 0 / 6px 100% no-repeat;
  }
}

/* The pass: Story hero only. */
.hero-ground { position: relative; isolation: isolate; }
.hero-ground::before {
  content: ""; position: absolute; z-index: -1; pointer-events: none;
  top: -120px; bottom: 0; left: 18%; width: min(38vw, 460px);
  background: var(--color-swath);
  border-inline: 1px dashed var(--color-swath-edge);
  transform: rotate(var(--swath-tilt)); transform-origin: top center;
}
@media (max-width: 767px), print, (forced-colors: active) { .hero-ground::before, body::before { display: none; } }
```

- `body::before` is fixed and static, so it composites once with no scroll repaint. This avoids `background-attachment: fixed`, which repaints on mobile.
- The header's `backdrop-blur` will soften the neatline under it, which is fine.
- The view-transition theme reveal already snapshots the root, so the band flips its tilt inside the circle reveal and needs no extra code.

### 2.4 Defaults considered and rejected

| Default | Why rejected |
|---|---|
| Dot-grid or plus-lattice page background | The SaaS dashboard cliché, and here dots would read as fire detections or 0.01° grid cells, i.e. as data |
| Paper grain or noise (`feTurbulence`) | Generic "texture for texture's sake". It costs paint on every scroll frame in Safari, and it muddies the cloud-versus-low-fire distinction in heatmaps |
| Radial glow or gradient mesh behind the hero | Spends colour on chrome; warm versions break "heat is data" |
| Animated orbit or swath sweep on load | The Ledger owns the one orchestrated moment. A second one dilutes it and fires on every Story visit |
| Satellite or globe illustration | Literal and stock-looking. The tilt angle carries the same idea and also happens to be true |
| Real coordinate labels on the neatline | The page isn't a map. Labels would claim a geography that isn't there |

---

## 3. Cursor

### 3.1 Gate (emil: frequency and purpose)

Cursor changes fire tens to hundreds of times a session, so they get **no animation, no JS and no follower**. Each cursor must name its job:
- **State indication:** what a click or drag will do here.
- **Precision:** where exactly you are pointing.

Anything that fails both stays the system arrow. System cursors also respect OS size settings, so custom ones are limited to precision surfaces.

### 3.2 Cursor map (target)

| Surface | Cursor | Job | Change |
|---|---|---|---|
| Buttons, options, links, summary, select | `pointer` | state | none |
| Heatmaps, Ledger, kiln calendar (`.measure`) | **Reticle v2** (§3.3) | precision | theme-aware, 2×, open centre |
| `BdMap` district (`.bd-feat`) | **Reticle v2, select variant**: a centre dot marks "click picks this" | precision and state | was `pointer`; matches §9's original intent |
| `BdMap` empty ground, idle | `grab` | state: drag pans | **new** |
| `BdMap` while panning | `grabbing` on `<html>` (pointer capture keeps it over chrome) | state | **new** |
| `BdMap` draw mode | **Box cursor**: crosshair with a small bracketed square in the lower-right quadrant | state: drag draws a rectangle | was generic `crosshair` |
| `BdMap` draw mode, rectangle below 100 km² while dragging | Box cursor unchanged; the dashed rectangle and the "too small" label carry it | (none) | none; don't swap cursors mid-drag |
| Line, bar and area charts | Arrow; `axisPointer` is the cursor | (none) | none |
| Glossary terms | `help` | state | none |
| Disabled | `not-allowed` | state | none |
| Slow fetch | `progress` | state | none |
| Forced colors | `crosshair` (system) in place of every SVG cursor | accessibility | **new** |
| Touch / coarse pointer | none (no cursor) | (none) | already gated by `(pointer: fine)` |

### 3.3 Reticle v2: the spec

```
 24 × 24 CSS px, hotspot (12,12)          select variant (map districts)
        │                                         │
        │                                         │
   ─── ( ) ───      open centre: ring r=4.5,  ─── (•) ───   + 1.6px filled dot at centre
        │           ticks r=7 → r=11, so the       │
        │           cell under the hotspot         │
                    stays visible
```

- **Strokes.** The core is 1.5px. The halo is 3.5px under the core, so it reads on every fire step and on cloud.
- **Day.** Core `ink #182233`, halo `surface #fbfeff` (as today).
- **Night.** Core `#e6ebf5` (night ink), halo `#0e1321` (night bg). Today's paper halo glares on the indigo ground.
- **Ticks stop 2.5px short of the ring.** At 1–2px heatmap cells, the current ticks meeting the ring hide the neighbouring days.
- **HiDPI.** Use `image-set()` with a 1× SVG (`width="24"`) and a 2× SVG (`width="48"`, same viewBox). Chrome, Firefox and Safari pick the sharp one. Today Chrome rasterizes the single SVG at 1× and upscales it, so it looks soft on 2× screens.
- **Size stays 24px.** Cursors over 32px get dropped or clipped on Windows.

```css
@media (pointer: fine) {
  .measure, .measure canvas { cursor: image-set(url("…reticle-day-24.svg") 1x, url("…reticle-day-48.svg") 2x) 12 12, crosshair; }
  :root[data-theme="night"] :is(.measure, .measure canvas) { cursor: image-set(url("…reticle-night-24.svg") 1x, url("…reticle-night-48.svg") 2x) 12 12, crosshair; }
  .bd-feat { cursor: image-set(url("…reticle-pick-day-24.svg") 1x, url("…-48.svg") 2x) 12 12, pointer; }
  .bd-map svg { cursor: grab; }
  :root.is-panning, :root.is-panning * { cursor: grabbing !important; }
  .bd-map.is-drawing svg, .bd-map.is-drawing svg * { cursor: image-set(url("…box-24.svg") 1x, url("…box-48.svg") 2x) 12 12, crosshair; }
}
@media (forced-colors: active) { .measure, .measure canvas, .bd-feat, .bd-map.is-drawing svg { cursor: crosshair; } }
```

- **SVGs as files.** Keep them as files under `web/src/assets/cursors/`, which Vite fingerprints. Inlining them as data URIs is the alternative, but at eight variants that becomes a maintenance hazard. The night `prefers-color-scheme` block repeats the night rule, as the colour tokens already do.
- **`BdMap` code.** Replace the inline `el.style.cursor = 'crosshair'` with an `is-drawing` class on the wrapper. Toggle `is-panning` on `<html>` in `down`/`up`; `<html>` rather than the SVG, because pointer capture can carry the pointer over the header.

### 3.4 Defaults considered and rejected

| Default | Why rejected |
|---|---|
| JS cursor follower (glow, blob, lagging ring) | Costs a frame per pointer move, hides the hotspot, and is pure decoration (§4.1 again) |
| Custom arrow or pointer for the whole site | It overrides OS cursor-size and contrast settings, an accessibility regression for zero information |
| Reticle tinted by the value under it | Colour is data. A cursor that changes hue is chrome wearing data colours, and it would fail CVD |
| Magnetic buttons or cursor-snapping | It moves the target the user is aiming at |
| Coordinates readout attached to the cursor everywhere | Only the draw mode needs it (it already shows km²). Elsewhere the tooltip carries the value |

---

## 4. Rollout

| Step | Work | Files | Size |
|---|---|---|---|
| 1 | Ground tokens, neatline layer, print/forced-colors/breakpoint guards | `index.css` | XS |
| 2 | Pass band: `.hero-ground` on the Story header; tilt token per theme | `index.css`, `StoryPage.tsx` | XS |
| 3 | Cursor SVGs: reticle day/night, pick day/night, box day/night, each at 1× and 2× | `src/assets/cursors/*.svg` | S |
| 4 | Cursor CSS (§3.3) | `index.css` | XS |
| 5 | `BdMap`: `is-drawing` class instead of inline style; `is-panning` on `<html>` | `BdMap.tsx` | XS |
| 6 | Update `ui_ux_plan.md` §9 table to the new map | `ui_ux_plan.md` | XS |

About half a day in total, with no new dependency.

## 5. Acceptance checks

- **Screens.** Every route in day and night at 1366, 1440 (the neatline appears from 1360) and 390.
  - The band sits behind the hero text only.
  - The neatline never crosses a panel or chart.
  - Nothing appears at 390.
- **axe.** Zero violations, both themes. Spot-check `muted` text over the band at ≥ 4.5:1.
- **New e2e tests:**
  - **Hotspot precision.** Hover the heatmap at a known pixel, and the tooltip date equals the date computed for that pixel. This guards the 12,12 hotspot.
  - **Cursor states.** The computed `cursor` contains `url(` on `.measure` and `.bd-feat`, is `grab` on the empty map, and is the box cursor in draw mode.
  - **Forced colors** (Playwright `forcedColors: 'active'`). Every SVG cursor falls back to `crosshair`.
- **Performance.** A Chrome Performance recording of a 3-second scroll on Story shows no paint from the ground layer after the first frame.
- **Print.** Print preview shows no band and no neatline.
- **Manual.**
  - A 2× display shows a crisp reticle.
  - Windows high contrast shows the system crosshair.
  - Each cursor's hotspot is checked against 1px heatmap cells.

## 6. Open questions (defaults chosen; say if you want otherwise)

1. **Should the band carry a tiny label** ("S-NPP 13:30 pass" in 11px muted at its top edge)? Default **no**: it would read as a chart annotation.
2. **Should the neatline also appear on Explore?** Default **yes**: it is gutter-only, and Explore's columns sit inside the content width.
3. **Should the band appear on other page heroes** (Evidence, Kiln seasons)? Default **no**: one bold move, on the page that tells the story.

---

## 7. Build record

- **Built as planned.** The defaults in §6 held: no band label, the neatline on every wide page, the band on Story only.
- **One addition: the band fades out.** It used `mask-image`, fading from 45% to 92% of its height. The hard rotated bottom edge read as a tilted card and cut into the Ledger's toggle row. A swath has no end, so it now runs off under the header and fades before the Ledger.
- **One fix: the old `.bd-feat` cursor removed.** That rule (`cursor: pointer`, unlayered) overrode the layered pick cursor, so its `cursor` was removed. Touch devices still get `pointer` from the `[role=button]` base rule.
- **Cursor files.** Vite inlines all twelve cursor files as data URIs in the CSS bundle, at about 0.5 KB each. They are files only in the source.
- **One acceptance check dropped: hotspot precision (§5).** Pointer events always report the real pointer position; the hotspot only moves the picture. So no automated test can catch a wrong hotspot, and the check stays manual. The 12,12 hotspot was checked against the rendered art.
- **Tests added in `e2e/smoke.spec.ts`.** Each was verified to fail when its feature was deliberately broken:
  - "cursors say what a click or drag will do": grab, the pick cursor, `is-panning` while dragging, the box cursor in draw mode, night art different from day, and the reticle on the heatmap.
  - "forced colours fall back to system cursors and drop the page ground".
  - "page ground: band tilts with the pass, never on phones": −13° by day, +13° at night, nothing at 390px.

### 7.1 Overlap recheck (same day)

| Problem found | Cause | Fix |
|---|---|---|
| The pass band painted over the start of the demo banner text | The band reached 140px above the hero, and the isolated hero paints above unpositioned blocks such as the banner | The band starts 24px above the hero, inside `main`, and fades in at the top (`mask-image` transparent → 22%) |
| From 640 to about 880px the header wrapped to two rows (92px), which hid the Explore compact bar behind it | The third header button (patterns) plus a `flex-wrap` header | `sm:flex-nowrap`, tighter tabs below 900px (`px-1.5`, 14px), and short "Season" / "Kilns" labels below 900px |
| The compact bar was hard-coded at `top: 48px` (5px under the 53px header) | Fixed offset | AppShell publishes `--header-h` through a ResizeObserver. The compact bar, the sticky sidebar and section `scroll-margin` (phone and desktop) all use it |
| The phone nav fade dimmed "Method" even when nothing overflowed | The mask was always on below 640px | The scroll-driven `nav-fade` applies only while the row scrolls and clears at the end. Browsers without support keep the old mask |
| A long area name pushed the compact bar's section links off screen | `shrink-0` name | The name truncates at 40% width, with a `title` |
| The jump chart's "Harmonized" and "Aqua check" end labels printed on top of each other when the lines met | End labels ignore `labelLayout` | The labels are pushed apart when the end values are within about one label height (checked against forced-equal data) |

Two regression tests were added, and each was verified to fail on the old code: "compact bar sits flush under the header" (700px and 1440px) and "main nav fits without scrolling on common widths" (390, 700, 768 and 1440px).
