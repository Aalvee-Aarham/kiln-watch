# Plan: real data everywhere — replace every dummy value, keep every feature

> **Executor instructions.** Follow this plan phase by phase, step by step. Run every verification command and
> check its expected result before moving on. On any STOP condition, stop and report; do not improvise. Do not
> commit, push or open a PR unless the operator asks. When a phase is done, update the status table in section 1.
>
> **Drift check (run first, from the repo root):**
> `git diff --stat 8f1c9a6..HEAD -- web/src web/e2e kilnwatch data/static docs/amendment5_draft.md docs/PREREGISTRATION_AMENDMENTS.md`
> If any file named in section 3 changed, re-read it and compare with the excerpts there. A change that contradicts
> this plan is a STOP condition.

## 1. Status

| Field | Value |
|---|---|
| Planned at | commit `8f1c9a6`, branch `Ahnaf`, 2026-10-13 |
| Priority | P1 for Phases A–D (before judging on 13 Nov 2026); Phase R after its gate |
| Effort | Phases A–D and E: L (about 4–5 days for one person); Phase R: L–XL (it is roadmap step F9 in practice) |
| Risk | MED: many pages touched; sourcing outside figures needs care (section 6) |
| Category | direction / data integrity |

| Phase | What | Gate | Status |
|---|---|---|---|
| A | Shared real-data helpers | none | DONE 2026-10-13 |
| B | Ask stage: Bangladesh places on real data | A | DONE 2026-10-13 (news records start empty: none verified yet) |
| C | Crops page on real data | A; web access for C5 | DONE 2026-10-13 (22 cited statements, 9 sources) |
| D | Sensors page detection threshold from a published source | web access | DONE 2026-10-13 |
| E | Docs, labels, offline copy | B, C, D | DONE except E3: BLOCKED — no published release has `kiln_activity.transfer` (Amendments 2–4), so a refresh would drop real results; the live site lacks them too until the export is re-published |
| R | Ask stage: the 57 places outside Bangladesh on real data | **Amendment 5 agreed and committed (a person)** | BLOCKED until the gate |

## 2. The rule, and why

**Nothing is removed.** Every page, section, card, chart, component, preset question, place and test stays. Only
the data changes: each dummy value is replaced by real data, from one of three kinds of source, in this order of
preference:

1. **Kiln Watch's own export** (`web/public/data/` on the live site; `web/fixtures/<branch>/data/` offline), read by
   existing helpers or by new, unit-tested code.
2. **Curated public records the repo already holds**, each with its source URL: `data/static/crop_calendar.csv`,
   `data/static/policy_events.csv` and `data/static/satellite_events.csv`, published as `events.json`.
3. **Published sources** (FAO, peer-reviewed papers, government reports, news articles) for facts the export does not
   measure, such as soil chemistry or worker exposure. Each figure is cited on the page with a link, and the exact
   sentence that states it is recorded in the code and checked by a test (section 6). This is how the Impact page
   already handles outside figures (`web/src/pages/ImpactPage.tsx:91`, `:138`, with `SRC.wb` and `SRC.doe`).

A value that has no real source **yet** is shown as an honest empty state ("measured data for this place arrives
with …"), never as a made-up number. This plan has exactly one such case: places outside Bangladesh, until Phase R
(section 5, Phase R explains why).

Why it matters: the project is judged on validity, and its own rules (`CLAUDE.md`) say public output comes from the
pipeline. Today two pages show typed-in numbers under an "Illustrative example" label (section 3).

Team rules that apply throughout:
- **No new Bangla / i18n content.** New strings are English, written inline (as `AskPage.tsx` does), not added to
  `web/src/lib/i18n.ts`. Existing Bangla is left alone.
- `CLAUDE.md` invariants, in particular: 3 (no kiln ids, cluster ids, candidate flags or kiln coordinates under
  `web/`), 5 (no test reads `data/raw` or `data/interim`), 6 (functions taking a coordinate pair name them `lat` and
  `lon`), 8 (tests assert closed-form properties, pre-registered values or published references, never current
  output), 9 (explicit maxima on loops), 10 (no grid literals in TypeScript).

## 3. Current state: every place real data is not used

Line numbers are at `8f1c9a6`.

### 3.1 Ask page demo stage (`#/ask`, rendered at `web/src/pages/AskPage.tsx:181` and `:183-192`)

| # | File | Dummy content today | Real replacement (phase) |
|---|---|---|---|
| S1 | `web/src/lib/regionRegistry.ts` (8,501 lines; 121 places: 64 Bangladesh districts, 57 places in 33 other countries) | Per place: `normalCurve`, `thisSeasonCurve` (8 typed numbers each), `defaultMultiplier`, `criticalWeeks`, `criticalSpan`, `months`, `news` (121 items with a `source` name but **no URL**), `contextNote`; `coords` and `bbox` typed by hand | Bangladesh: each district entry points at its real unit (`unit_id`), and every figure is computed from its calendar and the live season (B). Elsewhere: each entry points at a Natural Earth state or country, and figures come from Phase R. Names and aliases are kept |
| S2 | `web/src/lib/agentEngine.ts` | `parseUserQuery()` copies the registry figures; the fallback profile for unknown places (`:95-128`, curves `[80, 240, 850, 620, 280, 130, 70, 30]`, 1.4×, a fixed bbox near Bangladesh, a made-up FIRMS news item); `normalP90 = normal × 1.35` (`:164`); headlines `"Yes, 1.4× the normal for this week"` (`:166-168`); fixed step texts (`:177-202`) | Same function names and `AgentResolution` fields, filled from real data (B2) |
| S3 | `web/src/components/agent/AgentAnimatedChart.tsx` | A fixed SVG path for the "normal" curve; the "this season" spike height computed from the multiplier (`:59-79`) | Same component and animation, drawn from real monthly series (B4) |
| S4 | `web/src/components/agent/AgentAnimatedMap.tsx` | 140 seeded random dots around the place (`:151-183`) and the typed list `NASA_FIRMS_HOTSPOTS_LAND` (`:20-40`) with 3 jittered dots each (`:185-202`) | Bangladesh: this season's real fire detections from `grid/` tiles (B5). Ambient dots: Phase R |
| S5 | `web/src/components/agent/AgentStepperPanel.tsx` | Coverage claim "All 64 districts of Bangladesh, all states of India, and Southeast Asia" (`:85`); four steps always shown as done | The same four steps, each with its real source file, date and state (B6) |
| S6 | `web/src/components/AgentNewsCanvas.tsx` | "Historical fire precedents and news" cards from S1, and a "N Documented Records" badge | The same canvas filled with real records: the area's own past seasons, dated events from `events.json`, and news items that have a verified URL (B7) |
| S7 | `web/src/components/agent/AgentCinematicStage.tsx:83`, `:142-146`; `AskPage.tsx:162`, `:187` | "Illustrative example" labels | A source line naming the files used (B8, E1) |

### 3.2 Crops page (`#/crops`, `web/src/pages/CropsPage.tsx`, 301 lines, in the main nav)

| # | Where in `CropsPage.tsx` | Dummy content today | Real replacement (phase) |
|---|---|---|---|
| C-a | `:64` | "Illustrative example" label | Source line (C8) |
| C-b | Header cards, `:66-100` ("Harvest Timing", "Soil & Carbon Damage", "Worker Health & Smoke") | Uncited claims, e.g. "SOC < 1.0%", "doubled fertilizer requirements" | Kiln Watch figures where the export measures them; cited figures otherwise (C2) |
| C-c | `CROPS_META`, `:21-55`, four crops (rice, wheat, jhum, sugarcane) | `season`, `timingMechanism`, `satelliteDetection`, `soilImpact`, `risk`: typed text with uncited numbers ("10–14 day window", "250°C", "top 3 cm", "88%", "1.0%", "15 years to 2–4 years") | Season windows from cited crop calendars; burning in each window computed from the area's calendar; prose figures cited (C3, C4) |
| C-d | Soil bullets, `:155-160` | "> 2.5% down to < 0.8%", "up to 80% of nitrogen and 25% of phosphorus" | Cited figures (C5) |
| C-e | Jhum section, `:173-207` | "88% of Bangladesh wildland fires", "Pre-monsoon peak (March – April)", "3 weeks", "15–20 years down to 2–4 years" | 88% → share computed from the grid tiles; the peak → computed from the three hill districts' calendars; fallow figures cited (C6) |
| C-f | Worker health, `:209-240` | "PM2.5 > 600 µg/m³", health effects, interventions | Cited figures and recommendations; plus Kiln Watch's own PM2.5 result from `validation.json` where present (C7) |
| C-g | Satellites, `:242-299` | "Terra 2000 – Present", "Suomi NPP 2012 – Present", "10:30 AM", "1:30 PM", "2017 – Future" | Dates from `events.json` `satellite` (with links); overpass times cited (C8) |

### 3.3 Elsewhere

| # | Where | Today | Action |
|---|---|---|---|
| X1 | `web/src/pages/SensorsPage.tsx:136-166` | A drawing of one 3 km field with 9 fires; the detection threshold "0.1%" is labelled illustrative (`:138`) | Keep the drawing; take the threshold and the two fire sizes from published detection limits (Phase D) |
| X2 | `web/src/pages/HowPage.tsx:93-99` | A to-scale drawing: 1 km MODIS pixel, 375 m VIIRS pixels | Already real (published pixel sizes). No change |
| X3 | `web/fixtures/nokiln/` | Real data, but frozen: export `f2bf67d`, live season to 6 Oct 2026; the default for `npm run dev` (`web/vite.config.ts:10`) | Refresh (E3) |
| X4 | `web/fixtures/{full,from2012,partial,nightfire}/` (`kilnwatch/fixtures.py`) | Synthetic data sets, one per pre-registered gate outcome, built in CI only; the live site uses `DATA_SRC=real` (`.github/workflows/deploy.yml:61`) | **Keep.** They are test input, not displayed data: `CLAUDE.md` invariants 5 and 8 require synthetic input for tests. Section 8 explains |
| X5 | `web/src/lib/agentEngine.test.ts`, `web/src/lib/autonomousBattery.test.ts` | They assert the typed registry values (e.g. `multiplier` 2.1, news titles), which breaks invariant 8 | Keep both files and every case; change what each case expects to properties of the real computation (section 7) |

Already real, no action: Home, Area, Explorer, Timeline, Story, Evidence, Trust, Kiln seasons, Kiln planner, World map,
Experts, and the Impact page (its outside figures are cited). The Ask page's saved answers, bring-your-own-key chat and
hosted worker already use only the export.

## 4. Real data available

Paths are relative to the data root: `dataUrl(path)` (`web/src/lib/data.ts:5`), `useJson<T>(path)` (`:35`),
`fetchJson<T>(path)` (`:16`). Types: `web/src/lib/types.ts`.

| File | Type | Fields used | Notes |
|---|---|---|---|
| `aoi/districts.geojson`, `aoi/upazilas.geojson` | `FC` | `unit_id`, `name_en`, `name_bn`, `level`, `division`; geometry | 64 districts, 507 upazilas. COD-AB spellings: **Chattogram** (`BD2015`), Bogura, Barishal, Jashore, Cumilla, Cox's Bazar, Chapainababganj |
| `calendar/<unit_id>.json` | `Calendar` | `h` aligned to `days` (sparse day indices since 2003-01-01), `split` (`aman`, `boro`, `other`), `normal.{p10,p50,p90}` (366 values per day of season; 0 = 1 July), `unusual`, `critical`, `seasons[]`, `nodata` | Districts and upazilas; 100–180 KB each. `h` is a **rate** (harmonized Aqua-MODIS-equivalent detections per 1,000 clear cells), not a count |
| `nrt/current_season.json` | `NrtSeason` | `season`, `day0` (`2026-07-01`), `updated_at`, `era`, `sensor`, `national.{h,split}`, `districts[id].{h, above_p90_days}` | **Districts only**; an upazila uses its district (`districtOf()`, `web/src/lib/geo.ts:24`). Provisional |
| `kiln_activity.json` | `KilnActivity` | `areas[id].seasons`, `transfer.countries` | 44 districts have kiln seasons (Dhaka `BD3026`, Rajshahi `BD5081` and Gazipur `BD3033` among them). Transfer countries `PK`, `IN`, `AF` are country-level |
| `events.json` | `Events` | `harvest[]` (`crop`, `start_doy`, `end_doy`, `url`), `policy[]`, `satellite[]` (`date`, `label_en`, `url`) | Built from `data/static/*.csv` by `kilnwatch/export.py:270-279`. `satellite` lists launches (Aqua, Suomi NPP, NOAA-20, NOAA-21; no Terra launch row) and end dates: Suomi NPP new data end 2026-11-02, Terra planned end 2027-01-01, Aqua planned end about 2027-09-01 |
| `meta.json` | `Meta` | `split_labels`, `grid`, `generated_at`, `git_sha`, `data_versions` | `useMeta()` (`web/src/components/ui.tsx:10`) |
| `harmonization.json` | `Harmonization` | `selected_model`, `seam.ratio` | Used to state on the stage what "harmonize" did |
| `validation.json` | `Validation` | `pm25?` (`lag`, `r_kiln`, `r_veg`) | Optional field; show only when present |
| `grid/<lon>_<lat>.json` | `GridTile` | `rows: [cell, day, sp][]` | Every fire detection on the 0.01° grid, 2003 to the last export day; 27 tiles, 2.5 MB. **Sensor of a row: `Math.floor(sp / 2)`: 0 Terra, 1 Aqua, 2 Suomi NPP, 3 NOAA-20, …; pass: `sp % 2`** (as `aggregateBox` decodes it, `web/src/lib/calendar.ts:81-82`). Already public (`ExplorerPage.tsx:387` draws it); not a kiln layer |
| `aoi/world_states.geojson`, `aoi/world_countries.geojson`, `aoi/world_cities.json` | `FC` / city table | `unit_id` (e.g. `IND-20012`), `name_en`, `adm0`; geometry; city `lat`, `lon` | Natural Earth, public domain. Geography only: no fire values outside Bangladesh exist in the export today |

Helpers to reuse, not re-implement:

| Helper | File | Gives |
|---|---|---|
| `seasonMean(cal)` | `web/src/lib/calendar.ts:30` | Typical year: mean per day of season |
| `seasonVerdict(cal, season)` | `web/src/lib/calendar.ts:99` | One season in words: unusual days, main ritu, days not observed |
| `busyMonths(perDay)`, `SEASON_MONTHS`, `MONTHS` | `web/src/lib/plain.ts:49`, `:6`, `:4` | First, peak and last busy month |
| `typicalSeason(rows)`, `whenText()` | `web/src/lib/plain.ts:27`, `:9` | Kiln season in words |
| `districtFacts()`, `factsResult()`, `unsupportedNumbers()`, `numbers()` | `web/src/lib/geminiPrompt.ts:14`, `:27`, `:55`, `:48` | Real district facts for Gemini; the numeric guard |
| `unitAt()`, `inGeometry()` | `web/src/lib/geo.ts:20`, `:14` | Point in unit |
| `cellId()`, `tilesForBox()` | `web/src/lib/box.ts:6`, `:15` | Grid maths from `meta.grid` |
| `seasonStart()`, `dateToDay()`, `dayIso()` | `web/src/lib/days.ts:23`, `:6`, `:9` | Day indices |
| `TypicalYear` | `web/src/pages/AreaPage.tsx:203` (local) | Month bars for the typical year, this season as dots, kiln months shaded, harvest windows listed |
| `SeasonToDateChart` | `web/src/components/charts.tsx:286` | This season nationally, week by week, by window |
| `Provenance` | `web/src/components/plain.tsx:132` | A "from file X" line |
| `Other` | `web/src/components/plain.tsx:40` | A cited outside statement (`src`, `href`) |

## 5. Phases and steps

### Commands

| Purpose | Command (from the repo root unless noted) | Expected |
|---|---|---|
| Web lint | `cd web && npm run lint` | exit 0 |
| Web types | `cd web && npm run typecheck` | exit 0 |
| Web unit tests | `cd web && npm test -- --run` | all pass |
| Fixture builds | `cd web && for b in full from2012 partial nightfire nokiln; do DATA_SRC=fixtures FIXTURE_BRANCH=$b npm run build \|\| break; done` | five builds succeed |
| Public safety check | after the `nokiln` build: `python -m kilnwatch export --check-public web/dist/data` | passes |
| End to end | `cd web && DATA_SRC=fixtures FIXTURE_BRANCH=nokiln npm run build && npx playwright test` | all pass (Playwright serves `dist` via `npm run preview`) |
| Python | `ruff check . && pytest -q` | clean; all pass |
| Worker | `cd ask-worker && npm test` | all pass (it must be unaffected) |

Run the whole table at the end of every phase.

### Phase A — shared helpers (S)

Each new function gets the tests listed in section 7 (A-tests).

**A1. `monthlyMeans` and `TypicalYear`.** Move the `starts` / `monthly` logic of `TypicalYear`
(`AreaPage.tsx:208-212`) into `web/src/lib/plain.ts` as
`export function monthlyMeans(perDay: number[]): (number | null)[]` (12 values, July first; a month with no days is
`null`, not 0). Move `TypicalYear` into `web/src/components/TypicalYear.tsx`, exported; `AreaPage.tsx` imports it. It depends on
`palette`/`useTheme` (`web/src/lib/theme`), `windowLevels` (`components/plain.tsx`), `MONTHS`/`SEASON_MONTHS`, the
ECharts wrapper used in `AreaPage.tsx`, and the local `SonifyButton` (`AreaPage.tsx:250`): move `SonifyButton` into
the same new file and export it if `AreaPage.tsx` still uses it elsewhere. No visual change.

**A2. Window shares.** Add to `web/src/lib/calendar.ts`:

```ts
/** Share (0–1) of harmonized burning in each pipeline split window over the whole record, in split order. Empty if the total is 0. */
export function splitShares(cal: Calendar): { key: string; share_frac: number }[]
/** Share (0–1) of the typical year's harmonized burning that falls in the given calendar months (1–12). null if the year total is 0. */
export function monthsShare(cal: Calendar, months: number[]): number | null
```

`monthsShare` sums `seasonMean(cal)` over the days of season whose calendar month is in `months`. `HomePage.tsx:32-39`
switches to `splitShares()` with the same text. No visual change.

**A3. Season-to-date ratio.** Add to `web/src/lib/calendar.ts`:

```ts
/** This season so far against the typical year over the same days of season: sum(live) / sum(seasonMean(cal)[0..n-1]),
 * n = live.length. null when the typical sum is 0. Descriptive only: not a pre-registered test. */
export function seasonToDateRatio(cal: Calendar, live: number[]): number | null
```

Both series are on the same harmonized scale (the Area page already plots them on one axis, `AreaPage.tsx:213-215`).
The site calls a day **unusual** only by the pre-registered rule (`above_p90_days`); the ratio is a description, and
every place that shows it says "compared with the 2003–<last season> average for the same days".

**A4. Grid helpers.** Add to `web/src/lib/box.ts`:
`export function cellCenter(meta: Grid, cell: number): { lat: number; lon: number }` (row = `Math.floor(cell / cols)`,
col = `cell % cols`, centre = origin + (index + 0.5) × step, all from `meta.grid`), and
`export const sensorOf = (sp: number) => Math.floor(sp / 2)` with `export const AQUA = 1` and a comment pointing at
`aggregateBox`. Change `aggregateBox` to use `sensorOf`. Add to `web/src/lib/geo.ts`:
`export function bboxOf(g: GeoJSON.Geometry): [number, number, number, number]` (west, south, east, north).

**Verify A:** the command table → all pass, including the A-tests. `#/` and `#/area/BD3026` look exactly as before.

### Phase B — Ask stage: Bangladesh places on real data (M–L)

Keep every component, prop flow, preset question and animation. Change only where the values come from.

B1–B8 change shared types (`RegionProfile`, `AgentResolution`, `ChartDataPoint`, the chart and stage props), so
`npm run typecheck` fails between steps. Do B1–B8 as one unit and run "Verify B" at the end; if you must pause,
pause on a green build only after B8.

**B1. Registry: keep the places, drop the typed figures.** In `web/src/lib/regionRegistry.ts`:
- Change `RegionProfile` to:
  ```ts
  export type RegionProfile = {
    key: string; name: string; country: string; stateOrDivision?: string
    aliases: string[]
    /** Where its real data lives: a Bangladesh unit, or Natural Earth units (states or countries) for Phase R. */
    unit: { kind: 'bd'; unit_id: string } | { kind: 'ne'; ids: string[] }
  }
  ```
  `coords` and `bbox` are no longer typed: they are computed from the unit geometry (`bboxOf`, A4). `normalCurve`,
  `thisSeasonCurve`, `defaultMultiplier`, `criticalWeeks`, `criticalSpan`, `months`, `news` and `contextNote` move
  out of the registry: their real values are computed (B2) or come from the records in B7.
- For each of the 64 Bangladesh entries, set `unit_id` by matching `name` against `aoi/districts.geojson`
  `name_en` (aliases help: Chittagong → Chattogram `BD2015`, Bogra → Bogura, Barisal → Barishal, Jessore → Jashore,
  Comilla → Cumilla). Write a one-off script in `$TMPDIR` (not committed) that prints the mapping; paste the result.
  **STOP** if any Bangladesh entry has no district match.
- For each of the other 57 entries, set `ids` to the Natural Earth `unit_id`s in `aoi/world_states.geojson` (a state
  or province) or `aoi/world_countries.geojson` (a whole country) that make up the place. A place made of several
  units (e.g. "Chittagong Hill Tracts" = Bandarban + Rangamati + Khagrachhari; the Sundarbans across Bangladesh and
  India) lists all of them; for Bangladesh parts use `kind: 'bd'` and pick the district the place is best known by,
  and list the others in a new optional field `alsoUnits?: string[]`. The stage then shows that one district's
  figures and says so in `headline` and `detailsText`: "Figures for Bandarban, one of the three hill districts
  (also Rangamati, Khagrachhari)". Never add or average calendars across districts: `h` is a rate per 1,000 clear
  cells, so sums across districts are not meaningful. **STOP and report** any place you cannot map to existing
  units.
- Keep `findRegionInQuery()` and its alias matching unchanged.
- Update the file's header comment: "Place names and aliases, and where each place's real data lives. No figures."

**B2. `parseUserQuery` on real data.** In `web/src/lib/agentEngine.ts` keep the exported names (`parseUserQuery`,
`AgentResolution`, `ChartDataPoint`, `HistoricalNews`, `MapFocus`, `toSvgCoords`, `toSvgBox`, `REGION_PROFILES`).
Split the work so it stays pure and testable:

```ts
/** Step 1, no data needed: which place the question is about, and its intent. */
export function resolveQuery(query: string): { profile: RegionProfile | null; queryType: AgentResolution['queryType']; placeText: string }

/** Step 2: fill the resolution from real data. Pure: the page fetches and passes the files. */
export function buildResolution(r: ReturnType<typeof resolveQuery>, data: StageData): AgentResolution
export type StageData = {
  geometry: GeoJSON.Geometry | null      // the unit's geometry (district, or Natural Earth units merged)
  unitName: string; unitId: string | null
  cal: Calendar | null; nrt: NrtSeason | null; ka: KilnActivity | null
  events: Events | null; meta: Meta | null; harm: Harmonization | null
  region: RegionSeries | null            // Phase R; null until then
}
```

Field by field (Bangladesh place; `d = districtOf(unitId)`, `live = nrt.districts[d].h`):

| `AgentResolution` field | Real value |
|---|---|
| `locationName`, `country`, `stateOrDivision` | Registry names; for Bangladesh also the COD-AB `name_en` and `division` |
| `coordinates`, `bbox`, `mapFocus` | Centre and `bboxOf(geometry)`; `mapFocus` computed from them as today (`agentEngine.ts:140-156`) |
| `multiplier` | `seasonToDateRatio(cal, live)` (A3), rounded to 1 decimal; `null` allowed: change the type to `number \| null` |
| `isUnusual` | `nrt.districts[d].above_p90_days > 0` (the pre-registered "unusual day" rule) |
| `headline` | Only figures above. Unusual: `"Yes: <n> unusual days so far in <season>; <ratio>× the 2003–<last> average for the same days"`. Not unusual: `"No unusual days so far in <season>; <ratio>× the 2003–<last> average for the same days"`. If the ratio is null, leave that clause out |
| `criticalWeeks` | `"BUSIEST MONTHS: <first> – <last>"` from `busyMonths(seasonMean(cal))`, upper-case as today; `"NO BUSY MONTHS"` if null |
| `criticalSpan` | The month indices of that window in `chartData` |
| `chartData` | 12 points, July → June: `label` = month (3 letters, upper-case), `normal` = `monthlyMeans(seasonMean(cal))`, `normalP90` = `monthlyMeans(cal.normal.p90)`, `season` = `monthlyMeans(live)` (null for months not reached yet; change the field type to `number \| null`) |
| `detailsText` | Built from `districtFacts()` words: fire months, unusual days this season, kiln season (or "no reliable kiln season found"), plus for an upazila "live figures are for the whole of <district>" |
| `sources` | `"SOURCES: calendar/<id>.json · nrt/current_season.json (updated <date>) · kiln_activity.json · NASA FIRMS via Kiln Watch build <meta.git_sha>"` |
| `steps` | B6 |
| `news` | B7 |
| `queryType` | Same keyword rules as today (`agentEngine.ts:130-136`) |
| `illustrative` | Remove the field (it was always `true`); add `measured: boolean` (true when real figures were filled) |

For a place with `unit.kind === 'ne'` before Phase R: names, geometry, `mapFocus`, steps (B6) and the dated events
(B7) are filled; `multiplier`, `chartData`, `headline` figures and `isUnusual` are empty (`null`, `[]`, `false`) and
`headline` reads `"Measured fire data for <name> arrives with the South Asia calendar (Amendment 5); Kiln Watch
measures Bangladesh today."` For a query that matches no place: keep today's dynamic-name behaviour for the title,
with no figures and the headline `"No place found in the question. Try a Bangladesh district or upazila."` **Delete
nothing else from the fallback block except its typed numbers.**

**B3. Data loading.** In `web/src/components/agent/AgentCinematicStage.tsx`, `handleUserQuery` calls
`resolveQuery()` and reports it to the page through a new prop `onResolve(r)`. `AskPage.tsx` loads what the
resolution needs (`aoi/districts.geojson`, `aoi/upazilas.geojson`, `calendar/<id>.json`, `nrt/current_season.json`,
`kiln_activity.json`, `events.json`, `meta.json`, `harmonization.json`, and the `grid/` tiles for the bbox), calls
`buildResolution()` and passes the result back down as the stage's `res` prop. Use `fetchJson` with the same
`.catch(() => null)` pattern as `ExplorerPage.tsx:387` for the tiles. The stage animation starts when the resolution
is ready; until then the steps show their loading state (B6).

**B4. Chart.** In `web/src/components/agent/AgentAnimatedChart.tsx` keep the component, its timeline and its
look. Replace the fixed paths (`:59-79`) with paths built from `chartData`: x positions spread evenly across the
12 months; y scaled to the largest of `normalP90` and `season`; the "normal" path and a p90 ribbon from `normal` and
`normalP90`; the "this season" path through the months that have a value; the critical box from `criticalSpan`; the
verdict text from `headline`. Change the props to `{ timeMs, locationName, chartData, criticalSpan, headline }`, all required: the typed
defaults `locationName = 'PUNJAB, INDIA'` and `multiplier = 2.1` (`:15-16`) are dummy values too, and go with the
old props. Update the doc comment (`:3-12`) to describe the real series.
Months with `null` are gaps, never zeros. If `chartData` is empty, show the line "No measured data for this place
yet" instead of curves.

**B5. Map dots.** In `web/src/components/agent/AgentAnimatedMap.tsx`:
- Replace the seeded random cluster (`:155-183`) with a new prop `cells: { lat: number; lon: number }[]`. The page
  builds it from the loaded tiles: rows with `day >= dateToDay(nrt.day0)` (this season), one dot per distinct cell,
  cell centre from `cellCenter()`, kept only if `inGeometry(geometry, lat, lon)`. Cap at
  `MAX_STAGE_CELLS = 3000` (invariant 9); if capped, the caption says so.
- `NASA_FIRMS_HOTSPOTS_LAND` (the ambient dots across South Asia): replace the typed list with the Phase R ambient
  series. Until Phase R, draw no ambient dots and add the caption "Fire dots: Bangladesh only until the South Asia
  calendar is agreed." Keep the constant's name for Phase R to fill: change its type to
  `{ lat: number; lon: number }[]` and set it to `[]` with a comment pointing at Phase R. (This keeps the feature and
  removes only the typed coordinates.)
- Caption under the map: "Fire detections this season (since <day0>), 1 km grid cells, all fires (not only kilns),
  from grid/<tiles>."
- Invariant 3: the dots are fire-detection grid cells, already published under `grid/`. Never label a dot as a
  kiln; never read `data/interim`.

**B6. Steps panel.** In `web/src/components/agent/AgentStepperPanel.tsx` keep the four steps and their titles; make
each detail real and its tick reflect real state:

| Step | Detail (Bangladesh place) | Done when |
|---|---|---|
| Draw area | `<name>`, `<level>`, `<division>` from COD-AB, and the bbox | the geometry has loaded |
| Fetch NASA FIRMS | "MODIS + VIIRS detections to <last day in the calendar>; this season to <nrt last day>" | the calendar and NRT files have loaded |
| Harmonize | "model <harm.selected_model>; 2012 camera jump reduced by <round((1 − seam.ratio) × 100)>%" | `harmonization.json` has loaded |
| Compare with 23 years | "<first season> – <last season> normal (<n> seasons)" from `cal.seasons` | `chartData` is built |

For a Natural Earth place before Phase R, steps 2–4 read "not measured yet (Amendment 5)" with a neutral icon, not a
tick. Replace "23-year historical normals" at `:78` with "the <first>–<last> normal" from the loaded calendar (or "the
2003–today record" before a place is chosen). Replace the coverage text at `:85` with figures counted from the loaded
files: "Measured: <n> districts and
<m> upazilas of Bangladesh. Named on the map: <k> more places in <c> countries (measured data after Amendment 5)."
(n, m from the geojson feature counts; k, c from the registry.)

**B7. Records canvas.** In `web/src/components/AgentNewsCanvas.tsx` keep the canvas, the heading, the cards and the
badge. Build `res.news` (type `HistoricalNews`, add `url: string` to it) from three real sources, newest first. The
type is declared twice (`agentEngine.ts:21` and `regionRegistry.ts:4`): add `url` to both, or make
`regionRegistry.ts` declare it and `agentEngine.ts` re-export it (the registry must not import `agentEngine.ts`, which
imports the registry).
1. **The area's own record:** for each of the last 5 complete seasons in `cal.seasons`, one card: title
   `"<season>: <n> unusual days"`, summary = `seasonVerdict(cal, season).text`, source `"Kiln Watch, calendar/<id>.json"`,
   url = `dataUrl('calendar/<id>.json')`, severity `high` if n > 0 else `info`. Real for every Bangladesh place.
2. **Dated events:** `events.policy` and `events.satellite` entries, each with its own `url`, severity `info`. These
   are national; the card says "Bangladesh" or "Satellites" as its place.
3. **Verified news items** from a new file `web/src/lib/newsRecords.ts`:
   `export const NEWS_RECORDS: { place_key: string; date: string; title: string; publisher: string; url: string; summary: string }[]`.
   Start from the 121 existing `news` items in the registry, but **add an item only if** its URL was opened and the
   page states what the title and summary say (section 6 protocol). An item that cannot be verified is not invented
   and not carried over; its place still has records from (1) and (2). Append one row to `docs/VERIFICATION.md`:
   `| RD-1 | News records in web/src/lib/newsRecords.ts: 5 random items open and say what their card says | | | |`
   (a person signs it; invariant 4).
The badge counts the real records: `"<n> records"`. The heading line "cross-referenced from 2003–present" becomes
"From Kiln Watch's own record since 2003, dated policy and satellite events, and linked news reports."

**B8. Labels and Ask page wiring.** In `AgentCinematicStage.tsx` replace the `IllustrativeNote` (`:83`) and the
"Illustrative example" badge (`:142-146`) with a "Measured data" badge for Bangladesh places (a "Not measured yet"
badge for the others) and a `Provenance`-style line listing the files used. In `AskPage.tsx`:
- `onStageQuery` uses `res.measured` and the registry's `unit_id` instead of `unitAt()` on typed coordinates; the
  Gemini call stays exactly as today (`askAboutDistrict`, with `districtOf()` for an upazila).
- Replace `:162`'s text with: "Kiln Watch has measured data only for Bangladesh districts and upazilas so far, so
  there is no checked answer for <name> yet. The South Asia calendar (Amendment 5) will add it." No Gemini call (keep
  the guarantee tested at `web/e2e/smoke.spec.ts:381`).
- Replace the `IllustrativeNote` at `:187` with the `sources` line.
- Keep the five preset questions word for word (`AgentCinematicStage.tsx:8-14`).

**Verify B:**
- `grep -nE "normalCurve|thisSeasonCurve|defaultMultiplier|contextNote|\"criticalWeeks\"|\[[0-9.]+(, [0-9.]+){5,}\]" web/src/lib/regionRegistry.ts web/src/lib/agentEngine.ts`
  → no output. (Six or more numbers in a bracket: the typed curves had eight; the `SOUTH_ASIA_BOX` comment at
  `agentEngine.ts:65` has four and is fine.)
- `grep -nE "Math\.random|rand\(\)|\* 1\.35" web/src/components/agent web/src/lib/agentEngine.ts` → no output.
- `grep -rn "Illustrative" web/src/components/agent web/src/components/AgentNewsCanvas.tsx web/src/pages/AskPage.tsx` → no output.
- The command table → all pass, with the B-tests and the rewritten X5 tests (section 7).
- By hand (`cd web && npm run dev`, open `#/ask`): click the Rajshahi preset. The stage's unusual-day count and busiest
  months equal those on `#/area/BD5081`. Dhaka (`BD3026`) and Bandarban (`BD2003`, via "Chittagong Hill Tracts") the
  same. Punjab shows the map zoomed to Punjab (India), no curves, the "arrives with Amendment 5" headline, and the
  dated events.

### Phase C — Crops page on real data (M)

Keep every section, card, the four crop tabs and both links. Replace values only. Put every outside figure through
section 6.

**C1. Data.** `CropsPage.tsx` loads `meta.json`, `events.json`, `nrt/current_season.json`, `aoi/districts.geojson`,
`validation.json`, and on demand `calendar/<id>.json` for the selected district (default Dhaka `BD3026`; add a
district `<select>` like `AskPage.tsx:76-81`) and the three hill districts (Bandarban `BD2003`, Rangamati `BD2084`,
Khagrachhari `BD2046`; find ids by name, STOP if a name is missing).

**C2. Header cards.** "Harvest Timing": the selected district's `splitShares()` (A2) in words, e.g. "In <district>,
<x>% of harmonized burning since 2003 fell in the Aman window and <y>% in the Boro window", labels from
`meta.split_labels`. "Soil & Carbon Damage": one cited figure (C5). "Worker Health & Smoke": one cited figure (C7).
The claim "down to the upazila level" stays only as "upazila calendars are available" with a link to `#/area`.
The page lead's "23 years" becomes the number of complete seasons in the selected calendar (`cal.seasons`), e.g.
"<n> seasons since 2003".

**C3. Crop windows.** Replace `season` for each crop with a window from a cited crop calendar, kept in a new file
`web/src/lib/cropSources.ts` (section 6 format, kind `window`, months as numbers):
- rice: Aman Nov–Dec and Boro Apr–May from `events.harvest` (FAO GIEWS, already cited);
- wheat: harvest months from the FAO GIEWS Bangladesh crop calendar (https://www.fao.org/giews/countrybrief/country.jsp?code=BGD) or another cited calendar;
- jhum: the busiest months computed from the three hill districts' calendars (`busyMonths(seasonMean(cal))`), shown
  with "Kiln Watch, calendar/<id>.json"; the clearing-and-burning season itself cited;
- sugarcane: the crushing or harvest months from a cited Bangladesh source (for example the Bangladesh Sugarcrop
  Research Institute or the Bangladesh Sugar and Food Industries Corporation).

**C4. Satellite signature per crop.** Replace `satelliteDetection` with real numbers for the selected district:
`monthsShare(cal, window months)` (A2) as "<x>% of <district>'s typical-year harmonized burning falls in the <crop>
window (<months>)". Add, once on the page: "A window is a date range: fire inside it is counted whatever is burning."
`timingMechanism` and `risk` become cited text (section 6); numbers in them must come from their sources.

**C5. Soil figures.** `soilImpact` and the three bullets at `:155-160` become cited statements. Keep the topics
(organic carbon, soil life, nitrogen and phosphorus loss). Use the figures the sources give; if a source gives a
different figure from today's text, the text changes to the source's figure.

**C6. Jhum section.**
- "88% of Bangladesh Wildland Fires" → computed: the share of **Aqua MODIS** fire detections (grid rows with
  `sensorOf(sp) === AQUA`), counted as distinct cell-days, from 2003-01-01 to the last complete season, that fall
  inside the three hill districts' geometries, out of all such detections in Bangladesh. Card title:
  "<x>% of Bangladesh's Aqua MODIS fire detections"; text: "2003–<last season>, 1 km cell-days, all fire types,
  from grid/ tiles." Compute it in a pure function `hillShare(tiles, meta, hillGeoms, bdGeoms, lastDay)` in
  `web/src/lib/calendar.ts` (B-tests cover it), loading all tiles (2.5 MB) only when the section scrolls into view
  (an `IntersectionObserver` or a "Compute" button). Aqua only, so the share is not mixed across sensors. Test each
  distinct cell against the polygons once (cache cell → inside-hill / inside-Bangladesh / outside, with a bbox
  pre-check), not once per row. The tiles also cover parts of India and Myanmar: the denominator counts only cells
  inside a Bangladesh district.
- "Pre-monsoon peak (March – April)" → the computed busiest months of the three districts (C3).
- "3 weeks" drying and "15–20 years down to 2–4 years" fallow → cited (section 6).
- The section's tag "NASA FIRMS Decadal Audit" → "Kiln Watch, from NASA FIRMS".

**C7. Worker health.** The PM2.5, CO, PAH and NO2 statements, health effects and the three interventions become
cited text (section 6). If `validation.json` has `pm25`, add one Kiln Watch line: "Kiln Watch: correlation between
kiln activity and PM2.5 at lag <lag>: <r_kiln.p50> (95% <lo>–<hi>)", from the row with the largest `r_kiln.p50`
(no new statistics).

**C8. Satellites section and label.** Build the four satellite cards from `events.satellite`: launch dates and end
dates exactly as listed (Aqua launched 2002-05-04, planned end about 2027-09; Terra planned end 2027-01;
Suomi NPP launched 2011-10-28, new data end 2026-11-02; NOAA-20 2017-11-18; NOAA-21 2022-11-10), each linking its
`url`. `satellite_events.csv` has no Terra launch row: cite Terra's launch date through `cropSources.ts` (section 6)
only. Do not add a CSV row: `tests/test_contracts.py:171` needs a Bangla label for every event (no new Bangla), and
`events.json` is rewritten into all five fixture sets. Overpass times
("10:30", "1:30 PM") are cited (section 6) with the note that Aqua's crossing time has drifted later since 2022 if a
cited source says so. Replace the `IllustrativeNote` at `:64` with a source line listing the files and the number
of cited sources.

**Verify C:**
- `grep -nE "IllustrativeNote|Illustrative" web/src/pages/CropsPage.tsx` → no output.
- `grep -nE "[0-9]+(\.[0-9]+)? ?(%|°C|µg|years|weeks|cm)" web/src/pages/CropsPage.tsx` → no output: every figure is
  computed or comes from `cropSources.ts`.
- The command table → all pass, with the C-tests (section 7).
- By hand: `#/crops` for Dhaka: the Aman/Boro shares equal the Home page sentence for Dhaka; the hill-district busiest
  months equal those on `#/area/BD2003`, `#/area/BD2084`, `#/area/BD2046`.

### Phase D — Sensors page threshold (S)

In `web/src/pages/SensorsPage.tsx:136-166` keep the drawing. Replace the illustrative 0.1% threshold (`:138`) and the
two fire sizes with published detection limits (section 6; for example the MODIS and VIIRS 375 m active-fire
algorithm papers), one per camera, and compute the threshold as fire area ÷ pixel area (1 km² for MODIS, 0.140625 km²
for VIIRS 375 m). Change the caption from "Illustration, not real data" to "Drawing to scale; detection limits from
<sources>". Fire positions in the drawing stay a drawing.

**Verify D:** `grep -n "illustrative threshold\|not real data" web/src/pages/SensorsPage.tsx` → no output; the
command table passes.

### Phase E — docs, leftover labels, offline copy (S)

- **E1.** `grep -rn "IllustrativeNote" web/src` → only its definition in `web/src/components/ui.tsx:316`. Keep the
  component (nothing is removed); change its default text to "Drawing, not measured data" so any future use is
  accurate.
- **E2.** `docs/web-frontend.md`: update the `#/ask` row (the stage shows real calendars, live season, fire
  detections and records, with files listed); add the missing `#/crops` row; add `cropSources.ts`, `newsRecords.ts`,
  `TypicalYear.tsx` and the new helpers to the libs table. `docs/data-contracts.md`: document the `grid/` sensor code
  (`floor(sp / 2)`), which is not written down today. `docs/AI_USE.md`: update any description of the Ask stage; do
  not fill the three "_to fill_" sections.
- **E3.** Refresh `web/fixtures/nokiln/` (real data frozen at 6 Oct 2026). **Do not run `python -m kilnwatch
  release`: it publishes to GitHub Releases** (`kilnwatch/__main__.py:61`). Instead, from the repo root:
  ```bash
  rm -rf data/releases/public                                   # stale extraction (fixtures._real_release_dir reuses it otherwise)
  gh release download data-current -p public-data.tar.gz -D data/releases --clobber
  curl -fsS https://aalvee-aarham.github.io/kiln-watch/data/nrt/current_season.json -o data/releases/nrt-current.json
  python -m kilnwatch export --fixtures
  ```
  The tarball excludes `nrt/`, which is why the live season is taken from the live site. Expected: only
  `web/fixtures/nokiln/` changes (`git status --short web/fixtures`); the four synthetic sets are deterministic and
  must not change. **STOP** if they do. Rerun the command table. These are committed data files: keep them in a
  separate commit when the operator asks for commits.
- **E4.** Update section 1's status table.

### Phase R — places outside Bangladesh on real data (L–XL; gated)

**Gate (a person, not the executor):** `docs/amendment5_draft.md` says it must be agreed and committed "before any
regional FIRMS or Earth Engine value is downloaded or looked at", and states that none has been. Fetching fire data
for India or anywhere else for this stage would break that promise and the pre-registration's validity. So:

1. The team widens the draft's area to the stage's places outside South Asia (the registry names 57 places in 33
   countries, including China, Japan, Turkey, Saudi Arabia, Kazakhstan and Southeast Asia; the draft covers 8 South
   Asian countries over 60–98°E, 3–39°N), or decides which of those places stay "not measured".
2. The team decides the draft's "Decide" points and commits it as Amendment 5 in
   `docs/PREREGISTRATION_AMENDMENTS.md` with the date. Never edit `docs/PREREGISTRATION.md` (invariant 1).

**STOP here until `grep -n "Amendment 5" docs/PREREGISTRATION_AMENDMENTS.md` finds the committed amendment.**

After the gate, the amendment's "What ships" rule applies: a country's harmonized calendar is shown only if its tests
pass; otherwise "raw, unconverted activity only, labelled 'not harmonized'". Build in this order:

- **R1. Raw Aqua series per place (first, smaller).** A new pipeline stage `kilnwatch/regions.py` that, per registry
  place outside Bangladesh, fetches FIRMS MODIS detections with the existing cached, quota-paced
  `ingest.area_window()` (`kilnwatch/ingest.py:103`, its `root` argument pointing at `data/raw/firms_regions`),
  keeps Aqua only, applies the pre-registered confidence filter, clips to the place's Natural Earth geometry, and
  writes `web/public/data/regions.json`:
  `{ "<key>": { "sensor": "Aqua MODIS", "harmonized": false, "seasons": [..], "normal_mean": [12], "normal_p90": [12], "season": "<s>", "this_season": [12, null for future months], "above_p90_days": n } }`
  plus `ambient: [[lat, lon], …]` (this season's Aqua detections over the region, binned to 0.25° cells, at most 5,000).
  Aqua is the record's anchor sensor and flies until about September 2027 (`satellite_events.csv`), so its series
  needs no conversion; its orbit drift is stated as a limit. Add the file to `docs/data-contracts.md` with a size
  budget and to `export --check-public`. pytest tests on synthetic detections (monthly sums, clipping, binning
  maxima). Then `buildResolution()` fills the `ne` places from `region`, labelled "Aqua MODIS only, not harmonized",
  and `NASA_FIRMS_HOTSPOTS_LAND` reads `ambient`.
- **R2. Harmonized regional calendars** (roadmap F9) as the amendment specifies. A place switches from R1 to R2 data
  per country, only when that country's tests pass.

The Phase R design must be reviewed by the team before code; treat R1's file layout above as the proposal.

## 6. Sourcing protocol for outside figures (Phases B7, C, D)

Outside figures are the riskiest part: an executor must never write a citation it has not opened.

1. Every outside statement lives in `web/src/lib/cropSources.ts` (Crops, Sensors) or `web/src/lib/newsRecords.ts`
   (news), as:
   ```ts
   { id: 'soil-n-loss', text: 'Burning rice straw loses most of its nitrogen to the air.', url: 'https://…',
     publisher: 'FAO', title: '…', quote: '<the exact sentence from the source that states it>', checked: '2026-10-14' }
   ```
   Pages render `text` with a link to `url` (use the `Other` component, `plain.tsx:40`).
2. To add an entry, open the URL (WebFetch, or a browser). Copy the sentence that states the fact into `quote`
   verbatim. Every number in `text` must appear in `quote` (a test checks this with `numbers()` from
   `geminiPrompt.ts:48`).
3. Prefer, in order: FAO, IRRI and other UN or government agencies; peer-reviewed papers (with DOI links);
   reputable news. No blogs, no AI-generated pages, no sources you could not open.
4. If no source can be found for a topic after a real search, **STOP and report the topic** with what you searched.
   Do not invent a figure, and do not keep the old figure.
5. Append one row to `docs/VERIFICATION.md` for a person to sign (invariant 4):
   `| RD-2 | Every quote in web/src/lib/cropSources.ts appears at its URL (check 5 at random) | | | |`.

If the executor has no web access, Phases C3 (wheat, sugarcane), C4–C8 cited parts, D and B7 item 3 are BLOCKED:
do the computed parts, list the outside statements still needing a source in this file's status table, and stop.

## 7. Tests

New tests use small inline objects and assert closed-form properties (invariant 8); none reads `data/raw` or
`data/interim` (invariant 5). Pattern: `web/src/lib/plain.test.ts`, `web/src/lib/calendar.test.ts`.

**A-tests** (`plain.test.ts`, `calendar.test.ts`, `box.test.ts`, new `geo.test.ts`):
- `monthlyMeans` of 366 ones → twelve 1s; of a 31-day array of ones → `[1, null × 11]`.
- `splitShares` with split totals 1, 3, 0 → `[0.25, 0.75, 0]` in split order; all zero → `[]`.
- `monthsShare` of a calendar whose typical year has all its burning in November → 1 for `[11]`, 0 for `[4, 5]`; a
  zero year → `null`.
- `seasonToDateRatio`: live equal to the typical year's first n days → 1; live twice → 2; a zero typical sum → `null`.
- `cellId(meta, cellCenter(meta, c).lat, cellCenter(meta, c).lon) === c` for `c = 0`, the last cell and one in the
  middle, on an inline `meta.grid`; `sensorOf(2) === 1`, `sensorOf(3) === 1`, `sensorOf(4) === 2`.
- `bboxOf` of a unit square → `[0, 0, 1, 1]`; of a two-polygon MultiPolygon → the union box.

**B-tests** (new `web/src/lib/agentEngine.real.test.ts` or added to the rewritten files below):
- `buildResolution` on an inline calendar and NRT: `isUnusual` equals `above_p90_days > 0`; `multiplier` equals
  `seasonToDateRatio` rounded to 1 decimal; `chartData` has 12 points and `season` is `null` for months past the live
  data; `unsupportedNumbers(headline, JSON.stringify({ ...facts, ratio }))` → `[]` (no number in the headline that
  the data did not produce).
- For an upazila `unit_id` (10 characters), live figures come from its first 6 characters.
- For an `ne` place with `region: null`: `chartData` is `[]`, `multiplier` is `null`, no step is ticked after step 1.
- `news`: a calendar with 2 complete seasons gives 2 own-record cards whose titles carry the inline unusual counts;
  every card has an `https://` or data-file `url`.
- Registry integrity: every entry has `unit`; every `bd` entry's `unit_id` matches `/^BD\d{4}$/`; no entry has the
  removed numeric fields (check `Object.keys`).
- `hillShare` on two inline tiles: 3 Aqua cell-days inside the hill polygon and 1 outside → 0.75; non-Aqua rows ignored;
  a repeated (cell, day) counted once.

**C-tests** (new `web/src/lib/cropSources.test.ts`):
- Every entry: `url` starts with `https://`; `quote` is non-empty; every number in `text` is in `numbers(quote)`;
  `checked` is an ISO date; ids are unique. The same checks for `NEWS_RECORDS`, plus `place_key` exists in
  `REGION_REGISTRY`.

**Rewritten tests (X5): keep both files and every case.** `web/src/lib/agentEngine.test.ts` and
`web/src/lib/autonomousBattery.test.ts` call `parseUserQuery()` and expect typed registry values (e.g.
`multiplier` 2.1, `criticalWeeks` containing "JHUM BURNING", news titles). Those expectations are current output, which
invariant 8 forbids, and the values no longer exist. For each case keep the query and change what it expects:
- place resolution (`resolveQuery(query).profile.key`, `country`) — unchanged where it was right;
- `mapFocus` position tests — keep, computed from the real bbox;
- figure checks — computed properties on inline `StageData` (as in the B-tests), never fixed numbers;
- news checks — "has at least the own-record cards" instead of typed titles;
- `autonomousBattery.test.ts:142` ("all 64 districts in Bangladesh have distinct non-zero coordinates") — keep the
  case; coordinates now come from geometry at run time, so it checks that the 64 Bangladesh entries have 64
  distinct `unit_id`s matching `/^BD\d{4}$/`.
Record in the change description: "Tests rewritten because their expected values were typed-in sample data
(invariant 8); every query case is kept." This changes what the tests check, never how much they check: no case is
removed or skipped (invariant 2).

**End to end** (`web/e2e/smoke.spec.ts`, fixture `nokiln`):
- `:362` "a Bangladesh place asked on the agent stage gets a checked answer": keep unchanged; must pass.
- `:381` "a place outside Bangladesh plays the illustrative stage but never calls Gemini": keep the case and its
  Gemini assertions (`calls === 0`, no saved `article`); replace the `Illustrative example` expectation with the
  "arrives with … Amendment 5" headline. Rename to "…shows no figures yet and never calls Gemini".
- `:394` "crops: the page says its figures are illustrative": keep the case; expect instead the page's source line
  and at least one link to `fao.org`. Rename to "crops: the page names its sources".
- New: "ask: the stage shows the same figures as the Area page": click the Dhaka preset, read the stage's unusual
  day count, open `#/area/BD3026`, expect the same number (consistency of two views of one file). Dhaka, not
  Rajshahi: Rajshahi has 0 unusual days in `nokiln`, and the Area page then shows no number.
- The Crops/Home share agreement is a unit test (`splitShares` against the Home sentence's own computation), not
  an e2e test: the Home sentence is for the live season's busiest district, not Dhaka.

## 8. What stays synthetic, and why it is not dummy data

The four synthetic fixture sets (X4) are **test input**: CI builds the site once per pre-registered gate outcome
(`full`, `from2012`, `partial`, `nightfire`) so every page is tested in every case. No visitor sees them (the deploy
builds with `DATA_SRC=real`), and `CLAUDE.md` invariants 5 and 8 require synthetic input for tests. They stay. The
same holds for test files and the synthetic-data banner that labels these sets locally (`ui.tsx:22`, `:416`).

## 9. Scope

**In scope:**
`web/src/lib/{regionRegistry,agentEngine,calendar,plain,box,geo,cropSources,newsRecords}.ts` and their tests,
`web/src/lib/{agentEngine,autonomousBattery}.test.ts` (rewritten, section 7), `web/src/components/TypicalYear.tsx`
(new), `web/src/components/agent/*.tsx`, `web/src/components/AgentNewsCanvas.tsx`, `web/src/components/ui.tsx` (E1),
`web/src/pages/{AskPage,CropsPage,AreaPage,HomePage,SensorsPage}.tsx`, `web/e2e/smoke.spec.ts`,
`docs/{web-frontend,data-contracts,AI_USE,VERIFICATION}.md` (E2; VERIFICATION rows appended only), this file.
`web/fixtures/nokiln/` (E3 only). Phase R adds `kilnwatch/regions.py`, its tests, `kilnwatch/export.py` (budget and
check) and `docs/data-contracts.md`, after its gate.

**Out of scope (do not touch):** `docs/PREREGISTRATION.md`; `docs/PREREGISTRATION_AMENDMENTS.md` and
`docs/amendment5_draft.md` (the team's); `web/src/lib/i18n.ts`; `ask-worker/`; `kilnwatch/` and `tests/` before
Phase R; `web/fixtures/{full,from2012,partial,nightfire}/`; the Impact page; `HowPage.tsx` (already real).

**Scope check:** `git diff --name-only 8f1c9a6 -- . ':!plans'` lists only in-scope files. `git diff --diff-filter=D --name-only 8f1c9a6`
→ no output (nothing deleted).

## 10. Done criteria (Phases A–E)

- [ ] `git diff --diff-filter=D --name-only 8f1c9a6` → no output
- [ ] `grep -rn "Illustrative example" web/src` → no output
- [ ] `grep -rnE "normalCurve|thisSeasonCurve|defaultMultiplier|contextNote" web/src/lib --exclude='*.test.ts'` → no output
      (the registry-integrity test names these fields on purpose)
- [ ] `grep -rnE "Math\.random|rand\(\)" web/src/components/agent web/src/lib/agentEngine.ts` → no output
- [ ] `grep -nE "[0-9]+(\.[0-9]+)? ?(%|°C|µg|years|weeks|cm)" web/src/pages/CropsPage.tsx` → no output
- [ ] Every case in the two X5 files still exists: `grep -cE "^\s+it\(" web/src/lib/agentEngine.test.ts` → at least 9,
      and `grep -c "query:" web/src/lib/autonomousBattery.test.ts` → at least 12 (the counts at `8f1c9a6`)
- [ ] The command table (section 5) passes
- [ ] `docs/VERIFICATION.md` has the RD-1 and RD-2 rows, unsigned
- [ ] The hand checks in B and C done; Phase R's status row reads BLOCKED (gate) or DONE

## 11. STOP conditions

- A Bangladesh registry entry has no district match, or a place outside Bangladesh cannot be mapped to Natural Earth
  units (B1).
- A district named here is missing from `aoi/districts.geojson` under that name.
- An outside figure has no source you could open (section 6, step 4).
- Any step would fetch, download or display fire values outside Bangladesh before Amendment 5 is committed (Phase R).
- A test outside those named in section 7 fails and three substantively different fixes do not fix it: append to
  `docs/BLOCKERS.md` as `CLAUDE.md` says; do not change that test.
- Drawing the map dots would need anything other than `grid/` tiles (invariant 3).

## 12. Maintenance notes

- `seasonToDateRatio` is descriptive. If the team wants a "× normal" verdict with a threshold, that is a new test and
  needs a pre-registration amendment first.
- `cropSources.ts` and `newsRecords.ts` are checked by tests for internal consistency only; whether a quote still
  appears at its URL is the VERIFICATION rows' job. Re-check them before each public release.
- The registry and `kilnwatch/ask.py`'s `find_area` both resolve place names; keep the Bangladesh unit list and the
  district-before-upazila rule consistent.
- When the live season file gains upazilas, drop the "figures are for the whole of <district>" fallback.
- Phase R changes what the stage shows outside Bangladesh per country as each passes its tests; the badges and
  labels in B6–B8 must follow `regions.json`'s `harmonized` flag, never assume it.

## 13. Corrections from the cold-read review (2026-10-13) — these supersede earlier text

A fresh-context reader dry-ran Phases A–E against `8f1c9a6`. Each finding was re-checked in the code; the rulings
below are binding where they conflict with sections 3–10.

1. **Chittagong Hill Tracts (B1).** Registry key `chattogram` (`regionRegistry.ts:873`) is named "Chittagong Hill
   Tracts" but holds Chattogram district's coordinates and the aliases `chittagong`, `chittagong hill tracts`,
   `cht`, `jhum`; the jhum/CHT fallback (`:8486`) returns it. Ruling: `chattogram` → `BD2015`, named
   "Chattogram, Bangladesh", aliases `chattogram`, `চট্টগ্রাম`, `chittagong`. The aliases `chittagong hill tracts`,
   `cht`, `jhum` move to `bandarban` (`BD2003`, `alsoUnits: ['BD2084', 'BD2046']`), and the fallback returns
   `bandarban`. 64 Bangladesh entries keep 64 distinct `unit_id`s. The CHT preset resolves to Bandarban.
2. **Seasons (B6, B7, C2).** `cal.seasons` lists only seasons with a measurable midpoint, with gaps, and can include
   the live season. Ruling: complete seasons are `seasonOf(day)` labels from the calendar's first day to the season
   before `nrt.season`; "last 5 complete seasons" uses that list; counts of seasons come from it. The normal's
   reference seasons are not exported (`kilnwatch/metrics.py:78`), so texts say "the day-of-season normal from the
   record since 2003", never a season range.
3. **Ratio (A3).** `seasonMean` includes the live season. Ruling: `seasonMean(cal, values, before?)` gains an optional
   season label; days in that season or later are skipped. `seasonToDateRatio(cal, live, season)` passes
   `nrt.season`. `monthlyMeans` keeps the existing `toPrecision(3)` rounding. `normalP90` is labelled "typical high
   (monthly mean of the daily 90th-percentile normal)".
4. **Split labels (C2).** Keys differ by fixture set (`aman`/`boro`/`other` in `nokiln`; `kiln`/`vegetation`/`unknown`
   in `full`). All split text renders from `meta.split_labels`; nothing names Aman/Boro in code except the
   `events.harvest` crop keys already used elsewhere.
5. **Numeric guard test (B-tests).** The headline context is `facts` plus the strings it quotes (`nrt.season`, the
   first record year `2003`, `dataTo`). The test passes that full context.
6. **News records (B7, C-tests).** One shape for `NEWS_RECORDS`: `{ id, place_key, date, title, publisher, url,
   summary, quote, checked }`. Mapping to `HistoricalNews`: `year` = `date` year, `date` = `date`, `source` =
   `publisher`, `summary` = `summary`, `url` = `url`, `severity` = `'info'`. The C-test checks apply (url, quote,
   numbers ⊆ quote, ISO dates, unique ids, `place_key` in the registry).
7. **Props (B3–B6).** The page owns data; components draw:
   - `AgentCinematicStage`: `{ res: AgentResolution | null; cells: {lat: number; lon: number}[]; ambient: {lat: number; lon: number}[]; ready: boolean; onAsk: (q: string) => void }`; it keeps its timeline state and restarts it when `res` changes; `onQueryChange` becomes `onAsk`.
   - `AgentAnimatedMap`: adds `cells`, `ambient`, `caption`.
   - `AgentStepperPanel`: adds `steps: AgentStep[]`; each tick shows when both its timeline moment has passed and `step.status === 'completed'`; a `'pending'` step after the timeline shows a neutral icon and its detail.
   - `AgentAnimatedChart`: as B4.
8. **World geometry (B3).** For `ne` places the page also loads `aoi/world_states.geojson` and
   `aoi/world_countries.geojson`, only when such a place is asked about.
9. **`parseUserQuery` (B2).** Stays exported as `parseUserQuery(query, data?: Partial<StageData>)` =
   `buildResolution(resolveQuery(query), { ...EMPTY_STAGE_DATA, ...data })`. With no data it returns names, intent and
   an empty, unmeasured resolution; both X5 test files keep calling it.
10. **Grid freshness (B5, C6).** Grid tiles come from the main pipeline only (`kilnwatch/pipeline.py:344-356`),
    Aqua and Suomi NPP rows only; the daily job does not update them. The map caption states the last grid day
    (`max(row.day)` over the loaded tiles), not "this season so far".
11. **Inventory additions.** Also replace with real data or data-built text: `AgentNewsCanvas.tsx` footer ("23-Year
    Satellite Context … align with verified FIRMS cluster anomalies") and its `:11` label; `AgentAnimatedChart.tsx`
    "Yes," (`:264`), "SOURCES: NASA FIRMS · MODIS · VIIRS" (`:275`), "23-YEAR NORMAL", the SEP–DEC axis; Crops page
    `:62` "across South Asia and the globe", `:75` "precise dates … upazila level", `:97` real-time alerts claim,
    `:250-252`/`:273` the satellite chain text (the record is Aqua ← Suomi NPP ← NOAA-20; Terra is not in it);
    `AskPage.tsx:185` "About the example above". News item count is 133 across 121 arrays.
12. **Upazilas on the stage.** The registry has no upazila entries; the stage resolves registry places only. The
    upazila wording in B2 and the B-tests is dropped.
13. **C7 text.** The PM2.5 line uses `CIText` for the interval and no literal "95%".
14. **cropSources shape.** `{ id, kind: 'statement' | 'window', text, months?: number[], url, publisher, title,
    quote, checked }`.
15. **Scope.** `docs/README.md` (the index line for this plan) is in scope. E3 must not delete fixture files; if the
    refreshed release lacks a file the old copy had, STOP.
16. **Tests (X5).** Changing these tests' expected values is part of this plan, which the operator asked to be
    implemented; the change is recorded in the hand-off. No case is removed.
17. **R1.** Use the FIRMS bulk archive downloads the amendment draft names, not the 5-day Area API (57 places × 23
    years would be about 100k quota-paced calls).
