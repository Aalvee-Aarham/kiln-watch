# Kiln Watch pipeline reference

**Applies to:** `fire-calendar` branch (10 Oct 2026; `main` until it is merged) · **Contract:** [data-contracts.md](data-contracts.md) · **System overview:** [architecture.md](architecture.md)

One Python package, `kilnwatch/`, turns raw NASA/ESA satellite data into the static JSON the website serves. Each stage is one module, runs alone as `python -m kilnwatch <stage>`, reads `data/raw` or `data/interim`, and writes Parquet to `data/interim`, model artifacts to `data/models`, reports to `reports/`, or the public export to `web/public/data/`. Tests never read any of these (see [operations.md](operations.md)).

## Modules

| Module | Role |
|---|---|
| `config.py` | All constants, typed PRE-REGISTERED / DERIVED / FIXED (see below). Loads `.env`; exposes `rng(stage)` seeded from `SEED + SEED_OFFSETS[stage]`; carries `CREDITS` and the bilingual `NON_CLAIMS` |
| `ingest.py` | FIRMS archive + Area API download (7 sources, quota-paced against the MAP_KEY limit, cached per 5-day window, threaded backfill) → `detections.parquet`; HDX boundaries; APAD inventories (BD / PK / IN) and SentinelKilnDB; OpenAQ PM2.5. `--only nightfire\|osm` are accepted slots that skip without EOG credentials |
| `gee.py` | Earth Engine extraction, cached and resumable: daily **clear-land fractions** (FireMask 5,7,8,9) per unit set (`admin`, `footprints`, `transfer`); WorldCover grid lookup (banded `computePixels`, custom bbox for other countries); water fractions; S5P NO₂/SO₂; ERA5-Land at Dhaka |
| `grid.py` | Pure grid math: `cell_id` / `cell_center` (0.01° grid, origin 20.0°N 68.0°E, 1500×3000), `pixel_radius_m`, `season_of` (July–June season year), `to_celldays`, `unit_cells`, `unit_rates` (rate per 1,000 clear cells, `min_clear = 0.2`) |
| `kilns.py` | Inventory reconciliation (150 m cross-match), DBSCAN clustering with the 5 km diameter cap and 2% share cap, `measure_eps` (median VIIRS half-diagonal → `DBSCAN_EPS_M`), 3 matched controls per cluster (WorldCover-matched, ladder with `rung_used`), detection linking by per-detection pixel radius |
| `gates.py` | Pre-registered feasibility gates G0–GN on `GATE_SEASON`, permutation + Mann–Whitney evaluation, `branch()` → `GATE_BRANCH` in `config_derived.json`; writes `reports/gate_report.md` |
| `harmonize.py` | The calibration engine: chain Aqua ← S-NPP ← NOAA-20 ← NOAA-21, strata = division × month × pass × location class, pooling ladder, ratio fit (M0) and Poisson GLM (M1), season-block bootstrap betas, leave-one-season-out with the coverage target, Chow seam test at 2011-12. The NOAA-20 → NOAA-21 step runs on the NRT overlap since 1 Jul 2026 but has no valid β yet (too few paired days), so nothing uses it; after S-NPP ends (2 Nov 2026) NOAA-20 is the era sensor, and calendar days without a cached NOAA-20 clear fraction use the S-NPP clear-fraction climatology (`metrics.era_clear_frac`), as the NRT job does; the NOAA-20 SP/NRT ratio is not computable yet (FIRMS SP and NRT do not overlap) |
| `classify.py` | Weakly supervised VIIRS source classifier: leakage-free features (`p5`/`p30` persistence from past detections only), footprint labels (+ optional `type=2` augmentation), HGB vs logistic vs rule baseline, thresholds frozen for precision ≥ 0.8, four holdouts (spatial, temporal, cross-sensor N→J1 and J1→J2), label-set comparison, persistence ablation, candidate unmapped kilns, and the frozen-model transfer test on Faisalabad |
| `metrics.py` | Season metrics (onset/peak/duration, block bootstrap), normals (p10/p50/p90 per day of season), unusual/critical flags, activity index (HKFI/HBI by branch), clear climatology, harvest windows from `crop_calendar.csv`, sensor-era handling (S-NPP ends 2026-11-02, then chained NOAA-20) |
| `validate.py` | `overlap_agreement` (Aqua vs VIIRS on the months both flew, raw vs harmonized; written into `harmonization.json` by every export) and `outlook` (the backtested two-week unusual-fire outlook → `outlook.json`). Validation layers, strongest first: shape across all seasons, Sentinel-2 chips and two-rater score, TROPOMI NO₂ difference-in-differences, Dhaka PM2.5 lags, closure cases |
| `activity.py` | **Amendment 1.** Kiln activity from non-fire channels: GL = Black Marble VNP46A2 night lights (half-monthly, 2012–), GS = Sentinel-1 radar yard-minus-ring (monthly, 2015–), each vs the cluster's matched controls; four confirmatory criteria on held-out clusters (season 2022-23); area-level kiln-season summaries (≥ 5 clusters per area) |
| `transfer.py` | **Amendments 2–4.** The night-light method abroad: per country (PK, IN, AF) kilns → clusters → seeded 2,000-cluster sample (400 calibration) → distance-ring controls → night lights (+ radar on a nested subsample); tests with Bangladesh's months (TL/TS) and locally learned months (LL/LS); design A2 = first test, A4 = retest with controls ≥ 6 km from every mapped kiln. Country-level output only |
| `nrt.py` | Daily near-real-time update for CI: FIRMS NRT fetch, `data/nrt/season.csv` maintenance, frozen classifier + thresholds, harvest-key split under `nokiln`, β-weighted harmonized rates per district and national → `web/public/data/nrt/current_season.json` |
| `export.py` | The public / regulator / fixtures / publish tiers; name and value safety checks; per-file size budgets |
| `research.py` | The research release: the public export re-shaped as tidy CSV + Parquet tables (daily/monthly/weekly-interval calendars, season metrics, calibration betas, national series, kiln seasons by area) with a data dictionary, CC BY 4.0 and a SHA-256 manifest; refuses kiln-level and coordinate columns |
| `ask.py` | Ask Kiln Watch: five deterministic tools over the public export (with dataset id, source URL and data build on every result), a bounded tool-use loop (≤ 6 model calls, Claude Opus 5.5), and `guard()`, which blocks any answer stating a number no tool returned |
| `geography.py` | Builds the world map's reference geography in `data/static` from Natural Earth downloads (`python -m kilnwatch.geography <dir>`): countries, states (South Asia simplified finer), cities as records; unnamed minor areas are labelled by their country |
| `stats.py` | `bootstrap_ci` (block), stratified `perm_test`, `wilson`, `chow_test` |
| `pipeline.py` | Stage glue behind `grid`, `harmonize`, `metrics`: record assembly, national series, per-unit calendars, AOI GeoJSON, grid tiles, `events.json`, money-shot figures, `reports/baseline.json` |
| `__main__.py` | The CLI (below) |

## CLI

```
python -m kilnwatch <stage> [flags]
```

| Stage | Flags | Notes |
|---|---|---|
| `ingest` | `--only firms\|inventories\|boundaries\|openaq\|nightfire\|osm` | Quota-paced; safe to rerun (cached windows) |
| `gee` | `--dataset clear\|worldcover\|water\|s5p\|era5` · `--units admin\|footprints\|transfer` · `--sensor T\|A\|N\|J1\|J2` · `--from DATE` | Slow, resumable; per-month cache under `data/raw/gee/` |
| `grid` | — | Cell-days, unit cells, rates |
| `kilns` | — | Reconcile, cluster, controls, linking |
| `gates` | — | All gates; writes `GATE_BRANCH` to `config_derived.json` |
| `harmonize` | — | Chain, LOSO, seam |
| `classify` | — | Classifier + holdouts, then the Faisalabad frozen-model transfer test (skipped with a warning if it cannot run) |
| `metrics` | — | Calendars and season metrics |
| `validate` | — | Every available layer; unavailable ones are listed under `skipped` |
| `activity` | `--extract ntl\|s1\|all` | Amendment 1; `--extract` pulls the Earth Engine cache first (slow, resumable) |
| `transfer` | `--countries PK IN AF` · `--kinds ntl s1` · `--no-extract` · `--prepare-only` · `--design A2\|A4` | Amendments 2–4; `--prepare-only` builds samples and controls without outcome data |
| `export` | `--regulator` · `--fixtures` · `--check-public DIR` · `--publish` · `--research [PUBLIC_DIR]` | `--research` writes the CSV + Parquet research release to `research/` from a public export (default `web/public/data`; `web/fixtures/nokiln/data` is the real offline copy) |
| `ask` | `"question"` · `--src DIR` · `--build-cache` | Ask Kiln Watch: Claude answers by calling the project's functions (never computing); `--build-cache` answers the demo questions into `ask.json` for the offline `#/ask` page. Needs `ANTHROPIC_API_KEY`; see [AI_USE.md](AI_USE.md) |
| `nrt` | `--days 5` | The daily update run by CI |
| `all` | — | ingest → grid → kilns → gates → harmonize → classify → metrics → validate → activity (cache only) → export. **Excludes `gee`** (fails fast with exit 2 if `data/raw/gee/clear/admin` is missing) **and `transfer`** (run it separately). If harmonize's result checks fail (A6d LOSO coverage, A6e seam), its outputs are already written, so `all` runs the remaining stages and then exits 1 naming the failed checks; any other stage failure stops `all` at once |

## Stage inputs and outputs

| Stage | Reads | Writes |
|---|---|---|
| `ingest` | FIRMS API/archive, HDX COD-AB, APAD CSVs, SentinelKilnDB labels, OpenAQ | `data/raw/**`, `data/interim/detections.parquet`, units, inventories, PM2.5; `reports/ingest_counts.md`, `reports/ingest_schema.md` |
| `gee` | Earth Engine | Cache under `data/raw/gee/`; clear-fraction tables |
| `grid` | detections, clear | `celldays`, `unit_cells`, rates |
| `kilns` | inventories, detections | `kilns`, `clusters`, `controls`, `links`; `reports/inventory_report.md` |
| `gates` | celldays, links, clear | `GATE_BRANCH` (derived); `reports/gate_report.md` |
| `harmonize` | rates, clear | β chain, `data/models/harm_draws.parquet`, harmonization payload; `reports/harmonization_report.md` |
| `classify` | detections, links | labels, `data/models/kiln_clf.joblib`, `data/models/thresholds.json`; `reports/classifier_report.md` |
| `metrics` | series, betas, clear climatology | per-unit calendars, `aoi/*.geojson`, `grid/*.json`, `events.json`, normals. `reports/baseline.json` and the figures come from `pipeline.write_baseline()` and `pipeline.figures()`, which no stage calls: run them by hand after `metrics` and `validate` |
| `validate` | series, S5P, OpenAQ | validation payload; `reports/validation_report.md` |
| `activity` | clusters, controls, GEE cache | kiln-activity payload (public block); `reports/kiln_activity_report.md` |
| `transfer` | APAD PK/IN, SentinelKilnDB, geoBoundaries, GEE cache | transfer block of the kiln-activity payload; `reports/transfer_report.md` |
| `export` | `data/interim/public` | `web/public/data/` (real), `web/fixtures/<branch>/` (synthetic), `regulator/` (offline), GitHub Release `data-current` |
| `nrt` | FIRMS NRT, frozen models, committed calendars | `data/nrt/season.csv`, `web/public/data/nrt/current_season.json` |

Committed model artifacts (needed by CI even without data): `data/models/{cells,clear_clim,harm_draws}.parquet`, `kiln_clf.joblib`, `thresholds.json`.

## Constants (`config.py`)

| Kind | Truth lives in | Enforced by |
|---|---|---|
| **PRE-REGISTERED** | `docs/PREREGISTRATION.md` | `tests/test_config.py` asserts equality with the file's literals, and that the pre-registration's first commit precedes every commit touching `reports/` |
| **DERIVED** | A named pipeline step → `kilnwatch/config_derived.json` (value + source + date) | `tests/test_config.py` asserts source and date on every entry |
| **FIXED** | Code review | — |

Derived keys today: `CALIB_SEASONS` (2012-13 … 2020-21), `DBSCAN_EPS_M` (318.2 m), `WATER_CHECK_UNIT` (BD10090065), `GATE_BRANCH` (`nokiln`).

## Determinism

Every stochastic step — bootstraps, permutation tests, control sampling, splits, model training, transfer sampling — draws from `config.rng(stage)` = `default_rng(SEED + SEED_OFFSETS[stage])` with `SEED = 20261114` and one offset per stage (`kilns:1 … activity:7, transfer:8`). Fixture transfer data is additionally draw-free so reruns keep other fixture files byte-identical.

## Reproduce order

1. `python -m kilnwatch ingest`
2. `python -m kilnwatch gee --units admin` then `--units footprints` (and `--dataset worldcover`, `water`, `s5p`, `era5` as needed)
3. `python -m kilnwatch grid` → `kilns` → `gates` → `harmonize` → `classify` → `metrics` → `validate`
4. `python -m kilnwatch activity --extract all` (Amendment 1)
5. `python -m kilnwatch transfer` (Amendments 2–4; optional, country-level)
6. `python -m kilnwatch export` → `cd web && DATA_SRC=real npm run build`

`python -m kilnwatch all` covers steps 1 and 3 and the cache-only part of 4, then exports; run `gee` first and `transfer` separately. Setup, accounts and environment variables: [operations.md](operations.md).
