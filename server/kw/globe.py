"""Aggregate the whole-Earth FIRMS record once, so any drawn area can be built without per-area downloads.

Per year this writes two small files to data/global/ (raw detections are streamed and never stored):
  agg-YYYY.parquet    one row per (day, sensor, satellite, day/night, quality, version, FIRMS type class,
                      confidence ok, 0.1-degree cell) with detection count and summed FRP
  cells-YYYY.parquet  per 0.01-degree cell tallies of typed / static-typed / untyped (NRT) detections, only for
                      cells that have any static-typed or untyped detection: input for the static-source mask
                      (n_typed, n_static) and the static-source statistics (s_* = type 1-3, u_* = untyped, ok only)

Run: python -m kw.globe [year ...]   (resumable: finished past years are skipped)
"""
import os
import sys
import time

from .firms import BASE, DATA, connect, current_year, _fresh

OUT = DATA / "global"
CONF = "((sensor = 'MODIS' AND confidence_pct >= 30) OR (sensor <> 'MODIS' AND confidence <> 'l'))"


def build_year(y: int):
    OUT.mkdir(parents=True, exist_ok=True)
    agg, cells = OUT / f"agg-{y}.parquet", OUT / f"cells-{y}.parquet"
    tmpdb = OUT / f"tmp-{y}.duckdb"
    tmpdb.unlink(missing_ok=True)
    con = connect()
    con.execute(f"ATTACH '{tmpdb.as_posix()}' AS w")
    t = time.time()
    # Read the remote year once (only these columns); both outputs come from the local copy.
    con.execute(f"""CREATE TABLE w.t AS
        SELECT acq_date, sensor, left(satellite, 1) AS sat, daynight, quality, version, type,
               {CONF} AS ok, frp, ST_Y(geometry) AS lat, ST_X(geometry) AS lon
        FROM read_parquet('{BASE}/year={y}/detections.parquet')""")
    a, c = agg.with_suffix(".tmp"), cells.with_suffix(".tmp")
    con.execute(f"""COPY (
        SELECT acq_date, sensor, sat, daynight, quality, version,
               CASE WHEN type IN (1, 2, 3) THEN 's' WHEN type = 0 THEN 'v' ELSE 'u' END AS tcls, ok,
               floor(lat * 10)::SMALLINT AS gy, floor(lon * 10)::SMALLINT AS gx, count(*)::INT AS n, sum(frp)::FLOAT AS frp
        FROM w.t GROUP BY ALL) TO '{a.as_posix()}' (FORMAT parquet, COMPRESSION zstd)""")
    con.execute(f"""COPY (
        SELECT floor(lat * 100)::INT AS fy, floor(lon * 100)::INT AS fx,
               count(*) FILTER (WHERE type IS NOT NULL)::INT AS n_typed, count(*) FILTER (WHERE type IN (1, 2, 3))::INT AS n_static,
               count(*) FILTER (WHERE type IS NULL)::INT AS n_untyped,
               count(*) FILTER (WHERE ok AND type IN (1, 2, 3))::INT AS s_n, coalesce(sum(frp) FILTER (WHERE ok AND type IN (1, 2, 3)), 0)::FLOAT AS s_frp,
               count(*) FILTER (WHERE ok AND type IN (1, 2, 3) AND sensor = 'MODIS')::INT AS s_modis,
               count(*) FILTER (WHERE ok AND type IS NULL)::INT AS u_n, coalesce(sum(frp) FILTER (WHERE ok AND type IS NULL), 0)::FLOAT AS u_frp,
               count(*) FILTER (WHERE ok AND type IS NULL AND sensor = 'MODIS')::INT AS u_modis
        FROM w.t GROUP BY 1, 2 HAVING count(*) FILTER (WHERE type IN (1, 2, 3)) > 0 OR count(*) FILTER (WHERE type IS NULL) > 0
        ) TO '{c.as_posix()}' (FORMAT parquet, COMPRESSION zstd)""")
    n = con.execute("SELECT count(*) FROM w.t").fetchone()[0]
    con.close()
    tmpdb.unlink(missing_ok=True)
    os.replace(a, agg)
    os.replace(c, cells)
    return n, time.time() - t


def ready() -> bool:
    """True when every year from 2000 to now has been aggregated (the current year may be a few hours old)."""
    return all((OUT / f"{k}-{y}.parquet").exists() for y in range(2000, current_year() + 1) for k in ("agg", "cells"))


def main(years):
    t0 = time.time()
    for y in years:
        if _fresh(OUT / f"agg-{y}.parquet", y) and _fresh(OUT / f"cells-{y}.parquet", y):
            print(f"{y} skip", flush=True)
            continue
        for attempt in range(12):
            try:
                n, s = build_year(y)
                mb = sum((OUT / f"{k}-{y}.parquet").stat().st_size for k in ("agg", "cells")) / 1e6
                print(f"{y} {n:,} detections -> {mb:.0f} MB in {s:.0f}s (elapsed {time.time() - t0:.0f}s)", flush=True)
                break
            except Exception as e:  # network drop: retry the year
                print(f"{y} attempt {attempt + 1} failed: {str(e)[:120]}", flush=True)
                if attempt == 11:
                    raise
                time.sleep(min(60, 10 * (attempt + 1)))  # wait out a dropped connection
    print("done", round(time.time() - t0), "s", flush=True)


if __name__ == "__main__":
    main([int(a) for a in sys.argv[1:]] or range(2000, current_year() + 1))
