"""Worldwide 30-day fire-season outlook on a 0.5-degree grid, from the global aggregate (python -m kw.globe).

Aqua MODIS only: one sensor observed every year since 2003, so the comparison needs no cross-sensor calibration.
For each cell: hotspots the next 30 calendar days usually bring (earlier years), and how the last 30 days rank
against the same days in earlier years. A climatological outlook, never a forecast. Cached per data date.

Run: python -m kw.outlook   (also built lazily by the API)
"""
import datetime as dt
import json
import threading
import time

import duckdb

from . import science as sc
from .globe import OUT as GLOBAL
from .firms import current_year

FILE = GLOBAL / "outlook.json"
DEG = 0.5
FIRST = 2003  # first full Aqua year
_lock = threading.Lock()
CLASSES = {"watch": "a usually ACTIVE fire season is starting or under way in the next 30 days AND the last 30 days were already above normal",
           "above": "the last 30 days were above normal (top tenth of earlier years), but the next 30 days usually bring fewer than 5 hotspots",
           "season": "the next 30 days usually bring at least 5 hotspots; the last 30 days were not unusual",
           "rising": "the usual next 30 days are at least twice the usual last 30: the season normally ramps up now"}


def _anchor(as_of, y):
    return as_of.replace(year=y, day=28) if (as_of.month, as_of.day) == (2, 29) else as_of.replace(year=y)


def build():
    t0 = time.time()
    cy = current_year()
    files = [f.as_posix() for y in range(FIRST, cy + 1) if (f := GLOBAL / f"agg-{y}.parquet").exists()]
    if not files or not files[-1].endswith(f"agg-{cy}.parquet"):
        raise FileNotFoundError("global aggregate missing; run python -m kw.globe")
    con = duckdb.connect()
    con.execute("SET enable_progress_bar = false")
    as_of = con.execute(f"SELECT max(acq_date) FROM read_parquet('{files[-1]}') WHERE sensor = 'MODIS' AND sat = 'A'").fetchone()[0]
    wins = []
    for y in range(FIRST, cy + 1):
        a = _anchor(as_of, y)
        wins.append((y, "b", a - dt.timedelta(days=29), a))
        if y < cy:
            wins.append((y, "f", a + dt.timedelta(days=1), a + dt.timedelta(days=30)))
    con.execute("CREATE TEMP TABLE win (y INT, k VARCHAR, a DATE, b DATE)")
    con.executemany("INSERT INTO win VALUES (?, ?, ?, ?)", wins)
    k = int(DEG * 10)
    rows = con.execute(f"""
        SELECT w.y, w.k, (d.gy // {k})::INT AS cy, (d.gx // {k})::INT AS cx,
               sum(d.n) FILTER (WHERE d.tcls <> 's')::INT AS n, sum(d.n) FILTER (WHERE d.tcls = 's')::INT AS s
        FROM read_parquet({files}) d JOIN win w ON d.acq_date BETWEEN w.a AND w.b
        WHERE d.sensor = 'MODIS' AND d.sat = 'A' AND d.ok
        GROUP BY ALL""").fetchall()
    con.close()
    years = list(range(FIRST, cy))
    yi = {y: i for i, y in enumerate(years)}
    cells = {}
    for y, kind, gy, gx, n, s in rows:
        c = cells.setdefault((gy, gx), {"f": [0] * len(years), "b": [0] * len(years), "now": 0, "n": 0, "s": 0})
        n, s = n or 0, s or 0
        if y < cy:
            c["n"] += n
            c["s"] += s
        if kind == "b" and y == cy:
            c["now"] = n
        elif y in yi:
            c[kind][yi[y]] = n
    out, counts = [], {"watch": 0, "above": 0, "season": 0, "rising": 0}
    for (gy, gx), c in cells.items():
        # ponytail: recent years are mostly untyped NRT rows, so a gas flare would look "above normal"; drop cells
        # whose typed history is 30%+ static. Ceiling: a new flare field shows up until FIRMS types it.
        if c["s"] > 0.3 * (c["n"] + c["s"]):
            continue
        cls, usual, p90, pct, rising = sc.outlook_cell(c["f"], c["b"], c["now"])
        if not cls:
            continue
        counts[cls] += 1
        counts["rising"] += rising
        out.append([round((gy + 0.5) * DEG, 2), round((gx + 0.5) * DEG, 2), cls, usual, p90, c["now"], pct, int(rising),
                    round(sorted(c["b"])[len(years) // 2], 1)])
    out.sort(key=lambda r: ({"watch": 0, "above": 1, "season": 2}[r[2]], -(r[6] or 0), -r[3]))
    res = {
        "regions": _clusters(out),
        "as_of": str(as_of), "deg": DEG, "sensor": "Aqua MODIS (MCD14 C6.1 / NRT), confidence >= 30%, static sources removed",
        "next_30_days": [str(as_of + dt.timedelta(days=1)), str(as_of + dt.timedelta(days=30))],
        "last_30_days": [str(as_of - dt.timedelta(days=29)), str(as_of)], "baseline_years": [years[0], years[-1]],
        "counts": counts, "fields": ["lat", "lon", "class", "usual_next_30", "p90_next_30", "last_30", "pct_last_30",
                                     "rising", "usual_last_30"],
        "cells": out, "rule": sc.OUTLOOK_RULE, "seconds": round(time.time() - t0, 1),
        "caveat": "Climatological outlook: what the next 30 days usually bring, and how unusual the last 30 days were "
                  "against the same days since 2003. Not a forecast of weather or fire, and not an official alert. "
                  "Hotspots are satellite detections, not confirmed fires; recent days are near-real-time. Aqua's orbit "
                  "has drifted since 2022, which can shift recent counts; for one area, its harmonized record (all "
                  "five satellites) is the reference.",
    }
    tmp = FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(res, separators=(",", ":")), encoding="utf-8")
    tmp.replace(FILE)
    return res


def _clusters(cells, k=8, radius=3.0):
    """Greedy groups of watch/above cells (within `radius` degrees of the busiest remaining one), named by
    reverse geocoding the group's busiest cell. ponytail: greedy O(n*k); fine for a few thousand cells."""
    from .news import reverse_geocode
    left = [r for r in cells if r[2] in ("watch", "above")]
    left.sort(key=lambda r: (r[2] != "watch", -r[5]))
    groups = []
    while left and len(groups) < k:
        c = left[0]
        near = [r for r in left if abs(r[0] - c[0]) <= radius and abs(r[1] - c[1]) <= radius]
        left = [r for r in left if r not in near]
        if len(near) < 3:  # a lone cell is noise for a headline
            continue
        place = reverse_geocode(c[0], c[1])
        lats, lons = [r[0] for r in near], [r[1] for r in near]
        groups.append({"name": place.get("name") or f"{c[0]:.1f}°, {c[1]:.1f}°", "country": place.get("country"),
                       "lat": c[0], "lon": c[1], "cells": len(near), "watch_cells": sum(r[2] == "watch" for r in near),
                       "last_30": sum(r[5] for r in near), "usual_last_30": round(sum(r[8] for r in near)),
                       "usual_next_30": round(sum(r[3] for r in near)),
                       "bbox": [min(lons) - DEG / 2, min(lats) - DEG / 2, max(lons) + DEG / 2, max(lats) + DEG / 2]})
    return groups


_mem = {"mtime": None, "data": None}


def get(max_age_h=12):
    """The cached outlook; rebuilt when older than max_age_h and the global aggregate is present."""
    with _lock:
        fresh = FILE.exists() and time.time() - FILE.stat().st_mtime < max_age_h * 3600
        if not fresh:
            try:
                build()
            except FileNotFoundError:
                if not FILE.exists():
                    raise
        m = FILE.stat().st_mtime
        if _mem["mtime"] != m:
            _mem.update(mtime=m, data=json.loads(FILE.read_text(encoding="utf-8")))
        return _mem["data"]


def _row(r, fields):
    return dict(zip(fields, r)) | {"rising": bool(r[7])}


def in_box(bbox, limit=50):
    """Outlook cells whose centre falls inside a box (west, south, east, north), most serious first."""
    w, s, e, n = bbox
    o = get()
    hits = [r for r in o["cells"] if s <= r[0] <= n and ((w <= r[1] <= e) if w <= e else (r[1] >= w or r[1] <= e))]
    counts = {c: sum(r[2] == c for r in hits) for c in ("watch", "above", "season")}
    return {"as_of": o["as_of"], "next_30_days": o["next_30_days"], "last_30_days": o["last_30_days"], "counts": counts,
            "rising": sum(r[7] for r in hits), "cells": [_row(r, o["fields"]) for r in hits[:limit]],
            "classes": CLASSES, "rule": o["rule"], "caveat": o["caveat"]}


def at(lat, lon):
    """The outlook for the 0.5-degree cell containing a point (None fields when the cell is quiet)."""
    o = get()
    c = (round((lat // DEG + 0.5) * DEG, 2), round((lon // DEG + 0.5) * DEG, 2))
    hit = next((r for r in o["cells"] if (r[0], r[1]) == c), None)
    return {"as_of": o["as_of"], "cell_centre": list(c), "cell_deg": DEG,
            "outlook": _row(hit, o["fields"]) if hit else None,
            "note": None if hit else "Quiet cell: the next 30 days usually bring fewer than 5 Aqua MODIS hotspots and "
                                     "the last 30 days were not unusually high.",
            "classes": CLASSES, "rule": o["rule"], "caveat": o["caveat"]}


if __name__ == "__main__":
    r = build()
    print(r["as_of"], r["counts"], len(r["cells"]), "cells", r["seconds"], "s")
