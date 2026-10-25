# Plan 001: Gemini live-chat hardening — refined as-built

> Refinement of `plans/001-gemini-live-chat-hardening.md`, verified against
> HEAD `2f0b5eb` on 2026-10-21. The written plan is accurate except where
> noted under "Deltas". No executable work remains.

## Status

- **DONE** — commit `832fae2` ("fix(ask): send Gemini instructions as
  system_instruction, fall back on retired models, show the facts").
- Later evolution (not part of this plan, but it touched the same files):
  `aa19661` and `50e8b10` adjusted `GEMINI_MODELS`; `9df1a4e` and the
  agent-stage work (`8f1c9a6`, `da3767c`) rebuilt the Ask page around saved
  questions with traced figures.

## What shipped (verified 2026-10-21)

- `web/src/lib/geminiPrompt.ts` — pure helpers as planned:
  `GEMINI_MODELS` at line 62, `askGemini(fetchFn, …)` at line 80.
  Instructions travel as `system_instruction`; the guard still receives the
  full `sys` string as allowed context.
- `web/src/pages/AskPage.tsx` — uses `askGemini`; no `User Question`
  concatenation; the facts panel mirrors the cached path's
  "The data behind this answer" `<details>`.
- Tests live in `web/src/lib/geminiPrompt.test.ts` (the only Vitest-collected
  glob is `src/**/*.test.ts`, `web/vite.config.ts:49`); no `.test.tsx` files
  exist under `web/src/pages/`.

## Deltas from the written plan

- **The model list grew to four ids** (`geminiPrompt.ts:62`):
  `gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`, `gemini-3.8-flash`,
  `gemini-2.5-flash-lite`. The plan specified two; model churn within a week
  (`aa19661` → `50e8b10`) is exactly why the fallback list exists.
- The plan's `generationConfig: { maxOutputTokens: 1024 }` ships as
  specified; the backend agent and the worker use 4000 — the three surfaces
  chose deliberately, not by drift.

## Verify today (from `web/`)

```bash
npm run lint && npm run typecheck && npm test -- --run   # all green at this HEAD
grep -c "User Question" src/pages/AskPage.tsx            # 0
ls src/pages/*.test.tsx 2>/dev/null | wc -l              # 0
```

## Follow-ups

- None in code. Process rule to keep: check ids against
  ai.google.dev/gemini-api/docs/models before editing `GEMINI_MODELS`, and
  note the backend agent model (`kilnwatch/ask.py:21`) and the worker spec
  are chosen independently — change them together, on purpose.

## Maintenance notes

- The Ask page has since evolved (saved Q&A, agent stage); `askGemini`
  stayed pure and shared, which was this plan's structural goal.
- When Plan 005's worker is deployed and `VITE_ASK_ENDPOINT` is set, the
  BYO-key path this plan hardened remains the fallback.
