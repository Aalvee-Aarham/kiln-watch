"""FIRMS archive/API, boundaries, inventories, OpenAQ (architecture §5.1)."""
from __future__ import annotations

import io
import json
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from . import config as C
from .grid import cell_id, season_series

log = logging.getLogger("kilnwatch.ingest")
FIRMS = "https://firms.modaps.eosdis.nasa.gov"
FIRMS_DIR = C.RAW / "firms"

# source -> (sensor or None if from 'satellite' column, level)
SOURCES = {
    "MODIS_SP": (None, "SP"), "MODIS_NRT": (None, "NRT"),
    "VIIRS_SNPP_SP": ("N", "SP"), "VIIRS_SNPP_NRT": ("N", "NRT"),
    "VIIRS_NOAA20_SP": ("J1", "SP"), "VIIRS_NOAA20_NRT": ("J1", "NRT"),
    "VIIRS_NOAA21_NRT": ("J2", "NRT"),
}
START = {"MODIS_SP": date(2003, 1, 1)}  # MYD-eq record and day0 start 2003-01-01


def session() -> requests.Session:
    s = requests.Session()
    retry = Retry(total=3, backoff_factor=2, status_forcelist=[429, 500, 502, 503, 504])
    s.mount("https://", HTTPAdapter(max_retries=retry, pool_maxsize=8))
    return s


def atomic_write(path: Path, data: bytes | str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data.encode() if isinstance(data, str) else data)
    tmp.replace(path)


def data_availability(s=None) -> pd.DataFrame:
    s = s or session()
    cached = FIRMS_DIR / "data_availability.csv"
    r = s.get(f"{FIRMS}/api/data_availability/csv/{C.FIRMS_MAP_KEY}/ALL", timeout=60)
    if r.ok and r.text.startswith("data_id"):
        atomic_write(cached, r.text)
    elif cached.exists():  # refused while over quota: use the last good copy
        log.warning("data_availability refused (%s); using cached copy", r.status_code)
    else:
        r.raise_for_status()
    return pd.read_csv(cached)


_pace_lock = threading.Lock()
_pace_n = [0]


def _pace(s, every=20, ceiling=4300) -> None:
    """Every `every` calls, read the quota status and wait (bounded) while usage is near the 5000/10 min limit."""
    with _pace_lock:
        _pace_n[0] += 1
        if _pace_n[0] % every:
            return
        for _ in range(20):
            try:
                used = s.get(f"{FIRMS}/mapserver/mapkey_status/?MAP_KEY={C.FIRMS_MAP_KEY}", timeout=30).json()["current_transactions"]
            except Exception:
                return
            if used < ceiling:
                return
            log.info("FIRMS usage %d/5000; waiting 60 s", used)
            time.sleep(60)


def area_window(source: str, start: date, s, bbox=None, days=5, force=False) -> Path:
    """One 5-day FIRMS Area API window, cached per (source, start). A header-only response is empty, not an error."""
    path = FIRMS_DIR / "api" / source / f"{start.isoformat()}.csv"
    if path.exists() and not force:
        return path
    _pace(s)
    w, so, e, n = bbox or (C.BBOX_W, C.BBOX_S, C.BBOX_E, C.BBOX_N)
    url = f"{FIRMS}/api/area/csv/{C.FIRMS_MAP_KEY}/{source}/{w},{so},{e},{n}/{days}/{start.isoformat()}"
    for attempt in range(12):  # bounded: quota window is 10 min, so 12 x 90 s always spans one
        r = s.get(url, timeout=120)
        if r.status_code == 404:
            atomic_write(path, "")
            return path
        # Over quota FIRMS answers 400 "Exceeding…" or, intermittently, "Invalid MAP_KEY."
        if r.status_code == 400 and ("Exceeding" in r.text[:200] or "Invalid MAP_KEY" in r.text[:200]):
            log.warning("FIRMS quota reached (%s %s); sleeping 90 s", source, start)
            time.sleep(90)
            continue
        r.raise_for_status()
        atomic_write(path, r.text)
        return path
    raise RuntimeError(f"FIRMS quota not recovered for {source} {start}")


def backfill(source: str, start: date, end: date, workers=4, force_recent_days=0) -> int:
    s = session()
    starts = []
    d = start
    while d <= end:
        starts.append(d)
        d += timedelta(days=5)
    recent = date.today() - timedelta(days=force_recent_days)

    def job(st):
        try:
            return area_window(source, st, s, force=force_recent_days > 0 and st + timedelta(days=5) >= recent)
        except Exception as e:  # missing windows are retried on the next run (cache is per window)
            log.error("%s %s failed: %s", source, st, e)

    with ThreadPoolExecutor(workers) as ex:
        list(ex.map(job, starts))
    log.info("%s: %d windows", source, len(starts))
    return len(starts)


def fetch_all_firms() -> None:
    av = data_availability().set_index("data_id")
    for src in SOURCES:
        lo = max(pd.Timestamp(av.loc[src, "min_date"]).date(), START.get(src, date(2000, 1, 1)))
        hi = pd.Timestamp(av.loc[src, "max_date"]).date()
        backfill(src, lo, hi, workers=2, force_recent_days=10 if src.endswith("NRT") else 0)


# --- normalise -----------------------------------------------------------------
def _modis_conf(c):
    c = pd.to_numeric(c, errors="coerce")
    return pd.cut(c, [-1, 29, 79, 100], labels=["low", "nominal", "high"]).astype(str)


def normalise(df: pd.DataFrame, source: str) -> pd.DataFrame:
    if df.empty:
        return df
    sensor, level = SOURCES[source]
    is_modis = sensor is None
    out = pd.DataFrame({
        "lat": df["latitude"].astype("float64"),
        "lon": df["longitude"].astype("float64"),
    })
    if is_modis:
        out["sensor"] = df["satellite"].astype(str).str[0].map({"T": "T", "A": "A"})
        out["bt_mir"], out["bt_tir"] = df["brightness"], df["bt_t31" if "bt_t31" in df else "bright_t31"]
        out["conf_class"] = _modis_conf(df["confidence"])
    else:
        out["sensor"] = sensor
        out["bt_mir"], out["bt_tir"] = df["bright_ti4"], df["bright_ti5"]
        out["conf_class"] = df["confidence"].astype(str).str[0].map({"l": "low", "n": "nominal", "h": "high"})
    t = df["acq_time"].astype(int).astype(str).str.zfill(4)
    out["t_utc"] = pd.to_datetime(df["acq_date"] + " " + t.str[:2] + ":" + t.str[2:], utc=True)
    out["t_local"] = out["t_utc"].dt.tz_localize(None) + pd.Timedelta(hours=6)
    out["date_local"] = out["t_local"].dt.normalize()
    out["season"] = season_series(out["date_local"])
    out["pass"] = df["daynight"].astype(str).str[0]
    out["frp"] = df["frp"].astype("float32")
    out["scan_km"], out["track_km"] = df["scan"].astype("float32"), df["track"].astype("float32")
    out["type"] = pd.to_numeric(df["type"], errors="coerce").astype("Int8") if "type" in df else pd.array([pd.NA] * len(df), "Int8")
    out["source"] = level
    return out.dropna(subset=["sensor"])


def load_firms(sources=None, root: Path | None = None) -> pd.DataFrame:
    root = root or FIRMS_DIR / "api"
    frames = []
    for src in sources or SOURCES:
        for p in sorted((root / src).glob("*.csv")):
            if p.stat().st_size == 0:
                continue
            raw = pd.read_csv(p, dtype={"acq_date": str, "acq_time": str, "confidence": str, "satellite": str})
            if len(raw):
                frames.append(normalise(raw, src))
    det = pd.concat(frames, ignore_index=True)
    det = det[(det.lat >= C.BBOX_S) & (det.lat <= C.BBOX_N) & (det.lon >= C.BBOX_W) & (det.lon <= C.BBOX_E)]
    # SP supersedes NRT where both exist for a sensor and day
    sp_days = det.loc[det.source == "SP", ["sensor", "date_local"]].drop_duplicates().assign(_sp=True)
    det = det.merge(sp_days, on=["sensor", "date_local"], how="left")
    det = det[(det.source == "SP") | det._sp.isna()].drop(columns="_sp")
    det = det.drop_duplicates(["sensor", "lat", "lon", "t_utc"]).reset_index(drop=True)
    det["cell_id"] = cell_id(det["lat"].to_numpy(), det["lon"].to_numpy())
    for c in ("sensor", "pass", "conf_class", "source", "season"):
        det[c] = det[c].astype("category")
    return det


def write_detections() -> pd.DataFrame:
    det = load_firms()
    dupes = det.duplicated(["sensor", "lat", "lon", "t_utc"]).sum()
    assert dupes == 0, f"A1b: {dupes} duplicate keys"
    _parquet(det, C.INTERIM / "detections.parquet")
    counts = det.groupby(["sensor", "source"], observed=True).size().unstack(fill_value=0)
    (C.REPORTS / "ingest_counts.md").write_text("# Ingest counts\n\n" + counts.to_markdown() + "\n", encoding="utf-8")
    log.info("detections: %d rows", len(det))
    return det


def _parquet(df, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    df.to_parquet(tmp, index=False)
    tmp.replace(path)


# --- schema (A1a) ----------------------------------------------------------------
def schema_report() -> tuple:
    """A1a: derive CALIB_SEASONS from the archive and assert the committed tuple."""
    av = data_availability().set_index("data_id")
    snpp_start = pd.Timestamp(av.loc["VIIRS_SNPP_SP", "min_date"]).date()
    first = snpp_start.year if snpp_start <= date(snpp_start.year, 11, 1) else snpp_start.year + 1
    # Aqua drift from Jan 2022: last firing season wholly before it is 2020-21
    seasons = tuple(f"{y}-{(y + 1) % 100:02d}" for y in range(first, 2021))
    assert seasons == C.CALIB_SEASONS, f"A1a: derived {seasons} != committed {C.CALIB_SEASONS}"
    C.write_derived("CALIB_SEASONS", list(seasons), f"FIRMS data_availability VIIRS_SNPP_SP min_date={snpp_start}")
    lines = ["# Ingest schema (A1a)", "", av.to_markdown(), "", f"CALIB_SEASONS = {seasons}", ""]
    for src in SOURCES:
        files = sorted((FIRMS_DIR / "api" / src).glob("*.csv"))
        hdr = next((p.read_text().splitlines()[0] for p in files if p.stat().st_size), "")
        lines.append(f"- `{src}`: type column {'present' if 'type' in hdr.split(',') else 'ABSENT'}")
    C.REPORTS.mkdir(exist_ok=True)
    (C.REPORTS / "ingest_schema.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return seasons


# --- boundaries (A1d) ------------------------------------------------------------
HDX_PAK = "https://data.humdata.org/dataset/a64d1ff2-7158-48c7-887d-6af69ce21906/resource/c6521e04-75e1-41be-8e02-0554a424d9f4/download/pak_admin_boundaries.geojson.zip"


def load_boundaries():
    import geopandas as gpd

    bd = C.RAW / "boundaries" / "hdx_bgd"
    bn = pd.read_csv(C.STATIC / "names_bn.csv").set_index("name_en")["name_bn"]  # HDX carries no Bangla names
    parts = []
    for lvl, f, name_col, pc in (("division", "bgd_admin1.geojson", "adm1_name", "adm1_pcode"),
                                 ("district", "bgd_admin2.geojson", "adm2_name", "adm2_pcode"),
                                 ("upazila", "bgd_admin3.geojson", "adm3_name", "adm3_pcode")):
        g = gpd.read_file(bd / f)
        parts.append(gpd.GeoDataFrame({
            "unit_id": g[pc], "level": lvl, "name_en": g[name_col],
            "name_bn": g[name_col].map(bn).fillna(g[name_col]),
            "division": g["adm1_name"], "district": g["adm2_name"] if "adm2_name" in g else g[name_col],
            "geometry": g.geometry}, crs=g.crs))
    units = pd.concat(parts, ignore_index=True)
    tr = _transfer_boundary()
    if tr is not None:
        units = pd.concat([units, tr], ignore_index=True)
    units = gpd.GeoDataFrame(units, crs=4326)
    n_dist = int((units.level == "district").sum())
    assert n_dist == 64, f"A1b: expected 64 districts, got {n_dist}"
    units["geometry"] = units.geometry.make_valid()
    _parquet(units.to_wkb(), C.INTERIM / "units.parquet")
    return units


def _transfer_boundary():
    import zipfile

    import geopandas as gpd

    d = C.RAW / "boundaries" / "transfer"
    z = d / "pak.zip"
    if not z.exists():
        try:
            r = session().get(HDX_PAK, timeout=600)
            r.raise_for_status()
            atomic_write(z, r.content)
        except Exception as e:  # Should tier: absence is logged, not fatal
            log.warning("transfer boundary unavailable: %s", e)
            return None
    with zipfile.ZipFile(z) as zf:
        name = next(n for n in zf.namelist() if "admin2" in n and n.endswith(".geojson"))
        zf.extract(name, d)
    g = gpd.read_file(d / name)
    g.columns = [c.lower() for c in g.columns]
    g = g[g["adm2_name"].str.contains(C.TRANSFER_DISTRICT, case=False)]
    (d / "LICENCE.txt").write_text("OCHA HDX COD-AB Pakistan, CC BY-IGO\n")
    return gpd.GeoDataFrame({"unit_id": g["adm2_pcode"], "level": "transfer", "name_en": g["adm2_name"],
                             "name_bn": g["adm2_name"], "division": "Punjab (PK)", "district": g["adm2_name"],
                             "geometry": g.geometry}, crs=g.crs)


def read_units():
    import geopandas as gpd

    df = pd.read_parquet(C.INTERIM / "units.parquet")
    return gpd.GeoDataFrame(df, geometry=gpd.GeoSeries.from_wkb(df["geometry"]), crs=4326)


# --- inventories -----------------------------------------------------------------
def load_inventories() -> pd.DataFrame:
    inv = C.RAW / "inventories"
    rows = []
    bd = pd.read_csv(inv / "apad_bd" / "Brick_kilns_BAN-Main_coal.csv", encoding="utf-8-sig")
    rows.append(pd.DataFrame({"src": "apad", "licence": "CC BY 4.0", "src_id": bd["id"], "lat": bd["lat"], "lon": bd["lon"],
                              "kiln_type": bd["type"], "country": "BD"}))
    pk = inv / "apad_transfer" / "Brick_Kilns_PK-Main_coal.csv"
    if pk.exists():
        p = pd.read_csv(pk, encoding="utf-8-sig")
        rows.append(pd.DataFrame({"src": "apad", "licence": "CC BY 4.0", "src_id": p["id"], "lat": p["lat"], "lon": p["lon"],
                                  "kiln_type": p.get("type"), "country": "PK"}))
    for extra in ("lee2021", "sentinelkilndb"):  # loaded if present; primary chosen by the §12 rule
        f = inv / extra / "kilns.csv"
        if f.exists():
            e = pd.read_csv(f)
            rows.append(e.assign(src=extra, licence="CC BY-NC 4.0" if extra == "sentinelkilndb" else "see source"))
    df = pd.concat(rows, ignore_index=True).dropna(subset=["lat", "lon"])
    assert df["licence"].notna().all(), "A1b: every inventory row carries a licence"
    _parquet(df, C.INTERIM / "inventory.parquet")
    return df


# --- OpenAQ ------------------------------------------------------------------------
def fetch_openaq(years=range(2017, 2026)) -> pd.DataFrame:
    """Daily PM2.5 for Dhaka monitors, throttled to 1 request/s, one JSON per sensor-year."""
    s = session()
    s.headers["X-API-Key"] = C.OPENAQ_API_KEY
    out = C.RAW / "openaq"
    locs = s.get("https://api.openaq.org/v3/locations", params={"bbox": "90.30,23.65,90.50,23.90", "limit": 100, "parameters_id": 2}, timeout=60).json()["results"]
    frames = []
    for loc in locs:
        for sen in loc.get("sensors", []):
            if sen["parameter"]["name"] != "pm25":
                continue
            for y in years:
                f = out / f"{sen['id']}_{y}.json"
                if not f.exists():
                    time.sleep(1.0)
                    r = s.get(f"https://api.openaq.org/v3/sensors/{sen['id']}/days",
                              params={"datetime_from": f"{y}-01-01", "datetime_to": f"{y}-12-31", "limit": 400}, timeout=60)
                    atomic_write(f, r.text if r.ok else "{}")
                res = json.loads(f.read_text() or "{}").get("results", [])
                for x in res:
                    frames.append({"sensor_id": sen["id"], "date": x["period"]["datetimeFrom"]["local"][:10], "pm25": x["value"]})
    df = pd.DataFrame(frames)
    if len(df):
        df = df.groupby("date", as_index=False)["pm25"].median()
        _parquet(df, C.INTERIM / "pm25.parquet")
    return df


def run(only: str | None = None) -> None:
    C.REPORTS.mkdir(exist_ok=True)
    steps = {
        "firms": lambda: (fetch_all_firms(), schema_report(), write_detections()),
        "boundaries": load_boundaries,
        "inventories": load_inventories,
        "openaq": fetch_openaq,
    }
    for k, f in steps.items():
        if only in (None, k):
            log.info("ingest %s", k)
            f()
    if only in (None, "nightfire", "osm"):
        log.info("nightfire/osm: Should/Could tier sources not configured (EOG credentials absent); skipped")

