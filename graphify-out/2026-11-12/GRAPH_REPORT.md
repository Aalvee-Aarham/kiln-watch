# Graph Report - nasa argon  (2026-11-12)

## Corpus Check
- 46 files · ~113,305 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 4, .glb 3, .css 2)

## Summary
- 898 nodes · 2008 edges · 42 communities (41 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.88)
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
- firms.py
- news.py
- versus_history
- draco_wasm_wrapper.js
- tools.py
- compilerOptions
- Home.tsx
- A
- StoryCharts.tsx
- Kiln Watch
- Improvements, Round 2 — MODIS/VIIRS Fire Harmonization Brief
- datetime
- refresh_if_stale
- Improvements Only — MODIS/VIIRS Fire Harmonization Brief
- Map.tsx
- scene.ts
- test_science.py
- Timeline.tsx
- _denial_modis
- ordinal
- iso-kit.ts
- api.ts
- SatelliteFigure.tsx
- shared.tsx
- Warning.tsx
- story.ts
- Kiln Watch — agent notes
- iso
- pathOf
- extrude
- onTop
- axesAt
- escape

## God Nodes (most connected - your core abstractions)
1. `build_region()` - 41 edges
2. `App()` - 32 edges
3. `Home()` - 23 edges
4. `fmt()` - 22 edges
5. `w()` - 20 edges
6. `l()` - 19 edges
7. `A()` - 18 edges
8. `_r()` - 17 edges
9. `react` - 17 edges
10. `_guard()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Science guardrails (from the brief review — do not regress)` --references--> `sensor_days()`  [INFERRED]
  CLAUDE.md → server/kw/firms.py
- `Stage 12: Zero-Inflated Negative Binomial (ZINB) Hurdle + Empirical Bayes `combine` Calibration` --references--> `combine()`  [INFERRED]
  harmonized_fire_calendar_web_app_master_prompt (1).md → server/kw/science.py
- `Layout` --references--> `warning_level()`  [INFERRED]
  CLAUDE.md → server/kw/science.py
- `Layout` --references--> `early_warning()`  [INFERRED]
  CLAUDE.md → server/kw/tools.py
- `Phase 2: pages and early warning` --references--> `early_warning()`  [INFERRED]
  README.md → server/kw/tools.py

## Import Cycles
- None detected.

## Communities (42 total, 1 thin omitted)

### Community 0 - "api.py"
Cohesion: 0.09
Nodes (24): alert_create(), alert_delete(), alert_poll(), alert_status(), alert_workflow(), aoi(), aoi_status(), ask() (+16 more)

### Community 1 - "App.tsx"
Cohesion: 0.11
Nodes (26): react, Analyst(), Msg, SUGGEST, AgentReply, api, Health, SCALE_LABEL (+18 more)

### Community 2 - "alerts.py"
Cohesion: 0.13
Nodes (15): check(), create(), delete(), get(), _label(), _load(), _message(), _save() (+7 more)

### Community 3 - "build.py"
Cohesion: 0.13
Nodes (23): _active(), _aggregate(), _answers(), _band(), _block(), build_region(), _code_version(), _collection_updated() (+15 more)

### Community 4 - "package.json"
Cohesion: 0.06
Nodes (35): react-dom, three, @types/geojson, @types/react, @types/react-dom, @types/three, typescript, vite (+27 more)

### Community 5 - "3. The 14-Stage Global Harmonization Engine (Complete Mathematical Specification)"
Cohesion: 0.07
Nodes (28): 1. System Role & Copy-Paste Master Prompt Header, 2.1 Answering the 5 Key Questions from NASA Space Apps GitHub Discussions (`#1786` & `#1879`), 2. Competitive Landscape & Official NASA Space Apps Discussion Insights, 3. The 14-Stage Global Harmonization Engine (Complete Mathematical Specification), 4.1 Why Standard Google Search or Live LLM Web Search Fails at Global Scale, 4.2 The 4-Layer H3-Indexed Geo-News & Event RAG Architecture, 4.3 Pre-Built BigQuery SQL Script to Generate the 26-Year Global GDELT H3 Fire News Cube, 4. Scalable, Area-Specific, Multilingual Geo-News Ground-Truthing Architecture (+20 more)

### Community 6 - "Record.tsx"
Cohesion: 0.12
Nodes (36): Layout, compact(), diverging(), downloadSvg(), heat(), mix(), pick(), textOn() (+28 more)

### Community 7 - "science.py"
Cohesion: 0.13
Nodes (17): main(), transfer_validation(), _trends(), calendar_month(), _check_q(), metrics(), _norm_sf(), quantile_map() (+9 more)

### Community 8 - "mcp_server.py"
Cohesion: 0.09
Nodes (15): Phase 2: pages and early warning, audit_sensor_harmonization(), check_alert(), check_watchlist(), create_alert(), create_custom_area(), find_anomalies(), get_active_wildfire_events() (+7 more)

### Community 9 - "firms.py"
Cohesion: 0.17
Nodes (14): _load_global(), one(), connect(), current_year(), fetch_region(), fetch_year(), _fresh(), one() (+6 more)

### Community 10 - "news.py"
Cohesion: 0.08
Nodes (26): ask(), available(), _call(), classify_headlines(), _post(), assess(), _cached(), eonet() (+18 more)

### Community 11 - "versus_history"
Cohesion: 0.15
Nodes (10): percentile_rank(), recency_weights(), season_index(), versus_history(), warning_level(), weighted_median(), weighted_percentile_rank(), test_recency_weighted_history() (+2 more)

### Community 12 - "draco_wasm_wrapper.js"
Cohesion: 0.11
Nodes (26): B(), C(), D(), E(), f(), e(), G(), H() (+18 more)

### Community 13 - "tools.py"
Cohesion: 0.11
Nodes (19): get_area_summary(), search_fire_reports(), _block(), _detections(), early_warning(), evidence(), find_anomalies(), get_calendar() (+11 more)

### Community 14 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noUnusedLocals, skipLibCheck (+4 more)

### Community 15 - "Home.tsx"
Cohesion: 0.15
Nodes (22): Events, ConsoleData, PastAlert, Arrow(), B, CHAPTERS, Count(), countUp() (+14 more)

### Community 17 - "StoryCharts.tsx"
Cohesion: 0.19
Nodes (13): Block, Meta, annual(), BIG, CAM, JumpChart(), LAUNCH, litCells() (+5 more)

### Community 18 - "Kiln Watch"
Cohesion: 0.20
Nodes (8): AI use log, Data and credits, How the harmonization works, Kiln Watch, Limitations and known issues, Research question and main result, Run it, What it does

### Community 19 - "Improvements, Round 2 — MODIS/VIIRS Fire Harmonization Brief"
Cohesion: 0.20
Nodes (9): A. Eligibility and rules — settle these first, B. Facts both files get wrong or miss (as of 2026-11-10), C. Harmonization method, D. Validation that experts cannot wave away, E. Calendar and product — match the challenge wording, F. Technology and AI, G. Competition positioning, Improvements, Round 2 — MODIS/VIIRS Fire Harmonization Brief (+1 more)

### Community 20 - "datetime"
Cohesion: 0.16
Nodes (9): _coverage(), _cutover(), _denial_snpp(), month_key(), period_bounds(), periods(), week_key(), test_iso_week_boundaries() (+1 more)

### Community 21 - "refresh_if_stale"
Cohesion: 0.19
Nodes (9): write_index(), envelopes(), validate_bbox(), aoi_id(), refresh_if_stale(), run(), start_aoi(), run() (+1 more)

### Community 22 - "Improvements Only — MODIS/VIIRS Fire Harmonization Brief"
Cohesion: 0.29
Nodes (6): Improvements Only — MODIS/VIIRS Fire Harmonization Brief, P0 — Correct the scientific and factual foundation, P1 — Focus the product on a compelling, reliable demo, P1 — Make the harmonization defensible and testable, P2 — Improve competition positioning with verifiable differentiation, Research sources consulted

### Community 23 - "Map.tsx"
Cohesion: 0.18
Nodes (12): maplibre-gl, RegionItem, Basemap, box(), EMPTY, FIRE_LAYERS, Focus, Layers (+4 more)

### Community 24 - "scene.ts"
Cohesion: 0.12
Nodes (18): additive, BEATS, BLUE, glowTexture(), ISO, K, KF, mountScene() (+10 more)

### Community 25 - "test_science.py"
Cohesion: 0.19
Nodes (8): Stage 12: Zero-Inflated Negative Binomial (ZINB) Hurdle + Empirical Bayes `combine` Calibration, article_fire_check(), match_months(), combine(), test_article_fire_check(), test_combine(), test_match_months_verdict(), test_metrics()

### Community 26 - "Timeline.tsx"
Cohesion: 0.22
Nodes (10): Cls, SENSOR_COLOR, SENSOR_LABEL, FALLBACK_START, LANES, Props, START, Timeline() (+2 more)

### Community 27 - "_denial_modis"
Cohesion: 0.24
Nodes (8): _calibrate(), _chain(), _denial_modis(), _pairs(), _value(), ratio_calibration(), test_calibration_recovers_ratio_and_handles_zero(), test_shrinkage_pulls_sparse_month_to_pooled()

### Community 28 - "ordinal"
Cohesion: 0.51
Nodes (9): ordinal(), AskScreen(), monthName(), n0(), pctile(), Phone(), ramp(), useClock() (+1 more)

### Community 29 - "iso-kit.ts"
Cohesion: 0.06
Nodes (31): axisVector(), AZIMUTH, Camera, ELEVATION, ExtrudeOptions, Faded, FadeLineStyle, FigureOptions (+23 more)

### Community 30 - "api.ts"
Cohesion: 0.07
Nodes (37): AlertState, AlertSub, ArticleFire, Band, ClassBlock, Evidence, Grid, History (+29 more)

### Community 31 - "SatelliteFigure.tsx"
Cohesion: 0.07
Nodes (26): B, BUS_L, BUS_U, E1, E2, E3, HTML, K (+18 more)

### Community 32 - "shared.tsx"
Cohesion: 0.14
Nodes (25): Level, LEVEL_LABEL, Region, Mcp(), N8n(), TOOLS, COLS, Create() (+17 more)

### Community 33 - "Warning.tsx"
Cohesion: 0.21
Nodes (20): fmt(), periodLabel(), Warning, Warnings, Articles(), RangeNews(), LevelChip(), saveAlerts() (+12 more)

### Community 34 - "story.ts"
Cohesion: 0.25
Nodes (8): gsap, lenis, Block, easeOut(), mountStory(), Playhead, Story, StoryOpts

### Community 35 - "Kiln Watch — agent notes"
Cohesion: 0.40
Nodes (4): Commands, Kiln Watch — agent notes, Science guardrails (from the brief review — do not regress), Token rule (always)

### Community 36 - "iso"
Cohesion: 0.16
Nodes (15): cameraOf(), coil(), depthOf(), dotGrid(), fitProjection(), iso(), knurl(), pointsAt() (+7 more)

### Community 37 - "pathOf"
Cohesion: 0.25
Nodes (11): attrs(), dotsSvg(), fadedSvg(), fadeLineSvg(), figureSvg(), groupSvg(), lineSvg(), pathOf() (+3 more)

### Community 38 - "extrude"
Cohesion: 0.24
Nodes (11): convexHull(), extrude(), haloOf(), oriented(), ringOf(), ringSeam(), roundedPlan(), runsOf() (+3 more)

### Community 40 - "onTop"
Cohesion: 0.25
Nodes (8): circleRing(), cylinder(), lineOnTop(), onTop(), planOutline(), radialTicks(), ring(), topTicks()

### Community 41 - "axesAt"
Cohesion: 0.50
Nodes (5): axesAt(), matrixOf(), sideMatrix(), thousandth(), topMatrix()

### Community 42 - "escape"
Cohesion: 0.40
Nodes (5): escape(), faceTextSvg(), pageHtml(), plateHtml(), swatchSvg()

## Knowledge Gaps
- **200 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+195 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 330 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Layout` connect `Record.tsx` to `Warning.tsx`, `Kiln Watch — agent notes`, `versus_history`, `tools.py`, `api.ts`?**
  _High betweenness centrality (0.464) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _200 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api.py` be split into smaller, more focused modules?**
  _Cohesion score 0.09390243902439024 - nodes in this community are weakly interconnected._
- **Why does `early_warning()` connect `tools.py` to `mcp_server.py`, `alerts.py`, `versus_history`, `Record.tsx`?**
  _High betweenness centrality (0.302) - this node is a cross-community bridge._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10967741935483871 - nodes in this community are weakly interconnected._
- **Why does `Warning` connect `Warning.tsx` to `ordinal`, `Home.tsx`, `Record.tsx`, `api.ts`?**
  _High betweenness centrality (0.192) - this node is a cross-community bridge._
- **Should `alerts.py` be split into smaller, more focused modules?**
  _Cohesion score 0.1349206349206349 - nodes in this community are weakly interconnected._