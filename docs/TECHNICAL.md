# Kiln Watch: technical notes

**A monthly calendar of fire hotspots from 2000 to today that does not jump when satellites change, with the
uncertainty and the detections behind every number.**

In 2012 raw satellite hotspot counts rose three- to tenfold in every area we tested. Nothing changed on the ground;
a new satellite (Suomi-NPP VIIRS) started counting smaller fires. The same happened again in 2018, in 2024, and in
reverse on 2 November 2026, when Suomi-NPP stopped. Kiln Watch puts every MODIS and VIIRS satellite onto one scale,
tests that against years the calibration never saw, and lets you open any calendar cell to see the detections,
satellites and reports behind it.

Built for the 2026 NASA Space Apps Challenge *Harmonization of MODIS and VIIRS Hot Spots*. Free data and
open-source code; no paid services.

## Research question and main result

> Can MODIS and VIIRS detections be combined into one record whose level does not change when satellites arrive
> or leave, and how accurate is it on data the calibration never saw?

**Primary unit:** *hotspots on the Aqua MODIS scale*: the vegetation-fire detections Aqua MODIS (early-afternoon and
post-midnight passes) would have recorded. That orbit is the only one observed continuously from 2002 through
Suomi-NPP, NOAA-20 and NOAA-21. Converting VIIRS to the MODIS scale throws information away and is well-posed; the
reverse would have to invent small fires MODIS never saw, so the VIIRS-scale view is marked *modelled* before
2012. Terra is used only for Nov 2000 to Jun 2002, before Aqua.

Results from the current build (`python -m kw.report`, data through 2026-11-10):

| Area | Raw step at S-NPP ÷ Aqua | Harmonized step ÷ Aqua | MODIS-denial bias (ours) | single ratio | uncalibrated | rank ρ | 95% interval coverage | Sen slope/yr harmonized | Aqua only | raw |
|---|---|---|---|---|---|---|---|---|---|---|
| Dhaka brick-kiln belt | 10.58 | 1.15 | +13.1% | +8.3% | +1864.3% | 0.67 | 96 | 0.0 | 0.0 | 0.7 |
| Punjab–Haryana crop residue burning | 4.48 | 0.93 | -5.8% | -4.7% | +469.7% | 0.98 | 96 | 0.0 | -0.1 | 72.5 |
| Chilecito, La Rioja | 4.06 | 1.04 | -9.7% | -1.8% | +812.3% | 0.89 | 96 | 0.0 | 0.0 | 2.5 |
| Rondônia deforestation arc | 5.61 | 1.07 | -0.6% | -2.5% | +516.5% | 0.98 | 96 | -0.1 | -0.2 | 18.1 |
| Fort McMurray boreal forest | 7.43 | 1.19 | -8.9% | -11.2% | +1030.2% | 0.83 | 96 | 0.0 | 0.0 | 1.7 |
| South-east Australia | 5.95 | 0.99 | +4.1% | +3.3% | +815.3% | 0.98 | 96 | -0.9 | -1.0 | 34.4 |
| Northern California | 3.47 | 0.99 | +8.1% | +8.3% | +782.9% | 0.98 | 96 | 1.0 | 0.7 | 33.5 |
| Paraná Delta wetlands | 5.27 | 1.01 | +27.5% | +26.0% | +597.0% | 0.94 | 96 | -1.6 | -1.7 | 6.0 |
| Niger Delta gas flares | 6.44 | 0.95 | -1.7% | -2.0% | +580.5% | 0.98 | 96 | 0.2 | 0.1 | 34.3 |

How to read it:

- **Steps.** Raw counts jump 3.5–10.6× more than Aqua alone when Suomi-NPP arrives; the harmonized record moves
  0.93–1.19×. Placebo tests at dates with no satellite change give each area's normal range (for example 0.99–1.02
  in Punjab, 0.77–1.52 in sparse Dhaka). Five of nine areas fall inside their range. Three miss it narrowly
  (Northern California, South-east Australia, Rondônia, by under 0.01–0.03) and Punjab misses clearly (0.93 against
  0.99–1.02): the harmonized record still under-corrects there by about 7%.
- **MODIS-denial rehearsal.** Calibrate on 2012–2016, pretend MODIS ended, rebuild 2017–2020 from VIIRS alone and
  compare with what Aqua actually saw. Calibration removes errors of +470% to +1,860%. The seasonal
  empirical-Bayes ratios roughly halve the monthly error in strongly seasonal areas (Punjab MAE 146 vs 271) but do
  **not** beat a single ratio on bias in every area. The Paraná Delta (+27%) is a real failure case: its 2020
  record fire year is outside anything the 2012–2016 calibration saw.
- **Intervals.** Raw model intervals were too narrow (35% coverage in La Rioja, 94% in Punjab). Every VIIRS-era
  interval is widened by the factor that gives 95% coverage on the denial test, so the 96% in the table holds by
  construction. A second rehearsal withholds Suomi-NPP for 2024 to Oct 2026: the rebuilt record stays inside the
  full record's interval in all months in all nine areas, with a mean difference of 2–30% (30% in sparse Dhaka). That
  is a weak test, because the intervals are wide; read the mean difference, not the 100%.
- **Trends.** Harmonized 2003–2020 Sen slopes match Aqua-only; raw slopes are inflated by new satellites.
- **Suomi-NPP end.** The last Suomi-NPP detection in the data is 2026-11-02. The record carries on from NOAA-20 and
  NOAA-21, calibrated onto the same scale while all three flew together. This is visible in each area's Continuity tab.

## What it does

- **FIRMS-style map.** Daily NASA GIBS fire layers for every satellite, true-colour imagery of the day, the
  harmonized 0.1° grid for the selected month, and persistent heat sources (kilns, flares, industry).
- **Burning calendar.** A month-by-year table of harmonized hotspots with the number printed in each cell, a
  colour-blind-safe log ramp, hatching where no satellite observed, and marks for in-progress and provisional
  (near-real-time) months. It is keyboard navigable, offers ISO weeks, and has a "vs. median" view.
- **Plain answers.** Which months burn most, which years burned most, how the current month compares with the same
  days in every earlier year, and what share of the year the next four weeks usually hold.
- **Season.** Critical period (the central 80% of activity), peak week, shifts over time, and this year's
  cumulative total against the lowest, median and highest years. Seasons crossing 1 January are handled.
- **Cell inspector.** Value with 95% interval, rank among years, the satellites used and their coverage, daily
  detections, the strongest detections (click to fly there), a CSV download, links to NASA FIRMS and Worldview, and
  a report search over NASA EONET and GDELT news (2017+, local-language keywords). No reports found is shown as
  exactly that, never as evidence.
- **Method and validation.** Denial rehearsals, hold-outs per link (day and night), geographic transfer, chain
  closure, calibration factors, confidence-filter sensitivity, processing versions, an FRP diagnostic, and
  provenance.
- **Downloads.** Calendar CSV (raw, harmonized, bounds, satellites, coverage), hotspot CSV for any date range (FIRMS
  columns plus satellite, version and static flag), the calibration table for all areas, chart SVGs, and a printable
  area brief.
- **Any area.** Draw a box or type coordinates (up to 16 square degrees); the first build takes a few minutes.
- **Analyst (optional).** Gemini free tier, answering only through the deterministic tools; every tool call is
  listed and it can move the map and calendar. Without a key, or when rate-limited, it returns the pipeline's own
  sentences.
- **MCP server.** The same tools for Claude Desktop, Cursor or n8n.

## How the harmonization works

1. **Data.** Every FIRMS detection (MODIS C6.1, VIIRS 375 m C2, standard + NRT), read from the public
   [Portolan GeoParquet mirror](https://source.coop/portolan-mirrors/firms-catalog) with DuckDB. No key, CC0. Only the
   row groups that intersect the area are downloaded.
2. **Filtering.** Drop VIIRS `low` and MODIS confidence < 30 (never crosswalked), with sensitivity reported. Static
   sources are 0.01° cells where science-quality FIRMS `type` is 1–3 for most detections, also applied to NRT rows,
   which carry no type.
3. **Observing opportunity.** The share of days each satellite delivered data anywhere on Earth, measured per period,
   so launches, gaps and the Suomi-NPP end come from the data. Counts are divided by it.
4. **Calibration.** Ratio of totals per calendar month, day and night separately, shrunk toward the pooled ratio by
   empirical Bayes, with the shrinkage strength estimated from the data. Chain: Terra→Aqua (2002–2020),
   Suomi-NPP→Aqua (2012–2020, before orbit drift), NOAA-20→Suomi-NPP, NOAA-21→NOAA-20. Chain-closure mismatch is
   added to the error.
5. **Stitching.** Inverse-variance mean of the satellites observing each period, with intervals widened to measured
   95% coverage.
6. **Comparison.** Median, ratio, percentile and rank against the same period in other complete years, rather than
   sigma thresholds, because fire counts are skewed.

## Run it

Requirements: Python 3.11+, Node 20+.

```bash
cd server
pip install -r requirements.txt
python -m kw.firms        # download the preset areas (about 15 min, resumable)
python -m kw.build        # build calendars, calibration and validation (under a minute)
python -m kw.globe        # optional, one-off (about 1.8 GB, ~1 h): whole-Earth aggregate so drawn areas build in ~20 s
uvicorn kw.api:app --port 8000

cd web                    # second terminal
npm install
npm run dev               # http://localhost:5173
```

Built area files are committed in `data/regions/`, so the calendars work right after `pip install`. Day-level
evidence fetches only the year it needs if the raw cache is missing. To regenerate one area deterministically, run
`python -m kw.build <area>`.

Tests: `python server/tests/test_science.py` (ISO week 53, year boundaries, leap years, antimeridian, all-zero cells,
malformed quantiles, calibration, trend and rank maths). Type check: `cd web && npm run check`.

**Analyst:** create a free key at <https://aistudio.google.com/apikey> and set `GEMINI_API_KEY` before starting the API.

**MCP:**

```json
{ "mcpServers": { "kiln-watch": { "command": "python", "args": ["-m", "kw.mcp_server"], "cwd": "<repo>/server" } } }
```

`python -m kw.mcp_server --http` serves `http://127.0.0.1:8765/mcp` for n8n's MCP Client node. The API also serves the
same server at `/mcp`, so a deployed Kiln Watch is a remote connector for Claude (Settings, Connectors, Add custom
connector) and for Claude Code (`claude mcp add --transport http kiln-watch https://<host>/mcp`).

**Email alerts:** set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` and `PUBLIC_URL` (see
`.env.example`); the API then checks alerts every 3 hours and emails confirmed subscribers.

**Outlook:** `python -m kw.outlook` (about 10 s, needs `kw.globe`); the API also rebuilds it when it is over 12 h old.

**Deploy for free:** the `Dockerfile` serves the web app and API on port 7860 (Hugging Face Spaces, Docker SDK).
For static hosting, run `npm run build` and copy `data/regions` to `web/dist/data/regions`.

## Limitations and known issues

- There is no cloud-cover denominator yet (the MODIS CMG cloud correction is the planned source), so cloudy months
  read low for every satellite alike.
- Calibration is per area, calendar month and day/night. It is not stratified by land cover, cluster size or scan
  angle, so a year with an unusual fire mix (Paraná 2020) is biased.
- Terra→Aqua is the weakest link (the two see different hours of the fire day); it is used only for 2000–2002.
- Aqua drifts after about 2021, so the 2024 NOAA-21 step comparison against Aqua-only is weaker.
- MODIS changes collection (6.03 → 61.03) at the start of 2023; this is listed but not yet step-tested.
- The NRT-to-standard difference cannot be measured from the mirror, so NRT months are labelled provisional rather
  than adjusted.
- Areas you draw are built from a whole-Earth aggregate (`python -m kw.globe`, about 1.8 GB, one-off). Its heat-source
  mask is approximate (too generous), which affects only near-real-time rows and the heat-source list; for Punjab the
  harmonized monthly values matched the exact preset build within 0.9%. Box edges snap to 0.1° cell centres, and the
  detection-level brightness (FRP) diagnostic is shown for the preset areas only.
- Persistent heat sources are not validated against an independent kiln inventory, so they are labelled "likely".
- GDELT search starts in 2017; reports are matched by place and date only.
- Not built yet: the physical detection-limit simulator, triple collocation for noise, Spanish and Bengali labels,
  and a backtest of the early-warning rule.

## Phase 2: pages and early warning

The app is now eight pages instead of one: **Explorer** (map, calendar, season, continuity), **Early warning**,
**News**, **Download**, **Create**, **Methodology**, **MCP** and **n8n**. The page is kept in the URL hash (`#pg=warning`).

- **Early warning (the headline feature), for any place on Earth.** Search a place, type coordinates or draw a box
  (up to 16 square degrees); Kiln Watch builds that area's harmonized record on demand (a few minutes the first time)
  and shows its level (elevated, watch, normal, quiet, not scored), the month so far against the same days in every
  earlier year, the latest complete week, the year to date and the usual next four weeks. Every built area, preset or
  not, refreshes itself in the background once its data is over six hours old. The rule is deterministic and printed on
  the page: a climatological outlook, not a forecast or an official alert. Areas with fewer than 100 hotspots in a typical
  year, or too few at this time of year to rank, are *not scored* rather than flagged.
- **Your own alerts (no login yet).** Pick any area and a threshold: "the month so far tops N x the median of the same
  days in earlier years" (N = 1 tops the median; at least 5 hotspots). Creating an alert returns a secret token, and the
  page downloads a ready n8n workflow with it embedded: n8n polls `POST /api/alerts/{token}/poll` daily and the answer
  is `triggered: true` once per calendar month. Tokens are kept in `data/alerts.json` (gitignored) and in the browser;
  email/chat credentials live only in the user's n8n. API: `POST /api/alerts`, `GET|DELETE /api/alerts/{token}`,
  `GET /api/alerts/{token}/n8n.json`, plus `/api/warnings` (watchlist) and `/api/regions/{id}/warning`.
- **News.** Open wildfire events worldwide from NASA EONET (tagged with the area they fall in) and the per-area,
  per-month report search.
- **Download / Create.** All CSV and JSON files with column notes and citation; build a new area from a place name,
  coordinates or a drawn box.
- **MCP / n8n.** Quickstarts. The MCP server adds `get_early_warning`, `check_watchlist`, `create_alert` and
  `check_alert`. The n8n workflow is written for n8n 1.x and has not been run against a live n8n here.
- The Gemini analyst reads `GEMINI_API_KEY` from a repo-root `.env`, can call `early_warning` and `check_watchlist`,
  and uses the pinned `gemini-2.5-flash` (the `gemini-flash-latest` alias hung on tool calls when tested), with
  `gemini-flash-lite-latest` as fallback; override with `GEMINI_MODEL`. An optional `GEMINI_API_KEY_FALLBACK` is used when the main key hits its quota (429).

Not done: accounts (alerts are bearer-token only), a backtest of the warning
rule against past events (it needs a reference that excludes later years), and
the detection-limit simulator, triple collocation and Spanish/Bengali labels.

## Phase 3: globe, 30-day outlook, email, Claude characters

- **3D globe and night lights.** The Explorer opens on a MapLibre globe with an atmosphere and NASA Black Marble
  (VIIRS Day/Night Band) night lights; a toggle switches to the flat map. Both settings are kept in the URL.
- **Worldwide 30-day outlook** (`kw/outlook.py`, rule in `science.outlook_cell`, tested). For every 0.5° cell on
  Earth, from Aqua MODIS alone (one instrument every year since 2003, so no calibration enters): what the next 30
  calendar days usually bring, and how the last 30 days rank against the same days in earlier years. Classes:
  *season ahead*, *above normal*, *watch* (both; these pulse on the globe) and *rising* (the season usually ramps up
  now). Watch cells are grouped and named (OpenStreetMap) as "where to watch". One pass over the global aggregate
  takes about 10 s; `data/global/outlook.json` is committed as a snapshot for deployments without the aggregate.
  Click a dot for its numbers and a one-click "analyse 2° × 2° around here". A climatology plus the present anomaly,
  never a forecast; not yet backtested.
- **Email alerts** (`kw/alerts.py`, stdlib `smtplib`). Any box, three triggers: the month tops N × the median of the
  same days (once a month), the outlook has watch cells (at most weekly), NASA EONET opens a wildfire event inside the
  box (each once). Double opt-in, one-click unsubscribe, a "send test email" button, at most 3 unconfirmed alerts per
  address. Verified end to end against a local SMTP sink; not yet run against a real provider here.
- **News: many more reports.** Area searches now add Google News RSS (all years, split by year and up to three local
  languages) and GDACS wildfire alerts with GWIS burned area to NASA EONET and GDELT. Punjab, October 2025 went from a
  handful of items to 58. New: a live worldwide feed (Google News in 7 languages, GDACS, EONET; about 400 items for 3
  days) and report search for any free-text place and window (`/api/news/latest`, `/api/news/search`). Fixed a GDELT
  query bug (a single place name in parentheses was rejected).
- **MCP for Claude: 31 tools, 4 characters, 5 resources.** New tools include `find_place`, `get_fire_outlook`,
  `query_hotspots` (raw detections per day and satellite for any box and window, instantly, from the global aggregate),
  `get_situation_brief` (a deterministic markdown brief), `get_annual_series`, `compare_areas`,
  `get_season_profile`, `get_sensor_status`, `search_news_for_place`, `get_latest_fire_news`,
  `get_gdacs_wildfires` and `subscribe_email_alert`. Read-only tools carry MCP annotations. Characters
  (`kw/personas.py`): **Ember** (fire operations officer), **Dr. Vega** (remote-sensing scientist), **Scout** (news
  fact-checker), **Sentinel** (community liaison); available as MCP prompts, as Claude Project instructions and as
  Claude Code subagent files (`/api/personas/<id>.md`). All share the science guardrails.
- **Analyst.** Markdown answers with bold key figures, tool-call chips, a streamed reveal, and animated charts
  (`kw/charts.py` → `web/src/Chart.tsx`): the model may only *request* a chart kind; every plotted number is built
  from pipeline outputs. It knows today's date and the new tools (any place, outlook, hotspots).
- **Loaders.** Slow steps (news timelines, area builds, analyst) show what is happening now, elapsed time, an honest
  progress hint and "taking longer" messages (`web/src/Loader.tsx`).

## Data and credits

We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS)
(https://earthdata.nasa.gov/firms), part of NASA's Earth Observing System Data and Information System (EOSDIS).
Detections via the Portolan FIRMS mirror (CC0). Imagery: NASA GIBS; night lights: NASA Black Marble (VIIRS DNB). Events: NASA EONET and GDACS (EC JRC, UN OCHA).
News: The GDELT Project and Google News RSS (personal, non-commercial use; `NEWS_GOOGLE=0` turns it off).
Base map: OpenFreeMap / OpenStreetMap contributors. Place search: Nominatim. Libraries: DuckDB, FastAPI, MCP Python
SDK, React, MapLibre GL JS, Vite. AI assistance is described in [AI_USE.md](../AI_USE.md).

Kiln Watch is an independent project and not an official NASA product.
