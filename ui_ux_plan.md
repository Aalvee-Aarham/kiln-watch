# Kiln Watch: UI/UX plan v2, "Cool instrument, hot ground"

**Status:** implemented 2026-10-06 (P0–P7, `web/` only; the optional pipeline additions were not made). Where the build deviates from this plan, §19 records what changed and why.
Rebased onto the rewritten `main` (c310275): main's kiln-activity layer (pre-registration amendment 1: night lights / radar) is carried into this design. Its two dual-axis charts became stacked panels per §11 (see §19).
**Supersedes:** the v1 "Observatory" plan (same filename, approved and implemented earlier on 2026-10-06). v1 shipped tokens, Anek Bangla, skeletons, the combobox, the day/night themes and the chart theme. v2 keeps that foundation and fixes what v1 got wrong or left generic.
**Evidence base:** a read of every file in `web/src/`, Playwright screenshots of the `nokiln` fixture build (the branch the live site runs) in day, night and 390 px mobile, and `validate_palette.js` runs on the live tokens and on the proposed ones. Results are quoted inline.

---

## 0. Summary

1. **Fix eight things that are broken today** (§2.1) before any restyle. The worst three are on the live site. The map basemap shows *"API KEY REQUIRED"* watermarks. Every district is painted in the "cloud / not observed" colour, because `kiln_share` is `null` under `nokiln`. And the harmonized line and the kiln colour cannot be told apart by a colour-blind reader (ΔE 1.9).
2. **New concept: "cool instrument, hot ground."** The interface chrome is the cool, precise observer (survey-sheet paper, indigo ink, an "orbit" blue for selection and reference). Saturated warm colour appears only where there is fire. Fire uses a blackbody ramp that runs the right way in each theme: darker means hotter on paper, brighter means hotter at night.
3. **One memorable thing: the Ledger.** The Story hero becomes a live burning calendar (23 years × 366 days). It starts raw, with the 2012 rows visibly glowing brighter, then *settles* onto the harmonized scale. This is the pitch's money shot turned into a 1-second explanation the viewer can replay.
4. **Bengali seasons (ঋতু) as the time vocabulary.** The six ritus and the Aman and Boro harvest windows run as a band above every day-of-year axis. Under `nokiln`, that band *is* the source split, so the split explains itself.
5. **Explorer becomes a guided flow.** You land on what is burning now, pick an area in one step, get a sticky header with your view controls, click a day in the calendar to open that season, and get a one-sentence plain-language verdict.
6. **Evidence becomes a verdict ledger.** Each pre-registered test is drawn as a threshold strip that shows *how far* the observed value is from passing, not just a red FAIL chip.
7. **Motion, cursor and buttons are a system, not garnish.** There is one orchestrated moment (the Ledger). Everything else is feedback under 220 ms. A reticle cursor is used only over things you can measure. Buttons get pointer cursors back (Tailwind v4 removed them).

---

## 1. What v1 shipped, and what we keep

| Keep (works, matches the subject) | Why |
|---|---|
| Day/night themes with a pre-paint inline script (`index.html`), `useSyncExternalStore` theme store (`lib/theme.ts`) | Correct, flicker-free, and charts re-theme |
| CSS tokens read by charts at runtime (`palette()`), with a fallback table | One palette for UI and charts. v2 changes values, not the mechanism |
| Anek Bangla Variable for display | Designed for Bangla and Latin together. The installed files include a **`wdth` axis** (`wdth.css`) and **`tnum`** (checked with fontTools), and v2 uses both |
| Skeletons, `Loading` state matrix, `ErrorBoundary` with reload | Good states. v2 makes skeletons shape-matched |
| URL-as-state (`lib/url.ts`), HashRouter deep links | Shareable views are a core feature |
| Combobox `UnitSearch` with keyboard support | Keep. v2 adds a `/` shortcut and recents |
| Calendar-strip identity mark (`CalStrip`) | Right idea. v2 fixes its rendering and makes it the Ledger |
| Honesty voice (PROVISIONAL, "cloud ≠ zero", non-claims) | This is the product's character |

What v1 left generic, as the screenshots show: a red block hero with stats in a paragraph, identical rounded cards for every block (the "SaaS card kit"), mono numerals inside running prose, legend and PNG-button collisions, decal hatching over every chart, emoji-glyph icons (⬇ ☾ ☀ ▭), and a map that depends on third-party tiles.

---

## 2. Audit

### 2.1 P0: broken now (fix first, before any restyle)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| B1 | **Basemap shows "API KEY REQUIRED" watermarks** in both themes | Screenshot `#/explore/district/BD3026`; tiles from `basemaps.cartocdn.com` (`FireMap.tsx:22`) | Drop raster tiles. Render a basemap-free vector map (§12). This also makes the "works offline" pitch claim true for the map |
| B2 | **Under `nokiln`, every district is filled with the cloud colour.** `kiln_share` is `null` (`export.py:232`), and `color()` maps `null` → `p.cloud` (`FireMap.tsx:9`). The legend still says "kiln-like share low → high" (`ExplorerPage.tsx:128`) | `fixtures/nokiln/data/aoi/districts.geojson`: all `kiln_share: null` | Branch-independent map metric (§12.2). The legend is generated from the same function as the fill |
| B3 | **The harmonized series and kiln colour collide.** `--color-harm` (h 35) and `--color-kiln` (h 45) differ by ΔE 1.9 under deuteranopia and 6.7 for normal vision. Both are in the chart theme's colour order (`echarts.ts:24`) | `validate_palette.js` on the live day tokens: **FAIL** CVD, **FAIL** normal-vision floor, **FAIL** chroma (`unknown` C 0.012 reads grey). Night: the same three FAILs | New categorical set (§5.3). Validator passes in both modes |
| B4 | **Rice-harvest windows are painted in the "kiln" colour.** The split colours are positional (`p.split[k % 3]`, `charts.tsx:128`), so under `nokiln` "Aman harvest window" gets `--color-split-1 = --color-kiln` brown | `fixtures/nokiln/data/meta.json` split keys `aman, boro, other` | Colour follows the *split key*, not its index (§5.3 key → slot table) |
| B5 | **Decal hatching on every series**, including all 8,400 heatmap cells (`aria: { decal: { show: true } }`, `ui.tsx:216`). The calendar reads as diagonal noise | Explorer screenshot, both themes | Decals off by default. A "Patterns" toggle, plus automatic decals under `forced-colors` and print. Per-series decals only where the validator demands secondary encoding (§5.3) |
| B6 | **Hero calendar strip renders as a ~36 px blob, centred** (the `viewBox` 60×10 inside a `w-full h-1.5` box keeps its aspect ratio) | Story screenshot, top centre of the hero | `preserveAspectRatio="none"` on `CalStrip`, or replace it with the Ledger (§7.3) |
| B7 | **Buttons show the arrow cursor.** Tailwind v4 preflight sets `button { cursor: default }` | All `.btn` and `SegmentedToggle` | Base-layer rule (§9) |
| B8 | **Mobile navigation is cut off** ("Meth…") with no affordance that it scrolls, and lang/theme wrap to a third row | 390 px Story screenshot | Edge-fade mask and compact header (§7.6) |

### 2.2 P1: design and UX debt

| # | Finding | Where |
|---|---|---|
| D1 | Story step 2 says "each detection is labelled kiln-like, vegetation-like or unknown". The live branch (`nokiln`) says the opposite two sections later | `StoryPage.tsx:30` |
| D2 | The hero paragraph packs a Chow p-value, a coverage percentage and a CI target into one sentence, with mono numerals mid-sentence | `StoryPage.tsx:79-85` |
| D3 | Jump-chart legend collides with the "VIIRS 375 m arrives" label and the absolutely positioned PNG button. On mobile the legend overlaps the y-axis name. A marker on every point adds clutter | Story screenshots; `charts.tsx:20-29`, `ui.tsx:226` |
| D4 | TROPOMI chart is **dual-axis** (two y-scales). This is the #1 chart anti-pattern: alignment invents a correlation | `charts.tsx:192-198` |
| D5 | "This season" daily bars (~95 per view) plus a "Total" line that does not track the bar tops. The provisional state is stated three times (badge, yellow banner, red-tinted callout) | Season screenshot; `OtherPages.tsx:21-30` |
| D6 | Evidence page is a table dump. PASS/FAIL chips are 10 px and don't show *how far* a value is from its threshold | Evidence screenshot |
| D7 | Every block is a `.card` with the same radius, border and shadow, so there is no hierarchy between the page, a section and a control group | `index.css:68` and every page |
| D8 | Glyph icons (⬇ ☾ ☀ ▭ ›) render differently per OS font and have no consistent stroke | `ui.tsx`, `ExplorerPage.tsx:46` |
| D9 | Drawing a box only works with a mouse (`mousedown/move/up`, `FireMap.tsx:44-60`). Boxes of 1–100 km² are accepted by the draw handler (`> 1`), then rejected by the URL parser (`≥ 100`, `box.ts:28`), so the user only sees an error after the fact | `FireMap.tsx:59`, `box.ts:28` |
| D10 | `MapLegend` uses four hard-coded hexes that differ from the fill function and don't change at night | `ExplorerPage.tsx:126` |
| D11 | The বাংলা toggle translates only 15 nav/control strings. `<html lang="en">` never changes, so screen readers pronounce Bangla as English. `fmtNumber` (Bangla digits) exists but is unused | `i18n.ts`, `index.html:2` |
| D12 | `prefers-reduced-motion` kills *all* transitions, including colour and opacity fades that aid comprehension | `index.css:107-109` |
| D13 | Route-change animation (240 ms rise) runs on every tab click, an action users repeat tens of times | `ui.tsx:57`, `index.css:84` |
| D14 | Explorer with nothing selected shows the first six units in file order, not anything meaningful | `ExplorerPage.tsx:73` |
| D15 | Download actions are spread across three places per chart (CSV/JSON in the card header, PNG overlaid on the canvas, "Figure" on Story) | `ui.tsx:115-129, 226` |

---

## 3. Brief

**Subject.** Twenty-plus years of NASA satellite fire detections over Bangladesh, made comparable across sensors, with an honest pre-registered finding that brick kilns are *not* visible to these sensors.

**Audiences and their primary job**

| Who | Arrives via | Job to be done | Time budget |
|---|---|---|---|
| Space Apps judge | Live URL from the submission | "Is the core result real and is the tool usable?" | 2 minutes |
| Journalist or air-quality advocate (Dhaka) | Shared deep link | "Is my district burning more than usual this season?" | 5 minutes, often on a phone |
| DoE / regulator analyst | Direct link, desktop | "When are the critical periods in district X, and can I export them?" | 20+ minutes |
| Researcher | GitHub README | "How was this harmonized, and can I trust the intervals?" | Evidence and Method pages |

**Primary job of the site:** let anyone read one district's burning calendar honestly: what's normal, what's unusual, and what wasn't observed.

**The one memorable thing:** the burning calendar itself. Everything else stays quiet and disciplined.

---

## 4. Design direction: "Cool instrument, hot ground"

A polar-orbiting sensor looks down at a warm, wet delta. The **instrument** is cool, precise and indifferent: survey-sheet paper, indigo ink, thin rules, a reticle. The **ground** is where the heat is: saturated colour appears only where something is burning, and its brightness obeys physics.

**Principles**

1. **Heat is data, never decoration.** No warm gradients, warm buttons or warm hero blocks. If something is orange, it is fire.
2. **The observer is cool.** Selection, focus, links and "reference" series (Aqua check line, matched controls) use one indigo, *orbit*. In UI and charts it means the same thing: the instrument's frame of reference.
3. **Not observed is a texture, not a colour.** Cloud gets a neutral ground with a fine dot texture, so it can never be confused with "low fire".
4. **Time is Bengali time.** Day-of-year axes carry the six ritus and the two harvest windows. This adds information, not decoration: the `nokiln` source split *is* the harvest windows.
5. **Hierarchy by structure, not by boxes.** Page → section (hairline header, whitespace) → panel (raised, for interactive control groups only). Fewer cards.
6. **Spend boldness once.** The Ledger hero gets the motion budget. Everything else stays under 220 ms, or doesn't move.

### 4.1 Defaults considered and rejected

| Default I'd reach for | Why rejected | Replaced by |
|---|---|---|
| Warm cream paper with a terracotta accent (v1's day theme is close: `bg 0.975 0.002 75`, ember accent) | It is the most common generated look, and here it spends warm colour on chrome, which competes with the fire data | Cool survey paper (`#f3f7f9`); warm colour reserved for data |
| Near-black with an ember accent (v1 night) | Cliché, and the ember accent again competes with fire data | Deep indigo night (`#0e1321`), in the register of the VIIRS Day/Night Band. Fire glows on it |
| Hero = big red block with a stat paragraph and two CTAs | Template hero. The subject has a far more characteristic image: the calendar | The Ledger (§7.3) |
| IBM Plex Mono for all numbers and axes (v1) | A mono face for small data labels is a generated-page tell, and mid-sentence mono breaks reading | Anek Bangla `tnum` figures everywhere. Mono only for machine strings (git SHA, box coordinates, unit IDs) |
| Numbered 1/2/3 cards for Harmonize/Separate/Show | Not a sequence a user performs, and step 2 is false under `nokiln` | Method page keeps the numbered pipeline (it *is* a sequence). Story uses acts |
| Custom cursor-follower blob or glow | Decoration, costs a frame per mouse move, fights accessibility | Native cursors plus one reticle on measurable surfaces (§9) |
| Fade-and-rise on every section | The generic AI motion signature | One orchestrated moment; everything else is feedback |

---

## 5. Colour system

All tokens are defined in OKLCH in `index.css` `@theme`, with night overrides under `:root[data-theme="night"]`. The hex values below are the sRGB conversions used for validation and for the `theme.ts` fallbacks.

### 5.1 Chrome

| Token | Day | Night | Role |
|---|---|---|---|
| `--color-bg` | `0.975 0.005 230` `#f3f7f9` | `0.19 0.03 268` `#0e1321` | Page ground ("survey paper" / "night pass") |
| `--color-surface` | `0.995 0.003 230` `#fbfeff` | `0.215 0.03 268` `#131927` | Panels, chart plates |
| `--color-surface-2` | `0.965 0.006 235` `#f0f4f7` | `0.255 0.032 266` `#1c2232` | Control wells, table heads, skeletons |
| `--color-line` | `0.9 0.008 240` `#d9dfe3` | `0.33 0.03 266` `#2e3545` | Hairlines, grid |
| `--color-ink` | `0.25 0.035 262` `#182233` | `0.93 0.012 250` `#e2e9f0` | Text, primary button fill (day) |
| `--color-muted` | `0.5 0.025 255` `#5a6472` | `0.72 0.02 255` `#9ca5b1` | Secondary text (check ≥ 4.5:1 on `bg` and `surface`) |
| `--color-orbit` | `0.5 0.17 268` `#3a58c3` | `0.62 0.15 268` `#5f80e0` | Focus ring, selection, links, active nav, *reference* series |
| `--color-cloud` | `0.88 0.015 240` `#cfd9e1` | `0.3 0.02 250` `#262f38` | Not-observed ground (always paired with dot texture) |

**Removed:** `--color-ember` and `--color-ember-strong` as *UI* colours. Every `bg-ember` / `text-ember` in chrome moves to `ink` (primary) or `orbit` (selection/links). Grep targets: `ui.tsx`, `StoryPage.tsx`, `ExplorerPage.tsx`, `OtherPages.tsx`.

### 5.2 Fire ramp: a "semantic heat" sequential, direction chosen per theme

A blackbody runs dim red → orange → yellow-white as it gets hotter. On paper the hotter end is drawn *darker* (ink density). At night the hotter end is drawn *brighter*, like actual incandescence. Dark mode is *selected*, not flipped.

| Step | Day (low → high) | Night (low → high) |
|---|---|---|
| 1 | `0.84 0.12 85` `#eec469` | `0.38 0.12 28` `#75201a` |
| 2 | `0.74 0.16 66` `#ed9316` | `0.5 0.17 36` `#af2f02` |
| 3 | `0.63 0.19 48` `#e05a00` | `0.63 0.19 50` `#de5b00` |
| 4 | `0.51 0.18 33` `#b62b0d` | `0.77 0.16 70` `#f49f1e` |
| 5 | `0.38 0.13 25` `#79191b` | `0.9 0.1 95` `#f3de90` |

Validator (`--ordinal`): **PASS** lightness monotone and adjacent ΔL ≥ 0.06 in both themes. Two FAILs are **accepted, documented exceptions**:
- *Single hue:* hue spread is 60–67°. This is the permitted "semantic heat" multi-hue exception, and it always ships with a scale legend.
- *Light-end contrast:* step 1 is 1.6:1 against the surface. Mitigation: heatmap cells get a 1 px surface gap, zero-activity observed days are drawn in `surface-2` (distinct from step 1), and every cell has a tooltip.

`MapLegend`, `CalendarHeatmap.visualMap`, the choropleth fill and the Ledger all read the same `palette().fire`. **No hex literals outside `theme.ts`.**

### 5.3 Categorical: fixed slots, keyed by meaning

Six slots in fixed order. Colour follows the entity (split key or series role), never its index.

| Slot | Name | Day | Night | Used for |
|---|---|---|---|---|
| 1 | heat | `#dd5400` | `#ea6a09` | Harmonized series (MYD-eq), the "this season" line |
| 2 | orbit | `#3a58c3` | `#5f80e0` | Aqua-as-observed check, matched controls, reference lines |
| 3 | paddy | `#c48400` | `#c08800` | Split key `aman` (golden Aman straw, Hemanta harvest) |
| 4 | jute | `#00876d` | `#00917a` | Split keys `boro` and `veg` |
| 5 | brick | `#9a2929` | `#c04442` | Split key `kiln`, kiln clusters (full/partial branches only) |
| 6 | plum | `#9c4297` | `#c664a8` | Split keys `other` and `unknown` |
| — | raw (neutral role) | `--color-muted` + dashed | same | Raw spliced series: de-emphasised on purpose |

```ts
// theme.ts: colour follows the key, so a rebuild under another branch never repaints survivors
export const SPLIT_SLOT: Record<string, keyof Palette> = { aman: 'paddy', boro: 'jute', veg: 'jute', kiln: 'brick', other: 'plum', unknown: 'plum' }
```

**Validator results** (run with `node …/dataviz/scripts/validate_palette.js`). The OKLCH sources are in the table above.

| Co-occurring set (as charts actually draw them) | Day | Night |
|---|---|---|
| heat + orbit (Jump chart) | PASS | PASS |
| paddy + jute + plum (`nokiln` split stack) | PASS (paddy contrast WARN 2.5:1 → direct labels required) | PASS (jute↔plum CVD WARN ΔE 6.9 → **plum gets a decal + 2 px gaps**) |
| brick + jute (`full` split stack) | PASS | PASS |
| brick + orbit (Plateau chart) | PASS | PASS |
| All six, adjacent order | PASS | brick↔plum normal-vision ΔE 14.3. **Accepted:** they never co-occur (brick only exists outside `nokiln`, and `other` only inside it) |

The validator command and these sets go into §17 so any token change is re-checked.

### 5.4 Status (reserved: never a series colour)

| Status | Token | Always paired with |
|---|---|---|
| pass | `--color-ok` (jute family, L shifted) | ✓ icon + "Pass" |
| fail | `--color-err` `0.55 0.2 25` | ✕ icon + "Fail" |
| provisional / warn | `--color-warn` (paddy family) | ◐ icon + "Provisional" |
| info | `--color-muted` | ⓘ icon |

---

## 6. Typography

**One family, two widths:** Anek Bangla Variable with axes `wght` 100–800 and `wdth` 75–125. It covers Bangla and Latin with matched metrics, which is the whole point for a bilingual product. Switch the import from `@fontsource-variable/anek-bangla` (wght only) to `@fontsource-variable/anek-bangla/wdth.css`.

- **Display** (hero, page titles, big numbers): `wdth 75` condensed, `wght 640`, tight tracking `-0.02em`. The condensed cut is the type voice: tall, compressed, slightly technical, like a ledger heading.
- **UI and body:** `wdth 100`, `wght 420`; labels `wght 560`.
- **Numbers:** `font-variant-numeric: tabular-nums` (Anek has `tnum`), so CI tables align without a second family.
- **Mono (IBM Plex Mono):** only for machine strings: git SHA, `box/90.2500,…`, unit IDs, parameter keys on the Method page. Remove it from axes, CIs, dates and p-values.
- **Body fallback:** `system-ui` is removed as the primary body face. It renders Bangla in a different font on every OS (Nirmala UI, Noto, Kohinoor), which breaks the bilingual pairing.

**Scale** (major third, 1.25, 16 px base, fixed rem):

| Token | Size / line-height | Use |
|---|---|---|
| `text-xs` | 12.8 / 1.45 | Axis ticks, captions |
| `text-sm` | 14 / 1.5 | Table cells, chart notes |
| `text-base` | 16 / 1.6 (Bangla 1.75) | Body |
| `text-lg` | 20 / 1.4 | Section titles |
| `text-xl` | 25 / 1.25 | Page titles |
| `text-2xl` | 31 / 1.1 | Unit name |
| `text-display` | clamp(40, 7vw, 76) / 0.95 | Ledger headline, verdict numbers |

**Rules**
- `:lang(bn)` gets +0.15 line-height and no negative tracking. Bangla conjuncts and the matra need the room.
- Measure ≤ 68ch for prose (`max-w-[68ch]`), including chart summaries.
- No all-caps labels: the `uppercase tracking-wide` on `ProvisionalBadge` goes. No single-word colour accents in headlines. No mono mid-sentence.
- Preload the Latin and Bengali `wdth` subsets of Anek. The font budget is in §15.

---

## 7. Layout and UX flow

### 7.1 Information architecture

```
Story ─────────── the argument, 4 acts (judge path, 2 min)
Explore ───────── the tool: area → calendar → season → sources → metrics
This season ───── what is burning now (journalist path)
Kiln seasons ──── only when gate_branch ∉ {partial, nokiln}  (unchanged rule)
Evidence ──────── verdict ledger: every pre-registered test
Method ────────── pipeline, non-claims, release policy, credits
```

Every page ends with *one* next step ("Open your district", "See the evidence for this", "How it's computed"). Today pages simply stop.

### 7.2 User journeys

```
Judge (2 min)
  Story ─ Ledger autoplays raw→harmonized (1 s) ─ reads 3 verdict numbers
        ─ "Open a district" ─▶ Explore/district/<most active> ─ toggles Raw ─ sees 2012 jump in the heatmap
        ─ footer link "Evidence" ─▶ verdict ledger
Journalist (phone, shared link #/explore/district/BD3026?season=2025-26)
  Unit header (name EN+BN, verdict sentence) ─ swipe heatmap ─ tap a day ─ season chart scrolls in
        ─ Download ▸ CSV
Regulator (desktop)
  Explore ─ press "/" ─ type "রাজ" ─ Enter ─ Season layout ─ critical periods table ─ Download ▸ JSON
        ─ Draw area ─ live km² readout ─ release ─ box view ─ copy link
```

**Optional pipeline addition:** `export.py` writes `calendar/BD.json` (national), if `metrics` already aggregates nationally. Otherwise the Ledger uses the most active district and labels it as such. Never present a district as national.

### 7.3 Story: four acts

```
┌──────────────────────────────────────────────────────────────────────┐
│ Kiln Watch                     Story Explore Season Evidence Method  │
├──────────────────────────────────────────────────────────────────────┤
│  Twenty-three years of fire,                                         │  ← display, wdth 75
│  on one honest scale.                                                │
│                                                                      │
│  2003 ▒▒░░░▓▓█▓▒░  ·····························  ░▒▓██▓▒  (Bangladesh)│  ← THE LEDGER
│  …     each row a year, each cell a day; cloud = dotted               │    canvas, full width
│  2012 ███▓▓██▓▒░ ← raw rows glow brighter from here                   │
│  …                                                                   │
│  2025 ▒▓▓██▓▒░                                                       │
│        Grishma Barsha Sharat Hemanta Sheet Basanta  (ritu band)      │
│        [ Raw ◯━━● Harmonized ]   ↻ replay                            │
│                                                                      │
│  The 2012 jump shrinks to 3% of its raw size.   Open a district ▸    │
└──────────────────────────────────────────────────────────────────────┘
 Act 1  The record lies ─ Jump chart, direct-labelled (raw / harmonized / Aqua check)
 Act 2  One honest scale ─ 3 sentences + seam verdict strip (§7.5)
 Act 3  What satellites can't see ─ negative result: 0.46×, p 0.96, 0 clusters (verdict strips)
 Act 4  Your district ─ inline search + "most active this season" chips → Explore
```

- **The Ledger.** On first view, after 400 ms, the rows cross-fade from raw to harmonized, staggered top to bottom, 30 ms per row and 900 ms total. Under raw, the post-2012 rows are brighter (that's the data). Under harmonized, they match the pre-2012 rows. The toggle lets the viewer repeat it. Reduced motion: it starts on harmonized and the toggle swaps instantly. Implementation: one `<canvas>` with 2D `fillRect` per cell (~8,400 rects, under 5 ms), redrawn per frame during the 900 ms tween. No ECharts needed for the hero, so Story's first paint doesn't wait on the ECharts chunk.
- **Copy (D2).** The headline is one claim. Then one plain sentence. The statistics move to Act 2 and Evidence. Branch-aware copy (D1): under `nokiln` the "Separate" idea becomes "Split by the harvest calendar".
- **Stats as verdict strips** (§7.5), not three grey boxes with mono numbers.

### 7.4 Explorer

```
Desktop ≥ 1024                                         Mobile 390
┌───────────────┬──────────────────────────────────┐   ┌────────────────────┐
│ Search  [ / ] │ Bangladesh › Dhaka › Dhaka        │   │ ◀ Dhaka · ঢাকা  ⋯  │ sticky, compact
│ ○District ●Upz│ Dhaka · ঢাকা         1,204 kilns   │   │ Harm|Raw  Cal|Seas │
│ ▭ Draw area   │ "2024-25 ran 18 days above normal, │   ├────────────────────┤
├───────────────┤  mostly in Hemanta."               │   │ verdict sentence   │
│               │ [Harm|Raw] [Cal|Season] [Source ▾] │   │ heatmap (h-scroll  │
│   vector map  │ ─────────── sticky on scroll ───── │   │  with year labels  │
│   (districts, │ Calendar · Season · Sources · Data │   │  pinned)           │
│    rivers)    │ ┌ Every day since 2003 ─ Download▾┐│   │ season vs normal   │
│               │ │ ritu band                      ││   │ sources            │
│ legend (from  │ │ heatmap (click a day ▸ season) ││   │ metrics table      │
│  palette)     │ └────────────────────────────────┘│   │  (card list <640)  │
│               │ ┌ Season 2024-25 vs normal ──────┐│   │ [Map ▴] bottom sheet│
└───────────────┴──────────────────────────────────┘   └────────────────────┘
```

**Flow changes**
1. **Landing (`/explore`, nothing selected).** Show "Running above normal this season" (top five from `nrt/current_season.json`, already fetched by the Season page), "Recently viewed" (localStorage, try/catch) and "Draw your own area". This replaces "first six in file order" (D14).
2. **`/` focuses search** from anywhere on Explorer. Typing Bangla matches `name_bn`. No animation on the keyboard path.
3. **Unit header** is sticky. It compacts on scroll: the title drops from 31 to 20 px and the verdict sentence hides. It holds the view controls (mode, layout, source) so they stay reachable while you read the charts.
4. **Verdict sentence** is computed client-side from `cal.unusual`, `cal.critical` and the season, e.g. "2024-25 had 18 days above the 90th-percentile normal; most fell in Hemanta (mid-Oct to mid-Dec)." Plain language goes first; the charts are the proof.
5. **Linked views.** Clicking a heatmap cell sets `?season=` to that cell's season, scrolls the "Season vs normal" section into view, and marks that day with an orbit rule. The season `<select>` stays as the keyboard path.
6. **In-page index** (Calendar · Season · Sources · Data) under the sticky header, with the active section highlighted (IntersectionObserver).
7. **One Download menu per section** (CSV, JSON, PNG) in the section header. This removes the PNG overlay on the canvas (D15, D3).
8. **Box drawing** (D9): pointer events (mouse, touch and pen) with `setPointerCapture`. A live `≈ 412 km²` label rides the cursor. Under 100 km² the rectangle stays dashed and the label reads "too small (min 100 km²)", and releasing does nothing. Esc cancels. A keyboard alternative "Enter coordinates…" opens a 4-field form that writes the same canonical URL.

### 7.5 Evidence: the verdict ledger

Each pre-registered test becomes one row:

```
Seam: harmonized 2012 jump ≤ 25% of raw                                    ✓ Pass
  0 ━━━━━━━━━━━━━━━━━━━━[pass zone ≤ 0.25]┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1
     ● 0.029
Leave-one-season-out coverage in 90–97%                                    ✕ Fail (conservative)
  0.80 ━━━━━━━━━━━━━━━━━━━━━━━━[ 0.90 ░░░░░ 0.97 ]━━━━━━━━━━━━●━━━━━ 1.00
                                                       0.985 [0.982–0.987]
G1 kilns visible to VIIRS: DR ratio ≥ 3×   (log scale)                     ✕ Fail
  0.1× ━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━[ ≥ 3× ░░░░░░░░░░░ ] 10×
                        0.46×, p = 0.96
```

- Inline SVG (no chart library): a track, a shaded pass zone, the observed value with its CI whisker, and a ✓/✕ stamp with a word. It answers "how far from passing?", which the current chips cannot (D6).
- The same component appears in Story Acts 2 and 3, so the judge sees the identical visual twice.
- Detail tables (LOSO by season, holdouts, label sets) collapse under each row ("Show every held-out season").

### 7.6 Global shell

- **Header:** wordmark (corrected `CalStrip`, 12 cells), nav, then lang and theme on the right. Below 640 px: the nav row gets a right-edge fade mask (`mask-image: linear-gradient(to right, #000 85%, transparent)`) and `scroll-snap`, the active tab scrolls into view on route change, and lang/theme shrink to 36 px icon buttons on the wordmark row (B8).
- **Section structure** replaces the card kit (D7):
  - **Page:** no container chrome.
  - **Section:** a title row with a hairline under it, 48 px rhythm between sections.
  - **Panel:** `surface` with a 1 px line and radius 10, *only* for interactive groups (search rail, unit header, filters) and chart plates.
  - **Radius scale:** 4 (controls), 10 (panels), 999 (chips). Not one radius everywhere.
- **Grid:** 12-column, 1200 px max. Explorer is 320 px rail + fluid. Story stays full-bleed for the Ledger and 68ch for prose.
- **Alignment:** left-aligned throughout. Numbers right-aligned in tables. Nothing centred except the empty-state illustration.
- **Footer:** two lines in place of one long middle-dot string. Line one: "NASA Space Apps 2026: harmonizing MODIS and VIIRS hot spots." Line two: "Data build `abc123`, generated 6 Oct 2026. Outputs are inspection leads, not findings of illegality."

### 7.7 This season

- One status line (D5): the badge "Provisional" with its icon plus "updated 05 Oct 03:00 UTC". The explanation moves into a disclosure. The red-tinted callout goes.
- National chart: **weekly** stacked bars (13–52 bars, not ~95 daily) with the split slots, plus a *Total* that is the bar sum (no separate line).
- **District league:** rows link to `#/explore/district/<id>?season=<current>`. Each row has a "days above p90" bar with a numeric label, a 90-day sparkline (heat slot, 1.5 px) with its last point marked, and the season total. Below 640 px it becomes a ranked card list.

### 7.8 Method

A typeset document at 68ch. The six-step pipeline gets a single inline SVG flow diagram (FIRMS → grid → clear-land fraction → calibration chain → classifier/gates → calendars). The numbers are valid here because it *is* a sequence. Parameters go in a two-column `dl` with mono keys.

---

## 8. Components

All live in `components/ui.tsx` unless noted. No component library is added.

### 8.1 Buttons

| Variant | Look (day / night) | Use |
|---|---|---|
| **Primary** | `ink` fill, `bg` text / `ink` (light) fill, `bg` text. Weight 560 | One per view: "Open a district", "Apply area" |
| **Secondary** | `surface` fill, 1 px `line`, `ink` text | Filters, Download menu trigger |
| **Quiet** | Text only, `muted` → `ink` on hover | In-section actions, "Show held-out seasons" |
| **Icon** | 36×36 visual, 44×44 hit area (padding/inset), tooltip label | Theme, lang (as text "বাংলা"), close |
| **Segmented** | `surface-2` well, sliding `surface` thumb with a 1 px line; the active label is `ink` | Mode, layout, level |

**States (all variants)**
- **Hover** (gated with `@media (hover: hover) and (pointer: fine)`): background shift only, 120 ms `ease`.
- **Press:** `transform: scale(0.97)`, 120 ms `--ease-out`.
- **Focus-visible:** 2 px `orbit` ring, 2 px offset. Never removed.
- **Disabled:** 45% opacity and `cursor: not-allowed`.
- **Busy** (Download building a CSV): label cross-fades to a 3-dot pulse with `aria-busy`. The width is locked so the button doesn't jump.

No arrow glyphs appended to labels. Labels say what happens: "Download CSV", "Open Dhaka", "Draw an area".

### 8.2 Icons

A local `Icon` component with about 8 hand-drawn 16 px SVG paths (download, sun, moon, square-dashed, chevron, check, cross, info), stroke 1.5, `currentColor`. This replaces the ⬇ ☾ ☀ ▭ › glyphs (D8) without adding a dependency.

### 8.3 Other components

| Component | Spec |
|---|---|
| `SegmentedToggle` | One absolutely positioned thumb with `transform: translateX()`, transition 200 ms `--ease-out`. Roving `tabindex` with arrow keys (radiogroup pattern) |
| `UnitSearch` | Existing combobox, plus a `/` hint chip, recents section, matched-substring highlight (`<mark>` in orbit at 15% alpha), "No area called "xyz". Try the Bangla name or draw an area." empty state |
| `DownloadMenu` | Native `<details>` popover with origin-aware `transform-origin: top right`, 150 ms scale 0.97 → 1 plus opacity. Items: CSV, JSON, PNG |
| `VerdictStrip` (new) | §7.5. Props `{ label, value, ci?, pass: [lo, hi], scale: 'lin' \| 'log', verdict }` |
| `RituBand` (new) | §11.1. Used by the heatmap, NormalBand and the Ledger |
| `Badge` | Status only (§5.4), icon + word, sentence case |
| `Skeleton` | Shape-matched. The heatmap skeleton is a faint 23×52 grid; line charts get a faint polyline. Shimmer stays (1.2 s linear) |
| `StatusMessage` | Says what happened and what to do. Errors don't apologise. E.g. "Couldn't load Dhaka's calendar (HTTP 404). Check the link or pick another area." |
| Tables | Tabular figures, right-aligned numbers, sticky `thead`, row hover only with a fine pointer. Below 640 px, metrics tables become stacked definition cards |

---

## 9. Cursor

Cursors carry meaning. They are native or SVG only, with no JS followers.

| Surface | Cursor | Why |
|---|---|---|
| Every `button`, `[role=button]`, `[role=option]`, `[role=radio]`, `summary`, `label[for]`, `select` | `pointer` | Restores affordance that Tailwind v4 preflight removed (B7) |
| Heatmap cells and the Ledger | **Reticle** (below) | You are pointing at a measured value |
| Map, idle | `grab`, then `grabbing` while panning | Leaflet sets this; keep it |
| Map, a district under the cursor | Reticle | Clicking selects it |
| Map, draw mode | `crosshair` plus the live km² label | Precision drawing |
| Line, bar and area charts | Default arrow; ECharts `axisPointer` draws a vertical rule and the tooltip | The rule is the cursor; a second reticle would double it |
| Glossary terms (MYD-eq, p90, LOSO, Chow) | `help`, dotted underline, popover definition | Teaches the vocabulary in place |
| Disabled | `not-allowed` | |
| Data fetch > 300 ms after a user action | `progress` on `<html>` | Honest feedback for the slow first calendar load |

**Reticle** (24×24, hotspot at the centre, ink stroke with a paper halo so it reads on both themes and on any cell colour):

```css
@media (pointer: fine) {
  .measure { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cg fill='none' stroke-linecap='round'%3E%3Cg stroke='%23fbfeff' stroke-width='3.5'%3E%3Ccircle cx='12' cy='12' r='5'/%3E%3Cpath d='M12 1v5M12 18v5M1 12h5M18 12h5'/%3E%3C/g%3E%3Cg stroke='%23182233' stroke-width='1.5'%3E%3Ccircle cx='12' cy='12' r='5'/%3E%3Cpath d='M12 1v5M12 18v5M1 12h5M18 12h5'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") 12 12, crosshair; }
}
```

ECharts sets `cursor` on its canvas per element. Pass `cursor: 'inherit'` on the heatmap series and put `.measure` on the `EChart` host.

---

## 10. Motion

### 10.1 Tokens

```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);      /* enter, press, feedback */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);  /* on-screen morphs (thumb, Ledger) */
  --dur-press: 120ms; --dur-quick: 160ms; --dur-base: 220ms; --dur-explain: 900ms;
}
```

`ease-in` is never used on UI. `transition: all` is never used (today `.btn` uses `transition-colors`, which is fine; keep it explicit).

### 10.2 Inventory

| # | Element | Trigger | Motion | Duration / easing | Reduced motion |
|---|---|---|---|---|---|
| M1 | **Ledger raw → harmonized** | First view, toggle, replay | Per-cell colour tween, row stagger 30 ms | 900 ms total, `--ease-in-out` | Instant swap |
| M2 | Button press | `:active` | `scale(0.97)` | 120 ms `--ease-out` | Keep (no travel) |
| M3 | Segmented thumb | Change | `translateX` | 200 ms `--ease-out` | Instant |
| M4 | Download menu, combobox list | Open | `scale(0.97)` → 1 + opacity, origin at the trigger | 150 ms `--ease-out`; close 100 ms | Opacity only |
| M5 | Route change | Nav | **Opacity 0 → 1 only, 160 ms** (was 240 ms with an 8 px rise; D13) | `--ease-out` | Opacity only |
| M6 | Theme toggle | Click | View Transitions API circular `clip-path` reveal from the toggle button | 400 ms `--ease-out` (rare action) | Plain 160 ms cross-fade |
| M7 | Heatmap first render | Data ready | Row cascade (existing `animationDelay`, now 25 ms per row) | ~600 ms | None |
| M8 | Heatmap mode/split change | Toggle | ECharts colour update, no cascade | 300 ms | None |
| M9 | Line charts first render | Data ready | ECharts draw-in | 400 ms `cubicOut` | None |
| M10 | Map selection | Pick | Existing orbit-outline pulse ×2 | 900 ms | Static outline |
| M11 | Sticky unit header compaction | Scroll past 120 px | Title `scale(0.65)` from origin left, verdict opacity 0 | 200 ms `--ease-out` | Instant |
| M12 | Count-up | Ledger headline numbers only | Existing `CountUp` | 600 ms | Final value |
| M13 | Linked-view day marker | Heatmap click | Orbit rule fades in; section scrolls (`scroll-behavior: smooth`) | 220 ms | `auto` scroll |
| M14 | Skeleton shimmer | Loading | Existing | 1.2 s linear | Static |
| M15 | Download busy | Click | Label blur(2px) + opacity cross-fade to dots | 200 ms | Opacity |

**Never animated:** keyboard-initiated actions (`/` focus, arrow keys in the combobox, Esc), card hovers, section entrances on scroll, tooltips after the first one (ECharts `transitionDuration: 0.12`).

**Reduced motion (D12):** replace the global "everything 0.01 ms" kill with targeted rules. Remove transforms and travel, keep opacity and colour transitions ≤ 160 ms, and pass ECharts `animation: false` (already wired via `reduced`).

---

## 11. Charts

These apply to `components/charts.tsx` and `lib/echarts.ts`. Each chart is checked against the dataviz anti-pattern list.

### 11.1 Shared changes

- **Theme** (`ensureChartTheme`):
  - `fontFamily` → Anek Bangla, with tabular numbers on axes.
  - Axis labels in `muted` 12.8 px, axis names in `muted` 12 px sentence case.
  - Grid lines solid `line` at 60% (no dashed vertical lines on category axes).
  - Colour order = the §5.3 slots.
- **No `symbol` on line points** unless the series has fewer than 15 points (Jump keeps 6 px markers on Aqua only).
- **Direct labels** at the right end of each line for ≤ 4 series (`endLabel`). The legend still exists but moves to a single row *under* the title, in HTML rather than the canvas, so it never collides (D3).
- **Tooltip template:** date + ritu → value with unit → "vs normal: p78" when known → sensor era. Values formatted through `fmtNumber(v, lang)`, so Bangla digits appear under `?lang=bn`.
- **`RituBand`:** a 14 px HTML/SVG band aligned to the plot's x-range (read `grid.left/right`). Six ritus with names (Bangla primary, English in the tooltip), and Aman (mid-Nov → Dec) and Boro (mid-Apr → May) harvest windows as paddy and jute brackets. Used on the heatmap, NormalBand and the Ledger.
- **Data view:** each section's Download menu gains "View as table", a `<details>` with the chart's data. This is the accessibility alternative and the honest fallback.
- **Decals:** off by default (B5). Enabled when `matchMedia('(forced-colors: active)')` matches, for print, or by a "Patterns" toggle stored in localStorage. The `plum` split always carries a decal at night (validator WARN, §5.3).
- **Heights:** 320 for primary, 240 for small multiples, heatmap `rows × 18 + 64`.

### 11.2 Per chart

| Chart | Change |
|---|---|
| `JumpChart` | Raw = `muted` dashed 1.5 px with no markers. Harmonized = heat 2.5 px with the band in heat at 18% alpha. Aqua check = orbit 1.5 px with 6 px markers. Replace the `markLine` label with an annotation bracket at 2012 reading "raw jump 55 → harmonized 1.6". End labels instead of a crowded legend. Mobile: x labels every 4th season, no rotation |
| `CalendarHeatmap` | Remove the decal. Cloud cells = `cloud` + dot pattern (single-cell `itemStyle.decal` on `v < 0` cells only; if heatmap decal support is missing, draw cloud as a `custom` series layer). 1 px surface gap between cells. `RituBand` above. Year labels pinned while the plot scrolls horizontally on mobile. Click → linked view (§7.4) |
| `NormalBandChart` | Band = heat ramp step 1 at 35% alpha. Median = `muted` dotted. Season line = heat. Unusual days = 7 px dots with a 2 px surface ring. Critical periods labelled in-plot ("critical: Hemanta peak") with no unlabelled red wash. Add a "today" rule when the season is current |
| `SourceStackChart` | Colours by split key (§5.3). 2 px surface gap between stack segments. Rounded top only on the topmost segment. Legend uses `meta.split_labels` in the active language |
| `SeasonToDateChart` | Weekly bins. The stack is the total, so the "Total" line goes (D5) |
| `SeasonDurationChart` | Brick only when a kiln page exists. Policy `markLine` labels wrap and alternate top/bottom to avoid collisions |
| `TropomiChart` | **Remove the dual axis (D4).** Two vertically stacked small multiples sharing the month x-axis: NO₂ belt − ring (muted bars), then the activity index (heat line) |
| `Pm25LagChart` | Diverging around r = 0 with a zero baseline in `ink`. Add CI whiskers if `r_*.lo/hi` exist. Two slots per branch (paddy + plum under `nokiln`, brick + jute otherwise) |
| `PRCurveChart` | Prevalence `markLine` in `muted` dashed, labelled in-plot. Fill under the curve at 10% for area intuition |
| `RadiusSweepChart` | Brick vs orbit, 2 px gap between grouped bars, value labels on hover only |
| `Sparkline` | Heat stroke 1.5 px, last point dot 3 px, `aria-label` with the min/max/last values |

---

## 12. Map

### 12.1 Basemap-free vector map (B1)

- Drop `TileLayer`. Set the map background to `bg`. Districts are filled per §12.2 with `line` strokes at 0.6 px. The selected district gets an orbit stroke at 2.5 px plus the existing pulse.
- Add a soft halo for the country outline (the union of districts, drawn twice: 4 px `surface` underlay, then 1 px `muted`).
- *Optional:* major rivers (Padma, Jamuna, Meghna) from Natural Earth (public domain), simplified to under 30 KB, drawn in `cloud` at 1.2 px. Rivers make the delta readable without labels.
- Labels: district names appear at zoom ≥ 8 as Leaflet tooltips (permanent, `muted` 11 px). At zoom 7, names appear on hover only.
- Night needs no tile swap; the tokens handle it. The `key={theme}` remount of the GeoJSON stays.
- Remove the CARTO attribution and keep "© OpenStreetMap" only if OSM-derived data remains (the HDX boundaries carry their own credit on the Method page).

### 12.2 What the fill encodes (B2)

The metric has to exist under every gate branch.
- **Default, no pipeline change:** district level only. Fill = `above_p90_days` this season from `nrt/current_season.json` on the heat ramp, with a legend "days above normal this season, 0 → max". At upazila level, show outlines only plus the note "Upazila colours need a data build with season totals."
- **Optional pipeline addition (one line in `export.py:232`):** add `h_last` (harmonized total of the last complete season) to the unit properties for both levels. Update `types.ts:UnitProps`, the `test_contracts.py` required keys under all five fixture branches, and the fixture generator. The fill then works at both levels and in every branch.
- `kiln_share` fill stays available as a second layer option only when `gate_branch ∈ {full, nightfire}`.
- The legend is built from the same `fillFor(value, palette)` function as the polygons (D10).

### 12.3 Interaction

- Hover: raise the stroke to `ink` 1.5 px. The tooltip shows "Dhaka · ঢাকা, 4 days above normal".
- Click selects (unchanged). Keyboard users get the search combobox; the map is `aria-hidden` with a visible note "Use search to pick an area by keyboard".
- `scrollWheelZoom` stays off. Add a "Hold Ctrl to zoom" hint on wheel (the native Leaflet gesture-handling pattern, about 10 lines).
- Mobile: the map lives in a bottom sheet ("Map ▴"), opened on demand, so the calendar is first on small screens.

---

## 13. Copy and i18n

| Where | Now | Proposed |
|---|---|---|
| Story hero | Two-line headline + 3-statistic paragraph | "Twenty-three years of fire, on one honest scale." + "When NASA's sharper VIIRS sensor arrived in 2012, recorded fire appeared to quadruple overnight. It didn't. Kiln Watch puts every satellite on one scale." |
| Story CTAs | "Explore your district →" / "What's burning this season" | "Open your district" / "See this season" |
| Story step 2 (`nokiln`) | "Each detection is labelled kiln-like…" | "Split by the harvest calendar: Aman, Boro, and everything else. (Satellites can't see the kilns. See Evidence.)" |
| Explorer empty | "Pick an area to see its burning calendar" | "Start with an area" + above-normal chips + recents |
| Draw button | "▭ Draw your own area" / "Drag on the map… (Esc to cancel)" | "Draw an area" / "Drag to draw · min 100 km² · Esc cancels" |
| Box error | "The box must cover at least 100 km²." (after navigation) | Prevented at draw time; the parser error stays only for hand-edited URLs |
| Evidence intro | "Failures are shown, not hidden." | Keep it. It's the brand voice |

**i18n (D11)**
- `document.documentElement.lang` follows `?lang`, set in `AppShell`.
- Route every UI-chrome string through `useT()`. That's about 60 strings: buttons, headers, legends, tooltips, empty and error states.
- Numbers go through `fmtNumber` (Bangla digits under `bn`).
- Long-form Story and Method copy stays English with a visible note "এই অংশটি এখনো ইংরেজিতে" ("this section is still in English") until translated. That's honest, not silently mixed.
- Split labels already ship `label_bn`.

---

## 14. Accessibility

- **Contrast:** body text ≥ 4.5:1 and large text/UI ≥ 3:1 in both themes. Verify `muted` on `bg` *and* on `surface-2` (table heads).
- **Identity is never colour alone:** a legend is always present for ≥ 2 series, plus direct labels, dash patterns (raw dashed, median dotted), and status icons with words.
- **Keyboard path for every action:** nav → skip link "Skip to content" (new) → search (`/`) → segmented controls (arrow keys) → section index → Download menu → table view. The box draw has its coordinates-form alternative.
- **Live regions:** mode/layout/source changes announce "Showing harmonized, calendar-year layout" via `aria-live="polite"`. The verdict sentence updates in the same region.
- **Targets:** ≥ 44×44 px on `(pointer: coarse)`. Hover styles gated to `(hover: hover)`.
- **Charts:** `role="img"` with an `aria-label` that states the takeaway, not the chart type (e.g. "Harmonized activity is flat across 2012; raw jumps from 116 to 508"). The table view is the full alternative.
- **`forced-colors`:** decals on, borders on panels, focus ring uses `Highlight`.

---

## 15. Performance budgets

| Item | Budget | Note |
|---|---|---|
| Story first paint | No ECharts on the critical path | The Ledger is canvas 2D; Jump/Plateau charts lazy-mount on intersection |
| Fonts | ≤ 120 KB woff2 total (Anek `wdth` Latin + Bengali subsets) | Preload both. `font-display: swap`. Drop the Plex Mono 600 weight (400 is enough for machine strings) |
| ECharts chunk | Unchanged (tree-shaken in `lib/echarts.ts`). Add `CustomChart` only if heatmap cell decals need it | |
| Map | Vector only; removes all tile requests | +≤ 30 KB if rivers are added |
| Ledger animation | ≤ 5 ms per frame | 8,400 `fillRect` calls; precompute colour lerps per cell once |

---

## 16. Roadmap

Each phase leaves `npm run typecheck`, `lint`, `test -- --run` and `e2e` green, under all five `FIXTURE_BRANCH` values.

| Phase | Scope | Files | Acceptance | Est. |
|---|---|---|---|---|
| **P0: broken things** | B1–B8, D4, D9 (draw-time min area), D10, `html lang` | `FireMap.tsx`, `ExplorerPage.tsx`, `charts.tsx`, `ui.tsx`, `theme.ts`, `index.css`, `i18n.ts` | Map shows no watermark and no cloud fill under `nokiln`; validator passes on new sets; no decal on heatmap; 390 px nav shows a fade; every button shows the pointer; TROPOMI is two panels | 1 day |
| **P1: tokens and type** | §5, §6; ember-as-UI removed; Plex Mono limited to machine strings | `index.css`, `theme.ts` (+fallbacks, `SPLIT_SLOT`), `theme.test.ts`, `echarts.ts`, `package.json` (anek `wdth` import only) | `grep -rn "#[0-9a-f]\{6\}" web/src --include=*.tsx` returns nothing outside `theme.ts`; contrast table recorded in `VERIFICATION.md` | 1 day |
| **P2: components and cursor** | §8, §9, `Icon`, `DownloadMenu`, `VerdictStrip`, `RituBand`, section structure replacing `.card` | `ui.tsx`, `index.css`, all pages | Keyboard-only pass of every route; reticle only on `.measure`; pointer on every control | 1 day |
| **P3: Explorer flow** | §7.4 (landing, sticky header, verdict sentence, linked views, section index, pointer-event draw + coordinates form) | `ExplorerPage.tsx`, `FireMap.tsx`, `url.ts`, `calendar.ts` (+ verdict helper and test) | Journeys in §7.2 complete without a mouse and on a 390 px viewport; e2e adds "click heatmap cell → season param set" | 1.5 days |
| **P4: Story and Ledger** | §7.3, copy §13 | `StoryPage.tsx`, new `components/Ledger.tsx` | Ledger animates once, toggles, and replays; reduced motion → instant; Story LCP doesn't wait on the ECharts chunk | 1 day |
| **P5: Evidence, Season, Method** | §7.5, §7.7, §7.8 | `EvidencePage.tsx`, `OtherPages.tsx` | Every pre-registered test is a `VerdictStrip`; Season has one provisional statement; league rows link to Explore | 1 day |
| **P6: chart kit** | §11 | `charts.tsx`, `echarts.ts` | Every chart passes the anti-pattern list: no dual axis, no legend collisions at 390/1366, direct labels, table view | 1 day |
| **P7: motion and QA** | §10, §14, §15 | `index.css`, `ui.tsx`, `main.tsx` | Motion inventory matches §10.2; reduced motion verified; screenshots for 3 viewports × 2 themes × `full`/`nokiln` reviewed | 0.5–1 day |
| *Optional pipeline* | `h_last` unit property, `calendar/BD.json` | `export.py`, `types.ts`, `test_contracts.py`, fixtures | Contract tests pass under all five branches | 0.5 day |

---

## 17. Verification

```bash
# palette: re-run on any token change (sets from §5.3; exit code 1 on FAIL)
node <dataviz-skill>/scripts/validate_palette.js "#dd5400,#3a58c3" --mode light --surface "#fbfeff"
node <dataviz-skill>/scripts/validate_palette.js "#c48400,#00876d,#9c4297" --mode light --surface "#fbfeff"
node <dataviz-skill>/scripts/validate_palette.js "#c08800,#00917a,#c664a8" --mode dark --surface "#131927"
# web checks under each gate branch
cd web && for b in full partial nightfire nokiln from2012; do FIXTURE_BRANCH=$b npm run build || exit 1; done
npm run typecheck && npm run lint && npm test -- --run && npm run e2e
```

- **Screenshot review.** Extend `e2e/smoke.spec.ts` to capture 390 / 768 / 1366 px in day and night (`localStorage.kwTheme`), and review them by eye for label collisions and overflow. The validator checks colour, not layout.
- **Reduced motion.** Playwright `page.emulateMedia({ reducedMotion: 'reduce' })`. Assert the Ledger renders the harmonized state immediately.
- **Forced colours.** `page.emulateMedia({ forcedColors: 'active' })`. Assert decals are on.
- **Accessibility.** Run the `ui-checker` agent before the demo. Do a manual screen-reader pass of Explorer in `?lang=bn` (`lang` attribute set).

---

## 18. Not doing (and when to reconsider)

- **Motion/Framer Motion, GSAP, D3, a component kit or an icon library.** CSS transitions, WAAPI, ECharts and about 8 inline SVG paths cover everything above. Reconsider only if gesture-driven sheets need spring physics.
- **Scroll-jacked scrollytelling.** The Ledger plus four static acts carries the story without hijacking scroll.
- **Custom JS cursor followers, blend-mode cursors or magnetic buttons.** They're decoration that costs a frame per mouse move.
- **Compare-two-districts mode, map time-slider, PWA offline cache.** Worth doing after the hackathon. The URL state already supports a `compare=` param if wanted.
- **Kiln locations or any site-level layer.** Never public (release policy, `CLAUDE.md`). This plan adds none.

---

## 19. Implementation record (2026-10-06)

All phases P0–P7 shipped in `web/`. Checks: `npm run lint`, `typecheck` and `vitest` (18 tests) pass. All five fixture branches build. Playwright passes 26 tests under both `nokiln` and `full`: 7 routes × (day, night, 390 px) with no console errors and no horizontal scroll, plus reduced motion, `/` search, heatmap → season link, refused small box, and verdict strips. Contrast pairs in §14 are all ≥ 4.5:1 for text in both themes. The validator passes the shipped sets in §5.3.

**Deviations from the plan, with reasons**

| Plan | Built | Why |
|---|---|---|
| Anek `wdth` axis for all display text (§6) | `wdth` face for **Latin only** (`Anek Display`, +100 KB). Bangla display text uses the existing `wght` face | The Bengali `wdth` file is 448 KB. Total fonts are ~300 KB woff2 (Bengali wght 156, Latin wght 43, Latin wdth 100, Plex 400 only), not the ≤ 120 KB in §15, which was unrealistic for Bengali glyph coverage |
| Normal-range band on the fire ramp (§11.2) | Band uses `--color-band` in the **orbit** family | A normal range is a *reference*. Principle 2 (the observer is cool) applies, and at night the heat band read as a heavy maroon wash under the heat line |
| Night orbit `0.62 0.15 268` | `0.665 0.14 268` | Link text needs ≥ 4.5:1 on night `bg` (now 5.95), and the validator's dark lightness band caps at 0.67. 0.68 failed it |
| Cloud cells with a dot texture (§11.2) | Cloud = cool neutral `--color-cloud`, plus legend and tooltip ("Not observed (cloud)") | Per-cell decals on an 8,400-cell ECharts heatmap aren't reliable. The cool-vs-warm hue split already separates cloud from low fire |
| 1 px surface gap between heatmap cells | Zero-activity observed days = the plate (`surface-2`), which differs from fire step 1 | At 366 columns a cell is ~1.8 px wide, so a gap would erase it |
| Sticky header compaction animated 200 ms (M11) | Instant; header is sticky only from 640 px | Scroll-triggered and frequent fails the animation gate. On phones a sticky control block would cover too much of the screen |
| Ledger as a per-frame rAF tween (§7.3) | Raw canvas underneath, plus one harmonized canvas per year row whose **opacity** transitions (260 ms `--ease-in-out`, 30 ms row stagger) | The cheapest tool: CSS transitions run off the main thread, are interruptible, and reuse the existing easing token |
| Country halo + rivers on the map (§12.1) | Not built | Optional in the plan. The map works without them and adds no data dependency |
| Upazila fill without a pipeline change (§12.2) | Upazila level uses `kiln_share` where a branch publishes it; otherwise outlines plus a note | As planned. `h_last` export remains the upgrade path |
| Story ECharts off the critical path (§15) | `EChart` moved to its own module; Story and Season charts are `React.lazy` | Main chunk went from **950 KB → 310 KB** (ECharts is now a 669 KB lazy chunk), which also clears the existing > 900 KB build warning |

**Merged from `main` (kiln activity, amendment 1):** `useKilnActivity`/`useKilnsVisible`, `KilnSeasonShapeChart`, `KilnCalendarHeatmap`, `KilnTimingChart`, the Kiln seasons page, Evidence's channel table and held-out tests (now verdict strips), Explorer's "two burning seasons" section and the Story twist. `KilnSeasonShapeChart` (kiln excess + fire activity) and the radar check used two y-axes on one plot; both are now two panels sharing the time axis (§11.1). The kiln calendar uses the fire ramp instead of hard-coded hexes.

**Added beyond the plan:** a glossary `Term` (native `<abbr title>`, help cursor) for MYD-eq, p90, LOSO, Chow and PR-AUC. A "Copy link" action on drawn areas. The draw-size readout flips sides near the map edge.
