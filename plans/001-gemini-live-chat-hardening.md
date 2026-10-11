# Plan 001: Harden the Gemini live chat — prompt separation, transparency, model fallback, tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c053cfa..HEAD -- web/src/pages/AskPage.tsx web/src/lib/geminiPrompt.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug / security / tests
- **Planned at**: commit `c053cfa`, 2026-10-11

## Why this matters

The live chat on `#/ask` concatenates the system prompt and the visitor's
question into a single user turn (`AskPage.tsx:63`), so a crafted question
("ignore previous instructions…") can override the instructions. The blast
radius is small (the visitor fools only themselves, and the numeric guard
still blocks invented numbers), but the Gemini API offers a proper
`system_instruction` field — the fix is one edit. Second, the live path shows
none of the facts behind an answer while the cached path shows a full tool
trace — an honesty asymmetry that violates the product's own principle
("every number can be traced", `docs/PRODUCT.md:17`). Third, the model id is
hardcoded into the fetch URL; when Google retires it the page dies with a
bare "API error: 404".

## Current state

- `web/src/pages/AskPage.tsx` — the whole live chat. Relevant excerpt
  (the fetch, lines 60–67):

```ts
const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, // a header, so the key never lands in URL logs
  body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: sys + '\n\nUser Question: ' + q }] }] })
})
if (!res.ok) throw new Error(`API error: ${res.status}`)
const data = await res.json()
const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No answer returned.'
```

  The answer is rendered at line 97 with no provenance:
```tsx
{ans && <div className="prose-measure whitespace-pre-wrap rounded-[6px] bg-surface-2 p-3 text-sm">{ans}</div>}
```

  The `facts` object is built at lines 51–57 (`districtName`, `fireSeasonMonths`,
  `unusualDaysThisSeason`, `kilnSeason`, `currentSeason`).

- `web/src/lib/geminiPrompt.ts` — `buildSystemPrompt(facts)`,
  `numbers(text)`, `unsupportedNumbers(answer, context)` (the guard; keep
  using `sys` as the allowed-context — the system prompt contains every
  number the answer may state, so passing it unchanged stays correct after
  the wire-format change).
- Cached-path pattern to mirror for transparency: `AskPage.tsx:135-140`
  (`<details><summary>The data behind this answer …</summary>` with a
  `<pre>` of JSON).
- Testing pattern: `web/src/lib/geminiPrompt.test.ts` (plain Vitest, no
  framework tricks). No component test exists for `AskPage` yet; you will
  add one with a mocked `global.fetch`.
- Conventions (from `CLAUDE.md`): no grid literals in TS; tests assert
  fixed expected values, never current output; `web/` never holds kiln-level
  data (the facts object is district-level — safe).

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---|---|---|
| Install | `cd web && npm ci` | exit 0 |
| Lint | `cd web && npm run lint` | exit 0 |
| Typecheck | `cd web && npm run typecheck` | exit 0 |
| Unit tests | `cd web && npm test -- --run` | all pass |
| Build (fixture) | `cd web && DATA_SRC=fixtures FIXTURE_BRANCH=full npm run build` | exit 0, dist/ emitted |

## Scope

**In scope** (the only files you should modify):
- `web/src/pages/AskPage.tsx`
- `web/src/lib/geminiPrompt.ts` (only if the model list helper belongs there)
- `web/src/pages/AskPage.test.tsx` (create)

**Out of scope**:
- `web/src/lib/geminiPrompt.test.ts` — already green; extend only if a new
  exported helper demands it.
- The cached-answers rendering path (lines 121–145) — it is the reference
  pattern, do not restyle it.
- Any Python file, any workflow file, `ask.json` handling.

## Git workflow

- Branch: `plan-001-gemini-hardening` off the current working branch.
- Commit style (match `git log --oneline -10`, e.g. `fix(ui): preserve icon
  dimensions when overriding classes`): one commit per step,
  `fix(ask): <what changed>`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Send the system prompt as `system_instruction`

In `AskPage.tsx` `askModel`, change the request body to:

```ts
body: JSON.stringify({
  system_instruction: { parts: [{ text: sys }] },
  contents: [{ role: 'user', parts: [{ text: q }] }],
  generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
})
```

Keep the `x-goog-api-key` header exactly as is. Keep
`unsupportedNumbers(text, sys)` unchanged (same `sys` string, same behaviour).

**Verify**: `cd web && npm run typecheck` → exit 0.

### Step 2: Model fallback list with a clear 404 message

Add near the top of `AskPage.tsx` (module scope):

```ts
const GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.1-flash']
```

Wrap the fetch in a loop over `GEMINI_MODELS`: try each model in order; on
`res.status === 404` continue to the next; on success break; if every model
404s, throw
`new Error('Google retired the models this page uses — the cached answers below still work.')`.
Other non-OK statuses throw immediately (do not retry them).

**Verify**: `cd web && npm run typecheck && npm run lint` → both exit 0.

### Step 3: Show the facts behind a live answer

After a successful answer (the non-blocked branch of `setAns`), also render
the facts, mirroring the cached path's `<details>` pattern:

```tsx
<details className="text-sm">
  <summary className="cursor-pointer text-orbit">The data behind this answer</summary>
  <pre className="mt-1 max-h-64 overflow-auto rounded-[6px] bg-surface-2 p-2 text-xs">{JSON.stringify(facts, null, 1)}</pre>
</details>
```

Keep it inside the same answer container so it appears/disappears with the
answer. Store `facts` in state (e.g. `const [shownFacts, setShownFacts] =
useState<Facts | null>(null)`) so React re-renders don't lose it.

**Verify**: `cd web && DATA_SRC=fixtures FIXTURE_BRANCH=full npm run build`
→ exit 0; then `npm run dev` and on `#/ask` enter any key, ask a question —
the blocked or answered card renders, and the details block lists the five
facts. (Manual check; the automated check is Step 4.)

### Step 4: Component test with a mocked fetch

Create `web/src/pages/AskPage.test.tsx`. Model it on the direct style of
`web/src/lib/geminiPrompt.test.ts` plus React Testing Library if already a
dependency (`grep '"@testing-library' web/package.json`); **if React Testing
Library is NOT a dependency, do not add it** — instead extract the pure
request/response logic (`buildGeminiRequest(sys, q)` and
`extractText(data)`) into `geminiPrompt.ts` and unit-test those, leaving the
component untested. Do not add dependencies.

Cases to cover (fixed expected values):
1. `buildGeminiRequest` puts `sys` only in `system_instruction` and `q` only
   in `contents` (assert the exact JSON shape).
2. Model loop: first model returns 404, second returns
   `{candidates:[{content:{parts:[{text:'March is the peak.'}]}}]}` →
   answer text is `'March is the peak.'` and the second URL was called.
3. All models 404 → error message contains "cached answers below still work".
4. Guard integration: response text `'About 40% more fire.'` with a context
   lacking 40 → `unsupportedNumbers` returns `[40]` (this case may already
   exist in `geminiPrompt.test.ts`; if so, reference it instead of
   duplicating).

**Verify**: `cd web && npm test -- --run` → all pass including the new file;
`npm run lint && npm run typecheck` → exit 0.

## Test plan

Covered by Step 4. Structural pattern: `web/src/lib/geminiPrompt.test.ts`
(plain imports, `describe`/`it`/`expect`, fixed expected values only —
CLAUDE.md invariant 8).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd web && npm run lint` exits 0
- [ ] `cd web && npm run typecheck` exits 0
- [ ] `cd web && npm test -- --run` passes, including new tests for the
      request shape, model fallback and the facts display logic
- [ ] `grep -n "sys + '\\\\n\\\\nUser Question:'" web/src/pages/AskPage.tsx`
      returns nothing (the concatenation is gone)
- [ ] `grep -n "system_instruction" web/src/pages/AskPage.tsx` returns ≥1
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts under "Current state" don't match the live code (drift).
- The Gemini v1beta REST schema rejects `system_instruction` in a way the
  plan can't express (report the API error verbatim instead of inventing a
  workaround).
- Adding the tests appears to require a new npm dependency.

## Maintenance notes

- When Plan 005 (hosted worker) lands, `LiveChat` gains an alternative
  backend; keep `buildGeminiRequest`/`extractText` pure so both paths share
  them.
- Reviewer: confirm the guard still receives the full `sys` string as
  allowed-context (Step 1 keeps it — check `unsupportedNumbers(text, sys)`).
