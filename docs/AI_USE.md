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
| Model | Claude Opus 5.5 (`claude-opus-5-5`) through the Anthropic API, low effort, server-side refusal fallback enabled |
| Code | `kilnwatch/ask.py`; prompt: `SYSTEM` in that file; tools: `TOOLS` |
| What the AI does | Chooses which of five project functions to call (find an area, its fire calendar, this season, the two-week outlook, the harmonization evidence) and writes a two-to-four-sentence answer in English or Bangla |
| What the AI never does | Compute a number. Every figure comes from a deterministic, unit-tested function; `guard()` blocks any answer that states a number no function returned |
| Data it sees | Only the public, area-level export the website already publishes: no kiln locations, no personal data |
| Where answers appear | `#/ask`, from a cache written by `python -m kilnwatch ask --build-cache`, so the page works offline and shows the raw function results behind each answer |
| Limits | At most 6 model calls per question; refusals and blocked answers are shown as such, never filled in |
