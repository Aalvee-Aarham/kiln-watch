# AI use log

The 2026 Space Apps rules ask every submission to describe how AI tools were used. Keep this file current.

| Date | Tool | Used for | Human review |
|---|---|---|---|
| 2026-11-10 | Claude Code (Anthropic) | Read the project briefs; wrote the data pipeline, harmonization statistics, API, MCP server and web UI; ran builds and tests | Team to review all code and results before submission |
| 2026-11-10 | Research brief (AI-assisted, `harmonized_fire_calendar_improvements_round2.md`) | Literature and rules review that shaped the method (Aqua reference, denial tests, accessibility) | Sources to be opened and verified before quoting |
| optional, at run time | Google Gemini (free tier) | In-app analyst that phrases answers from deterministic tool output | Every tool call is shown to the user; numbers come from the pipeline only |

No AI system generates any number shown in the calendar, charts or downloads. Those come from
`server/kw/build.py` run on NASA FIRMS data.
