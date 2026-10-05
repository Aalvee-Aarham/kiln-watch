# Kiln Watch: File Structure

**Version:** 3.0 — 6 October 2026. Supersedes v2.0. Synced to `implementation_plan.md` v2.1 and closes every finding in `Architecture_FileStructure_Audit.txt`.
**Companion docs:** [architecture.md](architecture.md) · [implementation_plan.md](implementation_plan.md) · [CLAUDE.md](CLAUDE.md)

> **Authority.** `implementation_plan.md` v2.1 is authoritative. Where this document disagrees with it, the plan wins and this document has a bug.

The repository holds two projects: a Python package (`kilnwatch/`) that produces data, and a React app (`web/`) that displays it. They meet only at the static JSON contract in implementation_plan §7.3. The real public data reaches the website through a GitHub Release asset, never through git.

---

## 1. Tree

```
kiln-watch/
├── README.md                       # thesis and finding; official challenge statement quoted verbatim (28 Oct);
│                                   #   Phase 0.1 rules answer; setup + reproduce commands; gate results;
│                                   #   credits and licences; non-claims; prior-work disclosure
├── CLAUDE.md                       # agent operating rules: invariants, conventions, commands, escalation (plan §16)
├── PREREGISTRATION.md              # plan §12; committed BEFORE any analysis; never edited after its first commit
├── PREREGISTRATION_AMENDMENTS.md   # created only if needed; dated amendments with reasons, append-only
├── VERIFICATION.md                 # human sign-off log: one row per VERIFY-H check (plan §10.3); agents append rows, never sign
├── BLOCKERS.md                     # escalation log: step, failing assertion, attempts, reproducing command (plan §16)
├── project_proposal.md             # the consolidated proposal
├── architecture.md                 # system design and the reasons behind it
├── implementation_plan.md          # AUTHORITATIVE: requirements, stack, interfaces, contract, verification,
│                                   #   build steps, pre-registration, branches, scope tiers, risks, Phase 0
├── file_structure.md               # this file
├── LICENSE                         # MIT for code; data licences listed in README
├── requirements.txt                # Python 3.11 deps, exact pins (pip freeze at build step S1)
├── ruff.toml                       # Python lint/format config
├── .env.example                    # FIRMS_MAP_KEY= OPENAQ_API_KEY= EE_PROJECT= EOG_USER= EOG_PASSWORD=
├── .gitignore                      # see §2
│
├── docs/
│   └── history/                    # COMMITTED: planning provenance; also the prior-work disclosure evidence
│       ├── README.md               #   what each file is, its date, and what superseded it
│       ├── Kiln_Watch_Proposal_v2.docx
│       ├── kiln_watch_upgrades_specification.md
│       ├── Kiln_Watch_Flaw_Audit.txt          # the "FA-" references in architecture.md cite this
│       └── reviews/                #   later review and audit notes, in date order
│
├── .github/
│   └── workflows/
│       ├── ci.yml                  # push/PR — jobs: python · web-fixtures · web-real (plan §9)
│       └── deploy.yml              # main / cron 03:00 UTC / dispatch — jobs: nrt → artifact; deploy ← data-current + artifact
│
├── kilnwatch/                      # PYTHON PIPELINE: python -m kilnwatch <stage> | all
│   ├── __init__.py                 # empty
│   ├── __main__.py                 # argparse CLI, every stage in plan §7.1; `all` fails fast without the GEE cache
│   ├── config.py                   # constants typed PRE-REGISTERED / DERIVED / FIXED (plan §6); loads config_derived.json;
│   │                               #   paths; credits; non-claims; forbidden public keys; seeds
│   ├── config_derived.json         # COMMITTED: DERIVED constants written by their steps, each with source + date:
│   │                               #   CALIB_SEASONS (A1a), WATER_CHECK_UNIT (A3a), DBSCAN_EPS_M (A4a), GATE_BRANCH (A5)
│   ├── ingest.py                   # FIRMS archive + Area API + data_availability; inventories; boundaries (incl. transfer);
│   │                               #   OpenAQ; Nightfire; VJ114A1/VJ214A1; OSM; STA mask
│   ├── gee.py                      # daily_clear_fraction (FireMask 5,7,8,9 only), water_fraction,
│   │                               #   worldcover_at_points, s5p_monthly, era5_daily
│   ├── grid.py                     # cell_id (bounds-checked), cell_center, pixel_radius_m, to_celldays,
│   │                               #   unit_cells, unit_rates, season_of
│   ├── kilns.py                    # reconcile, measure_eps, cluster (diameter cap), sample_controls (ladder), link
│   ├── stats.py                    # bootstrap_ci (iid/block), perm_test, wilson, chow_test
│   ├── gates.py                    # unit_stats, evaluate, radius_sweep, run(G0|G1|G2|G3|GN) → reports/gate_report.md
│   ├── harmonize.py                # pair_days, pool_key, fit_ratio, fit_glm (alpha=0), loso, bootstrap_betas (seasons),
│   │                               #   to_myd_eq, seam_stat, sp_nrt_ratio
│   ├── classify.py                 # weak_labels, build_features, train, holdout_spatial, holdout_temporal,
│   │                               #   holdout_cross_sensor, ablate_persistence, choose_thresholds, candidates, transfer_test
│   ├── metrics.py                  # season_metrics, normals, flags, activity_index (HKFI | HBI), clear_climatology,
│   │                               #   emissions_estimate (Could)
│   ├── validate.py                 # shape_all_seasons, s2_chips, s2_score (skips if no s2_checks.csv),
│   │                               #   tropomi_did, pm25_lags, closure_cases
│   ├── export.py                   # write_public, write_regulator, write_fixtures, assert_public_safe (names),
│   │                               #   check_public_dir (values), publish (→ data-current release)
│   └── nrt.py                      # daily NRT update (runs in deploy.yml); empty S-NPP response is not an error
│
├── tests/                          # pytest — SYNTHETIC INPUT ONLY; nothing here may read data/
│   ├── fixtures/
│   │   └── grid_cases.json         # written by test_grid.py; read by web Vitest for Python/TS parity;
│   │                               #   includes Dhaka (1 136 241), Faisalabad (3 426 508) and out-of-grid cases
│   ├── test_isolation.py           # fails if any test module references data/raw, data/interim or data/raw/gee
│   ├── test_config.py              # PRE-REGISTERED constants equal PREREGISTRATION.md; its commit precedes reports/
│   ├── test_grid.py                # worked ids, round-trip, transfer region, out-of-grid raises, pixel radius, season_of
│   ├── test_stats.py               # Wilson (0.1078, 0.6032), permutation, Chow
│   ├── test_gates.py               # plateau S = 0.80; spike P = 1.00; uniform P < 0.15
│   ├── test_harmonize.py           # β = 0.25 recovery; sufficiency; pooling ladder incl. night rung 5 → None;
│   │                               #   GLM alpha; seam statistic; LOSO mechanics; fold integrity
│   ├── test_kilns.py               # chain of 40 points splits under 5 000 m; control ladder reaches rung 2 within 2 000 attempts
│   ├── test_classify.py            # no lat/lon/date/month features; past-only windows
│   ├── test_export.py              # name check; value check; regulator path guard
│   └── test_contracts.py           # every exported file matches plan §7.3, under all five gate_branch fixture sets
│
├── data/
│   ├── raw/                        # GITIGNORED: downloads as received + API/GEE chunk caches
│   │   ├── firms/                  #   archive/fire_archive_*.csv · api/{source}/{date}.csv · data_availability.json
│   │   ├── sta/                    #   FIRMS Static Thermal Anomalies mask (G0)
│   │   ├── gee/                    #   clear/{unit_set}/{sensor}/{YYYY-MM}.parquet · worldcover_points.parquet ·
│   │   │                           #   water_fraction.parquet · s5p/ · era5/      ← PART OF THE REPRODUCTION BUNDLE
│   │   ├── inventories/            #   lee2021/ · apad_bd/ · apad_transfer/ · sentinelkilndb/
│   │   ├── boundaries/             #   hdx_bgd/ · transfer/ (licence recorded alongside)
│   │   ├── vj1/                    #   VJ114A1 / VJ214A1 granules, Bangladesh tiles only
│   │   └── openaq/  nightfire/  osm/
│   ├── interim/                    # GITIGNORED: Parquet tables (architecture §6)
│   │   └── detections · celldays · clear · unit_cells · kilns · clusters · controls · links · pairs · labels · series
│   ├── static/                     # COMMITTED: small hand-made inputs, every row cited
│   │   ├── policy_events.csv       #   date, label_en, label_bn, source_url
│   │   ├── crop_calendar.csv       #   crop, region, harvest_start, harvest_end, source_url
│   │   ├── names_bn.csv            #   unit_id, name_bn (only if HDX lacks Bangla names)
│   │   └── s2_checks.csv           #   candidate_ref, rater, verdict, s2_date, notes — NO coordinates
│   ├── models/                     # COMMITTED: frozen artifacts the NRT job needs
│   │   ├── kiln_clf.joblib         #   HistGradientBoosting classifier
│   │   ├── thresholds.json         #   t_lo, t_hi, FEATURES, training git_sha
│   │   ├── harm_draws.parquet      #   β bootstrap draws per chain step × stratum (the only copy; no interim twin)
│   │   └── clear_clim.parquet      #   unit × day-of-year median clear fraction (provisional NRT denominator)
│   └── nrt/                        # GITIGNORED: persisted between Action runs by actions/cache, never committed
│       └── season.csv              #   current-season NRT detections, appended + deduped daily, archived 1 Jul
│
├── regulator/                      # GITIGNORED, NEVER HOSTED: per-cluster leads, s2_chips/, README with non-claims
│
├── reports/                        # COMMITTED: generated evidence trail (replaces notebooks)
│   ├── baseline.json               #   accepted headline numbers, frozen at I1; I3 asserts against it
│   ├── ingest_schema.md  ingest_counts.md  inventory_report.md  gate_report.md
│   ├── harmonization_report.md  classifier_report.md  validation_report.md
│   └── figures/                    #   money_jump.png · money_plateau.png · seam.png · loso.png · radius_sweep.png ·
│                                   #   plateau_vs_spike.png · pr_curve.png · holdouts.png · ...
│
├── web/                            # REACT APP (Vite + TypeScript)
│   ├── index.html                  # Vite entry; <html lang> switched by i18n
│   ├── package.json                # deps: react, react-dom, react-router, leaflet, react-leaflet, echarts;
│   │                               #   dev: vite, tailwindcss, @tailwindcss/vite, typescript, eslint, vitest, @playwright/test
│   ├── package-lock.json
│   ├── vite.config.ts              # base '/<repo>/'; plugins react() + tailwindcss(); Vitest config;
│   │                               #   publicDir = DATA_SRC=fixtures ? fixtures/<FIXTURE_BRANCH> : public
│   ├── tsconfig.json
│   ├── eslint.config.js
│   ├── playwright.config.ts        # (Should) smoke test against `vite preview`
│   ├── e2e/
│   │   └── smoke.spec.ts           # #/, #/explore/district/<id>, #/evidence, #/season render with no console errors
│   ├── fixtures/                   # COMMITTED: synthetic data with the real shapes, written by export --fixtures
│   │   ├── full/data/              #   meta.json, events.json, harmonization.json, validation.json, aoi/, calendar/, grid/, nrt/
│   │   ├── from2012/data/
│   │   ├── partial/data/           #   population-level pass, no eligible cluster
│   │   ├── nightfire/data/
│   │   └── nokiln/data/            #   Aman / Boro / other split; activity index HBI
│   ├── public/                     # Vite publicDir when DATA_SRC=real; holds NOTHING but data/
│   │   └── data/                   # GITIGNORED, GENERATED by export.py; in CI, unpacked from data-current
│   │       ├── meta.json  events.json  harmonization.json  validation.json
│   │       ├── aoi/                #   districts.geojson · upazilas.geojson
│   │       ├── calendar/           #   {unit_id}.json (about 560, sparse)
│   │       ├── grid/               #   {tile}.json (1° × 1°, totals only)
│   │       └── nrt/                #   current_season.json (from the nrt workflow artifact in CI)
│   └── src/
│       ├── main.tsx                # createRoot, <App/>, imports index.css
│       ├── index.css               # @import "tailwindcss"; @theme { palette, font stack, radii }; 2–3 @apply patterns
│       ├── App.tsx                 # HashRouter, routes, React.lazy for Evidence and Kiln seasons, ErrorBoundary
│       ├── assets/                 # favicon and any static images, imported (so publicDir switching never loses them)
│       ├── lib/
│       │   ├── types.ts            # THE CONTRACT (plan §7.3): Meta (split_labels, activity_index, grid), Calendar (split[]),
│       │   │                       #   Harmonization (loso_by_season, loso_pooled, seam), Validation, Events, NrtSeason,
│       │   │                       #   GridTile, UnitProps
│       │   ├── data.ts             # useJson<T>, dataUrl (BASE_URL), in-memory cache, AbortController
│       │   ├── useUrlState.ts      # route + search params ↔ {unitId, level, box, mode, layout, season, lang, split};
│       │   │                       #   canonical box parser; unknown split key → 'all'
│       │   ├── days.ts             # day index ↔ date, doy, season helpers            (+ days.test.ts)
│       │   ├── calendar.ts         # sparse → dense, seriesFor, calendarToCsv         (+ calendar.test.ts)
│       │   ├── box.ts              # cellId, tilesForBox, aggregateBox — reads meta.grid, NO grid literals
│       │   │                       #                                                  (+ box.test.ts, reads grid_cases.json)
│       │   ├── i18n.ts             # strings {en, bn}, useT, fmtNumber (Intl bn-BD)
│       │   ├── theme.ts            # cssVar / palette(): Tailwind @theme vars, with literal fallbacks (+ theme.test.ts)
│       │   └── echarts.ts          # echarts/core + registered charts and components (tree-shaken)
│       ├── components/
│       │   ├── layout/             # AppShell, NavTabs, LangToggle, Footer
│       │   ├── common/             # EChart, ChartCard, SegmentedToggle, CIText, StatusMessage, ErrorBoundary,
│       │   │                       #   ProvisionalBadge, DownloadButtons
│       │   ├── map/                # FireMap, BasemapLayer, ChoroplethLayer, BoxDrawLayer
│       │   ├── picker/             # AreaPicker, UnitSearch, LevelToggle, ViewControls
│       │   ├── charts/             # JumpChart, PlateauSpikeChart, CalendarHeatmap, NormalBandChart, SourceStackChart,
│       │   │                       #   SeasonDurationChart, SeasonToDateChart, RadiusSweepChart, NightContrastChart,
│       │   │                       #   PRCurveChart, TropomiChart, Pm25LagChart
│       │   └── evidence/           # FindingCard, GateTable, SeamCard, LosoTable, HoldoutTable, LabelsetCard, ControlsCard,
│       │                           #   CandidateCard, TransferCard, ClosureCases, SeasonMetricsTable, DistrictAnomalyTable,
│       │                           #   NonClaimsList, ReleasePolicy, CreditsList
│       └── pages/
│           ├── StoryPage.tsx
│           ├── ExplorerPage.tsx
│           ├── KilnSeasonsPage.tsx # hidden under gate_branch partial and nokiln
│           ├── ThisSeasonPage.tsx
│           ├── EvidencePage.tsx
│           └── MethodPage.tsx      # styling is Tailwind utilities inline; no per-page CSS files
│
└── presentation/                   # COMMITTED: pitch and submission material
    ├── claims.md                   # every pitch number with its source, geography and season
    ├── stakeholders.md             # outreach log + quotable replies (with permission)
    ├── qa.md                       # judge Q&A sheet
    ├── script.md                   # the 2-minute pitch script (P1)
    ├── headline.pdf                # one-page headline numbers (P1)
    ├── deck.pdf                    # 7-slide fallback
    ├── submission.md               # P2: every required field from the 2026 submission guide, drafted;
    │                               #   the prior-work disclosure verbatim; confirmation recorded in VERIFICATION.md
    ├── video_link.md               # hosted video URL (video file not committed)
    ├── wireframes/                 # screen sketches
    └── backup/                     # offline copies of money_jump.png and money_plateau.png + redacted regulator sample
```

---

## 2. What is committed, generated or secret

| Path | Committed | Written by | Notes |
|---|---|---|---|
| `kilnwatch/*.py`, `tests/`, `web/src/`, `web/*.config.*`, `.github/` | ✅ | Hand-written | Source of truth |
| `CLAUDE.md`, `VERIFICATION.md`, `BLOCKERS.md` | ✅ | Hand-written; agents append to the last two | `VERIFICATION.md` rows are signed only by people |
| `PREREGISTRATION.md` | ✅ | Hand-written, once | Committed before any analysis; never edited afterwards |
| `PREREGISTRATION_AMENDMENTS.md` | ✅ | Hand-written | Only if needed; dated, append-only |
| `kilnwatch/config_derived.json` | ✅ | The deriving steps (A1a, A3a, A4a, A5) | Each value with its source and date; asserted against its source |
| `docs/history/` | ✅ | — | Provenance and prior-work disclosure |
| `data/raw/`, `data/interim/` | ❌ | Pipeline | Large; recreated from the README downloads and `gee` + `all`. `data/raw/gee/` is part of the reproduction bundle |
| `data/static/` | ✅ | Hand-made | Small, every row cited; no coordinates in `s2_checks.csv` |
| `data/models/` | ✅ | `harmonize.py`, `classify.py`, `metrics.py` | Frozen; the NRT job depends on them |
| `data/nrt/` | ❌ | `nrt.py` | Persisted by `actions/cache`; never committed |
| `web/fixtures/` | ✅ | `export --fixtures` | Synthetic, one set per `gate_branch`; what CI builds and tests against |
| `web/public/data/` | ❌ | `export.py`; in CI, unpacked from the `data-current` release + the NRT artifact | Real public tier. Reaches Pages via the release asset, never via git |
| `web/node_modules/`, `web/dist/` | ❌ | npm / Vite | Rebuilt in CI |
| `reports/` (incl. `baseline.json`) | ✅ | Pipeline; `baseline.json` frozen at I1 | Evidence for judges |
| `regulator/` | ❌ never | `export --regulator` | Restricted tier; path guard refuses `web/` |
| `presentation/` | ✅ | Hand-made | Video file excluded |
| `.env`, `~/.netrc` | ❌ never | You | `.env.example` lists the keys; CI receives only `FIRMS_MAP_KEY` |

**`.gitignore`**

```
.env
.venv/
__pycache__/
data/raw/
data/interim/
data/nrt/
regulator/
web/node_modules/
web/dist/
web/public/data/
*.tmp
```

---

## 3. Everyday commands

| Task | Command |
|---|---|
| Python setup — Windows | `py -3.11 -m venv .venv` → `.venv\Scripts\Activate.ps1` → `pip install -r requirements.txt` |
| Python setup — macOS / Linux | `python3.11 -m venv .venv` → `source .venv/bin/activate` → `pip install -r requirements.txt` |
| Earth Engine login (once) | `earthengine authenticate` |
| Earth Engine stage (before `all`) | `python -m kilnwatch gee --dataset clear --units admin` (then `--units footprints` after `kilns`) |
| Run one stage / everything | `python -m kilnwatch <stage>` / `python -m kilnwatch all` (fails fast without the GEE cache) |
| Synthetic fixtures for UI work | `python -m kilnwatch export --fixtures` |
| Check a public data folder | `python -m kilnwatch export --check-public web/public/data` |
| Publish the real public data | `python -m kilnwatch export --publish` (runs both safety checks, uploads to `data-current`) |
| Regulator export (offline only) | `python -m kilnwatch export --regulator` |
| Python tests + lint | `pytest -q` · `ruff check .` |
| Web setup | `cd web` → `npm install` |
| Dev server on fixtures | `DATA_SRC=fixtures FIXTURE_BRANCH=full npm run dev` (any of the five branches) |
| Dev server on real data | `DATA_SRC=real npm run dev` |
| Web checks | `npm run lint` · `npm run typecheck` · `npm test` |
| Production build + offline demo | `DATA_SRC=real npm run build` → `npm run preview` (or `python -m http.server -d web/dist`) |

On Windows PowerShell, set environment variables with `$env:DATA_SRC="fixtures"` before the command.

---

## 4. Size budgets

| Item | Budget |
|---|---|
| `web/public/data/` total | < 100 MB uncompressed; overflow handled by `export --downscale` (plan §7.3) |
| Per-file data budgets | As listed in plan §7.3 |
| Initial page load (gz, JS + data) | < 1.5 MB |
| Any single committed file | < 20 MB (GitHub blocks files over 100 MB) |
| `data/models/` | < 5 MB |
| `web/fixtures/` (all five sets) | < 10 MB |
| `data/nrt/season.csv` | < 10 MB per season; archived each 1 July |

---

## 5. Cross-reference map

Sections of `implementation_plan.md` v2.1 cited in this repository:

| Topic | Section |
|---|---|
| Requirements and Definition of Done | §1 |
| Decisions | §2 |
| Tech stack · libraries · external APIs | §3 · §4 · §5 |
| Constants (PRE-REGISTERED / DERIVED / FIXED) | §6 |
| CLI · module APIs · data contract | §7.1 · §7.2 · §7.3 |
| Frontend | §8 |
| CI/CD | §9 |
| Unit tests · stage assertions · human checks | §10.1 · §10.2 · §10.3 |
| Build steps | §11 |
| Pre-registration · non-claims | §12 · §12.1 |
| Gate branches | §13 |
| Scope tiers · Event-only tier | §14 · §14.1 |
| Risks · known limitations | §15 · §15.1 |
| `CLAUDE.md` text | §16 |
| Phase 0 | §17 |
