# Plan 003: Expand the Ask agent's tool surface (kiln seasons, national trend, world coverage)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on.
> On any STOP condition, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat c053cfa..HEAD -- kilnwatch/ask.py tests/test_ask.py docs/AI_USE.md`
> Mismatch with the excerpts below = STOP condition. Plan 002 adds tests to
> these same files — if 002 has landed, its tests are expected drift; only
> the `ask.py` excerpts must still match.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW-MED (touches the shipped agent; the guard and step cap
  bound the blast radius)
- **Depends on**: Plan 002 (the eval table is the safety net for new tools;
  extend it here)
- **Category**: direction
- **Planned at**: commit `c053cfa`, 2026-10-11

## Why this matters

The public export has grown (kiln seasons per district, national yearly
series, world region coverage from roadmap F8), but the agent still has only
five tools (`ask.py:161-172`). The flagship AI feature cannot answer "when
do brick kilns operate in Bogura?" even though the website's Gemini chat can
(`web/src/pages/AskPage.tsx:49` reads `kiln_activity.json`) — the agent looks
weaker than the static site around it. Every new tool is a deterministic,
read-only function over the public tier plus a provenance line; the numeric
guard (`ask.py:198`) and `MAX_STEPS` cap already scale for free.

## Current state

- `kilnwatch/ask.py` — agent anatomy you must match:
  - Tools are plain functions `(d: Data, unit_id: str) -> dict` returning a
    `provenance` dict via `d.prov(rel_path, dataset_name)` (line 54) and
    honest `{"error": ...}` dicts when data is absent (see
    `area_fire_calendar` line 100-101 and `this_season` line 117).
  - Registration: one entry in `TOOLS` (JSON-schema dict, line 161-172) and
    one in `FUNCS` (line 173). Tool descriptions state exactly what the
    tool returns and its limits — copy that register.
  - `unit_id` arguments are validated by the `_UNIT` regex at line 176
    (`r"BD\d{2,10}"`) inside `_run` — new tools taking a unit id get this
    for free.
  - `DEMO_QUESTIONS` (lines 24-29): four tuples `(question, lang)`; the
    cache builder answers them all (`build_cache` line 233).
- Data shapes (verified in `kilnwatch/research.py:101-110`, which reads the
  same files):
  - `kiln_activity.json` — `{"national": {"n_clusters": int, "seasons": [
    {"season": "2018-19", "onset": {p50,lo,hi}|null, "end", "duration",
    "peak": ...} ]}, "areas": {"BD3026": {"n_clusters": int, "seasons":
    [...]}}}`. Onset/end are day-of-season numbers, duration in days.
    Area-level only — safe for the agent by construction.
  - `harmonization.json` — `yearly: [{"season", "raw_sum", "h": {p50, lo,
    hi}, "aqua_obs", "raw_by_sensor": {...}}]` (read in
    `harmonization_evidence`, line 151, for the pattern of pulling numbers
    out of it).
  - `web/fixtures/full/data/` — committed synthetic export for tests (has
    `kiln_activity.json`); `web/fixtures/nokiln/data/` deliberately has no
    kiln file — the honest-error fixture.
- Web-side reference for season phrasing: `web/src/lib/plain.ts`
  `typicalSeason`/`whenText` (used by AskPage for the same data).
- `docs/AI_USE.md` §2 table row "What the AI does" lists "five project
  functions" — update the count when tools land.

## Commands you will need

| Purpose | Command (repo root) | Expected |
|---|---|---|
| Install | `pip install -r requirements.txt -c constraints.txt` | exit 0 |
| Lint | `python -m ruff check .` | "All checks passed!" |
| Tests | `python -m pytest -q` | all pass |
| Manual agent try | `python -m kilnwatch ask "When do kilns run in Bogura?" --src web/fixtures/full/data` | JSON with `tools[0].name == "find_area"` and a kiln tool call (needs `ANTHROPIC_API_KEY`; skip if absent) |

## Scope

**In scope**:
- `kilnwatch/ask.py`
- `tests/test_ask.py` or `tests/test_ask_eval.py` (new tool tests; prefer
  `test_ask.py` for parity tests, `test_ask_eval.py` for loop-level cases)
- `docs/AI_USE.md` (tool-count row)

**Out of scope**:
- `kilnwatch/export.py`, `web/**` — the data already ships; only the agent
  reads it differently.
- The guard, `MAX_STEPS`, the model id, the tool loop itself.
- Any new dependency.

## Git workflow

- Branch `plan-003-agent-tools`; commits `feat(ask): <tool>`.
- No push/PR unless instructed.

## Steps

### Step 1: `kiln_seasons` tool

Add to `ask.py`:

```python
def kiln_seasons(d: Data, unit_id: str) -> dict:
    """Kiln working season from night lights, for one area or the nation, from kiln_activity.json."""
```

Behaviour: read `kiln_activity.json`; if the file is missing return
`{"error": "no kiln analysis in this data build"}` (this is the `nokiln`
case). If `unit_id == "national"` (also accept `"BD"` for it — document in
the tool description) use the `national` block, else `areas.get(unit_id)`;
absent key → `{"error": f"no kiln season for {unit_id}"}`. Return
`n_clusters` (a count, already public), the last season's
`onset/end/duration/peak` p50 with lo/hi for duration, and `provenance`
(`d.prov("kiln_activity.json", "Kiln Watch kiln activity from NASA Black Marble night lights, area-level")`).
Register in `TOOLS` (schema: required `unit_id`, plus the description must
say it accepts `"national"`) and `FUNCS`.

**Verify**: `python -m pytest tests/test_ask.py -q` → green (new tests in
Step 4); interim: `python -c "from kilnwatch.ask import kiln_seasons, Data; print(kiln_seasons(Data('web/fixtures/full/data'), 'national'))"`
→ prints a dict with a `seasons`-derived key and `provenance`.

### Step 2: `national_trend` tool

Same pattern, reading `harmonization.json`'s `yearly` list. No arguments.
Return: the first and last season's `h` p50 values, the count of seasons,
and the single highest-`h_p50` season (label it clearly, e.g.
`peak_season`). `provenance`: `d.prov("harmonization.json", FIRE)` — reuse
the `FIRE` constant (line 59). Register in `TOOLS`/`FUNCS`.

**Verify**: `python -c "from kilnwatch.ask import national_trend, Data; print(national_trend(Data('web/fixtures/full/data')))"` → dict with `n_seasons`, first/last/peak season fields, `provenance`.

### Step 3: World coverage — CONDITIONAL, verify data exists first

Run `ls web/fixtures/full/data/` and `grep -rl "world\|region" web/fixtures/full/data --include=*.json | head`.
If a world/regions file exists (F8 shipped one), add a `world_coverage`
tool taking a free-text `place` argument (NOT a unit_id — so `_UNIT`
validation does not apply; validate instead: `isinstance(place, str) and
len(place) <= 80`, else error dict — same `_run` style), returning the
place's coverage status and analysis level exactly as the RegionPage panel
states it, with `provenance`. If NO such file exists, skip this step
entirely and note it in the plan result — do not invent a data source.

**Verify**: tool call on the fixture returns a dict; or step skipped with a
note.

### Step 4: Tests (parity + honest-error + eval)

In `tests/test_ask.py` (fixture: `web/fixtures/full/data`):
1. `test_kiln_seasons_national_and_area` — assert `n_clusters` equals the
   value read from the fixture file in the test (closed-form: recompute
   from the same JSON); assert duration p50/lo/hi match the file's last
   national season.
2. `test_kiln_seasons_honest_errors` — on the `nokiln` fixture:
   `{"error": ...}` with "no kiln analysis"; on `full` with an absent
   unit_id (`"BD99"`): "no kiln season".
3. `test_national_trend_matches_harmonization_yearly` — recompute expected
   first/last/peak from the fixture's `harmonization.json` in the test.

In `tests/test_ask_eval.py` (extend Plan 002's table):
4. A scripted loop case where the model chains `find_area` →
   `kiln_seasons` and states only returned numbers → passes the guard.
5. A case where the model calls `kiln_seasons` with `unit_id: "national"`
   then invents a number → blocked (the guard covers new tools with zero
   changes — this pins that).

### Step 5: Demo questions + docs

Add to `DEMO_QUESTIONS` (keeps the offline cache showcasing the new tools;
one English kiln, one Bangla outlook — closes finding AI-12):

```python
("When do brick kilns operate around Bogura, and how long is their season?", "en"),
("নওগাঁ জেলার কিলনগুলো কখন কাজ করে?", "bn"),
```

Update the `docs/AI_USE.md` §2 "What the AI does" row: "five project
functions" → the new count, naming the additions. Rebuild of the live
`ask.json` happens at the next `ask --build-cache` (Plan 004 automates it) —
NOT in this plan.

**Verify**: `python -m ruff check . && python -m pytest -q` → all green;
`grep -c "world_coverage\|kiln_seasons\|national_trend" kilnwatch/ask.py` ≥ 4.

## Test plan

Steps 4 covers it: 5 new tests, closed-form assertions recomputed from the
fixture files inside the tests (pattern: `test_outlook_tool_matches_the_web_rule_at_the_window_start`, `tests/test_ask.py:70`).

## Done criteria

- [ ] `python -m ruff check .` exits 0
- [ ] `python -m pytest -q` passes with ≥5 new tests
- [ ] `python -c "import kilnwatch.ask as a; print(len(a.TOOLS))"` ≥ 7
- [ ] `nokiln` fixture: `kiln_seasons` returns an honest error (test exists)
- [ ] `docs/AI_USE.md` names the new tool count
- [ ] `git status` clean outside in-scope files; `plans/README.md` updated

## STOP conditions

- The fixture data shape differs from "Current state" (e.g.
  `kiln_activity.json` has no `national` block) — report the actual shape.
- A new tool's output trips the public-safety greps
  (`python -m kilnwatch export --check-public web/fixtures/full/data` must
  still pass — if your tool leaks a forbidden key, you read a non-public
  file; STOP).
- The agent loop needs modification to support the new tools (it should
  not — registration is data-only).

## Maintenance notes

- Every future export addition should come with an agent tool or an explicit
  "why not" — the eval table is the pattern to extend.
- Plan 005's hosted worker re-implements these tools in TypeScript; parity
  tests there must cover every tool added here.
