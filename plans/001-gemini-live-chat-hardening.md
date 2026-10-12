# Plan 001: Harden the Gemini live chat — prompt separation, transparency, model fallback, tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 98fa82a..HEAD -- web/src/pages/AskPage.tsx web/src/lib/geminiPrompt.ts web/src/lib/geminiPrompt.test.ts web/vite.config.ts`
> If any file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug / security / tests
- **Planned at**: commit `98fa82a`, 2026-10-12 (first written 2026-10-11; reviewed and corrected against live code)

## Why this matters

The live chat on `#/ask` concatenates the system prompt and the visitor's
question into a single user turn (`AskPage.tsx:63`), so a crafted question
("ignore previous instructions…") can override the instructions. The blast
radius is small (the visitor fools only themselves, and the numeric guard
still blocks invented numbers), but the Gemini API has a proper
`system_instruction` field. Second, the live path shows none of the facts
behind an answer while the cached path shows a full tool trace — an honesty
gap against the product's own principle ("every number can be traced",
`docs/PRODUCT.md:17`). Third, the model id is hardcoded into the fetch URL;
when Google retires it the page dies with a bare "API error: 404".

## Current state

- `web/src/pages/AskPage.tsx` — the whole live chat (`LiveChat`, lines 25–100).
  The facts object (lines 51–58):

```ts
const facts: Facts = {
  districtName: name,
  fireSeasonMonths: bm ? `${SEASON_MONTHS[bm.first]} to ${SEASON_MONTHS[bm.last]}` : 'quiet',
  unusualDaysThisSeason: nrt.districts[selectedUnit]?.above_p90_days ?? 0,
  kilnSeason: kilnInfo ? `${whenText(kilnInfo.onset)} to ${whenText(kilnInfo.end)}` : null,
  currentSeason: nrt.season
}
const sys = buildSystemPrompt(facts)
```

  The fetch and guard (lines 60–74):

```ts
const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, // a header, so the key never lands in URL logs
  body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: sys + '\n\nUser Question: ' + q }] }] })
})
if (!res.ok) throw new Error(`API error: ${res.status}`)
const data = await res.json()
const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No answer returned.'

const bad = unsupportedNumbers(text, sys)
```

  Errors surface at line 77 as `Failed to connect: {e.message}`. The answer
  renders at line 97 with no provenance:

```tsx
{ans && <div className="prose-measure whitespace-pre-wrap rounded-[6px] bg-surface-2 p-3 text-sm">{ans}</div>}
```

- `web/src/lib/geminiPrompt.ts` — exports `Facts`, `buildSystemPrompt(facts)`,
  `numbers(text)`, `unsupportedNumbers(answer, context)` (the guard). Keep
  passing `sys` as the guard's allowed context: the system prompt contains
  every number the answer may state, so it stays correct after the
  wire-format change.
- `web/src/lib/geminiPrompt.test.ts` — the test pattern (plain Vitest
  `describe`/`it`/`expect`, fixed expected values). **All new tests go in
  this file.**
- Test tooling facts that decide where tests can live:
  - `web/vite.config.ts:49` — `test: { environment: 'jsdom', include: ['src/**/*.test.ts'] }`.
    Only `.test.ts` files are collected; a `.test.tsx` file would silently
    never run.
  - React Testing Library is NOT a dependency (`grep -c testing-library web/package.json` → 0).
    So the component itself is not unit-tested; all logic worth testing
    moves into pure functions in `geminiPrompt.ts`.
- Cached-path transparency pattern to mirror: `AskPage.tsx:135-140`
  (`<details><summary>The data behind this answer …</summary>` with a `<pre>`
  of JSON).
- Model ids (checked 2026-10-12 against https://ai.google.dev/gemini-api/docs/models
  and the Interactions API reference): `gemini-3.1-flash-lite` is GA;
  `gemini-3.5-flash-lite` is listed as current. There is **no** plain
  `gemini-3.1-flash` text model — do not use it. `temperature`/`top_p`/`top_k`
  are deprecated on these models (ignored now, an error in later
  generations), so the request sends none (amended 2026-10-12).
- Conventions (`CLAUDE.md`): tests assert fixed expected values, never
  current output; `web/` never holds kiln-level data (the facts object is
  district-level — safe).

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---|---|---|
| Install | `cd web && npm ci` | exit 0 |
| Lint | `cd web && npm run lint` | exit 0, no warnings |
| Typecheck | `cd web && npm run typecheck` | exit 0 |
| Unit tests | `cd web && npm test -- --run` | all pass |
| Build (fixture) | `cd web && DATA_SRC=fixtures FIXTURE_BRANCH=nokiln npm run build` | exit 0 |
| E2E | `cd web && npm run e2e` (after the nokiln build) | all pass |

## Scope

**In scope** (the only files you should modify):
- `web/src/lib/geminiPrompt.ts` — new pure helpers
- `web/src/lib/geminiPrompt.test.ts` — new tests
- `web/src/pages/AskPage.tsx` — use the helpers, show the facts

**Out of scope**:
- `web/vite.config.ts` and `web/package.json` — no new test globs, no new
  dependencies (no React Testing Library).
- The cached-answers rendering path (`AskPage.tsx:121-145`) — it is the
  reference pattern; do not restyle it.
- Any Python file, any workflow file, `ask.json` handling.

## Git workflow

- Branch: `plan-001-gemini-hardening` off the current working branch.
- Commit style (conventional commits, e.g. `fix(web): harden the Gemini
  live chat, precache the app shell only, correct copy`): one commit per
  step, `fix(ask): <what changed>`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Pure request/response helpers in `geminiPrompt.ts`

Append to `web/src/lib/geminiPrompt.ts`:

```ts
/** Models tried in order; a 404 (retired model) moves to the next. Check ids against ai.google.dev before editing. */
export const GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite']
export const RETIRED_MESSAGE = 'Google retired the models this page uses — the cached answers below still work.'

/** The request body: the instructions travel as system_instruction, never inside the user's turn. */
export function buildGeminiRequest(sys: string, q: string) {
  return {
    system_instruction: { parts: [{ text: sys }] },
    contents: [{ role: 'user', parts: [{ text: q }] }],
    generationConfig: { maxOutputTokens: 1024 }, // no temperature: deprecated on Gemini 3.x (ignored now, an error in later models)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const extractText = (data: any): string => data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No answer returned.'

/** One answer from the first model that exists. 404 → next model; any other failure throws at once (no retry). */
export async function askGemini(fetchFn: typeof fetch, apiKey: string, sys: string, q: string, models = GEMINI_MODELS): Promise<string> {
  for (const m of models) {
    const res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, // a header, so the key never lands in URL logs
      body: JSON.stringify(buildGeminiRequest(sys, q)),
    })
    if (res.status === 404) continue
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return extractText(await res.json())
  }
  throw new Error(RETIRED_MESSAGE)
}
```

The loop is bounded by `models.length` (CLAUDE.md invariant 9).

**Verify**: `cd web && npm run typecheck && npm run lint` → both exit 0.

### Step 2: Use the helpers in `AskPage.tsx`

In `askModel`, replace lines 60–67 (the `fetch` through `const text = …`)
with:

```ts
const text = await askGemini(fetch, apiKey, sys, q)
```

Update the import on line 5 to
`import { askGemini, buildSystemPrompt, unsupportedNumbers, type Facts } from '../lib/geminiPrompt'`.
Keep `unsupportedNumbers(text, sys)` exactly as is.

**Verify**: `cd web && npm run typecheck && npm run lint` → exit 0;
`grep -c "User Question" web/src/pages/AskPage.tsx` → `0`;
`grep -c "generativelanguage" web/src/pages/AskPage.tsx` → `0`.

### Step 3: Show the facts behind a live answer

Line numbers moved in Step 2, so find each spot by its content. Add state
next to `const [ans, setAns] = useState<ReactNode>(null)`:
`const [shownFacts, setShownFacts] = useState<Facts | null>(null)`.
In `askModel`: call `setShownFacts(null)` right after `setAns(null)`, and
`setShownFacts(facts)` right after `setAns(text)` (the non-blocked branch).
Replace the line that starts `{ans && <div className="prose-measure`
(the answer container) with the block below, so the facts appear and
disappear with the answer:

```tsx
{ans && <div className="prose-measure space-y-2 rounded-[6px] bg-surface-2 p-3 text-sm">
  <div className="whitespace-pre-wrap">{ans}</div>
  {shownFacts && <details className="text-sm">
    <summary className="cursor-pointer text-orbit">The data behind this answer</summary>
    <pre className="mt-1 max-h-64 overflow-auto rounded-[6px] bg-surface p-2 text-xs">{JSON.stringify(shownFacts, null, 1)}</pre>
  </details>}
</div>}
```

**Verify**: `cd web && npm run typecheck && npm run lint` → exit 0;
`DATA_SRC=fixtures FIXTURE_BRANCH=nokiln npm run build && npm run e2e` → all
pass (the live chat needs a key, so e2e only proves the page still renders;
the facts panel is checked by a human with a real key — say so in the PR).

### Step 4: Tests in `geminiPrompt.test.ts`

Add a `describe('gemini request', …)` block. Use a fake `fetchFn` that
records URLs and returns scripted responses, e.g.

```ts
const fake = (...replies: { status: number; body?: unknown }[]) => {
  const urls: string[] = []
  const fn = (async (url: string) => {
    urls.push(url)
    const r = replies[urls.length - 1]
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status })
  }) as unknown as typeof fetch
  return { fn, urls }
}
```

Cases (fixed expected values only — CLAUDE.md invariant 8):
1. `buildGeminiRequest('SYS', 'Q')` deep-equals
   `{ system_instruction: { parts: [{ text: 'SYS' }] }, contents: [{ role: 'user', parts: [{ text: 'Q' }] }], generationConfig: { maxOutputTokens: 1024 } }`.
2. Fallback: replies `[{ status: 404 }, { status: 200, body: { candidates: [{ content: { parts: [{ text: 'March is the peak.' }] } }] } }]`
   → resolves `'March is the peak.'`; `urls.length === 2` and `urls[1]`
   contains `GEMINI_MODELS[1]`.
3. All 404 → rejects with `RETIRED_MESSAGE`; `urls.length === GEMINI_MODELS.length`.
4. A 403 on the first model → rejects with `'API error: 403'` and
   `urls.length === 1` (no retry on non-404).
5. `extractText({})` → `'No answer returned.'`.

The guard itself (invented number blocked) is already covered by the
existing `geminiPrompt.test.ts` cases — do not duplicate.

**Verify**: `cd web && npm test -- --run` → all pass, 5 more tests than
before (run once before Step 1 to record the baseline count).

## Test plan

Covered by Step 4 (pure helpers, fake fetch, no network). The component
wiring is covered by typecheck plus the e2e smoke that the page renders.
Pattern: `web/src/lib/geminiPrompt.test.ts`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd web && npm run lint` exits 0 with no warnings
- [ ] `cd web && npm run typecheck` exits 0
- [ ] `cd web && npm test -- --run` passes with 5 new tests in `geminiPrompt.test.ts`
- [ ] `grep -c "User Question" web/src/pages/AskPage.tsx` → `0`
- [ ] `grep -c "system_instruction: {" web/src/lib/geminiPrompt.ts` → `1` (the request key; the doc comment also mentions the word)
- [ ] `grep -c "gemini-3.1-flash'" web/src/lib/geminiPrompt.ts` → `0` (the nonexistent id is not used)
- [ ] `ls web/src/pages/*.test.tsx 2>/dev/null | wc -l` → `0` (no uncollected test file)
- [ ] Scope check (works whether or not you have committed): `git diff --name-only 98fa82a -- . ':!plans'` lists only: `web/src/lib/geminiPrompt.ts`, `web/src/lib/geminiPrompt.test.ts`, `web/src/pages/AskPage.tsx`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts under "Current state" don't match the live code (drift).
- Either id in `GEMINI_MODELS` is not listed on
  https://ai.google.dev/gemini-api/docs/models when you run this plan —
  report which id; do not guess a replacement.
- A real request (operator's key) rejects `system_instruction` — report the
  API error verbatim instead of inventing a workaround.
- Any test seems to need a new npm dependency or a change to the Vitest
  `include` glob.

## Maintenance notes

- When Plan 005 (hosted worker) lands, `LiveChat` gains a second backend;
  keep `buildGeminiRequest`/`extractText`/`askGemini` pure so both paths
  share them.
- When Google retires a model, edit `GEMINI_MODELS` only; the fallback test
  is written against the list, not the ids.
- Reviewer: confirm the guard still receives the full `sys` string
  (`unsupportedNumbers(text, sys)`).
