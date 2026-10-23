# Plan 007: Rehearse the 2 Nov S-NPP → NOAA-20 switch end to end, and say on the page which satellite is live

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on.
> On any STOP condition, stop and report — do not improvise. Update
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 98fa82a..HEAD -- kilnwatch/nrt.py tests/test_nrt.py web/src/lib/types.ts web/src/pages/OtherPages.tsx docs/data-contracts.md`
> If any file changed, compare the excerpts below with the live code; a
> mismatch is a STOP condition.

## Status

- **Priority**: P1 — **deadline 2 Nov 2026** (S-NPP's last data day; judging is 13 Nov, so the demo runs in the NOAA-20 era)
- **Effort**: M
- **Risk**: LOW-MED (touches the daily job, but only adds a parameter with the old default, and two output fields)
- **Depends on**: none
- **Category**: bug-prevention / tests / direction
- **Planned at**: commit `98fa82a`, 2026-10-12

## Why this matters

Suomi NPP stops delivering on 2 Nov 2026; from 3 Nov the daily update must
switch to NOAA-20, chained to the record through S-NPP. The switch logic is
unit-tested in pieces (`era_of`, `sources_for`, `era_beta_weights`), but
nothing runs the whole daily computation (`nrt.run`) on either side of the
date, and it cannot be rehearsed because it reads the real clock in six
places. The first true run of the new path would be the live deploy on
3 Nov, ten days before judging. The page also never says which satellite
the live numbers come from, and `beta_imputed_frac` (how many detections
used a fallback correction) is written but never shown — against the
product's own rule "provisional ≠ final: encode epistemic status
visually" (`docs/PRODUCT.md`, Design Principles 2).

## Current state

- `kilnwatch/nrt.py`:
  - `SNPP_END = date(2026, 11, 2)` (line 17); `era_of(today)` (21–23)
    returns `"N"` through `SNPP_END`, `"J1"` after; `sources_for(today)`
    (26–28); `era_beta_weights(b1, b2, key, era)` (31–33).
  - The clock is read directly at six places: `fetch` lines 44 and 46
    (`date.today()`), `update_season_csv` line 64, `run` lines 93, 95
    (`pd.Timestamp.today().normalize()`) and 128:
    ```python
    def run(days=5) -> dict:                                   # line 88
        ...
        df = update_season_csv(days)                           # line 92
        season = season_of(date.today())                       # line 93
        day0 = pd.Timestamp(f"{season[:4]}-07-01")
        n_days = (pd.Timestamp.today().normalize() - day0).days + 1   # line 95
        branch = C.load_derived()["GATE_BRANCH"]["value"]
        ...
        if len(df):
            ...
            era = era_of(date.today())                         # line 128 — only computed when there are detections
            e = df[df.sensor == era].drop_duplicates(["cell_id", "date_local", "pass"])
            ...
            imputed = float(np.mean(~np.isfinite(w)))          # line 132
    ```
    and the output (lines 156–160):
    ```python
    out = {"updated_at": ..., "provisional": True, "season": season, "day0": day0.strftime("%Y-%m-%d"),
           "beta_imputed_frac": round(imputed, 4),
           "national": {...}, "districts": districts}
    dump_json(out, C.WEB_DATA / "nrt" / "current_season.json")
    ```
  - Inputs `run` reads: `C.MODELS / "cells.parquet"` (`cell_id, district,
    division, loc`; committed under `data/models/`), `clear_clim.parquet`,
    `thresholds.json`, `harm_draws.parquet` (chain steps `A<-N`, `N<-J1`,
    `J1<-J2`; every one of the 336 `A<-N` strata also has an `N<-J1` beta),
    and `C.WEB_DATA / "calendar" / <district>.json` (`normal.p90`).
    `C.load_derived()["GATE_BRANCH"]["value"]` is `"nokiln"` in
    `kilnwatch/config_derived.json` (that branch uses `metrics.harvest_key`,
    no classifier).
  - Detection frame columns `run` needs after `update_season_csv`:
    `conf_class` (kept if in `C.CONF_KEEP = ("nominal", "high")`), `lat`,
    `lon`, `sensor` (`"N"`, `"J1"`, ...), `date_local`, `pass` (`"D"`/`"N"`).
  - `kilnwatch/grid.py`: `cell_id(lat, lon)` (line 12) and
    `cell_center(cid) -> (lat, lon)` (line 23).
- `tests/test_nrt.py` — style to match: plain functions, `monkeypatch`,
  `SimpleNamespace` fakes; era unit tests at lines 32–56.
- `tests/test_isolation.py` forbids test modules matching
  `data[/\\]+(raw|interim)|\bRAW\b|\bINTERIM\b`; `data/models/` is allowed.
- Web: `web/src/lib/types.ts:87-91`:
  ```ts
  export interface NrtSeason {
    updated_at: string; provisional: true; season: string; day0: string
    national: { h: number[]; split: { key: string; values: number[] }[] }
    districts: Record<string, { h: number[]; above_p90_days: number }>
  }
  ```
  `web/src/pages/OtherPages.tsx` (the "This season" page) renders, in its
  header, `<ProvisionalBadge />`, an "Updated … UTC" `<span>`, and a
  `<details>` "Why provisional?" paragraph (around lines 33–37).
  Committed fixtures (`web/fixtures/*/data/nrt/current_season.json`) do not
  carry the new fields — the web must treat them as optional.
- `docs/data-contracts.md:32` documents `nrt/current_season.json`.

## Commands you will need

| Purpose | Command (repo root) | Expected |
|---|---|---|
| Install | `pip install -r requirements.txt -c constraints.txt` (Python 3.11) | exit 0 |
| Lint | `python -m ruff check .` | "All checks passed!" |
| NRT tests | `python -m pytest tests/test_nrt.py -q` | all pass |
| All tests | `python -m pytest -q` | all pass |
| Web | `cd web && npm run lint && npm run typecheck && npm test -- --run` | exit 0 |
| Web build + e2e | `cd web && DATA_SRC=fixtures FIXTURE_BRANCH=nokiln npm run build && npm run e2e` | all pass |

## Scope

**In scope**:
- `kilnwatch/nrt.py` — a `today` parameter; `era` and `sensor` in the output
- `tests/test_nrt.py` — two rehearsal tests
- `web/src/lib/types.ts`, `web/src/pages/OtherPages.tsx` — optional fields, one label, one sentence
- `docs/data-contracts.md` — the two new fields

**Out of scope**:
- `SNPP_END`, `era_of`, `sources_for`, `era_beta_weights`, the β models,
  `data/models/*` — the science is unchanged.
- `kilnwatch/fixtures.py` and committed fixtures (fields stay optional; the
  live site gains them at the next daily deploy).
- `.github/workflows/*`.

## Git workflow

- Branch `plan-007-noaa20-rehearsal`; commits `fix(nrt): <...>`, `test(nrt): <...>`, `feat(web): <...>`.
- No push/PR unless instructed.

## Steps

### Step 1: One injectable clock in `nrt.py`

- `fetch(days: int, today: date | None = None)`: first line
  `today = today or date.today()`; use `today` at lines 44 and 46.
- `update_season_csv(days: int, today: date | None = None)`: same; use it at
  line 64 and pass it on: `new = fetch(days, today)`.
- `run(days=5, today: date | None = None)`: same first line; then
  `df = update_season_csv(days, today)`, `season = season_of(today)`, and
  `n_days = (pd.Timestamp(today) - day0).days + 1`.
- Compute the era once, before `if len(df):` —
  `era = era_of(today)` — and delete the in-branch `era = era_of(date.today())`
  (line 128). Add a module constant
  `SENSOR_NAME = {"N": "Suomi NPP", "J1": "NOAA-20"}`.
- In `out`, after `"beta_imputed_frac"`, add `"era": era, "sensor": SENSOR_NAME[era],`.

Default behaviour (no `today`) is unchanged.

**Verify**: `grep -c "date.today()" kilnwatch/nrt.py` → `3` (one fallback line
per function); `grep -c "pd.Timestamp.today()" kilnwatch/nrt.py` → `0`;
`python -m pytest tests/test_nrt.py -q` → all existing tests pass.

### Step 2: Rehearsal tests on both sides of 2 Nov

Add to `tests/test_nrt.py` a helper and two tests. The helper builds a
detection frame in two districts taken from the committed cells model: one
district sees only NOAA-20 (`J1`), the other only S-NPP (`N`), on the same
dates.

```python
def _rehearse(monkeypatch, tmp_path, today):
    import shutil

    from kilnwatch.grid import cell_center

    data = tmp_path / "data"
    shutil.copytree(C.ROOT / "web" / "fixtures" / "nokiln" / "data", data)  # calendars with real p90 normals
    monkeypatch.setattr(C, "WEB_DATA", data)
    monkeypatch.setattr(C, "load_derived", lambda: {"GATE_BRANCH": {"value": "nokiln"}})
    cells = pd.read_parquet(C.MODELS / "cells.parquet")
    d_j1, d_n = sorted(cells.district.unique())[:2]
    rows = []
    for dist, sensor in ((d_j1, "J1"), (d_n, "N")):
        cid = cells[cells.district == dist].cell_id.iloc[:3].to_numpy()
        lat, lon = cell_center(cid)
        for day in ("2026-10-20", "2026-10-28"):
            for la, lo in zip(lat, lon):
                rows.append({"lat": la, "lon": lo, "sensor": sensor, "conf_class": "nominal",
                             "date_local": pd.Timestamp(day), "pass": "N"})
    df = pd.DataFrame(rows)
    monkeypatch.setattr(nrt, "update_season_csv", lambda days, today=None: df.copy())
    return nrt.run(today=today), d_j1, d_n
```

1. `test_rehearsal_after_snpp_ends_uses_noaa20(monkeypatch, tmp_path)` —
   `out, d_j1, d_n = _rehearse(monkeypatch, tmp_path, date(2026, 11, 10))`.
   Assert: `out["era"] == "J1"`; `out["sensor"] == "NOAA-20"`;
   `sum(out["districts"][d_j1]["h"]) > 0`;
   `sum(out["districts"][d_n]["h"]) == 0` (S-NPP rows are ignored after the
   switch); `out["beta_imputed_frac"] == 0.0` (every stratum has an
   `N<-J1` beta); `len(out["national"]["h"]) == (date(2026, 11, 10) - date(2026, 7, 1)).days + 1`;
   and `json.loads((tmp_path / "data" / "nrt" / "current_season.json").read_text(encoding="utf-8")) == out`.
2. `test_rehearsal_on_snpp_last_day_still_uses_snpp(monkeypatch, tmp_path)` —
   `today = nrt.SNPP_END`; assert `out["era"] == "N"`, `out["sensor"] == "Suomi NPP"`,
   `sum(out["districts"][d_n]["h"]) > 0`, `sum(out["districts"][d_j1]["h"]) == 0`.

Add `import json` to the file's imports if absent. No network: `fetch` is
never reached because `update_season_csv` is patched.

**Verify**: `python -m pytest tests/test_nrt.py -q` → all pass (2 new);
`python -m pytest tests/test_isolation.py -q` → pass.

### Step 3: Say which satellite is live, and how much was imputed

`web/src/lib/types.ts` — extend `NrtSeason` (optional: older files lack them):
`era?: 'N' | 'J1'; sensor?: string; beta_imputed_frac?: number`.

`web/src/pages/OtherPages.tsx` — in the header, directly after the
"Updated … UTC" `<span>`, add:

```tsx
{n.sensor && <span>Live data from {n.era === 'J1' ? <>NOAA-20, on the Aqua-MODIS scale through Suomi NPP</> : n.sensor}.</span>}
```

and at the end of the "Why provisional?" paragraph add:

```tsx
{n.beta_imputed_frac != null && n.beta_imputed_frac > 0 && <> {Math.round(100 * n.beta_imputed_frac)}% of this season's detections used the median correction because their area and month had none of their own.</>}
```

**Verify**: `cd web && npm run lint && npm run typecheck && npm test -- --run` → exit 0;
`DATA_SRC=fixtures FIXTURE_BRANCH=nokiln npm run build && npm run e2e` → all
pass (fixtures lack the fields, so nothing new renders there — that is the
optional path working).

### Step 4: Contract doc

`docs/data-contracts.md:32` — append to the `nrt/current_season.json`
description: "`era` (`N` until 2 Nov 2026, then `J1`), `sensor` (its
name), `beta_imputed_frac` (share of detections on the median β)".

**Verify**: `grep -c "beta_imputed_frac" docs/data-contracts.md` → at least `1`.

## Test plan

Step 2: two end-to-end rehearsals of `nrt.run` with a fixed clock and
synthetic detections, asserting closed-form properties (which sensor's
rows count, full β coverage, series length, file equals return value).
Pattern: the monkeypatch style of `tests/test_nrt.py`.

## Done criteria

- [ ] `python -m ruff check .` exits 0; `python -m pytest -q` exits 0 with 2 new tests in `tests/test_nrt.py`
- [ ] `grep -c "pd.Timestamp.today()" kilnwatch/nrt.py` → `0`
- [ ] Web lint, typecheck, unit tests, nokiln build and e2e pass
- [ ] Scope check (works whether or not you have committed): `git diff --name-only 98fa82a -- . ':!plans'` lists only: `kilnwatch/nrt.py`, `tests/test_nrt.py`, `web/src/lib/types.ts`, `web/src/pages/OtherPages.tsx`, `docs/data-contracts.md`
- [ ] `plans/README.md` row updated

## STOP conditions

- `out["beta_imputed_frac"]` is not `0.0` in the J1 rehearsal — that means
  real strata lack an `N<-J1` beta: report which (print the missing keys);
  do NOT change the models or the fallback. This is exactly what the
  rehearsal exists to catch before 2 Nov.
- `nrt.run` fails in the rehearsal on anything other than your test setup
  (e.g. a KeyError in the J1 path) — report the traceback verbatim.
- The excerpts above do not match the live `nrt.py`.

## Maintenance notes

- On 3 Nov 2026 someone should open the live "This season" page and confirm
  it reads "Live data from NOAA-20…" and that `beta_imputed_frac` is
  plausible; if the deploy failed, Plan 006's notifier (if landed) files an issue.
- The injectable `today` is also how any future sensor change (NOAA-21) gets
  rehearsed: add its era and extend the two tests.
- If the fixtures are regenerated after this lands, consider adding `era` /
  `sensor` to the synthetic NRT fixture so demos show the label.
