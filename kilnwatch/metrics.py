"""Season metrics, normals, flags, activity index; per-unit harmonized series (architecture §5.7)."""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from . import config as C

log = logging.getLogger("kilnwatch.metrics")
DAY0 = pd.Timestamp("2003-01-01")
SNPP_START = pd.Timestamp("2012-07-01")   # record assembly: S-NPP converted to MYD-eq from season 2012-13
SNPP_END = pd.Timestamp("2026-11-02")     # S-NPP delivery ends 2 Nov 2026 1300 UTC
HARVEST = {"aman": (305, 365), "boro": (91, 151)}  # day-of-year windows (Nov–Dec; Apr–May), see data/static/crop_calendar.csv


def day_index(d) -> np.ndarray:
    return ((pd.to_datetime(d) - DAY0) / pd.Timedelta(days=1)).astype(int).to_numpy() if hasattr(d, "__len__") else int((pd.Timestamp(d) - DAY0).days)


def season_day(dates: pd.Series) -> np.ndarray:
    """Days since 1 July of the date's season year (0..365)."""
    dt = pd.to_datetime(dates)
    y = dt.dt.year - (dt.dt.month < 7).astype(int)
    return (dt - pd.to_datetime(y.astype(str) + "-07-01")).dt.days.to_numpy()


def _ci(t):
    return {"p50": round(float(t[0]), 2), "lo": round(float(t[1]), 2), "hi": round(float(t[2]), 2)}


def season_metrics(series: pd.Series, rng=None) -> list[dict]:
    """series: daily harmonized activity indexed by date (NaN = not observed).
    midpoint = activity-weighted centroid (days since 1 Jul); duration = d90 - d10 of cumulative activity;
    peak = max of the 15-day smoothed series. CIs from a week-block bootstrap. first/last carry a bias note."""
    rng = rng if rng is not None else C.rng("metrics")
    out = []
    s = series.dropna()
    seasons = pd.Series(s.index).pipe(lambda x: (x.dt.year - (x.dt.month < 7)).astype(str))
    for y, idx in s.groupby(seasons.to_numpy()).groups.items():
        v = s.loc[idx]
        if v.sum() <= 0 or len(v) < 60:
            continue
        sd = season_day(pd.Series(v.index))
        x = v.to_numpy()

        def mid(a, sd=sd):
            return np.sum(sd[: len(a)] * a) / a.sum() if a.sum() > 0 else np.nan

        def dur(a, sd=sd):
            if a.sum() <= 0:
                return np.nan
            c = np.cumsum(a) / a.sum()
            return sd[min(np.searchsorted(c, 0.9), len(sd) - 1)] - sd[min(np.searchsorted(c, 0.1), len(sd) - 1)]

        def peak(a):
            return pd.Series(a).rolling(15, center=True, min_periods=5).mean().max()

        lab = f"{y}-{(int(y) + 1) % 100:02d}"
        pos = v[v > 0]
        out.append({"season": lab, "midpoint": _ci(_boot(x, mid, rng)), "duration": _ci(_boot(x, dur, rng)),
                    "peak": _ci(_boot(x, peak, rng)), "first": pos.index.min().strftime("%Y-%m-%d"),
                    "last": pos.index.max().strftime("%Y-%m-%d")})
    return out


def _boot(x, f, rng, n=200, block=7):
    """Week-block bootstrap as block multiplicity weights, so day-of-season positions stay meaningful."""
    nb = int(np.ceil(len(x) / block))
    pt = f(x)
    blk = np.arange(len(x)) // block
    d = np.array([f(x * np.bincount(rng.integers(0, nb, size=nb), minlength=nb)[blk]) for _ in range(n)], float)
    return pt, np.nanquantile(d, 0.025), np.nanquantile(d, 0.975)


def normals(series: pd.Series, ref=("2003-04", "2024-25")) -> pd.DataFrame:
    """Per day-of-season (0..365), ±7-day window over reference seasons: p10/p50/p90."""
    s = series.dropna()
    sd = season_day(pd.Series(s.index))
    yr = (s.index.year - (s.index.month < 7)).to_numpy()
    keep = (yr >= int(ref[0][:4])) & (yr <= int(ref[1][:4]))
    sd, val = sd[keep], s.to_numpy()[keep]
    rows = []
    for d in range(366):
        dist = np.minimum(np.abs(sd - d), 366 - np.abs(sd - d))
        w = val[dist <= 7]
        rows.append(np.quantile(w, [0.1, 0.5, 0.9]) if len(w) else [np.nan] * 3)
    return pd.DataFrame(rows, columns=["p10", "p50", "p90"])


def flags(series: pd.Series, normal: pd.DataFrame) -> tuple[list[int], list[tuple[int, int]]]:
    """unusual: day indices (since 2003-01-01) above p90; critical: day-of-season windows where p50 is in the top quartile."""
    s = series.dropna()
    sd = season_day(pd.Series(s.index))
    p90 = normal.p90.to_numpy()[sd]
    unusual = day_index(pd.Series(s.index))[(s.to_numpy() > p90) & (s.to_numpy() > 0)]
    p50 = normal.p50.to_numpy()
    thr = np.nanquantile(p50, 0.75)
    hot = np.nan_to_num(p50) >= thr if np.isfinite(thr) and thr > 0 else np.zeros(366, bool)
    crit, start = [], None
    for d, h in enumerate(np.r_[hot, False]):
        if h and start is None:
            start = d
        elif not h and start is not None:
            if d - start >= 7:
                crit.append((start, d - 1))
            start = None
    return [int(u) for u in unusual], crit


def activity_index(series: pd.Series, monsoon_null: float, branch: str) -> pd.Series:
    """HKFI (kiln-like minus monsoon null) or HBI under nokiln (total minus monsoon null), 7-day smoothed."""
    return (series - monsoon_null).clip(lower=0).rolling(7, min_periods=1).mean()


def clear_climatology(clear: pd.DataFrame) -> pd.DataFrame:
    c = clear.assign(doy=pd.to_datetime(clear.date_local).dt.dayofyear)
    return c.groupby(["unit_id", "sensor", "doy"], as_index=False).clear_frac.median()


def harvest_key(dates: pd.Series) -> np.ndarray:
    doy = pd.to_datetime(dates).dt.dayofyear.to_numpy()
    out = np.full(len(doy), "other", dtype=object)
    for k, (a, b) in HARVEST.items():
        out[(doy >= a) & (doy <= b)] = k
    return out


# --- per-unit series ----------------------------------------------------------------
def conversion_weights(cd: pd.DataFrame, betas: pd.DataFrame) -> pd.Series:
    """MYD-eq weight per fire cell-pass-day: 1 for Aqua (anchor), β1 for S-NPP, β1·β2 for NOAA-20 after S-NPP ends."""
    b1 = betas[betas.step == "A<-N"].set_index(["division", "month", "pass", "loc"]).beta
    b2 = betas[betas.step == "N<-J1"].set_index(["division", "month", "pass", "loc"]).beta
    key = pd.MultiIndex.from_frame(cd[["division", "month", "pass", "loc"]])
    w = pd.Series(np.nan, index=cd.index)
    a = (cd.sensor == "A") & (cd.date_local < SNPP_START)
    n = (cd.sensor == "N") & (cd.date_local >= SNPP_START)
    j = (cd.sensor == "J1") & (cd.date_local >= SNPP_END)
    w[a] = 1.0
    w[n] = b1.reindex(key[n.to_numpy()]).to_numpy()
    if j.any():
        w[j] = (b1.reindex(key[j.to_numpy()]).to_numpy() * b2.reindex(key[j.to_numpy()]).to_numpy())
    return w


def era_sensor(dates: pd.Series) -> np.ndarray:
    d = pd.to_datetime(dates)
    return np.where(d < SNPP_START, "A", np.where(d < SNPP_END, "N", "J1"))
