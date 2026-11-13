"""Deterministic query functions shared by the REST API, the MCP server and the Gemini agent.

Every number these return is read from build outputs or computed from cached NASA FIRMS rows — never generated.
"""
import datetime as dt
import functools
import hashlib
import json
import math
import os
import threading
import time

import duckdb

from . import news
from . import science as sc
from .build import OUT, build_region, write_index
from .firms import CACHE, CONF_SQL, LIVE_TTL_S, SENSORS, connect, fetch_year
from .regions import PRESETS, validate_bbox


SERVERLESS = bool(os.environ.get("KW_SERVERLESS"))  # set by api/index.py (Vercel): read-only snapshot, no long jobs


class NotFound(Exception):
    pass


def _read(region_id, name):
    f = OUT / region_id / f"{name}.json"
    if "/" in region_id or "\\" in region_id or ".." in region_id or not f.exists():
        raise NotFound(f"unknown region '{region_id}'")
    return _read_cached(str(f), f.stat().st_mtime)


@functools.lru_cache(maxsize=64)
def _read_cached(path, _mtime):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def list_regions():
    f = OUT / "index.json"
    return json.loads(f.read_text(encoding="utf-8"))["regions"] if f.exists() else []


def region_summary(region_id):
    m = _read(region_id, "meta")
    val = next(v for v in m["validation"]["veg_det_D"] if v["sensor"] == "VIIRS_SNPP")
    strip = lambda d: {k: v for k, v in (d or {}).items() if k != "series"}  # noqa: E731
    return {
        "id": m["id"], "name": m["name"], "country": m["country"], "bbox": m["bbox"], "story": m.get("story"),
        "data_through": m["data_through"], "unit": m["estimand"]["primary"], "answers": m["answers"]["sentences"],
        "current_period": m.get("current"), "trend_2003_2020": m["trend"]["2003-2020"], "trend_full": m["trend"]["full"],
        "steps": m["steps"], "placebo_steps": m.get("placebo"),
        "modis_denial_test": strip(m["denial"]["modis_ends_2016"]), "snpp_withheld_test": strip(m["denial"]["snpp_withheld"]),
        "snpp_to_aqua_daytime_holdout": val, "transfer_validation": m.get("transfer_validation"),
        "season": {k: (m["season"] or {}).get(k) for k in ("median", "trend", "next_4_weeks_share_pct", "year_to_date")},
        "totals": m["totals"], "satellites_last_observed": {s: v["last"] for s, v in m["sensors"].items()},
    }


def _block(region_id, granularity):
    if granularity not in ("month", "week"):
        raise ValueError("granularity must be 'month' or 'week'")
    return _read(region_id, "monthly" if granularity == "month" else "weekly")


RAW_OBS = ("MODIS_T", "MODIS_A", *[s for s in SENSORS if s != "MODIS"])


def _period_row(b, i, cls="veg"):
    c = b["classes"][cls]
    pick = lambda s: {"value": s["v"][i], "ci95": [s["lo"][i], s["hi"][i]]}  # noqa: E731
    h = c["history"]
    return {
        "period": b["periods"][i], "partial": b["partial"][i], "provisional": b["provisional"][i],
        "hotspots_aqua_scale": pick(c["hotspots"]),
        "hotspots_viirs_scale": {**pick(c["viirs_scale"]), "modelled": c["viirs_scale"]["modelled"][i]},
        "fire_celldays_aqua_scale": pick(c["celldays"]),
        "aqua_only_hotspots": c["aqua_only"][i],
        "vs_history": {"median_same_period": h["median"][i], "ratio_to_median": h["ratio"][i],
                       "percentile": h["pct"][i], "rank": h["rank"][i], "of_years": h["n"][i],
                       "recent_weighted": {"median": h.get("wmedian", [None] * (i + 1))[i], "ratio": h.get("wratio", [None] * (i + 1))[i],
                                           "percentile": h.get("wpct", [None] * (i + 1))[i], "half_life_years": sc.HALF_LIFE_YEARS}},
        "satellites_used": c["hotspots"]["sensors"][i],
        "coverage": {s: b["coverage"][s][i] for s in b["coverage"]},
        "raw_detections": {s: b["raw"][s]["det"][i] for s in RAW_OBS},
        "raw_detections_all_satellites": b["raw"]["all_det"][i],
        "static_source_hotspots_aqua_scale": b["classes"]["static"]["hotspots"]["v"][i],
        "nrt_share": b["nrt_share"][i],
    }


def get_period(region_id, period, cls="veg"):
    b = _block(region_id, "week" if "-W" in period else "month")
    if period not in b["periods"]:
        raise NotFound(f"period '{period}' not in record ({b['periods'][0]} … {b['periods'][-1]})")
    return _period_row(b, b["periods"].index(period), cls)


def get_calendar(region_id, granularity="month", start=None, end=None, cls="veg"):
    b = _block(region_id, granularity)
    rows = [_period_row(b, i, cls) for i, p in enumerate(b["periods"])
            if (not start or p >= start) and (not end or p <= end)]
    return {"region": region_id, "granularity": granularity, "class": cls, "rows": rows}


def find_anomalies(region_id, granularity="month", min_percentile=90.0, top_n=10):
    """Periods ranking highest against the same month/week in other years (percentile, then ratio to median)."""
    b = _block(region_id, granularity)
    h = b["classes"]["veg"]["history"]
    idx = [i for i, p in enumerate(h["pct"]) if p is not None and p >= min_percentile]
    idx.sort(key=lambda i: (-h["pct"][i], -(h["ratio"][i] or 0)))
    return [_period_row(b, i) for i in idx[:top_n]]


def audit(region_id):
    m = _read(region_id, "meta")
    return {k: m.get(k) for k in ("estimand", "method", "calibration", "closure", "validation", "transfer_validation",
                                  "denial", "interval_scale", "steps", "placebo", "trend", "drift", "frp_distribution",
                                  "filter_sensitivity", "versions", "provenance", "sensors")}


def _cache_files(region_id, bbox, a, b):
    files = []
    for y in range(a.year, b.year + 1):
        f = CACHE / region_id / f"{y}.parquet"
        if not f.exists():  # fresh deploy without the raw cache: pull just this year
            f.parent.mkdir(parents=True, exist_ok=True)
            fetch_year(connect(), bbox, y, f)
        files.append(f.as_posix())
    return files


def _detections(con, region_id, bbox, a, b):
    mask = (OUT / region_id / "mask.parquet").as_posix()
    con.execute(f"""CREATE OR REPLACE TABLE e AS
        SELECT r.*, CASE WHEN r.type IN (1,2,3) THEN 'static' WHEN r.type = 0 THEN 'veg'
                         WHEN k.fy IS NOT NULL THEN 'static' ELSE 'veg' END AS cls, {CONF_SQL} AS conf_ok
        FROM (SELECT *, floor(lat * 100)::INT AS fy, floor(lon * 100)::INT AS fx
              FROM read_parquet({_cache_files(region_id, bbox, a, b)})) r
        LEFT JOIN read_parquet('{mask}') k USING (fy, fx)
        WHERE acq_date BETWEEN DATE '{a}' AND DATE '{b}'""")


def evidence(region_id, period):
    """Detections behind one calendar cell, straight from the cached FIRMS rows."""
    m = _read(region_id, "meta")
    a, b = sc.period_bounds(period)
    con = duckdb.connect()
    _detections(con, region_id, m["bbox"], a, b)
    daily = con.execute("""SELECT acq_date::VARCHAR, sensor, cls, count(*), round(sum(frp), 1) FROM e WHERE conf_ok
                           GROUP BY ALL ORDER BY 1""").fetchall()
    top = con.execute("""SELECT strftime(acq_datetime, '%Y-%m-%d %H:%M'), satellite, sensor, daynight, quality, version,
                                cls, lat, lon, round(frp, 1), confidence, scan, track
                         FROM e WHERE conf_ok ORDER BY frp DESC NULLS LAST LIMIT 25""").fetchall()
    split = con.execute("SELECT cls, daynight, quality, count(*) FROM e WHERE conf_ok GROUP BY ALL").fetchall()
    peak = con.execute("""SELECT acq_date::VARCHAR, count(*) FROM e WHERE conf_ok AND cls = 'veg'
                          GROUP BY 1 ORDER BY 2 DESC LIMIT 1""").fetchone()
    dropped = con.execute("SELECT count(*) FILTER (WHERE NOT conf_ok), count(*) FROM e").fetchone()
    w, s, e_, n = m["bbox"]
    day = peak[0] if peak else str(a)
    cx, cy = (w + e_) / 2, (s + n) / 2
    return {
        "region": region_id, "period": period, "start": str(a), "end": str(b),
        "daily": [{"date": d, "sensor": se, "class": c, "detections": k, "frp_mw": f} for d, se, c, k, f in daily],
        "top_detections": [dict(zip(("time_utc", "satellite", "sensor", "daynight", "quality", "version", "class",
                                     "lat", "lon", "frp_mw", "confidence", "scan", "track"), r)) for r in top],
        "split": [{"class": c, "daynight": dn, "quality": q, "detections": k} for c, dn, q, k in split],
        "peak_day": peak and {"date": peak[0], "detections": peak[1]},
        "low_confidence_excluded": {"excluded": dropped[0], "of": dropped[1]},
        "links": {
            "firms_map": f"https://firms.modaps.eosdis.nasa.gov/map/#d:{day}..{day};@{cx:.2f},{cy:.2f},8.0z",
            "worldview": (f"https://worldview.earthdata.nasa.gov/?v={w},{s},{e_},{n}&t={day}"
                          "&l=VIIRS_NOAA20_Thermal_Anomalies_375m_All,MODIS_Combined_Thermal_Anomalies_All,"
                          "VIIRS_NOAA20_CorrectedReflectance_TrueColor,Coastlines_15m"),
        },
        "note": "Coordinates are pixel centres, not fire locations. Low-confidence detections are excluded, as in "
                "the calendar.",
    }


def hotspots_csv(region_id, start, end):
    """The detections behind the calendar: FIRMS columns plus satellite, static-source flag and version."""
    m = _read(region_id, "meta")
    a, b = dt.date.fromisoformat(start), dt.date.fromisoformat(end)
    if b < a or (b - a).days > 366:
        raise ValueError("date range must be 1–366 days")
    con = duckdb.connect()
    _detections(con, region_id, m["bbox"], a, b)
    cur = con.execute("""SELECT lat AS latitude, lon AS longitude, strftime(acq_datetime, '%Y-%m-%d') AS acq_date,
                                strftime(acq_datetime, '%H%M') AS acq_time, satellite, sensor, confidence, version, quality,
                                frp, daynight, scan, track, type, cls = 'static' AS static_source,
                                conf_ok AS used_in_calendar
                         FROM e ORDER BY acq_datetime""")
    cols = [d[0] for d in cur.description]
    lines = [",".join(cols)]
    for row in cur.fetchall():
        lines.append(",".join("" if v is None else str(v) for v in row))
    return "\n".join(lines) + "\n"


def reports(region_id, period):
    m = _read(region_id, "meta")
    hist = None
    try:
        hist = get_period(region_id, period)["vs_history"]
    except NotFound:
        pass
    return news.reports(m, period, hist)


def timeline_reports(region_id, start, end):
    """News/event reports for a month range ('YYYY-MM'..'YYYY-MM'), each month matched against the record."""
    if not all(len(x) == 7 and x[4] == "-" for x in (start, end)) or start > end:
        raise ValueError("start and end must be 'YYYY-MM' months with start <= end")
    b, m = _block(region_id, "month"), _read(region_id, "meta")
    h, v = b["classes"]["veg"]["history"], b["classes"]["veg"]["hotspots"]["v"]
    wp, wr = h.get("wpct") or [None] * len(v), h.get("wratio") or [None] * len(v)
    months = [{"period": p, "value": v[i], "percentile": h["pct"][i], "recent_percentile": wp[i], "ratio": h["ratio"][i],
               "recent_ratio": wr[i], "rank": h["rank"][i], "of_years": h["n"][i], "partial": b["partial"][i]}
              for i, p in enumerate(b["periods"]) if start <= p <= end]
    if not months:
        raise NotFound(f"no months between {start} and {end} in the record")
    from . import agent  # late import: agent imports this module
    classify = agent.classify_headlines if agent.available() else None
    return news.timeline(m, sc.period_bounds(months[0]["period"])[0], sc.period_bounds(months[-1]["period"])[1], months,
                         weekly=_block(region_id, "week"), classify=classify)


# ---------- early warning ----------

LEVELS = ("elevated", "watch", "normal", "quiet", "insufficient")


def _next_weeks(b, k=4):
    """Typical total of the next k weeks (10th/50th/90th percentile over earlier years) and the weeks themselves."""
    h = b["classes"]["veg"]["hotspots"]["v"]
    pos = {p: i for i, p in enumerate(b["periods"])}
    y0, w0 = int(b["periods"][-1][:4]), int(b["periods"][-1][6:])
    weeks = [((w0 + j - 1) % 52 + 1, y0 + (w0 + j - 1) // 52) for j in range(1, k + 1)]  # ponytail: skips ISO week 53
    sums = []
    for dy in range(1, y0 - int(b["periods"][0][:4]) + 1):
        idx = [pos.get(f"{y - dy}-W{w:02d}") for w, y in weeks]
        if all(i is not None and h[i] is not None and not b["partial"][i] for i in idx):
            sums.append(sum(h[i] for i in idx))
    q = sc.quantiles(sums, 11) if len(sums) >= 8 else None
    return {"weeks": [f"W{w:02d}" for w, _ in weeks], "years_used": len(sums),
            "p10": q and round(q[1]), "median": q and round(q[5]), "p90": q and round(q[9])}


def early_warning(region_id):
    """Climatological outlook: this month and recent weeks against the same days in earlier years, plus the usual
    next four weeks. Deterministic and explainable; not a forecast and not an official alert."""
    m, wk = _read(region_id, "meta"), _read(region_id, "weekly")
    cur, season = m.get("current"), m.get("season")
    prior = [v for _, v in (cur or {}).get("prior", [])]
    pct_m = sc.percentile_rank(cur["value"], prior) if cur else None
    hist = wk["classes"]["veg"]["history"]
    recent = [{"period": p, "value": wk["classes"]["veg"]["hotspots"]["v"][i], "percentile": hist["pct"][i],
               "median": hist["median"][i], "partial": wk["partial"][i]}
              for i, p in enumerate(wk["periods"]) if i >= len(wk["periods"]) - 12]
    complete = [r for r in recent if not r["partial"] and r["percentile"] is not None]
    pct_w = complete[-1]["percentile"] if complete else None
    typical = sorted(y["total"] for y in (season or {}).get("years", []))
    typical_total = typical[len(typical) // 2] if typical else 0
    scale = max(cur["value"], cur["median"]) if cur else 0
    level = sc.warning_level(pct_m, pct_w, typical_total, len(prior), scale)
    nxt = _next_weeks(wk)
    ytd = (season or {}).get("year_to_date")
    share = (season or {}).get("next_4_weeks_share_pct")
    age = (dt.date.today() - dt.date.fromisoformat(m["data_through"])).days
    head = {
        "insufficient": ("Not scored: too few hotspots at this time of year to rank this month against earlier ones."
                         if typical_total >= 100 and len(prior) >= 10 else
                         "Not scored: a typical year here has fewer than 100 hotspots, or fewer than 10 earlier years exist."),
        "elevated": f"{cur and cur['sentence']} That is in the top tenth of earlier years.",
        "watch": f"{cur and cur['sentence']} Above normal, not yet in the top tenth.",
        "normal": f"{cur and cur['sentence']} Within the normal range.",
        "quiet": f"{cur and cur['sentence']} Among the quietest for this time of year.",
    }[level]
    return {
        "region_id": region_id, "name": m["name"], "country": m["country"], "level": level, "headline": head,
        "as_of": m["data_through"], "stale": age > 7, "rule": sc.WARNING_RULE,
        "month": cur and {"period": cur["period"], "days": cur["days"], "value": cur["value"], "ci95": [cur["lo"], cur["hi"]],
                          "median_same_days": cur["median"], "percentile": pct_m, "rank": cur["rank"],
                          "of_years": cur["n_prior"] + 1},
        "latest_complete_week_percentile": pct_w, "recent_weeks": recent,
        "next_4_weeks": {**nxt, "usual_share_of_year_pct": share},
        "year_to_date": ytd,
        "caveat": "Climatological outlook from harmonized satellite detections. It compares with earlier years and "
                  "does not forecast weather, fire behaviour or burned area. Not an official alert; detections are "
                  "not confirmed fires. Recent days may be near-real-time and are provisional.",
    }


def warnings(min_level=None):
    """Early-warning status for every area, most serious first. min_level keeps that level and worse."""
    if min_level is not None and min_level not in LEVELS[:3]:
        raise ValueError("min_level must be elevated, watch or normal")
    out, as_of = [], None
    for r in list_regions():
        try:
            w = early_warning(r["id"])
            as_of = max(as_of or "", w["as_of"])
        except (NotFound, KeyError, StopIteration):
            continue  # area built before a field existed; skipped, not guessed
        if min_level is None or LEVELS.index(w["level"]) <= LEVELS.index(min_level):
            out.append({k: w[k] for k in ("region_id", "name", "country", "level", "headline", "as_of", "stale")}
                       | {"percentile": (w["month"] or {}).get("percentile"), "next_4_weeks_median": w["next_4_weeks"]["median"]})
    out.sort(key=lambda a: (LEVELS.index(a["level"]), -(a["percentile"] or 0)))
    return {"as_of": as_of, "count": len(out), "alerts": out,
            "rule": sc.WARNING_RULE, "disclaimer": "Climatological outlook, not a forecast or an official alert."}


def active_events():
    """Open NASA EONET wildfire events, each tagged with the Kiln Watch area it falls inside (if any)."""
    areas = list_regions()
    out = []
    for e in news.open_wildfires():
        hit = next((a["id"] for a in areas if a["bbox"][1] <= e["lat"] <= a["bbox"][3]
                    and (a["bbox"][0] <= e["lon"] <= a["bbox"][2] if a["bbox"][0] <= a["bbox"][2]
                         else e["lon"] >= a["bbox"][0] or e["lon"] <= a["bbox"][2])), None)
        out.append({**e, "region_id": hit})
    return {"source": "NASA EONET (open wildfire events)", "count": len(out), "events": out,
            "note": "Events are what agencies and media reported to EONET. Few events does not mean few fires."}

# ---------- custom areas ----------

_jobs, _jobs_lock, _build_slots = {}, threading.Lock(), threading.Semaphore(2)


def aoi_id(bbox):
    w, s, e, n = validate_bbox(bbox)
    return "aoi-" + hashlib.sha1(f"{w:.2f},{s:.2f},{e:.2f},{n:.2f}".encode()).hexdigest()[:10]


def start_aoi(bbox, name=None):
    bbox = validate_bbox(bbox)
    rid = aoi_id(bbox)
    with _jobs_lock:
        job = _jobs.get(rid)
        if job and job["status"] == "running":
            return {"id": rid, **job}
        if (OUT / rid / "meta.json").exists():
            return {"id": rid, "status": "ready"}
        if SERVERLESS:  # a build runs for minutes in a background thread; serverless functions freeze after replying
            raise ValueError("Building a new area takes a few minutes, longer than this hosted demo allows. The prebuilt "
                             "areas all work here; run Kiln Watch with Docker (see the README) to build any place.")
        _jobs[rid] = {"status": "running", "done": 0, "total": 0, "stage": "queued", "error": None}

    def run():
        with _build_slots:
            try:
                w, s, e, n = bbox
                place = news.reverse_geocode((s + n) / 2, ((w + e) / 2) if w <= e else ((w + e + 360) / 2 - 360))
                info = {"name": name or place.get("name") or f"Custom area {rid[4:]}", "country": place.get("country"),
                        "bbox": bbox, "places": place.get("places", []), "lang": place.get("lang", ["en"]),
                        "story": "Custom area drawn on the map."}

                def progress(y, d, t):
                    _jobs[rid].update(done=d, total=t, stage=f"reading {y}")

                build_region(rid, info, progress)
                write_index()
                _jobs[rid].update(status="ready", stage="ready")
            except Exception as ex:  # surfaced to the UI, never swallowed
                _jobs[rid].update(status="error", error=str(ex))

    threading.Thread(target=run, daemon=True).start()
    return {"id": rid, **_jobs[rid]}


def is_built(rid):
    return (OUT / rid / "meta.json").exists()


def refresh_if_stale(rid):
    """Keep any area live: when its record is older than the FIRMS cache TTL, rebuild it in the background (only the
    current year is re-read) and keep serving the old record meanwhile. Returns True while a rebuild is running."""
    if SERVERLESS:  # serves the deployed snapshot; a frozen background thread would only waste compute
        return False
    m = _read(rid, "meta")
    age = time.time() - dt.datetime.fromisoformat(m["built_at"]).timestamp()
    with _jobs_lock:
        job = _jobs.get(rid)
        if job and job["status"] == "running":
            return True
        if age < LIVE_TTL_S or (job and job["status"] == "error" and time.time() - job.get("at", 0) < 3600):
            return False  # fresh enough, or a refresh failed within the hour: do not hammer the mirror
        _jobs[rid] = {"status": "running", "done": 0, "total": 0, "stage": "refreshing", "error": None}
    info = {k: m.get(k) for k in ("name", "country", "story", "places", "lang")} | {"bbox": m["bbox"]}

    def run():
        with _build_slots:
            try:
                build_region(rid, info, lambda y, d, t: _jobs[rid].update(done=d, total=t, stage=f"reading {y}"))
                write_index()
                _jobs[rid].update(status="ready", stage="ready")
            except Exception as ex:  # old record stays; error is reported and retried after an hour
                _jobs[rid].update(status="error", error=str(ex), at=time.time())

    threading.Thread(target=run, daemon=True).start()
    return True


def aoi_status(rid):
    if rid in _jobs:
        return {"id": rid, **_jobs[rid]}
    if (OUT / rid / "meta.json").exists():
        return {"id": rid, "status": "ready"}
    raise NotFound(rid)


# ---------- any box, any dates: straight from the global aggregate ----------

MAX_QUERY_DEG2 = 400  # 20 x 20 degrees


def _box_sql(w, s, e, n):
    lon = (f"gx >= {math.floor(w * 10)} AND gx < {math.ceil(e * 10)}" if w <= e
           else f"(gx >= {math.floor(w * 10)} OR gx < {math.ceil(e * 10)})")
    return f"gy >= {math.floor(s * 10)} AND gy < {math.ceil(n * 10)} AND {lon}"


def global_hotspots(bbox, start, end):
    """Raw FIRMS detections for ANY box and date range (up to 366 days, 400 square degrees), per day and satellite,
    from the whole-Earth 0.1-degree aggregate. Raw counts: compare satellites within a day, not across eras."""
    from .globe import OUT as GLOBAL
    w, s, e, n = (float(v) for v in bbox)
    if not (-180 <= w <= 180 and -180 <= e <= 180 and -90 <= s < n <= 90):
        raise ValueError("bbox out of range")
    if ((e - w) if e > w else (e + 360 - w)) * (n - s) > MAX_QUERY_DEG2:
        raise ValueError(f"box must be at most {MAX_QUERY_DEG2} square degrees")
    a, b = dt.date.fromisoformat(str(start)), dt.date.fromisoformat(str(end))
    if b < a or (b - a).days > 366:
        raise ValueError("date range must be 1-366 days")
    files = [f.as_posix() for y in range(a.year, b.year + 1) if (f := GLOBAL / f"agg-{y}.parquet").exists()]
    if not files:
        raise NotFound("the global aggregate is not on this server (python -m kw.globe); use a built area instead")
    con = duckdb.connect()
    con.execute("SET enable_progress_bar = false")
    src = f"""(SELECT *, CASE WHEN sensor = 'MODIS' THEN 'MODIS_' || sat ELSE sensor END AS satellite
               FROM read_parquet({files}) WHERE ok AND acq_date BETWEEN DATE '{a}' AND DATE '{b}' AND {_box_sql(w, s, e, n)})"""
    daily = con.execute(f"""SELECT acq_date::VARCHAR, satellite, sum(n) FILTER (WHERE tcls <> 's')::INT,
                                   sum(n) FILTER (WHERE tcls = 's')::INT, round(sum(frp), 1)
                            FROM {src} GROUP BY ALL ORDER BY 1, 2""").fetchall()
    top = con.execute(f"""SELECT gy, gx, sum(n)::INT AS k, round(sum(frp), 1) FROM {src} WHERE tcls <> 's'
                          GROUP BY ALL ORDER BY k DESC LIMIT 10""").fetchall()
    con.close()
    tot = {}
    for _, sat, v, st, _f in daily:
        t = tot.setdefault(sat, {"vegetation": 0, "static_typed": 0})
        t["vegetation"] += v or 0
        t["static_typed"] += st or 0
    return {
        "bbox": [w, s, e, n], "start": str(a), "end": str(b),
        "totals_by_satellite": tot,
        "daily": [{"date": d, "satellite": sat, "detections": v or 0, "static_typed": st or 0, "frp_mw": f} for d, sat, v, st, f in daily],
        "top_cells": [{"lat": round((gy + 0.5) / 10, 2), "lon": round((gx + 0.5) / 10, 2), "detections": k, "frp_mw": f}
                      for gy, gx, k, f in top],
        "note": "Raw detections (confidence-filtered), not harmonized: each satellite sees different numbers, so compare "
                "one satellite across days or build the area for the harmonized 2000-present record. Static sources are "
                "only removed where FIRMS typed them (recent near-real-time rows are untyped).",
    }


def annual(region_id):
    """Per complete year: harmonized hotspots (Aqua scale) next to raw detections of all satellites, the series that
    shows why harmonization matters (raw jumps at each VIIRS launch)."""
    b = _block(region_id, "month")
    v, raw, aqua = b["classes"]["veg"]["hotspots"]["v"], b["raw"]["all_det"], b["classes"]["veg"]["aqua_only"]
    years = {}
    for i, p in enumerate(b["periods"]):
        y = years.setdefault(int(p[:4]), {"n": 0, "h": 0.0, "r": 0, "a": 0.0, "ok": True})
        y["n"] += 1
        y["ok"] &= not b["partial"][i] and v[i] is not None
        y["h"] += v[i] or 0
        y["r"] += raw[i] or 0
        y["a"] += aqua[i] or 0
    return [{"year": y, "harmonized": round(d["h"]), "raw_all_satellites": d["r"], "aqua_only": round(d["a"]),
             "complete": d["ok"] and d["n"] == 12} for y, d in sorted(years.items())]


def _iso_week(season, offset):
    return (season["fire_year_start_week"] - 1 + offset) % 52 + 1


def season_profile(region_id):
    m = _read(region_id, "meta")
    s = m.get("season")
    if not s:
        return {"region_id": region_id, "season": None, "note": "too few hotspots to define a fire season"}
    med = s["median"]
    return {"region_id": region_id, "name": m["name"], "peak_months": m["answers"]["peak_months"],
            "peak_share_pct": m["answers"]["peak_share_pct"],
            "typical_season_iso_weeks": {k: _iso_week(s, med[k]) for k in ("start", "peak", "end")},
            "season_length_weeks": med["end"] - med["start"] + 1, "trend": s["trend"],
            "next_4_weeks_share_pct": s.get("next_4_weeks_share_pct"), "year_to_date": s.get("year_to_date"),
            "definition": "start/end = weeks when 10%/90% of the fire year's hotspots have burned; the fire year starts "
                          "at the quietest week, so seasons crossing 1 January are not split"}


def compare_areas(region_ids):
    """Side by side: early-warning level, season, trend and the last 10 complete years for 2-6 built areas."""
    ids = list(dict.fromkeys(region_ids))[:6]
    if len(ids) < 2:
        raise ValueError("give 2 to 6 region ids")
    out = []
    for rid in ids:
        m = _read(rid, "meta")
        ew = early_warning(rid)
        yrs = [y for y in annual(rid) if y["complete"]][-10:]
        out.append({"region_id": rid, "name": m["name"], "level": ew["level"], "headline": ew["headline"],
                    "peak_months": m["answers"]["peak_months"], "trend_full_harmonized": m["trend"]["full"]["harmonized"],
                    "last_10_years": [{"year": y["year"], "harmonized": y["harmonized"]} for y in yrs],
                    "median_year": sorted(y["harmonized"] for y in yrs)[len(yrs) // 2] if yrs else None})
    return {"areas": out, "unit": "hotspots on the Aqua MODIS scale (harmonized)"}


def sensor_status():
    """Last day each satellite delivered data, measured from the records (never hard-coded)."""
    last = {}
    for r in list_regions():
        for s_, d in (r.get("sensors_last") or {}).items():
            last[s_] = max(last.get(s_, ""), d)
    newest = max(last.values(), default=None)
    return {"last_observed": last, "newest": newest,
            "silent_over_3_days": [s_ for s_, d in last.items() if newest and (dt.date.fromisoformat(newest) - dt.date.fromisoformat(d)).days > 3],
            "note": "Derived from the data (latest detection per satellite across all areas). Suomi-NPP's active-fire "
                    "stream ended in November 2026; Terra and Aqua orbits are drifting."}


def briefing(region_id):
    """Deterministic situation brief (markdown) for fire managers: every number from the record, nothing generated."""
    from . import outlook
    m = _read(region_id, "meta")
    ew = early_warning(region_id)
    try:
        ol = outlook.in_box(m["bbox"], limit=5)
    except Exception:
        ol = None
    ev = [e for e in active_events()["events"] if e["region_id"] == region_id][:5]
    sp = season_profile(region_id)
    t = m["trend"]["full"]["harmonized"]
    mo, nx = ew["month"], ew["next_4_weeks"]
    L = [f"# Fire situation brief: {m['name']}", f"Data through **{ew['as_of']}**. Early-warning level: **{ew['level'].upper()}**.",
         "", ew["headline"], "", "## This month"]
    if mo:
        L.append(f"- {mo['period']} so far ({mo['days']} days): **{mo['value']:.0f}** hotspots (95% interval "
                 f"{mo['ci95'][0]:.0f}-{mo['ci95'][1]:.0f}); median of the same days in earlier years **{mo['median_same_days']:.0f}**; "
                 f"rank {mo['rank']} of {mo['of_years']}.")
    if ew["latest_complete_week_percentile"] is not None:
        L.append(f"- Latest complete week: {ew['latest_complete_week_percentile']:.0f}th percentile of the same week in earlier years.")
    L += ["", "## Next 30 days (climatology, not a forecast)"]
    if nx["median"] is not None:
        L.append(f"- Usual next four weeks ({nx['weeks'][0]}-{nx['weeks'][-1]}): **{nx['median']}** hotspots "
                 f"(10th-90th percentile {nx['p10']}-{nx['p90']}).")
    if ol:
        c = ol["counts"]
        L.append(f"- Outlook grid in this area: **{c['watch']}** watch cells (season ahead and already above normal), "
                 f"{c['above']} above normal, {c['season']} in an active season; {ol['rising']} where the season usually ramps up now.")
    if sp.get("typical_season_iso_weeks"):
        w = sp["typical_season_iso_weeks"]
        L.append(f"- Typical season: starts ISO week {w['start']}, peaks week {w['peak']}, ends week {w['end']}.")
    L += ["", "## Reported events (NASA EONET, open now)"]
    L += [f"- {e['title']} ({e['date']})" for e in ev] or ["- None listed inside this area (absence of reports is not evidence of absence)."]
    L += ["", "## Long term", f"- Seasonal Mann-Kendall test on monthly harmonized hotspots, {t['years'][0]}-{t['years'][1]}: "
          f"Sen slope {t['sen_per_year']} per year, p = {t['p']}" + (" (no significant trend)." if (t["p"] or 1) >= 0.05 else "."), *[f"- {x}" for x in m["answers"]["sentences"][:2]], "",
          "_Satellite hotspots, harmonized across MODIS and VIIRS (Aqua MODIS scale). Detections are not confirmed fires "
          "and not burned area. Compared with history; not a forecast or an official alert._"]
    return {"region_id": region_id, "markdown": "\n".join(L), "level": ew["level"], "as_of": ew["as_of"]}
