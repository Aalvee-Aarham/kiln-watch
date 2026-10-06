"""Earth Engine: clear-land FRACTIONS (never counts), water fraction, WorldCover, S5P, ERA5 (architecture §5.1)."""
from __future__ import annotations

import logging
import os
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pandas as pd

from . import config as C

log = logging.getLogger("kilnwatch.gee")
COLL = {"T": "MODIS/061/MOD14A1", "A": "MODIS/061/MYD14A1", "N": "NASA/VIIRS/002/VNP14A1"}
FIRST = {"T": "2003-01", "A": "2003-01", "N": "2012-01"}
CACHE = C.RAW / "gee"
_ee = None


def ee():
    global _ee
    if _ee is None:
        import ee as _m

        _m.Initialize(project=C.EE_PROJECT or None)
        _ee = _m
    return _ee


def _fc(gdf, id_col="unit_id", tol=0.005):
    E = ee()
    g = gdf[[id_col, "geometry"]].copy()
    g["geometry"] = g.geometry.simplify(tol)
    return E.FeatureCollection(g.__geo_interface__)


def _clear_mask(img):
    """Observed clear land = FireMask 5,7,8,9. Water(3), cloud(4), unknown(6), not processed(1,2) excluded."""
    return img.select("FireMask").remap([5, 7, 8, 9], [1, 1, 1, 1], 0).unmask(0)


def daily_clear_fraction(sensor: str, units_fc, month: str, id_col="unit_id", reducer="mean") -> pd.DataFrame:
    """One month of daily clear fractions per unit: mean of a 0/1 mask over all unit pixels = sum(clear)/count."""
    E = ee()
    start = pd.Timestamp(month + "-01")
    end = start + pd.offsets.MonthBegin(1)
    col = E.ImageCollection(COLL[sensor]).filterDate(start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
    n = col.size().getInfo()
    if n == 0:
        return pd.DataFrame(columns=[id_col, "date_local", "clear_frac"])
    dates = col.aggregate_array("system:index").getInfo()
    img = col.map(_clear_mask).toBands().rename([f"d{d.replace('_', '')}" for d in dates])
    red = E.Reducer.mean() if reducer == "mean" else E.Reducer.first()
    fc = img.reduceRegions(collection=units_fc, reducer=red, scale=1000, tileScale=4)
    df = E.data.computeFeatures({"expression": fc.select([id_col] + img.bandNames().getInfo(), retainGeometry=False), "fileFormat": "PANDAS_DATAFRAME"})
    long = df.melt(id_vars=[id_col], var_name="band", value_name="clear_frac").dropna()
    long["date_local"] = pd.to_datetime(long.band.str[1:], format="%Y%m%d")
    return long[[id_col, "date_local", "clear_frac"]]


def _months(sensor, first=None, last=None):
    lo = pd.Period(first or FIRST[sensor], "M")
    hi = pd.Period(last or (pd.Timestamp.today() - pd.Timedelta(days=10)).strftime("%Y-%m"), "M")
    return [str(p) for p in pd.period_range(lo, hi, freq="M")]


def run_clear(unit_set: str, units, sensors=("A", "N", "T"), first=None, last=None, id_col="unit_id", reducer="mean", workers=int(os.environ.get("GEE_WORKERS", 4))) -> pd.DataFrame:
    """Cached, resumable: one parquet per (unit_set, sensor, month)."""
    fc = _fc(units, id_col) if reducer == "mean" else ee().FeatureCollection(units.__geo_interface__)
    jobs = [(s, m) for s in sensors for m in _months(s, first, last)]

    def job(sm):
        s, m = sm
        p = CACHE / "clear" / unit_set / s / f"{m}.parquet"
        if p.exists():
            return p
        for attempt in range(3):
            try:
                df = daily_clear_fraction(s, fc, m, id_col, reducer).assign(sensor=s)
                p.parent.mkdir(parents=True, exist_ok=True)
                tmp = p.with_suffix(".tmp")
                df.to_parquet(tmp, index=False)
                tmp.replace(p)
                return p
            except Exception as e:  # GEE timeouts: bounded retry, then leave for the next resumable run
                log.warning("GEE %s %s %s attempt %d: %s", unit_set, s, m, attempt, str(e)[:200])
        return None

    with ThreadPoolExecutor(workers) as ex:
        done = list(ex.map(job, jobs))
    missing = [j for j, d in zip(jobs, done) if d is None]
    if missing:
        log.error("GEE %s: %d months missing; rerun to resume", unit_set, len(missing))
    return load_clear(unit_set)


def load_clear(unit_set: str) -> pd.DataFrame:
    files = sorted((CACHE / "clear" / unit_set).glob("*/*.parquet"))
    if not files:
        raise FileNotFoundError(f"GEE cache missing for {unit_set}: run `python -m kilnwatch gee --units {unit_set}`")
    return pd.concat([pd.read_parquet(f) for f in files], ignore_index=True)


def water_fraction(units) -> pd.Series:
    E = ee()
    wc = E.ImageCollection("ESA/WorldCover/v200").first().select("Map").eq(80)
    fc = wc.reduceRegions(collection=_fc(units), reducer=E.Reducer.mean(), scale=100, tileScale=4)
    df = E.data.computeFeatures({"expression": fc.select(["unit_id", "mean"], retainGeometry=False), "fileFormat": "PANDAS_DATAFRAME"})
    return df.set_index("unit_id")["mean"]


def worldcover_at_points(points: pd.DataFrame) -> pd.Series:
    """WorldCover class at lat/lon points (chunked)."""
    E = ee()
    wc = E.ImageCollection("ESA/WorldCover/v200").first().select("Map")
    out = []
    for i in range(0, len(points), 4000):
        ch = points.iloc[i:i + 4000]
        feats = [E.Feature(E.Geometry.Point([lon, lat]), {"i": int(j)}) for j, lat, lon in zip(ch.index, ch.lat, ch.lon)]
        fc = wc.reduceRegions(collection=E.FeatureCollection(feats), reducer=E.Reducer.first(), scale=10)
        df = E.data.computeFeatures({"expression": fc.select(["i", "first"], retainGeometry=False), "fileFormat": "PANDAS_DATAFRAME"})
        out.append(df.set_index("i")["first"])
    return pd.concat(out).reindex(points.index)


def s5p_monthly(polys, gas="NO2", first="2019-01", last=None) -> pd.DataFrame:
    E = ee()
    band = {"NO2": ("COPERNICUS/S5P/OFFL/L3_NO2", "tropospheric_NO2_column_number_density"),
            "SO2": ("COPERNICUS/S5P/OFFL/L3_SO2", "SO2_column_number_density")}[gas]
    fc = _fc(polys)
    rows = []
    for m in _months("N", first, last):
        p = CACHE / "s5p" / gas / f"{m}.parquet"
        if not p.exists():
            s = pd.Timestamp(m + "-01")
            img = E.ImageCollection(band[0]).select(band[1]).filterDate(s.strftime("%Y-%m-%d"), (s + pd.offsets.MonthBegin(1)).strftime("%Y-%m-%d")).mean()
            r = img.reduceRegions(collection=fc, reducer=E.Reducer.mean(), scale=1113, tileScale=4)
            df = E.data.computeFeatures({"expression": r.select(["unit_id", "mean"], retainGeometry=False), "fileFormat": "PANDAS_DATAFRAME"})
            p.parent.mkdir(parents=True, exist_ok=True)
            df.assign(month=m).to_parquet(p, index=False)
        rows.append(pd.read_parquet(p))
    return pd.concat(rows, ignore_index=True)


def era5_daily(lat: float, lon: float, start: str, end: str) -> pd.DataFrame:
    E = ee()
    p = CACHE / "era5" / f"{lat:.2f}_{lon:.2f}_{start}_{end}.parquet"
    if p.exists():
        return pd.read_parquet(p)
    col = E.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR").filterDate(start, end).select(
        ["temperature_2m", "total_precipitation_sum", "u_component_of_wind_10m", "v_component_of_wind_10m"])
    pt = E.Geometry.Point([lon, lat])
    vals = col.getRegion(pt, 11132).getInfo()
    df = pd.DataFrame(vals[1:], columns=vals[0])
    df["date"] = pd.to_datetime(df["time"], unit="ms").dt.normalize()
    df = df.drop(columns=["id", "longitude", "latitude", "time"])
    p.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(p, index=False)
    return df


def run(dataset="clear", units_sel="admin", sensor=None, start=None) -> None:
    from .ingest import _parquet, read_units

    sensors = (sensor,) if sensor else ("A", "T", "N")
    units = read_units()
    if dataset == "clear" and units_sel == "admin":
        adm = units[units.level.isin(["division", "district", "upazila"])]
        run_clear("admin", adm, sensors, first=start)
    elif dataset == "clear" and units_sel == "transfer":
        run_clear("transfer", units[units.level == "transfer"], sensors, first=start or "2012-01")
    elif dataset == "clear" and units_sel == "footprints":
        import geopandas as gpd

        from .kilns import link_points

        kilns = pd.read_parquet(C.INTERIM / "kilns.parquet")
        ctrl = pd.read_parquet(C.INTERIM / "controls.parquet")
        pts = link_points(kilns, ctrl).reset_index(drop=True)
        pts["pid"] = pts.index.astype(int)
        g = gpd.GeoDataFrame(pts[["pid"]], geometry=gpd.points_from_xy(pts.lon, pts.lat), crs=4326)
        y = int(C.GATE_SEASON[:4])
        first = start or f"{y}-07"
        for i in range(0, len(g), 5000):
            run_clear(f"footprints/{i // 5000}", g.iloc[i:i + 5000], sensors, first=first, last=f"{y + 1}-06", id_col="pid", reducer="first")
        cl = pd.concat([load_clear(f"footprints/{i // 5000}") for i in range(0, len(g), 5000)], ignore_index=True)
        cl = cl.merge(pts[["pid", "unit_id"]], on="pid").groupby(["unit_id", "date_local", "sensor"], as_index=False).clear_frac.mean()
        _parquet(cl, C.INTERIM / "clear_footprints.parquet")
    elif dataset == "worldcover":
        clusters = pd.read_parquet(C.INTERIM / "clusters.parquet")
        wc = worldcover_at_points(clusters[["lat", "lon"]])
        _parquet(pd.DataFrame({"cluster_id": clusters.cluster_id, "wc_class": wc.to_numpy()}), C.INTERIM / "worldcover_clusters.parquet")
    elif dataset == "water":
        adm = units[units.level == "upazila"]
        wf = water_fraction(adm).sort_values()
        # A3a: choose the upazila with the most permanent water as the water-assertion unit
        uid = wf.index[-1]
        C.write_derived("WATER_CHECK_UNIT", {"unit_id": uid, "water_fraction": round(float(wf.iloc[-1]), 4)}, "ESA WorldCover v200 class 80 mean (A3a)")
    elif dataset == "s5p":
        for gas in ("NO2", "SO2"):
            s5p_monthly(units[units.level == "upazila"], gas)
    elif dataset == "era5":
        era5_daily(23.81, 90.41, "2017-01-01", pd.Timestamp.today().strftime("%Y-%m-%d"))
    log.info("gee %s %s done", dataset, units_sel)


def write_admin_clear() -> pd.DataFrame:
    """Consolidate the admin cache into interim/clear.parquet and run the A3b assertions."""
    from .ingest import _parquet

    cl = load_clear("admin")
    cl["clear_frac"] = cl.clear_frac.astype("float32")
    cl["month"] = cl.date_local.dt.month
    mons = cl[cl.month.isin(C.MONSOON_MONTHS)].clear_frac.mean()
    dry = cl[cl.month.isin([12, 1, 2, 3])].clear_frac.mean()
    assert mons < dry, f"A3b: monsoon clear fraction {mons:.3f} not below dry season {dry:.3f}"
    wcu = C.load_derived()["WATER_CHECK_UNIT"]["value"]
    if wcu:
        mx = cl[cl.unit_id == wcu["unit_id"]].clear_frac.max()
        assert mx <= (1 - wcu["water_fraction"]) + 0.05, f"A3b: water unit clear fraction {mx:.3f} exceeds land share"
    _parquet(cl.drop(columns="month"), C.INTERIM / "clear.parquet")
    log.info("clear: %d rows; monsoon %.3f < dry %.3f", len(cl), mons, dry)
    return cl


def worldcover_grid(step=0.0025):
    """ESA WorldCover class (sampled at cell centres) on a regular lat/lon grid over the BBOX (one computePixels call), cached as .npz."""
    p = CACHE / "worldcover_grid.npz"
    if p.exists():
        z = np.load(p)
        return z["cls"], float(z["w"]), float(z["n"]), float(z["step"])
    E = ee()
    w, s, e, n = C.BBOX_W, C.BBOX_S, C.BBOX_E, C.BBOX_N
    wc = E.ImageCollection("ESA/WorldCover/v200").first().select("Map")
    img = wc  # nearest-pixel class at each grid centre (a mode reduction from 10 m exceeds the 2^31 pixel limit)
    cols, rows = round((e - w) / step), round((n - s) / step)
    arr = E.data.computePixels({"expression": img.unmask(0).toByte(), "fileFormat": "NUMPY_NDARRAY",
                                "grid": {"dimensions": {"width": cols, "height": rows},
                                         "affineTransform": {"scaleX": step, "shearX": 0, "translateX": w, "shearY": 0, "scaleY": -step, "translateY": n},
                                         "crsCode": "EPSG:4326"}})
    cls = np.asarray(arr["Map"], dtype=np.uint8)
    p.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(p, cls=cls, w=w, n=n, step=step)
    return cls, w, n, step


def wc_lookup_fn():
    cls, w, n, step = worldcover_grid()

    def look(lat, lon):
        r = np.clip(((n - np.asarray(lat)) / step).astype(int), 0, cls.shape[0] - 1)
        c = np.clip(((np.asarray(lon) - w) / step).astype(int), 0, cls.shape[1] - 1)
        return cls[r, c]
    return look
