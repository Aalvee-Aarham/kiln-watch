# Static data contracts (`web/public/data/`)

**Applies to:** `main` @ `1314a30` (10 Oct 2026) · **Authority:** `web/src/lib/types.ts` · **Producer:** [pipeline.md](pipeline.md)

These files are the entire "API" between the Python pipeline and the UI. TypeScript defines the contract (`web/src/lib/types.ts`); Python writes it; `tests/test_contracts.py` asserts every exported file against it **under all five gate-branch fixture sets**. A contract change needs a same-commit Python change plus contract tests.

Conventions shared by every file:

- **Day index.** `day0 = 2003-01-01`; a day number is days since then. `web/src/lib/days.ts` converts, with parity tests against Python.
- **Sparse series.** `days[]` lists only day indices with activity; unobserved days are `nodata` runs (inclusive `[start, end]`). "No detection" and "not seen" are different facts.
- **Grid math lives in the data.** `meta.grid` carries origin/step/rows/cols; the browser's `box.ts` contains no grid literals.
- **No floats that can be NaN.** The exporter converts non-finite values to `null` (`Series = (number | null)[]`).

## Files and budgets

Enforced by `check_budgets` in `kilnwatch/export.py`; a breach fails the export (total > 100 MB names the `--downscale` flag).

| File | Content | Budget |
|---|---|---|
| `meta.json` | `generated_at`, `git_sha`, `prereg_sha`, params, data versions, credits + licences, bilingual non-claims, `gate_branch`, `split_labels`, `activity_index`, `grid`, optional `demo` (fixtures) | 50 KB |
| `events.json` | Policy events, satellite milestones, harvest windows (bilingual labels, source URLs) — from `data/static/*.csv` | 50 KB |
| `aoi/districts.geojson` · `aoi/upazilas.geojson` | Simplified boundaries; properties = `UnitProps` (`unit_id`, names en/bn, division, kiln count/share) | 400 KB · 1.5 MB |
| `calendar/{unit_id}.json` | One `Calendar` per unit (~560): sparse `days`, per-sensor `raw`, harmonized `h`, `split[]`, optional `index`, `nodata`, `clear_frac` (districts), weekly CI, `normal` p10/p50/p90, `unusual`, `critical`, `seasons[]` with CIs | 150 KB gz each |
| `grid/{tile}.json` | 1° × 1° tiles of sparse `[cell, day, sensor_pass]` rows for drawn boxes — totals only, no source labels | 1 MB gz each |
| `harmonization.json` | `Harmonization`: selected model, `yearly` raw vs harmonized, `betas` (chain step, stratum, CI, rung, counts), `loso_by_season` / `loso_pooled`, `seam`, `sp_nrt_ratio` | 200 KB |
| `validation.json` | `Validation`: gate rows, plateau/spike profiles, radius sweep, classifier (PR curve/AUC, importance, four holdouts, label-set comparison, ablation), controls, candidates, TROPOMI, PM2.5 lags, transfer, closure, `skipped` | 500 KB |
| `kiln_activity.json` | `KilnActivity` (Amendment 1 + transfer, below). **Optional file: absent means "no kiln layer"** and the site hides kiln pages | 1.5 MB |
| `nrt/current_season.json` | `NrtSeason`: season-to-date national + per-district harmonized activity, `provisional: true`, `above_p90_days` | 300 KB |

## Branch-dependent fields

The five-way gate branch (`full`, `from2012`, `partial`, `nightfire`, `nokiln`; today `nokiln`) changes **data, never code**:

- `split[]` — keys come from `meta.split_labels`: kiln/vegetation/unknown under kiln branches; **Aman harvest / Boro harvest / other** under `nokiln`. An unknown `split` key in a URL falls back to `all`, so links survive a rebuild under another branch.
- `activity_index` — `HKFI` (kiln firing) on kiln branches; **`HBI` (harmonized burning)** under `nokiln`.
- Kiln pages are visible iff `kiln_activity.json` exists **or** the branch is not `partial`/`nokiln` (`useKilnsVisible` in `web/src/components/ui.tsx`).

## `kiln_activity.json` in detail

Area-level only, never per kiln or per cluster:

| Field | Meaning |
|---|---|
| `layer` | `'ntl'` (night lights) or `'s1'` (radar), or `null` |
| `pilots` | The six disclosed pilot channels (P1–P6), readings verbatim |
| `tests` / `pass` | GL and GS confirmatory rows: criterion, value, threshold, p, pass |
| `contamination` | Fire detections on kiln vs control footprints (the 0.15% upper bound) |
| `national` / `areas` | Kiln-season summaries: monthly excess series with CIs, plus per-season onset/end/duration/peak with bootstrap CIs. Areas need ≥ 5 clusters |
| `national_check` | The independent Sentinel-1 national check series |
| `transfer` | **Amendments 2–4**, country-level only (below) |

### The `transfer` block

`TransferTest` values: **TL/TS** = night lights / radar with *Bangladesh's* months (strict); **LL/LS** = the same with *locally learned* months.

- `TransferChannel.learned` — the window learned on calibration clusters only: 5 core + 4 off months, July–June order.
- `TransferChannel.profile` — median kiln excess per month (12 values) with CIs and `n_clusters`.
- `TransferChannel.tests` / `pass` — the four Amendment-1 criteria (contrast, prevalence, replication, placebo) per test.
- `TransferCountry` — `code`, `name`, inventory `source`, cluster/sample counts, `evaluable`, `channels`, and `design` (`'A2'` first test, `'A4'` retest). `retest` nests the Amendment-4 rerun (fresh clusters, controls ≥ 6 km from every mapped kiln, random control order); a retest never carries its own retest.
- Bangladesh appears as the `BD` row with the self-check: the window learner, given only the 400 pilot clusters, must recover Dec–Apr / Jul–Oct.

## Safety checks (every export, and CI again)

- **Name check** — `assert_public_safe` walks the object and refuses any key in `FORBIDDEN_PUBLIC_KEYS` = `kiln_id`, `cluster_id`, `candidate`, `kiln_lat`, `kiln_lon`.
- **Value check** — `check_public_dir` refuses any point geometry and any array whose length equals the cluster or kiln count (calendar/grid series arrays excepted by name).
- A path guard refuses regulator-tier writes anywhere under `web/`.

## Fixtures (`web/fixtures/`)

Five complete data sets, one per gate branch: `full`, `from2012`, `partial`, `nightfire`, `nokiln` (synthetic, from `export.write_fixtures`) — except **`nokiln`, which is a verbatim offline copy of the real export**, flagged in `meta.demo` (`mode: 'real-offline-copy'`, source SHA, NRT timestamp) and shown as a grey banner by the site. CI builds and checks all five. See [web-frontend.md](web-frontend.md) for how the build picks one.
