# 🔥 Kiln Watch

NASA Space Apps Challenge 2026

**Challenge: Harmonization of MODIS and VIIRS Hot Spots**

🌐 **Live site: https://aalvee-aarham.github.io/kiln-watch/** (updated daily from NASA FIRMS)

## In short

Every dry season, Bangladesh burns twice over: farmers set fire to crop leftovers after the rice harvests, and about 7,000 brick kilns fire up from November to April. NASA satellites have photographed this since 2003, but their cameras changed over the years, so the records don't agree, and nobody could tell kiln heat from crop fires.

**Kiln Watch** fixes both. It turns 23 years of NASA satellite data (1.2 million fire detections) into **one consistent burning calendar for every district and upazila**, plus a separate **brick-kiln calendar**. It shows them on a plain-language website with interactive apps. Anyone can check their own area. Inspectors can plan when to visit kilns. Scientists can keep long fire records going after NASA's older MODIS cameras retire in 2027.

## The two problems we solve

### Problem 1: The satellites don't agree

**The problem.** Until 2012, fires were recorded by NASA's **MODIS** cameras, which see the ground in 1 km squares. In 2012 the sharper **VIIRS** camera arrived, with 375 m squares, and it notices many small fires that MODIS misses. Fire counts over Bangladesh jumped several-fold overnight. Bangladesh didn't suddenly burn more; the camera changed. Spliced together as-is, the 23-year record is meaningless.

**How we solved it.**
- **One common unit.** On days when two satellites saw the same place, we learned how many old-camera detections one new-camera detection is worth, by region, month and day or night pass.
- **Chaining the satellites.** We chained the satellites onto one scale: Aqua ← Suomi NPP ← NOAA-20. The unit is *Aqua-MODIS-equivalent fire cell-days per 1,000 cloud-free cells*. Suomi NPP stops delivering new data on 2 Nov 2026 ([NASA Earthdata](https://www.earthdata.nasa.gov/data/alerts-outages/content/data-alert-history/21880)); from then on NOAA-20 carries the record on the same scale. The NOAA-21 link is set up but not yet calibrated: there are not yet enough months in which both satellites' near-real-time data overlap.
- **Correcting for cloud.** Satellites can't see fire through cloud, so we counted the cloud-free land every day with Google Earth Engine.
- **Error ranges.** Every number carries a 95% uncertainty range.

**Result.**
- **The fake jump is gone.** The 2012 jump shrinks from 55.1 to 1.6 units: **97% of it was the camera**. A statistical break test finds a clear break in the raw record and none after correction.
- **It matches a real reading.** Our corrected 2012-13 value (23.4, range 21.8–24.9) matches what the unchanged Aqua camera actually saw (23.7).

### Problem 2 (our extension): Telling brick kilns apart from crop fires

**The problem.** Brick kilns are a major source of Dhaka's winter smog. If their heat were hiding inside the fire record, the crop-burning calendar would be wrong, and nobody could say when kilns are actually working.

**How we solved it.**
1. **Test whether fire satellites see kilns at all.** Before looking at the data, we wrote down a test: do 3,653 mapped kiln clusters produce more fire detections than matched farmland nearby? They don't (0.46×). Only **0.15%** of dry-season fire detections fall on kilns, the same as on ordinary farmland. Kilns burn inside closed brick chambers, so fire satellites can't see them. The fire calendar is therefore clean, with no kiln heat to remove.
2. **Find a satellite that can see kilns.** We tried six kinds of data. Two worked:
   - ❌ **NASA FIRMS fire detections:** kiln fires burn inside closed chambers, so the satellite sees no flames.
   - ❌ **NASA ECOSTRESS night heat:** kilns were no warmer at night than nearby farmland.
   - ❌ **Landsat 8/9 surface heat:** it picked up the warm brick buildings even when kilns were shut, so it couldn't tell working kilns from idle ones.
   - ❌ **TROPOMI air pollution (SO₂, NO₂):** each pixel covers too much ground, so kiln smoke gets mixed in with every other source.
   - ✅ **NASA Black Marble night lights:** kilns run all night with lamps and workers on site.
   - ✅ **Sentinel-1 radar:** stacks of fresh bricks pile up in the kiln yards.
3. **Test it fairly.** We wrote the pass rules down in advance ([Amendment 1](docs/PREREGISTRATION_AMENDMENTS.md)) and tested on 3,253 kiln clusters and a season the trial never touched. Both checks passed:
   - **Night lights:** **72%** of kiln clusters glow brighter in kiln season than nearby farmland. The result holds in **13 of 13 years**, and ordinary farmland shows nothing.
   - **Radar:** passes as an independent second check.

**Result.** Bangladesh's first satellite-based **kiln-season calendar**, for 275 districts and upazilas.
- **When:** kilns work from about mid-November to mid-April, busiest in February.
- **Trend:** the season has grown from about **3 months (2012–15) to about 5 months (2022–25)**.

## What we built

1. **A pipeline** (`kilnwatch/`, Python) that downloads, harmonizes and tests the satellite data end to end, from raw NASA files to the public dataset.
2. **A website** with a plain-language layer and interactive apps, and the full science one click away for experts (see below). It refreshes daily from NASA's near-real-time fire data.

## The website

Every topic has three layers: *what it means* in one plain sentence, an app to *try it*, and *the proof* in the For-experts section ([`docs/redesign_plan.md`](docs/redesign_plan.md), §9 for this version).

The pages are organised around the four things Space Apps judges score.

| Page | Judging question | What a visitor does |
|---|---|---|
| **Home** | All four | Three findings, the six steps from satellite to decision, real questions turned into actions, today's NASA fire data, and a four-card guide for judges |
| **How it works** | Creativity, Relevance | Steps through the whole approach on real data (satellites, hot pixels, one scale, finding kilns, calendars, who acts), then a checklist of everything the challenge asks for and where it is on the site |
| **My area** | Impact | Search, tap the map or use their location → when burning season is there, whether this season is unusual so far, when kilns work, a typical year month by month; compare two areas |
| **Kiln planner** | Impact | Drag a slider 2012 → today and watch the kiln season lengthen on the map; per-area start, busiest month and end; longest and fastest-growing seasons |
| **Who benefits** | Impact | Picks a person (inspector, farm officer, family, journalist, policy maker, scientist) and a district → their real question, what the data shows there, dated actions, the benefit and the limits. Printable, with its own link |
| **Can you trust it?** | Validity | Every pre-registered test in plain words, marked passed, failed or no link found; how we kept ourselves honest; what we never claim |
| **Sensor switch**, **Timeline** | Creativity, Impact | The 2012 "fire explosion" puzzle; 2002 → 2027 by season with laws and satellite milestones (linked from the pages above) |
| **For experts** | Validity | The original science story, Evidence, Method, the full Explorer (drawn boxes, raw vs harmonized, 95% intervals), kiln charts, code, data and pre-registration |

Everything is computed in the browser from the public, area-level export. "Use my location" is matched to an area on the device and never sent anywhere.

## Results (real data, built 6 Oct 2026)

| Test (pre-registered) | Result |
|---|---|
| **Seam:** harmonized 2012 jump ≤ 25% of raw; break in raw (p < 0.01) and none after (p > 0.05) | **PASS**: 55.1 → 1.6 (**2.9%**); Chow p 6×10⁻⁵ raw, 0.29 harmonized |
| **Leave-one-season-out:** pooled 95% coverage 0.90–0.97 | **FAIL (conservative)**: 0.985 [0.982–0.987]. Intervals are too wide, not too narrow. See [docs/BLOCKERS.md](docs/BLOCKERS.md) |
| **G1, kilns visible to VIIRS:** DR(kiln)/DR(control) ≥ 3, perm p < 0.01, plus shape and seasonality | **FAIL**: 0.46×, p = 0.96 across 3,653 clusters and 10,959 matched controls |
| **G2, kilns visible to MODIS** | **FAIL**: 0.73× |
| **Transfer, fire-satellite kiln classifier in Faisalabad, Pakistan** (frozen model, APAD Pakistan labels) | **FAIL**: PR-AUC 0.05 [0.02–0.14] against a prevalence of 0.03. Expected after G1/G2: fire satellites cannot see enclosed kilns. The night-light method was then tested abroad (Amendments 2–4, below) |
| → Gate branch | **`nokiln`**: calendar ships in full; split = Aman / Boro harvest windows / other; index = HBI |
| Kiln heat inside the fire calendar (upper bound) | 351 of 234,693 Bangladesh VIIRS detections, Nov–May 2012–2026 (**0.15%**), fall on kiln footprints, against 0.14% on matched farmland: no kiln contamination to remove |
| *Amendment 1 (written before the confirmatory run):* **GL, kiln season in NASA Black Marble night lights**, held-out clusters, season 2022-23 | **PASS**: median seasonal excess +0.195 nW/cm²/sr (p < 10⁻³⁰⁰); 72% of 3,253 clusters > 0; 13/13 seasons replicate; placebo p = 0.58 |
| Other kiln channels tried (pilot, all reported) | FIRMS night detections: 37 of 3,653 clusters in 14 years · ECOSTRESS night: no signal · Landsat day: sees the kiln structure, not firing · TROPOMI SO₂/NO₂: no signal |
| *Amendment 1:* **GS, independent check with Sentinel-1 radar** (brick stacks in kiln yards) | **PASS**: median +0.30 dB (p = 3×10⁻⁵⁸); 62% of clusters > 0; 9/10 seasons; placebo p = 0.12 |
| *Amendment 2:* **night lights in Pakistan and India** (2,000 clusters each; Bangladesh's months TL, and months learned on 400 calibration clusters LL) | **FAIL** in both, on the placebo only. Contrast, prevalence and replication passed (Pakistan LL: +0.15, p ≈ 10⁻⁵⁹, 70%, 13/13; India LL: +0.17, p ≈ 10⁻⁴², 66%, 13/13). Diagnosis: farmland 3–6 km from kilns also brightens in kiln season, and the placebo's first control was the far one |
| *Amendment 2:* **radar in Pakistan and India** (600 confirmation clusters each) | **PASS**, both months and learned months, placebos clean. Learned busy months: Jan–May (Pakistan), Feb–Jun (India) |
| *Amendment 3:* **night lights in Afghanistan** (SentinelKilnDB, 496 clusters) | **FAIL**: no signal (contrast +0.002, p = 0.75). The method does not work there |
| *Amendment 4:* **night-light retest on fresh clusters**, farmland ≥ 6 km from every kiln, random control order | **Pakistan PASS** (TL and LL; LL +0.19, 76%, 13/13, placebo p = 0.09). **India PASS on LL** (primary; +0.19, 68%, 13/13, placebo p = 0.08); TL fails its placebo (p = 0.02) |
| Self-check | Given only Bangladesh's 400 pilot clusters, the window learner picks exactly Dec–Apr / Jul–Oct |

Data: 1,221,809 FIRMS detections (2003 → today) · 13M Earth Engine daily clear-land fractions · 4,760 APAD kilns · 560 district and upazila calendars.
Full reports: [`reports/`](reports/) · Evidence page of the site · pitch materials in [`presentation/`](presentation/).

---

## Getting started

### 1. Run the website (about 3 minutes, no keys, no Python)

You need **Git** and **Node.js 20.19 or newer** (check with `node --version`; get it from https://nodejs.org).

```bash
git clone https://github.com/Aalvee-Aarham/kiln-watch.git
cd kiln-watch/web
npm install
npm run dev
```

Open **http://localhost:5173/kiln-watch/** (the `/kiln-watch/` part matters: a bare `localhost:5173` shows a blank page).

The site runs on `web/fixtures/nokiln/`, a verbatim offline copy of the real pipeline output that ships with the repo, so every page shows real satellite data. The grey banner at the top says so. Edits under `web/src/` reload in the browser instantly. Stop the server with `Ctrl+C`.

Good first pages:

| Page | Address |
|---|---|
| Home | http://localhost:5173/kiln-watch/#/ |
| How it works (six steps, real data) | http://localhost:5173/kiln-watch/#/how |
| Who benefits (a plan for one person and district) | http://localhost:5173/kiln-watch/#/impact/inspector/BD3026 |
| Can you trust it? (every test, failures included) | http://localhost:5173/kiln-watch/#/trust |
| My area | http://localhost:5173/kiln-watch/#/area |

**Production build** (what GitHub Pages serves):

```bash
npm run build      # writes web/dist/
npm run preview    # http://localhost:4173/kiln-watch/
```

**Other data sets.** `FIXTURE_BRANCH=full|from2012|partial|nightfire|nokiln` switches to the synthetic fixture for another gate outcome. `DATA_SRC=real` serves `web/public/data/`, which only exists after you run the pipeline yourself (step 2). In PowerShell, set them first: `$env:DATA_SRC="real"; npm run dev`.

### 2. Run the Python pipeline (optional, hours, needs free accounts)

You need **Python 3.11 or newer** and about 1 GB of free disk space for the downloaded satellite data.

```powershell
# Windows PowerShell, from the repo root
py -m venv .venv
.venv\Scripts\Activate.ps1          # if blocked: Set-ExecutionPolicy -Scope Process Bypass
pip install -r requirements.txt
copy .env.example .env
```

```bash
# macOS / Linux
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Fill in `.env` (it is gitignored; never commit it):

| Key | Used for | Where to get it (free) |
|---|---|---|
| `FIRMS_MAP_KEY` | NASA FIRMS fire archive and the daily near-real-time update | https://firms.modaps.eosdis.nasa.gov/api/map_key/ |
| `OPENAQ_API_KEY` | Dhaka PM2.5 readings (validation only) | https://explore.openaq.org/register |
| `EE_PROJECT` | Google Earth Engine: clear-land fractions, night lights, radar | A Google Cloud project registered at https://code.earthengine.google.com/register |
| `EE_API_KEY`, `EOG_USER`, `EOG_PASSWORD` | Not needed by the current pipeline | Leave empty |

Then sign in to Earth Engine once and run everything:

```bash
earthengine authenticate
python -m kilnwatch gee --units admin        # slow and resumable; must run before `all`
python -m kilnwatch gee --units footprints
python -m kilnwatch all                      # every other stage, then the public export
cd web && DATA_SRC=real npm run dev          # PowerShell: $env:DATA_SRC="real"; npm run dev
```

Each stage can also be run on its own (next section). Every stage writes a report to `reports/`.

### 3. Run the tests

```bash
pytest -q                     # Python, from the repo root (synthetic data only)
cd web
npm test -- --run             # unit tests (Vitest)
npm run build && npm run e2e  # every page in day, night and phone layouts (Playwright)
```

The first `npm run e2e` may ask you to run `npx playwright install chromium`.

### Troubleshooting

| Problem | Fix |
|---|---|
| Blank page at `localhost:5173` | Add `/kiln-watch/` to the address |
| `Port 5173 is in use` | `npm run dev -- --port 5174`, or stop the other server |
| `npm run e2e` cannot find a browser | `npx playwright install chromium` |
| `python -m kilnwatch all` stops at once | Run the two `gee` commands first: `all` fails fast without their cache |
| Earth Engine `not registered` error | Register the Cloud project for Earth Engine and set `EE_PROJECT` |

## Reproduce the analysis

| Step | Command | What it does |
|---|---|---|
| 1 | `python -m kilnwatch ingest` | FIRMS archive (all 7 MODIS/VIIRS sources, 2003→today, quota-paced and cached per 5-day window), HDX boundaries, APAD kiln inventory, OpenAQ PM2.5 |
| 2 | `python -m kilnwatch gee --units admin` | Earth Engine daily **clear-land fractions** (FireMask 5,7,8,9; water/cloud/unknown excluded) per division, district and upazila. Slow, resumable |
| 3 | `python -m kilnwatch grid` | Fire cell-days on the 0.01° grid; unit cell sets; clear table |
| 4 | `python -m kilnwatch kilns` | Kiln clusters (DBSCAN with 5 km diameter cap), 3 matched controls each, detection linking |
| 5 | `python -m kilnwatch gee --units footprints` | Clear fractions at kiln and control footprints for the gate season |
| 6 | `python -m kilnwatch gates` | Pre-registered feasibility gates G0–G3 → `GATE_BRANCH` |
| 7 | `python -m kilnwatch harmonize` | Calibration chain Aqua ← S-NPP ← NOAA-20 (NOAA-21 not yet calibrated), pooling ladder, M0/M1, leave-one-season-out, seam test |
| 8 | `python -m kilnwatch classify` | Source classifier, 4 holdouts, label-set comparison, persistence ablation, transfer test |
| 9 | `python -m kilnwatch metrics` | ~570 per-unit calendars, normals, flags, season metrics, map layers, grid tiles |
| 10 | `python -m kilnwatch validate` | Validation layers (shape across seasons, TROPOMI NO₂ DiD, Dhaka PM2.5 lags) |
| 11 | `python -m kilnwatch activity --extract all` | Amendment 1: Black Marble night lights (half-monthly, 2012–) and Sentinel-1 radar (monthly, 2015–) at every kiln cluster and its 3 matched controls; tests GL/GS on the held-out clusters; kiln-season calendars per area (slow, resumable) |
| 11b | `python -m kilnwatch transfer` | Amendment 2: the kiln method in **Pakistan and India**. APAD kilns, a seeded 2,000-cluster sample per country, distance-ring controls, Black Marble night lights (and Sentinel-1 radar on a subsample), tested with Bangladesh's months and with months learned on 400 calibration clusters. `--prepare-only` builds samples and controls without any outcome data (slow, resumable) |
| 12 | `python -m kilnwatch export` | Public tier → `web/public/data/`, with name + value safety checks and size budgets |
| 13 | `cd web; $env:DATA_SRC="real"; npm run build` | Static site in `web/dist/` |

`python -m kilnwatch all` runs steps 1, 3, 4, 6–10, 11 (from its cache, without `--extract`) and 12 in order, and fails fast if the Earth Engine cache is missing.

## How it is built

- **Pipeline:** Python 3.11+ · pandas · GeoPandas · scikit-learn · Earth Engine (`kilnwatch/`, one module per stage)
- **Site:** React 19 + TypeScript + Vite + Tailwind CSS v4 + ECharts + a self-contained SVG map (`web/`). Static, no server; deep links via `HashRouter`.
- **Contract:** `web/src/lib/types.ts` (Python writes it, TypeScript reads it). It is tested under all five gate branches.
- **Daily updates:** `.github/workflows/deploy.yml` fetches FIRMS near-real-time data, labels it with the frozen model and redeploys.
- **Pre-registration:** [`docs/PREREGISTRATION.md`](docs/PREREGISTRATION.md) was committed before any analysis. Its thresholds are never edited. Later additions are dated amendments in [`docs/PREREGISTRATION_AMENDMENTS.md`](docs/PREREGISTRATION_AMENDMENTS.md), each written before the data it governs were analysed.
- **Knowledge graph:** `graphify-out/` holds a graph of the design docs (`graphify query "<question>"`).

## Research data

`python -m kilnwatch export --research` turns the public export into tidy **CSV + Parquet** tables for analysis: a daily calendar for every district and upazila since 2003 (with an `observed` flag, so "no fire" and "not seen" stay apart), monthly totals, weekly 95% intervals, season metrics, the calibration table and the national series. It ships with a data dictionary, a CC BY 4.0 licence and a SHA-256 manifest, and is attached to every data release as `kilnwatch-research-data.zip`. Like the website, it holds area-level data only.

## Responsible release

Public files contain area-level statistics only. Kiln ids, cluster ids, candidate unmapped kilns and kiln coordinates never reach `web/`. A name check and a value check enforce this locally and in CI. Site-level leads exist only in an offline regulator export (`python -m kilnwatch export --regulator`).

**What we do not claim:** see the Method page or `kilnwatch/config.py:NON_CLAIMS`. In short: outputs are inspection leads, not proof of illegality; "no detection" is not "kiln off"; detection counts are not emissions.

## Credits and licences

Code: MIT. Data:
- NASA FIRMS (MODIS C6.1, VIIRS 375 m)
- Google Earth Engine datasets: MOD14A1/MYD14A1/VNP14A1, ESA WorldCover, Sentinel-5P, ERA5-Land
- NASA Black Marble VNP46A2 night lights (Román et al. 2018); Copernicus Sentinel-1 SAR (ESA); NASA ECOSTRESS L2T LSTE v2 and Landsat 8/9 Collection 2 (kiln pilots only)
- **APAD IGP Brick Kilns Bangladesh / Pakistan / India** (CC BY 4.0). *IGP Brick Kilns Bangladesh was accessed on 2026-10-06 from https://registry.opendata.aws/asset-data-igp-brick-kilns-ban*
- OCHA HDX COD-AB Bangladesh / Pakistan (CC BY-IGO)
- geoBoundaries ADM0 outlines of Pakistan (OpenStreetMap, ODbL 1.0) and India (CC0 1.0), for Amendment 2 controls
- OpenAQ (CC BY 4.0)
- CARTO / OpenStreetMap basemap

## Build dates

The planning documents, pipeline, data processing and first results were built on 5–6 October 2026, after the challenge summary was published; the plain-language redesign and its apps followed on 7 October 2026. The public git history records every date.
