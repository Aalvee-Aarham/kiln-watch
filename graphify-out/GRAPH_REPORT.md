# Graph Report - nasa argon  (2026-11-12)

## Corpus Check
- 52 files · ~131,300 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 4, .glb 3, .css 2)

## Summary
- 1125 nodes · 2625 edges · 47 communities (46 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 53 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- api.py
- App.tsx
- alerts.py
- build.py
- package.json
- 3. The 14-Stage Global Harmonization Engine (Complete Mathematical Specification)
- Record.tsx
- science.py
- mcp_server.py
- tools.py
- news.py
- versus_history
- draco_wasm_wrapper.js
- _block
- compilerOptions
- Home.tsx
- News.tsx
- StoryCharts.tsx
- Kiln Watch
- Improvements, Round 2 — MODIS/VIIRS Fire Harmonization Brief
- period_bounds
- charts.py
- Improvements Only — MODIS/VIIRS Fire Harmonization Brief
- Warning.tsx
- scene.ts
- test_science.py
- Timeline.tsx
- ratio_calibration
- ordinal
- iso-kit.ts
- api.ts
- SatelliteFigure.tsx
- shared.tsx
- Detail.tsx
- story.ts
- _read
- iso
- pathOf
- extrude
- early_warning
- onTop
- axesAt
- escape
- _persona
- NotFound
- annual
- get_sensor_status

## God Nodes (most connected - your core abstractions)
1. `build_region()` - 41 edges
2. `App()` - 36 edges
3. `fmt()` - 30 edges
4. `Home()` - 23 edges
5. `_guard()` - 21 edges
6. `react` - 20 edges
7. `w()` - 20 edges
8. `l()` - 19 edges
9. `check()` - 18 edges
10. `A()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Science guardrails (from the brief review — do not regress)` --references--> `sensor_days()`  [INFERRED]
  CLAUDE.md → server/kw/firms.py
- `Phase 3: globe, 30-day outlook, email, Claude characters` --references--> `find_place()`  [INFERRED]
  README.md → server/kw/mcp_server.py
- `Phase 3: globe, 30-day outlook, email, Claude characters` --references--> `get_fire_outlook()`  [INFERRED]
  README.md → server/kw/mcp_server.py
- `Phase 3: globe, 30-day outlook, email, Claude characters` --references--> `get_situation_brief()`  [INFERRED]
  README.md → server/kw/mcp_server.py
- `Phase 3: globe, 30-day outlook, email, Claude characters` --references--> `get_sensor_status()`  [INFERRED]
  README.md → server/kw/mcp_server.py

## Import Cycles
- None detected.

## Communities (47 total, 1 thin omitted)

### Community 0 - "api.py"
Cohesion: 0.06
Nodes (41): alert_confirm(), alert_create(), alert_delete(), alert_poll(), alert_send_test(), alert_status(), alert_unsubscribe(), alert_workflow() (+33 more)

### Community 1 - "App.tsx"
Cohesion: 0.15
Nodes (24): Health, Outlook, SCALE_LABEL, Warnings, App(), clampDate(), day(), EwBanner() (+16 more)

### Community 2 - "alerts.py"
Cohesion: 0.08
Nodes (34): check(), confirm(), create(), delete(), deliver_all(), _digest(), _events(), get() (+26 more)

### Community 3 - "build.py"
Cohesion: 0.11
Nodes (28): _active(), _aggregate(), _answers(), _band(), _block(), build_region(), _calibrate(), _chain() (+20 more)

### Community 4 - "package.json"
Cohesion: 0.06
Nodes (35): maplibre-gl, three, @types/geojson, @types/react, @types/react-dom, @types/three, typescript, vite (+27 more)

### Community 5 - "3. The 14-Stage Global Harmonization Engine (Complete Mathematical Specification)"
Cohesion: 0.07
Nodes (28): 1. System Role & Copy-Paste Master Prompt Header, 2.1 Answering the 5 Key Questions from NASA Space Apps GitHub Discussions (`#1786` & `#1879`), 2. Competitive Landscape & Official NASA Space Apps Discussion Insights, 3. The 14-Stage Global Harmonization Engine (Complete Mathematical Specification), 4.1 Why Standard Google Search or Live LLM Web Search Fails at Global Scale, 4.2 The 4-Layer H3-Indexed Geo-News & Event RAG Architecture, 4.3 Pre-Built BigQuery SQL Script to Generate the 26-Year Global GDELT H3 Fire News Cube, 4. Scalable, Area-Specific, Multilingual Geo-News Ground-Truthing Architecture (+20 more)

### Community 6 - "Record.tsx"
Cohesion: 0.10
Nodes (40): compact(), diverging(), heat(), Metric, mix(), MONTH_SHORT, MONTHS, pick() (+32 more)

### Community 7 - "science.py"
Cohesion: 0.18
Nodes (13): _season(), _trends(), _check_q(), metrics(), _norm_sf(), quantile_map(), quantiles(), _ranks() (+5 more)

### Community 8 - "mcp_server.py"
Cohesion: 0.09
Nodes (17): about(), _base(), create_alert(), create_custom_area(), find_place(), get_active_wildfire_events(), get_area_summary(), get_fire_outlook() (+9 more)

### Community 9 - "tools.py"
Cohesion: 0.06
Nodes (38): Commands, Kiln Watch — agent notes, Science guardrails (from the brief review — do not regress), Token rule (always), _outlook(), _load_global(), one(), write_index() (+30 more)

### Community 10 - "news.py"
Cohesion: 0.06
Nodes (35): _call(), classify_headlines(), _post(), assess(), _cached(), eonet(), gdelt(), _gdelt_get() (+27 more)

### Community 11 - "versus_history"
Cohesion: 0.15
Nodes (10): percentile_rank(), recency_weights(), season_index(), versus_history(), warning_level(), weighted_median(), weighted_percentile_rank(), test_recency_weighted_history() (+2 more)

### Community 12 - "draco_wasm_wrapper.js"
Cohesion: 0.08
Nodes (26): A(), B(), C(), D(), E(), f(), e(), G() (+18 more)

### Community 13 - "_block"
Cohesion: 0.18
Nodes (9): anomalies(), find_anomalies(), get_harmonized_calendar(), get_period(), _block(), find_anomalies(), get_calendar(), get_period() (+1 more)

### Community 14 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noUnusedLocals, skipLibCheck (+4 more)

### Community 15 - "Home.tsx"
Cohesion: 0.14
Nodes (22): R(), ConsoleData, PastAlert, Arrow(), B, CHAPTERS, Count(), countUp() (+14 more)

### Community 16 - "News.tsx"
Cohesion: 0.20
Nodes (17): Events, LatestNews, PlaceNews, LATE, Loader(), STEPS, Create(), iso() (+9 more)

### Community 17 - "StoryCharts.tsx"
Cohesion: 0.19
Nodes (13): Block, Meta, annual(), BIG, CAM, JumpChart(), LAUNCH, litCells() (+5 more)

### Community 18 - "Kiln Watch"
Cohesion: 0.20
Nodes (8): AI use log, Data and credits, How the harmonization works, Kiln Watch, Limitations and known issues, Research question and main result, Run it, What it does

### Community 19 - "Improvements, Round 2 — MODIS/VIIRS Fire Harmonization Brief"
Cohesion: 0.20
Nodes (9): A. Eligibility and rules — settle these first, B. Facts both files get wrong or miss (as of 2026-11-10), C. Harmonization method, D. Validation that experts cannot wave away, E. Calendar and product — match the challenge wording, F. Technology and AI, G. Competition positioning, Improvements, Round 2 — MODIS/VIIRS Fire Harmonization Brief (+1 more)

### Community 20 - "period_bounds"
Cohesion: 0.15
Nodes (8): _coverage(), _cutover(), calendar_month(), period_bounds(), step_ratio(), side(), week_key(), test_iso_week_boundaries()

### Community 21 - "charts.py"
Cohesion: 0.16
Nodes (14): ask(), available(), _hotspots(), ask(), auto(), box_daily(), build(), month_across_years() (+6 more)

### Community 22 - "Improvements Only — MODIS/VIIRS Fire Harmonization Brief"
Cohesion: 0.29
Nodes (6): Improvements Only — MODIS/VIIRS Fire Harmonization Brief, P0 — Correct the scientific and factual foundation, P1 — Focus the product on a compelling, reliable demo, P1 — Make the harmonization defensible and testable, P2 — Improve competition positioning with verifiable differentiation, Research sources consulted

### Community 23 - "Warning.tsx"
Cohesion: 0.08
Nodes (43): Layout, AlertState, fmt(), Trigger, Warning, OutlookKey(), addOutlookLayers(), Basemap (+35 more)

### Community 24 - "scene.ts"
Cohesion: 0.12
Nodes (18): additive, BEATS, BLUE, glowTexture(), ISO, K, KF, mountScene() (+10 more)

### Community 25 - "test_science.py"
Cohesion: 0.10
Nodes (18): Stage 12: Zero-Inflated Negative Binomial (ZINB) Hurdle + Empirical Bayes `combine` Calibration, Phase 3: globe, 30-day outlook, email, Claude characters, _date(), get_gdacs_wildfires(), query_hotspots(), search_news_for_place(), article_fire_check(), match_months() (+10 more)

### Community 26 - "Timeline.tsx"
Cohesion: 0.22
Nodes (10): Cls, SENSOR_COLOR, SENSOR_LABEL, FALLBACK_START, LANES, Props, START, Timeline() (+2 more)

### Community 27 - "ratio_calibration"
Cohesion: 0.29
Nodes (5): main(), transfer_validation(), ratio_calibration(), test_calibration_recovers_ratio_and_handles_zero(), test_shrinkage_pulls_sparse_month_to_pooled()

### Community 28 - "ordinal"
Cohesion: 0.51
Nodes (9): ordinal(), AskScreen(), monthName(), n0(), pctile(), Phone(), ramp(), useClock() (+1 more)

### Community 29 - "iso-kit.ts"
Cohesion: 0.06
Nodes (31): axisVector(), AZIMUTH, Camera, ELEVATION, ExtrudeOptions, Faded, FadeLineStyle, FigureOptions (+23 more)

### Community 30 - "api.ts"
Cohesion: 0.06
Nodes (37): Analyst(), Answer(), AREA_SUGGEST, highlight(), inline(), Markdown(), Msg, TOOL_LABEL (+29 more)

### Community 31 - "SatelliteFigure.tsx"
Cohesion: 0.07
Nodes (26): B, BUS_L, BUS_U, E1, E2, E3, HTML, K (+18 more)

### Community 32 - "shared.tsx"
Cohesion: 0.10
Nodes (30): react, react-dom, api, Level, LEVEL_LABEL, Persona, Region, RegionItem (+22 more)

### Community 33 - "Detail.tsx"
Cohesion: 0.18
Nodes (17): Evidence, OBSERVERS, periodLabel(), RangeReports, Reports, Scale, SCALE_UNIT, SHORT (+9 more)

### Community 34 - "story.ts"
Cohesion: 0.25
Nodes (8): gsap, lenis, Block, easeOut(), mountStory(), Playhead, Story, StoryOpts

### Community 35 - "_read"
Cohesion: 0.12
Nodes (12): audit_sensor_harmonization(), brief_res(), get_season_profile(), get_situation_brief(), search_fire_reports(), audit(), briefing(), _iso_week() (+4 more)

### Community 36 - "iso"
Cohesion: 0.16
Nodes (15): cameraOf(), coil(), depthOf(), dotGrid(), fitProjection(), iso(), knurl(), pointsAt() (+7 more)

### Community 37 - "pathOf"
Cohesion: 0.25
Nodes (11): attrs(), dotsSvg(), fadedSvg(), fadeLineSvg(), figureSvg(), groupSvg(), lineSvg(), pathOf() (+3 more)

### Community 38 - "extrude"
Cohesion: 0.24
Nodes (11): convexHull(), extrude(), haloOf(), oriented(), ringOf(), ringSeam(), roundedPlan(), runsOf() (+3 more)

### Community 39 - "early_warning"
Cohesion: 0.16
Nodes (8): Phase 2: pages and early warning, recent_weeks(), check_alert(), check_watchlist(), get_early_warning(), early_warning(), _next_weeks(), warnings()

### Community 40 - "onTop"
Cohesion: 0.25
Nodes (8): circleRing(), cylinder(), lineOnTop(), onTop(), planOutline(), radialTicks(), ring(), topTicks()

### Community 41 - "axesAt"
Cohesion: 0.50
Nodes (5): axesAt(), matrixOf(), sideMatrix(), thousandth(), topMatrix()

### Community 42 - "escape"
Cohesion: 0.40
Nodes (5): escape(), faceTextSvg(), pageHtml(), plateHtml(), swatchSvg()

### Community 43 - "_persona"
Cohesion: 0.27
Nodes (5): community_liaison(), fact_checker(), fire_manager(), fire_scientist(), _persona()

### Community 44 - "NotFound"
Cohesion: 0.22
Nodes (5): get_custom_area_status(), search_timeline_reports(), aoi_status(), NotFound, timeline_reports()

### Community 45 - "annual"
Cohesion: 0.22
Nodes (5): annual(), compare_areas(), get_annual_series(), annual(), compare_areas()

## Knowledge Gaps
- **213 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+208 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 400 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Layout` connect `Warning.tsx` to `Record.tsx`, `early_warning`, `tools.py`, `versus_history`, `News.tsx`, `test_science.py`?**
  _High betweenness centrality (0.481) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _213 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api.py` be split into smaller, more focused modules?**
  _Cohesion score 0.05706760316066725 - nodes in this community are weakly interconnected._
- **Why does `early_warning()` connect `early_warning` to `alerts.py`, `_read`, `tools.py`, `versus_history`, `annual`, `Warning.tsx`?**
  _High betweenness centrality (0.264) - this node is a cross-community bridge._
- **Should `alerts.py` be split into smaller, more focused modules?**
  _Cohesion score 0.08144796380090498 - nodes in this community are weakly interconnected._
- **Why does `Warning` connect `Warning.tsx` to `ordinal`, `api.ts`, `Home.tsx`?**
  _High betweenness centrality (0.223) - this node is a cross-community bridge._
- **Should `build.py` be split into smaller, more focused modules?**
  _Cohesion score 0.11463414634146342 - nodes in this community are weakly interconnected._