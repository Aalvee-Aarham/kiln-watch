# Plan 005: Hosted live Ask worker — refined as-built

> Refinement of `plans/005-hosted-live-ask-worker.md`, verified against HEAD
> `2f0b5eb` on 2026-10-21. Code-complete and CI-tested; **never deployed**
> (the KV namespace id in `wrangler.toml` is still the placeholder). The
> Gemini migration (`a4b0bf7`) replaced the plan's `@anthropic-ai/sdk`
> design with the Gemini REST API.

## Status

- **DONE (code)** — commit `6694e65` (worker + parity), review fixes in
  `fa5deee` (daily cap fails closed → 503, `Object.hasOwn` on tool lookup,
  200-without-tools crash), Gemini migration in `a4b0bf7`.
- **PENDING (operator)** — the deploy runbook in `ask-worker/README.md` has
  not been executed: `wrangler.toml` still has
  `id = "REPLACE_WITH_KV_NAMESPACE_ID"`.

## What shipped (verified 2026-10-21)

- `ask-worker/` — `src/agent.ts` (bounded 6-call tool loop on Gemini REST
  `generateContent` with function calling; `buildRequest` sends
  `systemInstruction`, `toolConfig.mode: 'AUTO'`, `maxOutputTokens: 4000`),
  `src/tools.ts` (one port per Python tool, same shapes + provenance),
  `src/guard.ts` (the `numbers`/`unsupportedNumbers` guard),
  `src/spec.json` (**generated** from `kilnwatch/ask.py` by
  `scripts/make_goldens.py` — SYSTEM, tool declarations, refusals — so the
  worker cannot drift from the Python agent silently), `src/index.ts`
  (POST /ask, CORS to `ALLOWED_ORIGIN` only, 400/429/503 surfaces).
- `tests/test_ask_goldens.py` (main suite) regenerates goldens in memory and
  compares — pytest writes no tracked files.
- `.github/workflows/ci.yml` — a dedicated `ask-worker` job (line 35,
  `npm ci && tsc --noEmit && vitest`).
- `web/src/lib/askApi.ts` — `ASK_ENDPOINT = import.meta.env.VITE_ASK_ENDPOINT ?? ''`
  (line 4); unset = disabled, page behaves exactly as before.
- `wrangler.toml` — `DAILY_CAP = "200"` (**approved 2026-10-12**, recorded
  inline); KV binding `SPEND` for daily + per-IP counters.
- Tests today: `cd ask-worker && npm test` → **43 passed** (4 files).

## Deltas from the written plan

- **No `@anthropic-ai/sdk`**: `a4b0bf7` moved the worker (with the rest of
  the project) to the Gemini REST API, mirroring `ask.py`'s
  `gemini_client()`. The plan's SDK/beta-headers guidance is obsolete.
- `SYSTEM`/`TOOLS` are not hand-copied but generated into `spec.json` —
  stronger than the plan's Step 3.
- The daily cap **fails closed** (503) on a missing/malformed `DAILY_CAP`
  (review fix `fa5deee`), where the plan only failed open.

## Verify today

```bash
cd ask-worker && npm test && npx tsc --noEmit   # 43 passed; exit 0
python -m pytest tests/test_ask_goldens.py -q    # in the 204, writes nothing
```

## Follow-ups (operator runbook, `ask-worker/README.md`)

1. `npx wrangler kv namespace create SPEND` → paste the id into
   `wrangler.toml` (replaces the placeholder).
2. `npx wrangler secret put GEMINI_API_KEY` (README lines 10 and 51).
3. `npx wrangler deploy`; smoke-test from the Pages origin.
4. Separately, set `VITE_ASK_ENDPOINT` in the Pages build to light the
   endpoint up on the site (the static site never depends on the worker).

## Maintenance notes

- New tools must land in both `ask.py` and `ask-worker/src/tools.ts` with
  golden arguments extended — CI enforces parity for every `FUNCS` name.
- Cost: up to 6 flash-lite calls per question × `DAILY_CAP` 200/day.
