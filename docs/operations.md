# Operations: setup, CI/CD, daily updates, release

**Applies to:** `fire-calendar` branch (10 Oct 2026; `main` until it is merged) · **Pipeline:** [pipeline.md](pipeline.md) · **Contract:** [data-contracts.md](data-contracts.md)

## Local setup

- **Website:** Git + Node 20.19+ (`npm install` in `web/`, then `npm run dev` — serves the `nokiln` fixture set, a verbatim offline copy of the real export; the site banners this).
- **Pipeline:** Python 3.11+; `pip install -r requirements.txt` (minimum versions, not pinned); `cp .env.example .env`; `earthengine authenticate` once.

`.env` keys (gitignored, never committed):

| Key | Used for |
|---|---|
| `FIRMS_MAP_KEY` | FIRMS archive + daily NRT (free MAP_KEY) |
| `OPENAQ_API_KEY` | Dhaka PM2.5 validation |
| `EE_PROJECT` | Earth Engine project (clear fractions, night lights, radar) |
| `EE_API_KEY`, `EOG_USER`, `EOG_PASSWORD` | Not needed by the current pipeline |

## CI (`.github/workflows/ci.yml`, on push + PR)

| Job | Steps |
|---|---|
| `python` | Python 3.11 → `ruff check .` → `pytest -q` (synthetic data only) |
| `web-fixtures` | Node 22 → `npm ci` → lint → `tsc --noEmit` → Vitest → **build all five fixture branches** → safety checks (forbidden-key grep + `python -m kilnwatch export --check-public web/dist/data`) → bundle-size report |

Test rules that CI enforces: `tests/test_isolation.py` fails if any test references `data/raw` or `data/interim` — tests are synthetic-only, real-data checks are stage assertions inside the pipeline; `tests/test_config.py` asserts the PRE-REGISTERED constants equal the literals in `docs/PREREGISTRATION.md` and that the pre-registration's first commit precedes every commit touching `reports/`; `tests/test_contracts.py` asserts the export contract under all five gate branches.

## Daily deploy (`.github/workflows/deploy.yml`)

Triggers: push to `main`, **cron 03:00 UTC**, manual dispatch.

1. **`nrt` job** — downloads the `data-current` GitHub Release asset into `web/public/data` (district normals), restores the `data/nrt` cache, runs `python -m kilnwatch nrt` (fetch FIRMS NRT, label with the frozen classifier, convert with the frozen calibration → `nrt/current_season.json`, always `provisional: true`), runs `pytest tests/test_export.py`, uploads the NRT output as a workflow artifact. **Nothing is committed to `main`.**
2. **`deploy` job** (needs `nrt`; runs when it succeeded or was skipped) — re-downloads the release + artifact, `DATA_SRC=real npm run build`, both safety checks, deploy `web/dist` to GitHub Pages.

If `data-current` is missing or a check fails, deploy fails loudly and the last good Pages deployment stays live. The only secret is `FIRMS_MAP_KEY`; Earth Engine credentials never enter CI (the NRT job uses the climatological clear fraction, `data/models/clear_clim.parquet`).

## Publishing the real data (`export --publish`)

`python -m kilnwatch export --publish` runs both safety checks, packages `web/public/data/` (excluding `nrt/`) as `public-data.tar.gz`, builds the research release from the same files (`kilnwatch-research-data.zip`: CSV + Parquet tables, data dictionary, CC BY 4.0, SHA-256 manifest), uploads both with `--clobber` to the **`data-current`** GitHub Release, and creates an immutable `data-<short_sha>` release with both files for provenance. A DOI (for example through the Zenodo GitHub integration) is a team decision, not automated. The real public export never enters git history. A copy of the current asset is kept at `data/releases/public-data.tar.gz` for offline demos.

## Dual-tier release

| Tier | Audience | Contents | Channel |
|---|---|---|---|
| Public | Everyone | Area-level calendars and statistics, harmonization + validation evidence, country-level transfer results | GitHub Pages |
| Restricted | DoE inspectors, on request | Per-cluster leads with CIs, positional uncertainty, candidate unmapped kilns | `python -m kilnwatch export --regulator` → offline `regulator/` directory, gitignored, never hosted; a path guard refuses writes under `web/` |

Both tiers ship the bilingual **non-claims** (`kilnwatch/config.py:NON_CLAIMS`): outputs are inspection leads, not proof of illegality; "no detection" ≠ "kiln off"; counts are not emissions; the calibration does not travel outside its training coverage; before/after policy comparisons are descriptive.

## Safety checks (the reason both run twice — locally and in CI)

- **Name check** — refuses the keys `kiln_id`, `cluster_id`, `candidate`, `kiln_lat`, `kiln_lon` anywhere in a public object.
- **Value check** — refuses point geometries and any array with cluster/kiln cardinality.

Either failing blocks the export and the deployment.

## Governance documents

`docs/PREREGISTRATION.md` is the authority for every pre-registered threshold and is never edited; deviations and additions are dated amendments in `docs/PREREGISTRATION_AMENDMENTS.md`, each written before the data it governs. `docs/BLOCKERS.md` is the escalation log (two rows await human sign-off: the A2 cell-count bound, replaced by an area-derived check, and the LOSO coverage FAIL, published as a conservative-interval result).
