# Graph Report - nasa hack  (2026-10-06)

## Corpus Check
- 134 files · ~87,547 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 22 file(s) not represented in the graph (top: .geojson 10, (none) 3, .parquet 3)

## Summary
- 766 nodes · 1871 edges · 47 communities (36 shown, 11 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 50 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c288d335`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Harmonization engine (harmonize.py)
- Weakly supervised source classifier
- Pre-registered rules (PREREGISTRATION.md)
- Dual-tier release (public vs regulator)
- types.ts static data contract (frozen at S3)
- Phase 0 blocking items
- Daily clear-fraction denominators (FireMask 5,7,8,9)
- pipeline.py
- Kiln clusters, matched controls and linking
- Kiln Watch Architecture (doc)
- NASA Space Apps 2026: Harmonization of MODIS and VIIRS Hot Spots
- numpy
- json
- pandas
- classify.py
- charts.tsx
- ingest.py
- types.ts
- gee.py
- metrics.py
- ui.tsx
- package.json
- devDependencies
- ExplorerPage.tsx
- useJson
- compilerOptions
- 🔥 Kiln Watch
- days.ts
- i18n.ts
- Gate report (A5) — gate season 2023-24
- scripts
- CLAUDE.md — agent operating rules
- Validation report (A9)
- dependencies
- Classifier report (A7)
- eslint.config.js
- Harmonization report (A6)
- Inventory report (A4)
- @playwright/test
- claims.md
- qa.md
- script.md
- submission.md
- ingest_counts.md
- ingest_schema.md
- VERIFICATION.md
- kilnwatch

## God Nodes (most connected - your core abstractions)
1. `run()` - 24 edges
2. `_parquet()` - 18 edges
3. `_dump()` - 17 edges
4. `read_units()` - 17 edges
5. `useJson()` - 16 edges
6. `UnitView()` - 16 edges
7. `main()` - 15 edges
8. `run()` - 15 edges
9. `EChart()` - 15 edges
10. `cell_id()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Blockers` --references--> `test_loso_mechanics()`  [EXTRACTED]
  BLOCKERS.md → tests/test_harmonize.py
- `test_pixel_radius()` --calls--> `pixel_radius_m()`  [EXTRACTED]
  tests/test_grid.py → kilnwatch/grid.py
- `Eight non-claims` --conceptually_related_to--> `Pre-registered rules (PREREGISTRATION.md)`  [AMBIGUOUS]
  project_proposal.md → implementation_plan.md
- `test_cell_id_worked()` --calls--> `cell_id()`  [EXTRACTED]
  tests/test_grid.py → kilnwatch/grid.py
- `test_transfer_region()` --calls--> `cell_id()`  [EXTRACTED]
  tests/test_grid.py → kilnwatch/grid.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Harmonization method: unit, chain, pooling, seam test, LOSO validation** — architecture_myd_eq_common_unit, architecture_calibration_chain, architecture_pooling_ladder, architecture_seam_test, architecture_loso_validation [EXTRACTED 1.00]
- **Evidence integrity: pre-registration, verification kinds, agent rules, gates** — architecture_preregistration, implementation_plan_preregistered_rules, implementation_plan_verification_kinds, implementation_plan_claude_md_rules, architecture_feasibility_gates [INFERRED 0.85]
- **Public-tier privacy enforcement stack** — architecture_public_safety_checks, architecture_dual_tier_release, file_structure_commit_policy, implementation_plan_real_data_delivery, architecture_non_claims [INFERRED 0.85]

## Communities (47 total, 11 thin omitted)

### Community 0 - "Harmonization engine (harmonize.py)"
Cohesion: 0.19
Nodes (7): Activity index HKFI / HBI, MYD-eq common unit, python -m kilnwatch CLI, Definition of done, Glossary, Harmonization engine (proposal view), Three layers: calendar, separation, kiln seasons

### Community 1 - "Weakly supervised source classifier"
Cohesion: 0.20
Nodes (5): CI/CD and hosting (ci.yml, deploy.yml, Pages), NRT updater (nrt.py + deploy.yml), kilnwatch/ Python package, Repository tree, Source classifier (proposal view)

### Community 4 - "types.ts static data contract (frozen at S3)"
Cohesion: 0.29
Nodes (5): React SPA frontend architecture, Static data contracts (web/public/data), Size budgets, web/ React app, types.ts static data contract (frozen at S3)

### Community 5 - "Phase 0 blocking items"
Cohesion: 0.15
Nodes (9): Build steps S1..P2 dependency graph, Event-only tier contingency, Internal module APIs, Phase 0 blocking items, Risk register R0-R17, Scope tiers Must/Should/Could, Open items to resolve before build, Risks and mitigations (proposal view) (+1 more)

### Community 6 - "Daily clear-fraction denominators (FireMask 5,7,8,9)"
Cohesion: 0.33
Nodes (4): NASA FIRMS (MODIS/VIIRS detections), Google Earth Engine, 0.01 degree grid and cell-day indicator, External APIs and data services

### Community 7 - "pipeline.py"
Cohesion: 0.06
Nodes (45): _clean(), _dump(), nan_to_none(), split_labels(), cell_center(), cell_id(), season_of(), to_celldays() (+37 more)

### Community 8 - "Kiln clusters, matched controls and linking"
Cohesion: 0.33
Nodes (4): Kiln inventories (Lee 2021, APAD, SentinelKilnDB), Lee et al. 2021 PNAS brick kiln mapping, References list, Schroeder et al. 2014 VIIRS 375 m active fire algorithm

### Community 9 - "Kiln Watch Architecture (doc)"
Cohesion: 0.60
Nodes (5): Kiln Watch Architecture (doc), Cross-reference map to implementation plan sections, Kiln Watch File Structure (doc), Kiln Watch Implementation Plan v2.1 (doc), Kiln Watch Project Proposal v3.0 (doc)

### Community 10 - "NASA Space Apps 2026: Harmonization of MODIS and VIIRS Hot Spots"
Cohesion: 0.50
Nodes (4): Functional requirements FR1-FR11, Challenge fit table, Judging criteria mapping, NASA Space Apps 2026: Harmonization of MODIS and VIIRS Hot Spots

### Community 11 - "numpy"
Cohesion: 0.06
Nodes (38): candidates(), weak_labels(), branch(), evaluate(), P_stat(), run(), S_stat(), season_bounds() (+30 more)

### Community 12 - "json"
Cohesion: 0.06
Nodes (30): write_derived(), activity_meta(), assert_public_safe(), check_budgets(), check_public_dir(), _fixture_calendar(), _fixture_harmonization(), _fixture_set() (+22 more)

### Community 13 - "pandas"
Cohesion: 0.09
Nodes (29): Blockers, season_series(), bootstrap_betas(), build_rates(), _design(), fit_glm(), fit_ratio(), _keys() (+21 more)

### Community 14 - "classify.py"
Cohesion: 0.09
Nodes (19): _ap_ci(), build_features(), choose_thresholds(), _district_of(), _fit(), _git_sha(), _hgb(), _holdout() (+11 more)

### Community 15 - "charts.tsx"
Cohesion: 0.15
Nodes (28): CalendarHeatmap(), grid, JumpChart(), MONTHS_SEASON, NormalBandChart(), PlateauSpikeChart(), Pm25LagChart(), PRCurveChart() (+20 more)

### Community 16 - "ingest.py"
Cohesion: 0.13
Nodes (19): area_window(), atomic_write(), backfill(), job(), data_availability(), fetch_all_firms(), fetch_openaq(), load_boundaries() (+11 more)

### Community 17 - "types.ts"
Cohesion: 0.11
Nodes (25): vitest, BBOX, boxAreaKm2(), cellId(), Grid, parseBox(), meta, aggregateBox() (+17 more)

### Community 18 - "gee.py"
Cohesion: 0.16
Nodes (16): _clear_mask(), daily_clear_fraction(), ee(), era5_daily(), _fc(), load_clear(), _months(), run() (+8 more)

### Community 19 - "metrics.py"
Cohesion: 0.13
Nodes (11): activity_index(), _boot(), _ci(), conversion_weights(), day_index(), era_sensor(), flags(), harvest_key() (+3 more)

### Community 20 - "ui.tsx"
Cohesion: 0.18
Nodes (17): echarts, SeasonToDateChart(), AppShell(), CIText(), ErrorBoundary, fmt(), LangToggle(), ProvisionalBadge() (+9 more)

### Community 21 - "package.json"
Cohesion: 0.12
Nodes (16): eslint, jsdom, react-dom, tailwindcss, @tailwindcss/vite, @types/leaflet, @types/node, @types/react (+8 more)

### Community 22 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, jsdom, @playwright/test, tailwindcss, @tailwindcss/vite (+9 more)

### Community 23 - "ExplorerPage.tsx"
Cohesion: 0.29
Nodes (16): DownloadButtons(), Loading(), SegmentedToggle(), StatusMessage(), formatBox(), tilesForBox(), calendarToCsv(), seasonOf() (+8 more)

### Community 24 - "useJson"
Cohesion: 0.19
Nodes (13): leaflet, react, react-leaflet, BoxDraw(), color(), FireMap(), cache, dataUrl() (+5 more)

### Community 25 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noUnusedLocals (+7 more)

### Community 26 - "🔥 Kiln Watch"
Cohesion: 0.13
Nodes (13): Kiln Watch — Pre-registration, Non-claims (published on the Method page), Phase 0 answers recorded at registration (6 Oct 2026), Pre-registered constants, Credits and licences, How it is built, 🔥 Kiln Watch, Prior-work disclosure (+5 more)

### Community 27 - "days.ts"
Cohesion: 0.33
Nodes (7): dateToDay(), DAY0, dayIso(), dayToDate(), iso(), seasonDay(), seasonStart()

### Community 28 - "i18n.ts"
Cohesion: 0.31
Nodes (6): react-router, Box, Key, S, Lang, UrlState

### Community 29 - "Gate report (A5) — gate season 2023-24"
Cohesion: 0.25
Nodes (7): Decision (§13): `GATE_BRANCH = nokiln`, G0 — STA prior screen (declared, non-gating), G1 — VIIRS S-NPP: **FAIL**, G2 — MODIS Terra+Aqua: **FAIL**, Gate report (A5) — gate season 2023-24, GN — VIIRS Nightfire: **skipped** (EOG credentials not configured), Radius sweep

### Community 30 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, e2e, lint, preview, test, typecheck

### Community 31 - "CLAUDE.md — agent operating rules"
Cohesion: 0.29
Nodes (7): CLAUDE.md — agent operating rules, Commands, Conventions, Invariants — never violate, Project notes, What not to build, When blocked

### Community 32 - "Validation report (A9)"
Cohesion: 0.29
Nodes (6): Layer 1 — shape across seasons, pm25, Skipped, transfer, tropomi, Validation report (A9)

### Community 33 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, echarts, leaflet, react, react-dom, react-leaflet, react-router

### Community 34 - "Classifier report (A7)"
Cohesion: 0.40
Nodes (4): Classifier report (A7), Holdouts, Label sets, Permutation importance

### Community 35 - "eslint.config.js"
Cohesion: 0.50
Nodes (3): @eslint/js, eslint-plugin-react-hooks, typescript-eslint

### Community 36 - "Harmonization report (A6)"
Cohesion: 0.50
Nodes (3): Harmonization report (A6), Rung usage by chain step, Seam

### Community 37 - "Inventory report (A4)"
Cohesion: 0.50
Nodes (3): Controls, Inventory report (A4), Source agreement within 150 m

## Ambiguous Edges - Review These
- `Harmonization engine (proposal view)` → `Leave-one-season-out validation and coverage`  [AMBIGUOUS]
  project_proposal.md · relation: conceptually_related_to
- `Why now: S-NPP/MODIS end of life` → `Fire record breaks in 2012 (MODIS 1km vs VIIRS 375m)`  [AMBIGUOUS]
  project_proposal.md · relation: conceptually_related_to
- `Feasibility gates (proposal view)` → `Pre-registered rules (PREREGISTRATION.md)`  [AMBIGUOUS]
  project_proposal.md · relation: conceptually_related_to
- `Pre-registered rules (PREREGISTRATION.md)` → `Eight non-claims`  [AMBIGUOUS]
  project_proposal.md · relation: conceptually_related_to

## Knowledge Gaps
- **130 isolated node(s):** `kilnwatch`, `name`, `private`, `version`, `type` (+125 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 285 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Harmonization engine (proposal view)` and `Leave-one-season-out validation and coverage`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `react` connect `useJson` to `ExplorerPage.tsx`, `ui.tsx`, `package.json`, `charts.tsx`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `kilnwatch`, `name`, `private` to the rest of the system?**
  _130 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `pipeline.py` be split into smaller, more focused modules?**
  _Cohesion score 0.05741626794258373 - nodes in this community are weakly interconnected._
- **What is the exact relationship between `Why now: S-NPP/MODIS end of life` and `Fire record breaks in 2012 (MODIS 1km vs VIIRS 375m)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Should `numpy` be split into smaller, more focused modules?**
  _Cohesion score 0.05981981981981982 - nodes in this community are weakly interconnected._