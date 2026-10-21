# Plan 002: Ask-agent tests + adversarial eval suite — refined as-built

> Refinement of `plans/002-ask-agent-eval-suite.md`, verified against HEAD
> `2f0b5eb` on 2026-10-21. The written plan predates the Gemini migration
> (`a4b0bf7`); the test *intent* shipped unchanged, the client *contract*
> did not. No executable work remains.

## Status

- **DONE** — commit `f71ae9f` ("test(ask): cover refusal, the cache builder,
  this_season, all-zero years; add adversarial evals").
- Later: `a4b0bf7` migrated `ask()` to Gemini; the tests were adapted with it
  (suite green today: **204 passed, 1 skipped**).

## What shipped (verified 2026-10-21)

- `tests/test_ask.py` — the four planned unit tests: refusal reported not
  filled in, `build_cache` writes the payload and keeps blocked answers,
  `this_season` reads the district and marks provisional, `_busy_months`
  all-zero year returns `None`.
- `tests/test_ask_eval.py` — the five adversarial cases, including the guard's
  documented limit pin: a correct number attached to a wrong claim passes
  (value-checking, not claim-checking).
- `docs/AI_USE.md` — the "Known limits of the guard" row exists
  (`grep -c "Known limits of the guard" docs/AI_USE.md` → 1).

## Deltas from the written plan (Gemini migration)

- The scripted `_client` no longer fakes `client.beta.messages.create`.
  Since `a4b0bf7` the injectable client is a plain callable
  (`kilnwatch/ask.py:327-331`): it takes the request body dict built by
  `request()` (`ask.py:286`) and returns Gemini's JSON reply
  (`gemini_client()`, `ask.py:303`, is the production one). Same idea —
  script what the model says, never what a tool returns — different shape.
- The refusal path is now detected from Gemini's `finishReason`/block
  signals rather than a `stop_reason == "refusal"` attribute.

## Verify today (repo root)

```bash
python -m pytest tests/test_ask.py tests/test_ask_eval.py -q   # all pass
python -m pytest -q                                            # 204 passed, 1 skipped
```

## Follow-ups

- None open. The standing contract: every new tool (003 honored it) adds
  cases to `tests/test_ask_eval.py`, and any change to guard semantics must
  confront the wrong-claim pin deliberately.

## Maintenance notes

- The wrong-claim test failing means someone changed guard semantics —
  review that like a pre-registration amendment.
- `build_cache`-related tests derive turns/counts/languages from
  `DEMO_QUESTIONS`, so demo-question changes need no test edits.
