# Graph Report - nasa argon  (2026-11-11)

## Corpus Check
- 45 files · ~111,098 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 4, .glb 3, .css 2)

## Summary
- 887 nodes · 1985 edges · 42 communities (41 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.89)
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
- early_warning
- Kiln Watch
- Improvements, Round 2 — MODIS/VIIRS Fire Harmonization Brief
- test_science.py
- start_aoi
- Improvements Only — MODIS/VIIRS Fire Harmonization Brief
- Map.tsx
- scene.ts
- _denial_modis
- Timeline.tsx
- calendar_month
- devDependencies
- iso-kit.ts
- api.ts
- SatelliteFigure.tsx
- shared.tsx
- Warning.tsx
- dependencies
- scripts
- iso
- pathOf
- extrude
- onTop
- axesAt
- escape

## God Nodes (most connected - your core abstractions)
1. `build_region()` - 41 edges
2. `App()` - 32 edges
3. `fmt()` - 22 edges
4. `w()` - 20 edges
5. `Home()` - 20 edges
6. `l()` - 19 edges
7. `A()` - 18 edges
8. `_r()` - 17 edges
9. `react` - 17 edges
10. `_guard()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Science guardrails (from the brief review — do not regress)` --references--> `sensor_days()`  [INFERRED]
  CLAUDE.md → server/kw/firms.py
- `Phase 2: pages and early warning` --references--> `check_alert()`  [INFERRED]
  README.md → server/kw/mcp_server.py
- `Stage 12: Zero-Inflated Negative Binomial (ZINB) Hurdle + Empirical Bayes `combine` Calibration` --references--> `combine()`  [INFERRED]
  harmonized_fire_calendar_web_app_master_prompt (1).md → server/kw/science.py
- `Layout` --references--> `warning_level()`  [INFERRED]
  CLAUDE.md → server/kw/science.py
- `Layout` --references--> `early_warning()`  [INFERRED]
  CLAUDE.md → server/kw/tools.py

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
Cohesion: 0.14
Nodes (14): check(), create(), delete(), get(), _label(), _load(), _message(), _save() (+6 more)

### Community 3 - "build.py"
Cohesion: 0.11
Nodes (24): _active(), _aggregate(), _answers(), build_region(), _code_version(), _collection_updated(), _coverage(), _drift() (+16 more)

### Community 4 - "package.json"
Cohesion: 0.11
Nodes (17): gsap, lenis, react-dom, three, @types/geojson, @types/react, @types/react-dom, @types/three (+9 more)

### Community 5 - "3. The 14-Stage Global Harmonization Engine (Complete Mathematical Specification)"
Cohesion: 0.07
Nodes (28): 1. System Role & Copy-Paste Master Prompt Header, 2.1 Answering the 5 Key Questions from NASA Space Apps GitHub Discussions (`#1786` & `#1879`), 2. Competitive Landscape & Official NASA Space Apps Discussion Insights, 3. The 14-Stage Global Harmonization Engine (Complete Mathematical Specification), 4.1 Why Standard Google Search or Live LLM Web Search Fails at Global Scale, 4.2 The 4-Layer H3-Indexed Geo-News & Event RAG Architecture, 4.3 Pre-Built BigQuery SQL Script to Generate the 26-Year Global GDELT H3 Fire News Cube, 4. Scalable, Area-Specific, Multilingual Geo-News Ground-Truthing Architecture (+20 more)

### Community 6 - "Record.tsx"
Cohesion: 0.13
Nodes (33): compact(), diverging(), downloadSvg(), heat(), mix(), pick(), textOn(), annual() (+25 more)

### Community 7 - "science.py"
Cohesion: 0.15
Nodes (17): _calibrate(), _frp_distribution(), _trends(), _check_q(), metrics(), _norm_sf(), quantile_map(), quantiles() (+9 more)

### Community 8 - "mcp_server.py"
Cohesion: 0.10
Nodes (13): audit_sensor_harmonization(), check_alert(), create_custom_area(), find_anomalies(), get_active_wildfire_events(), get_area_summary(), get_custom_area_status(), get_harmonized_calendar() (+5 more)

### Community 9 - "firms.py"
Cohesion: 0.15
Nodes (14): _load_global(), one(), connect(), current_year(), fetch_region(), fetch_year(), _fresh(), one() (+6 more)

### Community 10 - "news.py"
Cohesion: 0.08
Nodes (26): ask(), available(), _call(), classify_headlines(), _post(), assess(), _cached(), eonet() (+18 more)

### Community 11 - "versus_history"
Cohesion: 0.15
Nodes (10): percentile_rank(), recency_weights(), season_index(), versus_history(), warning_level(), weighted_median(), weighted_percentile_rank(), test_recency_weighted_history() (+2 more)

### Community 12 - "draco_wasm_wrapper.js"
Cohesion: 0.11
Nodes (25): B(), C(), D(), E(), f(), e(), G(), H() (+17 more)

### Community 13 - "tools.py"
Cohesion: 0.16
Nodes (16): audit(), _block(), _cache_files(), _detections(), evidence(), find_anomalies(), get_calendar(), get_period() (+8 more)

### Community 14 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noUnusedLocals, skipLibCheck (+4 more)

### Community 15 - "Home.tsx"
Cohesion: 0.08
Nodes (46): Commands, Kiln Watch — agent notes, Layout, Science guardrails (from the brief review — do not regress), Token rule (always), Block, Meta, Warning (+38 more)

### Community 17 - "early_warning"
Cohesion: 0.18
Nodes (7): Phase 2: pages and early warning, check_watchlist(), create_alert(), get_early_warning(), early_warning(), _next_weeks(), warnings()

### Community 18 - "Kiln Watch"
Cohesion: 0.20
Nodes (8): AI use log, Data and credits, How the harmonization works, Kiln Watch, Limitations and known issues, Research question and main result, Run it, What it does

### Community 19 - "Improvements, Round 2 — MODIS/VIIRS Fire Harmonization Brief"
Cohesion: 0.20
Nodes (9): A. Eligibility and rules — settle these first, B. Facts both files get wrong or miss (as of 2026-11-10), C. Harmonization method, D. Validation that experts cannot wave away, E. Calendar and product — match the challenge wording, F. Technology and AI, G. Competition positioning, Improvements, Round 2 — MODIS/VIIRS Fire Harmonization Brief (+1 more)

### Community 20 - "test_science.py"
Cohesion: 0.13
Nodes (13): _cutover(), _denial_snpp(), article_fire_check(), match_months(), month_key(), period_bounds(), periods(), week_key() (+5 more)

### Community 21 - "start_aoi"
Cohesion: 0.40
Nodes (4): validate_bbox(), aoi_id(), start_aoi(), test_bbox_antimeridian()

### Community 22 - "Improvements Only — MODIS/VIIRS Fire Harmonization Brief"
Cohesion: 0.29
Nodes (6): Improvements Only — MODIS/VIIRS Fire Harmonization Brief, P0 — Correct the scientific and factual foundation, P1 — Focus the product on a compelling, reliable demo, P1 — Make the harmonization defensible and testable, P2 — Improve competition positioning with verifiable differentiation, Research sources consulted

### Community 23 - "Map.tsx"
Cohesion: 0.18
Nodes (12): maplibre-gl, RegionItem, Basemap, box(), EMPTY, FIRE_LAYERS, Focus, Layers (+4 more)

### Community 24 - "scene.ts"
Cohesion: 0.13
Nodes (16): additive, BLUE, glowTexture(), ISO, K, KF, mountScene(), P (+8 more)

### Community 25 - "_denial_modis"
Cohesion: 0.17
Nodes (11): Stage 12: Zero-Inflated Negative Binomial (ZINB) Hurdle + Empirical Bayes `combine` Calibration, _band(), _block(), _chain(), _denial_modis(), _hotspots(), _pairs(), _series() (+3 more)

### Community 26 - "Timeline.tsx"
Cohesion: 0.22
Nodes (10): Cls, SENSOR_COLOR, SENSOR_LABEL, FALLBACK_START, LANES, Props, START, Timeline() (+2 more)

### Community 27 - "calendar_month"
Cohesion: 0.33
Nodes (4): _viirs_scale(), calendar_month(), step_ratio(), side()

### Community 28 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, @types/geojson, @types/react, @types/react-dom, @types/three, typescript, vite, @vitejs/plugin-react

### Community 29 - "iso-kit.ts"
Cohesion: 0.06
Nodes (31): axisVector(), AZIMUTH, Camera, ELEVATION, ExtrudeOptions, Faded, FadeLineStyle, FigureOptions (+23 more)

### Community 30 - "api.ts"
Cohesion: 0.07
Nodes (38): AlertState, AlertSub, ArticleFire, Band, ClassBlock, Events, Evidence, Grid (+30 more)

### Community 31 - "SatelliteFigure.tsx"
Cohesion: 0.07
Nodes (26): B, BUS_L, BUS_U, E1, E2, E3, HTML, K (+18 more)

### Community 32 - "shared.tsx"
Cohesion: 0.14
Nodes (25): Level, LEVEL_LABEL, Region, Mcp(), N8n(), TOOLS, COLS, Create() (+17 more)

### Community 33 - "Warning.tsx"
Cohesion: 0.21
Nodes (22): fmt(), ordinal(), periodLabel(), Warnings, Articles(), RangeNews(), LevelChip(), saveAlerts() (+14 more)

### Community 34 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, gsap, lenis, maplibre-gl, react, react-dom, three

### Community 35 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, check, dev, preview

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
- **196 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+191 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 327 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Layout` connect `Home.tsx` to `early_warning`, `versus_history`, `api.ts`, `Record.tsx`?**
  _High betweenness centrality (0.403) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _196 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api.py` be split into smaller, more focused modules?**
  _Cohesion score 0.09390243902439024 - nodes in this community are weakly interconnected._
- **Why does `early_warning()` connect `early_warning` to `alerts.py`, `versus_history`, `tools.py`, `Home.tsx`?**
  _High betweenness centrality (0.264) - this node is a cross-community bridge._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10967741935483871 - nodes in this community are weakly interconnected._
- **Why does `Method()` connect `Record.tsx` to `shared.tsx`, `Warning.tsx`, `Home.tsx`?**
  _High betweenness centrality (0.186) - this node is a cross-community bridge._
- **Should `alerts.py` be split into smaller, more focused modules?**
  _Cohesion score 0.14153846153846153 - nodes in this community are weakly interconnected._