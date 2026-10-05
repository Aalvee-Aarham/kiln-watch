"""Harmonization engine (architecture §5.5): MYD-eq common unit, pooling ladder, M0/M1, LOSO, bootstrap, seam."""
from __future__ import annotations

import json
import logging

import numpy as np
import pandas as pd
from sklearn.linear_model import PoissonRegressor

from . import config as C
from .stats import chow_test

log = logging.getLogger("kilnwatch.harmonize")
STRATUM = ["division", "month", "pass", "loc"]
BUCKET = {11: "EARLY", 12: "EARLY", 1: "MID", 2: "MID", 3: "MID", 4: "LATE", 5: "LATE"} | {m: "MONSOON" for m in C.MONSOON_MONTHS}
CHAIN = {"A<-N": ("A", "N"), "N<-J1": ("N", "J1"), "J1<-J2": ("J1", "J2")}


def pool_key(stratum, rung: int):
    """Key of the pooled group at a rung. rung 5 pools day and night -> None for night strata."""
    division, month, pss, loc = stratum
    b = BUCKET[int(month)]
    if rung == 0:
        return (division, month, pss, loc)
    if rung == 1:
        return (division, b, pss, loc)
    if rung == 2:
        return (division, b, pss)
    if rung == 3:
        return ("national", b, pss)
    if rung == 4:
        return ("national", "all", pss)
    if rung == 5:
        return None if pss == "N" else ("national", "all", "all")
    raise ValueError(rung)


def _keys(df: pd.DataFrame, rung: int) -> pd.Series:
    b = df["month"].map(BUCKET)
    nat = pd.Series("national", index=df.index)
    allv = pd.Series("all", index=df.index)
    parts = {0: [df.division, df.month.astype(str), df["pass"], df["loc"]], 1: [df.division, b, df["pass"], df["loc"]],
             2: [df.division, b, df["pass"]], 3: [nat, b, df["pass"]], 4: [nat, allv, df["pass"]], 5: [nat, allv, allv]}[rung]
    out = parts[0].astype(str)
    for p in parts[1:]:
        out = out + "|" + p.astype(str)
    return out


def pair_days(rates: pd.DataFrame, a: str, b: str, seasons=None) -> pd.DataFrame:
    """Same-day pairs where both sensors are observed. rates: division,loc,date_local,sensor,pass,fire_cells,clear_cells,rate."""
    k = ["division", "loc", "date_local", "pass"]
    ra = rates[rates.sensor == a].dropna(subset=["rate"])
    rb = rates[rates.sensor == b].dropna(subset=["rate"])
    p = ra[k + ["rate", "fire_cells", "clear_cells"]].merge(rb[k + ["rate", "fire_cells", "clear_cells"]], on=k, suffixes=("_ref", "_new"))
    p = p.rename(columns={"rate_ref": "a_ref", "rate_new": "a_new", "fire_cells_new": "celldays_new"})
    p["month"] = pd.to_datetime(p.date_local).dt.month
    from .grid import season_series

    p["season"] = season_series(p.date_local)
    if seasons is not None:
        p = p[p.season.isin(seasons)]
    assert not p.duplicated(k).any(), "pair_days: join keys not unique"
    return p.reset_index(drop=True)


def fit_ratio(pairs: pd.DataFrame, strata: pd.DataFrame | None = None) -> pd.DataFrame:
    """M0 β = Σa_ref/Σa_new per stratum, escalating the ladder until ≥MIN_SNPP_CELLDAYS cell-days and ≥MIN_PAIRED_DAYS days."""
    if strata is None:
        strata = pairs[STRATUM].drop_duplicates()
    strata = strata.reset_index(drop=True).copy()
    day_id = pairs["date_local"].astype(str) + pairs.get("copy", pd.Series(0, index=pairs.index)).astype(str)
    strata["beta"], strata["rung_used"], strata["n_celldays"], strata["n_days"] = np.nan, -1, 0, 0
    todo = np.ones(len(strata), bool)
    for rung in range(6):
        if not todo.any():
            break
        g = pd.DataFrame({"k": _keys(pairs, rung), "ref": pairs.a_ref, "new": pairs.a_new, "cd": pairs.celldays_new, "day": day_id})
        agg = g.groupby("k").agg(ref=("ref", "sum"), new=("new", "sum"), cd=("cd", "sum"), nd=("day", "nunique"))
        sk = _keys(strata, rung)
        m = agg.reindex(sk)
        ok = todo & (m.cd.to_numpy() >= C.MIN_SNPP_CELLDAYS) & (m.nd.to_numpy() >= C.MIN_PAIRED_DAYS) & (m.new.to_numpy() > 0)
        if rung == 5:
            ok &= (strata["pass"] != "N").to_numpy()  # forbidden for night outputs -> nodata
        strata.loc[ok, "beta"] = (m.ref / m.new).to_numpy()[ok]
        strata.loc[ok, "rung_used"] = rung
        strata.loc[ok, "n_celldays"] = m.cd.to_numpy()[ok].astype(int)
        strata.loc[ok, "n_days"] = m.nd.to_numpy()[ok].astype(int)
        todo &= ~ok
    return strata


def bootstrap_betas(pairs: pd.DataFrame, n=1000, rng=None, strata=None) -> pd.DataFrame:
    """Season-block bootstrap: resample whole seasons with replacement."""
    rng = rng if rng is not None else C.rng("harmonize")
    seasons = np.array(sorted(pairs.season.unique()))
    by = {s: g for s, g in pairs.groupby("season")}
    strata = strata if strata is not None else pairs[STRATUM].drop_duplicates()
    out = []
    for d in range(n):
        pick = rng.choice(seasons, size=len(seasons), replace=True)
        boot = pd.concat([by[s].assign(copy=i) for i, s in enumerate(pick)], ignore_index=True)
        b = fit_ratio(boot, strata)[STRATUM + ["beta"]]
        out.append(b.assign(draw=d))
    return pd.concat(out, ignore_index=True)


def _design(p: pd.DataFrame, cols=None) -> pd.DataFrame:
    X = pd.DataFrame({"log_new": np.log1p(p.a_new), "night": (p["pass"] == "N").astype(float), "kiln": (p["loc"] == "kiln").astype(float)})
    X = pd.concat([X, pd.get_dummies(p.month.astype(str), prefix="m", dtype=float), pd.get_dummies(p.division, prefix="d", dtype=float)], axis=1)
    if "scan_new" in p:
        X["scan"] = p.scan_new.fillna(p.scan_new.mean())
    return X.reindex(columns=cols, fill_value=0.0) if cols is not None else X


def fit_glm(pairs: pd.DataFrame) -> PoissonRegressor:
    """M1: rate target with sample_weight = clear cells (≡ log-exposure offset); alpha=0 (no shrinkage)."""
    X = _design(pairs)
    m = PoissonRegressor(alpha=0.0, max_iter=1000, tol=1e-8)
    m.fit(X.to_numpy(), pairs.a_ref.to_numpy(), sample_weight=pairs.clear_cells_ref.to_numpy())
    m.feature_names_ = list(X.columns)
    return m


def _predict(model, betas: pd.DataFrame | None, p: pd.DataFrame) -> np.ndarray:
    if model == "M0":
        b = p[STRATUM].merge(betas[STRATUM + ["beta"]], on=STRATUM, how="left")["beta"].to_numpy()
        return b * p.a_new.to_numpy()
    return model.predict(_design(p, model.feature_names_).to_numpy())


def _obs_groups(p: pd.DataFrame) -> pd.Series:
    """LOSO observation unit (fixed before analysis): division × ISO week × pass × loc."""
    wk = pd.to_datetime(p.date_local).dt.to_period("W").astype(str)
    return p.division + "|" + wk + "|" + p["pass"] + "|" + p["loc"]


def loso(pairs: pd.DataFrame, model: str = "M0", n_draws=200, rng=None) -> pd.DataFrame:
    """Leave-one-SEASON-out; 95% interval from β draws (season bootstrap of training folds) × Poisson count noise.
    Returns one row per held-out observation: season, obs_count, pred_rate, obs_rate, lo, hi, covered."""
    rng = rng if rng is not None else C.rng("harmonize")
    rows = []
    for s in sorted(pairs.season.unique()):
        tr, te = pairs[pairs.season != s], pairs[pairs.season == s].copy()
        if model == "M0":
            draws = bootstrap_betas(tr, n=n_draws, rng=rng, strata=te[STRATUM].drop_duplicates())
            point = _predict("M0", fit_ratio(tr, te[STRATUM].drop_duplicates()), te)
            bmat = draws.pivot_table(index=STRATUM, columns="draw", values="beta")
            B = te[STRATUM].merge(bmat, left_on=STRATUM, right_index=True, how="left")[list(range(n_draws))].to_numpy()
            mu_draws = B * te.a_new.to_numpy()[:, None]
        else:
            m = fit_glm(tr)
            point = _predict(m, None, te)
            seasons = np.array(sorted(tr.season.unique()))
            mu_draws = np.empty((len(te), n_draws))
            for d in range(n_draws):
                pick = rng.choice(seasons, size=len(seasons), replace=True)
                bm = fit_glm(pd.concat([tr[tr.season == x] for x in pick], ignore_index=True))
                mu_draws[:, d] = _predict(bm, None, te)
        te["pred_rate"] = point
        te["mu_count"] = point * te.clear_cells_ref / 1000
        cnt_draws = mu_draws * te.clear_cells_ref.to_numpy()[:, None] / 1000
        te["g"] = _obs_groups(te)
        ok = np.isfinite(te.pred_rate.to_numpy())
        te, cnt_draws = te[ok], cnt_draws[ok]
        gi, gkeys = pd.factorize(te.g)
        G = np.zeros((len(gkeys), cnt_draws.shape[1]))
        np.add.at(G, gi, np.nan_to_num(cnt_draws))
        sim = rng.poisson(np.clip(G, 0, None))
        agg = te.groupby(gi).agg(obs=("fire_cells_ref", "sum"), pred=("mu_count", "sum"), clear=("clear_cells_ref", "sum"))
        lo, hi = np.quantile(sim, 0.025, axis=1), np.quantile(sim, 0.975, axis=1)
        rows.append(pd.DataFrame({"season": s, "model": model, "obs_count": agg.obs.to_numpy(), "pred_count": agg.pred.to_numpy(),
                                  "obs_rate": 1000 * agg.obs.to_numpy() / agg.clear.to_numpy(),
                                  "pred_rate": 1000 * agg.pred.to_numpy() / agg.clear.to_numpy(),
                                  "lo": lo, "hi": hi, "covered": (agg.obs.to_numpy() >= lo) & (agg.obs.to_numpy() <= hi)}))
    return pd.concat(rows, ignore_index=True)


def loso_summary(res: pd.DataFrame):
    from .stats import wilson

    by = res.groupby("season").apply(lambda g: pd.Series({
        "mae": float(np.mean(np.abs(g.obs_rate - g.pred_rate))), "bias": float(np.mean(g.pred_rate - g.obs_rate)),
        "covered": float(g.covered.mean())}), include_groups=False).reset_index()
    k, n = int(res.covered.sum()), len(res)
    lo, hi = wilson(k, n)
    pooled = {"n": n, "covered": {"p50": k / n, "lo": lo, "hi": hi}, "mae": float(np.mean(np.abs(res.obs_rate - res.pred_rate)))}
    return by, pooled


def seam_stat(raw: pd.Series, harm: pd.Series, break_season="2011-12") -> dict:
    """raw/harm: national yearly series indexed by season. Transition season excluded."""
    y0 = int(break_season[:4])
    lab = lambda y: f"{y}-{(y + 1) % 100:02d}"  # noqa: E731
    before, after = [lab(y0 - 2), lab(y0 - 1)], [lab(y0 + 1), lab(y0 + 2)]
    d_raw = abs(raw[after].mean() - raw[before].mean())
    d_harm = abs(harm[after].mean() - harm[before].mean())
    r = raw.drop(break_season, errors="ignore").sort_index()
    h = harm.drop(break_season, errors="ignore").sort_index()
    bi = int(np.searchsorted(r.index.to_numpy(), lab(y0 + 1)))
    return {"d_raw": float(d_raw), "d_harm": float(d_harm), "ratio": float(d_harm / d_raw) if d_raw else np.nan,
            "chow_p_raw": chow_test(r.to_numpy(), bi), "chow_p_harm": chow_test(h.to_numpy(), bi)}


def to_myd_eq(rates: pd.DataFrame, draws: pd.DataFrame) -> pd.DataFrame:
    """Rows of S-NPP rates with STRATUM columns → p2.5/p50/p97.5 of MYD-eq rate from β draws."""
    bmat = draws.pivot_table(index=STRATUM, columns="draw", values="beta")
    B = rates[STRATUM].merge(bmat, left_on=STRATUM, right_index=True, how="left")[list(bmat.columns)].to_numpy()
    v = B * rates.rate.to_numpy()[:, None]
    q = np.nanquantile(v, [0.025, 0.5, 0.975], axis=1) if v.size else np.empty((3, 0))
    return rates.assign(p2_5=q[0], p50=q[1], p97_5=q[2])


def sp_nrt_ratio(j1_sp: pd.Series, j1_nrt: pd.Series):
    """Ratio of NOAA-20 SP to NRT daily fire cell-days over their common days, with bootstrap CI."""
    from .stats import bootstrap_ci

    both = pd.concat([j1_sp, j1_nrt], axis=1, join="inner").dropna()
    if len(both) < 10:
        return None
    rng = C.rng("harmonize")
    idx = rng.integers(0, len(both), size=(1000, len(both)))
    a, b = both.iloc[:, 0].to_numpy(), both.iloc[:, 1].to_numpy()
    r = a[idx].sum(1) / np.maximum(b[idx].sum(1), 1)
    return float(a.sum() / max(b.sum(), 1)), float(np.quantile(r, 0.025)), float(np.quantile(r, 0.975))


# --- stage -----------------------------------------------------------------------
def build_rates(celldays, unit_cells_div, kiln_cells, clear_div) -> pd.DataFrame:
    """Division × loc × day × sensor × pass rates. Both loc classes share the division clear fraction.

    ponytail: footprint-level clear fractions are only used by the gates; the calibration uses the division
    fraction for both loc classes (cloud is spatially smooth at division scale). Upgrade: GEE footprint pass per day.
    """
    uc = unit_cells_div.copy()
    uc["loc"] = np.where(uc.cell_id.isin(kiln_cells), "kiln", "other")
    tot = uc.groupby(["unit_id", "loc"]).size().rename("cells").reset_index()
    f = celldays.merge(uc[["cell_id", "unit_id", "loc"]], on="cell_id")
    num = f.groupby(["unit_id", "loc", "date_local", "sensor", "pass"], observed=True).size().rename("fire_cells").reset_index()
    cl = clear_div.merge(tot, on="unit_id").merge(pd.DataFrame({"pass": ["D", "N"]}), how="cross")
    cl["clear_cells"] = cl.clear_frac * cl.cells
    r = cl.merge(num, on=["unit_id", "loc", "date_local", "sensor", "pass"], how="left").fillna({"fire_cells": 0})
    r["rate"] = np.where(r.clear_frac >= 0.2, 1000 * r.fire_cells / r.clear_cells.clip(lower=1), np.nan)
    return r.rename(columns={"unit_id": "division"})


def run() -> dict:
    from .ingest import _parquet

    rates = pd.read_parquet(C.INTERIM / "rates_div.parquet")
    rng = C.rng("harmonize")
    res = {}
    chain_betas, chain_draws = [], []
    for step, (a, b) in CHAIN.items():
        seasons = C.CALIB_SEASONS if step == "A<-N" else None
        p = pair_days(rates, a, b, seasons)
        if step == "J1<-J2":
            p = p[p.date_local >= pd.Timestamp("2026-07-01")]  # NRT-to-NRT overlap
        if len(p) == 0:
            log.warning("%s: no paired days", step)
            continue
        beta = fit_ratio(p)
        n_draws = 1000 if step == "A<-N" else 200
        draws = bootstrap_betas(p, n=n_draws, rng=rng, strata=beta[STRATUM])
        chain_betas.append(beta.assign(step=step))
        chain_draws.append(draws.assign(chain_step=step))
        res[step] = p
        log.info("%s: %d pairs, rungs %s", step, len(p), beta.rung_used.value_counts().to_dict())
    betas = pd.concat(chain_betas, ignore_index=True)
    draws = pd.concat(chain_draws, ignore_index=True)

    # A6d — LOSO for M0 and M1, model selection (pre-registered: M1 only on >10% pooled MAE gain)
    p1 = res["A<-N"]
    l0 = loso(p1, "M0", rng=rng)
    l1 = loso(p1, "M1", n_draws=30, rng=rng)
    by0, pool0 = loso_summary(l0)
    by1, pool1 = loso_summary(l1)
    selected = "M1" if pool1["mae"] < 0.9 * pool0["mae"] else "M0"
    pooled = pool1 if selected == "M1" else pool0
    cov = pooled["covered"]["p50"]
    lo_t, hi_t = C.LOSO_COVERAGE_TARGET
    cov_pass = lo_t <= cov <= hi_t

    # determinism check material (A6f) and frozen draws
    C.MODELS.mkdir(parents=True, exist_ok=True)
    draws_out = draws[["chain_step"] + STRATUM + ["draw", "beta"]].sort_values(["chain_step"] + STRATUM + ["draw"]).reset_index(drop=True)
    _parquet(draws_out, C.MODELS / "harm_draws.parquet")
    _parquet(betas, C.INTERIM / "betas.parquet")
    summary = {"selected_model": selected, "loso_by_season": pd.concat([by0.assign(model="M0"), by1.assign(model="M1")]).to_dict("records"),
               "loso_pooled": {"model": selected, "n": pooled["n"], "covered": pooled["covered"]},
               "loso_pooled_m0": pool0, "loso_pooled_m1": pool1, "coverage_pass": bool(cov_pass)}
    (C.INTERIM / "harm_summary.json").write_text(json.dumps(summary, default=float, indent=1), encoding="utf-8")
    log.info("LOSO pooled coverage %.3f (%s), MAE M0 %.3f M1 %.3f -> %s", cov, cov_pass, pool0["mae"], pool1["mae"], selected)
    return summary
