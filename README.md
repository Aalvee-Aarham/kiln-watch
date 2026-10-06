# 🔥 Kiln Watch

**NASA Space Apps Challenge 2026 — *Harmonization of MODIS and VIIRS Hot Spots***

🌐 **Live site: https://aalvee-aarham.github.io/kiln-watch/** (updated daily from NASA FIRMS)

Kiln Watch turns two decades of NASA satellite fire detections over Bangladesh into **one consistent burning calendar**:

1. **Harmonize.** MODIS (1 km, 2003–) and VIIRS (375 m, 2012–) see fire differently. When VIIRS arrives in 2012 raw detection counts jump several-fold, which is a sensor artefact, not a change in fire. We convert every sensor to one unit, *Aqua-MODIS-equivalent fire cell-days per 1,000 cloud-free cells (MYD-eq)*, with 95% uncertainty bands, validated by leaving each season out in turn.
2. **Separate.** A pre-registered test asked whether 3,653 mapped brick-kiln clusters produce more fire detections than matched farmland. They don't (0.46×), so kiln heat is not in the fire calendar. Brick kilns are invisible to fire satellites, so we track the **kiln season with NASA Black Marble night lights** instead. Kilns run day and night through the dry season, and a held-out test written down in advance confirms the signal ([Amendment 1](PREREGISTRATION_AMENDMENTS.md)).
3. **Show.** For any district, upazila or drawn box, the site shows the full daily history, the normal range, unusual days, critical periods and the current season (updated daily). Where there are kilns, the kiln season appears beside the fire calendar. All of it is downloadable as CSV or JSON.

## Results (real data, built 6 Oct 2026)

| Test (pre-registered) | Result |
|---|---|
| **Seam:** harmonized 2012 jump ≤ 25% of raw; break in raw (p < 0.01) and none after (p > 0.05) | **PASS**: 55.1 → 1.6 (**2.9%**); Chow p 6×10⁻⁵ raw, 0.29 harmonized |
| **Leave-one-season-out:** pooled 95% coverage 0.90–0.97 | **FAIL (conservative)**: 0.985 [0.982–0.987]. Intervals are too wide, not too narrow. See BLOCKERS.md |
| **G1, kilns visible to VIIRS:** DR(kiln)/DR(control) ≥ 3, perm p < 0.01, plus shape and seasonality | **FAIL**: 0.46×, p = 0.96 across 3,653 clusters and 10,959 matched controls |
| **G2, kilns visible to MODIS** | **FAIL**: 0.73× |
| → Gate branch | **`nokiln`**: calendar ships in full; split = Aman / Boro harvest windows / other; index = HBI |
| Kiln heat inside the fire calendar (upper bound) | 351 of 234,693 Bangladesh VIIRS detections, Nov–May 2012–2026 (**0.15%**), fall on kiln footprints, against 0.14% on matched farmland: no kiln contamination to remove |
| *Amendment 1 (written before the confirmatory run):* **GL, kiln season in NASA Black Marble night lights**, held-out clusters, season 2022-23 | **PASS**: median seasonal excess +0.195 nW/cm²/sr (p < 10⁻³⁰⁰); 72% of 3,253 clusters > 0; 13/13 seasons replicate; placebo p = 0.58 |
| Other kiln channels tried (pilot, all reported) | FIRMS night detections: 37 of 3,653 clusters in 14 years · ECOSTRESS night: no signal · Landsat day: sees the kiln structure, not firing · TROPOMI SO₂/NO₂: no signal |
| *Amendment 1:* **GS, independent check with Sentinel-1 radar** (brick stacks in kiln yards) | **PASS**: median +0.30 dB (p = 3×10⁻⁵⁸); 62% of clusters > 0; 9/10 seasons; placebo p = 0.12 |

Data: 1,221,809 FIRMS detections (2003 → today) · 13M Earth Engine daily clear-land fractions · 4,760 APAD kilns · 560 district and upazila calendars.
Full reports: [`reports/`](reports/) · Evidence page of the site · pitch materials in [`presentation/`](presentation/).

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
| 11 | `python -m kilnwatch activity --extract all` | Amendment 1: Black Marble night lights (half-monthly, 2012–) and Sentinel-1 radar (monthly, 2015–) at every kiln cluster and its 3 matched controls; tests GL/GS on the held-out clusters; kiln-season calendars per area (slow, resumable) |
| 12 | `python -m kilnwatch export` | Public tier → `web/public/data/`, with name + value safety checks and size budgets |
| 13 | `cd web; $env:DATA_SRC="real"; npm run build` | Static site in `web/dist/` |

`python -m kilnwatch all` runs steps 1, 3, 4, 6–10, 11 (from its cache, without `--extract`) and 12 in order, and fails fast if the Earth Engine cache is missing.

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
- **Pre-registration:** [`PREREGISTRATION.md`](PREREGISTRATION.md) was committed before any analysis. Its thresholds are never edited. Later additions are dated amendments in [`PREREGISTRATION_AMENDMENTS.md`](PREREGISTRATION_AMENDMENTS.md), each written before the data it governs were analysed.
- **Knowledge graph:** `graphify-out/` holds a graph of the design docs (`graphify query "<question>"`).

## Responsible release

Public files contain area-level statistics only. Kiln ids, cluster ids, candidate unmapped kilns and kiln coordinates never reach `web/`. A name check and a value check enforce this locally and in CI. Site-level leads exist only in an offline regulator export (`python -m kilnwatch export --regulator`).

**What we do not claim:** see the Method page or `kilnwatch/config.py:NON_CLAIMS`. In short: outputs are inspection leads, not proof of illegality; "no detection" is not "kiln off"; detection counts are not emissions.

## Credits and licences

Code: MIT. Data:
- NASA FIRMS (MODIS C6.1, VIIRS 375 m)
- Google Earth Engine datasets: MOD14A1/MYD14A1/VNP14A1, ESA WorldCover, Sentinel-5P, ERA5-Land
- NASA Black Marble VNP46A2 night lights (Román et al. 2018); Copernicus Sentinel-1 SAR (ESA); NASA ECOSTRESS L2T LSTE v2 and Landsat 8/9 Collection 2 (kiln pilots only)
- **APAD IGP Brick Kilns Bangladesh / Pakistan** (CC BY 4.0). *IGP Brick Kilns Bangladesh was accessed on 2026-10-06 from https://registry.opendata.aws/asset-data-igp-brick-kilns-ban*
- OCHA HDX COD-AB Bangladesh / Pakistan (CC BY-IGO)
- OpenAQ (CC BY 4.0)
- CARTO / OpenStreetMap basemap

## Prior-work disclosure

Everything in this repository as of 6 October 2026 was produced **before** the NASA Space Apps 2026 hackathon (14–15 November 2026), on 5–6 October 2026, after the challenge summary was published. That includes the planning documents (`project_proposal.md`, `architecture.md`, `implementation_plan.md`, `file_structure.md`), the pipeline code, the data processing and the results. The public git history records the dates. The Space Apps FAQ states that teams may not begin working on challenges before the hackathon, so this prior work is being declared to our Local Lead, and we follow their ruling on what may be judged. Work done during the event starts at the `hackathon-start` tag.
