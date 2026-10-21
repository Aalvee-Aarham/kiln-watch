# Plan 003: Agent tool expansion — refined as-built

> Refinement of `plans/003-agent-tool-expansion.md`, verified against HEAD
> `2f0b5eb` on 2026-10-21. Shipped as designed; only the wiring around the
> tools changed with the Gemini migration. No executable work remains.

## Status

- **DONE** — commit `cf8207f` ("feat(ask): kiln_seasons and national_trend
  tools for the agent").

## What shipped (verified 2026-10-21)

- `kilnwatch/ask.py` — both tools plus the web-parity helpers, at their
  current lines: `_when_text` (:110), `_typical_season` (:116),
  `kiln_seasons` (:193), `national_trend` (:210), registered in `TOOLS`
  (:224) and `FUNCS` (:240).
- `python -c "import kilnwatch.ask as a; print(len(a.TOOLS), len(a.FUNCS), len(a.DEMO_QUESTIONS))"`
  → **`7 7 6`** (five original tools + two new; two new demo questions).
- `kiln_seasons` takes `unit_id: str | None = None` — the **omission
  design** as planned: `_run`'s `BD\d{2,10}` validation makes
  `unit_id="national"` unreachable, so national is requested by omitting the
  argument.
- `docs/AI_USE.md` says "seven project functions"
  (`grep -c "seven project functions" docs/AI_USE.md` → 1).
- Tool outputs are checked public-safe in tests (the `assert_public_safe`
  pattern the plan's second pass added).

## Deltas from the written plan

- The **tool declaration format** changed with the Gemini migration:
  `TOOLS` (JSON-schema dicts) are converted by `_declarations()` (`ask.py:272`)
  into `GEMINI_TOOLS` (:283) for `generateContent` function calling. Tool
  *functions* and *results* are unchanged in substance.
- `math.floor(x + 0.5)` half-up rounding is in place for season words and
  `length_days`, keeping parity with the worker's `Math.round`.

## Verify today (repo root)

```bash
python -m pytest -q                          # 204 passed, 1 skipped
python -c "from kilnwatch.ask import kiln_seasons, Data; print(kiln_seasons(Data('web/fixtures/full/data'))['kiln_clusters'])"  # 3653
```

## Follow-ups

- None open. The deferred `world_coverage` tool stays deferred until F9
  regional work moves the coverage wording into exported data.

## Maintenance notes

- `_when_text`/`_typical_season` intentionally duplicate `web/src/lib/plain.ts`
  rules; the fixed-value tests pin them together. Change both or neither.
- New tools must land in both `kilnwatch/ask.py` and `ask-worker/src/tools.ts`
  with golden arguments extended — the goldens (`spec.json`,
  `tests/test_ask_goldens.py`) enforce this in CI.
