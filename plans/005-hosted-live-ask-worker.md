# Plan 005: Hosted live Ask — a small Cloudflare Worker that runs the agent server-side

> **Executor instructions**: Follow this plan step by step; verify each step
> before moving on. This plan contains an explicit DECISION GATE (Step 0) —
> if the human operator has not made that decision, STOP there. Update
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat c053cfa..HEAD -- kilnwatch/ask.py web/src/pages/AskPage.tsx web/src/lib/geminiPrompt.ts`
> The `ask.py` excerpts (tools, guard, loop) are the source of truth you are
> porting; if they drifted, STOP.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED (new runtime, new key handling; mitigated by parity tests
  and the static fallback)
- **Depends on**: Plan 002 (eval table), Plan 003 (final tool set), Plan 001
  (shared request helpers)
- **Category**: direction
- **Planned at**: commit `c053cfa`, 2026-10-11

## Why this matters

Today "Ask Kiln Watch" is either a visitor-supplied Gemini key (demo mode)
or a frozen cache. The roadmap itself lists the AI hosting/key as an open
human decision (docs/roadmap.md:20, F7). A tiny Cloudflare Worker closes
it: the site's own agent (tools + guard + step cap) runs server-side with
the project's Anthropic key, rate-limited, CORS-locked to the Pages origin,
while the static cached answers and BYO-key chat remain as fallbacks — the
static site never depends on the worker being up. The guard already exists
in TypeScript (`unsupportedNumbers`), and the tools read only the static
export the site itself serves, so the port is mechanical and
parity-testable.

## Current state

- The Python agent to port — `kilnwatch/ask.py` (243 lines at `c053cfa`):
  - `SYSTEM` prompt (line 30), `MAX_STEPS = 6` (21), `MODEL` (20).
  - Tool functions (5 at `c053cfa`, more after Plan 003): each reads one or
    more files from the public export dir and returns a dict with a
    `provenance` sub-dict; absent data → `{"error": ...}`.
  - The loop (`ask()`, line 204): messages array, tool_use blocks →
    `_run` → `tool_result` (with `is_error` when the result has an "error"
    key) → repeat until text; guard the final text.
  - The guard: `numbers()` + `guard()` (lines 190–201) — ported to TS
    already at `web/src/lib/geminiPrompt.ts:25-33` (`NUM`, `toLatin`,
    `numbers`, `unsupportedNumbers`) with a test file beside it.
- `web/src/pages/AskPage.tsx` — the page; after Plan 001 it has
  `buildGeminiRequest`/`extractText` helpers and a facts panel. The worker
  endpoint will slot in as a preferred source with Gemini kept as fallback.
- The public export the tools read is served at
  `https://aalvee-aarham.github.io/kiln-watch/data/...` (calendars,
  `nrt/current_season.json`, `harmonization.json`, `kiln_activity.json`,
  `meta.json`…). Tools can fetch from there (or an env-configured mirror).
- Tests: Python parity pattern
  `tests/test_ask.py:70` (`test_outlook_tool_matches_the_web_rule_at_the_window_start`)
  pins the Python tool against `web/src/lib/outlook.test.ts`. The same
  pattern extends to worker tools.
- No `web/src/lib/` code may contain grid literals (CLAUDE.md invariant 10);
  worker tools read `meta.json` like `box.ts` does when they need geometry.
- Conventions: atomic writes N/A (stateless worker); every fetch path needs
  a timeout; no unbounded loops — port `MAX_STEPS` exactly.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Python suite (parity goldens) | `python -m pytest -q` (repo root) | all pass |
| Web unit | `cd web && npm test -- --run` | all pass |
| Web lint/type | `cd web && npm run lint && npm run typecheck` | exit 0 |
| Worker tests | `cd ask-worker && npm test` (set up in Step 2) | all pass |
| Worker local | `cd ask-worker && npx wrangler dev` + curl | 200 JSON (needs key in `.dev.vars`) |

## Suggested executor toolkit

- Use the `typescript-best-practices` skill when writing worker code.
- Cloudflare Workers docs: fetch handler, `wrangler.toml`, secrets
  (`wrangler secret put ANTHROPIC_API_KEY`), rate limiting via the
  `ratelimit` binding (free tier) — check current syntax with context7
  (`/cloudflare/workers-sdk` or workers docs) before writing config.

## Scope

**In scope** (create):
- `ask-worker/` — new top-level directory: `wrangler.toml`, `package.json`,
  `tsconfig.json`, `src/` (worker + tools), `test/` (parity tests),
  `README.md` (deploy runbook), `.dev.vars.example`
- `web/src/lib/askApi.ts` (create) + `web/src/pages/AskPage.tsx` (wire-in)
- `web/src/lib/askApi.test.ts` (create)

**Out of scope**:
- `kilnwatch/ask.py` (source of truth — do not modify)
- `.github/workflows/*` (worker deploys via wrangler, not GH Actions; a CI
  job can come later)
- Any UI redesign beyond wiring the endpoint + a small status line.
- Accounts/billing: creating the Cloudflare account, DNS, or the secret is
  a HUMAN step (Step 0 lists them).

## Git workflow

- Branch `plan-005-hosted-ask`; commits `feat(ask-worker): <...>`.
- No push/PR unless instructed.

## Steps

### Step 0: DECISION GATE (human)

Record in `ask-worker/README.md` § Decisions: the operator has (a) chosen
Cloudflare Workers (free tier) as the host, (b) will create the worker and
set `ANTHROPIC_API_KEY` via `wrangler secret put`, (c) accepted that the
Pages site stays fully functional without the worker. If any of these is
unanswered, STOP and report — the code below can be written, but the plan
is not complete without the operator's sign-off.

### Step 1: Golden files from the Python tools

Add `tests/test_ask_goldens.py`: for each tool (all registered in
`kilnwatch.ask.FUNCS`) run it against `web/fixtures/full/data` on a fixed
set of inputs (the `national`/`BD3026`-style args each tool takes; enumerate
them in the test) and write `ask-worker/test/golden/<tool>.json` (sorted
keys). Assert the files are deterministic across two runs in-process
(closed-form: same dict twice). This makes drift in either implementation
visible: re-running regenerates and CI diffs.

**Verify**: `python -m pytest tests/test_ask_goldens.py -q` → green; `ls
ask-worker/test/golden/` shows one JSON per tool.

### Step 2: Worker skeleton

`ask-worker/` with `wrangler.toml` (name `kiln-watch-ask`, compatibility
date today, no custom domain yet), TypeScript, `npm init` + `vitest` +
`wrangler` as devDependencies, `"test": "vitest run"`. The worker exposes a
single `POST /ask` handler: body `{question: string}`; it must reject
`question.length > 500`, non-strings, and wrong content types with 400.

**Verify**: `cd ask-worker && npm test` → trivially green; `npx wrangler
deploy --dry-run` → config parses.

### Step 3: Port tools + guard + loop to TypeScript

`ask-worker/src/tools.ts` — one exported function per Python tool; each
fetches its export file(s) from `env.DATA_ORIGIN`
(`https://aalvee-aarham.github.io/kiln-watch/data` default) with a 10s
`AbortSignal.timeout`, returns the same shape as the Python tool
(provenance included, `error` dicts on missing data). `ask-worker/src/guard.ts`
— re-export the algorithm by copying `web/src/lib/geminiPrompt.ts`
`numbers`/`unsupportedNumbers` (a 10-line file; copying beats a cross-package
import into a new build). `ask-worker/src/agent.ts` — the loop: system
prompt copied verbatim from `ask.py:30-38`, the Anthropic Messages API via
plain `fetch` (model from env `MODEL` default `claude-opus-5-5`, max 6
steps, tool schemas ported from `ask.py` TOOLS), `tool_result` with
`is_error` exactly as Python does, final answer guarded; refusal and
step-cap returned as structured `{blocked: true, reason}`.

**Verify**: `cd ask-worker && npm test` → green after Step 4.

### Step 4: Parity tests

`ask-worker/test/parity.test.ts`: for each golden file, run the TS tool
against a local file server serving `web/fixtures/full/data` (vitest
`beforeAll` static server or `msw`-style fetch mock reading the fixture
files from disk) and `expect(JSON.parse(JSON.stringify(result)))` deep-equals
the golden (key order irrelevant; sort where Python sorts).

**Verify**: `cd ask-worker && npm test` → all parity green. Then
deliberately break one expectation (temporarily) to prove the test fails,
revert.

### Step 5: Rate limit + CORS + error surface

In the worker: CORS `Access-Control-Allow-Origin` = `env.ALLOWED_ORIGIN`
(the Pages URL) only; `OPTIONS` preflight handled; per-IP rate limit (the
Cloudflare `ratelimit` binding, or a simple 30-requests/hour map when the
binding is unavailable on the plan used — note which in README);
Anthropic/key errors → 503 with `{error: "ask backend unavailable"}` and
NO internal detail (data-minimisation). Log nothing but status codes and
tool names.

**Verify**: unit tests: disallowed origin → 403; oversize question → 400;
missing key env → 503 shape.

### Step 6: Wire the web page

`web/src/lib/askApi.ts`: `askLive(question): Promise<{answer, blocked,
unsupported?, reason?, tools}>` posting to
`import.meta.env.VITE_ASK_ENDPOINT` (empty string = disabled; NEVER a
key — only the public endpoint URL). `AskPage.tsx`: if the endpoint is
configured, the live panel uses it (showing the same "The data behind this
answer" tool trace as the cached path — render `tools` exactly like lines
135-140 do); a "demo model" toggle falls back to the Gemini BYO path.
Builds without `VITE_ASK_ENDPOINT` must behave exactly as today (fixture
builds gate this — no env var in CI).

**Verify**: `cd web && npm run lint && npm run typecheck && npm test --
--run` → green; `DATA_SRC=fixtures FIXTURE_BRANCH=full npm run build` →
exit 0 and the ask page renders (e2e: `npm run e2e` still green — the
endpoint is unset there).

### Step 7: Deploy runbook

`ask-worker/README.md`: create worker, `wrangler secret put
ANTHROPIC_API_KEY`, set `ALLOWED_ORIGIN`, deploy, set
`VITE_ASK_ENDPOINT` in the Pages deploy workflow (a later, explicit change
to `deploy.yml` — do NOT edit deploy.yml in this plan), cost notes (free
tier limits), and how to disable (unset the env → site reverts to
BYO/cache).

**Verify**: `grep -c "wrangler secret put" ask-worker/README.md` ≥ 1.

## Test plan

- Goldens (Step 1) + parity (Step 4) — the core safety net.
- Worker unit tests: validation, CORS, rate-limit, error shapes (Step 5).
- Web: `askApi.test.ts` mocks fetch — endpoint disabled → returns null;
  blocked answer → surfaces `unsupported` numbers (fixed expected values).
- Full suites stay green: `python -m pytest -q`, web
  lint/typecheck/test/build.

## Done criteria

- [ ] `cd ask-worker && npm test` green — parity vs goldens for EVERY tool in `kilnwatch.ask.FUNCS`
- [ ] `python -m pytest -q` green (goldens deterministic)
- [ ] Web suites green; fixture build unchanged without `VITE_ASK_ENDPOINT`
- [ ] `grep -rn "ANTHROPIC" ask-worker/src web/src` finds no key VALUE anywhere (names in README/.dev.vars.example only)
- [ ] `ask-worker/README.md` has the runbook + Step 0 decisions recorded
- [ ] `plans/README.md` row updated

## STOP conditions

- Step 0 decisions not made.
- A Python tool cannot be expressed in TS within ~1.5× its Python size
  (indicates a data-shape assumption wrong — report the tool).
- Parity fails on data that is genuinely non-deterministic (timestamps in
  `generated_at`): exclude volatile fields explicitly in the golden writer
  and note it — if more than one field is volatile, STOP.
- The Anthropic API from a Worker requires a paid feature — report; do not
  quietly switch APIs.

## Maintenance notes

- New tools (Plan 003+) MUST land in both `kilnwatch/ask.py` and
  `ask-worker/src/tools.ts` with goldens extended — the parity suite
  enforces it.
- Reviewer: scrutinise CORS, the 500-char cap, and that no tool result
  beyond area-level public data can reach the answer (the export itself is
  the guarantee — tools must only ever read `data/` paths from the public
  export).
