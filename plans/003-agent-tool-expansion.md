# Plan 003: Expand the Ask agent's tool surface (kiln seasons, national trend)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on.
> On any STOP condition, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 98fa82a..HEAD -- kilnwatch/ask.py tests/test_ask.py tests/test_ask_eval.py docs/AI_USE.md`
> Plan 002 adds tests to `tests/test_ask.py`, creates `tests/test_ask_eval.py`
> and adds one row to `docs/AI_USE.md` — that is expected drift. Only the
> `kilnwatch/ask.py` excerpts below must still match; a mismatch there is a
> STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW-MED (touches the shipped agent; the guard and step cap
  bound the blast radius)
- **Depends on**: Plan 002 (its eval table is the safety net; extend it here)
- **Category**: direction
- **Planned at**: commit `98fa82a`, 2026-10-12 (first written 2026-10-11; reviewed and corrected against live code)

## Why this matters

The public export carries kiln seasons per district (`kiln_activity.json`)
and the national harmonized yearly series (`harmonization.json` → `yearly`),
but the agent has only five tools (`ask.py:161-172`). It cannot answer
"when do brick kilns operate in Dhaka?" even though the website's Gemini
chat can (`web/src/pages/AskPage.tsx:49` reads the same kiln data), so the
flagship AI feature looks weaker than the page around it. Each new tool is
a deterministic, read-only function over the public export plus a
provenance line; the numeric guard (`ask.py:198`) and `MAX_STEPS` cap cover
new tools with zero changes.

## Current state

- `kilnwatch/ask.py` — agent anatomy you must match:
  - Tools are plain functions `(d: Data, ...) -> dict` that return a
    `provenance` dict via `d.prov(rel_path, dataset_name)` (lines 54–56) and
    honest `{"error": ...}` dicts when data is absent (see
    `area_fire_calendar` lines 97–101 and `this_season` line 117).
  - `FIRE` constant (line 59) is the dataset name for fire-count files.
  - `MONTHS` (line 23) is the season-ordered month list starting at July.
  - Registration: one entry in `TOOLS` (list of JSON-schema dicts,
    lines 161–172) and one in `FUNCS` (lines 173–174). Copy the description
    register: say exactly what the tool returns and its limits.
  - Argument validation in `_run` (lines 179–187) — **read this carefully**:
    ```python
    _UNIT = re.compile(r"BD\d{2,10}")  # HDX COD-AB p-codes: anything else never reaches a file path

    def _run(fn, data: Data, args: dict) -> dict:
        uid = args.get("unit_id")
        if "unit_id" in args and not (isinstance(uid, str) and _UNIT.fullmatch(uid)):
            return {"error": f"unit_id must be an area code such as BD3026 (from find_area), got {uid!r}"}
    ```
    Any `unit_id` that is not `BD` + 2–10 digits is rejected **before** the
    tool runs. So a tool cannot accept `unit_id: "national"`. The national
    figure is requested by **omitting** `unit_id` (optional in the schema);
    when present it is validated for free.
  - `DEMO_QUESTIONS` (lines 24–29): four `(question, lang)` tuples answered
    by `build_cache`.
- Data shapes (verified in the committed fixture `web/fixtures/full/data/`):
  - `kiln_activity.json` → `national` and each `areas[unit_id]` have
    `n_clusters` (int) and `seasons`: a list of
    `{"season": "2024-25", "onset": {"p50","lo","hi"}|null, "end": {...}|null, "duration": {...}|null, "peak": {...}|null, "peak_value": {...}}`.
    Onset/end/peak are **day of season (0 = 1 July)**; duration is days.
    The `full` fixture has `areas` `BD3026` and `BD302614`; national
    `n_clusters` is 3653; the last national season is `2024-25` with onset
    p50 144. Both `full` and `nokiln` fixtures contain this file — to test
    the missing-file branch, copy a fixture to `tmp_path` and delete it.
  - `harmonization.json` → `yearly`: list of
    `{"season", "raw_sum", "raw_by_sensor", "h": {"p50","lo","hi"}, "aqua_obs"}`
    (22 seasons in the `full` fixture, first `2003-04`).
- Web rules to mirror exactly (`web/src/lib/plain.ts`):
  ```ts
  /** Day of season (0 = 1 July) → "early December" / "mid-December" / "late December". Non-leap season year. */
  export function whenText(dayOfSeason: number): string {
    const d = new Date(Date.UTC(2001, 6, 1 + Math.round(dayOfSeason)))
    const day = d.getUTCDate(), m = MONTHS[d.getUTCMonth()]
    return day <= 10 ? `early ${m}` : day <= 20 ? `mid-${m}` : `late ${m}`
  }
  /** Typical kiln season: median onset, end, peak and length over the last `n` seasons with a measured start and end. */
  export function typicalSeason(rows, n = 3) — rows with onset && end, last n; median of each p50; duration = median(duration.p50, or end-onset when duration is null)
  ```
  Its tests (`web/src/lib/plain.test.ts:12-15`) pin `whenText(0) = 'early July'`,
  `whenText(153) = 'early December'`, `whenText(168) = 'mid-December'`,
  `whenText(183) = 'late December'`.
- World coverage is **not** a tool in this plan: the world map reads only
  geography (`aoi/world_*.geojson`); its coverage wording lives in
  `RegionPage.tsx` code, not in exported data, so there is nothing for a
  deterministic tool to read.
- `docs/AI_USE.md` — the row `| What the AI does |` says "Chooses which of
  five project functions to call (…)".

## Commands you will need

| Purpose | Command (repo root) | Expected |
|---|---|---|
| Install | `pip install -r requirements.txt -c constraints.txt` (Python 3.11) | exit 0 |
| Lint | `python -m ruff check .` | "All checks passed!" |
| Tests | `python -m pytest -q` | all pass |
| Manual agent try (optional) | `python -m kilnwatch ask "When do kilns run in Dhaka?" --src web/fixtures/full/data` | needs `ANTHROPIC_API_KEY`; skip if absent |

## Scope

**In scope**:
- `kilnwatch/ask.py` — two tools, their `TOOLS`/`FUNCS` entries, two helpers, two demo questions
- `tests/test_ask.py`, `tests/test_ask_eval.py` — new tests; no change to Plan 002's tests
- `docs/AI_USE.md` — tool-count row

**Out of scope**:
- `kilnwatch/export.py`, `web/**` — the data already ships.
- The guard, `MAX_STEPS`, the model id, `_run`, the tool loop itself.
- A `world_coverage` tool (see Current state; deferred in Maintenance notes).
- Any new dependency.

## Git workflow

- Branch `plan-003-agent-tools`; commits `feat(ask): <tool>`.
- No push/PR unless instructed.

## Steps

### Step 1: Season helpers mirroring the web

Add to `ask.py` (near `_busy_months`):

```python
def _when_text(day_of_season: float) -> str:
    """Same rule as web/src/lib/plain.ts whenText: day 0 = 1 July, non-leap season year."""
    d = pd.Timestamp("2001-07-01") + pd.Timedelta(days=math.floor(day_of_season + 0.5))  # JS Math.round, not banker's rounding
    return f"early {d.month_name()}" if d.day <= 10 else f"mid-{d.month_name()}" if d.day <= 20 else f"late {d.month_name()}"


def _typical_season(rows: list[dict], n: int = 3) -> dict | None:
    """Same rule as web/src/lib/plain.ts typicalSeason: medians over the last n seasons with a measured start and end."""
    ok = [r for r in rows if r.get("onset") and r.get("end")][-n:]
    if not ok:
        return None
    med = lambda xs: float(np.median(xs))  # noqa: E731
    peaks = [r["peak"]["p50"] for r in ok if r.get("peak")]
    return {"onset": med([r["onset"]["p50"] for r in ok]), "end": med([r["end"]["p50"] for r in ok]),
            "peak": med(peaks) if peaks else None,
            "duration": med([r["duration"]["p50"] if r.get("duration") else r["end"]["p50"] - r["onset"]["p50"] for r in ok]),
            "seasons": [r["season"] for r in ok]}
```

Why `math.floor(x + 0.5)`: Python's `round()` rounds half to even, JS
`Math.round` rounds half up, and medians of integer p50s can end in `.5`.
Use `math.floor(x + 0.5)` for **every** rounding of a median in this plan
(Step 2's `length_days` too), so Plan 005's TypeScript port (`Math.round`)
gives identical numbers. Add `import math` at the top of `ask.py` if absent.

**Verify**: `python -c "from kilnwatch.ask import _when_text as w; print([w(0), w(153), w(168), w(183)])"`
→ `['early July', 'early December', 'mid-December', 'late December']`.

### Step 2: `kiln_seasons` tool

```python
def kiln_seasons(d: Data, unit_id: str | None = None) -> dict:
    """Kiln working season from night lights for one area (unit_id) or the whole country (no unit_id)."""
```

Behaviour:
- `ka = d.json("kiln_activity.json")`; `None` →
  `{"error": "no kiln analysis in this data build"}`.
- `block = ka["national"] if unit_id is None else ka.get("areas", {}).get(unit_id)`;
  `None` → `{"error": f"no kiln season for {unit_id}"}`.
- `t = _typical_season(block.get("seasons", []))`; `None` →
  `{"error": "no measured kiln season"}`.
- Return:
  ```python
  {"area": unit_id or "Bangladesh (national)", "kiln_clusters": block["n_clusters"],
   "typical_season": {"starts": _when_text(t["onset"]), "busiest": _when_text(t["peak"]) if t["peak"] is not None else None,
                      "ends": _when_text(t["end"]), "length_days": math.floor(t["duration"] + 0.5), "seasons_used": t["seasons"]},
   "provenance": d.prov("kiln_activity.json", "Kiln Watch kiln activity from NASA Black Marble night lights, area-level")}
  ```
- `TOOLS` entry: `name: "kiln_seasons"`; description: "When brick kilns
  usually operate, from NASA Black Marble night lights: the typical start,
  busiest time and end of the kiln season (early/mid/late month) and its
  length in days, as medians over the last 3 measured seasons, plus the
  number of kiln clusters. Give unit_id (from find_area) for a district;
  omit it for the whole country."; schema
  `{"type": "object", "properties": {"unit_id": {"type": "string"}}, "additionalProperties": False}`
  (no `required`).
- `FUNCS["kiln_seasons"] = kiln_seasons`.

**Verify**: `python -c "from kilnwatch.ask import kiln_seasons, Data; print(kiln_seasons(Data('web/fixtures/full/data')))"`
→ a dict with `kiln_clusters: 3653`, a `typical_season` dict and `provenance`.

### Step 3: `national_trend` tool

```python
def national_trend(d: Data) -> dict:
    """The harmonized national fire series (Aqua-MODIS-equivalent units), from harmonization.json yearly."""
```

Read `h = d.json("harmonization.json")`; missing or empty `yearly` →
`{"error": "no national series in this data build"}`. Let
`y = h["yearly"]`. Return
`{"n_seasons": len(y), "first_season": {"season": y[0]["season"], "harmonized": y[0]["h"]["p50"]}, "latest_season": {"season": y[-1]["season"], "harmonized": y[-1]["h"]["p50"], "range_95": [y[-1]["h"]["lo"], y[-1]["h"]["hi"]]}, "peak_season": {"season": p["season"], "harmonized": p["h"]["p50"]}, "units": "Aqua-MODIS-equivalent fire detections per season (harmonized)", "provenance": d.prov("harmonization.json", FIRE)}`
where `p = max(y, key=lambda r: r["h"]["p50"])` (first wins ties). No
arguments: schema `{"type": "object", "properties": {}, "additionalProperties": False}`.
Register in `TOOLS`/`FUNCS`.

**Verify**: `python -c "from kilnwatch.ask import national_trend, Data; print(national_trend(Data('web/fixtures/full/data'))['n_seasons'])"` → `22`.

### Step 4: Tests

In `tests/test_ask.py` (fixture `FIXT`):
1. `test_when_text_matches_the_web_rule` — the four `plain.test.ts` cases
   from Current state (fixed values).
2. `test_kiln_seasons_national_and_area` — read `ka` from
   `FIXT / "kiln_activity.json"`; for `None` (national) and `"BD3026"`,
   recompute the expected `_typical_season` medians in the test **with plain
   `statistics.median` over the same rows** (do not call `_typical_season`
   to compute the expectation; round the expected length with
   `math.floor(x + 0.5)`) and assert `kiln_clusters`, `starts`, `ends`,
   `length_days` equal the tool's output.
3. `test_kiln_seasons_honest_errors(tmp_path)` — `shutil.copytree(FIXT, tmp_path / "d")`,
   delete `tmp_path / "d" / "kiln_activity.json"` → error contains
   "no kiln analysis"; on `FIXT` with `"BD99"` → `{"error": "no kiln season for BD99"}`.
   Also through the loop's validation: `_run(kiln_seasons, Data(FIXT), {"unit_id": "national"})`
   returns the `_run` validation error (pins that "national" is expressed
   by omission, not by a string).
4. `test_national_trend_matches_harmonization_yearly` — recompute first,
   latest and peak from the fixture JSON in the test; assert equality.
5. `test_new_tool_outputs_are_public_safe` — for
   `kiln_seasons(Data(FIXT))`, `kiln_seasons(Data(FIXT), "BD3026")` and
   `national_trend(Data(FIXT))`, call
   `kilnwatch.export.assert_public_safe(result)` (`export.py:105`, raises on
   a forbidden key such as `kiln_id` or a kiln coordinate) — no exception.

In `tests/test_ask_eval.py` (Plan 002's table):
5. `test_kiln_chain_passes_the_guard` — script
   `[("tool", "find_area", {"name": "Dhaka"})]`, then
   `[("tool", "kiln_seasons", {"unit_id": "BD3026"})]`, then an answer built
   from the real tool output (`r = kiln_seasons(Data(FIXT), "BD3026")`;
   text `f"Kilns in Dhaka usually run from {r['typical_season']['starts']} to {r['typical_season']['ends']}, about {r['typical_season']['length_days']} days."`)
   → `blocked is False`.
6. `test_national_kiln_call_with_invented_number_is_blocked` — script
   `[("tool", "kiln_seasons", {})]`, then `["Kilns run 999 days a year."]` →
   `blocked is True`, `999.0 in unsupported`.

Plan 002's `build_cache` test derives its expectations from
`DEMO_QUESTIONS`, so the two new questions need no change to it.

**Verify**: `python -m pytest tests/test_ask.py tests/test_ask_eval.py -q` → all pass.

### Step 5: Demo questions + docs

Append to `DEMO_QUESTIONS`:

```python
("When do brick kilns operate around Dhaka, and how long is their season?", "en"),
("How many kiln clusters does Bangladesh have, and when does their season run?", "en"),
```

(No new Bangla content: the team plans to remove Bangla support.) Update the `docs/AI_USE.md` "What the AI does" row: "five
project functions" → "seven project functions", and add "kiln seasons" and
"the national trend" to its list. Rebuilding the live `ask.json` happens at
the next `ask --build-cache` (Plan 004 automates it) — NOT in this plan.

**Verify**: `python -m ruff check . && python -m pytest -q` → all green;
`python -c "import kilnwatch.ask as a; print(len(a.TOOLS), len(a.FUNCS), len(a.DEMO_QUESTIONS))"` → `7 7 6`.

## Test plan

Step 4: 5 unit tests + 2 eval cases; expectations recomputed from the
committed fixtures or fixed web-rule values. Pattern:
`test_outlook_tool_matches_the_web_rule_at_the_window_start` (`tests/test_ask.py:70`).

## Done criteria

- [ ] `python -m ruff check .` exits 0
- [ ] `python -m pytest -q` exits 0, with the 7 new tests present
- [ ] `python -c "import kilnwatch.ask as a; print(len(a.TOOLS), len(a.FUNCS), len(a.DEMO_QUESTIONS))"` → `7 7 6`
- [ ] `test_new_tool_outputs_are_public_safe` passes (tool output, not just the fixture files, is checked)
- [ ] `grep -c "seven project functions" docs/AI_USE.md` → `1`
- [ ] Scope check (works whether or not you have committed): `git diff --name-only 98fa82a -- . ':!plans'` lists only: `kilnwatch/ask.py`, `tests/test_ask.py`, `tests/test_ask_eval.py`, `docs/AI_USE.md`
- [ ] `plans/README.md` row updated

## STOP conditions

- The fixture data shape differs from "Current state" (e.g. no `national`
  block, or onset is not a day-of-season number) — report the actual shape.
- `_run` no longer validates `unit_id` as excerpted (the omission design
  depends on it).
- Making either tool work appears to need a change to `_run`, the loop or
  the guard.
- `test_new_tool_outputs_are_public_safe` fails (the tool exposed a
  non-public field) — report which key; do not loosen `assert_public_safe`.

## Maintenance notes

- `_when_text` and `_typical_season` duplicate `plain.ts` rules on purpose
  (Python agent vs browser); the fixed-value test pins them together. If
  `plain.ts` changes, change both and their tests.
- Deferred: a `world_coverage` tool. It needs the coverage rules moved out
  of `RegionPage.tsx` into exported data first; not worth doing until
  regional work (roadmap F9) ships.
- Plan 005's hosted worker re-implements these tools in TypeScript; its
  parity goldens must cover both.
