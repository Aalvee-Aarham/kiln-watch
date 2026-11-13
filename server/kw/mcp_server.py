"""Model Context Protocol server: Kiln Watch's deterministic fire tools, character prompts and resources for Claude.

stdio (Claude Desktop, Cursor):     python -m kw.mcp_server
HTTP  (Claude Code, n8n, others):   python -m kw.mcp_server --http      -> http://127.0.0.1:8765/mcp
Remote (claude.ai custom connector): the API serves the same server at <your deployment>/mcp

Every number comes from the harmonized pipeline outputs or cached NASA FIRMS rows; the server never calls a model.
"""
import datetime as dt
import json
import os
import sys

from mcp.server.fastmcp import FastMCP
from mcp.types import ToolAnnotations

from . import news_more, outlook, personas, tools
from . import science as sc

INSTRUCTIONS = ("Kiln Watch: one consistent 2000-present fire record for any place on Earth, harmonizing NASA FIRMS "
                "MODIS (Terra, Aqua) and VIIRS (Suomi-NPP, NOAA-20, NOAA-21) hotspots onto the Aqua MODIS scale. "
                "Start with find_place (any place name) or list_regions, then get_situation_brief, get_fire_outlook or "
                "query_hotspots. Character prompts (fire_manager, fire_scientist, fact_checker, community_liaison) set "
                "a role.\n\n" + personas.GUARDRAILS)

mcp = FastMCP("kiln-watch", instructions=INSTRUCTIONS, host="127.0.0.1", port=8765, stateless_http=True,
              website_url="https://source.coop/portolan-mirrors/firms-catalog")

RO = ToolAnnotations(readOnlyHint=True, openWorldHint=False)
RO_WEB = ToolAnnotations(readOnlyHint=True, openWorldHint=True)
WRITE = ToolAnnotations(readOnlyHint=False, destructiveHint=False, openWorldHint=True)


def _date(s, default):
    return dt.date.fromisoformat(s) if s else default


# ---------- find a place / area ----------

@mcp.tool(title="Find a place", annotations=RO_WEB)
def find_place(query: str) -> dict:
    """Look up ANY place name on Earth (city, district, park, country region). Returns its centre, a box of 0.5-4
    degrees around it (west, south, east, north) for the box-based tools, local languages, and the built Kiln Watch
    areas that overlap it."""
    g = news_more.geocode(query)
    if not g:
        return {"found": False, "query": query}
    w, s, e, n = g["bbox"]
    near = [r for r in tools.list_regions() if not (r["bbox"][2] < w or r["bbox"][0] > e or r["bbox"][3] < s or r["bbox"][1] > n)]
    return {"found": True, **g, "built_areas_overlapping": [{"id": r["id"], "name": r["name"]} for r in near]}


@mcp.tool(title="List built areas", annotations=RO)
def list_regions() -> list:
    """Areas that already have a harmonized 2000-present record (presets and areas anyone built)."""
    return tools.list_regions()


@mcp.tool(title="Build an area", annotations=WRITE)
def create_custom_area(west: float, south: float, east: float, north: float, name: str = "") -> dict:
    """Start building a harmonized 2000-present record for any box (max 16 square degrees). Usually ~20 s with the
    global aggregate, minutes otherwise. Poll get_custom_area_status with the returned id."""
    return tools.start_aoi([west, south, east, north], name or None)


@mcp.tool(title="Area build status", annotations=RO)
def get_custom_area_status(area_id: str) -> dict:
    """Progress of a custom-area build: running / ready / error."""
    return tools.aoi_status(area_id)


# ---------- now and next 30 days ----------

@mcp.tool(title="30-day fire outlook", annotations=RO)
def get_fire_outlook(west: float | None = None, south: float | None = None, east: float | None = None,
                     north: float | None = None, limit: int = 30) -> dict:
    """Climatological 30-day outlook on a 0.5-degree grid (Aqua MODIS 2003-today). Each cell: hotspots the next 30
    days usually bring, and how the last 30 days rank against the same days in earlier years. Classes: watch (season
    ahead AND already above normal), above (above normal), season (usually active). With a box: cells inside it.
    Without: worldwide counts, the named watch regions and the top cells. Not a forecast."""
    if None not in (west, south, east, north):
        return outlook.in_box([west, south, east, north], limit=max(1, min(limit, 200)))
    o = outlook.get()
    f = o["fields"]
    return {k: o[k] for k in ("as_of", "next_30_days", "last_30_days", "baseline_years", "counts", "regions", "rule", "caveat")} | {"classes": outlook.CLASSES,
        "top_cells": [dict(zip(f, r)) for r in o["cells"][:max(1, min(limit, 200))]]}


@mcp.tool(title="Outlook at a point", annotations=RO)
def get_outlook_at(lat: float, lon: float) -> dict:
    """The 30-day outlook for the 0.5-degree cell containing a point."""
    return outlook.at(lat, lon)


@mcp.tool(title="Hotspots in any box", annotations=RO)
def query_hotspots(west: float, south: float, east: float, north: float, start: str = "", end: str = "") -> dict:
    """Raw NASA FIRMS detections per day and satellite for ANY box (up to 400 square degrees) and date range
    (up to 366 days; default the last 14 days), plus the 10 busiest 0.1-degree cells. Instant, no build needed.
    Raw counts: compare one satellite across days; use a built area for the harmonized long-term record."""
    b = _date(end, dt.date.today())
    a = _date(start, b - dt.timedelta(days=13))
    return tools.global_hotspots([west, south, east, north], a, b)


@mcp.tool(title="Situation brief", annotations=RO_WEB)
def get_situation_brief(region_id: str) -> dict:
    """Ready-to-share markdown brief for a built area: early-warning level, this month vs earlier years, the usual
    next four weeks, outlook cells in the area, open NASA EONET events, typical season and long-term trend."""
    return tools.briefing(region_id)


@mcp.tool(title="Early warning for an area", annotations=RO)
def get_early_warning(region_id: str) -> dict:
    """Climatological early warning for a built area: level (elevated/watch/normal/quiet/insufficient), this month
    against the same days in earlier years, last 12 weeks, and the usual next four weeks. Not a forecast."""
    return tools.early_warning(region_id)


@mcp.tool(title="Watchlist", annotations=RO)
def check_watchlist(min_level: str = "watch") -> dict:
    """Built areas currently at or above min_level ('elevated', 'watch' or 'normal'), most serious first."""
    return tools.warnings(min_level)


@mcp.tool(title="Open wildfire events", annotations=RO_WEB)
def get_active_wildfire_events() -> dict:
    """Wildfire events NASA EONET lists as open worldwide, tagged with the Kiln Watch area they fall in."""
    return tools.active_events()


@mcp.tool(title="Satellite status", annotations=RO)
def get_sensor_status() -> dict:
    """Last day each satellite (Terra, Aqua, Suomi-NPP, NOAA-20, NOAA-21) delivered detections, measured from data."""
    return tools.sensor_status()


# ---------- the harmonized record ----------

@mcp.tool(title="Area summary", annotations=RO)
def get_area_summary(region_id: str) -> dict:
    """Plain-language answers (peak season, top years, current period vs history), trends, denial tests, totals."""
    return tools.region_summary(region_id)


@mcp.tool(title="One period", annotations=RO)
def get_period(region_id: str, period: str) -> dict:
    """One month ('YYYY-MM') or ISO week ('YYYY-Www'): harmonized value with 95% interval, rank/percentile/ratio
    against the same period in other years (all years and recency-weighted), raw per-satellite counts, coverage."""
    return tools.get_period(region_id, period)


@mcp.tool(title="Harmonized calendar", annotations=RO)
def get_harmonized_calendar(region_id: str, granularity: str = "month", start: str = "", end: str = "",
                            fire_class: str = "veg") -> dict:
    """Month-by-year (or week) calendar. start/end: '2019-01' or '2019-W01'. fire_class: 'veg' (vegetation fires) or
    'static' (kilns, gas flares, industry). Keep ranges short: each row is detailed."""
    return tools.get_calendar(region_id, granularity, start or None, end or None, fire_class)


@mcp.tool(title="Annual series", annotations=RO)
def get_annual_series(region_id: str) -> list:
    """Per year: harmonized hotspots (Aqua scale), Aqua-only, and raw detections of all satellites. Raw jumps at each
    VIIRS launch (2012, 2018, 2024); the harmonized series does not."""
    return tools.annual(region_id)


@mcp.tool(title="Fire season profile", annotations=RO)
def get_season_profile(region_id: str) -> dict:
    """Typical start, peak and end (ISO weeks), peak months, season-length trends, year-to-date rank."""
    return tools.season_profile(region_id)


@mcp.tool(title="Compare areas", annotations=RO)
def compare_areas(region_ids: list[str]) -> dict:
    """2-6 built areas side by side: early-warning level, peak months, trend and the last 10 complete years."""
    return tools.compare_areas(region_ids)


@mcp.tool(title="Find anomalies", annotations=RO)
def find_anomalies(region_id: str, granularity: str = "month", min_percentile: float = 90.0, top_n: int = 10) -> list:
    """Periods ranking at or above min_percentile against the same month/week in other complete years."""
    return tools.find_anomalies(region_id, granularity, min_percentile, top_n)


@mcp.tool(title="Evidence for a period", annotations=RO_WEB)
def get_period_evidence(region_id: str, period: str) -> dict:
    """Detections behind one calendar cell: daily counts per sensor, strongest detections, day/night and
    NRT/science-quality split, plus NASA FIRMS and Worldview links."""
    return tools.evidence(region_id, period)


@mcp.tool(title="Harmonization audit", annotations=RO)
def audit_sensor_harmonization(region_id: str) -> dict:
    """Calibration factors per sensor link, hold-out validation, denial experiments, step tests at each VIIRS launch,
    placebo steps, trends, drift and full provenance."""
    return tools.audit(region_id)


@mcp.tool(title="Method and rules", annotations=RO)
def get_method() -> dict:
    """How the record, early warning and outlook are computed, with their exact rules and limits."""
    return {"early_warning_rule": sc.WARNING_RULE, "outlook_rule": sc.OUTLOOK_RULE, "guardrails": personas.GUARDRAILS,
            "unit": "hotspots on the Aqua MODIS scale (vegetation fires; static sources separated)",
            "recent_weighted_baseline_half_life_years": sc.HALF_LIFE_YEARS,
            "data": "NASA FIRMS MODIS C6.1 and VIIRS 375 m (SP + NRT) via the Portolan GeoParquet mirror on Source Cooperative"}


# ---------- news and events ----------

@mcp.tool(title="Reports for a period", annotations=RO_WEB)
def search_fire_reports(region_id: str, period: str) -> dict:
    """Reports from NASA EONET, GDELT, Google News and GDACS for a built area and period, with an evidence-aware
    assessment. Missing reports are never treated as evidence of absence."""
    return tools.reports(region_id, period)


@mcp.tool(title="Reports over months", annotations=RO_WEB)
def search_timeline_reports(region_id: str, start: str, end: str) -> dict:
    """Reports for a month range ('YYYY-MM' to 'YYYY-MM'), each month matched against the harmonized record, with a
    rule-based verdict on how far news agrees with the satellite anomalies."""
    return tools.timeline_reports(region_id, start, end)


@mcp.tool(title="News for any place", annotations=RO_WEB)
def search_news_for_place(place: str, start: str = "", end: str = "") -> dict:
    """Fire news and events for ANY place name and date window (default the last 30 days): Google News in local
    languages, GDELT, NASA EONET and GDACS. No built area needed."""
    b = _date(end, dt.date.today())
    r = news_more.search_place(place, _date(start, b - dt.timedelta(days=30)), b)
    return {**r, "items": r["items"][:80]}


@mcp.tool(title="Latest fire news worldwide", annotations=RO_WEB)
def get_latest_fire_news(days: int = 3, limit: int = 60) -> dict:
    """Wildfire headlines and events of the last 1-30 days worldwide: Google News in 7 languages, GDACS and EONET."""
    r = news_more.latest(days)
    return {**r, "items": r["items"][:max(1, min(limit, 300))]}


@mcp.tool(title="GDACS wildfire events", annotations=RO_WEB)
def get_gdacs_wildfires(start: str = "", end: str = "", west: float | None = None, south: float | None = None,
                        east: float | None = None, north: float | None = None) -> dict:
    """GDACS (EU JRC / UN) wildfire events with alert level and burned area (GWIS), optionally inside a box.
    Default window: the last 60 days."""
    b = _date(end, dt.date.today())
    box = [west, south, east, north] if None not in (west, south, east, north) else None
    items, url = news_more.gdacs(_date(start, b - dt.timedelta(days=60)), b, box)
    return {"source": url, "count": len(items), "events": items}


# ---------- alerts ----------

def _base():
    return os.environ.get("PUBLIC_URL", "http://127.0.0.1:8000")


@mcp.tool(title="Email alert", annotations=WRITE)
def subscribe_email_alert(email: str, west: float, south: float, east: float, north: float, name: str = "",
                          ratio: float = 1.0, anomaly: bool = True, outlook_watch: bool = True, new_events: bool = True) -> dict:
    """Email alert for ANY box (up to 16 square degrees). Triggers: anomaly (month so far tops `ratio` x the median of
    the same days in earlier years), outlook_watch (30-day outlook has watch cells), new_events (new NASA EONET
    wildfire in the box). A confirmation link is emailed first; nothing is sent until it is clicked. Returns a
    secret token (keep it private)."""
    from . import alerts
    trig = [t for t, on in (("anomaly", anomaly), ("outlook", outlook_watch), ("events", new_events)) if on]
    return alerts.create(bbox=[west, south, east, north], name=name or None, ratio=ratio, email=email, triggers=trig,
                         base_url=_base())


@mcp.tool(title="Alert without email", annotations=WRITE)
def create_alert(west: float, south: float, east: float, north: float, name: str = "", ratio: float = 1.0) -> dict:
    """Alert for ANY box without email (for n8n or polling): triggers when the month so far tops `ratio` x the median
    of the same days in earlier years. Returns a secret token for check_alert."""
    from . import alerts
    return alerts.create(bbox=[west, south, east, north], name=name or None, ratio=ratio, base_url=_base())


@mcp.tool(title="Check an alert", annotations=RO_WEB)
def check_alert(token: str) -> dict:
    """State of an alert: building, or ready with triggered true/false, the outlook in its box and open events."""
    from . import alerts
    return alerts.check(token)


@mcp.tool(title="Delete an alert", annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=True))
def delete_alert(token: str) -> dict:
    """Delete an alert and stop its emails."""
    from . import alerts
    return alerts.delete(token)


# ---------- characters (prompts) ----------

def _persona(pid, task):
    return personas.system_prompt(pid) + "\n\n---\n\nTask: " + task


@mcp.prompt(name="fire_manager", title="Ember, fire operations officer")
def fire_manager(place: str = "the area I care about") -> str:
    """Operational 30-day fire brief for a place: level, where to watch, actions to consider."""
    return _persona("fire-manager", f"Give me an operational fire brief for {place}: is this month unusual, what do the "
                    "next 30 days usually bring, where are the watch cells, what is being reported, and what should I consider doing?")


@mcp.prompt(name="fire_scientist", title="Dr. Vega, remote-sensing scientist")
def fire_scientist(region: str = "punjab") -> str:
    """Scientific audit of the MODIS-VIIRS harmonization for an area."""
    return _persona("fire-scientist", f"Audit the harmonized record for '{region}': calibration links, hold-out and "
                    "denial validation, step tests at the VIIRS launches (raw vs harmonized annual series), trend, and the "
                    "main limitations. Use a small table for the validation metrics.")


@mcp.prompt(name="fact_checker", title="Scout, news fact-checker")
def fact_checker(claim: str = "A headline says this fire season is the worst on record.") -> str:
    """Check a fire claim or headline against the satellite record and the news."""
    return _persona("fact-checker", f"Check this claim against the satellite record and reports: \"{claim}\". Find the "
                    "place, pull the numbers for the right dates, list matching reports, and give a verdict.")


@mcp.prompt(name="community_liaison", title="Sentinel, community early-warning liaison")
def community_liaison(place: str = "my district", language: str = "English") -> str:
    """Plain-language fire bulletin for a community, in their language."""
    return _persona("community-liaison", f"Write a short fire bulletin for people living around {place}, in {language}. "
                    "Three lines that can be read aloud or sent by SMS, the dates it covers, and the caveat in plain words.")


# ---------- resources ----------

@mcp.resource("kilnwatch://about", name="About Kiln Watch", mime_type="text/markdown")
def about() -> str:
    return ("# Kiln Watch\n\n" + INSTRUCTIONS + "\n\n## Early-warning rule\n" + sc.WARNING_RULE
            + "\n\n## Outlook rule\n" + sc.OUTLOOK_RULE + "\n\nData: NASA FIRMS (MODIS C6.1, VIIRS 375 m) via the "
            "Portolan mirror on Source Cooperative; imagery NASA GIBS; events NASA EONET and GDACS. Not an official NASA product.")


@mcp.resource("kilnwatch://personas", name="Claude characters", mime_type="application/json")
def personas_res() -> str:
    return json.dumps(personas.public(), ensure_ascii=False, indent=1)


@mcp.resource("kilnwatch://regions", name="Built areas", mime_type="application/json")
def regions_res() -> str:
    return json.dumps(tools.list_regions(), ensure_ascii=False)


@mcp.resource("kilnwatch://outlook", name="Worldwide 30-day outlook (summary)", mime_type="application/json")
def outlook_res() -> str:
    return json.dumps(get_fire_outlook(limit=50), ensure_ascii=False)


@mcp.resource("kilnwatch://region/{region_id}/brief", name="Situation brief for an area", mime_type="text/markdown")
def brief_res(region_id: str) -> str:
    return tools.briefing(region_id)["markdown"]


if __name__ == "__main__":
    mcp.run(transport="streamable-http" if "--http" in sys.argv else "stdio")
