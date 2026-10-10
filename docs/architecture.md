# Kiln Watch: Architecture

**Event:** NASA Space Apps Challenge 2026 (14–15 Nov 2026)
**Challenge:** Harmonization of MODIS and VIIRS Hot Spots
**Document version:** 3.0 — 10 October 2026. Supersedes v2.0 (6 Oct). Records the system as built on `main`: the `nokiln` gate outcome, the Amendment-1 kiln-activity stage, the Amendments 2–4 transfer stage, and the plain-language site redesign.
**Companion docs:** [pipeline.md](pipeline.md) · [data-contracts.md](data-contracts.md) · [web-frontend.md](web-frontend.md) · [operations.md](operations.md) · [PREREGISTRATION.md](PREREGISTRATION.md) + [PREREGISTRATION_AMENDMENTS.md](PREREGISTRATION_AMENDMENTS.md)

> **Authority.** The [pre-registration](PREREGISTRATION.md) is authoritative for every threshold; this document is the reference for what the system *is and why*. Stage-by-stage commands and I/O: [pipeline.md](pipeline.md). Interfaces: [data-contracts.md](data-contracts.md).

> **Audit references.** Tags such as `FA-D4` cite the 47-finding flaw audit of Proposal v2 (preserved in git history). They record which finding produced each design decision.

---

## 1. What the system answers

**Scientific question.** Can industrial heat sources be separated from agricultural burning in a harmonized MODIS–VIIRS active-fire record? And what does that reveal about when Bangladesh's brick kilns fire, season by season, from 2003 to today?

**Why now.** All remaining S-NPP science products, VIIRS included, cease on **2 November 2026 at 1300 UTC**; NOAA designates NOAA-21 as primary and NOAA-20 as secondary. Terra and Aqua are both drifting from their designed orbits and are due to begin shutting down in late 2026 or early 2027. Any comparison of a future season with a past one now crosses at least one sensor change.

**Product.** A harmonized burning-activity calendar for any area of interest in Bangladesh, calibrated across sensors and carrying uncertainty bands. Under the actual `nokiln` gate outcome, the public calendar splits burning by harvest window (Aman / Boro / other) and carries the Harmonized Burning Index; the kiln firing calendar comes from **night lights and radar** (Amendment 1), not fire detections. The method was then tested abroad (Amendments 2–4: Pakistan, India, Afghanistan), and a current-season tracker updates daily.

**What the raw record gets wrong twice, and how each is fixed.**

| Problem in the raw record | Fix in this architecture |
|---|---|
| Burning appears to jump in 2012 because the sensor changed from MODIS 1 km to VIIRS 375 m, not because the fires did. | An overlap-calibrated harmonization engine (§5.5) converts every sensor into one unit, with a numeric seam test. |
| Kiln heat is counted as vegetation fire, or thrown away. | Pre-registered feasibility gates (§5.4) plus a weakly supervised source classifier (§5.6). |

---

## 2. Design principles

1. **Precompute everything; serve static files.** No backend runs at demo time. GitHub Pages serves JSON and GeoJSON, so nothing cold-starts. (FA-F1)
2. **Pre-register, then measure.** Gate thresholds and the other pre-registered choices are committed in [PREREGISTRATION.md](PREREGISTRATION.md) *before* any data is analysed. The git history is the proof. (FA-D2)
3. **Never pool raw counts across sensors.** Every count is kept per sensor and per day/night pass, normalised by that sensor's cloud-free observation opportunities, and only then converted to the common unit. (FA-D4, FA-D14)
4. **Earth Engine supplies fractions, never counts.** The numerator (cell-days) and the denominator (clear cells) must share one cell set. Earth Engine reduces over its own grid, so it contributes only a clear *fraction*; the cell count comes from our own grid.
5. **Clusters are the public default; sites are never public.** Public views show district, upazila and pooled-cluster aggregates. Per-cluster leads exist only in an offline regulator export that is never hosted. (FA-C4, FA-G2)
6. **Every number carries its uncertainty.** Values come from a bootstrap or Monte Carlo, and the interval travels with the value into the JSON and onto the chart. (FA-D16)
7. **Every constant has one kind and one source of truth.** Constants in `kilnwatch/config.py` are one of three kinds:
   - **PRE-REGISTERED** — truth lives in [PREREGISTRATION.md](PREREGISTRATION.md); `config.py` copies it and a test asserts equality.
   - **DERIVED** — truth is produced by a named pipeline step, written to `kilnwatch/config_derived.json`, and asserted against its source.
   - **FIXED** — an engineering choice, changed by ordinary review.

   Values shared with the browser — the grid geometry, the split labels, the activity index — are published in `meta.json`, and the browser reads them from there. Nothing is hard-coded twice.
8. **Tests never touch real data.** Unit tests run on synthetic input in CI. Checks that need real data are stage assertions that run inside the pipeline stage and fail it. (see [operations.md](operations.md))
9. **Boring, minimal stack.** Python with pandas, GeoPandas, scikit-learn and the Earth Engine API; a React + TypeScript single-page app built by Vite, with ECharts and a self-contained SVG map — no map library, no tiles. Details in [web-frontend.md](web-frontend.md).

---

## 3. System context

```mermaid
flowchart LR
  subgraph Sources
    FIRMS[NASA FIRMS<br/>MODIS C6.1 + VIIRS 375 m<br/>archive + Area API<br/>+ Static Thermal Anomalies mask]
    GEE[Google Earth Engine<br/>MOD14A1 / MYD14A1 / VNP14A1<br/>S5P NO2/SO2, WorldCover, ERA5-Land,<br/>Black Marble VNP46A2, Sentinel-1]
    ED[NASA Earthdata<br/>VJ114A1 / VJ214A1]
    INV[Kiln inventories: APAD IGP<br/>Bangladesh / Pakistan / India,<br/>SentinelKilnDB (AF + validation)]
    AUX[Boundaries, OpenAQ PM2.5,<br/>geoBoundaries ADM0 PK/IN,<br/>crop calendar, policy + satellite events]
  end
  subgraph Pipeline["Python pipeline: python -m kilnwatch"]
    ING[ingest] --> GRID[grid + cell-days]
    GEEST[gee: clear fractions] --> GRID
    GRID --> KILN[kilns: inventory, clusters,<br/>matched controls, linking]
    KILN --> GATES[gates G0–GN]
    GRID --> HARM[harmonize]
    KILN --> CLF[classify]
    HARM --> MET[metrics]
    CLF --> MET
    MET --> VAL[validate]
    MET --> EXP[export]
    VAL --> EXP
    ACT1[activity: night lights + radar<br/>kiln seasons — Amendment 1] --> EXP
    ACT2[transfer: PK / IN / AF<br/>Amendments 2–4] --> EXP
  end
  FIRMS --> ING
  ED --> ING
  INV --> ING
  AUX --> ING
  GEE --> GEEST
  EXP -->|public JSON/GeoJSON| PUB[web/public/data/<br/>gitignored]
  PUB -->|export --publish<br/>value check first| REL[GitHub Release asset<br/>data-current]
  EXP -->|offline only| REG[regulator/<br/>never committed]
  ACT[GitHub Action daily<br/>nrt.py] -->|workflow artifact| DEP[deploy job]
  REL --> DEP
  DEP --> BUILD[Vite build → web/dist] --> SITE[GitHub Pages]
  SITE --> USER[Browser: React SPA<br/>SVG map + ECharts]
```

**Runtime split**

| Context | What runs | When |
|---|---|---|
| Analyst machine | Full pipeline including Earth Engine, gates, training, validation and export; `export --publish` uploads the public export as the `data-current` release asset | Whenever data or a parameter changes |
| GitHub Action `nrt` | Downloads `data-current` (for district normals), fetches FIRMS NRT, grids, labels with the frozen classifier, converts with the frozen calibration, writes `nrt/current_season.json`, uploads it as a **workflow artifact**. `season.csv` persists in `actions/cache`. **Nothing is committed.** | Daily cron and manual dispatch |
| GitHub Action `deploy` | Downloads `data-current` into `web/public/data/`, then the NRT artifact into `web/public/data/nrt/`, builds, runs both safety checks, deploys to Pages | After `nrt`, and on push to `main` or `redesign` |
| Browser | React SPA: loads static JSON, renders map and charts, computes drawn-box aggregates client-side | Demo and public use |

---

## 4. Data sources

| # | Dataset | Used for | Access | Coverage | Licence / credit |
|---|---|---|---|---|---|
| 1 | FIRMS MODIS C6.1 (Terra, Aqua), standard processing | Detections 2003–, with the MODIS-only `type` field | FIRMS archive download; API `MODIS_SP` fallback | Terra Nov 2000–; Aqua Jul 2002– | NASA open data; credit FIRMS |
| 2 | FIRMS VIIRS 375 m: S-NPP (`VIIRS_SNPP_SP`), NOAA-20 (`VIIRS_NOAA20_SP`), NOAA-21 (`VIIRS_NOAA21_NRT` **only**) | Detections 2012–: I4, I5, FRP, scan, track, day/night | Archive and Area API (`DAY_RANGE` 1–5; 5,000 transactions per 10 min) | S-NPP **20 Jan 2012 → 2 Nov 2026 1300 UTC**; NOAA-20 and NOAA-21 start dates read from `/api/data_availability/` in step A1a | NASA open data |
| 3 | FIRMS NRT (`VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`, `MODIS_NRT`) | Current-season tracker | Area API, `FIRMS_MAP_KEY` (Action secret) | Rolling | NASA open data |
| 4 | **FIRMS Static Thermal Anomalies (STA) mask** | Gate **G0** prior screen | FIRMS download | Built from ≥5 detections per 400 m cell in 2023, MODIS and 375 m S-NPP VIIRS, filtered against industrial-source inventories | NASA open data |
| 5 | Daily fire masks `MODIS/061/MOD14A1`, `MODIS/061/MYD14A1`, `NASA/VIIRS/002/VNP14A1` (`FireMask`, `QA`) | Clear-sky fractions (the denominators) | Earth Engine | MODIS 2000–; VNP14A1 2012 → S-NPP end | NASA LP DAAC |
| 6 | VJ114A1 / VJ214A1 (NOAA-20 / NOAA-21 daily masks) | Denominators after S-NPP ends | `earthaccess`, Bangladesh tiles only; availability confirmed in A3a | 2026–27 season | NASA LP DAAC |
| 7 | Sentinel-5P OFFL `L3_NO2`, `L3_SO2` | Validation layer 4 | Earth Engine | 2018– | Copernicus |
| 8 | ESA WorldCover `ESA/WorldCover/v200` | Control matching; `WATER_CHECK_UNIT` water fraction | Earth Engine | 2021 | CC BY 4.0, credit ESA |
| 9 | ERA5-Land daily aggregates | Weather covariates, validation layer 5 | Earth Engine | 2003– | Copernicus C3S |
| 10 | Sentinel-2 SR harmonized | Rater image chips | Earth Engine | 2017– | Copernicus |
| 11 | Kiln inventory: Lee et al. 2021 (PNAS) | Primary candidate | Paper data release | Ground truth Oct 2018–May 2019 | **Not used: the pre-registered rule selected APAD** (open licence, more kilns, window covering a complete season) |
| 12 | APAD "IGP Brick Kilns Bangladesh" (and the transfer region) | Primary candidate; agreement analysis; transfer test | AWS Open Data, anonymous | Vintage recorded at download | **CC BY 4.0 — attribution required.** Also APAD Pakistan and APAD India for Amendments 2–4 |
| 13 | SentinelKilnDB (NeurIPS 2025) | **Validation only** in Bangladesh (independent check of candidate unmapped kilns); **the Afghanistan inventory for Amendment 3** | HuggingFace | ~2023–24 Sentinel-2 | **CC BY-NC 4.0 — non-commercial; cannot be primary for Bangladesh under the pre-registered rule** |
| 14 | Bangladesh boundaries, ADM2 district and ADM3 upazila (HDX COD-AB) | Areas of interest and aggregation | HDX CKAN | Current | As stated on HDX; recorded at download |
| 15 | **Transfer-region boundary** (one IGP district) | Transfer test (Should tier) | That country's HDX COD-AB preferred; GADM as fallback | Current | Recorded at download. **GADM restricts redistribution and commercial use**, so a GADM geometry is used for computation only and never published |
| 16 | EOG VIIRS Nightfire (VNF) daily | Gate GN only | EOG registration | 2012– | EOG terms; credit Payne Institute. **GN was skipped in the gate run (no EOG credentials; EOG keys unused by the current pipeline)** |
| 17 | OpenAQ v3 (US Embassy Dhaka; DoE CAMS where listed) | Validation layer 5 | OpenAQ API key | ~2016– | Per provider |
| 18 | OSM Bangladesh (Geofabrik) schools and hospitals; BANBEIS school counts | Proximity components and OSM completeness — regulator export only (Could tier) | Download | Current | ODbL; credit OSM contributors. **Not configured in the current build** |
| 19 | Crop calendar (Aman and Boro harvest windows) | Harvest shading on the shape figure; the `nokiln` calendar split | `data/static/crop_calendar.csv`, hand-built | Static | Each row cited |
| 20 | Policy events: 2013 Act, 2019 amendment, DoE drives | Timeline markers, closure case studies | `data/static/policy_events.csv`, hand-built | Static | Each row cited |
| 21 | Satellite milestones (launches, planned end dates) | Timeline markers | `data/static/satellite_events.csv`, hand-built | Static | Each row cited |
| 22 | **NASA Black Marble VNP46A2 night lights** | **Amendment 1 GL** (kiln seasons) and the transfer TL/LL tests | Earth Engine | 2012– | NASA open data; Román et al. 2018 |
| 23 | **Copernicus Sentinel-1 SAR GRD** | **Amendment 1 GS** (independent check) and the transfer TS/LS tests | Earth Engine | 2015– | Copernicus open licence |
| 24 | geoBoundaries ADM0 Pakistan / India | Amendment 2: land-only mask for control selection | geoBoundaries | Current | ODbL 1.0 (Pakistan), CC0 1.0 (India) |

**The `type` field.** FIRMS documents `type` (0 presumed vegetation fire, 1 active volcano, 2 other static land source, 3 offshore) for MODIS standard-processing data only. Whether the VIIRS standard-processing archive carries it is resolved in Phase 0.4 and logged in step A1a. The architecture works either way: the classifier is needed because NRT data has no `type`, and because if kilns appear as `type=0` the field cannot separate them.

---

## 5. Pipeline stages

Each stage is a module in `kilnwatch/`. It reads `data/raw` or `data/interim`, writes `data/interim` (Parquet), `data/models` or `web/public/data`, and runs alone with `python -m kilnwatch <stage>`. Earth Engine runs as the separate `gee` stage because it is slow and resumable; **`python -m kilnwatch all` fails fast with a named error if the Earth Engine cache is missing** and never proceeds with a partial denominator.

### 5.1 Ingest and Earth Engine (`ingest.py`, `gee.py`)

**FIRMS.** Archive CSVs are loaded and gaps filled from the API. Every record is normalised into `detections.parquet`:

| Column | Meaning |
|---|---|
| `sensor` | `T`, `A`, `N`, `J1`, `J2` |
| `lat`, `lon` | Pixel centre as reported |
| `t_utc`, `t_local`, `date_local`, `season` | `t_local = t_utc + 6 h`; `season` is the July–June season year, e.g. `"2018-19"` |
| `pass` | `D` or `N`, from the `daynight` field |
| `conf_class` | `low` / `nominal` / `high` |
| `bt_mir`, `bt_tir` | VIIRS I4/I5 or MODIS T21/T31 |
| `frp`, `scan_km`, `track_km` | As reported |
| `type` | Nullable; present only where the product carries it |
| `source` | `SP` or `NRT` |

Duplicates on `(sensor, lat, lon, t_utc)` are dropped.

**Confidence harmonization (FA-D13).** MODIS 0–29 → low, 30–79 → nominal, 80–100 → high; VIIRS `l`/`n`/`h` map directly. The default filter keeps nominal and high for every sensor. Sensitivity runs use "all" and "high".

**Earth Engine (`gee.py`).**
- **`daily_clear_fraction`** — for each sensor's daily mask, each unit set and each day, the share of the unit's 1 km mask cells that were observed as clear land:
  - **Observed clear land = `FireMask` classes 5, 7, 8 and 9** (non-fire land; fire at low, nominal and high confidence).
  - **Excluded:** class 3 (non-fire **water**), class 4 (cloud), class 6 (unknown), classes 1–2 (not processed).
  - Water is excluded because fires do not occur on water. Admitting it would inflate the denominator and deflate every rate, by an amount that varies with Bangladesh's large and seasonal water extent — worst in the haor basins, the delta and the monsoon months that form the null.
  - The result is a **fraction**: a `Reducer.sum()` of the clear mask divided by a `Reducer.count()` on a constant image over the same unit. It is never used as an absolute count.
  - Unit sets: `admin` (districts, upazilas, divisions), `footprints` (cluster and control footprints, after §5.3) and `transfer` (Should tier).
- **`water_fraction`** — the WorldCover permanent-water fraction of a unit. Step A3a uses it to choose `WATER_CHECK_UNIT` and to set the threshold of the water assertion.
- **QA bit 2.** The MOD14A1 `QA` band encodes night/day in bit 2. Step A3a tests whether it yields a night-specific observation flag; if it does, a dated amendment adopts it for night denominators and removes the §12 night limitation.
- **`worldcover_at_points`**, **`s5p_monthly`** (monthly NO₂ and SO₂ per belt and ring), **`era5_daily`** (2 m temperature, precipitation, 10 m wind at Dhaka).

**NOAA-20/21 denominators.** Before S-NPP ends, NOAA-20 and NOAA-21 detections use the S-NPP clear fraction (the satellites share an orbital plane about 50 minutes apart); agreement is measured on one month of VJ114A1 and reported. After S-NPP ends, VJ114A1 and VJ214A1 supply them.

**Other inputs** — inventories (with `src` and `licence` columns), boundaries (with a `level` of `district`, `upazila`, `division` or `transfer`), OpenAQ, Nightfire, OSM and the static CSVs — are each loaded into one Parquet or GeoParquet file.

### 5.2 Grid and cell-days (`grid.py`)

**Addressing grid.** A regular 0.01° grid (about 1.0 × 1.1 km at Bangladesh's latitude), anchored at **20.0°N, 68.0°E**, with **1,500 rows** (20.0–35.0°N) and **3,000 columns** (68.0–98.0°E):

```
row     = floor((lat − 20.0) / 0.01 + 1e-9)
col     = floor((lon − 68.0) / 0.01 + 1e-9)
cell_id = row × 3000 + col              # max 4,499,999
```

`cell_id` **raises `ValueError`** if `row` or `col` falls outside its range; it never returns a plausible number for a coordinate off the grid. The grid is wider than Bangladesh so that the IGP transfer district is addressable on the same scheme. Its constants are published in `meta.json` as `grid`, and the browser reads them from there. Worked values: lat 23.7810, lon 90.4125 → id 1,136,241; lat 31.4200, lon 73.0800 → id 3,426,508.

The **analysis extent** is the Bangladesh BBOX (88.0–92.8°E, 20.5–26.7°N): 480 × 620 = 297,600 cells.

**Cell-day indicator.** `F[c, d, s, p] = 1` if at least one filtered detection of sensor `s`, pass `p`, falls in cell `c` on local day `d`.

**Activity rate for a unit A.**

```
clear_cells[A,d,s] = clear_frac[A,d,s] × total_cells_local[A]
a[A,d,s,p]         = Σ_{c∈A} F[c,d,s,p] / clear_cells[A,d,s]
```

`total_cells_local[A]` is the number of grid cells whose centres fall inside A — the same cell set as the numerator. The rate is computed only when `clear_frac ≥ 0.20`; otherwise the day is **not observed**, never zero. "No detection" and "not seen" are different facts.

**Pixel radius per detection (FA-D8).** `pixel_radius_m = 500 × sqrt(scan_km² + track_km²)` — the pixel half-diagonal in **metres**, which grows away from nadir. Worked values: scan 0.39, track 0.36 → 265.4 m; scan 1.0, track 1.0 → 707.1 m. All radii in this system are in metres.

> **Note — daily masks merge overpasses.** The A1 daily masks combine all of a day's overpasses, so denominators are not split by pass unless the QA bit-2 check succeeds. Night figures are therefore reported as **ratios only**: the denominator error cancels in the kiln-versus-control contrast but not in absolute levels or across seasons.

### 5.3 Kiln geometry (`kilns.py`)

1. **Inventory reconciliation (FA-E7, FA-E8, FA-B2).** Load Lee, APAD and SentinelKilnDB. Cross-match within 150 m (BallTree, haversine) and report pairwise agreement and the gap between the DoE register (about 7,000–7,500 kilns) and the detected inventories. The **primary inventory** is chosen by the pre-registered rule in [PREREGISTRATION.md](PREREGISTRATION.md), which runs in one direction only:
   1. open licence — CC BY-NC does not qualify;
   2. a documented ground-truth or imagery window containing at least one complete dry season (1 Nov – 31 May) from 2012-13 onward;
   3. among qualifying inventories, the most kilns inside Bangladesh.

   The **gate season is then derived from the chosen inventory**: the latest complete dry season inside its window. If Lee et al. is chosen, that is 1 Nov 2018 – 31 May 2019. The season is never chosen first.
2. **Clusters (FA-C4, FA-C5, FA-D9).** DBSCAN on the primary kiln points, haversine metric, `min_samples = 1`, with `eps = DBSCAN_EPS_M` — the median VIIRS S-NPP pixel half-diagonal over Bangladesh, derived from the data (expected 300–550 m), with sensitivity runs at 300, 550 and 800 m.
   - With `min_samples = 1` DBSCAN is **connected components at distance eps**, not density clustering, so a belt of kilns at 200 m spacing chains into one long cluster. Any cluster wider than **5,000 m** is split by recursive bisection on its longest axis until every part complies, and no cluster may hold more than **2%** of all kilns.
   - The footprint is the union of 250 m buffers around the cluster's kilns.
   - Clustering uses a constant eps while linking uses per-detection radii because cluster membership is stable across scales and link attribution is not.
   - Per-kiln figures are never computed where kilns are closer together than the positional uncertainty.
3. **Matched controls (FA-D1, FA-E4).** Three per cluster, by seeded rejection sampling with at most **2,000 attempts per control**, climbing a fixed ladder and recording `rung_used`:

   | Rung | Constraints |
   |---|---|
   | 0 | Same district; same majority WorldCover class; 5–10 km from every inventory kiln; ≥5 km from other controls |
   | 1 | As rung 0, but 3–10 km |
   | 2 | Same **division** instead of same district |
   | 3 | Nearest matching WorldCover class within the division |

   The control footprint is the cluster footprint translated to the control point, so the area is identical by construction. A cluster that cannot get three controls is dropped and logged. Dropping clusters concentrates in the densest districts and biases the gate sample toward sparse ones, so the stage fails if more than **20%** of clusters are dropped nationally or more than **40%** in any division.
4. **Detection linking.** A detection links to a cluster or control if it lies within its own `pixel_radius_m` of any kiln point, or translated kiln point, in that footprint. A diagnostic sweep repeats this at fixed radii of 200, 400, 750 and 1,500 m. A signal that appears only at wide radii is landscape burning, not kilns. (FA-D8)

### 5.4 Feasibility gates (`gates.py`)

The gate season is derived as in §5.3. Rules are copied verbatim from [PREREGISTRATION.md](PREREGISTRATION.md). The unit of analysis is a cluster or a control.

| Statistic | Definition |
|---|---|
| `DR` | Clear-day detection rate: clear days with ≥1 linked detection ÷ clear days |
| `DR_night` | The same, night detections only (FA-D7) — reported as a kiln/control **ratio** |
| `S` | Season coverage: share of the 30 Nov–May weeks with ≥2 clear days that contain ≥1 detection |
| `P` | Peak concentration: share of season detection-days inside the best 14-day window |
| `M` | Monsoon null: `DR` over Jun–Oct (FA-D17) |

A kiln fires continuously for months, so it scores **high S and low P**. A harvest fire is a burst, so it scores **low S and high P**.

| Gate | Sensor | Test | Output |
|---|---|---|---|
| **G0** | STA mask (MODIS + S-NPP VIIRS, 2023) | Share of kiln clusters coinciding with an STA cell, and the converse | **Declared prior screen. Informational; does not gate.** Run immediately after `PREREGISTRATION.md` is committed, so it cannot influence any threshold. |
| G1 | VIIRS S-NPP | Shape + contrast + seasonality, all pre-registered | PASS/FAIL |
| G2 | MODIS Terra + Aqua | The same three criteria | PASS/FAIL — decides whether a pre-2012 kiln history exists |
| G3 | MODIS (plus VIIRS if `type` is present) | `type` distribution of kiln-linked detections; STA overlap detail | Descriptive |
| GN | VIIRS Nightfire | The same three criteria | PASS/FAIL, and whether it beats G1 |

Permutation tests shuffle kiln/control labels 10,000 times within district strata; shape tests use a one-sided Mann–Whitney. The per-cluster `DR` distribution is always reported, not only the mean (FA-D15). `gates.py` writes `reports/gate_report.md`; the five-way branch logic is `kilnwatch.gates.branch`, and its outcome is written to `GATE_BRANCH` in `config_derived.json`.

> **Outcome (gate season 2023-24).** G1 **FAIL** — DR ratio 0.46×, permutation p = 0.96, across 3,653 clusters and 10,959 matched controls. G2 **FAIL** — 0.73×. GN skipped (no EOG credentials). `GATE_BRANCH = "nokiln"`: the calendar ships in full with the Aman/Boro/other split and the HBI index, and kilns are pursued through non-fire channels instead (§5.11).

### 5.5 Harmonization engine (`harmonize.py`) — the technical core

**Common unit.** *Aqua-MODIS-equivalent cell-days per 1,000 clear cells* ("MYD-eq"). Aqua is the anchor because its ~13:30 / ~01:30 overpasses nearly match S-NPP's, which separates the resolution effect from the time-of-day effect. (FA-D4)

**Calibration seasons.** `CALIB_SEASONS` = **2012-13 … 2020-21**, nine July–June seasons, derived in step A1a and asserted against the FIRMS archive:
- the lower bound is the first complete firing season after the VIIRS 375 m record begins on **20 January 2012**, so 2011-12 is excluded;
- the upper bound is the last firing season wholly before Aqua's orbital drift began in January 2022, so 2021-22 is excluded.

**Calibration chain.** Every ratio is estimated on same-day pairs where both sensors are observed.

```
MYD-eq(S-NPP)   = β1[g] · a_N              β1: Aqua ↔ S-NPP, over CALIB_SEASONS (SP ↔ SP)
MYD-eq(NOAA-20) = β1[g] · β2[g] · a_J1     β2: S-NPP ↔ NOAA-20, over their overlap (SP ↔ SP)
MYD-eq(NOAA-21) = β1·β2·β3[g] · a_J2       β3: NOAA-20 ↔ NOAA-21, over their overlap (NRT ↔ NRT)
Stratum g = (division [8], month [12], pass [D/N], location class [kiln footprint / other])
```

NOAA-21 exists only as NRT in FIRMS, so **β3 is estimated NRT-to-NRT**. The NOAA-20 SP-to-NRT ratio is measured separately over a common period and reported, so that β3 measures a sensor difference rather than a processing-level difference.

**Stratum sufficiency.** A stratum is usable when it has **≥100 S-NPP cell-days** in the denominator **and ≥10 paired days**. The day threshold alone would be met almost everywhere while carrying too few detections to estimate β.

**Pooling ladder** — a total order. Season buckets: EARLY Nov–Dec, MID Jan–Mar, LATE Apr–May, MONSOON Jun–Oct.

| Rung | Key | Note |
|---|---|---|
| 0 | division, month, pass, loc | Preferred |
| 1 | division, season bucket, pass, loc | |
| 2 | division, season bucket, pass | Pools location class |
| 3 | national, season bucket, pass | Pools division |
| 4 | national, all firing months, pass | Pools season. **Terminal for night strata.** |
| 5 | national, all, all | Pools pass. **Forbidden for any night-specific output**: such a stratum is emitted as not observed rather than given a β estimated across day and night. Permitted for day and combined series only, flagged low-confidence. |

Every β carries `rung_used`, `n_celldays` and `n_days`, and all three are published.

**Models.**
- **M0 — ratio estimator:** `β[g] = Σ a_Aqua / Σ a_SNPP` over paired days in g.
- **M1 — Poisson GLM** (`sklearn.linear_model.PoissonRegressor`). Scikit-learn has no offset parameter, so the exposure is handled by fitting the **rate** as the target with `sample_weight = clear cells`, which is equivalent to a log-exposure offset in the Poisson deviance. The default L2 penalty (`alpha = 1.0`) would shrink the calibration toward the grand mean, so **`alpha = 0.0`**, with `max_iter = 1000` and `tol = 1e-8`. Features: log1p of the S-NPP rate, month, division, pass, location class and mean S-NPP scan width.

**Model selection and coverage (pre-registered).** Validation is **leave-one-season-out** over `CALIB_SEASONS` — nine folds, none of which splits a firing season. M1 ships only if its pooled leave-one-season-out MAE is more than 10% below M0's. The 95% interval's empirical coverage must be **0.90–0.97 pooled across every held-out observation in every fold**; per-season coverage is reported for diagnosis only.

**Uncertainty.** A **season-block** bootstrap (1,000 resamples of whole seasons) gives the β distributions. For each output value, Monte Carlo draws combine a β draw with Poisson count noise to give p2.5, p50 and p97.5. Runs are seeded and deterministic.

**Seam test.** The headline claim — that the 2012 jump is a sensor artefact — is a numeric test. With the transition season 2011-12 excluded, let `d` be the absolute difference between the mean of the two seasons before it (2009-10, 2010-11) and the two after it (2012-13, 2013-14). The seam passes when **`d_harm ≤ 0.25 × d_raw`**, a Chow test finds a break in the raw series at p < 0.01, and finds none in the harmonized series at p > 0.05.

**Record assembly.**
- Before 1 July 2012 (through season 2011-12): Aqua as observed.
- From 1 July 2012: S-NPP converted to MYD-eq, with Aqua drawn as an independent check line through the overlap.
- From 2 November 2026: the chain runs NOAA-20/21 → S-NPP → Aqua.
- Terra appears in the raw view only.
- Aqua after January 2022 and Terra after October 2022 are flagged as the drift era and excluded from calibration.

**Output.** `harmonization.json`: the selected model; β with CIs, rung and counts per stratum and chain step; leave-one-season-out results per season and pooled; the seam block; the SP/NRT ratio; and season-level raw versus harmonized totals for the jump chart. Bootstrap draws are frozen in `data/models/harm_draws.parquet`.

> **Outcome.** M0 selected. Seam **PASS**: d_raw 55.1 → d_harm 1.6 (ratio 2.9% ≤ 25%); Chow p 6×10⁻⁵ raw, 0.29 harmonized. Leave-one-season-out pooled coverage **0.985 — FAIL** against the pre-registered (0.90, 0.97) in the *conservative* direction (intervals too wide, not too narrow); published as-is and logged in [BLOCKERS.md](BLOCKERS.md). The harmonized 2012-13 value (23.4 [21.8–24.9]) matches the unchanged Aqua camera's own reading (23.7).

### 5.6 Source classifier (`classify.py`) — weak supervision on VIIRS

**Unit:** one VIIRS detection.

| Label | Rule |
|---|---|
| Positive (kiln-like) | Linked to a kiln-cluster footprint (§5.3) during Nov–May. In the **augmented** label set only, MODIS `type=2` detections co-located in time and space are added as extra positives. |
| Negative (vegetation-like) | Linked to a matched-control footprint during Nov–May, plus detections >10 km from any inventory kiln in the same months at weight 0.5 (some may be unmapped kilns). |

Positives and negatives share season and landscape class, so the model cannot learn either. Location, date and month are **excluded** from the features, so it cannot learn the labelling rule.

**Features:** `bt_mir`, `bt_tir`, `bt_mir − bt_tir`, `frp`, night flag, `scan_km`, `track_km`, local hour, confidence rank; `p5` and `p30` — same-sensor detections within 500 m over the previous 5 and 30 days, computed from **past detections only** (FA-D6); and `iso1` — detections within 1 km in the same overpass (a spreading crop fire lights its neighbours; a kiln is isolated).

**Models.**
- Rule baseline, which sets the bar: `p5 ≥ 3 AND night`.
- Logistic regression.
- `HistGradientBoostingClassifier` with `random_state = SEED`, `max_iter = 300`, `learning_rate = 0.06`, `max_leaf_nodes = 31`, `early_stopping = True`, `validation_fraction = 0.15`, `class_weight = 'balanced'`. The weak-label weight multiplies the class weight.

**Validation — four holdouts.**

| Holdout | Design |
|---|---|
| Spatial | `GroupKFold(5)` by district |
| Temporal | Train on seasons ≤ 2021-22; test on 2022-23 → 2024-25 |
| Cross-sensor N → J1 | Train on S-NPP; test on NOAA-20 at the same places and times |
| Cross-sensor J1 → J2 | NOAA-20 to NOAA-21 on their NRT overlap |

The frozen model is applied in near-real time to NOAA-20 and NOAA-21, which it was not trained on, using sensor-dependent features. **The NRT updater may use the model only if both cross-sensor holdouts are reported.** If J1→J2 cannot be evaluated, NRT labelling is restricted to NOAA-20 and the limitation is published.

**Label-set comparison and ablation.** The static-source classification behind `type=2` is itself built from detection persistence, and `p5`/`p30` measure persistence, so label and feature share a construction. The classifier is therefore reported twice — footprint-only labels and `type=2`-augmented labels — and refit without `p5` and `p30`. If persistence carries most of the signal, the report says so and non-claim 9 applies.

**Thresholds.** Chosen on validation folds for kiln-like precision ≥ 0.8, then frozen in `data/models/thresholds.json` with the feature list and training git SHA **before** the temporal and cross-sensor holdouts run. `p ≥ t_hi` is kiln-like, `p ≤ t_lo` vegetation-like, anything between unknown. If the model does not beat the rule baseline, the rule ships and this is stated. MODIS-era detections (no I-bands) use the footprint-and-season rule; a pre-2012 kiln layer exists only if G2 passes.

**Candidate unmapped kilns.** 0.01° cells more than 1 km from any inventory kiln with at least 5 kiln-like detection-days in each of at least 2 seasons. Checked automatically against SentinelKilnDB (a match within 300 m counts as confirmed) and manually by two raters on Sentinel-2 (§5.8, layer 3). Candidates go only to the regulator export; the public site shows district counts.

**Artifacts:** `data/models/kiln_clf.joblib` and `data/models/thresholds.json`, committed because the NRT job needs them.

> **Outcome.** HistGradientBoosting ships (PR-AUC 0.218). Under `nokiln` its labels are not used in the public calendar (the harvest split replaces them), but it still labels NRT detections daily. The frozen-model transfer test on Faisalabad, Pakistan **failed** (PR-AUC 0.05 [0.02–0.14] at prevalence 0.03) — expected, since G1/G2 had already shown fire satellites cannot see enclosed kilns; the failure stays published, and the night-light method was tested abroad instead (§5.12).

### 5.7 Metrics (`metrics.py`)

- **Season year:** 1 July – 30 June, so a Nov–May firing season is never split. Calendar views toggle between calendar-year and season-aligned layouts.
- **Robust season metrics (FA-D10)**, each with a week-block bootstrap CI:

  | Metric | Definition |
  |---|---|
  | `midpoint` | Activity-weighted centroid date |
  | `duration` | d90 − d10 of cumulative harmonized activity |
  | `peak` | Maximum of the 15-day smoothed series |

  First and last detection dates are shown only with a bias note: they are highly sensitive to the detection rate, which changes with sensor era.
- **Normal range:** per unit and day of year (±7-day window) over seasons 2003-04 … 2024-25: p10, p50, p90. **Unusual** = above p90 (or below p10 inside the unit's typical season). **Critical periods** = contiguous windows where p50 is in the top quartile of that unit's year.
- **Activity index** — one name in the contract, two definitions by branch:
  - **HKFI** (Harmonized Kiln Firing Index): daily kiln-like MYD-eq activity across a unit's clusters minus the unit's monsoon null, 7-day smoothed. Used in `full`, `from2012`, `partial` and `nightfire`.
  - **HBI** (Harmonized Burning Index): total harmonized burning minus the monsoon null, 7-day smoothed. Used in `nokiln`, where no kiln-like series exists.
- **Under `partial`:** district and national kiln share comes from **classifier labels aggregated to district**, never from cluster-level series, and no per-cluster artefact is produced.
- **Registered-versus-detected gap (FA-B2):** per district where the data allow, otherwise national.
- **Bounded emissions estimate (Could tier):** active kiln-days × published coal use per kiln-day × published emission factors, labelled *order of magnitude, Bangladesh only*. If it is not built, the claim stays in future work.

### 5.8 Validation (`validate.py`)

Ranked by evidential strength; the pitch leads with the strongest. Only rank 1's expectation is pre-registered; the others are stated expectations, not commitments.

| Rank | Layer | Method | Expectation |
|---|---|---|---|
| 1 | Shape + night + monsoon null | The gate statistics extended to every season 2012-13 → 2024-25 | Kiln plateau versus control spikes; night contrast stronger than day. **Pre-registered (G1).** |
| 2 | Independent inventory | SentinelKilnDB match of candidate unmapped kilns (validation use only; CC BY-NC) | Candidate precision > 0.5 |
| 3 | Sentinel-2 two-rater check | **Criterion:** a kiln structure (oval or rectangular FCK, or zigzag, footprint 50–150 m, chimney or its shadow) plus brick stacks or clay pits within 200 m. It shows **existence, not firing.** Sample: top 25 plus a random 25 candidates. Raters record verdicts in `data/static/s2_checks.csv`; **if that file is absent the stage records a `skipped` entry and continues.** | Precision with a Wilson CI; Cohen's κ |
| 4 | TROPOMI NO₂/SO₂ | Belts are upazilas with ≥50 inventory kilns, each compared with a 10–30 km ring of non-kiln cropland. Difference-in-differences: `(belt − ring)_Nov–May − (belt − ring)_Jun–Oct`, plus the monthly correlation with the **activity index** (HKFI, or HBI under `nokiln`; recorded as `treatment`). SO₂ is reported but expected to be noisy. | DiD > 0 with CI excluding 0 |
| 5 | Ground PM2.5 | Daily Dhaka PM2.5 on the lagged (0, 1, 2 days) kiln and vegetation indices, with an IGP upwind vegetation index, ERA5-Land weather and month and year fixed effects; week-block bootstrap CIs | Partial r(kiln) > 0 within season. Correlational; seasonality confounds it. |
| 6 | Closure cases | Before/after `DR` for a handful of DoE-demolished kilns | **Qualitative illustration only, never a test** (FA-C3, FA-D11) |
| 7 | Transfer test (Should tier) | The frozen classifier and gate statistics on one held-out IGP district with its own boundary (§4 row 15) and its own clear fractions (`--units transfer`), no retraining | Reported PR-AUC drop. **`dr_computed` must be true, otherwise the test is recorded as skipped.** |

### 5.9 Export (`export.py`)

**Public tier** → `web/public/data/` (generated, gitignored). Contracts in §7.
- GeoJSON is simplified to 0.001° with coordinates rounded to 4 decimals.
- `meta.json` carries the git SHA, the pre-registration SHA, parameters, data versions, credits with licences, non-claims, `gate_branch`, `split_labels`, `activity_index` and **`grid`**.
- **Two safety checks, both required, both run before anything leaves the machine and again in CI:**
  - **Name check** — `assert_public_safe` refuses any field named `kiln_id`, `cluster_id`, `candidate`, `kiln_lat` or `kiln_lon`.
  - **Value check** — `check_public_dir` refuses any point geometry outside the admin boundary set other than unit centroids, and any array whose length equals the number of clusters or kilns. A name check catches the leak you anticipated; a value check catches the one you did not.
- Size budgets per file are enforced in `kilnwatch/export.py` (see [data-contracts.md](data-contracts.md)). If the total exceeds 100 MB the stage fails and names the `--downscale` flag to use (`upazila2012`, then `upazilaweekly`).

**Publication.** `python -m kilnwatch export --publish` runs both safety checks, packages `web/public/data/` (excluding `nrt/`) as `public-data.tar.gz`, uploads it with `--clobber` to the `data-current` GitHub Release, and creates an immutable `data-<short_sha>` release for provenance. The real public export never enters git history.

**Fixtures.** `export --fixtures` writes a synthetic set for each of the five gate branches into `web/fixtures/`. The `nokiln` set is instead a **verbatim offline copy of the real export**, flagged in `meta.demo` (`mode: 'real-offline-copy'`, source SHA) — so the repo demos on real data with no pipeline run, and CI checks every branch's contract.

**Regulator tier** → `regulator/` (gitignored, never hosted), via `export --regulator`:
- per-cluster season metrics and current-season `DR` with CIs;
- positional uncertainty from scan and track;
- proximity components side by side — distance to the nearest OSM school or hospital — **never a composite score** (FA-G3; Could tier);
- per-district OSM completeness, OSM schools ÷ BANBEIS schools (FA-E6; Could tier);
- candidate unmapped kilns with their validation status;
- a README listing the non-claims.

A path guard refuses any regulator write inside `web/`.

### 5.10 NRT updater (`nrt.py` + `.github/workflows/deploy.yml`)

1. Download the `data-current` release asset (for each district's normal range).
2. Query the FIRMS Area API over the Bangladesh BBOX for the last 5 days, for each NRT source: NOAA-20, NOAA-21, MODIS, and S-NPP until 2 Nov 2026 1300 UTC. **An empty or 404 response is not an error.**
3. Append and deduplicate into `data/nrt/season.csv`, which persists in `actions/cache` keyed on the season and is archived on 1 July. If the cache was evicted, rebuild the last 30 days from the API and log that this happened.
4. Grid, build features using `season.csv` history for `p5`/`p30`, label with the frozen classifier and thresholds (subject to the cross-sensor rule in §5.6), and convert with the frozen `harm_draws`.
5. Denominators are provisional: the climatological median clear fraction for each unit and day of year, from `data/models/clear_clim.parquet`. Output is flagged `"provisional": true` and badged in the UI.
6. Write `web/public/data/nrt/current_season.json`, run `tests/test_export.py`, and upload `nrt/` and `season.csv` as a **workflow artifact**. The `deploy` job builds from the release asset plus this artifact. **Nothing is committed to `main`.**

### 5.11 Kiln activity from non-fire channels (`activity.py`) — Amendment 1

The gates said fire satellites cannot see enclosed kilns, so kiln seasons are measured with channels that can:

- **GL — NASA Black Marble VNP46A2 night lights**, half-monthly 2012–: kilns run all night with lamps and workers on site.
- **GS — Copernicus Sentinel-1 radar**, monthly 2015–: fresh brick stacks pile up in the kiln yards (VV yard-minus-ring).

Each cluster's representative kiln site is compared with its three matched A4c controls (the control footprint is the cluster footprint translated, so area is identical by construction). The signal is the **amplitude**: core months minus off months, with the four pre-registered criteria — contrast, prevalence, replication, placebo — run on the clusters the 400-cluster Dhaka pilot never touched, on season 2022-23. The placebo swaps each cluster's first control in as a pseudo-kiln; a real signal must vanish. Six pilot channels were all disclosed (P1–P6: FIRMS night, ECOSTRESS, Landsat, TROPOMI, night lights, radar); only the last two proceeded.

> **Outcome.** GL **PASS**: median seasonal excess +0.195 nW/cm²/sr (p < 10⁻³⁰⁰), 72% of 3,253 clusters > 0, 13 of 13 seasons replicate, placebo p = 0.58. GS **PASS**: +0.30 dB (p = 3×10⁻⁵⁸), 62% of clusters > 0, 9 of 10 seasons, placebo p = 0.12. Contamination upper bound: 0.15% of dry-season fire detections fall on kiln footprints, the same as on farmland.

**Output.** Area-level kiln-season summaries only (≥ 5 clusters per area; onset/end/duration/peak with bootstrap CIs) in `kiln_activity.json` — an optional file whose absence means "no kiln layer" and hides the kiln pages. The public layer is night lights; radar is the independent national check. Earth Engine extraction is cached under `data/raw/gee/activity*` and resumable.

### 5.12 The method abroad (`transfer.py`) — Amendments 2–4

Does the night-light method survive outside Bangladesh? Per country — Pakistan and India from APAD inventories, Afghanistan from SentinelKilnDB (Amendment 3) — kilns are clustered, a seeded 2,000-cluster sample is split into 400 calibration and 1,600 confirmation clusters, and each cluster gets three distance-ring controls matched on WorldCover class, inside the country's ADM0 outline. Night lights run everywhere; radar runs on a nested subsample (about 3× the Earth Engine cost). The four criteria are evaluated twice: with **Bangladesh's months** (TL/TS, strict) and with **months learned on the calibration clusters only** (LL/LS, local). A Bangladesh self-check must recover Dec–Apr / Jul–Oct from the pilot clusters alone.

**Design A2 → A4.** The first Pakistan test failed on its **placebo only**: farmland 3–6 km from kilns also brightens in kiln season (light spill), and the nearest-rung control was rarely the placebo's first. Amendment 4 pre-registered a retest — design A4 — on fresh clusters with controls **≥ 6 km from every mapped kiln** (APAD + SentinelKilnDB), searched out to 40 km, and each cluster's controls in random order.

> **Outcome.** Pakistan: **PASS after the A4 retest** (TL and LL; LL +0.19, 76% of clusters, 13/13 seasons, placebo p = 0.09). India: **PASS on LL** (the primary; +0.19, 68%, 13/13, placebo p = 0.08); TL fails its placebo (p = 0.02). Afghanistan: **no signal** (contrast +0.002, p = 0.75) — the method does not work there, and the site says so. Radar passes in both Pakistan and India with clean placebos.

**Output.** Country-level only — no kiln, cluster or coordinate leaves `data/interim`: the `transfer` block of `kiln_activity.json` plus `reports/transfer_report.md`. `python -m kilnwatch all` does **not** run this stage.

---

## 6. Interim data model (`data/interim/*.parquet`, gitignored)

| Table | Grain | Key columns |
|---|---|---|
| `detections` | One detection | `sensor, t_utc, date_local, season, pass, lat, lon, cell_id, conf_class, bt_mir, bt_tir, frp, scan_km, track_km, type, source` |
| `celldays` | cell × day × sensor × pass | `cell_id, date_local, sensor, pass, n_det` |
| `clear` | unit × day × sensor | `unit_set, unit_id, date_local, sensor, clear_frac` |
| `unit_cells` | unit × cell | `unit_set, unit_id, cell_id` (gives `total_cells_local`) |
| `kilns` | One inventory kiln | `kiln_id, src, licence, lat, lon, cluster_id, matched_srcs` |
| `clusters` | One cluster | `cluster_id, n_kilns, diameter_m, district, upazila, division, wc_class, geometry` |
| `controls` | One control | `control_id, cluster_id, district, division, wc_class, rung_used, geometry` |
| `links` | detection × unit | `det_idx, unit_type, unit_id, radius_m, sweep_radius_m` |
| `pairs` | stratum × paired day | `chain_step, division, month, pass, loc_class, date_local, a_ref, a_new, celldays_new` |
| `labels` | One VIIRS detection | `det_idx, labelset, p_kiln, label, label_src` |
| `series` | unit × day | `unit_id, date_local, raw_by_sensor..., myd_eq_p50, myd_eq_lo, myd_eq_hi, split_key, split_p50, index_p50` |

Bootstrap draws are not an interim table: they are a frozen model artifact, `data/models/harm_draws.parquet` (`chain_step, division, month, pass, loc_class, draw, beta`).

The Amendment-1 and transfer stages (§5.11–§5.12) keep their raw series in Earth Engine caches (`data/raw/gee/activity*`, `data/raw/gee/transfer`) rather than in new interim tables; their outputs go directly into the public payload and `reports/`.

---

## 7. Static data contracts (`web/public/data/`)

These files are the "API" between the pipeline and the UI. The authoritative interface is `web/src/lib/types.ts`, asserted by `tests/test_contracts.py` under all five gate branches; per-file detail in [data-contracts.md](data-contracts.md). A day index counts days since 2003-01-01. Daily series are **sparse**: only non-zero days are listed, and unobserved days are given as runs.

| File | Content | Budget |
|---|---|---|
| `meta.json` | `generated_at`, `git_sha`, `prereg_sha`, params, data versions, credits with licences, non-claims, `gate_branch`, `split_labels`, `activity_index`, `grid` | < 50 KB (with `events.json`) |
| `events.json` | Policy events and harvest windows | < 50 KB (with `meta.json`) |
| `aoi/districts.geojson` · `aoi/upazilas.geojson` | Simplified boundaries with `unit_id`, names (en, bn), division, kiln count, kiln-like share | < 400 KB · < 1.5 MB |
| `calendar/{unit_id}.json` | `days[]` with aligned `raw{sensor}`, `h`, **`split[]`**, optional `index`; `nodata` runs; `clear_frac` (districts); weekly `h_lo`/`h_hi`; `normal` p10/p50/p90; `unusual`; `critical`; `seasons[]` with CIs | < 150 KB gz each; about 560 units |
| `grid/{tile}.json` | 1° × 1° tiles of sparse `[cell, day, sensor_pass]` fire cell-days for drawn boxes. **Totals only, no source label** — equivalent to public FIRMS data | < 1 MB gz each |
| `harmonization.json` | Selected model; β with CIs, rung and counts; leave-one-season-out per season and pooled; seam block; SP/NRT ratio; season raw vs harmonized | < 200 KB |
| `validation.json` | Gate rows (G0–GN); plateau-vs-spike profiles (pooled); radius sweep; classifier PR curve, importance, four holdouts, label-set comparison, ablation; control drop and rung counts; candidate precision; TROPOMI with `treatment`; PM2.5 lags; transfer; closure cases; `skipped` | < 500 KB |
| `kiln_activity.json` | Amendment 1 (optional file): pilots P1–P6, GL/GS tests, contamination bound, area-level kiln-season summaries, national radar check; `transfer` block (Amendments 2–4, country-level). **Absent file = no kiln layer** | < 1.5 MB |
| `nrt/current_season.json` | Season-to-date national and per-district MYD-eq, the split, `provisional: true`, `updated_at` | < 300 KB |

**Why `split[]`.** Category names are not known until the gate decides the branch: `nokiln` splits into Aman harvest, Boro harvest and other, not kiln, vegetation and unknown. The contract therefore carries `split: {key, values}[]` with labels in `meta.split_labels`, so the decision changes data, never code.

**Drawn box.** The client sums tile cell-days inside the box, uses the containing district's daily `clear_frac` and `total_cells_local` as the denominator, and converts with the containing division's β. The result is labelled "approximate; total burning only." Boxes under 100 km² are rejected.

---

## 8. Frontend architecture (`web/`)

Full detail in [web-frontend.md](web-frontend.md); design rationale in [redesign_plan.md](redesign_plan.md). In summary:

- **Stack.** React 19 + TypeScript built by Vite into static `web/dist`. `HashRouter` makes deep links work on Pages. Apache ECharts tree-shaken through `echarts/core`. Tailwind CSS v4, whose `@theme` tokens ECharts also reads, so UI and charts share one palette; `theme.ts` carries literal fallback colours for when `getComputedStyle` returns empty strings. Fonts are bundled (Anek Bangla variable, IBM Plex Mono). The map is a **self-contained SVG choropleth** (`BdMap.tsx`) — pan, zoom, click-select, box drawing — with no map library and no tiles.
- **Data source.** Vite's `publicDir` is chosen at build time: `DATA_SRC=fixtures` serves `web/fixtures/<FIXTURE_BRANCH>/` (default `nokiln` — a verbatim offline copy of the real export, so dev shows real data); `DATA_SRC=real` serves `web/public/`. No copying, so fixtures can never overwrite real data.
- **State lives in the URL.** Route params (`/area/:unitId`, `/kilns/:unitId`, `/impact/:who/:unitId`, `/explore/:level/:unitId`, `/explore/box/:w,:s,:e,:n`) and search params (`mode`, `layout`, `season`, `lang`, `split`) carry the whole view. No global store.
  - **Box URLs** use a canonical form: four values to exactly 4 decimal places, W,S,E,N order, `w < e`, `s < n`, inside the BBOX, area ≥ 100 km². Anything else renders a `StatusMessage`.
  - **An unknown `split` key falls back to `all`**, so a link shared under one branch still opens after a rebuild under another.
- **Data loading.** A `useJson<T>` hook with an in-memory cache reads §7 files from `${BASE_URL}data/`. `box.ts` reads the grid from `meta.grid` and contains **no grid literals**. `SourceStackChart` renders `split[]` against `meta.split_labels`; there is **no branch special-casing anywhere in the UI** — only routes are hidden by `gate_branch` or the absence of `kiln_activity.json` (`useKilnsVisible`).
- **Pages, organised around the four judging questions** (redesign v2):

  | Page (route) | Judging question | Content |
  |---|---|---|
  | **Home** (`#/`) | All four | Three findings, the `Ledger` hero (raw vs harmonized), today's NASA data, the judge guide |
  | **How it works** (`#/how`) | Creativity, Relevance | The whole approach in six walked steps, each on real data |
  | **My area** (`#/area/:unitId?`) | Impact | Search / tap map / geolocation (matched on-device) → burning season, this-season verdict, kiln season, typical year; compare areas |
  | **Kiln planner** (`#/kilns/:unitId?`) | Impact | 2012 → today season slider; start/busiest/end per area; longest and fastest-growing seasons |
  | **Who benefits** (`#/impact/:who?/:unitId?`) | Impact | Person × district playbook: their real question, the data there, dated actions, the limits; printable with its own URL |
  | **Can you trust it?** (`#/trust`) | Validity | Every pre-registered test in plain words, failures included; honesty practices; non-claims; the transfer country switch |
  | **Sensor switch · Timeline** (`#/sensors`, `#/timeline`) | Creativity, Impact | The 2012 "fire explosion" puzzle; 2002 → 2027 events with sources (linked from the pages above) |
  | **For experts** (`#/experts` + legacy routes) | Validity | Hub to `#/story`, `#/explore[...]`, `#/experts/kilns[...]` (gated by `useKilnsVisible`), `#/season`, `#/evidence`, `#/method` — kept so shared links survive |

- **Performance.** Everything except Home is a lazy chunk; first meaningful paint under 1.5 s on 4G and initial payload under 1.5 MB gz remain the targets.
- **Accessibility.** Colour-blind-safe palette plus ECharts decal patterns, ECharts ARIA on, a summary sentence under every chart, keyboard-reachable controls, search as the accessible alternative to clicking the map, reduced-motion and forced-colors fallbacks (all e2e-tested).
- **Offline.** `npm run preview`. The map is basemap-free SVG and fonts are bundled, so the whole site works with no network.
- **Bangla.** `lib/i18n.ts` with `{en, bn}` UI chrome (`?lang=bn`), `Intl.NumberFormat('bn-BD')`, bilingual split labels / non-claims / event labels / unit names from the pipeline data. Long-form prose stays English with a visible note.

---

## 9. CI/CD and hosting

| Item | Choice |
|---|---|
| Hosting | GitHub Pages serving `web/dist`, deployed by `actions/upload-pages-artifact` + `actions/deploy-pages` |
| `ci.yml` (push, PR) | `python`: Ruff + pytest — synthetic tests only; `test_isolation.py` fails if any test references `data/`. `web-fixtures`: `npm ci`, ESLint, `tsc --noEmit`, Vitest, **a `DATA_SRC=fixtures` build for each of the five fixture branches**, both safety checks, bundle-size report. |
| `deploy.yml` (push to `main` or `redesign`, cron 03:00 UTC, dispatch) | `nrt` job → workflow artifact. `deploy` job (`needs: nrt`, runs if it succeeded or was skipped) → download `data-current` → download the NRT artifact → `DATA_SRC=real` build → both safety checks → Pages. |
| Real public data | GitHub Release asset `data-current` (`public-data.tar.gz`), uploaded by `export --publish`; immutable `data-<short_sha>` releases for history. Never in git. |
| Secrets | `FIRMS_MAP_KEY` only. Earth Engine credentials never enter CI. |
| Safety gate | Both workflows run the name grep **and** `python -m kilnwatch export --check-public web/dist/data`; either failing blocks deployment |
| Failure behaviour | If `data-current` is missing or a check fails, deploy fails loudly and the last good Pages deployment stays live |
| Offline fallback | `web/dist` served locally, `presentation/backup/*.png`, and the one-page headline PDF |

---

## 10. Governance: dual-tier release

| Tier | Audience | Contents | Channel |
|---|---|---|---|
| Public | Researchers, journalists and NGOs, fire-data users, judges | District and upazila calendars, kiln-like share, pooled cluster profiles, harmonized trends, all validation evidence | GitHub Pages |
| Restricted | DoE inspectors, on request | Per-cluster leads with CIs, positional uncertainty, proximity components side by side, OSM completeness, candidate unmapped kilns | Offline export handed over directly; never hosted |

The reason for two tiers: a public per-site ranking of private businesses, built on a method still being validated and biased toward better-mapped urban areas, could harm kiln owners and workers.

**Non-claims** — shipped in `meta.json`, on the Method page and in the regulator README:

1. A detection is not proof that any kiln is operating illegally. Outputs are inspection leads.
2. "No detection" means "no detection on N cloud-free days," not "kiln off."
3. Counts are not emissions; any emissions figure is a labelled order-of-magnitude estimate.
4. A satellite cannot see a licence, a kiln's technology, or exact distances to schools.
5. The calibration does not apply outside its training coverage: seasons 2012-13 … 2020-21, Bangladesh strata.
6. Before-and-after comparisons around the 2013 Act are descriptive, not causal.
7. Thermal detection of kilns is a hypothesis we tested, with gate results published — not an established method.
8. No pre-2012 kiln history unless G2 passed.
9. Wherever `type=2` labels were used, the classifier is not independent of FIRMS's own static-source logic. The footprint-only comparison and the persistence ablation are published alongside.

---

## 11. Quality and reproducibility

- **Pinned environments.** `requirements.txt` pins exact versions for Python 3.11; `web/package-lock.json` pins JavaScript packages.
- **One command per direction.** After documented downloads, `python -m kilnwatch gee` then `python -m kilnwatch all` produce `web/public/data`, and `npm run build` produces the site. Downloads are scripted where APIs allow and documented in the README where they need email or a login. The Earth Engine cache in `data/raw/gee/` is part of the reproduction bundle.
- **Determinism.** Every stochastic call — bootstraps, permutation tests, control sampling, splits, model training — takes a seed derived from `config.SEED` through `SEED_OFFSETS`. Two consecutive runs produce byte-identical `harm_draws.parquet` and `labels.parquet`.
- **Three kinds of verification** (see [operations.md](operations.md)):
  - **Unit tests** (pytest, Vitest) — synthetic input only, run in CI, each asserting against a stated value, a closed-form property or a published reference, never against current output. Grid-math parity between Python and TypeScript runs through `tests/fixtures/grid_cases.json`, and `box.test.ts` proves the browser reads `meta.grid` by altering it.
  - **Stage assertions** — real data, inside the pipeline stage, non-zero exit on failure.
  - **Human checks** — rows in [VERIFICATION.md](VERIFICATION.md), signed and dated by a person; an agent never ticks one.
- **Evidence trail.** `reports/` holds the generated gate, harmonization, classifier, validation, kiln-activity and transfer reports and figures; it replaces notebooks. `reports/baseline.json` freezes the accepted headline numbers, and the clean-clone check asserts against it.

---

## 12. Known limits and upgrade paths

| Limit (deliberate) | Effect | Upgrade path |
|---|---|---|
| Daily A1 masks merge a day's overpasses | Night figures are reported as kiln/control **ratios only** | QA bit-2 night flag (tested in A3a); otherwise L2 swath masks |
| Rung 5 is forbidden for night strata | Some night strata are reported as not observed rather than pooled across day and night | More calibration seasons as NOAA-20/21 overlap grows |
| NOAA-20/21 use the S-NPP clear fraction before Nov 2026 | Small denominator error from the ~50-minute offset, measured on one month and reported | Full VJ114A1 / VJ214A1 via `earthaccess` |
| NRT denominator is climatological | Current-season rates are provisional | Earth Engine service account in CI, or a daily VJ114A1 fetch |
| β3 is estimated from NRT data | Carries NRT processing differences, partly corrected by the measured NOAA-20 SP/NRT ratio | NOAA-21 standard processing, when FIRMS publishes it |
| Drawn box uses district clear fraction and division β | Approximate; total burning only | Per-block clear tiles |
| No boundary-layer height in the PM2.5 model | Residual meteorological confounding | ERA5 single-level BLH via CDS |
| Kiln inventory vintage | Newer kilns missing; unmapped kilns inside controls bias results toward the null (conservative) | A newer **openly licensed** inventory satisfying the pre-registered rule. SentinelKilnDB (CC BY-NC) remains validation-only. |
| Kiln technology (FCK vs zigzag) not distinguished | Detectability may differ by technology; not claimed | Technology labels from an inventory that records them |
