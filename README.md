# 🔥 Kiln Watch

**One fire record from MODIS and VIIRS: a burning-activity calendar for any area.**

NASA Space Apps Challenge 2026 · **Challenge: Harmonization of MODIS and VIIRS Hot Spots**

🌐 **Live site: https://aalvee-aarham.github.io/kiln-watch/** (updated daily from NASA FIRMS)

## In short

In 2012 NASA's sharper VIIRS camera joined the older MODIS cameras, and recorded fire jumped. Nothing new was burning; the camera had changed. Kiln Watch puts MODIS and VIIRS on one scale, from 2003 to today, and turns that record into a burning-activity calendar for an area: its normal season, its unusual days and its critical weeks. It is built for emergency responders and forest officers, farm officers, inspectors and scientists, and it keeps more than 20 years of fire history usable as MODIS ends.

## The problem

- **Two cameras, two pixel sizes.** MODIS sees the ground in 1 km squares. VIIRS sees it in 375 m squares, so about 7 VIIRS squares fit in one MODIS square. A small fire fills more of a small square, so VIIRS notices many fires MODIS misses.
- **The 2012 jump.** When VIIRS arrived, fire counts jumped overnight. The land did not change; the camera did. Joined as they are, the old and new records cannot be compared.
- **MODIS is ending.** NASA plans to end MODIS data collection in 2027 ([NASA Earthdata](https://www.earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs)). After that only VIIRS is left. Without a bridge, the MODIS years cannot be compared with the years to come.

## How we harmonize

```
MODIS (1 km) ──┐
               ├─▶ 1. days both saw ─▶ 2. exchange rate ─▶ 3. cloud correction ─▶ 4. 95% ranges ─▶ one record, 2003 → today
VIIRS (375 m) ─┘
```

1. **Match the days both cameras saw.** We pair the same place on the same day, seen by both cameras.
2. **Learn an exchange rate.** From those pairs we learn how many MODIS detections one VIIRS detection is worth, by region, month, and day or night pass, like converting currencies.
3. **Correct for cloud.** Satellites cannot see fire through cloud, so we divide by the cloud-free land seen each day (Google Earth Engine). A cloudy day is "not seen", never "no fire".
4. **Give every number a range.** Resampling whole seasons gives each value a 95% uncertainty range.

The unit is *MODIS-equivalent fire cell-days per 1,000 cloud-free cells*. The full method, including which satellites carry each camera, is under [Validity](#validity).

## Results

| What we checked | Before | After | Source |
|---|---|---|---|
| **The fake 2012 jump** | 55.1 units | **1.6 units**: 97% of the jump was the camera | [`reports/harmonization_report.md`](reports/harmonization_report.md) |
| **Do the cameras agree?** VIIRS ÷ MODIS on the same district-months | 4.4× | **1.04×** | `harmonization.json` (site data), *Can you trust it?* page |
| **Agreement score** (Lin's concordance, 1 = perfect) | 0.62 | **0.98** | same |
| **Does it match what MODIS saw directly?** Season 2012-13 | | corrected **23.4** (range 21.8–24.9) vs MODIS **23.7** | `harmonization.json` |

A statistical break test finds a clear break in the raw record (p = 6×10⁻⁵) and none after correction (p = 0.29). The agreement also holds on later seasons the correction never saw (4.8× → 1.04×, concordance 0.61 → 0.96). Every pre-registered test, including the ones that failed, is listed under [Validity](#validity).

## Burning-activity calendar

For each area, Kiln Watch shows every day since 2003 on the harmonized scale, and from that:

- **The normal season:** the usual first, busiest and last month, and the normal range (the middle 80% of past seasons for each day).
- **Unusual days:** days above what 9 out of 10 past seasons had on the same date.
- **Critical weeks:** the busiest weeks of the area's normal year.
- **This season so far:** updated every day from NASA FIRMS near-real-time data, marked provisional.
- **A two-week outlook:** the chance of at least one unusual day in the next 14 days, shown from 1 November to mid-May. It was backtested on past seasons and beats the usual chance for that week (Brier skill 0.075).

**Picking an area.** Search by name in English or Bangla, tap the map, use your location (matched to an area on your device and never sent anywhere), draw a box or enter coordinates. Today the areas are Bangladesh's 64 districts and their upazilas (560 calendars). See [Coverage](#coverage-and-next-steps).

## AI agent: Ask Kiln Watch

Ask a question in plain English or Bangla, for example *"When is burning season in Rajshahi, and is this year unusual so far?"* or *"Did the correction really remove the 2012 jump?"*

- **It picks its own steps.** Claude (Anthropic) decides which of the project's five functions to call, and in what order: find an area, its fire calendar, this season so far, the two-week outlook, and the harmonization evidence. It takes at most 6 steps per question.
- **Our code computes; the AI explains.** Every figure comes from a tested project function reading NASA FIRMS data in the public export. A check blocks any answer that states a number no function returned, and the page shows "blocked" rather than an unchecked figure.
- **You can see the data behind each answer:** every function call, its result, the dataset and the data build.
- **Where to use it.** `python -m kilnwatch ask "your question"` answers any question live (needs an `ANTHROPIC_API_KEY`). The website's AI agent page (`#/ask`) shows saved answers to demo questions, generated with `python -m kilnwatch ask --build-cache`, so it works offline. Until answers are generated for a data build, the page says so.
- **Limits.** It answers about Bangladesh areas only, the same areas the website covers. Code: [`kilnwatch/ask.py`](kilnwatch/ask.py); disclosure: [`docs/AI_USE.md`](docs/AI_USE.md).

## Extension 1: crop burning windows

**Problem.** Farm officers need to know when fields burn after the rice harvests, so they can offer alternatives before burning starts.
**Method.** Each area's calendar is split into burning inside the Aman and Boro rice-harvest windows, and burning outside them.
**Result.** Every area shows its harvest windows on its calendar, and the share of its burning that falls in each. The farm-officer plan on *Who benefits* turns this into dates, such as starting a straw campaign a month before burning begins.

## Extension 2: brick kilns

**Problem.** Brick kilns are a major source of Dhaka's winter smog, and inspectors need to know when they are working. Fire satellites cannot see them: kilns burn inside closed brick chambers. Only 0.15% of dry-season fire detections fall on kilns, the same as on ordinary farmland.
**Method.** We read the kiln season from **NASA Black Marble night lights** instead (kilns run all night with lamps and workers on site), and checked it with **Sentinel-1 radar** (brick stacks pile up in kiln yards). Both tests were written down before the data were analysed.
**Result.** 72% of 3,253 held-out kiln clusters glow brighter in kiln season than nearby farmland, in 13 of 13 years; radar passes as an independent check. Kilns work from about mid-November to mid-April, busiest in February, and the season has grown from **about 3 months (2012–15) to about 5 months (2022–25)**. Kiln calendars cover 275 districts and upazilas. The same method was tested in Pakistan, India and Afghanistan, with mixed results (see [Validity](#validity)).

## Who it helps

| Who | What they use | What they do with it |
|---|---|---|
| **Emergency responders and forest officers** | Unusual days this season and the two-week outlook | See when burning is running above normal, and plan crews for the weeks ahead |
| **Farm officers** | The normal season and the crop burning windows (Extension 1) | Start straw campaigns a month before burning begins |
| **Inspectors** | The kiln season and its busiest month (Extension 2) | Time inspection rounds to when kilns are actually working |
| **Scientists** | One record across the MODIS-to-VIIRS change, with 95% ranges, as CSV and Parquet | Keep long fire records going after MODIS ends |

The *Who benefits* page also has plans for families and schools, journalists and policy makers.

## Coverage and next steps

| | Status |
|---|---|
| **Bangladesh** | **Live.** The harmonized calendar for all 64 districts and their upazilas, 2003 to today, updated daily; both extensions |
| **South Asia** | **In progress.** The pre-registration is drafted ([`docs/amendment5_draft.md`](docs/amendment5_draft.md)) but not yet agreed, and no regional fire data have been analysed. Each region gets its own exchange rate, tested by the same rules before anything is shown: the Bangladesh calibration is not reused elsewhere |
| **Kiln extension abroad** | **Tested.** Night lights pass in Pakistan and India on a retest, and fail in Afghanistan |
| **Rest of the world** | The method uses only global NASA data (FIRMS detections and daily fire masks), so the same steps can run for any region. The world map shows what is covered today |

**Next steps**
1. Agree and run the South Asia pre-registration (Amendment 5), then publish each region only after it passes.
2. **Pilot with forest and fire services:** we are looking for a forest or fire service to use the calendar and the two-week outlook for one burning season and tell us what they need.
3. Add a plan for responders and forest officers to the *Who benefits* page.
4. Calibrate the newest VIIRS satellite once enough overlapping data exist.

## The website

Every topic has three layers: *what it means* in one plain sentence, an app to *try it*, and *the proof* in the For-experts section ([`docs/redesign_plan.md`](docs/redesign_plan.md), §9 for this version).

| Page | Judging question | What a visitor does |
|---|---|---|
| **Home** | All four | The harmonized fire record in one picture, three findings, today's NASA fire data, real questions turned into actions, and a four-card guide for judges |
| **How it works** | Creativity, Relevance | Steps through the whole approach on real data (cameras, hot pixels, one scale, calendars, who acts, then the kiln extension), then a checklist of everything the challenge asks for and where it is on the site |
| **My area** | Impact | Search, tap the map or use their location → when burning season is there, whether this season is unusual so far, a tested two-week outlook (1 November to mid-May), a typical year month by month with the harvest windows (Extension 1) and kiln months (Extension 2); compare two areas. The map can show NASA satellite or night-lights imagery and step through this season week by week |
| **AI agent** (Ask Kiln Watch) | Creativity, Validity | Plain-language answers written by Claude from the project's own functions, with every function call and result behind each figure |
| **World map** | Relevance | Every country, state and city on Earth, opening on South Asia, with NASA satellite and night-light backgrounds: search any place or tap the map to see what Kiln Watch covers there. Bangladesh is live; South Asia's calendar is being built |
| **Who benefits** | Impact | Picks a person (farm officer, family, scientist, journalist, inspector, policy maker) and a district → their real question, what the data shows there, dated actions, the benefit and the limits. Printable, with its own link |
| **Can you trust it?** | Validity | Every pre-registered test in plain words, marked passed, failed or no link found; whether the cameras agree after correction; how the outlook was tested; how we kept ourselves honest; what we never claim |
| **Kiln planner** (extension) | Impact | Drag a slider 2012 → today and watch the kiln season lengthen on the map; per-area start, busiest month and end; longest and fastest-growing seasons |
| **Sensor switch**, **Timeline** | Creativity, Impact | The 2012 "fire explosion" puzzle; 2002 → 2027 by season with laws and satellite milestones (linked from the pages above) |
| **For experts** | Validity | The original science story, Evidence, Method, the full Explorer (drawn boxes, raw vs harmonized, 95% intervals), kiln charts, code, the research data (CSV + Parquet) and the pre-registration |

The crop burning windows (Extension 1) have no page of their own: they appear on My area, the Explorer and the farm-officer plan.

Everything is computed in the browser from the public, area-level export. "Use my location" is matched to an area on the device and never sent anywhere.

## Validity

### The method in detail

- **The satellite chain.** MODIS flies on Terra and Aqua; VIIRS flies on Suomi NPP, NOAA-20 and NOAA-21. We chain them onto one scale: Aqua ← Suomi NPP ← NOAA-20. Aqua is the anchor because its overpass time matches Suomi NPP's. The unit is *Aqua-MODIS-equivalent fire cell-days per 1,000 cloud-free cells*. The calibration window (2012-13 to 2020-21) ends before Aqua's orbit began to drift.
- **After Suomi NPP.** Suomi NPP stops delivering new data on 2 Nov 2026 ([NASA Earthdata](https://www.earthdata.nasa.gov/data/alerts-outages/content/data-alert-history/21880)); from then on NOAA-20 carries the record on the same scale. The NOAA-21 link is set up but not yet calibrated: there are not yet enough months in which both satellites' near-real-time data overlap.
- **Cloud.** Daily clear-land fractions per area come from the MOD14A1, MYD14A1 and VNP14A1 fire masks in Google Earth Engine.
- **Uncertainty.** A season-block bootstrap gives every value a 95% interval.

### Results (real data, built 6 Oct 2026)

| Test (pre-registered) | Result |
|---|---|
| **Seam:** harmonized 2012 jump ≤ 25% of raw; break in raw (p < 0.01) and none after (p > 0.05) | **PASS**: 55.1 → 1.6 (**2.9%**); Chow p 6×10⁻⁵ raw, 0.29 harmonized |
| **Leave-one-season-out:** pooled 95% coverage 0.90–0.97 | **FAIL (conservative)**: 0.985 [0.982–0.987]. Intervals are too wide, not too narrow. See [docs/BLOCKERS.md](docs/BLOCKERS.md) |
| *Exploratory (not pre-registered):* **do the cameras agree after correction?** VIIRS/Aqua ratio and Lin's concordance on district-months both saw | Raw VIIRS reads **4.4×** Aqua, corrected **1.04×**; concordance 0.62 → **0.98** (calibration seasons). On later seasons the correction never saw: 4.8× → **1.04×**, 0.61 → **0.96** |
| *Exploratory:* **two-week unusual-fire outlook** vs the usual chance for that district and week (leave-one-season-out) | Brier skill **0.075** [0.056–0.097]: a modest but real gain, so it is shown on My area from 1 November |
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

### Pre-registration and amendments

[`docs/PREREGISTRATION.md`](docs/PREREGISTRATION.md) was committed before any analysis, and its thresholds are never edited. Later additions are dated amendments in [`docs/PREREGISTRATION_AMENDMENTS.md`](docs/PREREGISTRATION_AMENDMENTS.md), each written before the data it governs were analysed:

1. **Amendment 1** (6 Oct 2026): kiln activity from night lights and radar.
2. **Amendment 2** (7 Oct 2026): the kiln method in Pakistan and India.
3. **Amendment 3** (7 Oct 2026): Afghanistan.
4. **Amendment 4** (7 Oct 2026): retest with farmland at least 6 km from every kiln, on fresh clusters.

A fifth, for the South Asia calendar, is a draft and not in force ([`docs/amendment5_draft.md`](docs/amendment5_draft.md)).

### Tests that failed

We publish every failure:

- **Leave-one-season-out coverage** missed its target on the safe side: the 95% ranges are too wide, not too narrow.
- **G1 and G2:** fire satellites cannot see brick kilns (0.46× and 0.73× matched farmland). This is why the calendar is split by harvest windows, and why the kiln extension uses night lights.
- **Faisalabad transfer:** a fire-satellite kiln classifier did not transfer to Pakistan, as G1 and G2 predicted.
- **Kilns abroad:** night lights failed their placebo in Pakistan and India on the first run (Amendment 2) and passed on a retest (Amendment 4), and showed no signal in Afghanistan (Amendment 3).

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
| AI agent (Ask Kiln Watch) | http://localhost:5173/kiln-watch/#/ask |

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
| `ANTHROPIC_API_KEY` | Optional: the AI agent (`python -m kilnwatch ask`) | https://console.anthropic.com |
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
- Natural Earth countries, states/provinces and populated places for the world map (public domain; de facto boundaries, no position on any claim)
- NASA GIBS: Blue Marble Next Generation and Black Marble 2016 map backgrounds
- geoBoundaries ADM0 outlines of Pakistan (OpenStreetMap, ODbL 1.0) and India (CC0 1.0), for Amendment 2 controls
- OpenAQ (CC BY 4.0)

## Team

**Team Off The Binary**

- Arna · Frontend
- Sajid · Backend
- Aalvee · AI Agent
- Ahnaf · Data
- Nazifa · Research
- Maruf · Design

## Build dates

The planning documents, pipeline, data processing and first results were built on 5–6 October 2026, after the challenge summary was published; the plain-language redesign and its apps followed on 7 October 2026. The fire-calendar-first pages, the two-week outlook, the research data release, the world map and the AI agent followed on 10 October 2026. The public git history records every date.
