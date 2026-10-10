"""Kiln activity from non-fire channels (PREREGISTRATION_AMENDMENTS.md, Amendment 1).

GL: NASA Black Marble VNP46A2 night lights, half-monthly. GS: Sentinel-1 VV yard-minus-ring, monthly.
Kiln sites are compared with their matched A4c controls; tests run on clusters held out from the pilot.
Public output is area-level only (>= MIN_AREA_CLUSTERS clusters), never per kiln.
"""
from __future__ import annotations

import json
import logging
import os
import warnings
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pandas as pd
from scipy.stats import wilcoxon

from . import config as C

log = logging.getLogger("kilnwatch.activity")
CACHE = C.RAW / "gee" / "activity"
CORE_MONTHS = (12, 1, 2, 3, 4)
OFF_MONTHS = (7, 8, 9, 10)
CONFIRM_SEASON = "2022-23"
REPLICATION = {"ntl": ("2012-13", "2024-25"), "s1": ("2015-16", "2024-25")}
FIRST_YEAR = {"ntl": 2012, "s1": 2015}
MIN_SEASON_CLUSTERS = 200
MIN_AREA_CLUSTERS = 5
CHUNK = {"ntl": 5000, "s1": 1000}  # s1 ring polygons at 20 m time out in 5,000-site requests
N_BOOT = 1000


# --- sites and seasons ---------------------------------------------------------------
def sites(kilns: pd.DataFrame, clusters: pd.DataFrame, ctrl: pd.DataFrame) -> pd.DataFrame:
    """Kiln nearest each cluster centroid, plus that kiln translated by each control's (dlat, dlon)."""
    k = kilns.merge(clusters[["cluster_id", "lat", "lon"]].rename(columns={"lat": "clat", "lon": "clon"}), on="cluster_id")
    k["d2"] = (k.lat - k.clat) ** 2 + ((k.lon - k.clon) * np.cos(np.radians(k.clat))) ** 2
    rep = k.sort_values(["cluster_id", "d2", "kiln_id"]).drop_duplicates("cluster_id")
    ks = pd.DataFrame({"site": "k" + rep.cluster_id.astype(str), "cluster_id": rep.cluster_id.to_numpy(), "kind": "kiln",
                       "lat": rep.lat.to_numpy(), "lon": rep.lon.to_numpy()})
    c = ctrl.merge(rep[["cluster_id", "lat", "lon"]].rename(columns={"lat": "klat", "lon": "klon"}), on="cluster_id")
    cs = pd.DataFrame({"site": "c" + c.control_id.astype(str), "cluster_id": c.cluster_id.to_numpy(), "kind": "control",
                       "lat": (c.klat + c.dlat).to_numpy(), "lon": (c.klon + c.dlon).to_numpy()})
    return pd.concat([ks, cs], ignore_index=True)


def placebo_sites(s: pd.DataFrame) -> pd.DataFrame:
    """Amendment 1 rule 4: each cluster's first control stands in for the kiln; the other two stay controls."""
    c = s[s.kind == "control"].sort_values(["cluster_id", "site"])
    first = c.groupby("cluster_id").head(1).index
    out = c.copy()
    out.loc[first, "kind"] = "kiln"
    return out


def season_of(t: pd.Series) -> pd.Series:
    y = t.dt.year - (t.dt.month < 7)
    return y.astype(str) + "-" + ((y + 1) % 100).astype(str).str.zfill(2)


# --- Earth Engine extraction (cached per kind/year/chunk; resumable) -----------------
def _periods(kind: str, year: int):
    """(band, start, end) per half-month (ntl) or month (s1)."""
    out = []
    for m in range(1, 13):
        s = pd.Timestamp(year, m, 1)
        e = s + pd.offsets.MonthBegin(1)
        if kind == "ntl":
            mid = pd.Timestamp(year, m, 16)
            out += [(f"p{s:%Y%m}01", s, mid), (f"p{s:%Y%m}16", mid, e)]
        else:
            out.append((f"p{s:%Y%m}01", s, e))
    return out


def _year_image(kind: str, year: int, aoi):
    from .gee import ee

    E = ee()
    bands = []
    for name, s, e in _periods(kind, year):
        if kind == "ntl":
            ic = E.ImageCollection("NASA/VIIRS/002/VNP46A2").filterBounds(aoi).filterDate(s.strftime("%Y-%m-%d"), e.strftime("%Y-%m-%d")) \
                .map(lambda i: i.select("DNB_BRDF_Corrected_NTL").updateMask(i.select("Mandatory_Quality_Flag").lte(1)))
        else:
            ic = E.ImageCollection("COPERNICUS/S1_GRD").filterBounds(aoi).filterDate(s.strftime("%Y-%m-%d"), e.strftime("%Y-%m-%d")) \
                .filter(E.Filter.eq("instrumentMode", "IW")).filter(E.Filter.listContains("transmitterReceiverPolarisation", "VV")) \
                .map(lambda i: E.Image(10).pow(i.select("VV").divide(10)))
        empty = E.Image.constant(0).updateMask(0)
        bands.append(E.Image(E.Algorithms.If(ic.size().gt(0), ic.mean(), empty)).rename(name))
    return E.Image.cat(bands)


def _extract_chunk(kind: str, year: int, chunk: pd.DataFrame, part: str):
    from .gee import ee

    E = ee()
    fc = E.FeatureCollection([E.Feature(E.Geometry.Point([lon, lat]), {"site": sid}) for sid, lat, lon in zip(chunk.site, chunk.lat, chunk.lon)])
    if part == "ntl":
        geoms, scale = fc.map(lambda f: f.buffer(250)), 463
    elif part == "in":
        geoms, scale = fc.map(lambda f: f.buffer(100)), 20
    else:
        geoms, scale = fc.map(lambda f: E.Feature(f.geometry().buffer(500).difference(f.geometry().buffer(200), 1), f.toDictionary())), 20
    img = _year_image(kind, year, fc.geometry().bounds())
    names = [b for b, _, _ in _periods(kind, year)]
    r = img.reduceRegions(collection=geoms, reducer=E.Reducer.mean(), scale=scale, tileScale=4)
    df = E.data.computeFeatures({"expression": r.select(["site"] + names, retainGeometry=False), "fileFormat": "PANDAS_DATAFRAME"})
    return df.drop(columns=["geo"], errors="ignore")


def extract(kind: str, s: pd.DataFrame, last_year: int | None = None, workers=int(os.environ.get("GEE_WORKERS", 3)), cache=CACHE, refresh_last=True) -> None:
    last_year = last_year or pd.Timestamp.today().year
    parts = ["ntl"] if kind == "ntl" else ["in", "ring"]
    n = CHUNK[kind]
    jobs = [(y, i, p) for y in range(FIRST_YEAR[kind], last_year + 1) for i in range(0, len(s), n) for p in parts]

    def job(j):
        y, i, part = j
        p = cache / kind / f"{y}_{i // n}_{part}.parquet"
        if p.exists() and (y < last_year or not refresh_last):  # the current year is refreshed on every run, unless the range is closed
            return p
        for attempt in range(4):
            try:
                df = _extract_chunk(kind, y, s.iloc[i:i + n], part)
                p.parent.mkdir(parents=True, exist_ok=True)
                tmp = p.with_suffix(".tmp")
                df.to_parquet(tmp, index=False)
                tmp.replace(p)
                log.info("activity %s %d chunk %d %s: %d sites", kind, y, i // n, part, len(df))
                return p
            except Exception as e:  # GEE quota/timeouts: bounded retry, then leave for the next resumable run
                log.warning("activity %s %d chunk %d %s attempt %d: %s", kind, y, i // n, part, attempt, str(e)[:200])
        return None

    with ThreadPoolExecutor(workers) as ex:
        done = list(ex.map(job, jobs))
    if any(d is None for d in done):
        log.error("activity %s: %d jobs missing; rerun to resume", kind, sum(d is None for d in done))


def panel(kind: str, cache=CACHE) -> pd.DataFrame:
    """Long table site, period, x. ntl: radiance; s1: yard-minus-ring VV in dB."""
    def load(part):
        fs = sorted((cache / kind).glob(f"*_{part}.parquet"))
        if not fs:
            raise FileNotFoundError(f"activity cache missing for {kind}: run `python -m kilnwatch activity --extract {kind}`")
        df = pd.concat([pd.read_parquet(f) for f in fs], ignore_index=True)
        long = df.melt(id_vars=["site"], var_name="band", value_name="x")
        long["x"] = pd.to_numeric(long.x, errors="coerce")  # Earth Engine nulls arrive as object columns
        return long.dropna()
    if kind == "ntl":
        p = load("ntl")
    else:
        a, b = load("in"), load("ring")
        p = a.merge(b, on=["site", "band"], suffixes=("_in", "_ring"))
        p = p[(p.x_in > 0) & (p.x_ring > 0)]
        p["x"] = 10 * np.log10(p.x_in) - 10 * np.log10(p.x_ring)
    p["period"] = pd.to_datetime(p.band.str[1:], format="%Y%m%d")
    return p[["site", "period", "x"]]


# --- analysis (pure functions) -------------------------------------------------------
def excess(p: pd.DataFrame, s: pd.DataFrame) -> pd.DataFrame:
    """e(t) = x_kiln(t) - mean x over the cluster's valid controls; needs >= 2 valid controls."""
    p = p.merge(s[["site", "cluster_id", "kind"]], on="site").dropna(subset=["x"])
    k = p[p.kind == "kiln"].groupby(["cluster_id", "period"]).x.first()
    c = p[p.kind == "control"].groupby(["cluster_id", "period"]).x.agg(["mean", "count"])
    c = c.loc[c["count"] >= 2, "mean"]
    e = (k - c).dropna()
    return e.rename("e").reset_index()


def amplitude(e: pd.DataFrame, core_months=CORE_MONTHS, off_months=OFF_MONTHS) -> pd.DataFrame:
    """Per cluster-season A = mean e over Dec–Apr minus mean e over Jul–Oct (>= 3 and >= 2 valid periods).
    Amendment 2 passes other windows; both lie inside one Jul–Jun season."""
    e = e.assign(season=season_of(e.period), m=e.period.dt.month)
    core = e[e.m.isin(core_months)].groupby(["cluster_id", "season"]).e.agg(["mean", "count"])
    off = e[e.m.isin(off_months)].groupby(["cluster_id", "season"]).e.agg(["mean", "count"])
    j = core.join(off, lsuffix="_core", rsuffix="_off", how="inner")
    j = j[(j.count_core >= 3) & (j.count_off >= 2)]
    return (j.mean_core - j.mean_off).rename("A").reset_index()


def confirm(A: pd.DataFrame, A_placebo: pd.DataFrame, exclude: set, seasons: tuple[str, str]) -> dict:
    """The four Amendment 1 criteria on held-out clusters."""
    a = A[~A.cluster_id.isin(exclude)]
    prim = a.loc[a.season == CONFIRM_SEASON, "A"].to_numpy()
    p1 = float(wilcoxon(prim, alternative="greater").pvalue) if len(prim) >= 10 else 1.0
    med = float(np.median(prim)) if len(prim) else np.nan
    share = float((prim > 0).mean()) if len(prim) else np.nan
    by = a[(a.season >= seasons[0]) & (a.season <= seasons[1])].groupby("season").A.agg(["median", "count"])
    by = by[by["count"] >= MIN_SEASON_CLUSTERS]
    rep = float((by["median"] > 0).mean()) if len(by) else np.nan
    pl = A_placebo[~A_placebo.cluster_id.isin(exclude) & (A_placebo.season == CONFIRM_SEASON)].A.to_numpy()
    p4 = float(wilcoxon(pl).pvalue) if len(pl) >= 10 else np.nan
    crit = {"contrast": bool(med > 0 and p1 < 0.01), "prevalence": bool(share >= 0.60),
            "replication": bool(rep >= 0.75), "placebo": bool(np.isfinite(p4) and p4 > 0.05)}
    rows = [{"criterion": f"Contrast: median A, {CONFIRM_SEASON} (n = {len(prim)})", "value": med, "threshold": "> 0, Wilcoxon p < 0.01", "p": p1, "pass": crit["contrast"]},
            {"criterion": "Prevalence: share of clusters with A > 0", "value": share, "threshold": "≥ 0.60", "pass": crit["prevalence"]},
            {"criterion": f"Replication: seasons with median A > 0 ({len(by)} evaluable)", "value": rep, "threshold": "≥ 0.75", "pass": crit["replication"]},
            {"criterion": f"Placebo: first control as pseudo-kiln (n = {len(pl)})", "value": float(np.median(pl)) if len(pl) else np.nan, "threshold": "Wilcoxon p > 0.05", "p": p4, "pass": crit["placebo"]}]
    return {"rows": rows, "pass": all(crit.values()), "by_season": by.reset_index().to_dict("records")}


def _smooth3(x: np.ndarray) -> np.ndarray:
    """Centred 3-period running mean along the last axis, NaN-aware (edges use the available neighbours)."""
    v = np.where(np.isfinite(x), x, 0.0)
    n = np.isfinite(x).astype(float)
    pad = [(0, 0)] * (x.ndim - 1) + [(1, 1)]
    vs, ns = np.pad(v, pad), np.pad(n, pad)
    s = vs[..., :-2] + vs[..., 1:-1] + vs[..., 2:]
    c = ns[..., :-2] + ns[..., 1:-1] + ns[..., 2:]
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(c > 0, s / np.maximum(c, 1), np.nan)


def season_metrics(E: np.ndarray, doy: np.ndarray) -> dict:
    """Onset/end/peak (days since 1 Jul) and duration for series E over one season (last axis = periods).
    Window 1 Sep (doy 62) .. 30 Jun (doy 364); threshold 50% of the smoothed peak; NaN when the peak is not > 0."""
    sm = _smooth3(np.atleast_2d(E))
    w = np.where((doy >= 62) & (doy <= 364), sm, np.nan)
    pk = np.argmax(np.where(np.isfinite(w), w, -np.inf), axis=-1)
    pv = np.take_along_axis(w, pk[:, None], axis=-1)[:, 0]
    ok = np.isfinite(pv) & (pv > 0)
    above = (w >= 0.5 * pv[:, None]) & np.isfinite(w)
    has = above.any(axis=-1) & ok
    first = np.argmax(above, axis=-1)
    last = above.shape[-1] - 1 - np.argmax(above[:, ::-1], axis=-1)
    f = lambda idx: np.where(has, doy[idx].astype(float), np.nan)
    on, end = f(first), f(last)
    return {"onset": on, "end": end, "duration": end - on, "peak": np.where(ok, doy[pk].astype(float), np.nan), "peak_value": np.where(ok, pv, np.nan)}


def area_excess(M: np.ndarray, periods: pd.DatetimeIndex, idx: np.ndarray | None = None) -> np.ndarray:
    """E(t) per row of idx (clusters × periods matrix M): median over the chosen clusters of e(t),
    minus that season's Jul–Oct median of E. idx=None uses every cluster once."""
    rows = M[None, :, :] if idx is None else M[idx]
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        E = np.nanmedian(rows, axis=1)
        seas = season_of(pd.Series(periods)).to_numpy()
        off = np.isin(periods.month, OFF_MONTHS)
        for s in np.unique(seas):
            m = seas == s
            E[:, m] -= np.nanmedian(np.where(off & m, E, np.nan), axis=1)[:, None]
    return E


def unit_summary(e: pd.DataFrame, members, periods: pd.DatetimeIndex, rng, n_boot=N_BOOT, metrics=True) -> dict:
    """Area series with a bootstrap band, and per-season metrics with 95% intervals (bootstrap over clusters)."""
    members = np.asarray(sorted(set(members) & set(e.cluster_id)))
    n = len(members)
    M = e[e.cluster_id.isin(members)].pivot_table(index="cluster_id", columns="period", values="e").reindex(index=members, columns=periods).to_numpy()
    point = area_excess(M, periods)[0]
    idx = rng.integers(0, n, size=(n_boot, n))
    step = max(1, 20_000_000 // max(1, n * len(periods)))  # bound memory: batch the bootstrap
    B = np.vstack([area_excess(M, periods, idx[i:i + step]) for i in range(0, n_boot, step)])
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        lo, hi = np.nanpercentile(B, 2.5, axis=0), np.nanpercentile(B, 97.5, axis=0)
    out = []
    seas = season_of(pd.Series(periods)).to_numpy()
    for s in sorted(set(seas)) if metrics else []:
        m = seas == s
        doy = np.asarray((periods[m] - pd.Timestamp(int(s[:4]), 7, 1)).days)
        if doy.min() > 62 or doy.max() < 300:  # incomplete season
            continue
        pm, bm = season_metrics(point[m], doy), season_metrics(B[:, m], doy)
        row = {"season": s}
        for k in ("onset", "end", "duration", "peak", "peak_value"):
            v = bm[k][np.isfinite(bm[k])]
            d = 3 if k == "peak_value" else 0
            ok = np.isfinite(pm[k][0]) and len(v) >= n_boot // 2
            # p50 is the bootstrap median of the same distribution as lo/hi, so the CI brackets it by construction
            row[k] = {"p50": round(float(np.percentile(v, 50)), d), "lo": round(float(np.percentile(v, 2.5)), d), "hi": round(float(np.percentile(v, 97.5)), d)} if ok else None
        out.append(row)
    r = lambda a: [None if not np.isfinite(x) else round(float(x), 3) for x in a]
    return {"n_clusters": n, "e": r(point), "lo": r(lo), "hi": r(hi), "seasons": out}


# --- stage ---------------------------------------------------------------------------
P_ROWS = [  # Amendment 1 exploratory pilots, as written there (values are the pilot's, not recomputed)
    {"channel": "FIRMS VIIRS active fire (S-NPP, NOAA-20, NOAA-21)", "measure": "clusters with ≥ 1 night detection, 2012–2026", "kiln": "37 of 3,653", "control": "47 of 10,959", "reading": "invisible"},
    {"channel": "ECOSTRESS 70 m land surface temperature (night)", "measure": "site − surroundings, Dec–May", "kiln": "+0.52 K", "control": "+0.46 K", "reading": "no signal"},
    {"channel": "Landsat 8/9 surface temperature (day)", "measure": "site − surroundings, Dec–Apr / other months", "kiln": "+2.4 / +1.8 K", "control": "+0.9 / +0.7 K", "reading": "sees the kiln structure, not firing"},
    {"channel": "Sentinel-5P TROPOMI SO₂ / NO₂", "measure": "winter excess vs kiln density (t)", "kiln": "t = 0.95 / −1.19", "control": "—", "reading": "no signal"},
    {"channel": "NASA Black Marble night lights (VNP46A2)", "measure": "Dec–Apr minus Jul–Oct radiance", "kiln": "+0.38 nW/cm²/sr (80% > 0)", "control": "−0.01 (49% > 0)", "reading": "signal → test GL"},
    {"channel": "Sentinel-1 radar VV (yard − ring)", "measure": "Dec–Apr minus Jul–Oct", "kiln": "+0.47 dB", "control": "−0.10 dB", "reading": "signal → test GS"},
]


def contamination() -> dict:
    """Upper bound on kiln heat inside the fire calendar: share of Bangladesh VIIRS detections (Nov–May, nominal+high)
    falling on kiln-cluster footprints, against the same share for one set of matched-control footprints."""
    from .kilns import link, link_points

    det = pd.read_parquet(C.INTERIM / "detections.parquet")
    cells = set(pd.read_parquet(C.INTERIM / "unit_cells.parquet", columns=["cell_id"]).cell_id)
    v = det[det.sensor.isin(["N", "J1", "J2"]) & det.conf_class.isin(C.CONF_KEEP) & det.cell_id.isin(cells) & det.date_local.dt.month.isin(C.FIRING_MONTHS)]
    lk = link(v, link_points(pd.read_parquet(C.INTERIM / "kilns.parquet"), pd.read_parquet(C.INTERIM / "controls.parquet")), "pixel")
    k, c = lk[lk.unit_type == "cluster"].det_idx.nunique(), lk[lk.unit_type == "control"].det_idx.nunique() / 3
    return {"detections": int(len(v)), "kiln_share": k / len(v), "control_share": c / len(v), "period": f"{v.date_local.min():%Y}–{v.date_local.max():%Y}"}


NON_CLAIMS = [  # Amendment 1 additions (shipped with the layer; meta.json keeps the pre-registered nine)
    ("That night lights measure combustion or emissions. They measure activity at kiln sites: lighting, resident workers, open feed holes.",
     "রাতের আলো দহন বা নির্গমন মাপে না; এটি ভাটা এলাকার কর্মকাণ্ড (আলো, শ্রমিকদের উপস্থিতি, খোলা জ্বালানি-মুখ) দেখায়।"),
    ("That radar measures firing. It measures brick stacks in kiln yards, which track production.",
     "রাডার ভাটা জ্বালানো মাপে না; এটি ভাটার আঙিনায় ইটের স্তূপ (উৎপাদন) দেখায়।"),
    ("That a low night-light reading shows a particular kiln was closed. Kiln seasons are pooled over at least five clusters.",
     "রাতের আলো কম থাকলেই কোনো নির্দিষ্ট ভাটা বন্ধ ছিল — এমন প্রমাণ হয় না; মৌসুম কমপক্ষে পাঁচটি গুচ্ছ মিলিয়ে হিসাব করা।"),
]


def run(extract_kind: str | None = None, kinds=("ntl", "s1")) -> dict | None:
    from .ingest import read_units

    kilns = pd.read_parquet(C.INTERIM / "kilns.parquet")
    clusters = pd.read_parquet(C.INTERIM / "clusters.parquet")
    ctrl = pd.read_parquet(C.INTERIM / "controls.parquet")
    s = sites(kilns, clusters, ctrl)
    for kind in (("ntl", "s1") if extract_kind == "all" else (extract_kind,) if extract_kind else ()):
        extract(kind, s)
    if not (CACHE / "ntl").exists():
        log.warning("activity: no night-light cache; run `python -m kilnwatch activity --extract ntl` (skipped)")
        return None
    exclude = set(json.loads((C.INTERIM / "activity_pilot.json").read_text(encoding="utf-8"))["cluster_ids"])
    rng = np.random.default_rng(C.SEED + C.SEED_OFFSETS["activity"])
    res = {"pilots": P_ROWS, "tests": {}, "contamination": contamination()}
    exc = {}
    for kind in kinds:
        if not (CACHE / kind).exists():
            continue
        p = panel(kind)
        exc[kind] = excess(p, s)
        res["tests"]["GL" if kind == "ntl" else "GS"] = confirm(amplitude(exc[kind]), amplitude(excess(p, placebo_sites(s))), exclude, REPLICATION[kind])
        log.info("%s pass=%s", "GL" if kind == "ntl" else "GS", res["tests"]["GL" if kind == "ntl" else "GS"]["pass"])
    gl = res["tests"].get("GL", {}).get("pass", False)
    gs = res["tests"].get("GS", {}).get("pass", False)
    layer = "ntl" if gl else "s1" if gs else None
    res["layer"] = layer
    if layer:
        e = exc[layer]
        periods = pd.DatetimeIndex(sorted(e.period.unique()))
        units = read_units()
        cl = clusters[["cluster_id", "district"]].copy()
        up = units[units.level == "upazila"]
        import geopandas as gpd

        cp = gpd.GeoDataFrame(clusters[["cluster_id"]], geometry=gpd.points_from_xy(clusters.lon, clusters.lat), crs=4326)
        cl = cl.merge(gpd.sjoin(cp, up[["unit_id", "geometry"]], predicate="within")[["cluster_id", "unit_id"]].drop_duplicates("cluster_id"), on="cluster_id", how="left")
        dist_id = units[units.level == "district"].set_index("name_en").unit_id
        cl["district_id"] = cl.district.map(dist_id)
        res["national"] = unit_summary(e, clusters.cluster_id, periods, rng)
        areas = {}
        for col in ("district_id", "unit_id"):
            for uid, g in cl.dropna(subset=[col]).groupby(col):
                if len(g) >= MIN_AREA_CLUSTERS:
                    u = unit_summary(e, g.cluster_id, periods, rng)
                    if col == "unit_id":
                        del u["e"], u["lo"], u["hi"]  # upazilas: season metrics only (size budget)
                    areas[uid] = u
        res["areas"] = areas
        res["periods"] = [d.strftime("%Y-%m-%d") for d in periods]
        res["cadence"] = "half-month" if layer == "ntl" else "month"
    if "s1" in exc and layer != "s1":  # radar as an independent check on the national curve (display band only)
        e = exc["s1"]
        periods = pd.DatetimeIndex(sorted(e.period.unique()))
        u = unit_summary(e, clusters.cluster_id, periods, rng, n_boot=200, metrics=False)
        res["national_check"] = {"channel": "s1", "periods": [d.strftime("%Y-%m-%d") for d in periods], "e": u["e"], "lo": u["lo"], "hi": u["hi"]}
    (C.INTERIM / "activity.json").write_text(json.dumps(res, default=_num, indent=0), encoding="utf-8")
    _write_public(res)
    _write_report(res)
    return res


def _num(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating, float)):
        return None if not np.isfinite(o) else float(o)
    if isinstance(o, np.bool_):
        return bool(o)
    raise TypeError(type(o))


def _write_public(res: dict) -> None:
    from .export import _dump, nan_to_none

    pub = {"pilots": res["pilots"], "layer": res["layer"],
           "tests": [{"test": t, **r} for t, v in res["tests"].items() for r in v["rows"]],
           "pass": {t: v["pass"] for t, v in res["tests"].items()},
           "non_claims": [{"en": e, "bn": b} for e, b in NON_CLAIMS]}
    for k in ("contamination", "national", "areas", "periods", "cadence", "national_check"):
        if k in res:
            pub[k] = res[k]
    _dump(nan_to_none(json.loads(json.dumps(pub, default=_num))), C.INTERIM / "public" / "kiln_activity.json")


def _write_report(res: dict) -> None:
    L = ["# Kiln activity report (Amendment 1)", "", "Rules: PREREGISTRATION_AMENDMENTS.md. Pilot clusters are excluded from every test.", "",
         "## Kiln heat inside the fire calendar (upper bound)", ""]
    if res.get("contamination"):
        c = res["contamination"]
        L += [f"Of {c['detections']:,} Bangladesh VIIRS detections (Nov–May, nominal+high, {c['period']}), {c['kiln_share']:.3%} fall on kiln-cluster "
              f"footprints, against {c['control_share']:.3%} on one set of matched-control footprints.", ""]
    L += ["## Exploratory pilots (400 Dhaka clusters, 2023-24)", "", "| Channel | Measure | Kiln | Control | Reading |", "|---|---|---|---|---|"]
    L += [f"| {r['channel']} | {r['measure']} | {r['kiln']} | {r['control']} | {r['reading']} |" for r in res["pilots"]]
    for t, v in res["tests"].items():
        L += ["", f"## {t} ({'night lights' if t == 'GL' else 'Sentinel-1 radar'}): **{'PASS' if v['pass'] else 'FAIL'}**", "",
              "| Criterion | Value | Threshold | p | |", "|---|---|---|---|---|"]
        pf = lambda p: "" if p is None or not np.isfinite(p) else f"{p:.2g}"
        L += [f"| {r['criterion']} | {r['value']:.4g} | {r['threshold']} | {pf(r.get('p'))} | {'PASS' if r['pass'] else 'FAIL'} |" for r in v["rows"]]
        L += ["", "Median A by season: " + ", ".join(f"{b['season']} {b['median']:.3g} (n={b['count']})" for b in v["by_season"])]
    L += ["", f"## Layer shipped: `{res['layer']}`"]
    if res.get("national"):
        L += ["", "National kiln season (half-month resolution; 95% bootstrap interval over clusters):", "",
              "| Season | Onset | End | Duration (days) | Peak |", "|---|---|---|---|---|"]
        day = lambda s, d: (pd.Timestamp(int(s[:4]), 7, 1) + pd.Timedelta(days=d)).strftime("%d %b")
        f = lambda s, c: "–" if not c else f"{day(s, c['p50'])} [{day(s, c['lo'])} – {day(s, c['hi'])}]"
        g = lambda c: "–" if not c else f"{c['p50']:.0f} [{c['lo']:.0f}–{c['hi']:.0f}]"
        L += [f"| {s['season']} | {f(s['season'], s['onset'])} | {f(s['season'], s['end'])} | {g(s['duration'])} | {f(s['season'], s['peak'])} |" for s in res["national"]["seasons"]]
    (C.REPORTS / "kiln_activity_report.md").write_text("\n".join(L) + "\n", encoding="utf-8")
