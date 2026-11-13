"""Read NASA FIRMS detections from the public Portolan GeoParquet mirror (CC0, no key) and cache them locally.

One cached row = (day, sensor, satellite, day/night, quality, type, 0.01-degree cell) with count and FRP.
That keeps everything later stages need while shrinking a region-year to a few MB.
"""
import datetime as dt
import os
import threading
import time
from pathlib import Path

import duckdb

from .regions import envelopes

BASE = os.environ.get("KW_FIRMS_BASE", "https://data.source.coop/portolan-mirrors/firms-catalog/detections")
DATA = Path(os.environ.get("KW_DATA", Path(__file__).resolve().parents[2] / "data"))
CACHE = DATA / "cache"
FIRST_YEAR = 2000
LIVE_TTL_S = 6 * 3600  # re-pull the current year after 6 h

# Attested first dates (FIRMS data_availability, quoted by the mirror). Last dates are measured, see sensor_days().
SENSOR_START = {
    "MODIS": "2000-11-01",
    "VIIRS_SNPP": "2012-01-20",
    "VIIRS_NOAA20": "2018-04-01",
    "VIIRS_NOAA21": "2024-01-17",
}
SENSORS = list(SENSOR_START)

# Confidence filter recommended by the mirror docs: drop VIIRS 'l' and MODIS < 30. Never crosswalked.
CONF_SQL = "((sensor = 'MODIS' AND confidence_pct >= 30) OR (sensor <> 'MODIS' AND confidence <> 'l'))"

_lock = threading.Lock()


def connect():
    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs;")
    con.execute("SET http_retries = 6; SET http_retry_wait_ms = 2000;")
    return con


def current_year():
    return dt.datetime.now(dt.timezone.utc).year


def _fresh(path: Path, year: int) -> bool:
    if not path.exists():
        return False
    return year < current_year() or (time.time() - path.stat().st_mtime) < LIVE_TTL_S


def fetch_year(con, bbox, year: int, out: Path):
    pred = " OR ".join(
        f"ST_Intersects(geometry, ST_MakeEnvelope({w}, {s}, {e}, {n}))" for w, s, e, n in envelopes(bbox)
    )
    # One row per detection, every confidence level, with the processing version and pixel size, so the
    # confidence filter can be tested, collections are never mixed silently and footprints are known.
    tmp = out.with_suffix(".tmp")
    con.execute(f"""
        COPY (
          SELECT acq_datetime, acq_date, sensor, satellite, daynight, quality, version, type, confidence,
                 confidence_pct, round(ST_Y(geometry), 4) AS lat, round(ST_X(geometry), 4) AS lon, frp, scan, track
          FROM read_parquet('{BASE}/year={year}/detections.parquet')
          WHERE {pred}
        ) TO '{tmp.as_posix()}' (FORMAT parquet, COMPRESSION zstd)
    """)
    os.replace(tmp, out)


def fetch_region(region_id: str, bbox, progress=None):
    """Make sure every year is cached. progress(year, done, total) is called as years finish."""
    folder = CACHE / region_id
    folder.mkdir(parents=True, exist_ok=True)
    years = list(range(FIRST_YEAR, current_year() + 1))
    con = connect()
    for i, y in enumerate(years):
        out = folder / f"{y}.parquet"
        if not _fresh(out, y):
            for attempt in range(3):
                try:
                    fetch_year(con, bbox, y, out)
                    break
                except duckdb.Error:
                    if attempt == 2:
                        raise
                    time.sleep(5 * (attempt + 1))
        if progress:
            progress(y, i + 1, len(years))
    return folder


def sensor_days(refresh=False):
    """Days on which each sensor delivered any detection anywhere on Earth (= the sensor was observing).

    This is the observing-opportunity denominator: it captures launches, outages and any end of mission
    from the data itself instead of hard-coded dates.
    """
    path = DATA / "sensor_days.parquet"
    with _lock:
        if path.exists() and not refresh and (time.time() - path.stat().st_mtime) < LIVE_TTL_S:
            return path
        DATA.mkdir(parents=True, exist_ok=True)
        con = connect()
        parts = []
        for y in range(FIRST_YEAR, current_year() + 1):
            part = DATA / "sensor_days" / f"sat-{y}.parquet"
            if not _fresh(part, y):
                part.parent.mkdir(exist_ok=True)
                tmp = part.with_suffix(".tmp")
                con.execute(f"""COPY (SELECT DISTINCT sensor, satellite, acq_date FROM
                    read_parquet('{BASE}/year={y}/detections.parquet')) TO '{tmp.as_posix()}' (FORMAT parquet)""")
                os.replace(tmp, part)
            parts.append(part.as_posix())
        # MODIS also gets per-satellite rows (MODIS_T = Terra, MODIS_A = Aqua): Aqua only joined in July 2002.
        con.execute(f"""COPY (
            SELECT DISTINCT sensor, acq_date FROM read_parquet({parts})
            UNION SELECT DISTINCT 'MODIS_' || left(satellite, 1), acq_date FROM read_parquet({parts}) WHERE sensor = 'MODIS'
            ORDER BY 1, 2) TO '{path.as_posix()}' (FORMAT parquet)""")
        return path


if __name__ == "__main__":
    import sys
    from concurrent.futures import ThreadPoolExecutor

    from .regions import PRESETS

    # Requests are latency-bound (row-group pruning keeps bytes tiny), so run many (region, year) jobs at
    # once on one DuckDB instance whose cursors share the parquet footer cache.
    ids = sys.argv[1:] or list(PRESETS)
    t0 = time.time()
    sensor_days()
    print(f"sensor_days ready {time.time() - t0:.0f}s", flush=True)
    db = connect()
    db.execute("SET enable_http_metadata_cache = true")
    jobs = [(rid, y) for y in range(FIRST_YEAR, current_year() + 1) for rid in ids
            if not _fresh(CACHE / rid / f"{y}.parquet", y)]
    for rid in ids:
        (CACHE / rid).mkdir(parents=True, exist_ok=True)

    def one(job):
        rid, y = job
        fetch_year(db.cursor(), PRESETS[rid]["bbox"], y, CACHE / rid / f"{y}.parquet")
        print(f"{rid} {y} {time.time() - t0:.0f}s", flush=True)

    with ThreadPoolExecutor(12) as ex:
        list(ex.map(one, jobs))
    print("done", time.time() - t0)
