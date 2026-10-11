# Plan 002: Agent test coverage + adversarial eval suite for Ask Kiln Watch

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on.
> On any STOP condition, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat c053cfa..HEAD -- kilnwatch/ask.py tests/test_ask.py docs/AI_USE.md`
> Mismatch with the excerpts below = STOP condition.

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: LOW (tests and docs only; no product code changes)
- **Depends on**: none (independent of Plan 001)
- **Category**: tests / docs
- **Planned at**: commit `c053cfa`, 2026-10-11

## Why this matters

`kilnwatch/ask.py` is the project's only in-product AI agent, yet five of
its behaviours have no test: the refusal path, the offline cache builder
(`build_cache`), the `this_season` tool, the all-zero edge of
`_busy_months`, and the Bangla answer flow. Worse, nothing exercises the
agent *adversarially* — the guard's known limitation (a correct number
attached to a wrong claim) is undocumented, and every future prompt or tool
change (Plans 003/005) would ship without a regression net. This plan adds
the missing unit tests, an adversarial case table, and one honest
"Known limits" row in `docs/AI_USE.md`.

## Current state

- `kilnwatch/ask.py` (243 lines) — the agent. Facts you need:
  - `MAX_STEPS = 6` (line 21); `MODEL = "claude-opus-5-5"` (line 20).
  - The loop `ask(question, client=None, data=None)` (lines 204–230) returns
    `{question, answer|None, blocked, unsupported?, reason?, tools}`.
    Refusal branch (line 215):
    ```python
    if r.stop_reason == "refusal":
        return {"question": question, "answer": None, "blocked": True, "reason": "refusal", "tools": calls}
    ```
    Step-cap branch (line 230) returns `reason: f"step limit {MAX_STEPS}"`.
  - `build_cache(src=..., client=None, out=None)` (lines 233–243) answers the
    four `DEMO_QUESTIONS`, writes `{model, generated_at, data_build, answers}`
    via `dump_json` (atomic write) to `<src>/ask.json`, and returns the
    payload. `data_build` comes from `meta.json`'s `git_sha`.
  - Tools: `find_area` (line 62), `area_fire_calendar` (97),
    `this_season` (113), `two_week_outlook` (124), `harmonization_evidence`
    (151). `this_season` reads `nrt/current_season.json`, keys districts by
    `unit_id[:6]`, returns `{"error": "no live data for this district"}` when
    absent, else `as_of`, `unusual_days_so_far`, `provisional: True`.
  - `_busy_months(per_day, share=0.25)` (lines 81–94) returns `None` when
    `top == 0` (all-zero year). Month starts array is inline at line 83.
  - Guard: `numbers()` (194) and `guard(answer, results)` (198) — value-based:
    a number passes if ANY tool result contained that value.
- `tests/test_ask.py` (85 lines) — the scripted-client pattern to extend:

  ```python
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

  Existing tests: numbers/guard basics, happy loop, invented-number blocked,
  step cap, find_area ordering, path safety, outlook parity.
- Fixture data: `C.ROOT / "web" / "fixtures" / "full" / "data"` (synthetic,
  committed — safe for tests). The `nokiln` fixture set lives beside it.
- `docs/AI_USE.md` §2 has a table "Item | Detail" (lines 18–27) — add one
  row after the "Limits" row.
- Repo test rules (CLAUDE.md): every test asserts a closed-form property or
  pre-registered value, never current output; no test file may contain the
  strings matching `data[/\]+(raw|interim)` (enforced by
  `tests/test_isolation.py`); no unbounded loops; writes atomic.
- Python checks: `python -m ruff check .` and `python -m pytest -q` from the
  repo root (after `pip install -r requirements.txt -c constraints.txt`).

## Commands you will need

| Purpose | Command (repo root) | Expected |
|---|---|---|
| Install | `pip install -r requirements.txt -c constraints.txt` | exit 0 |
| Lint | `python -m ruff check .` | "All checks passed!" |
| Tests | `python -m pytest -q` | all pass |

## Scope

**In scope**:
- `tests/test_ask.py` (extend)
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

### Step 1: Missing unit tests in `tests/test_ask.py`

Add, using the `_client` helper and the `full` fixture:

1. `test_refusal_is_reported_not_filled_in` — client whose first turn has
   `stop_reason="refusal"` and no content. Tip: the helper derives
   `stop_reason` from the blocks; extend it to accept an optional
   `stop="..."` override per turn (keep existing call sites working).
   Assert `out["blocked"] and out["reason"] == "refusal" and out["answer"] is None`.
2. `test_build_cache_writes_payload_and_keeps_blocked_answers` — copy the
   `full` fixture `data` dir to `tmp_path` (pattern:
   `test_outlook_tool_matches_the_web_rule_at_the_window_start` at
   `test_ask.py:70` uses `shutil.copytree`), script the client to answer one
   question fine and one with an invented number; call
   `ask.build_cache(src, client=fake_client, out=tmp_path/"ask.json")`.
   Assert: file exists, `payload["model"] == "claude-opus-5-5"`, 4 answers,
   exactly one has `blocked=True`, `data_build` equals the fixture
   `meta.json`'s `git_sha` (read it in the test and compare — closed-form).
3. `test_this_season_reads_the_district_and_marks_provisional` — on the
   `full` fixture, call `this_season(Data(FIXT), "BD3026")` (or the district
   id present in the fixture's `nrt/current_season.json` — read the file in
   the test and use its first key; then assert against values recomputed
   from the same file: `as_of == day0 + (len(h)-1) days`,
   `unusual_days_so_far == districts[dist]["above_p90_days"]`,
   `provisional is True`). Also assert the error branch: a unit id whose
   first 6 chars are not a district key returns
   `{"error": "no live data for this district"}`.
4. `test_busy_months_all_zero_year_returns_none` —
   `_busy_months(np.zeros(366))` is `None`; and a synthetic single-peak
   array (e.g. days 0–366 zero except a bump in the December block) returns
   `busiest_month == "December"`.
5. `test_bangla_question_flows_through` — script a client that returns a
   Bangla text answer containing the digit string "৯৭" and a tool result
   containing 97; assert `guard` passes (Bangla digits already normalise —
   this pins the behaviour at the loop level: `out["blocked"] is False`).

**Verify**: `python -m pytest tests/test_ask.py -q` → all pass (8 existing
+ 5 new).

### Step 2: Adversarial table in `tests/test_ask_eval.py`

Create the file with a module docstring naming its purpose: "Adversarial
cases for the Ask agent; every case is a scripted model, so the suite runs
with no network and no key." Cases (each its own `test_` using `_client`
imported from `tests.test_ask`):

1. `test_out_of_scope_question_answered_without_numbers` — model returns
   text with no digits and no tool calls → not blocked, answer kept.
2. `test_out_of_scope_with_invented_number_is_blocked` — same but the text
   states "42 districts" → blocked, `42.0 in out["unsupported"]`.
3. `test_correct_number_wrong_claim_passes_the_guard_documented_limit` —
   tool `harmonization_evidence` returns
   `{"share_of_2012_jump_removed_pct": 54}`; the scripted answer says
   "54% of all fires in Bangladesh are removed by the correction" (a false
   claim: the number is about the 2012 seam, not all fires). Assert
   `out["blocked"] is False` — and name the test so the assertion reads as
   documentation of the guard's limit, matching the AI_USE.md row added in
   Step 3. This is THE regression pin: if someone "fixes" the guard's
   semantics, this test forces a conscious decision.
4. `test_tool_error_is_shown_not_swallowed` — model calls `find_area` with
   `{"name": ""}` → `_run` returns an error dict; scripted follow-up text
   "I could not search for that." → not blocked (no numbers).
5. `test_unknown_tool_is_reported` — model calls a tool named
   `"delete_everything"` → the loop's `FUNCS.get` miss path returns
   `{"error": "unknown tool delete_everything"}` in `out["tools"][0]["result"]`.

**Verify**: `python -m pytest tests/test_ask_eval.py -q` → all pass;
`python -m pytest -q` → whole suite green.

### Step 3: "Known limits" row in `docs/AI_USE.md`

In §2's table, after the `| Limits |` row, add:

```markdown
| Known limits of the guard | `guard()` checks numbers by value, not by meaning: an answer that attaches a correct number to the wrong claim (for example "97% of fires removed" vs "97% of the 2012 jump removed") passes. Pinned by `tests/test_ask_eval.py`; closing it needs claim-level checking, which we do not ship. |
```

**Verify**: `grep -c "Known limits of the guard" docs/AI_USE.md` → `1`.

## Test plan

Steps 1–2 ARE the test plan. Pattern: `tests/test_ask.py` (scripted client,
fixtures from `web/fixtures/full/data`, closed-form assertions only).

## Done criteria

- [ ] `python -m ruff check .` exits 0
- [ ] `python -m pytest -q` passes with ≥13 new ask tests (5 unit + 5 eval + any parametrised variants)
- [ ] `tests/test_ask_eval.py` exists and contains the wrong-claim case
- [ ] `grep -n "Known limits of the guard" docs/AI_USE.md` returns 1 row
- [ ] `git status` shows changes only in the three in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any new test exposes an actual bug in `ask.py` (e.g. `build_cache` crashes
  on a blocked answer): report it verbatim; do not fix `ask.py` in this plan.
- The `full` fixture lacks `nrt/current_season.json` (check with
  `ls web/fixtures/full/data/nrt/`) — use the `nokiln` set for the
  `this_season` test instead and note it; if neither has it, STOP.
- Drift on the excerpted line numbers by more than a few lines.

## Maintenance notes

- Plans 003 (new tools) and 005 (hosted worker) MUST extend the eval table
  with cases per new tool — this file is the contract.
- The wrong-claim test (Step 2.3) is deliberately permissive: if it ever
  fails, someone changed guard semantics — review that change like a
  pre-registration amendment.
