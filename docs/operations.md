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
| `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `MISTRAL_API_KEY`, `GITHUB_MODELS_TOKEN` | Optional fallback readers for the `news` stage (`NEWS_PROVIDERS`), tried in that order after the five Gemini models (one Gemini key only — rotating keys to beat the free limit breaks Google's terms); unset = skipped. In CI the first three are optional secrets and GitHub Models uses the job's own token |
| `GEMINI_API_KEY` | The `news` stage (Gemini reads article excerpts). Also a GitHub secret: **adding it turns the daily news job on**; settle the Gemini terms question first (docs/news_plan.md §10). Never a `VITE_` variable |
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

1. **`nrt` job** — downloads the `data-current` GitHub Release asset into `web/public/data` (district normals), restores the `data/nrt` cache, runs `python -m kilnwatch nrt` (fetch FIRMS NRT, label with the frozen classifier, convert with the frozen calibration → `nrt/current_season.json`, always `provisional: true`) and `nrt/alerts.xml`, the Atom feed of districts above normal. When the `GEMINI_API_KEY` secret is set, it also rebuilds `ask.json` (a warning, never a failure, when the key is absent or the call fails) and uploads it as a separate `ask` artifact. It then runs the full `pytest -q` suite and uploads the NRT output as a workflow artifact. **Nothing is committed to `main`.**
1b. **`news` job** (daily cron and manual runs only; skipped until the `GEMINI_API_KEY` secret exists; `continue-on-error`) — restores the store from the `news-current` release asset, runs `python -m kilnwatch news`, uploads the store back with `news --publish` (job-scoped `contents: write`).
2. **`deploy` job** (needs `nrt` and `news`, runs whatever `news` did; before the build it downloads `news-current` and, when present, runs `python -m kilnwatch news-pair` against the data it deploys; runs when it succeeded or was skipped) — re-downloads the release + artifact, `DATA_SRC=real npm run build`, both safety checks, deploy `web/dist` to GitHub Pages.

If `data-current` is missing or a check fails, deploy fails loudly and the last good Pages deployment stays live. The secrets are `FIRMS_MAP_KEY` and the optional `GEMINI_API_KEY` (scoped to the one step that rebuilds `ask.json`); Earth Engine credentials never enter CI (the NRT job uses the climatological clear fraction, `data/models/clear_clim.parquet`).

## Self-tending checks

- **`verify.yml`** (Sundays and Wednesdays 06:30 UTC, and on demand): re-fetches NASA FIRMS for the analysis box (sensors N and A only) with `python -m kilnwatch verify-firms` and compares it with the committed export and the published reference. Its download windows are cached between runs (restored before, saved after even on failure); the first uncached run can take hours, later runs fetch only new windows.
- **Drift rule (PROPOSED, not yet approved by the team):** drift = any of `reference.spearman`, `shape_vs_committed.N.spearman_vs_committed`, `shape_vs_committed.A.spearman_vs_committed` below **0.75**, or `null` / `NaN` (too few pairs, or a series with gaps). Values at the time of writing: 0.908 / 0.839 / 0.818. Change the threshold in `verify.yml` and here together.
- **Issues, deduplicated:** a failed or drifting check opens "FIRMS cross-check drift"; a failed daily NRT update or Pages deploy opens "Daily deploy failed". Repeats comment on the open issue instead of opening another. Bodies carry a run link only, never data. Only the two notifier jobs can write issues; neither holds the FIRMS key.
- **`python -m kilnwatch release`** is the one-command form of the publish below: `export --publish`, then download the fresh `data-current` tarball to `data/releases/`, clear the stale extraction in `data/releases/public/`, and rebuild the fixtures from it.

## Publishing the real data (`export --publish`)

`python -m kilnwatch export --publish` runs both safety checks, rebuilds `ask.json` first when `GEMINI_API_KEY` is set (and safety-checks it with the rest), packages `web/public/data/` (excluding `nrt/`) as `public-data.tar.gz`, builds the research release from the same files (`kilnwatch-research-data.zip`: CSV + Parquet tables, data dictionary, CC BY 4.0, SHA-256 manifest), uploads both with `--clobber` to the **`data-current`** GitHub Release, and creates an immutable `data-<short_sha>` release with both files for provenance. A DOI (for example through the Zenodo GitHub integration) is a team decision, not automated. `CITATION.cff` and `.zenodo.json` already hold the metadata. Note that the integration archives each release's source tarball, not its attached files, and every `data-<sha>` release would mint a version: a DOI for the data zip needs its own Zenodo upload. The real public export never enters git history. To build the verbatim offline fixtures from it, fetch the asset once into the gitignored path: `gh release download data-current -p public-data.tar.gz -O data/releases/public-data.tar.gz` (absent tarball -> `export --fixtures` falls back to the synthetic set).

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
