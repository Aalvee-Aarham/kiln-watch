# Plan 002: Agent test coverage + adversarial eval suite for Ask Kiln Watch

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on.
> On any STOP condition, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 98fa82a..HEAD -- kilnwatch/ask.py tests/test_ask.py docs/AI_USE.md`
> If any file changed, compare the excerpts below against the live code; a
> mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: LOW (tests and docs only; no product code changes)
- **Depends on**: none (independent of Plan 001)
- **Category**: tests / docs
- **Planned at**: commit `98fa82a`, 2026-10-12 (first written 2026-10-11; reviewed and corrected against live code)

## Why this matters

`kilnwatch/ask.py` is the project's only in-product AI agent, yet four of
its behaviours have no test: the refusal path, the offline cache builder
(`build_cache`), the `this_season` tool, the all-zero edge of
and `_busy_months`'s all-zero edge — and nothing exercises the
agent *adversarially*, and the guard's known limit (a correct number attached
to a wrong claim) is undocumented. Every future prompt or tool change (Plans
003/005) would ship without a regression net. This plan adds the missing
unit tests, an adversarial case table, and one honest "Known limits" row in
`docs/AI_USE.md`.

## Current state

- `kilnwatch/ask.py` (243 lines) — the agent:
  - `MODEL = "claude-opus-5-5"` (line 20); `MAX_STEPS = 6` (line 21).
  - `DEMO_QUESTIONS` (lines 24–29): **four** `(question, lang)` tuples (Plan 003 adds two). Tests must not
    hard-code the count or the languages: derive both from `DEMO_QUESTIONS`.
  - `ask(question, client=None, data=None)` (line 204) calls
    `client.beta.messages.create(...)` once per step and returns
    `{question, answer|None, blocked, unsupported?, reason?, tools}`.
    Refusal branch (lines 215–216):
    ```python
    if r.stop_reason == "refusal":
        return {"question": question, "answer": None, "blocked": True, "reason": "refusal", "tools": calls}
    ```
    Unknown tool (lines 225–226):
    `res = _run(fn, data, u.input) if fn else {"error": f"unknown tool {u.name}"}`.
  - **Tool results are computed by the real tool functions on the `data`
    directory you pass** — a scripted client scripts only what the *model*
    says (tool calls and text), never what a tool returns. To put a number
    in a scripted answer that the guard must accept, read it from the
    fixture in the test (pattern below).
  - `this_season(d, unit_id)` (lines 113–121) — reads
    `nrt/current_season.json`, `dist = unit_id[:6]`; absent →
    `{"error": "no live data for this district"}`; else returns
    `{"district", "season", "data_to", "unusual_days_so_far", "provisional": True, "provenance"}`
    where `data_to = (pd.Timestamp(nrt["day0"]) + pd.Timedelta(days=len(h) - 1)).strftime("%Y-%m-%d")`
    and `h = nrt["districts"][dist]["h"]`. **The key is `data_to`, not `as_of`.**
  - `find_area(d, name)` (lines 62–68) — an empty name returns
    `{"matches": [], "provenance": …}` (not an error).
  - `harmonization_evidence(d)` (line 151) —
    `share_of_2012_jump_removed_pct = round(100 * (1 - h["seam"]["ratio"]))`.
  - `_busy_months(per_day, share=0.25)` (lines 81–94): month starts
    `[0, 31, 62, 92, 123, 153, 184, 215, 243, 274, 304, 335, 366]`
    (a season year from July), returns `None` when every month mean is 0,
    else `{"usual_first_month", "busiest_month", "usual_last_month"}`.
  - `build_cache(src, client=None, out=None)` (lines 233–243) answers all
    four `DEMO_QUESTIONS` with one `ask()` each, then writes
    `{model, generated_at, data_build, answers}` atomically.
    `data_build = meta.json["git_sha"]` (the `full` fixture's value is the
    string `"fixture"`).
- `tests/test_ask.py` (85 lines, 8 tests) — the pattern to extend:

  ```python
  FIXT = C.ROOT / "web" / "fixtures" / "full" / "data"  # synthetic, committed

  def _client(*turns):
      """Each turn is a list of blocks; a tool call is ('tool', name, input), text is a str."""
      seen = []
      def create(**kw):
          seen.append(kw)
          blocks = turns[min(len(seen) - 1, len(turns) - 1)]
          content = [NS(type="tool_use", id=f"t{i}", name=b[1], input=b[2]) if isinstance(b, tuple) else NS(type="text", text=b) for i, b in enumerate(blocks)]
          return NS(content=content, stop_reason="tool_use" if any(c.type == "tool_use" for c in content) else "end_turn")
      return NS(beta=NS(messages=NS(create=create))), seen
  ```

  Turns are consumed **across every `ask()` call that shares the client**,
  and the last turn repeats once they run out. The existing
  `test_loop_calls_project_functions_and_passes_the_gate` shows how to put a
  tool's real value into the scripted answer:
  ```python
  pct = harmonization_evidence(d)["share_of_2012_jump_removed_pct"]
  client, seen = _client([("tool", "harmonization_evidence", {})], [f"The correction removed {pct}% of the 2012 jump."])
  ```
  Already covered (do not duplicate): number/guard basics, happy loop,
  invented number blocked, step cap, find_area ordering, path-safety of
  tool arguments, outlook parity.
- `docs/AI_USE.md` — the first "Item | Detail" table (lines 18–26) ends
  with the `| Limits |` row at line 26.
- Repo test rules (`CLAUDE.md`): assert closed-form properties or values
  recomputed from committed fixtures, never "whatever it outputs today";
  `tests/test_isolation.py` forbids test files that reference
  `data/raw` or `data/interim`; no unbounded loops.

## Commands you will need

| Purpose | Command (repo root) | Expected |
|---|---|---|
| Install | `pip install -r requirements.txt -c constraints.txt` (Python 3.11) | exit 0 |
| Lint | `python -m ruff check .` | "All checks passed!" |
| Tests (file) | `python -m pytest tests/test_ask.py -q` | all pass |
| Tests (all) | `python -m pytest -q` | all pass |

## Scope

**In scope**:
- `tests/test_ask.py` (extend; including a backwards-compatible change to `_client`)
- `tests/test_ask_eval.py` (create — adversarial table)
- `docs/AI_USE.md` (one table row)

**Out of scope**:
- `kilnwatch/ask.py` — do NOT change agent code. If a test reveals a real
  bug, that is a STOP condition (report it), not something to fix silently.
- `web/**`, workflows, any other kilnwatch module.

## Git workflow

- Branch `plan-002-ask-evals`; commits `test(ask): <...>`.
- No push, no PR unless instructed.

## Steps

### Step 1: Let `_client` script a stop reason

Change `_client` so a turn may be a `(blocks, stop_reason)` tuple as well as
a plain list; plain lists keep today's behaviour (existing call sites
unchanged):

```python
def _client(*turns):
    """Each turn is a list of blocks, or (blocks, stop_reason); a tool call is ('tool', name, input), text is a str."""
    seen = []

    def create(**kw):
        seen.append(kw)
        turn = turns[min(len(seen) - 1, len(turns) - 1)]
        blocks, stop = turn if isinstance(turn, tuple) else (turn, None)
        content = [NS(type="tool_use", id=f"t{i}", name=b[1], input=b[2]) if isinstance(b, tuple) else NS(type="text", text=b) for i, b in enumerate(blocks)]
        return NS(content=content, stop_reason=stop or ("tool_use" if any(c.type == "tool_use" for c in content) else "end_turn"))

    return NS(beta=NS(messages=NS(create=create))), seen
```

**Verify**: `python -m pytest tests/test_ask.py -q` → 8 passed (unchanged).

### Step 2: Four unit tests in `tests/test_ask.py`

1. `test_refusal_is_reported_not_filled_in` —
   `client, _ = _client(([], "refusal"))`;
   `out = ask("anything", client, Data(FIXT))`;
   assert `out["blocked"] is True and out["reason"] == "refusal" and out["answer"] is None and out["tools"] == []`.
2. `test_build_cache_writes_payload_and_keeps_blocked_answers(tmp_path)` —
   copy the fixture: `shutil.copytree(FIXT, tmp_path / "data")`. Script
   exactly one model turn per demo question, no tool calls, so turn *i*
   answers question *i*; only turn 1 states an invented number. Derive
   everything from `DEMO_QUESTIONS` so the test survives adding or removing
   questions:
   ```python
   n = len(DEMO_QUESTIONS)
   turns = [["No numbers here."] for _ in range(n)]
   turns[1] = ["There are 42 districts."]
   client, seen = _client(*turns)
   ```
   Call `p = build_cache(tmp_path / "data", client=client, out=tmp_path / "ask.json")`.
   Assert: `(tmp_path / "ask.json").exists()`; `len(seen) == n`;
   `p["model"] == "claude-opus-5-5"`; `len(p["answers"]) == n`;
   `[a["blocked"] for a in p["answers"]] == [i == 1 for i in range(n)]`;
   `42.0 in p["answers"][1]["unsupported"]`;
   `[a["lang"] for a in p["answers"]] == [lang for _, lang in DEMO_QUESTIONS]`;
   `p["data_build"] == json.loads((FIXT / "meta.json").read_text(encoding="utf-8"))["git_sha"]`;
   and the file on disk equals `p` (`json.loads(...) == p`).
3. `test_this_season_reads_the_district_and_marks_provisional` —
   read `nrt = json.loads((FIXT / "nrt" / "current_season.json").read_text(encoding="utf-8"))`,
   take `dist = next(iter(nrt["districts"]))` (it is `"BD3026"` in the
   fixture, but read it). Call `out = this_season(Data(FIXT), dist)`.
   Recompute expectations from the same file:
   `out["data_to"] == (pd.Timestamp(nrt["day0"]) + pd.Timedelta(days=len(nrt["districts"][dist]["h"]) - 1)).strftime("%Y-%m-%d")`,
   `out["unusual_days_so_far"] == nrt["districts"][dist]["above_p90_days"]`,
   `out["provisional"] is True`, `out["season"] == nrt["season"]`.
   Error branch: `this_season(Data(FIXT), "BD9999")` →
   `{"error": "no live data for this district"}` (first assert
   `"BD9999" not in nrt["districts"]`).
4. `test_busy_months_all_zero_year_returns_none` —
   `_busy_months(np.zeros(366)) is None`; and a December-only bump:
   `x = np.zeros(366); x[153:184] = 1.0` (index 153–183 is December in the
   July-start season year) → result equals
   `{"usual_first_month": "December", "busiest_month": "December", "usual_last_month": "December"}`.
   (Check `ask.MONTHS[5] == "December"` first in the test; if not, STOP.)
Imports to add at the top of the file: `shutil`, `numpy as np`,
`pandas as pd`, and from `kilnwatch.ask`: `DEMO_QUESTIONS`, `_busy_months`, `build_cache`,
`this_season`.

**Verify**: `python -m pytest tests/test_ask.py -q` → 12 passed.

### Step 3: Adversarial table in `tests/test_ask_eval.py`

Create the file with the module docstring: `"""Adversarial cases for the
Ask agent; every case is a scripted model, so the suite runs with no
network and no key."""`. Imports: `from kilnwatch.ask import Data, ask, harmonization_evidence`, and
`_client` and `FIXT` from `tests.test_ask`
(check `python -c "import tests.test_ask"` works from the repo root; if the
`tests` package is not importable, copy `_client` into the new file instead
and say so in the commit message). Cases:

1. `test_out_of_scope_question_answered_without_numbers` —
   `_client(["I can only answer about fire activity in Bangladesh."])` →
   `out["blocked"] is False`, `out["answer"]` is that text, `out["tools"] == []`.
2. `test_out_of_scope_with_invented_number_is_blocked` —
   `_client(["Bangladesh has 42 districts with kilns."])` →
   `out["blocked"] is True`, `42.0 in out["unsupported"]`.
3. `test_correct_number_wrong_claim_passes_the_guard_documented_limit` —
   ```python
   d = Data(FIXT)
   pct = harmonization_evidence(d)["share_of_2012_jump_removed_pct"]
   client, _ = _client([("tool", "harmonization_evidence", {})], [f"{pct}% of all fires in Bangladesh are removed by the correction."])
   out = ask("How many fires does the correction remove?", client, d)
   assert out["blocked"] is False  # the claim is false (pct is about the 2012 seam), but the guard checks values, not meaning
   ```
   This is THE regression pin for the guard's documented limit (Step 4):
   if someone changes guard semantics, this test forces a conscious decision.
4. `test_empty_search_is_answered_honestly` —
   `_client([("tool", "find_area", {"name": ""})], ["I could not find that place."])` →
   `out["tools"][0]["result"]["matches"] == []` and `out["blocked"] is False`.
5. `test_unknown_tool_is_reported` —
   `_client([("tool", "delete_everything", {})], ["Done."])` →
   `out["tools"][0]["result"] == {"error": "unknown tool delete_everything"}`
   and `out["blocked"] is False`.

**Verify**: `python -m pytest tests/test_ask_eval.py -q` → 5 passed;
`python -m pytest -q` → whole suite green.

### Step 4: "Known limits" row in `docs/AI_USE.md`

In the first "Item | Detail" table, directly after the `| Limits |` row
(line 26), add:

```markdown
| Known limits of the guard | `guard()` checks numbers by value, not by meaning: an answer that attaches a correct number to the wrong claim (for example "96% of all fires removed" when the tool said "96% of the 2012 jump removed") passes. Pinned by `tests/test_ask_eval.py`; closing it needs claim-level checking, which we do not ship. |
```

**Verify**: `grep -c "Known limits of the guard" docs/AI_USE.md` → `1`.

## Test plan

Steps 1–3 ARE the test plan: 4 unit tests + 5 adversarial cases, all
scripted, no network, every expected value either fixed or recomputed from
the committed fixture files. Pattern: `tests/test_ask.py`.

## Done criteria

- [ ] `python -m ruff check .` exits 0
- [ ] `python -m pytest tests/test_ask.py -q` → 12 passed
- [ ] `python -m pytest tests/test_ask_eval.py -q` → 5 passed
- [ ] `python -m pytest -q` exits 0
- [ ] `grep -c "Known limits of the guard" docs/AI_USE.md` → `1`
- [ ] Scope check (works whether or not you have committed): `git diff --name-only 98fa82a -- . ':!plans'` lists only: `tests/test_ask.py`, `tests/test_ask_eval.py`, `docs/AI_USE.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any new test exposes an actual bug in `ask.py` (e.g. `build_cache` crashes
  on a blocked answer): report it verbatim; do not fix `ask.py` in this plan.
- `ask.MONTHS[5] != "December"` or the month-starts list differs from the
  excerpt (the Step 2.4 indices would be wrong).
- `web/fixtures/full/data/nrt/current_season.json` is missing.
- An excerpted line moved by more than a few lines and the code differs.

## Maintenance notes

- Plans 003 (new tools) and 005 (hosted worker) MUST extend
  `tests/test_ask_eval.py` with cases per new tool — this file is the
  contract.
- The wrong-claim test (Step 3, case 3) is deliberately permissive: if it
  ever fails, someone changed guard semantics — review that change like a
  pre-registration amendment.
- The `build_cache` test derives its turns, counts and languages from
  `DEMO_QUESTIONS`, so adding or removing demo questions needs no test edit.
- No new Bangla-specific tests: the team plans to remove Bangla support; the
  existing `numbers()` Bangla-digit test is left as it is.
