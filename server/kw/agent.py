"""In-app analyst on Google Gemini's free tier (key from https://aistudio.google.com/apikey, env GEMINI_API_KEY).

The model never computes a measurement: it can only call the deterministic tools below, and every call is
returned to the UI as a visible trace. UI tools (ui_*) are not executed here — they are handed back to the
browser, which moves the map / calendar.
"""
import json
import os
import urllib.error
import urllib.request

import datetime as dt

from . import charts, news_more, outlook, tools

# gemini-flash-latest was measured hanging 60 s+ on tool calls while gemini-2.5-flash answers in ~2 s, so pin the fast one.
MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
MAX_STEPS = 8

SYSTEM = """You are the analyst inside Kiln Watch, a web app that harmonizes NASA FIRMS MODIS and VIIRS active-fire
detections into one consistent 2000-present record per area.
Rules:
- Only state numbers that appear in tool results. Never estimate, extrapolate or invent values, dates or sources.
- Name the tool a number came from in brackets, e.g. [get_period].
- The primary unit is "hotspots on the Aqua MODIS scale": the vegetation-fire detections Aqua MODIS would have
  recorded. It is not burned area and not a count of fires. Raw counts are not comparable across satellite eras.
- Compare periods with the median, percentile and rank among years from the tools; never use sigma language.
- A lack of news reports is never evidence that nothing happened, and reports are matched by place/date only.
- The early warning is a climatological outlook (this month vs earlier years), never a forecast or an official alert.
- Prefer moving the user's view with ui_* tools when it helps (select region, period, change view) — then explain.
- Format in Markdown: put the key numbers, levels and the verdict in **bold**; use short bullet lists for several
  points; no tables wider than 3 columns. Be brief: 2-6 sentences or a short list.
- When a trend, season or comparison helps, call show_chart (it draws an animated chart from the pipeline under your
  answer; describe it in one sentence, never restate all its numbers). At most 2 charts per answer.
- For the current (unfinished) month always use early_warning, which compares the same days in earlier years; never
  rank a month in progress with get_period. Round hotspot counts to whole numbers.
- For any place name, call find_place first; query_hotspots and get_outlook work for any box without building.
- Today's date is in [app state] as "today"; "recent", "last N days" and "next 30 days" are relative to it.
- If a tool fails or data is missing, say so plainly."""

_S = {"type": "STRING"}
_N = {"type": "NUMBER"}
_period = {"type": "STRING", "description": "'YYYY-MM' month or ISO week 'YYYY-Www'"}
DECLS = [
    {"name": "list_regions", "description": "Areas with harmonized records (presets and custom areas).",
     "parameters": {"type": "OBJECT", "properties": {}}},
    {"name": "region_summary", "description": "Trend tests, sensor-transition step tests, hold-out validation and totals for an area.",
     "parameters": {"type": "OBJECT", "properties": {"region_id": _S}, "required": ["region_id"]}},
    {"name": "get_period", "description": "Harmonized value with 95% interval, anomaly, raw per-sensor counts and coverage for one period.",
     "parameters": {"type": "OBJECT", "properties": {"region_id": _S, "period": _period}, "required": ["region_id", "period"]}},
    {"name": "find_anomalies", "description": "Periods ranking highest against the same month/week in other years.",
     "parameters": {"type": "OBJECT", "properties": {
         "region_id": _S, "granularity": {"type": "STRING", "enum": ["month", "week"]},
         "min_percentile": {"type": "NUMBER"}, "top_n": {"type": "INTEGER"}}, "required": ["region_id"]}},
    {"name": "evidence", "description": "Daily detections, strongest detections and FIRMS/Worldview links behind one period.",
     "parameters": {"type": "OBJECT", "properties": {"region_id": _S, "period": _period}, "required": ["region_id", "period"]}},
    {"name": "reports", "description": "Search NASA EONET and GDELT news for reports matching the area and period.",
     "parameters": {"type": "OBJECT", "properties": {"region_id": _S, "period": _period}, "required": ["region_id", "period"]}},
    {"name": "timeline_reports", "description": "News/event reports over a month range, matched month by month to the record, with a rule-based agreement verdict.",
     "parameters": {"type": "OBJECT", "properties": {"region_id": _S, "start": {"type": "STRING", "description": "'YYYY-MM'"},
                                                     "end": {"type": "STRING", "description": "'YYYY-MM'"}}, "required": ["region_id", "start", "end"]}},
    {"name": "early_warning", "description": "Early-warning outlook for an area: level, this month vs the same days in earlier years, the usual next four weeks.",
     "parameters": {"type": "OBJECT", "properties": {"region_id": _S}, "required": ["region_id"]}},
    {"name": "check_watchlist", "description": "Built areas at or above a warning level (elevated, watch or normal), most serious first.",
     "parameters": {"type": "OBJECT", "properties": {"min_level": {"type": "STRING", "enum": ["elevated", "watch", "normal"]}}}},
    {"name": "find_place", "description": "Look up any place name: centre, a 0.5-4 degree box (west,south,east,north), built areas overlapping it.",
     "parameters": {"type": "OBJECT", "properties": {"query": _S}, "required": ["query"]}},
    {"name": "get_outlook", "description": "Climatological 30-day outlook cells (watch/above/season) inside a box, or worldwide summary without a box.",
     "parameters": {"type": "OBJECT", "properties": {"west": _N, "south": _N, "east": _N, "north": _N}}},
    {"name": "query_hotspots", "description": "Raw FIRMS detections per day and satellite for any box (<=400 sq deg) and dates (<=366 days, default last 14 days).",
     "parameters": {"type": "OBJECT", "properties": {"west": _N, "south": _N, "east": _N, "north": _N,
                                                     "start": {"type": "STRING", "description": "YYYY-MM-DD"}, "end": {"type": "STRING", "description": "YYYY-MM-DD"}},
                    "required": ["west", "south", "east", "north"]}},
    {"name": "annual_series", "description": "Per year: harmonized hotspots vs raw detections of all satellites for an area.",
     "parameters": {"type": "OBJECT", "properties": {"region_id": _S}, "required": ["region_id"]}},
    {"name": "season_profile", "description": "Typical fire-season start/peak/end (ISO weeks), peak months, trends, year-to-date rank.",
     "parameters": {"type": "OBJECT", "properties": {"region_id": _S}, "required": ["region_id"]}},
    {"name": "compare_areas", "description": "2-6 built areas side by side: level, peak months, trend, last 10 years.",
     "parameters": {"type": "OBJECT", "properties": {"region_ids": {"type": "ARRAY", "items": _S}}, "required": ["region_ids"]}},
    {"name": "situation_brief", "description": "Markdown situation brief for a built area (level, month, next 30 days, events, trend).",
     "parameters": {"type": "OBJECT", "properties": {"region_id": _S}, "required": ["region_id"]}},
    {"name": "latest_fire_news", "description": "Worldwide wildfire headlines and events of the last 1-30 days.",
     "parameters": {"type": "OBJECT", "properties": {"days": {"type": "INTEGER"}}}},
    {"name": "show_chart", "description": "Draw a chart under the answer from pipeline data. kind: annual (raw vs harmonized per year), "
     "month_across_years (one calendar month every year; give month 'YYYY-MM'), recent_months, recent_weeks, season (fire year so far "
     "vs earlier years), anomalies, box_daily (needs west/south/east/north/start/end).",
     "parameters": {"type": "OBJECT", "properties": {"kind": {"type": "STRING", "enum": list(charts.KINDS)}, "region_id": _S,
                                                     "month": _S, "west": _N, "south": _N, "east": _N, "north": _N, "start": _S, "end": _S},
                    "required": ["kind"]}},
    {"name": "ui_select_region", "description": "Open an area in the app.",
     "parameters": {"type": "OBJECT", "properties": {"region_id": _S}, "required": ["region_id"]}},
    {"name": "ui_select_period", "description": "Highlight a calendar cell and open its details.",
     "parameters": {"type": "OBJECT", "properties": {"period": _period}, "required": ["period"]}},
    {"name": "ui_set_view", "description": "Change the calendar view.",
     "parameters": {"type": "OBJECT", "properties": {
         "granularity": {"type": "STRING", "enum": ["month", "week"]},
         "scale": {"type": "STRING", "enum": ["hotspots", "viirs", "celldays", "raw"]},
         "tab": {"type": "STRING", "enum": ["calendar", "vs_median", "season", "continuity"]}}}},
]

_RUN = {
    "list_regions": lambda a: tools.list_regions(),
    "region_summary": lambda a: tools.region_summary(a["region_id"]),
    "get_period": lambda a: tools.get_period(a["region_id"], a["period"]),
    "find_anomalies": lambda a: tools.find_anomalies(a["region_id"], a.get("granularity", "month"),
                                                     float(a.get("min_percentile", 90.0)), int(a.get("top_n", 8))),
    "evidence": lambda a: _trim_evidence(tools.evidence(a["region_id"], a["period"])),
    "reports": lambda a: tools.reports(a["region_id"], a["period"]),
    "timeline_reports": lambda a: _trim_timeline(tools.timeline_reports(a["region_id"], a["start"], a["end"])),
    "early_warning": lambda a: tools.early_warning(a["region_id"]),
    "check_watchlist": lambda a: tools.warnings(a.get("min_level", "watch")),
    "find_place": lambda a: news_more.geocode(a["query"]) or {"found": False},
    "get_outlook": lambda a: _outlook(a),
    "query_hotspots": lambda a: _hotspots(a),
    "annual_series": lambda a: tools.annual(a["region_id"]),
    "season_profile": lambda a: tools.season_profile(a["region_id"]),
    "compare_areas": lambda a: tools.compare_areas(a["region_ids"]),
    "situation_brief": lambda a: tools.briefing(a["region_id"]),
    "latest_fire_news": lambda a: {**(r := news_more.latest(int(a.get("days", 3)))), "items": [
        {k: i.get(k) for k in ("title", "date", "source", "outlet")} for i in r["items"][:40]]},
}


def _outlook(a):
    if all(a.get(k) is not None for k in ("west", "south", "east", "north")):
        return outlook.in_box([a["west"], a["south"], a["east"], a["north"]], limit=15)
    o = outlook.get()
    return {k: o[k] for k in ("as_of", "next_30_days", "counts", "regions", "rule", "caveat")} | {"classes": outlook.CLASSES}


def _hotspots(a):
    a.setdefault("end", str(dt.date.today()))
    a.setdefault("start", str(dt.date.fromisoformat(a["end"]) - dt.timedelta(days=13)))
    r = tools.global_hotspots([a["west"], a["south"], a["east"], a["north"]], a["start"], a["end"])
    return {**r, "daily": r["daily"][-120:]}


def _trim_timeline(t):
    return {**t, "items": [{k: i.get(k) for k in ("title", "date", "source", "outlet", "relevant", "fire")} for i in t["items"][:40]]}


def _trim_evidence(e):
    e = dict(e)
    e["daily"] = e["daily"][:60]
    e["top_detections"] = e["top_detections"][:10]
    return e


def available():
    return bool(os.environ.get("GEMINI_API_KEY"))


FALLBACK = "gemini-flash-lite-latest"  # tried when the main model is overloaded or silent


def _call(contents):
    return _post({"systemInstruction": {"parts": [{"text": SYSTEM}]}, "contents": contents,
                  "tools": [{"functionDeclarations": DECLS}], "generationConfig": {"temperature": 0.2}})


def _post(payload):
    body = json.dumps(payload).encode()
    for model in dict.fromkeys((MODEL, FALLBACK)):
        req = urllib.request.Request(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", data=body,
            headers={"Content-Type": "application/json", "x-goog-api-key": os.environ["GEMINI_API_KEY"]})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                res = json.load(r)
                res["_model"] = model
                return res
        except urllib.error.HTTPError as ex:
            detail = ex.read().decode("utf-8", "replace")[:300]
            if ex.code == 503 and model != FALLBACK:
                continue
            if ex.code == 429:
                raise RuntimeError("Gemini free-tier rate limit reached — wait a minute and retry.") from None
            raise RuntimeError(f"Gemini error {ex.code}: {detail}") from None
        except (TimeoutError, urllib.error.URLError) as ex:
            if model != FALLBACK:
                continue
            raise RuntimeError(f"Gemini did not answer in time ({ex}).") from None


def classify_headlines(titles, area):
    """Gemini labels each headline: does it report a vegetation fire (wildfire, forest, grass, crop, peat) burning in
    or near the area? Returns a list of True/False in input order. Only filters what is counted; never adds data.
    Asks for the numbers of the matching headlines (robust to long lists), 60 headlines per request."""
    labels, model = [], MODEL
    for off in range(0, len(titles), 60):
        chunk = titles[off:off + 60]
        numbered = "\n".join(f"{i}. {(t or '')[:160]}" for i, t in enumerate(chunk))
        prompt = (f"Area: {area}.\nWhich of the numbered news headlines below report a vegetation fire (wildfire, forest, "
                  "bush, grass, crop/stubble or peat fire, or its smoke, evacuations or firefighting) in or near this area? "
                  "Exclude house or industrial fires, other places, politics and retrospectives without a current fire. "
                  f"Reply with only a JSON array of the matching headline numbers (0 to {len(chunk) - 1}).\n\n{numbered}")
        res = _post({"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                     "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}})
        parts = ((res.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [{}]
        hits = json.loads("".join(p.get("text", "") for p in parts if not p.get("thought")) or "[]")
        if not isinstance(hits, list):
            raise RuntimeError("Gemini did not return a list of headline numbers")
        keep = {int(x) for x in hits if isinstance(x, (int, float, str)) and str(x).strip().isdigit()}
        labels += [i in keep for i in range(len(chunk))]
        model = res.get("_model", MODEL)
    return labels, model


def ask(message, history=None, context=None):
    if not available():
        raise RuntimeError("Set GEMINI_API_KEY (free at https://aistudio.google.com/apikey) to enable the analyst.")
    # the model does not know today's date: without it "the last 14 days" lands in its training year
    ctx = json.dumps({"today": str(dt.date.today()), **(context or {})})
    contents = [{"role": m["role"], "parts": [{"text": m["text"]}]} for m in (history or [])[-8:]
                if m.get("role") in ("user", "model") and m.get("text")]
    contents.append({"role": "user", "parts": [{"text": f"[app state: {ctx}]\n{message}"}]})
    trace, actions, shown, calls_made = [], [], [], []
    nudged = False
    for _ in range(MAX_STEPS):
        res = _call(contents)
        cand = (res.get("candidates") or [{}])[0]
        content = cand.get("content") or {"role": "model", "parts": []}
        contents.append(content)  # echo verbatim so thought signatures survive
        calls = [p["functionCall"] for p in content.get("parts", []) if "functionCall" in p]
        if not calls:
            text = "".join(p.get("text", "") for p in content.get("parts", []) if not p.get("thought"))
            if not text.strip() and trace and not nudged:  # Gemini sometimes ends silently after tool calls
                nudged = True
                contents.append({"role": "user", "parts": [{"text": "Now write the answer for me from the tool results above."}]})
                continue
            return {"answer": text.strip() or "(no answer)", "trace": trace, "actions": actions, "model": res.get("_model", MODEL),
                    "charts": (shown or charts.auto(calls_made))[:2]}
        replies = []
        for c in calls:
            name, args = c.get("name"), c.get("args") or {}
            if name.startswith("ui_"):
                actions.append({"name": name, "args": args})
                result = {"ok": True}
            elif name == "show_chart":
                try:
                    box = [args[k] for k in ("west", "south", "east", "north")] if "west" in args else None
                    spec = charts.build(args.get("kind"), args.get("region_id"), args.get("month"), box, args.get("start"), args.get("end"))
                    shown.append(spec)
                    result = {"ok": True, "title": spec["title"], "points": len(spec["x"])}
                except Exception as ex:
                    result = {"error": str(ex)}
            elif name in _RUN:
                try:
                    result = _RUN[name](args)
                    calls_made.append((name, args))
                except Exception as ex:
                    result = {"error": str(ex)}
            else:
                result = {"error": f"unknown tool {name}"}
            trace.append({"tool": name, "args": args, "ok": "error" not in (result if isinstance(result, dict) else {})})
            replies.append({"functionResponse": {"name": name, "response": {"result": result}}})
        contents.append({"role": "user", "parts": replies})
    return {"answer": "Stopped after too many tool calls; try a narrower question.", "trace": trace,
            "actions": actions, "model": res.get("_model", MODEL), "charts": shown[:2]}
