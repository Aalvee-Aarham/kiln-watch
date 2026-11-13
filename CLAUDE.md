# Kiln Watch — agent notes

NASA Space Apps 2026 "Harmonization of MODIS and VIIRS Hot Spots". One consistent 2000–present fire record per area.

## Token rule (always)
1. Before reading source files to answer a codebase question, read `graphify-out/GRAPH_REPORT.md` and query the graph
   (`/graphify query "<question>"`). Only open the files it points to.
2. After changing code, rebuild the graph: `graphify update .` (the post-commit hook also does this).
3. Keep durable decisions in memory, not in this file.

## Layout
- `server/kw/firms.py` — reads FIRMS detections from the public Portolan GeoParquet mirror (DuckDB, no key) → `data/cache/<area>/<year>.parquet`
- `server/kw/build.py` — calibration, stitching, validation, outputs `data/regions/<area>/{meta,monthly,weekly,grid,static}.json`
- `server/kw/science.py` — all statistics (stdlib only); tests in `server/tests/test_science.py`
- `server/kw/tools.py` — deterministic query functions shared by `api.py` (FastAPI), `mcp_server.py` (MCP) and `agent.py` (Gemini)
- `server/kw/news.py` — NASA EONET + GDELT DOC (2017+) + optional ReliefWeb ; `news_more.py` adds Google News RSS, GDACS, worldwide feed, free-text place search
- `server/kw/outlook.py` — worldwide 0.5° 30-day outlook from the global aggregate (rule `science.outlook_cell`)
- `server/kw/alerts.py` — email (double opt-in, SMTP env) + n8n alerts; `personas.py` — Claude characters (MCP prompts, subagents); `charts.py` — analyst chart specs from pipeline data only
- `server/kw/mcp_server.py` — 31 tools, 4 prompts, resources; also mounted by the API at `/mcp`
- `web/src` — React + MapLibre UI (`App.tsx` shell + hash routing, `Map.tsx`, `Record.tsx` calendar/continuity/method, `Detail.tsx` cell inspector, `Timeline.tsx`, `Analyst.tsx` + `Chart.tsx`, `Loader.tsx` for every slow wait)
- `web/src/pages/` — one file per page: `Warning` (early warning), `News`, `Data` (Download + Create), `Method`, `Connect` (MCP + n8n); `shared.tsx` has the page list
- Early warning: rule in `science.warning_level`, assembly in `tools.early_warning`/`warnings`; keep it a climatological outlook, never a forecast

## Commands
- Build presets: `cd server && python -m kw.firms && python -m kw.build`
- API: `cd server && uvicorn kw.api:app --port 8000` · Web: `cd web && npm run dev`
- Tests: `python server/tests/test_science.py` · Type check: `cd web && npx tsc --noEmit`

## Science guardrails (from the brief review — do not regress)
- Never present synthetic or hand-typed numbers as results; everything comes from the pipeline.
- Missing news ≠ evidence of absence; never label "silent ignition" or "artifact proven".
- Sensor availability is measured from data (`sensor_days`), never hard-coded end dates.
- Detections are not fires and not burned area.
