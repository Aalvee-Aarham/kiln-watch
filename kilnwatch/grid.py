"""0.01° addressing grid, cell-days and unit rates (architecture §5.2)."""
from __future__ import annotations

from datetime import date as _date

import numpy as np
import pandas as pd

from . import config as C


def cell_id(lat, lon) -> np.ndarray:
    lat = np.asarray(lat, dtype="float64")
    lon = np.asarray(lon, dtype="float64")
    row = np.floor((lat - C.GRID_ORIGIN_LAT) / C.GRID_STEP + 1e-9).astype("int64")
    col = np.floor((lon - C.GRID_ORIGIN_LON) / C.GRID_STEP + 1e-9).astype("int64")
    bad = (row < 0) | (row >= C.GRID_ROWS) | (col < 0) | (col >= C.GRID_COLS)
    if np.any(bad):
        raise ValueError(f"{int(np.sum(bad))} coordinate(s) outside the grid")
    return row * C.GRID_COLS + col


def cell_center(cid) -> tuple[np.ndarray, np.ndarray]:
    cid = np.asarray(cid, dtype="int64")
    row, col = np.divmod(cid, C.GRID_COLS)
    return C.GRID_ORIGIN_LAT + (row + 0.5) * C.GRID_STEP, C.GRID_ORIGIN_LON + (col + 0.5) * C.GRID_STEP


def pixel_radius_m(scan_km, track_km) -> np.ndarray:
    return 500.0 * np.sqrt(np.asarray(scan_km) ** 2 + np.asarray(track_km) ** 2)


def season_of(d) -> str:
    if isinstance(d, str):
        d = _date.fromisoformat(d[:10])
    y = d.year if (d.month, d.day) >= C.SEASON_YEAR_START else d.year - 1
    return f"{y}-{(y + 1) % 100:02d}"


def season_series(dates: pd.Series) -> pd.Series:
    dt = pd.to_datetime(dates)
    y = dt.dt.year - (dt.dt.month < C.SEASON_YEAR_START[0]).astype(int)
    return y.astype(str) + "-" + ((y + 1) % 100).astype(str).str.zfill(2)


def to_celldays(det: pd.DataFrame) -> pd.DataFrame:
    g = det.groupby(["cell_id", "date_local", "sensor", "pass"], observed=True).size()
    return g.rename("n_det").reset_index()


def unit_cells(units) -> pd.DataFrame:
    """Grid cells whose centres fall inside each unit polygon (same cell set as the numerator)."""
    import geopandas as gpd

    out = []
    for level, grp in units.groupby("level"):
        w, s, e, n = grp.total_bounds
        r0 = int(np.floor((s - C.GRID_ORIGIN_LAT) / C.GRID_STEP))
        r1 = int(np.ceil((n - C.GRID_ORIGIN_LAT) / C.GRID_STEP))
        c0 = int(np.floor((w - C.GRID_ORIGIN_LON) / C.GRID_STEP))
        c1 = int(np.ceil((e - C.GRID_ORIGIN_LON) / C.GRID_STEP))
        rr, cc = np.meshgrid(np.arange(r0, r1), np.arange(c0, c1), indexing="ij")
        cid = (rr * C.GRID_COLS + cc).ravel()
        lat, lon = cell_center(cid)
        pts = gpd.GeoDataFrame({"cell_id": cid}, geometry=gpd.points_from_xy(lon, lat), crs=4326)
        j = gpd.sjoin(pts, grp[["unit_id", "geometry"]], predicate="within", how="inner")
        out.append(j[["unit_id", "cell_id"]].assign(level=level))
    return pd.concat(out, ignore_index=True).drop_duplicates(["unit_id", "cell_id"])


def unit_rates(celldays, unit_cells, clear_frac, total_cells_local, min_clear=0.2) -> pd.DataFrame:
    """Rate per 1000 clear cells. clear_cells = clear_frac * total_cells_local; NaN when clear_frac < min_clear.

    celldays: cell_id,date_local,sensor,pass,n_det. clear_frac: unit_id,date_local,sensor,clear_frac.
    total_cells_local: Series indexed by unit_id.
    """
    f = celldays.merge(unit_cells[["unit_id", "cell_id"]], on="cell_id")
    num = f.groupby(["unit_id", "date_local", "sensor", "pass"], observed=True).size().rename("fire_cells").reset_index()
    cl = clear_frac.copy()
    cl["clear_cells"] = cl["clear_frac"] * cl["unit_id"].map(total_cells_local)
    passes = pd.DataFrame({"pass": ["D", "N"]})
    cl = cl.merge(passes, how="cross")
    r = cl.merge(num, on=["unit_id", "date_local", "sensor", "pass"], how="left").fillna({"fire_cells": 0})
    r["rate"] = np.where(r["clear_frac"] >= min_clear, 1000.0 * r["fire_cells"] / r["clear_cells"].clip(lower=1), np.nan)
    return r
