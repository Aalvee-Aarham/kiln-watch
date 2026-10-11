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

## 3. AI inside the product: the news page

| Item | Detail |
|---|---|
| Model | Gemini Flash-Lite (`gemini-3.1-flash-lite`) through the Gemini API with structured output; when it is out of quota or fails, the fallbacks in `NEWS_PROVIDERS` (`kilnwatch/config.py`) in order: `gemini-3.5-flash-lite`, Groq, Cerebras, Mistral, GitHub Models (OpenAI-compatible APIs, free tiers). Each stored story records which model read it. **Free tier: team decision of 11 Oct 2026** — on the free tier Google may use what is sent to improve its products, and human reviewers may read it (docs/news_plan.md §10) |
| Code | `kilnwatch/news_extract.py` (the one place the model is called), `kilnwatch/news.py` (finding, fetching, checking); plan: `docs/news_plan.md` |
| What the AI does | Reads an excerpt of a newspaper article we fetched ourselves and returns: the kind of story, which of the districts the text names it is about, the event date if the article states one, a claim of at most 30 words in English and Bangla, and one verbatim quote |
| What the AI never does | Find articles (the newspapers' own sitemaps do), choose a district the text doesn't name, or write a number: code checks the quote is verbatim and every number in the claims appears in the quote, and drops the story otherwise. All satellite figures and the "how common" verdict come from deterministic code (`kilnwatch/news_pair.py`) |
| Data it sees | Excerpts (at most 600 words) of public articles from Bangladeshi newspapers; article text is never stored or published |
| Where output appears | `#/news`, labelled "Collected by AI from newspapers. Not reviewed by a person." A blocklist file removes bad items; a person audits a random sample (docs/VERIFICATION.md) |
| Limits | At most `NEWS_MAX_LLM_CALLS_PER_RUN` model calls per run; the daily job stays off until the `GEMINI_API_KEY` secret is added |
