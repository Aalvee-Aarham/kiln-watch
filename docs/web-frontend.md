# Web frontend (`web/`)

**Applies to:** `main` @ `1314a30` (10 Oct 2026) · **Contract:** [data-contracts.md](data-contracts.md) · **Design rationale:** [redesign_plan.md](redesign_plan.md)

A static single-page app: no server, no map library, no runtime backend. Everything renders from the JSON export; "use my location" is matched to an area **on the device** (`lib/geo.ts`, even-odd ray-cast point-in-polygon) and never sent anywhere.

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS v4 (whose `@theme` tokens also theme the charts) · Apache ECharts 6, tree-shaken via `echarts/core` · react-router 8 with **`HashRouter`** (deep links work on GitHub Pages) · fonts bundled via Fontsource (Anek Bangla variable + IBM Plex Mono). The map, `components/BdMap.tsx`, is a **self-contained SVG choropleth** — pan/zoom/draw-box with custom cursors, no third-party tiles or library.

## Build modes (`vite.config.ts`)

- `base` = `/kiln-watch/` (override with `BASE_PATH`).
- `DATA_SRC=fixtures` (default) serves `web/fixtures/<FIXTURE_BRANCH>/` — default branch **`nokiln`**, the verbatim offline copy of the real export, so dev shows real data with no pipeline run. `DATA_SRC=real` serves `web/public/data/`. Nothing is copied; fixtures can never overwrite real data.
- Scripts: `dev`, `build`, `preview`, `typecheck` (`tsc --noEmit`), `lint`, `test` (Vitest, jsdom), `e2e` (Playwright).

## Routes (`main.tsx`)

Plain-language pages, organised around the four judging questions (redesign v2):

| Route | Page | What it does |
|---|---|---|
| `#/` | `HomePage` | Three findings, the satellite-to-decision Ledger hero, today's NASA data, judge guide |
| `#/how` | `HowPage` | The whole approach in six walked steps, each on real data |
| `#/area/:unitId?` | `AreaPage` | Search / tap map / geolocation → burning-season answers, kiln season, typical year, compare |
| `#/kilns/:unitId?` | `KilnPlannerPage` | 2012 → today season slider; start/busiest/end per area; trends |
| `#/impact/:who?/:unitId?` | `ImpactPage` | Person × district playbook — real question, data, dated actions; printable, own URL |
| `#/trust` | `TrustPage` | Every pre-registered test in plain words, failures included; country switch for the transfer results |
| `#/sensors` · `#/timeline` | `SensorsPage` · `TimelinePage` | The 2012 sensor-change puzzle; 2002→2027 events with sources |
| `#/experts` | `ExpertsPage` | Hub to the expert pages, repo, pre-registration |

Legacy expert routes are kept so shared links survive: `#/story`, `#/explore[/:level[/:unitId]]`, `#/explore/box/:box`, `#/experts/kilns/:unitId?` (renders a StatusMessage when kilns are hidden), `#/season`, `#/evidence`, `#/method`. Everything except Home is lazy-loaded.

The header nav (`AppShell`) shows How / Area / Impact / Trust / Kilns (the extension, when the kiln layer exists) / Experts; Sensors and Timeline are linked from the pages.

## `src/lib`

| Module | Role |
|---|---|
| `types.ts` | The data contract (authority) |
| `data.ts` | Cached `useJson`; honest > 300 ms busy cursor; static-host HTML answers treated as 404 |
| `box.ts` | Drawn-box cell math — **no grid literals**, reads `meta.grid` |
| `calendar.ts` | Sparse→dense series, split resolution, box aggregation from grid tiles, season verdicts, CSV export |
| `days.ts` | Day-index ↔ date (day 0 = 2003-01-01), season helpers |
| `i18n.ts` | `{en, bn}` UI chrome, `?lang=bn`; long-form prose stays English with a visible note |
| `theme.ts` | Reads Tailwind `@theme` CSS vars for UI + charts, literal fallbacks, day/night toggle |
| `plain.ts` | Plain-language numbers and dates ("early December", typical season) — pure, tested |
| `ritu.ts` | The six Bengali seasons (revised calendar) + aman/boro harvest spans |
| `url.ts` | Whole view state in the URL (`useUrlState`) |
| `chartRegistry.ts` | Live chart instances → PNG download without importing ECharts |
| `geo.ts` | Point-in-polygon for on-device geolocation |
| `echarts.ts` | Tree-shaken ECharts core, lazily themed |

## `src/components`

`BdMap` (SVG map), `charts.tsx` (heatmap, normal band, source stack, kiln season/timing, PR curve, TROPOMI, PM2.5 lag, season-to-date), `EChart` (ARIA host, re-theme, colour-blind decals), `Ledger` (canvas hero), `plain.tsx` (Gloss popovers, Ours/Other/Caution boxes, MonthStrip, PageHead), `ui.tsx` (AppShell, `Term`, `Verdict`, `SegmentedToggle`, `useMeta`, `useKilnActivity` — a missing file means "no layer" — and `useKilnsVisible`).

## Accessibility, theming, offline

ARIA on every chart with a summary sentence; colour-blind-safe palette + decal patterns; keyboard-reachable controls with search as the map alternative; reduced-motion and forced-colors fallbacks (both e2e-tested); day/night theme booted before first paint (`index.html`). The site is fully offline-capable: the map is basemap-free SVG, fonts are bundled, so `npm run preview` serves the whole thing with no network.

## Tests

- **Vitest** (`src/**/*.test.ts`): grid parity with Python via the shared `tests/fixtures/grid_cases.json`, day/season parity, calendar aggregation, plain-language dates, ritu, theme.
- **Playwright e2e** (`e2e/smoke.spec.ts`, over `vite preview` of the built site): every route in day/night/phone layouts with zero console errors; geolocation grant/refuse; draw-a-box minimum area; evidence verdicts; the chart-hover regression; impact person×district URL rewriting; How-page step walk; Trust-page country switch.

CI runs lint, typecheck, vitest, and builds + safety-checks **all five fixture branches** — see [operations.md](operations.md).
