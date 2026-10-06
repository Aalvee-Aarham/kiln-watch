# Kiln Watch web: UI/UX audit

**Date:** 6 Oct 2026. **Build audited:** branch `Ahnaf` at `193a395` plus the hover fix below, fixture branch `nokiln` (the live configuration), with spot checks on `full`.

## How this was checked

- Every route (Story, Explore landing, district, drawn box, Kiln seasons, This season, Evidence, Method, 404, bad unit id) was screenshotted in day 1366px, night 1366px and phone 390px.
- Every chart was hovered, and the before and after screenshots were compared pixel by pixel.
- An iPhone 13 profile tested touch tooltips.
- The keyboard path on the district page was tabbed through 30 stops.
- Download menu: Escape and click-outside behaviour.
- Scroll behaviour of the sticky panels.
- Bangla mode (`?lang=bn`).
- axe-core 4 on 8 routes in both themes (16 scans).

Fixture data is synthetic: the metric rows are identical and the map polygons are squares. Findings that depend on real data are marked **verify on real data**.

---

## Fixed in this pass

### F0. Hovering a chart erased its lines (all pages)

| | |
|---|---|
| Symptom | Hovering any line or area chart made the lines, and some filled areas, vanish. The tooltip, dots and bands stayed. Affected: Story jump chart, Season vs normal, kiln season shape, firing-season length, radar check, precision–recall, TROPOMI, PM2.5 lag. |
| Root cause | The design tokens are `oklch()`. `palette()` passed those strings straight to ECharts. zrender cannot parse `oklch`, so on hover it derived the emphasis colour from a failed parse and stroked nothing. |
| Fix | `web/src/lib/theme.ts`: `cssVar()` now resolves every token to sRGB hex once, by painting it into a 1×1 canvas. Every chart, the map and the Ledger read colours through it, so one fix covers all callers. |
| Regression test | `web/e2e/smoke.spec.ts` › "hovering a chart keeps its series drawn". It counts the harmonized line's on-screen pixels before and after hover. Broken build: 294 → 70 (fails). Fixed: 297 → 256 (passes). It reads a real screenshot, because the canvas buffer still holds strokes the compositor never shows. |

---

## Second pass: resolution of findings 1–23

Every finding below was worked through. The original descriptions follow this table, unchanged, for the record.

| # | Status | What changed |
|---|---|---|
| 1 | Fixed | `tooltip.confine: true` in the shared theme (`lib/echarts.ts`). On an iPhone 13 the tooltip now stays on screen. |
| 2 | Fixed | `EChart.tsx` passes our label as `aria.label.description`. The heatmap now reads "Calendar heatmap of daily burning activity, 2003 to 2025…". |
| 3 | Fixed | Map polygons get `tabindex="-1"` (`FireMap.tsx`). The tab path now goes from the map container to the zoom buttons, then to the breadcrumbs. |
| 4 | Fixed | The Explore header no longer shrinks. A separate compact bar (area name and section links) is `position: fixed` and fades in at 160ms. It covers only the content column, so the sticky sidebar stays visible. Page height and section positions are identical at scroll 0, 60, 200, 400 and 800. |
| 5 | Fixed | An unknown unit shows "No district has the code XX999…" with a link back to the map. `fetchJson` reports a 404, or an HTML page returned instead of JSON, as "… was not found" rather than a JSON parse error. |
| 6a | Fixed | Plain rows read "passes only if all three criteria hold". |
| 6b | Fixed | Fractions with thresholds between 0 and 1 are drawn on a 0–1 axis (`unitRange` in `EvidencePage.tsx`). |
| 6c | Fixed | The placebo row reads "observed 0 · passes if Wilcoxon p > 0.05 · p = 0.4". |
| 6d | Fixed | The skipped-check note is a closed disclosure, "One optional check was not run for this data build", with stage and reason inside. |
| 7 | Fixed (Explore) | Translated under `?lang=bn`: breadcrumbs (with Bangla division names), the summary sentence, chart legends, axis names and tooltips, month labels (`Intl` bn-BD), harvest band labels, table headers, map hints and download menu. Two things stay as before: axis tick digits are Western, and prose summaries stay English, as the i18n policy already declares. |
| 8 | Fixed | The kiln season tooltip has one header ("Jan 1–15") and one row per series. |
| 9 | Fixed | Year labels within 2 rows of the bold 2012 label are hidden. The Ledger now reads 2009 / **2012** / 2015 on desktop and 2007 / **2012** / 2015 on a phone. |
| 10 | Fixed | **a.** The narrow legend reads "Cloud · Low … High". **b.** RituBand uses Tailwind `@max-[460px]` container variants (the old CSS lost to utility classes), so on narrow screens the ticks go away and the harvest windows move up. **c.** Month labels sit at real month starts, every other month on a phone. |
| 11 | Fixed | Below `sm` the nav shows "Season" and "Kilns" for the two long tab names, so all six tabs fit at 390px. |
| 12 | Fixed | The sources stack shows whole seasons only. The summary says partial seasons are left out. |
| 13 | Fixed | The heatmap shows a crosshair with `triggerEmphasis: false` (without that, the whole row and column lit up) and a 2px ink outline on the hovered cell. |
| 14 | **Withdrawn** | On re-check, `<main>` is keyed by `location.pathname` and the boundary renders inside it, so it already resets on navigation. |
| 15 | Fixed | `useTitle()` sets titles such as "Dhaka · Explore · Kiln Watch", "Evidence · Kiln Watch" and so on. |
| 16 | Open: needs real data | No outline geometry is available in the fixtures. Check with `DATA_SRC=real` before adding a country outline. |
| 17 | Fixed | Story "Your district" is now two columns: the CTA on the left, and on the right a panel ranking the districts running above normal (bar, days, link). |
| 18 | Fixed | The season picker moved into the kiln season chart's section header, which is the only chart it affects. |
| 19 | Fixed | "N districts have…" when every listed row qualifies. "Sept" became "Sep" everywhere. League totals now carry the unit (MYD-eq). |
| 20 | Fixed | Patterns is an icon toggle in the header with `aria-pressed`, next to language and theme. |
| 21 | Fixed | "Recently viewed" items are proper buttons. The duplicate "Draw an area" is removed from the landing body. |
| 22 | Fixed | The sub-nav says "Fires and kilns", and the section is titled "Two burning seasons: fires and kilns". |
| 23 | Fixed | Holdouts are named by satellite ("S-NPP → NOAA-20"). Label sets and relaxation steps are in plain words. The gates summary defines DR and type 2. |

**Verification after the second pass:**
- `npm run lint` and `npm run typecheck`: clean.
- `vitest`: 19/19.
- 5/5 fixture builds.
- Playwright: 30/30 on `nokiln` and 30/30 on `full`.
- CI safety checks: the name grep and `kilnwatch export --check-public` both pass.
- Gzipped main chunk: 102.7 KB.

---

## Open findings (as first reported)

Severity:
- **P1:** breaks a task, misleads, or blocks a group of users.
- **P2:** visible defect or friction.
- **P3:** polish.

### P1

| # | Where | Finding | Evidence | Fix |
|---|---|---|---|---|
| 1 | All charts, phone | Tooltips are not confined. On a 390px screen they run off the left edge, and the season label reads "015-16". | iPhone 13 tap on the Story jump chart | `tooltip.confine: true` in the shared theme (`lib/echarts.ts`), one line |
| 2 | All charts | ECharts' ARIA module **overwrites** our hand-written `aria-label` with a generic auto-description such as "This is a chart. It consists of 5 series count…". Screen-reader users lose the sentence that says what the chart shows. | `aria-label` read back from the DOM after render: all 12 ECharts charts sampled had the generic text (only the canvas Ledger kept its own) | Pass the label as `aria.label.description` in `EChart.tsx` |
| 3 | Explore map | Every polygon is a keyboard tab stop with no accessible name. The fixture has 3 between "Enter coordinates" and the zoom buttons; real data would have 64 districts or about 500 upazilas before the page content. **Verify on real data.** | Tab sequence: `DIV`, then `path`, `path`, `path`, then `Zoom in` | Take paths out of the tab order (`tabindex=-1`), since search is the keyboard route and the map note already says so. Or name them and handle Enter. |
| 4 | Explore, district | The sticky header compacts on scroll and pulls the content up **69px** (document 3695px → 3626px after a 60px scroll). Whatever is under the cursor jumps, and near the threshold this can flicker between states. | `#calendar` top moved 331 → 202px for a 60px scroll | Reserve the header's height, so only its inner content shrinks, or drop the compaction |
| 5 | Bad link | A bad unit id (`#/explore/district/XX999`) shows the parser error: *"Couldn't load this data (Unexpected token '<', "<!doctype "… is not valid JSON)"*. | Screenshot of the bad-unit route | In `lib/data.ts`, treat a non-JSON or 404 response as "not found" and say *"No district or upazila has the code XX999"*, with a link to search |
| 6 | Evidence | **a.** Rows read "**All three criteria** · all hold · ✕ Fail": the threshold text reads as the result. **b.** Share and fraction tests are drawn on 0–1.2 and 0–1.5 axes, because the domain is threshold × 2. **c.** The placebo row reads "0 · Wilcoxon p > 0.05 · p = 0.4". **d.** A developer message is shown to the public: *"Skipped layers: s2score (data/static/s2_checks.csv absent)"*. | Evidence screenshots; `EvidencePage.tsx` `TestRow`, `passRange`, line 142 | **a.** Render as "Requires all three to hold". **b.** Cap the domain at 1 when the threshold is ≤ 1. **c.** Drop the value when the threshold isn't about it. **d.** Move the skipped-layers note to Method, in plain words, or hide it outside dev. |
| 7 | Bangla mode | Only the chrome is translated. Breadcrumbs, the verdict sentence, chart axes, legends and tooltips, the harvest band labels and "Hold Ctrl and scroll to zoom" stay English, so a Bangla reader gets mixed-language charts. | `?lang=bn` district screenshot | Move the chart strings and the verdict template into `i18n.ts`, and use `fmtNumber` for ticks. Story and Method prose staying English is already declared. |

### P2

| # | Where | Finding | Fix |
|---|---|---|---|
| 8 | Kiln season shape (Explore, Kiln seasons, Story) | The tooltip header is the bin index ("11"), and it repeats for each panel. | Use an axis `formatter` that maps the bin to "early Jan" etc. Use one shared header. |
| 9 | Story Ledger | Year labels collide at 2011 / **2012** / 2013, worst on phone, because the bold 2012 rule label is added on top of the odd-year labels. | Skip the odd-year label next to 2012, or put the 2012 tag on the right edge |
| 10 | Heatmap on phone | **a.** The legend's "High" label is cut off. **b.** The RituBand shows tick marks with no names, because the container query hides the labels and leaves meaningless ticks. **c.** Month labels skip unevenly ("Feb Apr Jun Jul Sep Nov"). | Wrap the visual map to two rows (or "Low → High" only), hide the ticks with the labels, and use a fixed `interval` at narrow widths |
| 11 | Phone nav | Evidence and Method sit past the right-hand fade. Nothing says the bar scrolls. | Shorter labels at < 400px, or move Evidence and Method into an overflow menu |
| 12 | Sources stack (Explore) | The first season (2002-03, data starts Jan 2003) is drawn as a full bar, so it reads as a quiet year. | Hatch, label or omit partial seasons, as the kiln calendar already does for 2011-12 |
| 13 | Heatmap | The hovered cell's emphasis border (1px ink on 1–2px cells) is invisible, so only the tooltip says which day you are on. | Show a crosshair `axisPointer` on both axes, or a ring that is 3px larger than the cell |
| 14 | App shell | `ErrorBoundary` never resets. One chart that fails to draw blanks **every** route until the page is reloaded. | Key the boundary on `location.pathname` |
| 15 | All routes | `<title>` never changes, so tabs, history and bookmarks all read "Kiln Watch — Bangladesh burning calendar". | Set the title per page, e.g. "Dhaka · Explore · Kiln Watch" |
| 16 | Explore map | No country outline, rivers or basemap: polygons float on a blank plate. On fixtures it is three squares. **Verify on real data**; the district mosaic may carry it, but the upazila level and drawn boxes have no context. | A one-path Bangladesh outline under the choropleth |

### P3

| # | Where | Finding |
|---|---|---|
| 17 | Story, "Your district" | The right half of the section is empty. "Open your district" appears twice, in the hero and here. |
| 18 | Kiln seasons | The season `<select>` sits next to the area picker but changes only the dashed line in the first chart. Its scope isn't clear. Move it into that chart's section header. |
| 19 | This season | "**3** of the 3 most active districts…" when every row qualifies. Axis "2 Sept" vs "Sep" everywhere else (en-GB month format). League "99 total" has no unit. |
| 20 | Footer | "Patterns: off" is the main colour-blind affordance, but it sits in the footer and reads like a status. A chart-level toggle beside the legend would be found. |
| 21 | Explore landing | "Recently viewed" items look like plain text. "Draw an area" appears both in the sidebar and in the body. |
| 22 | Explore sub-nav | The "Kiln seasons" tab points to a section titled "Two burning seasons: fires and kilns". Use one name. |
| 23 | Evidence copy | Unexplained internals: "type=2 detection", "DR(kiln)", "Rungs used: 0: 900, 1: 200, 2: 80", "cross sensor N J1". These need a `Term` gloss or plain wording. |

---

## Checked and clean

- **axe-core:** 0 violations on 8 routes × 2 themes.
- **Console:** no errors on 24 route × theme × width renders.
- **Layout:** no horizontal scroll at 390px.
- **Focus:** a 2px orbit focus ring on every stop in the 30-stop keyboard path.
- **Download menu:** opens, Escape closes it and returns focus to the trigger, and clicking outside closes it.
- **Sticky aside:** the sidebar sticks at 80px while the district page scrolls.
- **Heatmap:** the tooltip shows date, ritu and value, and clicking a day opens its season (e2e).
- **Navigation:** moving between routes lands at the top of the page.
- **Reduced motion:** the Ledger starts on the harmonized view.

## Verification after the fix

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `vitest run` | 19/19 |
| `vite build` × 5 fixture branches | all build |
| `playwright test` (nokiln) | 30/30, including the new hover test |
| `playwright test -g "hovering\|kilns"` (full) | 4/4 |
