"""Chart specs for the analyst, built only from pipeline outputs (the model picks a chart; it never supplies numbers).

Spec: {id, title, subtitle, unit, x: [labels], series: [{name, values, type: line|bar|band|dash, color, axis, lo, hi}],
       highlight: index or None, source: tool name, note}. Rendered by web/src/Chart.tsx.
"""
from . import tools

MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
EMBER, BLUE, GOLD, GREY = "#EA7329", "#00A1FF", "#F6C64F", "#97A3B3"
KINDS = ("annual", "month_across_years", "recent_months", "recent_weeks", "season", "anomalies", "box_daily")


def _name(rid):
    return tools._read(rid, "meta")["name"]


def annual(rid):
    rows = [r for r in tools.annual(rid) if r["complete"]]
    return {"title": "Raw detections jump with each new satellite; the harmonized record does not",
            "subtitle": f"{_name(rid)}, complete years", "unit": "hotspots per year", "x": [str(r["year"]) for r in rows],
            "series": [{"name": "Harmonized (Aqua scale)", "values": [r["harmonized"] for r in rows], "type": "line", "color": EMBER},
                       {"name": "Raw, all satellites (right axis)", "values": [r["raw_all_satellites"] for r in rows], "type": "line",
                        "color": GREY, "axis": "right", "dash": True}],
            "markers": [{"x": str(y), "label": lab} for y, lab in ((2012, "Suomi-NPP"), (2018, "NOAA-20"), (2024, "NOAA-21"))],
            "source": "get_annual_series"}


def month_across_years(rid, month):
    b = tools._block(rid, "month")
    m = int(month[-2:]) if month else int(b["periods"][-1][5:7])
    v, part = b["classes"]["veg"]["hotspots"]["v"], b["partial"]
    rows = [(p[:4], v[i], part[i]) for i, p in enumerate(b["periods"]) if int(p[5:7]) == m and v[i] is not None]
    done = sorted(x for _, x, pa in rows if not pa)
    med = done[len(done) // 2] if done else None
    sel = next((i for i, (y, _, _) in enumerate(rows) if month and y == month[:4]), len(rows) - 1)
    return {"title": f"Every {MON[m - 1]} since {rows[0][0] if rows else ''}", "subtitle": _name(rid), "unit": "hotspots, Aqua scale",
            "x": [y for y, _, _ in rows], "highlight": sel,
            "series": [{"name": f"{MON[m - 1]} hotspots", "values": [x for _, x, _ in rows], "type": "bar", "color": EMBER},
                       {"name": "Median of complete years", "values": [med] * len(rows), "type": "line", "color": "#F1F4F8", "dash": True}],
            "note": "Last bar may be a month in progress." if rows and rows[-1][2] else None, "source": "get_harmonized_calendar"}


def recent_months(rid, n=36):
    b = tools._block(rid, "month")
    c = b["classes"]["veg"]
    i0 = max(0, len(b["periods"]) - n)
    sl = slice(i0, None)
    return {"title": f"Last {len(b['periods'][sl])} months against the usual", "subtitle": _name(rid), "unit": "hotspots, Aqua scale",
            "x": [f"{MON[int(p[5:7]) - 1]} {p[2:4]}" for p in b["periods"][sl]],
            "series": [{"name": "95% interval", "type": "band", "values": c["hotspots"]["v"][sl], "lo": c["hotspots"]["lo"][sl],
                        "hi": c["hotspots"]["hi"][sl], "color": EMBER},
                       {"name": "Harmonized hotspots", "values": c["hotspots"]["v"][sl], "type": "line", "color": EMBER},
                       {"name": "Median, same month in other years", "values": c["history"]["median"][sl], "type": "line",
                        "color": "#F1F4F8", "dash": True}],
            "source": "get_harmonized_calendar"}


def recent_weeks(rid):
    w = tools.early_warning(rid)
    r = w["recent_weeks"]
    return {"title": "Last 12 weeks against the same weeks in earlier years", "subtitle": f"{w['name']} · level {w['level']}",
            "unit": "hotspots per week", "x": [x["period"][5:] for x in r], "highlight": len(r) - 1,
            "series": [{"name": "This year", "values": [x["value"] for x in r], "type": "bar", "color": EMBER},
                       {"name": "Median of earlier years", "values": [x["median"] for x in r], "type": "line", "color": "#F1F4F8", "dash": True}],
            "note": "Last week may be in progress.", "source": "get_early_warning"}


def season(rid):
    m = tools._read(rid, "meta")
    s = m.get("season")
    if not s:
        raise ValueError("no fire season defined for this area")
    w0, env, cur = s["fire_year_start_week"], s["envelope"], s["current"]["cumulative"]
    return {"title": f"Fire year {s['current']['fire_year']} so far against every earlier year", "subtitle": m["name"],
            "unit": "cumulative hotspots", "x": [f"W{(w0 - 1 + o) % 52 + 1}" for o in range(52)],
            "series": [{"name": "10th-90th percentile of earlier years", "type": "band", "values": [e[1] for e in env],
                        "lo": [e[0] for e in env], "hi": [e[2] for e in env], "color": BLUE},
                       {"name": "Median year", "values": [e[1] for e in env], "type": "line", "color": BLUE, "dash": True},
                       {"name": "This fire year", "values": cur + [None] * (52 - len(cur)), "type": "line", "color": EMBER}],
            "source": "get_season_profile"}


def anomalies(rid):
    rows = tools.find_anomalies(rid, "month", 90.0, 10)
    rows.sort(key=lambda r: r["period"])
    return {"title": "Most unusual months on record", "subtitle": _name(rid), "unit": "hotspots, Aqua scale",
            "x": [f"{MON[int(r['period'][5:7]) - 1]} {r['period'][:4]}" for r in rows],
            "series": [{"name": "Hotspots", "values": [r["hotspots_aqua_scale"]["value"] for r in rows], "type": "bar", "color": EMBER},
                       {"name": "Median of that month", "values": [r["vs_history"]["median_same_period"] for r in rows], "type": "line",
                        "color": "#F1F4F8", "dash": True}],
            "source": "find_anomalies"}


def box_daily(bbox, start, end):
    r = tools.global_hotspots(bbox, start, end)
    days = sorted({d["date"] for d in r["daily"]})
    sats = [s for s in ("VIIRS_NOAA20", "VIIRS_NOAA21", "VIIRS_SNPP", "MODIS_A") if s in r["totals_by_satellite"]]
    col = {"VIIRS_NOAA20": "#009E73", "VIIRS_NOAA21": GOLD, "VIIRS_SNPP": "#56B4E9", "MODIS_A": "#E69F00"}
    by = {(d["date"], d["satellite"]): d["detections"] for d in r["daily"]}
    return {"title": "Raw detections per day by satellite", "subtitle": f"box {', '.join(str(v) for v in r['bbox'])}",
            "unit": "detections per day", "x": [d[5:] for d in days],
            "series": [{"name": s.replace("VIIRS_", "").replace("MODIS_A", "Aqua MODIS"), "values": [by.get((d, s), 0) for d in days],
                        "type": "line", "color": col[s]} for s in sats],
            "note": "Raw counts: VIIRS sees more small fires than MODIS.", "source": "query_hotspots"}


def build(kind, region_id=None, month=None, bbox=None, start=None, end=None):
    if kind not in KINDS:
        raise ValueError(f"kind must be one of {', '.join(KINDS)}")
    if kind == "box_daily":
        spec = box_daily(bbox, start, end)
    elif not region_id:
        raise ValueError("region_id is required for this chart")
    elif kind == "month_across_years":
        spec = month_across_years(region_id, month)
    else:
        spec = globals()[kind](region_id)
    return {"id": f"{kind}:{region_id or bbox}:{month or ''}", "kind": kind, **spec}


def auto(trace_calls):
    """Charts that follow from the tools the model used, when it did not ask for one (max 2)."""
    out = []
    for name, a in trace_calls:
        rid = a.get("region_id")
        try:
            if name == "get_period" and rid:
                out.append(build("month_across_years", rid, a.get("period", "")[:7] if "-W" not in a.get("period", "") else None))
            elif name == "early_warning" and rid:
                out.append(build("recent_weeks", rid))
            elif name == "find_anomalies" and rid:
                out.append(build("anomalies", rid))
            elif name in ("region_summary", "annual_series") and rid:
                out.append(build("annual", rid))
            elif name == "timeline_reports" and rid:
                out.append(build("recent_months", rid))
            elif name == "query_hotspots":
                out.append(build("box_daily", bbox=[a["west"], a["south"], a["east"], a["north"]], start=a.get("start"), end=a.get("end")))
        except Exception:  # a chart is a bonus; never fail the answer for it
            continue
    seen, uniq = set(), []
    for c in out:
        if c["id"] not in seen:
            seen.add(c["id"])
            uniq.append(c)
    return uniq[:2]
