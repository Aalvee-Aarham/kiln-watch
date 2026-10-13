# Use of AI in Kiln Watch

Space Apps allows AI-generated content when the tools are named, the prompts are explained and the team's own work is shown. This file records both uses of AI in this project. **Team: complete the sections marked _to fill_ before submitting**, in the wording of the official Project Submission Guide (published 13 Nov 2026).

## 1. AI as a coding assistant

| Tool | Used for | Evidence |
|---|---|---|
| Claude Code (Claude Opus 5.5, Anthropic) | Writing and refactoring pipeline and website code, tests, documentation, code review and audits | Commits marked `Co-Authored-By: Claude Opus 5.5` in the git history (14 of the commits from 6 to 10 Oct 2026 at the time of writing) |
| _to fill_ | Any other AI tool the team used (chat assistants, image or video tools for the pitch) | |

**What the team decided and did** (_to fill and confirm_): the choice of challenge and Bangladesh focus; the pre-registered tests and their thresholds (`docs/PREREGISTRATION.md`, committed before any analysis); the harmonization design; the decision to test kilns with night lights and radar; reviewing every AI-written change before it was merged.

**Key prompts** (_to fill_): the instructions given to the coding assistant are summarised in `CLAUDE.md` (project rules) and `docs/roadmap.md` (the steps it was asked to build). Add the main conversation prompts here.

## 2. AI inside the product: Ask Kiln Watch

| Item | Detail |
|---|---|
| Model | Google Gemini (`gemini-3.5-flash-lite`) through the Gemini API (`generateContent` with function calling), key `GEMINI_API_KEY`; safety-blocked replies are shown as refusals, never filled in |
| Code | `kilnwatch/ask.py`; prompt: `SYSTEM` in that file; tools: `TOOLS` |
| What the AI does | Chooses which of seven project functions to call (find an area, its fire calendar, this season, the two-week outlook, the harmonization evidence, kiln seasons, the national trend) and writes a two-to-four-sentence answer in English or Bangla |
| What the AI never does | Compute a number. Every figure comes from a deterministic, unit-tested function; `guard()` blocks any answer that states a number no function returned |
| Data it sees | Only the public, area-level export the website already publishes: no kiln locations, no personal data |
| Where answers appear | `python -m kilnwatch ask` in a terminal. On `#/ask`, each question a visitor asks (with their own Gemini key, or the hosted worker if one is configured) is saved with its answer in that visitor's browser only, with every figure linked to the function result or district fact that returned it |
| Limits | At most 6 model calls per question; refusals and blocked answers are shown as such, never filled in |
| Known limits of the guard | `guard()` checks numbers by value, not by meaning: an answer that attaches a correct number to the wrong claim (for example "96% of all fires removed" when the tool said "96% of the 2012 jump removed") passes. Pinned by `tests/test_ask_eval.py`; closing it needs claim-level checking, which we do not ship. |

### Live chat on the website (Gemini, bring your own key)

| Item | Detail |
|---|---|
| Model | Google Gemini (`gemini-3.1-flash-lite`), called from the visitor's browser with a key the visitor enters; the site ships no key |
| Code | `web/src/pages/AskPage.tsx`; prompt: `buildSystemPrompt` in `web/src/lib/geminiPrompt.ts` |
| What the AI does | Answers about one chosen district from a fixed set of facts the page computes (busy months, unusual days this season, kiln season) and places in the prompt. It calls no project functions |
| What the AI never does | State a number the facts did not contain: `unsupportedNumbers()` (same rule as `guard()`, unit-tested) blocks any such answer |
| Data it sees | The same public, area-level figures shown on the page; the question the visitor types goes to Google |
