# Plan 004: ask.json cache automation — refined as-built

> Refinement of `plans/004-ask-cache-automation.md`, verified against HEAD
> `2f0b5eb` on 2026-10-21. Shipped and daily-active, but with the Gemini
> migration came two small defects this file records — including the **one
> open code change** in the whole plan set.

## Status

- **DONE** — commit `6435331` ("ops(ask): rebuild the ask.json cache on
  publish and in the daily deploy").
- Later: `a4b0bf7` swapped the key from `ANTHROPIC_API_KEY` to
  `GEMINI_API_KEY` everywhere in this feature.

## What shipped (verified 2026-10-21)

- `kilnwatch/export.py` — `refresh_ask_cache(env, build)` at line 203:
  no key → `log.warning` + `return False`; key present → lazy
  `from .ask import build_cache` (no import cycle). `publish()` calls it
  **first** (line 219) so the fresh `ask.json` goes through every safety
  check and into the release.
- `.github/workflows/deploy.yml` — the refresh step with the key scoped to
  one step's `env` (lines 28–33, `|| echo "::warning::…"` so it never blocks
  the deploy); the single-file `ask` artifact up (line 40,
  `if-no-files-found: ignore`) and down (line 58, `continue-on-error`).
- `docs/operations.md` — no longer claims FIRMS_MAP_KEY is the only secret
  (`grep -c "The only secret is" docs/operations.md` → 0).

## Deltas from the written plan

- Anthropic → Gemini (`a4b0bf7`): the hook checks `GEMINI_API_KEY` and
  `build_cache` answers via `gemini_client()` (`kilnwatch/ask.py:303`).

## Follow-ups (open — the one real code change left in plans 001–009)

1. **`publish()` is not outage-proof.** `refresh_ask_cache` calls
   `build(C.WEB_DATA)` bare (`export.py:215`). With the key set and the
   Gemini API down, `export --publish` **aborts mid-release** — the deploy
   workflow guards itself with `||`, `publish()` does not. Fix (3 lines):
   ```python
   try:
       build(C.WEB_DATA)
   except Exception:
       log.warning("ask cache refresh failed; publishing the previous ask.json", exc_info=True)
       return False
   ```
2. **Stale docstring**: `refresh_ask_cache` still says "when an Anthropic key
   is set" (`export.py:204`) while checking `GEMINI_API_KEY`. One word.
3. `plans/README.md` "Human decisions outstanding" still lists
   `ANTHROPIC_API_KEY` — should read `GEMINI_API_KEY`.

## Verify today (repo root)

```bash
python -m pytest tests/test_export.py -q    # hook test passes (in the 204)
grep -c "GEMINI_API_KEY" .github/workflows/deploy.yml   # 3 (step env + two guards)
uv run --no-project -q --with pyyaml python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml')); print('ok')"
```

## Maintenance notes

- Cost stays bounded: `len(DEMO_QUESTIONS) × MAX_STEPS` = 6 × 6 model calls
  per day on `gemini-3.5-flash-lite`.
- The repo secret itself is a human step (see the corrected list in this
  set's README).
