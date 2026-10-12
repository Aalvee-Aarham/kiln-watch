# Plan 005: Hosted live Ask — a small Cloudflare Worker that runs the agent server-side

> **Executor instructions**: Follow this plan step by step; verify each step
> before moving on. This plan has an explicit DECISION GATE (Step 0) — if
> the human operator has not made those decisions, STOP there. Update
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 98fa82a..HEAD -- kilnwatch/ask.py web/src/pages/AskPage.tsx web/src/lib/geminiPrompt.ts .github/workflows/ci.yml`
> Plans 001–003 change these files — that is expected. What must still hold
> is the agent anatomy quoted below (loop, request parameters, guard); if
> `ask()`'s request or loop differs from the excerpt, STOP.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED (new runtime, the project's own key on a public endpoint; mitigated by a spend cap, parity tests and the static fallback)
- **Depends on**: Plan 002 (eval table), Plan 003 (final tool set), Plan 001 (pure Gemini helpers the page keeps as fallback)
- **Category**: direction
- **Planned at**: commit `98fa82a`, 2026-10-12 (first written 2026-10-11; reviewed and corrected against live code and the Claude API reference)

## Why this matters

Today "Ask Kiln Watch" is either a visitor-supplied Gemini key or a frozen
cache. The roadmap lists the AI hosting and key as an open human decision
(`docs/roadmap.md:16` F7, `:21`). A small Cloudflare Worker would run the
site's own agent (tools + guard + step cap) server-side with the project's
Anthropic key, CORS-locked to the Pages origin and spend-capped, while the
cached answers and the bring-your-own-key chat stay as fallbacks — the
static site never depends on the worker being up. The tools read only the
public export the site already serves, so the port is mechanical and
parity-testable.

## Current state

- The Python agent to port — `kilnwatch/ask.py`:
  - `SYSTEM` prompt (lines 30–38), `MODEL = "claude-opus-5-5"` (20),
    `MAX_STEPS = 6` (21), `TOOLS` (161–172), `FUNCS` (173–174), `_run`
    argument validation with `_UNIT = re.compile(r"BD\d{2,10}")` (176–187).
  - The loop (`ask()`, lines 204–230), exactly:
    ```python
    for _ in range(MAX_STEPS):
        r = client.beta.messages.create(model=MODEL, max_tokens=4000, system=SYSTEM, tools=TOOLS, messages=messages,
                                        output_config={"effort": "low"}, betas=["server-side-fallback-2026-07-01"], fallbacks="default")
        if r.stop_reason == "refusal":
            return {"question": question, "answer": None, "blocked": True, "reason": "refusal", "tools": calls}
        uses = [b for b in r.content if b.type == "tool_use"]
        if not uses:
            text = "".join(b.text for b in r.content if b.type == "text").strip()
            bad = guard(text, [c["result"] for c in calls])
            return {"question": question, "answer": None if bad else text, "blocked": bool(bad), "unsupported": bad, "tools": calls}
        messages.append({"role": "assistant", "content": r.content})   # the WHOLE content, thinking/fallback blocks included
        ...  # run each tool via _run, append tool_result blocks (is_error when "error" in result) as one user message
    return {..., "blocked": True, "reason": f"step limit {MAX_STEPS}", ...}
    ```
  - The guard: `numbers()` reads Bangla digits and compares by value;
    `guard(answer, results)` allows a number if it appears in
    `json.dumps(result)` of ANY tool result (lines 194–201).
- Porting is not all one-liners: `area_fire_calendar` (ask.py:97-110) calls
  `kilnwatch.research.calendar_len` (`research.py:35`), which depends on
  `calendar_daily` (`research.py:40-60`) and `DAY0 = 2003-01-01`
  (`research.py:21`). Port those helpers too, and give them goldens of
  their own.
- The same guard already exists in TypeScript:
  `web/src/lib/geminiPrompt.ts` — `NUM`, `toLatin`, `numbers`,
  `unsupportedNumbers(answer, context)` (context is a string; pass
  `results.map((r) => JSON.stringify(r)).join('\n')`).
- Claude API facts for the port (from the Claude API reference, 2026-10):
  - TypeScript projects call Claude through the official SDK
    `@anthropic-ai/sdk` — **not** raw `fetch`. It runs on Cloudflare Workers.
  - The matching call:
    ```ts
    const r = await client.beta.messages.create({
      model: env.MODEL ?? 'claude-opus-5-5', max_tokens: 4000, system: SYSTEM, tools: TOOLS, messages,
      output_config: { effort: 'low' }, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    })
    ```
    `fallbacks: 'default'` must be paired with exactly
    `server-side-fallback-2026-07-01` (the older `-06-01` header is for the
    array form; mixing them is a 400). Claude Opus 5.5's effort default is
    `medium`, so `low` must stay explicit. Do not send `thinking:
    {type: 'disabled'}` or `tool_choice` `any`/`tool` (both 400 on this model).
  - Check `stop_reason === 'refusal'` before reading `content`; append the
    full `r.content` back as the assistant turn (never only the text).
- Public export URL: `https://aalvee-aarham.github.io/kiln-watch/data/…`
  (`README.md:7`).
- Testing conventions: `tests/` may not write tracked files (the contract
  tests were just changed to write fixtures into a temp dir for exactly this
  reason); `tests/test_isolation.py` forbids `data/raw`/`data/interim`
  references; tests assert fixed or recomputed values (CLAUDE.md invariant 8).
- CI (`.github/workflows/ci.yml`): jobs `python` and `web-fixtures`; every
  `uses:` pinned to a 40-char SHA with a `# vX.Y.Z` comment;
  `permissions: { contents: read }` at the top.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Python suite | `python -m pytest -q` (repo root) | all pass |
| Goldens | `PYTHONPATH=. python ask-worker/scripts/make_goldens.py` (repo root, after Step 1) | writes `ask-worker/test/golden/*.json` |
| Web unit | `cd web && npm test -- --run` | all pass |
| Web lint/type | `cd web && npm run lint && npm run typecheck` | exit 0 |
| Worker tests | `cd ask-worker && npm test` (after Step 2) | all pass |
| Worker config | `cd ask-worker && npx wrangler deploy --dry-run` | exit 0 |

## Suggested executor toolkit

- If available, load the `claude-api` skill before writing `agent.ts` (SDK
  call shape, refusal handling, fallbacks).
- Cloudflare Workers docs for the current `wrangler.toml` syntax, secrets
  (`wrangler secret put`), the rate-limiting binding and KV.

## Scope

**In scope** (create unless noted):
- `ask-worker/` — `package.json`, `tsconfig.json`, `wrangler.toml`,
  `src/` (worker, tools, guard, agent), `test/` (unit + parity),
  `test/golden/` (generated), `scripts/make_goldens.py`, `README.md`
  (runbook), `.dev.vars.example`
- `tests/test_ask_goldens.py` — compares, never writes
- `.github/workflows/ci.yml` — one new `ask-worker` job (modify)
- `web/src/lib/askApi.ts`, `web/src/lib/askApi.test.ts`, `web/src/pages/AskPage.tsx` (modify)

**Out of scope**:
- `kilnwatch/ask.py` (source of truth — do not modify)
- `.github/workflows/deploy.yml` (setting `VITE_ASK_ENDPOINT` for the real
  site is a later, explicit change after the operator deploys the worker)
- Accounts, billing, DNS, secrets — HUMAN steps (Step 0)
- Any UI redesign beyond wiring the endpoint and a one-line status

## Git workflow

- Branch `plan-005-hosted-ask`; commits `feat(ask-worker): <...>`.
- No push/PR unless instructed.

## Steps

### Step 0: DECISION GATE (human)

Ask the operator and record the answers in `ask-worker/README.md` §
Decisions: (a) Cloudflare Workers is the host; (b) they will create the
worker and run `wrangler secret put ANTHROPIC_API_KEY`; (c) the **daily
spend cap**: a maximum number of `/ask` questions per UTC day across all
visitors (suggested default: 200); (d) the Pages site must stay fully
working without the worker. If (a)–(d) are not all answered, write the code
but STOP before Step 7 and report.

### Step 1: Golden files from the Python tools (generator + comparison test)

`ask-worker/scripts/make_goldens.py`, run from the repo root as
`PYTHONPATH=. python ask-worker/scripts/make_goldens.py` (`kilnwatch` is not
an installed package; without `PYTHONPATH=.` the import fails). It defines
`build() -> dict[str, list]` and, under `if __name__ == "__main__":`, writes
the files. `build()` calls every name in `kilnwatch.ask.FUNCS` through
`kilnwatch.ask._run` on `Data(C.ROOT / "web/fixtures/full/data")` with a
fixed argument list in a dict at the top of the script, e.g.
`{"find_area": [{"name": "Dhaka"}, {"name": ""}], "area_fire_calendar": [{"unit_id": "BD3026"}, {"unit_id": "BD99"}], "harmonization_evidence": [{}], ...}`
— one happy and one error input for tools that take arguments, and the
single input `{}` for tools that take none (`harmonization_evidence`,
Plan 003's `national_trend`). It writes
`ask-worker/test/golden/<tool>.json` as
`[{"input": ..., "output": ...}]` with `json.dumps(..., sort_keys=True, ensure_ascii=False, indent=1)`.

`tests/test_ask_goldens.py`: load the script by path (its folder name has a
hyphen, so a normal import cannot reach it):
```python
import importlib.util
spec = importlib.util.spec_from_file_location("make_goldens", C.ROOT / "ask-worker" / "scripts" / "make_goldens.py")
mg = importlib.util.module_from_spec(spec); spec.loader.exec_module(mg)
```
then compare `mg.build()` (in memory — write nothing) with each committed
golden file (`json.loads`). The repo's `pythonpath = ["."]` makes
`kilnwatch` importable under pytest. This makes Python-side drift fail
`pytest`; the worker parity tests (Step 4) make TS-side drift fail.

**Verify**: `PYTHONPATH=. python ask-worker/scripts/make_goldens.py` → one JSON per tool;
`python -m pytest tests/test_ask_goldens.py -q` → pass; then
`git diff --stat -- ask-worker/test/golden` is empty (pytest wrote nothing).

### Step 2: Worker skeleton

`ask-worker/package.json` with `"type": "module"`, scripts
`"test": "vitest run"`, dependencies `@anthropic-ai/sdk`, devDependencies
`vitest`, `wrangler`, `typescript`, `@cloudflare/workers-types` (for
`KVNamespace` and the `Env` types; add it to `tsconfig.json` `types`).
Create the lockfile with `npm install` (pin exact versions with
`--save-exact`) and commit `package-lock.json`; use `npm ci` only after it
exists. Add `test/smoke.test.ts` with one test that imports `src/index.ts`
and checks a 400 for an empty body — `vitest run` exits 1 when no test file
exists, so the suite must start with one. `wrangler.toml`: `name = "kiln-watch-ask"`,
`main = "src/index.ts"`, `compatibility_date` = the day you run this,
`[vars] DATA_ORIGIN = "https://aalvee-aarham.github.io/kiln-watch/data"`,
`ALLOWED_ORIGIN = "https://aalvee-aarham.github.io"`, `DAILY_CAP` = the
Step 0 number (if Step 0 is unanswered, `"200"` with the comment
`# PROPOSED, not yet approved`); one KV namespace binding `SPEND` (daily
counter and per-IP counter) with `id = "REPLACE_WITH_KV_NAMESPACE_ID"` and a
comment that the operator fills it in Step 8 — the namespace does not exist
until a person creates it.
`src/index.ts`: a single `POST /ask` handler, body `{question: string}`;
reject non-JSON content type, a non-string, empty, or longer-than-500-char
question with 400.

**Verify**: `cd ask-worker && npm install && npm test` → 1 passed;
`npx wrangler deploy --dry-run --outdir dist` → exit 0 (dry-run does not
contact Cloudflare; if it rejects the placeholder KV id, STOP and report the
message verbatim).

### Step 3: Port tools, guard and loop

> Amended at implementation (2026-10-12): `SYSTEM`, `TOOLS`, `MODEL` and `MAX_STEPS` are not hand-copied but
> generated into `ask-worker/src/spec.json` by `make_goldens.py`, and `tests/test_ask_goldens.py` fails if they drift.
> Goldens cover three datasets (`full`, `nokiln`, and `nokiln_nov` with the live series set to 31 October) so the
> outlook's "on" branch is pinned too.

- `src/tools.ts` — one exported function per Python tool. Each fetches its
  export file(s) from `env.DATA_ORIGIN` with
  `AbortSignal.timeout(10_000)`, returns the same shape as Python
  (provenance included; `{error: ...}` on missing data), and the same
  argument validation as `_run` (`/^BD\d{2,10}$/` for `unit_id`).
- `src/guard.ts` — copy `NUM`, `toLatin`, `numbers`, `unsupportedNumbers`
  from `web/src/lib/geminiPrompt.ts` (a short copy beats a cross-package
  import into a new build).
- `src/agent.ts` — the loop with `new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })`
  and the exact `client.beta.messages.create({...})` call from Current
  state; `SYSTEM` copied verbatim from `ask.py:30-38`; `TOOLS` schemas
  copied from `ask.py`; at most 6 calls; `refusal` → `{blocked: true,
  reason: 'refusal'}`; step cap → `{blocked: true, reason: 'step limit 6'}`;
  assistant turn = full `r.content`; tool results in one user message with
  `is_error: true` when the result has `error`; final text guarded against
  all tool results.

**Verify**: `cd ask-worker && npx tsc --noEmit` → exit 0.

### Step 4: Parity and loop tests

- `test/parity.test.ts`: for each golden file, mock `fetch` to serve files
  from `../web/fixtures/full/data` (read from disk), run the TS tool on each
  golden `input`, and `expect(result).toEqual(golden.output)`.
- `test/agent.test.ts`: a scripted fake client (the shape of
  `tests/test_ask.py`'s `_client`) covering: happy path, invented number
  blocked, refusal, step cap at 6, unknown tool → `{error: 'unknown tool X'}`.
  Assert the request carries `betas: ['server-side-fallback-2026-07-01']`,
  `fallbacks: 'default'`, `output_config: { effort: 'low' }`.

**Verify**: `cd ask-worker && npm test` → all green. Then break one golden
value by hand, confirm a parity test fails, and revert.

### Step 5: CORS, rate limit, spend cap, error surface

- CORS: `Access-Control-Allow-Origin` = `env.ALLOWED_ORIGIN` only;
  `OPTIONS` preflight handled; any other `Origin` → 403.
- Per-IP rate limit: a counter in the same `SPEND` KV namespace keyed
  `ip:<CF-Connecting-IP>:<UTC hour>`, at most 30 requests per IP per hour,
  `expirationTtl: 7200`. (One mechanism, no extra binding; KV is eventually
  consistent, so the limit is approximate — acceptable for abuse damping,
  and the daily cap below is the hard money guard.)
- **Daily spend cap**: a KV counter keyed by UTC date; once it reaches
  `DAILY_CAP`, return 429 `{error: "daily limit reached; the saved answers
  below still work"}` without calling Anthropic. (A per-IP limit alone is
  trivial to bypass on a public endpoint paid for with the project's key.)
- Anthropic/key errors → 503 `{error: "ask backend unavailable"}` with no
  internal detail; log only status codes and tool names.

**Verify**: unit tests — disallowed origin → 403; 501-char question → 400;
cap reached → 429 and the fake client was not called; missing key → 503.

### Step 6: CI job

Add to `.github/workflows/ci.yml` a job `ask-worker` (pinned
`actions/checkout@08eba0b27e820071cde6df949e0beb9ba4906955  # v4.3.0` and
`actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.4.0`,
`working-directory: ask-worker`, `npm ci && npx tsc --noEmit && npm test`).
The Python job already runs `tests/test_ask_goldens.py`.

**Verify**: `uv run --no-project -q --with pyyaml python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('ok')"` → `ok`;
`grep -c "uses: actions/[a-z-]*@[0-9a-f]\{40\}" .github/workflows/ci.yml` equals the number of `uses:` lines.

### Step 7: Wire the web page

`web/src/lib/askApi.ts`: `askLive(question)` posts to
`import.meta.env.VITE_ASK_ENDPOINT` (an empty or unset value = disabled →
returns `null`; it is a public URL, never a key) and returns a union:
`{ok: true, answer, blocked, unsupported?, reason?, tools}` on 200, or
`{ok: false, status, message}` for any other status, where `message` is the
worker's `error` string (for 429, "daily limit reached; the saved answers
below still work"). The page shows `message` in a `StatusMessage`. `AskPage.tsx`: when the
endpoint is set, the live panel uses it and renders `tools` exactly as the
cached path does (`AskPage.tsx` "The data behind this answer" `<details>`);
a "use my own Gemini key" switch keeps Plan 001's path. With no endpoint the
page behaves exactly as today.

`web/src/lib/askApi.test.ts` (a `.test.ts` file — `.tsx` tests are not
collected): endpoint unset → `null` and no fetch; a 200 blocked response →
`{ok: true, blocked: true, unsupported: [...]}`; a 429 with body
`{error: "daily limit reached; the saved answers below still work"}` →
`{ok: false, status: 429, message: <that string>}`.

**Verify**: `cd web && npm run lint && npm run typecheck && npm test -- --run`
→ green; `DATA_SRC=fixtures FIXTURE_BRANCH=nokiln npm run build && npm run e2e`
→ green (the endpoint is unset there).

### Step 8: Deploy runbook

`ask-worker/README.md`: the Step 0 decisions; create the worker and KV
namespace; `wrangler secret put ANTHROPIC_API_KEY`; deploy; then (a later,
separate change) set `VITE_ASK_ENDPOINT` in the Pages build; cost notes
(up to 6 Opus calls per question at low effort × `DAILY_CAP`); how to
disable (unset the variable → the site reverts to cached answers and BYO
key).

**Verify**: `grep -c "wrangler secret put" ask-worker/README.md` → ≥ 1.

## Test plan

- Python: `tests/test_ask_goldens.py` (in-memory regeneration = committed goldens).
- Worker: parity vs goldens for every tool; loop behaviour incl. request
  parameters; CORS, limits, spend cap and error shapes.
- Web: `askApi.test.ts` with mocked fetch.
- Full suites stay green: `python -m pytest -q`, web lint/typecheck/test/build/e2e.

## Done criteria

- [ ] `cd ask-worker && npm test` green — parity for EVERY name in `kilnwatch.ask.FUNCS`
- [ ] `python -m pytest -q` green and writes no tracked file (`git status` clean after it)
- [ ] `ci.yml` has a pinned `ask-worker` job; YAML parses
- [ ] Web suites green; the nokiln build behaves as before without `VITE_ASK_ENDPOINT`
- [ ] `grep -rnE --exclude-dir=node_modules "sk-ant-[A-Za-z0-9]" ask-worker web/src` → no matches (no key values anywhere)
- [ ] `ask-worker/README.md` has the runbook and the Step 0 decisions
- [ ] `plans/README.md` row updated

## STOP conditions

- Step 0 decisions missing (stop before Step 7).
- A Python tool cannot be expressed in TS without changing its output shape
  — report the tool; do not change `ask.py`.
- Parity fails on genuinely volatile data (e.g. a timestamp): exclude that
  field in the golden builder and note it; if more than one field is
  volatile, STOP.
- `@anthropic-ai/sdk` does not run under the Workers runtime, or the API
  rejects `fallbacks: 'default'` with the `-2026-07-01` beta — report the
  error verbatim; do not switch to raw `fetch` or another provider.

## Maintenance notes

- New tools MUST land in both `kilnwatch/ask.py` and
  `ask-worker/src/tools.ts`, with the golden argument list extended — the
  goldens test and parity suite enforce it in CI.
- If `MODEL` changes, re-check the Claude API reference for that model's
  effort default and refusal/fallback form before editing `agent.ts`.
- Reviewer: scrutinise CORS, the 500-char cap, the daily cap, and that tools
  only ever fetch paths under `DATA_ORIGIN` (the public export is the
  privacy guarantee).
