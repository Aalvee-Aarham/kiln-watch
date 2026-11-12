# Web frontend (`web/`)

**Applies to:** `fire-calendar` branch (10 Oct 2026; `main` until it is merged) · **Contract:** [data-contracts.md](data-contracts.md) · **Design rationale:** [redesign_plan.md](redesign_plan.md)

A static single-page app: no server, no map library, no runtime backend. Everything renders from the JSON export; "use my location" is matched to an area **on the device** (`lib/geo.ts`, even-odd ray-cast point-in-polygon) and never sent anywhere.

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS v4 (whose `@theme` tokens also theme the charts) · Apache ECharts 6, tree-shaken via `echarts/core` · react-router 8 with **`HashRouter`** (deep links work on GitHub Pages) · fonts bundled via Fontsource (Anek Bangla variable + IBM Plex Mono). The map, `components/BdMap.tsx`, is a **self-contained SVG choropleth** — pan/zoom/draw-box with custom cursors, no third-party tiles or library. Two NASA backgrounds can be switched on under it (Blue Marble Next Generation and Black Marble 2016): single GIBS WMS images of the analysis box in EPSG:4326, bundled from `src/assets/basemap/`, which line up with the equirectangular projection by their corners and work offline. `WorldMap` (for `#/region`) draws in degrees (x = lon, y = −lat), so NASA's world, South Asia and Bangladesh images stack by their corners; states appear below 50° of width and only those in view are drawn; city names are thinned by zoom and by collision. On My area a slider steps the map through this season week by week (live NASA data), ending on "season so far".

The one exception to "no map library" is `#/space`, which needs a 3D globe. Two engines draw the same layers, behind one interface (`components/space/types.ts`): **CesiumJS** when online, loaded from the jsDelivr CDN at runtime (pinned version with subresource-integrity hashes, matching the `cesium` devDependency that supplies the types), so its ~40 MB never enters the PWA cache; and **globe.gl** (three.js) when offline or chosen, bundled with the page's chunk. Online imagery needs no keys: NASA GIBS Blue Marble and Black Marble, and the Sentinel-2 cloudless 2024 mosaic (EOX, CC BY-NC-SA 4.0) for close views. The engines only draw; orbits, swaths, fire squares and pixel footprints are computed in `lib/space`.

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
| `#/warnings` | `WarningsPage` | Early warning: every district ranked by what needs attention now (`lib/warnings.ts`): an unusual day in the last two weeks, inside its critical period, or a critical period starting within two weeks (with the date), plus the two-week outlook when `outlook.json` ships. Reads only `nrt/current_season.json` (`last_unusual`, `critical`), `outlook.json` and the district names; rows open the Area page. No new forecast |
| `#/kilns/:unitId?` | `KilnPlannerPage` | 2012 → today season slider; start/busiest/end per area; trends |
| `#/impact/:who?/:unitId?` | `ImpactPage` | Person × district playbook — real question, data, dated actions; printable, own URL |
| `#/trust` | `TrustPage` | Every pre-registered test in plain words, failures included; country switch for the transfer results |
| `#/sensors` · `#/timeline` | `SensorsPage` · `TimelinePage` | The 2012 sensor-change puzzle; 2002→2027 events with sources |
| `#/experts` | `ExpertsPage` | Hub to the expert pages, repo, pre-registration |
| `#/region` (also `#/world`) | `RegionPage` | The world map (`WorldMap`): every country, state/province and city, opening on South Asia; search any place; the side panel shows what Kiln Watch has there: for a Bangladesh city, its district's fire season, this season, the two-week outlook and kiln season; for a division, its districts ranked by unusual days; for Pakistan, India and Afghanistan, the kiln test and its learned kiln months; elsewhere, that it is outside the study area |
| `#/space` | `SpacePage` | "Seen from space": a full-window globe (no page footer; the wheel zooms the globe) with a guided tour card (chapter tabs, Back / Next, ← → keys, `?step=` in the URL) and a video-style time bar, in three chapters — the five fire satellites' passes over any place (click the globe or search; Bangladesh by default; fire squares only in Bangladesh) on a chosen day, a season of fire-days as 0.1° columns for Bangladesh (and where the burning moves month by month), and what one MODIS/VIIRS pixel covers on the ground at any place. On load the Earth flies in from deep space; drag or a two-finger touchpad swipe turns it, a mouse wheel or pinch zooms |
| `#/ask` | `AskPage` | Ask Kiln Watch: ask with your own Gemini key (or the hosted worker when `VITE_ASK_ENDPOINT` is set); your questions and answers are saved in this browser (`lib/askHistory.ts`), each figure traced to its source (`lib/askTrace.ts`, `components/AskAnswer.tsx`). The agent stage (`components/agent/*`) finds the place in a question (`lib/regionRegistry.ts`: names, aliases, map extents, and the district or Natural Earth unit) and draws it from the export (`lib/agentEngine.ts`): the district's calendar, this season, kiln seasons, this season's fire detections from `grid/` tiles, past seasons and dated events. Places outside Bangladesh show no figures until the South Asia calendar (Amendment 5) |
| `#/news` | `NewsPage` | All stories (reached from the map's "All stories"; the News tab opens `#/news/map` and stays lit here): newspaper stories beside our data: what the paper says, what satellites saw, "How common is fire here?" with a verdict, and earlier news about fires in the same district; filters in the URL; sources and coverage panel. Shown, with its nav item, only when `news/index.json` exists. The Area page links to it in one line |
| `#/news/map` | `NewsMapPage` | Full screen (AppShell "app page": no footer, no page scroll), USGS-style: a flush sidebar of the season's stories beside the district map filling the rest; wheel/pinch zoom glides, drags coast. The world's countries surround Bangladesh (`aoi/world_countries.geojson`, NASA world + South Asia imagery), with states and provinces (`aoi/world_states.geojson`) and their names once zoomed in, zoom out to the whole world, with the country outlined bold. The map is coloured by each district's last 7 days of live-season fire (or unusual days so far). Pins sit at district centres (area-level only), sized by story count. Picking a story or pin zooms to the district and opens a card; `?story=`, `?district=`, `?season=` and `?colour=` live in the URL. "Map ⇄ All stories" links join it to `#/news` |
| `#/news/story/:season/:newsId` | `NewsStoryPage` | One story in full: the `#/news` story card plus a locator map. Reached from the card's "View more" |
| `#/crops` | `CropsPage` | Crops & harvest: a district's burning by harvest window (`splitShares`), its typical year (`components/TypicalYear.tsx`), each crop's window share (`monthsShare`), the hill districts' busiest months and, on request, their share of Aqua MODIS detections (`hillShare`); soil, smoke and health statements are cited sentence by sentence (`lib/cropSources.ts`) |

Legacy expert routes are kept so shared links survive: `#/story`, `#/explore[/:level[/:unitId]]`, `#/explore/box/:box`, `#/experts/kilns/:unitId?` (renders a StatusMessage when kilns are hidden), `#/season`, `#/evidence`, `#/method`. Everything except Home is lazy-loaded.

The header nav (`AppShell`) shows How / Area / Ask / World / Space / Impact / Trust / Kilns (the extension, when the kiln layer exists) / Experts; Sensors and Timeline are linked from the pages.

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
| `world.ts` | World-map logic, pure and tested: fitting a box into the frame, zoom limits, which cities to name at a zoom, greedy label placement, ranked place search |
| `basemap.ts` | The Map / Satellite / Night lights choice shared by both maps |
| `outlook.ts` | Today's two-week outlook for a district from `outlook.json` and the live season (mirrors `kilnwatch/ask.py two_week_outlook`); `outlookWith` takes the recent-unusual flag directly |
| `warnings.ts` | `#/warnings` levels and ranking: `nextCritical` (current or next critical window, wrapping to next season) and `warningsFor` |
| `news.ts` | News page logic, pure and tested: story grouping, filters, and the plain-language sentences for each satellite part and verdict (thresholds from `news/index.json` `rules`) |
| `plain.ts` | Plain-language numbers and dates ("early December", typical season) — pure, tested |
| `ritu.ts` | The six Bengali seasons (revised calendar) + aman/boro harvest spans |
| `url.ts` | Whole view state in the URL (`useUrlState`) |
| `chartRegistry.ts` | Live chart instances → PNG download without importing ECharts |
| `geo.ts` | Point-in-polygon for on-device geolocation; `bboxOf` for a unit's extent |
| `agentEngine.ts` | The Ask stage: `resolveQuery` (place and intent), `buildResolution` (fills the stage from passed-in export files; no figures for places outside Bangladesh), `stageCells` (map dots from `grid/` tiles) — pure, tested |
| `regionRegistry.ts` | Place names, aliases and map extents for the Ask stage, each mapped to its district or Natural Earth unit; no figures |
| `cropSources.ts` / `newsRecords.ts` | Outside statements and news reports, each with its URL and the verbatim sentence that states it; a test fails if a number in a statement is not in its quote |
| `echarts.ts` | Tree-shaken ECharts core, lazily themed |
| `space/orbit.ts` | Schematic sun-synchronous orbits for Terra, Aqua, Suomi NPP, NOAA-20/21 (design altitude, inclination, local time), anchored so the daytime pass crosses a chosen point; Sun position; swath width and pixel footprint from the viewing geometry (VIIRS on-board aggregation included) — tested against published periods, swath widths and pixel sizes |
| `space/fires.ts` | Grid tiles → fire-days (one cell, one date; sensors and passes de-duplicated) grouped into 0.1° squares, by season and day, by satellite and pass; monthly fire-weighted centres. Squares only: never single cells |
| `space/scenes.ts` | Pure builders from model state to engine layers (satellites, orbit paths, fading swaths, pass-lit fire squares, season columns) |
| `space/engine.ts` | Which globe to use (online/offline, WebGL 2, the reader's choice) and the CDN loader for CesiumJS |
| `space/places.ts` | District centres and outlines for the globe |

## `src/components`

`BdMap` (SVG map), `space/` (`SpaceStage` host with HTML labels and controls; `globeEngine` and `cesiumEngine`, one per globe; `director` runs the animation outside React and redraws each moving layer only at the rate it needs; `store` feeds the `TimeBar`s; `StoryCard`), `charts.tsx` (heatmap, normal band, source stack, kiln season/timing, PR curve, TROPOMI, PM2.5 lag, season-to-date), `EChart` (ARIA host, re-theme, colour-blind decals), `Ledger` (canvas hero), `plain.tsx` (Gloss popovers, `Provenance` source lines, Ours/Other/Caution boxes, MonthStrip, PageHead), `ui.tsx` (AppShell, `Term`, `Verdict`, `SegmentedToggle`, `useMeta`, `useKilnActivity` — a missing file means "no layer" — and `useKilnsVisible`).

## Accessibility, theming, offline

ARIA on every chart with a summary sentence; colour-blind-safe palette + decal patterns; keyboard-reachable controls with search as the map alternative; reduced-motion and forced-colors fallbacks (both e2e-tested); day/night theme booted before first paint (`index.html`). The site is fully offline-capable: the map is basemap-free SVG, fonts are bundled, so `npm run preview` serves the whole thing with no network.

## Tests

- **Vitest** (`src/**/*.test.ts`): grid parity with Python via the shared `tests/fixtures/grid_cases.json`, day/season parity, calendar aggregation, plain-language dates, ritu, theme.
- **Playwright e2e** (`e2e/smoke.spec.ts`, over `vite preview` of the built site): every route in day/night/phone layouts with zero console errors; geolocation grant/refuse; draw-a-box minimum area; evidence verdicts; the chart-hover regression; impact person×district URL rewriting; How-page step walk; Trust-page country switch.

CI runs lint, typecheck, vitest, and builds + safety-checks **all five fixture branches** — see [operations.md](operations.md).
