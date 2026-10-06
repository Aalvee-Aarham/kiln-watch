# Kiln Watch: File Structure

**Version:** 3.1 — 6 October 2026, post-build repository update. Supersedes v3.0 (planning). Synced to `implementation_plan.md` v2.1 and closes every finding in `Architecture_FileStructure_Audit.txt`.
**Companion docs:** [architecture.md](architecture.md) · [implementation_plan.md](implementation_plan.md) · [CLAUDE.md](CLAUDE.md)

> **What changed in 3.1 (after the build).** The tree below now describes the repository as built and reorganised, not as planned:
> - All governance and planning markdown, the generated `reports/` evidence trail, and `presentation/` pitch material were consolidated under **`docs/`** (`config.REPORTS` and `tests/test_config.py` point there).
> - `LICENSE` (MIT, code only) added at the root.
> - Ruff configuration lives in `pyproject.toml`; no separate `ruff.toml` was created.
> - `VERIFICATION.md` lives at `docs/VERIFICATION.md`. `PREREGISTRATION_AMENDMENTS.md` was never needed. `docs/history/` was not created.
> - `presentation/` extras (headline.pdf, deck.pdf, stakeholders.md, video_link.md, wireframes/) are pending P1/P2 items.

> **Authority.** `implementation_plan.md` v2.1 is authoritative. Where this document disagrees with it, the plan wins and this document has a bug.

The repository holds two projects: a Python package (`kilnwatch/`) that produces data, and a React app (`web/`) that displays it. They meet only at the static JSON contract in implementation_plan §7.3. The real public data reaches the website through a GitHub Release asset, never through git.

---

## 1. Tree

```
kiln-watch/
├── README.md                       # thesis and finding; official challenge statement quoted verbatim (28 Oct);
│                                   #   setup + reproduce commands; gate results; credits and licences;
│                                   #   non-claims; prior-work disclosure
├── LICENSE                         # MIT, code only; data licences listed in README
├── pyproject.toml                  # package + pytest + ruff config (no separate ruff.toml)
├── requirements.txt                # Python 3.11 deps, exact pins
├── .env.example                    # FIRMS_MAP_KEY= OPENAQ_API_KEY= EE_PROJECT= EOG_USER= EOG_PASSWORD=
├── .gitignore · .gitattributes
│
├── docs/                           # ALL markdown: governance, planning, generated evidence, pitch
│   ├── PREREGISTRATION.md          # plan §12; committed BEFORE any analysis; never edited after its first commit
│   ├── CLAUDE.md                   # agent operating rules: invariants, conventions, commands, escalation (plan §16)
│   ├── VERIFICATION.md             # human sign-off log: one row per VERIFY-H check (plan §10.3); agents append, never sign
│   ├── BLOCKERS.md                 # escalation log: step, failing assertion, attempts, reproducing command (plan §16)
│   ├── project_proposal.md         # the consolidated proposal
│   ├── architecture.md             # system design and the reasons behind it
│   ├── implementation_plan.md      # AUTHORITATIVE: requirements, stack, interfaces, contract, verification,
│   │                               #   build steps, pre-registration, branches, scope tiers, risks, Phase 0
│   ├── file_structure.md           # this file
│   ├── reports/                    # COMMITTED: pipeline-generated evidence trail (replaces notebooks)
│   │   ├── baseline.json           #   accepted headline numbers, frozen at I1; I3 asserts against it
│   │   ├── ingest_schema.md · ingest_counts.md · inventory_report.md
│   │   ├── gate_report.md · harmonization_report.md · classifier_report.md · validation_report.md
│   │   └── figures/                #   money_jump.png · money_plateau.png
│   └── presentation/               # COMMITTED: pitch and submission material
│       ├── claims.md               #   every pitch number with its source, geography and season
│       ├── qa.md                   #   judge Q&A sheet
│       ├── script.md               #   the 2-minute pitch script (P1)
│       ├── submission.md           #   P2: every required field from the 2026 submission guide, drafted
│       └── backup/                 #   offline copies of money_jump.png and money_plateau.png
│
├── .github/
│   └── workflows/
│       ├── ci.yml                  # push/PR — jobs: python · web-fixtures (5 branches + safety checks)
│       └── deploy.yml              # main / cron 03:00 UTC / dispatch — jobs: nrt → artifact; deploy ← data-current + artifact
│
├── kilnwatch/                      # PYTHON PIPELINE: python -m kilnwatch <stage> | all
│   ├── __init__.py                 # empty
│   ├── __main__.py                 # argparse CLI, every stage in plan §7.1; `all` fails fast without the GEE cache
│   ├── config.py                   # constants typed PRE-REGISTERED / DERIVED / FIXED (plan §6); loads config_derived.json;
│   │                               #   paths (REPORTS → docs/reports); credits; non-claims; forbidden keys; seeds
│   ├── config_derived.json         # COMMITTED: DERIVED constants written by their steps, each with source + date:
│   │                               #   CALIB_SEASONS (A1a), WATER_CHECK_UNIT (A3a), DBSCAN_EPS_M (A4a), GATE_BRANCH (A5)
│   ├── ingest.py                   # FIRMS Area API + normalise; inventories (APAD primary); HDX boundaries (incl.
│   │                               #   Faisalabad transfer); OpenAQ PM2.5
│   ├── gee.py                      # daily_clear_fraction (FireMask 5,7,8,9 only), water_fraction, worldcover_at_points,
│   │                               #   s5p_monthly, era5_daily, worldcover_grid
│   ├── grid.py                     # cell_id (bounds-checked), cell_center, pixel_radius_m, to_celldays, unit_cells,
│   │                               #   unit_rates, season_of, season_series
│   ├── kilns.py                    # reconcile, measure_eps, cluster (diameter cap), sample_controls (ladder), link, link_points
│   ├── stats.py                    # bootstrap_ci (iid/block), perm_test, wilson, chow_test
│   ├── gates.py                    # S_stat, P_stat, unit_stats, evaluate, branch → GATE_BRANCH; reports/gate_report.md
│   ├── harmonize.py                # pool_key (6-rung ladder), fit_ratio, bootstrap_betas (seasons), fit_glm (alpha=0),
│   │                               #   loso, build_rates, seam_stat
│   ├── classify.py                 # weak_labels, build_features (13, no leakage), train (HGB vs logistic vs rule),
│   │                               #   4 holdouts, choose_thresholds, candidates (regulator-only), transfer_test
│   ├── metrics.py                  # season_metrics, normals, flags, activity_index (HKFI | HBI), clear_climatology,
│   │                               #   harvest_key, conversion_weights, era_sensor
│   ├── pipeline.py                 # stage glue: grid/harmonize/metrics stages, calendars, figures, write_baseline
│   ├── validate.py                 # shape_all_seasons, s2_score (skips if no s2_checks.csv), tropomi_did, pm25_lags,
│   │                               #   transfer
│   ├── export.py                   # write_public, write_regulator, write_fixtures (5 branches), assert_public_safe (names),
│   │                               #   check_public_dir (values), check_budgets, publish (→ data-current release)
│   └── nrt.py                      # daily NRT update (runs in deploy.yml); empty S-NPP response is not an error
│
├── tests/                          # pytest — SYNTHETIC INPUT ONLY; nothing here may read data/
│   ├── fixtures/grid_cases.json    # written by test_grid.py; read by web Vitest for Python/TS parity;
│   │                               #   includes Dhaka (1 136 241), Faisalabad (3 426 508) and out-of-grid cases
│   ├── test_isolation.py           # fails if any test module references data/raw, data/interim or data/raw/gee
│   ├── test_config.py              # PRE-REGISTERED constants equal docs/PREREGISTRATION.md; its commit precedes reports/
│   ├── test_grid.py                # worked ids, round-trip, transfer region, out-of-grid raises, pixel radius, season_of
│   ├── test_stats.py               # Wilson (0.1078, 0.6032), permutation, Chow
│   ├── test_gates.py               # plateau S = 0.80; spike P = 1.00; uniform P < 0.15
│   ├── test_harmonize.py           # β = 0.25 recovery; sufficiency; pooling ladder; seam; LOSO mechanics
│   ├── test_kilns.py               # chain of 40 points splits under 5 000 m; control ladder
│   ├── test_classify.py            # no lat/lon/date/month features
│   ├── test_export.py              # name check; value check; regulator path guard
│   └── test_contracts.py           # every exported file matches plan §7.3, under all five gate_branch fixture sets
│
├── data/
│   ├── raw/                        # GITIGNORED: downloads as received + API/GEE chunk caches
│   │   └── firms/ · sta/ · gee/ · inventories/ · boundaries/ · openaq/ ...  # gee/ is part of the reproduction bundle
│   ├── interim/                    # GITIGNORED: Parquet tables (architecture §6)
│   │   └── detections · celldays · clear · unit_cells · kilns · clusters · controls · links · labels · series
│   ├── static/                     # COMMITTED: small hand-made inputs, every row cited
│   │   ├── policy_events.csv       #   date, label_en, label_bn, source_url
│   │   ├── crop_calendar.csv       #   crop, harvest_start, harvest_end, source_url
│   │   └── names_bn.csv            #   English→Bangla admin names (HDX lacks them)
│   │   └── s2_checks.csv           #   NOT YET CREATED — two-rater check pending (recorded as `skipped` until then)
│   ├── models/                     # COMMITTED: frozen artifacts the NRT job needs
│   │   ├── kiln_clf.joblib         #   HistGradientBoosting classifier
│   │   ├── thresholds.json         #   t_lo, t_hi, FEATURES, training git_sha, nrt_ok
│   │   ├── harm_draws.parquet      #   β bootstrap draws per chain step × stratum
│   │   ├── clear_clim.parquet      #   unit × day-of-year median clear fraction (provisional NRT denominator)
│   │   └── cells.parquet           #   cell_id → district/division/loc lookup
│   └── nrt/                        # GITIGNORED: persisted between Action runs by actions/cache, never committed
│       └── season.csv              #   current-season NRT detections, appended + deduped daily, archived 1 Jul
│
├── regulator/                      # GITIGNORED, NEVER HOSTED: per-cluster leads, candidates, README with non-claims
│
├── graphify-out/                   # generated knowledge graph of docs + code (graph.{json,html}, GRAPH_REPORT.md)
│
├── web/                            # REACT APP (Vite + TypeScript)
│   ├── index.html                  # Vite entry
│   ├── package.json · package-lock.json
│   ├── vite.config.ts              # base '/kiln-watch/'; publicDir = DATA_SRC=fixtures ? fixtures/<FIXTURE_BRANCH> : public
│   ├── tsconfig.json · eslint.config.js · playwright.config.ts
│   ├── e2e/smoke.spec.ts           # Playwright smoke of 6 routes from the built site (not run in CI)
│   ├── fixtures/                   # COMMITTED: synthetic data with the real shapes, written by export --fixtures
│   │   └── full/ · from2012/ · partial/ · nightfire/ · nokiln/     # one set per gate_branch, each
│   │                               #   data/{meta,events,harmonization,validation}.json · aoi/ · calendar/ · grid/ · nrt/
│   ├── public/                     # Vite publicDir when DATA_SRC=real; holds NOTHING but data/ (gitignored, generated)
│   └── src/
│       ├── main.tsx                # createRoot, HashRouter, routes, React.lazy for heavy pages
│       ├── index.css               # @import "tailwindcss"; @theme palette
│       ├── assets/                 # money_jump.png · money_plateau.png (imported, so publicDir switching keeps them)
│       ├── lib/
│       │   ├── types.ts            # THE CONTRACT (plan §7.3)
│       │   ├── data.ts             # useJson<T>, dataUrl (BASE_URL), in-memory cache
│       │   ├── url.ts              # route + search params ↔ view state; canonical box parser; unknown split → 'all'
│       │   ├── days.ts · calendar.ts · box.ts · i18n.ts · theme.ts · echarts.ts
│       │   └── *.test.ts           # box (Python parity via grid_cases.json), calendar, days, theme
│       ├── components/
│       │   ├── ui.tsx              # AppShell nav, ChartCard, SegmentedToggle, EChart wrapper, ErrorBoundary, Loading
│       │   ├── charts.tsx          # JumpChart, PlateauSpikeChart, CalendarHeatmap, NormalBandChart, SourceStackChart,
│       │   │                       #   SeasonDurationChart, SeasonToDateChart, PRCurveChart, RadiusSweepChart, ...
│       │   └── FireMap.tsx         # Leaflet choropleth + drag-box drawing
│       └── pages/
│           ├── StoryPage.tsx · ExplorerPage.tsx · KilnSeasonsPage.tsx · EvidencePage.tsx
│           └── OtherPages.tsx      # ThisSeasonPage + MethodPage
└── docs/presentation/backup/       # offline copies of money_jump.png and money_plateau.png (see docs/presentation/)
```

---

## 2. What is committed, generated or secret

| Path | Committed | Written by | Notes |
|---|---|---|---|
| `kilnwatch/*.py`, `tests/`, `web/src/`, `web/*.config.*`, `.github/`, `LICENSE` | ✅ | Hand-written | Source of truth; LICENSE is MIT for code |
| `docs/CLAUDE.md`, `docs/VERIFICATION.md`, `docs/BLOCKERS.md` | ✅ | Hand-written; agents append to the last two | `VERIFICATION.md` rows are signed only by people |
| `docs/PREREGISTRATION.md` | ✅ | Hand-written, once | Committed before any analysis; never edited afterwards |
| `docs/PREREGISTRATION_AMENDMENTS.md` | ✅ | Hand-written | Never needed to date; dated, append-only if created |
| `kilnwatch/config_derived.json` | ✅ | The deriving steps (A1a, A3a, A4a, A5) | Each value with its source and date; asserted against its source |
| `docs/history/` | — | — | Not created; planning-provenance folder was folded into `docs/` |
| `data/raw/`, `data/interim/` | ❌ | Pipeline | Large; recreated from the README downloads and `gee` + `all`. `data/raw/gee/` is part of the reproduction bundle |
| `data/static/` | ✅ | Hand-made | Small, every row cited; `s2_checks.csv` not yet created (two-rater check pending) |
| `data/models/` | ✅ | `harmonize.py`, `classify.py`, `metrics.py` | Frozen; the NRT job depends on them |
| `data/nrt/` | ❌ | `nrt.py` | Persisted by `actions/cache`; never committed |
| `web/fixtures/` | ✅ | `export --fixtures` | Synthetic, one set per `gate_branch`; what CI builds and tests against |
| `web/public/data/` | ❌ | `export.py`; in CI, unpacked from the `data-current` release + the NRT artifact | Real public tier. Reaches Pages via the release asset, never via git |
| `web/node_modules/`, `web/dist/` | ❌ | npm / Vite | Rebuilt in CI |
| `docs/reports/` (incl. `baseline.json`) | ✅ | Pipeline; `baseline.json` frozen at I1 | Evidence for judges |
| `regulator/` | ❌ never | `export --regulator` | Restricted tier; path guard refuses `web/` |
| `docs/presentation/` | ✅ | Hand-made | `headline.pdf`, `deck.pdf`, `stakeholders.md`, `video_link.md`, `wireframes/` still pending (P1/P2) |
| `graphify-out/` | ✅ | graphify tool | Generated knowledge graph of docs + code |
| `.env`, `~/.netrc` | ❌ never | You | `.env.example` lists the keys; CI receives only `FIRMS_MAP_KEY` |

**`.gitignore`**

```
.env
.venv/
__pycache__/
.pytest_cache/
.ruff_cache/
data/raw/
data/interim/
data/nrt/
regulator/
web/node_modules/
web/dist/
web/public/data/
web/test-results/
web/playwright-report/
graphify-out/cache/
*.tmp
logs/
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
