"""Daily NRT updater (architecture §5.10). Runs in CI from committed data/models + the data-current release."""
from __future__ import annotations

import json
import logging
from datetime import date, timedelta

import joblib
import numpy as np
import pandas as pd

from . import config as C
from .grid import season_of

log = logging.getLogger("kilnwatch.nrt")
NRT_SOURCES = ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT", "VIIRS_SNPP_NRT"]
SNPP_END = date(2026, 11, 2)
SEASON_CSV = C.NRT_DIR / "season.csv"


def fetch(days: int) -> pd.DataFrame:
    """Last `days` days for each NRT source; an empty or 404 response is not an error."""
    import io

    from .ingest import FIRMS, normalise, session

    s = session()
    frames = []
    for src in NRT_SOURCES:
        if src == "VIIRS_SNPP_NRT" and date.today() > SNPP_END:
            continue
        for start in range(0, days, 5):
            d0 = date.today() - timedelta(days=start + min(5, days - start) - 1)
            w, so, e, n = C.BBOX_W, C.BBOX_S, C.BBOX_E, C.BBOX_N
            r = s.get(f"{FIRMS}/api/area/csv/{C.FIRMS_MAP_KEY}/{src}/{w},{so},{e},{n}/{min(5, days - start)}/{d0}", timeout=120)
            if r.status_code == 404 or not r.text.strip() or not r.text.startswith("latitude"):
                log.info("%s %s: empty (%s)", src, d0, r.status_code)
                continue
            raw = pd.read_csv(io.StringIO(r.text), dtype={"acq_date": str, "acq_time": str, "confidence": str, "satellite": str})
            if len(raw):
                frames.append(normalise(raw, src))
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def update_season_csv(days: int) -> pd.DataFrame:
    C.NRT_DIR.mkdir(parents=True, exist_ok=True)
    season = season_of(date.today())
    old = pd.DataFrame()
    if SEASON_CSV.exists():
        old = pd.read_csv(SEASON_CSV, parse_dates=["t_utc", "t_local", "date_local"])
        if len(old) and old.season.iloc[0] != season:  # archive on 1 July
            SEASON_CSV.rename(C.NRT_DIR / f"season_{old.season.iloc[0]}.csv")
            old = pd.DataFrame()
    if old.empty:
        log.warning("season.csv missing or archived: rebuilding the last 30 days from the API")
        days = max(days, 30)
    new = fetch(days)
    df = pd.concat([old, new], ignore_index=True)
    if df.empty:
        return df
    df["t_utc"] = pd.to_datetime(df.t_utc, utc=True)
    df = df.drop_duplicates(["sensor", "lat", "lon", "t_utc"]).sort_values("t_utc")
    df = df[pd.to_datetime(df.date_local) >= pd.Timestamp(f"{season[:4]}-07-01")]
    df["season"] = season
    tmp = SEASON_CSV.with_suffix(".tmp")
    df.to_csv(tmp, index=False)
    tmp.replace(SEASON_CSV)
    return df


def run(days=5) -> dict:
    from .classify import build_features
    from .export import _dump, split_labels

    df = update_season_csv(days)
    season = season_of(date.today())
    day0 = pd.Timestamp(f"{season[:4]}-07-01")
    n_days = (pd.Timestamp.today().normalize() - day0).days + 1
    branch = C.load_derived()["GATE_BRANCH"]["value"]
    keys = [s["key"] for s in split_labels(branch)]
    cells = pd.read_parquet(C.MODELS / "cells.parquet")  # cell_id, district, division, loc
    clim = pd.read_parquet(C.MODELS / "clear_clim.parquet")  # unit_id, doy, clear_frac
    thr = json.loads((C.MODELS / "thresholds.json").read_text(encoding="utf-8"))
    draws = pd.read_parquet(C.MODELS / "harm_draws.parquet")
    b1 = draws[draws.chain_step == "A<-N"].groupby(["division", "month", "pass", "loc"]).beta.median()
    b2 = draws[draws.chain_step == "N<-J1"].groupby(["division", "month", "pass", "loc"]).beta.median()
    nat = {"h": np.zeros(n_days), **{k: np.zeros(n_days) for k in keys}}
    dist_h: dict[str, np.ndarray] = {}
    imputed = 0.0
    if len(df):
        df = df[df.conf_class.isin(C.CONF_KEEP)].copy()
        from .grid import cell_id

        df["cell_id"] = cell_id(df.lat.to_numpy(), df.lon.to_numpy())
        df = df.merge(cells, on="cell_id")
        v = df[df.sensor.isin(["N", "J1", "J2"])]
        if len(v) and branch != "nokiln":
            X = build_features(v)
            model = joblib.load(C.MODELS / "kiln_clf.joblib")
            p = model.predict_proba(X)[:, 1] if thr.get("model") == "hgb" else ((X.p5 >= 3) & (X.is_night == 1)).astype(float).to_numpy()
            lab = np.where(p >= thr["t_hi"], "kiln", np.where(p <= thr["t_lo"], "vegetation", "unknown"))
            if not thr.get("nrt_ok", True):
                lab = np.where(v.sensor == "J2", "unknown", lab)  # NOAA-21 unlabelled without the J1->J2 holdout
            df.loc[v.index, "cat"] = lab
        if branch == "nokiln":
            from .metrics import harvest_key

            df["cat"] = harvest_key(df.date_local)
        df["cat"] = df["cat"].fillna("unknown") if "cat" in df else "unknown"
        # era sensor: S-NPP until it ends, then NOAA-20 chained through S-NPP
        era = "N" if date.today() <= SNPP_END else "J1"
        e = df[df.sensor == era].drop_duplicates(["cell_id", "date_local", "pass"])
        key = pd.MultiIndex.from_arrays([e.division, pd.to_datetime(e.date_local).dt.month, e["pass"], e["loc"]])
        w = b1.reindex(key).to_numpy() * (b2.reindex(key).to_numpy() if era == "J1" else 1.0)
        imputed = float(np.mean(~np.isfinite(w)))  # fraction of detections whose β weight fell back to the median
        e = e.assign(w=np.nan_to_num(w, nan=np.nanmedian(b1)), d=(pd.to_datetime(e.date_local) - day0).dt.days)
        doy = (day0 + pd.to_timedelta(np.arange(n_days), "D")).dayofyear
        tot = cells.groupby("district").size()
        for dist_id, g in e.groupby("district"):
            cf = clim[clim.unit_id == dist_id].set_index("doy").clear_frac.reindex(doy).fillna(0.5).to_numpy()
            den = np.maximum(cf * tot[dist_id], 1)
            dist_h[dist_id] = 1000 * np.bincount(g.d, weights=g.w, minlength=n_days)[:n_days] / den
        cf_nat = clim[clim.unit_id == "national"].set_index("doy").clear_frac.reindex(doy).fillna(0.5).to_numpy()
        den = np.maximum(cf_nat * len(cells), 1)
        nat["h"] = 1000 * np.bincount(e.d, weights=e.w, minlength=n_days)[:n_days] / den
        for k in keys:
            m = (e.cat == k).to_numpy()
            nat[k] = 1000 * np.bincount(e.d[m], weights=e.w[m], minlength=n_days)[:n_days] / den
    districts = {}
    cal_dir = C.WEB_DATA / "calendar"
    for dist_id in cells.district.unique():
        h = dist_h.get(dist_id, np.zeros(n_days))
        above = 0
        f = cal_dir / f"{dist_id}.json"
        if f.exists():
            p90 = np.asarray(json.loads(f.read_text(encoding="utf-8"))["normal"]["p90"])
            above = int(np.sum(h > p90[np.arange(n_days) % 366]))
        districts[dist_id] = {"h": np.round(h, 3).tolist(), "above_p90_days": above}
    out = {"updated_at": pd.Timestamp.now(tz="UTC").isoformat(timespec="seconds"), "provisional": True, "season": season, "day0": day0.strftime("%Y-%m-%d"),
           "beta_imputed_frac": round(imputed, 4),
           "national": {"h": np.round(nat["h"], 3).tolist(), "split": [{"key": k, "values": np.round(nat[k], 3).tolist()} for k in keys]},
           "districts": districts}
    _dump(out, C.WEB_DATA / "nrt" / "current_season.json")
    log.info("NRT: %d detections this season; written current_season.json", len(df))
    return out


def write_models_for_nrt() -> None:
    """Committed artifacts the CI NRT job needs: cell → district/division/loc and the clear-fraction climatology."""
    from .ingest import read_units
    from .metrics import clear_climatology
    from .pipeline import _kiln_cells

    uc = pd.read_parquet(C.INTERIM / "unit_cells.parquet")
    units = read_units()
    dist = uc[uc.level == "district"].drop_duplicates("cell_id")[["cell_id", "unit_id"]].rename(columns={"unit_id": "district"})
    div = uc[uc.level == "division"].drop_duplicates("cell_id").merge(units[["unit_id", "name_en"]], on="unit_id")[["cell_id", "name_en"]].rename(columns={"name_en": "division"})
    cells = dist.merge(div, on="cell_id")
    cells["loc"] = np.where(cells.cell_id.isin(_kiln_cells()), "kiln", "other")
    cells.to_parquet(C.MODELS / "cells.parquet", index=False)
    clear = pd.read_parquet(C.INTERIM / "clear.parquet")
    cn = clear[(clear.sensor == "N") & clear.unit_id.isin(dist.district.unique())]
    cc = clear_climatology(cn)[["unit_id", "doy", "clear_frac"]]
    tot = dist.groupby("district").size()
    cn = cn.assign(w=cn.unit_id.map(tot) * cn.clear_frac)
    nat = cn.groupby("date_local").w.sum() / tot.sum()
    natc = nat.groupby(nat.index.dayofyear).median().rename("clear_frac").reset_index().rename(columns={"date_local": "doy"}).assign(unit_id="national")
    pd.concat([cc, natc], ignore_index=True).astype({"clear_frac": "float32"}).to_parquet(C.MODELS / "clear_clim.parquet", index=False)
