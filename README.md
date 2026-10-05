# 🔥 Kiln Watch

**NASA Space Apps Challenge 2026 — *Harmonization of MODIS and VIIRS Hot Spots***

Kiln Watch turns two decades of NASA satellite fire detections over Bangladesh into **one consistent burning calendar**:

1. **Harmonize.** MODIS (1 km, 2003–) and VIIRS (375 m, 2012–) see fire differently. When VIIRS arrives in 2012 raw detection counts jump several-fold, which is a sensor artefact, not a change in fire. We convert every sensor to one unit, *Aqua-MODIS-equivalent fire cell-days per 1,000 cloud-free cells (MYD-eq)*, with 95% uncertainty bands, validated by leaving each season out in turn.
2. **Separate.** Each VIIRS detection is labelled *kiln-like*, *vegetation-like* or *unknown* by a weakly supervised classifier trained on detections at 4,760 mapped brick kilns versus matched control sites. It uses heat signature and persistence, never location or date, and is tested on unseen districts, later years and other satellites.
3. **Show.** For any district, upazila or drawn box, the site shows the full daily history, the normal range, unusual days, critical periods and the current season (updated daily). All of it is downloadable as CSV or JSON.

> Results and headline numbers: see [`reports/`](reports/) (gate, harmonization, classifier and validation reports) and the **Evidence** page of the site.

---

## Quick start

```powershell
# Python pipeline (Windows; use python3 / source .venv/bin/activate elsewhere)
py -m venv .venv; .venv\Scripts\Activate.ps1; pip install -r requirements.txt
copy .env.example .env      # add FIRMS_MAP_KEY, OPENAQ_API_KEY, EE_PROJECT
earthengine authenticate    # once

# Web app on synthetic fixtures (no data needed)
cd web; npm install; npm run dev          # http://localhost:5173/kiln-watch/
```

## Reproduce the analysis

| Step | Command | What it does |
|---|---|---|
| 1 | `python -m kilnwatch ingest` | FIRMS archive (all 7 MODIS/VIIRS sources, 2003→today, quota-paced and cached per 5-day window), HDX boundaries, APAD kiln inventory, OpenAQ PM2.5 |
| 2 | `python -m kilnwatch gee --units admin` | Earth Engine daily **clear-land fractions** (FireMask 5,7,8,9; water/cloud/unknown excluded) per division, district and upazila. Slow, resumable |
| 3 | `python -m kilnwatch grid` | Fire cell-days on the 0.01° grid; unit cell sets; clear table |
| 4 | `python -m kilnwatch kilns` | Kiln clusters (DBSCAN with 5 km diameter cap), 3 matched controls each, detection linking |
| 5 | `python -m kilnwatch gee --units footprints` | Clear fractions at kiln and control footprints for the gate season |
| 6 | `python -m kilnwatch gates` | Pre-registered feasibility gates G0–G3 → `GATE_BRANCH` |
| 7 | `python -m kilnwatch harmonize` | Calibration chain Aqua ← S-NPP ← NOAA-20 ← NOAA-21, pooling ladder, M0/M1, leave-one-season-out, seam test |
| 8 | `python -m kilnwatch classify` | Source classifier, 4 holdouts, label-set comparison, persistence ablation, transfer test |
| 9 | `python -m kilnwatch metrics` | ~570 per-unit calendars, normals, flags, season metrics, map layers, grid tiles |
| 10 | `python -m kilnwatch validate` | Validation layers (shape across seasons, TROPOMI NO₂ DiD, Dhaka PM2.5 lags) |
| 11 | `python -m kilnwatch export` | Public tier → `web/public/data/`, with name + value safety checks and size budgets |
| 12 | `cd web; $env:DATA_SRC="real"; npm run build` | Static site in `web/dist/` |

`python -m kilnwatch all` runs steps 1, 3, 4 and 6–11 in order, and fails fast if the Earth Engine cache is missing.

## Tests

```powershell
pytest -q                      # Python: synthetic data only (tests may never read data/)
cd web; npm test -- --run      # Vitest: days, grid parity with Python, theme, calendar/box aggregation
npm run e2e                    # Playwright smoke test of every route from the built site
```

## How it is built

- **Pipeline:** Python 3.11+ · pandas · GeoPandas · scikit-learn · Earth Engine (`kilnwatch/`, one module per stage)
- **Site:** React 19 + TypeScript + Vite + Tailwind CSS v4 + ECharts + Leaflet (`web/`). Static, no server; deep links via `HashRouter`.
- **Contract:** `web/src/lib/types.ts` (Python writes it, TypeScript reads it). It is tested under all five gate branches.
- **Daily updates:** `.github/workflows/deploy.yml` fetches FIRMS near-real-time data, labels it with the frozen model and redeploys.
- **Pre-registration:** [`PREREGISTRATION.md`](PREREGISTRATION.md) was committed before any analysis. Its thresholds are never edited.
- **Knowledge graph:** `graphify-out/` holds a graph of the design docs (`graphify query "<question>"`).

## Responsible release

Public files contain area-level statistics only. Kiln ids, cluster ids, candidate unmapped kilns and kiln coordinates never reach `web/`. A name check and a value check enforce this locally and in CI. Site-level leads exist only in an offline regulator export (`python -m kilnwatch export --regulator`).

**What we do not claim:** see the Method page or `kilnwatch/config.py:NON_CLAIMS`. In short: outputs are inspection leads, not proof of illegality; "no detection" is not "kiln off"; detection counts are not emissions.

## Credits and licences

Code: MIT. Data:
- NASA FIRMS (MODIS C6.1, VIIRS 375 m)
- Google Earth Engine datasets: MOD14A1/MYD14A1/VNP14A1, ESA WorldCover, Sentinel-5P, ERA5-Land
- **APAD IGP Brick Kilns Bangladesh / Pakistan** (CC BY 4.0). *IGP Brick Kilns Bangladesh was accessed on 2026-10-06 from https://registry.opendata.aws/asset-data-igp-brick-kilns-ban*
- OCHA HDX COD-AB Bangladesh / Pakistan (CC BY-IGO)
- OpenAQ (CC BY 4.0)
- CARTO / OpenStreetMap basemap

## Prior-work disclosure

Planning documents (`project_proposal.md`, `architecture.md`, `implementation_plan.md`, `file_structure.md`) predate the build. All code, data processing and results in this repository were produced during the event; the git history is public evidence.
