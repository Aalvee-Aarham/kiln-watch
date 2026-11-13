"""Turn cached FIRMS detections for one area into the calendar, map grid, calibration and validation files.

    python -m kw.build                 # every preset
    python -m kw.build punjab dhaka-kilns

Primary unit: harmonized *hotspots* per period on the Aqua MODIS scale — the number of vegetation-fire
detections Aqua MODIS (early-afternoon + post-midnight orbit) would have recorded. That orbit is the only one
observed continuously from 2002 (Aqua) through Suomi-NPP, NOAA-20 and NOAA-21. Terra (morning orbit) is used only
to bridge Nov 2000 – Jun 2002, before Aqua. Day and night are calibrated separately and added.
Secondary: fire cell-days (0.1° cell × UTC day with ≥1 detection), a VIIRS-scale view (modelled before 2012),
static heat sources harmonized separately, and raw counts (labelled raw). Not burned area.
"""
import csv
import datetime as dt
import io
import json
import math
import os
import statistics
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import duckdb

from . import globe
from . import science as sc
from .firms import BASE, CACHE, CONF_SQL, DATA, SENSORS, SENSOR_START, _fresh, connect, fetch_region, fetch_year, sensor_days
from .regions import PRESETS, envelopes

OUT = DATA / "regions"
GRID_DEG = 0.1
MIN_COVERAGE = 0.25   # an observer must see >= 25% of a period's days to contribute
TRAIN_COVERAGE = 0.9  # calibration only uses periods both observers saw almost fully
STEP_WINDOW = 24
REF = "MODIS_A"
MODIS_SATS = ["MODIS_A", "MODIS_T"]
VIIRS = [s for s in SENSORS if s.startswith("VIIRS")]
OBSERVERS = [*MODIS_SATS, *VIIRS]
RAW_KEYS = ["MODIS", *OBSERVERS]
CLASSES = ("veg", "static")
DN = ("D", "N")
QTY = ("det_D", "det_N", "celldays")
LABEL = {"MODIS_A": "Aqua MODIS", "MODIS_T": "Terra MODIS", "VIIRS_SNPP": "Suomi-NPP VIIRS",
         "VIIRS_NOAA20": "NOAA-20 VIIRS", "VIIRS_NOAA21": "NOAA-21 VIIRS"}

# Calibration chain (source, reference, fit window, hold-out train, hold-out test). MODIS links stop at 2020,
# before Terra and Aqua drift off their nominal crossing times. Terra never links to VIIRS (different hour).
LINKS = [
    ("MODIS_T", "MODIS_A", ("2002-08", "2020-12"), ("2002-08", "2011-12"), ("2012-01", "2020-12")),
    ("VIIRS_SNPP", "MODIS_A", ("2012-02", "2020-12"), ("2012-02", "2016-12"), ("2017-01", "2020-12")),
    ("VIIRS_NOAA20", "VIIRS_SNPP", ("2018-05", None), ("2018-05", "2021-12"), ("2022-01", None)),
    ("VIIRS_NOAA21", "VIIRS_NOAA20", ("2024-02", None), ("2024-02", "2024-12"), ("2025-01", None)),
]
# Direct links used only to measure chain-closure error.
CLOSURE = [("VIIRS_NOAA20", "MODIS_A", ("2018-05", "2020-12")), ("VIIRS_NOAA21", "VIIRS_SNPP", ("2024-02", None))]
TRANSITIONS = {"MODIS_A": "2002-07", "VIIRS_SNPP": "2012-01", "VIIRS_NOAA20": "2018-04", "VIIRS_NOAA21": "2024-01"}


def _r(x, nd=2):
    return None if x is None else round(x, nd)


def _active(cov, i, allowed=None):
    """Aqua when it observes, else Terra (only before Aqua or during an Aqua gap); plus every observing VIIRS."""
    use = ["MODIS_A"] if cov["MODIS_A"][i] >= MIN_COVERAGE else (["MODIS_T"] if cov["MODIS_T"][i] >= MIN_COVERAGE else [])
    use += [s for s in VIIRS if cov[s][i] >= MIN_COVERAGE]
    return [s for s in use if allowed is None or s in allowed]


def _code_version():
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=Path(__file__).parent,
                                       stderr=subprocess.DEVNULL, text=True).strip()
    except Exception:
        return "unversioned"


def _collection_updated():
    try:
        with urllib.request.urlopen(f"{BASE}/collection.json", timeout=30) as r:
            return json.load(r).get("updated")
    except Exception:
        return None


# ---------------- loading & aggregation ----------------

def _load(con, region_id):
    files = (CACHE / region_id).as_posix() + "/*.parquet"
    con.execute(f"""CREATE OR REPLACE TABLE raw AS
        SELECT *, floor(lat * 100)::INT AS fy, floor(lon * 100)::INT AS fx, {CONF_SQL} AS conf_ok,
               CASE WHEN sensor = 'MODIS' THEN 'MODIS_' || left(satellite, 1) ELSE sensor END AS obs
        FROM read_parquet('{files}')""")
    # Static mask: 0.01° cells where science-quality FIRMS `type` marks most detections as volcano, static land
    # source (kilns, flares, industry) or offshore. Applied to NRT rows too, which carry no `type`.
    con.execute("""CREATE OR REPLACE TABLE mask AS
        SELECT fy, fx FROM raw WHERE type IS NOT NULL GROUP BY 1, 2
        HAVING count(*) FILTER (WHERE type IN (1, 2, 3)) >= 0.5 * count(*) AND count(*) >= 3""")
    con.execute(f"""CREATE OR REPLACE TABLE dall AS
        SELECT r.*, 1 AS n, CASE WHEN r.type IN (1, 2, 3) THEN 'static' WHEN r.type = 0 THEN 'veg'
                         WHEN m.fy IS NOT NULL THEN 'static' ELSE 'veg' END AS cls,
               floor(r.fy / {GRID_DEG * 100})::INT AS gy, floor(r.fx / {GRID_DEG * 100})::INT AS gx
        FROM raw r LEFT JOIN mask m USING (fy, fx)""")
    con.execute("CREATE OR REPLACE VIEW d AS SELECT * FROM dall WHERE conf_ok")


def _load_global(con, region_id, bbox, progress=None):
    """Same tables as _load, built from the whole-Earth aggregate (kw.globe) instead of per-area downloads.

    `dall` rows are weighted: `n` detections and summed FRP per (day, satellite, day/night, quality, version,
    class, confidence flag, 0.1° cell). 0.1° cells are kept when their centre is inside the box. Years that still
    hold untyped near-real-time rows in the box are read per detection (one small fetch) so the static-source
    mask can be applied to them exactly as for the presets.
    """
    G = globe.OUT.as_posix()
    a_files, c_files = f"{G}/agg-*.parquet", f"{G}/cells-*.parquet"
    boxes = envelopes(bbox)
    c10 = " OR ".join(f"((gx + 0.5) / 10 BETWEEN {w} AND {e} AND (gy + 0.5) / 10 BETWEEN {s} AND {n})" for w, s, e, n in boxes)
    c100 = " OR ".join(f"((fx + 0.5) / 100 BETWEEN {w} AND {e} AND (fy + 0.5) / 100 BETWEEN {s} AND {n})" for w, s, e, n in boxes)
    con.execute(f"""CREATE OR REPLACE TABLE mask AS
        SELECT fy, fx FROM read_parquet('{c_files}') WHERE {c100} GROUP BY 1, 2
        HAVING sum(n_static) >= 0.5 * sum(n_typed) AND sum(n_typed) >= 3""")
    live = [y for (y,) in con.execute(
        f"SELECT DISTINCT year(acq_date) FROM read_parquet('{a_files}') WHERE tcls = 'u' AND ({c10}) ORDER BY 1").fetchall()]
    files = [(CACHE / region_id / f"{y}.parquet") for y in live]
    (CACHE / region_id).mkdir(parents=True, exist_ok=True)
    todo = [(y, f) for y, f in zip(live, files) if not _fresh(f, y)]
    if todo:
        from concurrent.futures import ThreadPoolExecutor
        done = []

        def one(job):
            fetch_year(connect(), bbox, *job)
            done.append(job[0])
            if progress:
                progress(job[0], len(done), len(todo))
        with ThreadPoolExecutor(len(todo)) as ex:
            list(ex.map(one, todo))
    files = [f.as_posix() for f in files]
    skip = f"AND year(acq_date) NOT IN ({', '.join(map(str, live))})" if live else ""
    live_sql = f"""UNION ALL
        SELECT acq_date, sensor, left(satellite, 1), daynight, quality, version,
               CASE WHEN r.type IN (1, 2, 3) THEN 'static' WHEN r.type = 0 THEN 'veg'
                    WHEN m.fy IS NOT NULL THEN 'static' ELSE 'veg' END,
               {CONF_SQL}, floor(lat * 10)::INT, floor(lon * 10)::INT, count(*)::INT, sum(frp)
        FROM (SELECT *, floor(lat * 100)::INT AS fy, floor(lon * 100)::INT AS fx FROM read_parquet({files})) r
        LEFT JOIN mask m USING (fy, fx) GROUP BY ALL""" if live else ""
    con.execute(f"""CREATE OR REPLACE TABLE dall AS
        SELECT acq_date, sensor, sat AS satellite, daynight, quality, version,
               CASE tcls WHEN 's' THEN 'static' ELSE 'veg' END AS cls, ok AS conf_ok,
               gy::INT AS gy, gx::INT AS gx, n, frp::DOUBLE AS frp
        FROM read_parquet('{a_files}') WHERE tcls <> 'u' AND ({c10}) {skip} {live_sql}""")
    con.execute("ALTER TABLE dall ADD COLUMN obs VARCHAR")
    con.execute("UPDATE dall SET obs = CASE WHEN sensor = 'MODIS' THEN 'MODIS_' || satellite ELSE sensor END")
    con.execute("CREATE OR REPLACE VIEW d AS SELECT * FROM dall WHERE conf_ok")
    # Persistent heat sources: per 0.01° cell and year from the tallies (type 1-3 rows, plus untyped rows in mask cells).
    con.execute(f"""CREATE OR REPLACE TABLE spt AS
        SELECT fy, fx, sum(n) n, min(yr) y0, max(yr) y1, count(DISTINCT yr) ny, sum(f) / sum(n) frp, sum(nm) nm FROM (
          SELECT fy, fx, regexp_extract(filename, 'cells-(\\d+)', 1)::INT AS yr,
                 s_n + CASE WHEN m.fy IS NOT NULL THEN u_n ELSE 0 END AS n,
                 s_frp + CASE WHEN m.fy IS NOT NULL THEN u_frp ELSE 0 END AS f,
                 s_modis + CASE WHEN m.fy IS NOT NULL THEN u_modis ELSE 0 END AS nm
          FROM read_parquet('{c_files}', filename = true) c LEFT JOIN mask m USING (fy, fx) WHERE {c100}
        ) WHERE n > 0 GROUP BY 1, 2 HAVING sum(n) >= 3""")
    return live


PKEY = {False: "strftime(acq_date, '%Y-%m')",
        True: "isoyear(acq_date)::VARCHAR || '-W' || lpad(week(acq_date)::VARCHAR, 2, '0')"}


def _aggregate(con, weekly, table="d"):
    k = PKEY[weekly]
    agg = {}
    for cls, obs, p, dn, n, frp, nrt in con.execute(f"""
            SELECT cls, obs, {k}, daynight, sum(n), sum(frp), coalesce(sum(n) FILTER (WHERE quality = 'nrt'), 0)
            FROM {table} GROUP BY ALL""").fetchall():
        for key in ((cls, obs, p), (cls, "MODIS", p)) if obs.startswith("MODIS") else ((cls, obs, p),):
            rec = agg.setdefault(key, {"det_D": 0, "det_N": 0, "det": 0, "frp": 0.0, "nrt": 0, "celldays": 0})
            rec[f"det_{dn}"] += n
            rec["det"] += n
            rec["frp"] += frp or 0.0
            rec["nrt"] += nrt
    for cls, obs, p, cd in con.execute(f"""
            SELECT cls, obs, {k}, count(DISTINCT (gy, gx, acq_date)) FROM {table} GROUP BY ALL""").fetchall():
        agg[(cls, obs, p)]["celldays"] = cd
    for cls, p, cd in con.execute(f"""
            SELECT cls, {k}, count(DISTINCT (gy, gx, acq_date)) FROM {table} WHERE sensor = 'MODIS' GROUP BY ALL""").fetchall():
        agg[(cls, "MODIS", p)]["celldays"] = cd
    return agg


def _coverage(con, keys, weekly, through):
    """Fraction of each period's (elapsed) days on which each observer delivered data anywhere on Earth."""
    rows = con.execute(f"SELECT sensor, {PKEY[weekly]}, count(*) FROM read_parquet('{sensor_days().as_posix()}') "
                       f"WHERE acq_date <= DATE '{through}' GROUP BY ALL").fetchall()
    days = {(s, p): n for s, p, n in rows}
    cov, partial = {s: [] for s in ["MODIS", *OBSERVERS]}, []
    for k in keys:
        a, b = sc.period_bounds(k)
        span = (min(b, through) - a).days + 1
        partial.append(b > through)
        for s in cov:
            cov[s].append(round(min(1.0, days.get((s, k), 0) / span), 3) if span > 0 else 0.0)
    return cov, partial


def _value(agg, cls, s, k, q):
    v = float((agg.get((cls, s, k)) or {}).get(q, 0))
    return v, max(v, 1.0)


# ---------------- calibration ----------------

def _pairs(agg, keys, cov, cls, q, src, ref, a, b):
    out = []
    for i, k in enumerate(keys):
        if a <= k <= b and cov[src][i] >= TRAIN_COVERAGE and cov[ref][i] >= TRAIN_COVERAGE:
            out.append((sc.calendar_month(k), _value(agg, cls, ref, k, q)[0] / cov[ref][i],
                        _value(agg, cls, src, k, q)[0] / cov[src][i]))
    return out


def _chain(fits, key="beta"):
    """Compose per-link factors onto the Aqua scale: {observer: (beta[12], sigma2)}."""
    to_ref = {REF: ([1.0] * 12, 0.0)}
    for src, ref, *_ in LINKS:
        f = fits[src]
        b = f[key] if key == "beta" else [f["pooled"]] * 12 if key == "pooled" else [1.0] * 12
        rb, rs2 = to_ref[ref]
        to_ref[src] = ([x * y for x, y in zip(b, rb)], f["sigma2"] + rs2)
    return to_ref


def _calibrate(agg, keys, cov, cls, q, last_full):
    fits, links, validation = {}, [], []
    for src, ref, full, train, test in LINKS:
        f = sc.ratio_calibration(_pairs(agg, keys, cov, cls, q, src, ref, full[0], full[1] or last_full))
        fits[src] = f
        tr = sc.ratio_calibration(_pairs(agg, keys, cov, cls, q, src, ref, train[0], train[1] or last_full))
        te = _pairs(agg, keys, cov, cls, q, src, ref, test[0], test[1] or last_full)
        truth = [r for _, r, _ in te]
        links.append({"sensor": src, "reference": ref, "window": [full[0], full[1] or last_full],
                      "beta": [_r(b, 4) for b in f["beta"]], "pooled": _r(f["pooled"], 4), "sigma2": _r(f["sigma2"], 4),
                      "tau2": _r(f["tau2"], 4), "n_periods": f["n"], "calibrated": f["calibrated"]})
        validation.append({
            "sensor": src, "reference": ref, "train": [train[0], train[1] or last_full], "test": [test[0], test[1] or last_full],
            "ours_seasonal_eb": sc.metrics([tr["beta"][m - 1] * s for m, _, s in te], truth),
            "baseline_single_ratio": sc.metrics([tr["pooled"] * s for _, _, s in te], truth),
            "uncalibrated": sc.metrics([s for _, _, s in te], truth),
        })
    to_ref = _chain(fits)
    # Chain closure: direct link vs composed chain over the same window; the mismatch is systematic error.
    closure = []
    for src, ref, (a, b) in CLOSURE:
        direct = sc.ratio_calibration(_pairs(agg, keys, cov, cls, q, src, ref, a, b or last_full))
        composed = statistics.fmean(to_ref[src][0]) / statistics.fmean(to_ref[ref][0])
        if direct["calibrated"] and composed > 0:
            mis = math.log(direct["pooled"] / composed)
            closure.append({"sensor": src, "reference": ref, "window": [a, b or last_full], "direct": _r(direct["pooled"], 4),
                            "composed": _r(composed, 4), "mismatch_pct": _r(100 * (math.exp(mis) - 1), 1), "n": direct["n"]})
            for s in [x for x in VIIRS if VIIRS.index(x) >= VIIRS.index(src)]:
                to_ref[s] = (to_ref[s][0], to_ref[s][1] + mis * mis)
    return {"fits": fits, "to_ref": to_ref, "links": links, "validation": validation, "closure": closure}


# ---------------- harmonization ----------------

def _series(agg, keys, cov, cls, q, to_ref, allowed=None, k_scale=1.0):
    v, var, used = [], [], []
    for i, k in enumerate(keys):
        m = sc.calendar_month(k)
        ests, obs = [], _active(cov, i, allowed)
        for s in obs:
            c = cov[s][i]
            x, cv = _value(agg, cls, s, k, q)
            b, s2 = to_ref[s][0][m - 1], to_ref[s][1]
            ests.append((b * x / c, s2, b * b * cv / (c * c)))
        res = sc.combine(ests)
        if res is None:
            v.append(None), var.append(None), used.append([])
            continue
        y, va = res
        if any(s in VIIRS for s in obs):
            va *= k_scale * k_scale
        v.append(y), var.append(va), used.append(obs)
    return v, var, used


def _band(v, var):
    lo, hi = [], []
    for y, va in zip(v, var):
        if y is None:
            lo.append(None), hi.append(None)
        else:
            sd = math.sqrt(va)
            lo.append(_r(max(0.0, y - 1.96 * sd))), hi.append(_r(y + 1.96 * sd))
    return {"v": [_r(y) for y in v], "lo": lo, "hi": hi}


def _hotspots(agg, keys, cov, cls, cal, allowed=None, k_scale=1.0):
    """Day + night harmonized separately, then added (values and variances)."""
    parts = [_series(agg, keys, cov, cls, f"det_{dn}", cal[f"det_{dn}"]["to_ref"], allowed, k_scale) for dn in DN]
    v = [None if a is None else a + b for a, b in zip(parts[0][0], parts[1][0])]
    var = [None if a is None else a + b for a, b in zip(parts[0][1], parts[1][1])]
    return v, var, parts[0][2], parts


def _viirs_scale(keys, parts, cal):
    """Suomi-NPP-scale view. Before any VIIRS flew this invents small fires MODIS never saw: flagged as modelled,
    with the S-NPP calibration error added."""
    out = {"v": [], "lo": [], "hi": [], "modelled": []}
    for i, k in enumerate(keys):
        m = sc.calendar_month(k)
        if parts[0][0][i] is None:
            for x in ("v", "lo", "hi"):
                out[x].append(None)
            out["modelled"].append(False)
            continue
        modelled = not any(s in VIIRS for s in parts[0][2][i])
        y = va = 0.0
        for dn, (vv, var, _) in zip(DN, parts):
            b, s2 = cal[f"det_{dn}"]["to_ref"]["VIIRS_SNPP"]
            yd = vv[i] / b[m - 1]
            y += yd
            va += var[i] / (b[m - 1] ** 2) + ((yd * yd * s2) if modelled else 0.0)
        sd = math.sqrt(va)
        out["v"].append(_r(y)), out["lo"].append(_r(max(0.0, y - 1.96 * sd))), out["hi"].append(_r(y + 1.96 * sd))
        out["modelled"].append(modelled)
    return out


def _block(agg, keys, cov, partial, cals, k_scale):
    block = {"periods": keys, "partial": partial, "coverage": cov, "classes": {}, "raw": {}}
    for cls in CLASSES:
        cal = cals[cls]
        v, var, used, parts = _hotspots(agg, keys, cov, cls, cal, None, k_scale)
        hot = _band(v, var)
        hot["sensors"] = used
        cd_v, cd_var, _ = _series(agg, keys, cov, cls, "celldays", cal["celldays"]["to_ref"], None, k_scale)
        aqua_only = _hotspots(agg, keys, cov, cls, cal, set(MODIS_SATS))[0]
        block["classes"][cls] = {
            "hotspots": hot, "viirs_scale": _viirs_scale(keys, parts, cal), "celldays": _band(cd_v, cd_var),
            "aqua_only": [_r(x) for x in aqua_only], "history": sc.versus_history(v, keys, partial),
        }
    for s in RAW_KEYS:
        block["raw"][s] = {f: [_r((agg.get(("veg", s, k)) or {}).get(f, 0), 1) for k in keys]
                           for f in ("det", "det_D", "det_N", "celldays", "frp")}
        block["raw"][s]["static_det"] = [(agg.get(("static", s, k)) or {}).get("det", 0) for k in keys]
    block["raw"]["all_det"] = [block["raw"]["MODIS"]["det"][i] + sum(block["raw"][s]["det"][i] for s in VIIRS)
                               for i in range(len(keys))]
    nrt = [sum((agg.get((c, s, k)) or {}).get("nrt", 0) for c in CLASSES for s in ["MODIS", *VIIRS]) for k in keys]
    tot = [sum((agg.get((c, s, k)) or {}).get("det", 0) for c in CLASSES for s in ["MODIS", *VIIRS]) for k in keys]
    block["nrt_share"] = [_r(n / t, 3) if t else None for n, t in zip(nrt, tot)]
    block["provisional"] = [p or bool(s) for p, s in zip(partial, block["nrt_share"])]
    return block


# ---------------- validation ----------------

def _denial_modis(agg, keys, cov, cls, last_full):
    """Pretend MODIS ended in 2016: calibrate on 2012-2016 only, rebuild 2017-2020 from VIIRS alone, compare with
    what Aqua actually saw. Also measures how often the 95% intervals contain the truth."""
    cal = {}
    for q in ("det_D", "det_N"):
        fits = {}
        for src, ref, full, *_ in LINKS:
            end = "2016-12" if ref == "MODIS_A" else "2020-12"
            fits[src] = sc.ratio_calibration(_pairs(agg, keys, cov, cls, q, src, ref, full[0], min(full[1] or last_full, end)))
        cal[q] = fits
    idx = [i for i, k in enumerate(keys) if "2017-01" <= k <= "2020-12" and cov["MODIS_A"][i] >= TRAIN_COVERAGE]
    truth = [sum(_value(agg, cls, "MODIS_A", keys[i], f"det_{dn}")[0] for dn in DN) / cov["MODIS_A"][i] for i in idx]
    result = {"train": ["2012-02", "2016-12"], "test": ["2017-01", "2020-12"], "n": len(idx)}
    z = []
    for name, key in (("ours_seasonal_eb", "beta"), ("baseline_single_ratio", "pooled"), ("uncalibrated", "none")):
        cfg = {f"det_{dn}": {"to_ref": _chain(cal[f"det_{dn}"], key)} for dn in DN}
        v, var, _, _ = _hotspots(agg, keys, cov, cls, cfg, set(VIIRS))
        pred = [v[i] or 0.0 for i in idx]
        m = sc.metrics(pred, truth)
        if key == "beta":
            z = [abs(t - v[i]) / math.sqrt(var[i]) for t, i in zip(truth, idx) if v[i] is not None and var[i]]
            m["interval_coverage_raw"] = _r(sum(x <= 1.96 for x in z) / len(z), 3) if z else None
            result["series"] = {"periods": [keys[i] for i in idx], "aqua": [_r(t) for t in truth], "predicted": [_r(p) for p in pred],
                                **{x: _band([v[i] for i in idx], [var[i] for i in idx])[x] for x in ("lo", "hi")}}
        result[name] = m
    # Conformal-style widening: scale intervals so 95% of held-out months fall inside.
    k = max(1.0, sorted(z)[min(len(z) - 1, math.ceil(0.95 * len(z)) - 1)] / 1.96) if len(z) >= 10 else 1.0
    result["interval_scale"] = _r(k, 3)
    if "series" in result:
        result["series"]["lo"] = [_r(max(0.0, p - (p - lo) * k)) if lo is not None else None for p, lo in zip(result["series"]["predicted"], result["series"]["lo"])]
        result["series"]["hi"] = [_r(p + (hi - p) * k) if hi is not None else None for p, hi in zip(result["series"]["predicted"], result["series"]["hi"])]
        result["ours_seasonal_eb"]["interval_coverage"] = _r(sum(x <= 1.96 * k for x in z) / len(z), 3) if z else None
    return result, k


def _denial_snpp(agg, keys, cov, cals, k_scale, snpp_last):
    """Withhold Suomi-NPP over 2024 – its last full month and check the record stays inside its own interval."""
    end = sc.month_key(snpp_last.replace(day=1) - dt.timedelta(days=1)) if snpp_last else None
    idx = [i for i, k in enumerate(keys) if "2024-01" <= k <= (end or "0") and cov["VIIRS_SNPP"][i] >= TRAIN_COVERAGE]
    if not idx:
        return None
    full, _, _, _ = _hotspots(agg, keys, cov, "veg", cals["veg"], None, k_scale)
    v, var, _, _ = _hotspots(agg, keys, cov, "veg", cals["veg"], set(OBSERVERS) - {"VIIRS_SNPP"}, k_scale)
    inside = [abs(full[i] - v[i]) <= 1.96 * math.sqrt(var[i]) for i in idx if v[i] is not None and var[i]]
    diffs = [abs(v[i] - full[i]) / full[i] for i in idx if full[i]]
    return {"window": [keys[idx[0]], keys[idx[-1]]], "n": len(idx), "inside_interval": _r(sum(inside) / len(inside), 3) if inside else None,
            "mean_abs_diff_pct": _r(100 * statistics.fmean(diffs), 1) if diffs else None,
            "series": {"periods": [keys[i] for i in idx], "all": [_r(full[i]) for i in idx], "without_snpp": [_r(v[i]) for i in idx]}}


def _cutover(weekly, snpp_last, through):
    """The real Suomi-NPP end: weekly raw vs harmonized around its last observed day."""
    if not snpp_last or (through - snpp_last).days < 3:
        return None
    keys = weekly["periods"]
    lo = sc.week_key(snpp_last - dt.timedelta(weeks=16))
    idx = [i for i, k in enumerate(keys) if k >= lo]
    h = weekly["classes"]["veg"]["hotspots"]
    return {"snpp_last_observed": str(snpp_last), "periods": [keys[i] for i in idx],
            "raw_all": [weekly["raw"]["all_det"][i] for i in idx], "harmonized": [h["v"][i] for i in idx],
            "lo": [h["lo"][i] for i in idx], "hi": [h["hi"][i] for i in idx], "partial": [weekly["partial"][i] for i in idx],
            "sensors": [h["sensors"][i] for i in idx]}


def _steps(block, keys, partial):
    veg = block["classes"]["veg"]
    series = {"raw_all_sensors": block["raw"]["all_det"], "aqua_only": veg["aqua_only"], "harmonized": veg["hotspots"]["v"]}
    out = {}
    for s, t in TRANSITIONS.items():
        r = {n: sc.step_ratio(keys, v, partial, t, STEP_WINDOW) for n, v in series.items()}
        if r["aqua_only"]:
            for n in ("raw_all_sensors", "harmonized"):
                r[f"{n}_excess"] = _r(r[n] / r["aqua_only"], 3) if r[n] else None
        out[s] = {"period": t, **r}
    # Placebo: the same test at dates with no satellite change gives its false-alarm range.
    tmonths = [int(t[:4]) * 12 + int(t[5:]) for t in TRANSITIONS.values()]
    plac = []
    for y in range(2004, 2024):
        for mo in (1, 7):
            t = f"{y}-{mo:02d}"
            if all(abs(y * 12 + mo - x) > STEP_WINDOW for x in tmonths):
                h, a = (sc.step_ratio(keys, series[n], partial, t, STEP_WINDOW) for n in ("harmonized", "aqua_only"))
                if h and a:
                    plac.append(h / a)
    plac.sort()
    placebo = None
    if len(plac) >= 5:
        q = lambda p: plac[min(len(plac) - 1, max(0, round(p * (len(plac) - 1))))]  # noqa: E731
        placebo = {"n": len(plac), "excess_p05": _r(q(0.05), 3), "excess_median": _r(q(0.5), 3), "excess_p95": _r(q(0.95), 3),
                   "dates": "every January and July 2004–2023 more than 24 months from a satellite change"}
    return out, placebo


def _trends(block, keys, partial, last_year):
    veg = block["classes"]["veg"]
    series = {"harmonized": veg["hotspots"]["v"], "aqua_only": veg["aqua_only"], "raw_all_sensors": block["raw"]["all_det"]}
    out = {}
    for span_name, (y0, y1) in (("2003-2020", (2003, 2020)), ("full", (2001, last_year))):
        out[span_name] = {}
        for n, vals in series.items():
            seasons = [[] for _ in range(12)]
            for k, v, p in zip(keys, vals, partial):
                y = int(k[:4])
                if y0 <= y <= y1 and not p:
                    seasons[int(k[5:7]) - 1].append((y, v))
            out[span_name][n] = {**sc.seasonal_mann_kendall(seasons), "years": [y0, y1]}
    return out


def _drift(block, keys):
    """Yearly ratio of what one satellite sees to another, from co-observed months. A flat line that bends after
    ~2020 is the signature of Terra/Aqua orbit drift."""
    out = {}
    for a, b in (("MODIS_A", "VIIRS_SNPP"), ("MODIS_T", "MODIS_A"), ("VIIRS_NOAA20", "VIIRS_SNPP")):
        yrs = {}
        for i, k in enumerate(keys):
            ca, cb = block["coverage"][a][i], block["coverage"][b][i]
            if ca >= TRAIN_COVERAGE and cb >= TRAIN_COVERAGE:
                d = yrs.setdefault(int(k[:4]), [0.0, 0.0])
                d[0] += block["raw"][a]["det"][i] / ca
                d[1] += block["raw"][b]["det"][i] / cb
        out[f"{a}/{b}"] = [[y, _r(x / z, 4)] for y, (x, z) in sorted(yrs.items()) if z > 0]
    return out


# ---------------- plain-language answers ----------------

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def _window_current(con, through, cals, k_scale):
    """Month-to-date compared fairly: the same days of the same month in every earlier year."""
    M, D = through.month, through.day
    rows = con.execute(f"""SELECT year(acq_date), obs, daynight, sum(n) FROM d WHERE cls = 'veg'
                           AND month(acq_date) = {M} AND day(acq_date) <= {D} GROUP BY ALL""").fetchall()
    days = con.execute(f"""SELECT sensor, year(acq_date), count(*) FROM read_parquet('{sensor_days().as_posix()}')
                           WHERE month(acq_date) = {M} AND day(acq_date) <= {D} GROUP BY ALL""").fetchall()
    years = list(range(2001 if M < 11 else 2000, through.year + 1))
    keys = [f"{y}-{M:02d}" for y in years]
    agg = {}
    for y, obs, dn, n in rows:
        agg.setdefault(("veg", obs, f"{y}-{M:02d}"), {"det_D": 0, "det_N": 0})[f"det_{dn}"] += n
    dmap = {(s, y): n for s, y, n in days}
    cov = {s: [min(1.0, dmap.get((s, y), 0) / D) for y in years] for s in OBSERVERS}
    v, var, _, _ = _hotspots(agg, keys, cov, "veg", cals["veg"], None, k_scale)
    cur, prior = v[-1], [(y, x) for y, x in zip(years[:-1], v[:-1]) if x is not None]
    if cur is None or len(prior) < 5:
        return None
    higher = sum(x < cur for _, x in prior)
    med = statistics.median(x for _, x in prior)
    sd = math.sqrt(var[-1])
    partial = D < sc.period_bounds(keys[-1])[1].day
    label = f"{MONTHS[M - 1]} {through.year}" + (f" so far ({D} days)" if partial else "")
    if cur >= med:
        sentence = f"{label}: higher than {higher} of the previous {len(prior)} {MONTHS[M - 1]}s over the same days."
    else:
        sentence = f"{label}: lower than {sum(x > cur for _, x in prior)} of the previous {len(prior)} {MONTHS[M - 1]}s over the same days."
    return {"period": keys[-1], "days": D, "partial": partial, "value": _r(cur), "lo": _r(max(0, cur - 1.96 * sd)),
            "hi": _r(cur + 1.96 * sd), "median": _r(med), "higher_than": higher, "n_prior": len(prior),
            "rank": 1 + sum(x > cur for _, x in prior), "prior": [[y, _r(x)] for y, x in prior], "sentence": sentence}


def _season(weekly, last_week):
    """Fire season from the harmonized weekly record. The fire year starts at the quietest time of year, so seasons
    that cross 1 January (Bangladesh kilns, Southern Hemisphere) are not cut in half."""
    keys, v, part = weekly["periods"], weekly["classes"]["veg"]["hotspots"]["v"], weekly["partial"]
    wk = lambda k: min(int(k[6:]), 52)  # noqa: E731  week 53 folds into 52
    by = {}
    for k, x, p in zip(keys, v, part):
        if x is not None and not p:
            by.setdefault(wk(k), []).append(x)
    clim = [statistics.median(by.get(w, [0])) for w in range(1, 53)]
    if sum(clim) <= 0:
        return None
    smooth = [statistics.fmean(clim[(w + j) % 52] for j in range(-2, 3)) for w in range(52)]
    w0 = min(range(52), key=smooth.__getitem__) + 1  # first week of the fire year
    seq = {}
    for k, x, p in zip(keys, v, part):
        y, w = int(k[:4]), wk(k)
        fy = y if w >= w0 else y - 1
        slot, o = seq.setdefault(fy, {}), (w - w0) % 52
        prev = slot.get(o)  # week 53 shares a slot with week 52: add, don't overwrite
        slot[o] = (x, p) if prev is None else (None if x is None or prev[0] is None else prev[0] + x, p or prev[1])
    years, curves = [], {}
    for fy, wmap in sorted(seq.items()):
        vals = [wmap.get(o) for o in range(52)]
        complete = all(t is not None and t[0] is not None and not t[1] for t in vals)
        cum, c = [], 0.0
        for t in vals:
            if t is None or t[0] is None:
                break
            c += t[0]
            cum.append(c)
        curves[fy] = (cum, complete)
        if complete and c > 0:
            share = [x / c for x in cum]
            start = next(o for o, s in enumerate(share) if s >= 0.1)
            end = next(o for o, s in enumerate(share) if s >= 0.9)
            peak = max(range(52), key=lambda o: vals[o][0])
            years.append({"fire_year": fy, "start": start, "peak": peak, "end": end, "length": end - start + 1, "total": _r(c)})
    if len(years) < 5:
        return None
    env = []
    for o in range(52):
        xs = sorted(curves[y["fire_year"]][0][o] for y in years)
        env.append([_r(xs[0]), _r(statistics.median(xs)), _r(xs[-1])])
    cur_fy = max(seq)
    cur = curves[cur_fy][0] if not curves[cur_fy][1] else []
    tr = {}
    for f in ("start", "end", "length"):
        r = sc.seasonal_mann_kendall([[(y["fire_year"], y[f]) for y in years]])
        tr[f] = {"tau": r["tau"], "p": r["p"], "sen_weeks_per_decade": _r(r["sen_per_year"] * 10, 2) if r["sen_per_year"] is not None else None}
    med = {f: round(statistics.median(y[f] for y in years)) for f in ("start", "peak", "end")}
    # outlook: share of a typical year's activity in the next four weeks
    o_now = (wk(last_week) - w0) % 52 if last_week else None
    total = sum(clim)
    nxt = None
    if o_now is not None:
        nxt = _r(100 * sum(clim[(w0 - 1 + o_now + j) % 52] for j in range(1, 5)) / total, 1)
    ytd = None
    if cur and o_now is not None and len(cur) > 0:
        o = min(len(cur), o_now + 1) - 1
        prior = [curves[y["fire_year"]][0][o] for y in years]
        ytd = {"value": _r(cur[o]), "weeks": o + 1, "rank": 1 + sum(p > cur[o] for p in prior), "n": len(prior) + 1,
               "median": _r(statistics.median(prior))}
    return {"fire_year_start_week": w0, "climatology": [_r(c) for c in clim], "years": years, "median": med,
            "trend": tr, "envelope": env, "current": {"fire_year": cur_fy, "cumulative": [_r(x) for x in cur]},
            "next_4_weeks_share_pct": nxt, "year_to_date": ytd}


def _answers(monthly, current, season):
    keys, v, part = monthly["periods"], monthly["classes"]["veg"]["hotspots"]["v"], monthly["partial"]
    by_m, by_y = {}, {}
    for k, x, p in zip(keys, v, part):
        if x is not None and not p:
            by_m.setdefault(int(k[5:7]), []).append(x)
            by_y.setdefault(int(k[:4]), []).append(x)
    clim = [statistics.median(by_m.get(m, [0])) for m in range(1, 13)]
    tot = sum(clim) or 1
    best = max(range(12), key=lambda m: sum(clim[(m + j) % 12] for j in range(3)))
    share = 100 * sum(clim[(best + j) % 12] for j in range(3)) / tot
    yrs = sorted(((sum(x), y) for y, x in by_y.items() if len(x) == 12 and y >= 2001), reverse=True)
    out = {
        "peak_months": [(best + j) % 12 + 1 for j in range(3)], "peak_share_pct": _r(share, 1),
        "top_years": [[y, _r(t)] for t, y in yrs[:5]],
        "sentences": [
            f"Burning peaks in {MONTHS[best]}–{MONTHS[(best + 2) % 12]}: {share:.0f}% of a typical year's hotspots fall in those three months.",
            (f"The most active years were {', '.join(str(y) for _, y in yrs[:3])}." if len(yrs) >= 3 else "Not enough complete years to rank."),
        ],
    }
    if current:
        out["sentences"].append(current["sentence"])
    if season and season.get("next_4_weeks_share_pct") is not None:
        out["sentences"].append(f"The next four weeks usually hold {season['next_4_weeks_share_pct']:.0f}% of a year's hotspots.")
    return out


# ---------------- map layers ----------------

def _grid(con, keys, cov, cals):
    idx = {k: i for i, k in enumerate(keys)}
    rows = con.execute("SELECT strftime(acq_date, '%Y-%m'), gy, gx, obs, daynight, sum(n) FROM d WHERE cls = 'veg' GROUP BY ALL").fetchall()
    acc = {}
    for p, gy, gx, s, dn, n in rows:
        acc.setdefault((p, gy, gx), {}).setdefault(s, {})[dn] = n
    cells, cell_idx, months = [], {}, {}
    for (p, gy, gx), per in acc.items():
        i = idx.get(p)
        if i is None:
            continue
        m = sc.calendar_month(p)
        ests = [sum(cals["veg"][f"det_{dn}"]["to_ref"][s][0][m - 1] * per.get(s, {}).get(dn, 0) for dn in DN) / cov[s][i]
                for s in _active(cov, i)]
        val = statistics.fmean(ests) if ests else 0.0
        if val <= 0:
            continue
        ci = cell_idx.setdefault((gy, gx), len(cells))
        if ci == len(cells):
            cells.append([_r(gy * GRID_DEG, 2), _r(gx * GRID_DEG, 2)])
        months.setdefault(p, []).append([ci, _r(val, 2)])
    return {"deg": GRID_DEG, "cells": cells, "months": dict(sorted(months.items())),
            "unit": "vegetation hotspots per 0.1° cell, Aqua MODIS scale",
            "note": "Per-cell values use the area's calibration; uncertainty is reported for area totals only."}


def _static_points(con, glob=False):
    rows = con.execute("SELECT fy, fx, n, y0, y1, ny, round(frp, 1), nm FROM spt ORDER BY n DESC LIMIT 20000").fetchall() if glob else con.execute("""
        SELECT fy, fx, count(*) n, min(year(acq_date)), max(year(acq_date)), count(DISTINCT year(acq_date)),
               round(avg(frp), 1), count(*) FILTER (WHERE sensor = 'MODIS')
        FROM d WHERE cls = 'static' GROUP BY 1, 2 HAVING count(*) >= 3 ORDER BY n DESC LIMIT 20000""").fetchall()
    return {"points": [[_r((fx + 0.5) / 100, 3), _r((fy + 0.5) / 100, 3), n, y0, y1, ny, frp, nm]
                       for fy, fx, n, y0, y1, ny, frp, nm in rows],
            "columns": ["lon", "lat", "detections", "first_year", "last_year", "active_years", "mean_frp_mw", "modis_detections"],
            "note": "0.01° cells that FIRMS science-quality data attributes mainly to static sources (type 1–3). Not "
                    "validated against an independent kiln or industry inventory, so labelled persistent heat sources."}


def _frp_distribution(con, glob=False):
    if glob:
        return {"available": False, "reason": "per-detection FRP is not kept in the whole-Earth aggregate; shown for the preset areas"}
    def q(obs, a, b):
        vals = [r[0] for r in con.execute(f"SELECT log10(frp) FROM d WHERE cls='veg' AND frp > 0 AND obs = '{obs}' "
                                          f"AND year(acq_date) BETWEEN {a} AND {b}").fetchall()]
        return sc.quantiles(vals), len(vals)
    (mt, nmt), (st, nst) = q("MODIS_A", 2012, 2016), q("VIIRS_SNPP", 2012, 2016)
    (mv, nmv), (sv, nsv) = q("MODIS_A", 2017, 2020), q("VIIRS_SNPP", 2017, 2020)
    if not all((mt, st, mv, sv)) or min(nmt, nst, nmv, nsv) < 50:
        return {"available": False, "reason": "fewer than 50 FRP values per satellite and window"}
    mapped = [sc.quantile_map(x, st, mt)[0] for x in sv]
    return {"available": True, "unit": "log10(MW)", "train": [2012, 2016], "test": [2017, 2020],
            "n": {"aqua_train": nmt, "snpp_train": nst, "aqua_test": nmv, "snpp_test": nsv},
            "q_aqua_test": [_r(x, 3) for x in mv], "q_snpp_test": [_r(x, 3) for x in sv], "q_snpp_mapped": [_r(x, 3) for x in mapped],
            "w2_raw": _r(sc.wasserstein2(sv, mv), 4), "w2_mapped": _r(sc.wasserstein2(mapped, mv), 4),
            "note": "Per-detection FRP. Quantile mapping aligns the marginal distribution only and is shown as a "
                    "diagnostic; FRP stays per satellite (the literature disagrees on the direction of the bias)."}


def _filter_sensitivity(con, keys, cov, partial, cals, k_scale):
    """Does dropping low-confidence detections change the answer? (VIIRS publishes few low-confidence night pixels.)"""
    share = {f"{s}_{dn}": _r(x, 4) for s, dn, x in con.execute("""
        SELECT sensor, daynight, coalesce(sum(n) FILTER (WHERE NOT conf_ok), 0) / sum(n) FROM dall WHERE cls='veg' GROUP BY ALL""").fetchall()}
    a_all = _aggregate(con, False, "dall")
    v_f = _hotspots(_aggregate(con, False), keys, cov, "veg", cals["veg"], None, k_scale)[0]
    v_a = _hotspots(a_all, keys, cov, "veg", cals["veg"], None, k_scale)[0]
    yrs = {}
    for k, f, a, p in zip(keys, v_f, v_a, partial):
        if f is not None and a is not None and not p:
            t = yrs.setdefault(int(k[:4]), [0.0, 0.0])
            t[0] += f
            t[1] += a
    diffs = [100 * (a - f) / f for f, a in yrs.values() if f > 0]
    return {"dropped_share_by_sensor_daynight": share,
            "annual_total_change_pct_if_unfiltered": {"mean": _r(statistics.fmean(diffs), 1) if diffs else None,
                                                      "max_abs": _r(max(map(abs, diffs)), 1) if diffs else None},
            "note": "Published series use the filter; this shows how much the unfiltered record would differ "
                    "(the calibration is the filtered one, so this is an upper-bound sensitivity)."}


def _versions(con):
    return [{"sensor": s, "version": v, "first": str(a), "last": str(b), "detections": n} for s, v, a, b, n in con.execute(
        "SELECT sensor, version, min(acq_date), max(acq_date), sum(n) FROM dall GROUP BY 1, 2 ORDER BY 1, 3").fetchall()]


# ---------------- build ----------------

def build_region(region_id, info, progress=None, source=None):
    """source: 'detections' (per-area download, used for the presets) or 'global' (kw.globe aggregate)."""
    t0 = time.time()
    source = source or ("detections" if region_id in PRESETS or not globe.ready() else "global")
    glob = source == "global"
    con = duckdb.connect()
    if glob:
        _load_global(con, region_id, info["bbox"], progress)
    else:
        fetch_region(region_id, info["bbox"], progress)
        _load(con, region_id)
    sd = sensor_days().as_posix()
    through = con.execute(f"SELECT max(acq_date) FROM read_parquet('{sd}')").fetchone()[0]
    sensors = {s: {"first": str(a), "last": str(b), "days": n} for s, a, b, n in con.execute(
        f"SELECT sensor, min(acq_date), max(acq_date), count(*) FROM read_parquet('{sd}') GROUP BY 1").fetchall()}
    snpp_last = dt.date.fromisoformat(sensors["VIIRS_SNPP"]["last"]) if "VIIRS_SNPP" in sensors else None
    start = dt.date.fromisoformat(SENSOR_START["MODIS"])
    last_full = sc.month_key(through.replace(day=1) - dt.timedelta(days=1))

    mkeys = sc.periods(start, through)
    mcov, mpartial = _coverage(con, mkeys, False, through)
    magg = _aggregate(con, False)
    cals = {cls: {q: _calibrate(magg, mkeys, mcov, cls, q, last_full) for q in QTY} for cls in CLASSES}
    denial, k_scale = _denial_modis(magg, mkeys, mcov, "veg", last_full)
    monthly = _block(magg, mkeys, mcov, mpartial, cals, k_scale)

    wkeys = sc.periods(start, through, weekly=True)
    wcov, wpartial = _coverage(con, wkeys, True, through)
    weekly = _block(_aggregate(con, True), wkeys, wcov, wpartial, cals, k_scale)

    steps, placebo = _steps(monthly, mkeys, mpartial)
    last_year = through.year if (through.month, through.day) == (12, 31) else through.year - 1
    full_weeks = [k for k, p in zip(wkeys, wpartial) if not p]
    season = _season(weekly, full_weeks[-1] if full_weeks else None)
    current = _window_current(con, through, cals, k_scale)
    totals = con.execute("SELECT sum(n), coalesce(sum(n) FILTER (WHERE cls='static'), 0), coalesce(sum(n) FILTER (WHERE quality='nrt'), 0) FROM d").fetchone()

    meta = {
        "id": region_id, **{k: info.get(k) for k in ("name", "country", "story", "places", "lang")},
        "bbox": list(info["bbox"]), "grid_deg": GRID_DEG, "data_through": str(through),
        "built_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "estimand": {
            "primary": "Hotspots per period on the Aqua MODIS scale: the number of vegetation-fire detections Aqua "
                       "MODIS would have recorded (early-afternoon and post-midnight passes). Day and night are "
                       "calibrated separately and added.",
            "why_aqua": "The early-afternoon orbit is the only one observed continuously from 2002 (Aqua) through "
                        "Suomi-NPP, NOAA-20 and NOAA-21. Converting VIIRS to MODIS scale discards information and is "
                        "well-posed; the reverse must invent small fires MODIS never saw, so the VIIRS-scale view is "
                        "marked modelled before 2012.",
            "secondary": ["Fire cell-days (0.1° cell × UTC day with ≥1 detection), Aqua scale",
                          "Hotspots on the Suomi-NPP VIIRS scale (modelled before 2012)",
                          "Persistent heat sources (kilns, flares, industry, volcanoes) harmonized separately",
                          "Raw detections — not comparable across satellite eras"],
            "not": "Not burned area and not a count of fires: a detection is one hot pixel in one overpass.",
        },
        "method": {
            "confidence_filter": "drop VIIRS 'l' and MODIS confidence < 30 (no crosswalk between the two scales); "
                                 "sensitivity reported",
            "static_mask": ("0.01° cells where science-quality FIRMS `type` is 1–3 for ≥50% of ≥3 detections" + (
                "; approximate in this build: the whole-Earth tallies undercount typed detections in years a cell had no "
                "static ones, so the mask is too generous. It only affects untyped near-real-time rows and the heat-source "
                "list; harmonized monthly values matched an exact build of Punjab within 0.9%" if glob else "")),
            "coverage": "share of days each satellite delivered data anywhere on Earth in each period (measured, so "
                        f"launches, gaps and the Suomi-NPP end come from the data); below {MIN_COVERAGE:.0%} a "
                        "satellite is left out, otherwise counts are divided by coverage",
            "calibration": "ratio of totals per calendar month, day and night separately, shrunk toward the pooled "
                           "ratio by empirical Bayes (shrinkage strength estimated from the data). Chain: Terra→Aqua "
                           "(2002–2020, bridges 2000–2002 only), Suomi-NPP→Aqua (2012–2020, pre-drift), NOAA-20→"
                           "Suomi-NPP, NOAA-21→NOAA-20; chain-closure mismatch is added to the error",
            "combination": "inverse-variance mean of the satellites observing each period (calibration error + "
                           "counting noise, evaluated at the pooled mean); intervals widened so 95% of held-out "
                           "months fall inside (MODIS-denial test)",
            "comparison": "each period vs the same month/week in other complete years: median, ratio, percentile, "
                          "rank — no sigma thresholds (fire counts are skewed)",
            "weekly": "ISO-8601 weeks; weeks use their Thursday's month calibration",
            "provisional": "periods containing near-real-time rows are provisional: FIRMS replaces NRT with "
                           "standard processing after ~3 months, and the mirror keeps only one of the two, so the "
                           "NRT-to-standard difference cannot be measured from it",
        },
        "calibration": {f"{c}_{q}": cals[c][q]["links"] for c in CLASSES for q in QTY},
        "closure": {f"{c}_{q}": cals[c][q]["closure"] for c in CLASSES for q in QTY},
        "validation": {f"{c}_{q}": cals[c][q]["validation"] for c in CLASSES for q in QTY},
        "denial": {"modis_ends_2016": denial, "snpp_withheld": _denial_snpp(magg, mkeys, mcov, cals, k_scale, snpp_last),
                   "snpp_cutover": _cutover(weekly, snpp_last, through)},
        "interval_scale": _r(k_scale, 3),
        "steps": steps, "placebo": placebo, "trend": _trends(monthly, mkeys, mpartial, last_year),
        "drift": _drift(monthly, mkeys), "season": season, "current": current,
        "answers": _answers(monthly, current, season),
        "frp_distribution": _frp_distribution(con, glob),
        "filter_sensitivity": _filter_sensitivity(con, mkeys, mcov, mpartial, cals, k_scale),
        "versions": _versions(con),
        "transfer_validation": None,
        "sensors": sensors,
        "totals": {"detections": totals[0], "static_detections": totals[1], "nrt_detections": totals[2]},
        "provenance": {
            "source": "NASA FIRMS active fire detections (MODIS C6.1, VIIRS 375 m C2), standard + NRT",
            "mirror": f"{BASE}/year=*/detections.parquet", "mirror_updated": _collection_updated(),
            "license": "CC0-1.0 (NASA data)",
            "acknowledgement": "We acknowledge the use of data and/or imagery from NASA's Fire Information for "
                               "Resource Management System (FIRMS) (https://earthdata.nasa.gov/firms), part of "
                               "NASA's Earth Observing System Data and Information System (EOSDIS).",
            "code_version": _code_version(), "reproduce": f"python -m kw.build {region_id}",
            "build_seconds": round(time.time() - t0, 1), "source": source,
        },
    }
    folder = OUT / region_id
    folder.mkdir(parents=True, exist_ok=True)
    con.execute(f"COPY mask TO '{(folder / 'mask.parquet').as_posix()}' (FORMAT parquet)")
    for name, obj in (("meta", meta), ("monthly", monthly), ("weekly", weekly),
                      ("grid", _grid(con, mkeys, mcov, cals)), ("static", _static_points(con, glob))):
        tmp = folder / f"{name}.json.tmp"
        tmp.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, folder / f"{name}.json")
    return meta


def transfer_validation(region_ids):
    """Geographic hold-out: calibrate Suomi-NPP→Aqua on every other preset (2012–2016), test here (2017–2020)."""
    data = {}
    for rid in region_ids:
        m = json.loads((OUT / rid / "monthly.json").read_text(encoding="utf-8"))
        cov, raw = m["coverage"], m["raw"]
        data[rid] = [(k, sc.calendar_month(k), raw["MODIS_A"]["det"][i] / cov["MODIS_A"][i], raw["VIIRS_SNPP"]["det"][i] / cov["VIIRS_SNPP"][i])
                     for i, k in enumerate(m["periods"]) if "2012-02" <= k <= "2020-12"
                     and cov["MODIS_A"][i] >= TRAIN_COVERAGE and cov["VIIRS_SNPP"][i] >= TRAIN_COVERAGE]
    out = {}
    for rid, pairs in data.items():
        others = [(mo, r, s) for o, ps in data.items() if o != rid for k, mo, r, s in ps if k <= "2016-12"]
        own = [(mo, r, s) for k, mo, r, s in pairs if k <= "2016-12"]
        test = [(mo, r, s) for k, mo, r, s in pairs if k >= "2017-01"]
        if not others or not test:
            continue
        fo, fs = sc.ratio_calibration(others), sc.ratio_calibration(own)
        truth = [r for _, r, _ in test]
        out[rid] = {"train": ["2012-02", "2016-12"], "test": ["2017-01", "2020-12"],
                    "calibrated_here": sc.metrics([fs["beta"][mo - 1] * s for mo, _, s in test], truth),
                    "transferred_from_other_regions": sc.metrics([fo["beta"][mo - 1] * s for mo, _, s in test], truth)}
    return out


def write_index():
    items = []
    for f in sorted(OUT.glob("*/meta.json")):
        m = json.loads(f.read_text(encoding="utf-8"))
        items.append({k: m.get(k) for k in ("id", "name", "country", "bbox", "story", "data_through", "built_at")}
                     | {"preset": m["id"] in PRESETS, "sensors_last": {s: v["last"] for s, v in m["sensors"].items()}})
    (OUT / "index.json").write_text(json.dumps({"regions": items}, ensure_ascii=False), encoding="utf-8")


def write_ratio_table(region_ids):
    """Open table of every calibration link by area, class, quantity and calendar month (CSV)."""
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["area", "class", "quantity", "sensor", "reference", "window", "month", "beta", "pooled", "sigma2", "tau2", "n_periods"])
    for rid in region_ids:
        m = json.loads((OUT / rid / "meta.json").read_text(encoding="utf-8"))
        for key, links in m["calibration"].items():
            cls, q = key.split("_", 1)
            for ln in links:
                for mo, b in enumerate(ln["beta"], 1):
                    w.writerow([rid, cls, q, ln["sensor"], ln["reference"], "–".join(ln["window"]), mo, b, ln["pooled"],
                                ln["sigma2"], ln["tau2"], ln["n_periods"]])
    (OUT / "calibration_table.csv").write_text(buf.getvalue(), encoding="utf-8")


def main(ids):
    ids = ids or list(PRESETS)
    for rid in ids:
        build_region(rid, PRESETS[rid], lambda y, d, t: print(f"{rid}: {y} ({d}/{t})", flush=True))
        print(f"built {rid}", flush=True)
    built = [p.parent.name for p in OUT.glob("*/meta.json") if p.parent.name in PRESETS]
    tv = transfer_validation(built)
    for rid in built:
        f = OUT / rid / "meta.json"
        m = json.loads(f.read_text(encoding="utf-8"))
        m["transfer_validation"] = tv.get(rid)
        f.write_text(json.dumps(m, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    write_index()
    write_ratio_table(built)


if __name__ == "__main__":
    main(sys.argv[1:])
