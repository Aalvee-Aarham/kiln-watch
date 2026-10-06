"""Stage glue: grid (A2), harmonize (A6 + record assembly), metrics (A8: per-unit calendars, AOI, grid tiles)."""
from __future__ import annotations

import json
import logging

import numpy as np
import pandas as pd

from . import config as C
from .grid import cell_id, season_series, to_celldays, unit_cells
from .ingest import _parquet, read_units

log = logging.getLogger("kilnwatch.pipeline")
PUB = C.INTERIM / "public"
DAY0 = pd.Timestamp("2003-01-01")


def grid_stage() -> None:
    det = pd.read_parquet(C.INTERIM / "detections.parquet")
    det = det[det.conf_class.isin(C.CONF_KEEP)]
    cd = to_celldays(det)
    assert len(cd) <= len(det), "A2: more cell-days than detections"
    _parquet(cd, C.INTERIM / "celldays.parquet")
    units = read_units()
    uc = unit_cells(units)
    n_bd = uc[uc.level == "district"].cell_id.nunique()
    # A2 (amended, see BLOCKERS.md): the plan's 250k–350k bound is the BBOX rectangle (297,600 cells), not the
    # country. Bangladesh land cells must match its area: 147,570 km² / (1.113 km × 1.020 km at 23.7°N) ≈ 130k, ±10%.
    expected = 147_570 / ((C.GRID_STEP * 111.32 * np.cos(np.radians(23.7))) * (C.GRID_STEP * 110.57))
    assert abs(n_bd / expected - 1) <= 0.10, f"A2: Bangladesh unit cells {n_bd} vs area-derived {expected:.0f}"
    _parquet(uc, C.INTERIM / "unit_cells.parquet")
    from .gee import write_admin_clear

    if (C.RAW / "gee" / "clear" / "admin").exists():
        write_admin_clear()
    else:
        log.warning("GEE admin cache missing: clear.parquet not written (run `python -m kilnwatch gee`)")
    log.info("cell-days %d; unit cells %d (BD %d)", len(cd), len(uc), n_bd)


def _kiln_cells() -> set:
    inv = pd.read_parquet(C.INTERIM / "inventory.parquet")
    bd = inv[inv.country == "BD"]
    return set(cell_id(bd.lat.to_numpy(), bd.lon.to_numpy()).tolist())


def _celldays_enriched() -> pd.DataFrame:
    cd = pd.read_parquet(C.INTERIM / "celldays.parquet")
    uc = pd.read_parquet(C.INTERIM / "unit_cells.parquet")
    units = read_units()
    div_of = uc[uc.level == "division"].drop_duplicates("cell_id").merge(units[["unit_id", "name_en"]], on="unit_id").set_index("cell_id").name_en
    cd["division"] = cd.cell_id.map(div_of)
    cd = cd.dropna(subset=["division"])
    kc = _kiln_cells()
    cd["loc"] = np.where(cd.cell_id.isin(kc), "kiln", "other")
    cd["month"] = cd.date_local.dt.month
    for c in ("sensor", "pass"):
        cd[c] = cd[c].astype(str)
    return cd


def harmonize_stage() -> None:
    from . import harmonize as H

    cd = pd.read_parquet(C.INTERIM / "celldays.parquet")
    uc = pd.read_parquet(C.INTERIM / "unit_cells.parquet")
    units = read_units()
    clear = pd.read_parquet(C.INTERIM / "clear.parquet")
    divs = units[units.level == "division"][["unit_id", "name_en"]]
    ucd = uc[uc.level == "division"]
    cdiv = clear[clear.unit_id.isin(divs.unit_id)]
    # NOAA-20/21 use the S-NPP clear fraction (same orbital plane, ~50 min apart); measured limitation
    extra = [cdiv[cdiv.sensor == "N"].assign(sensor=s) for s in ("J1", "J2")]
    cdiv = pd.concat([cdiv] + extra, ignore_index=True)
    cd = cd.assign(sensor=cd.sensor.astype(str), **{"pass": cd["pass"].astype(str)})
    rates = H.build_rates(cd, ucd, _kiln_cells(), cdiv[["unit_id", "date_local", "sensor", "clear_frac"]])
    rates["division"] = rates.division.map(divs.set_index("unit_id").name_en)
    _parquet(rates, C.INTERIM / "rates_div.parquet")
    summary = H.run()
    betas = pd.read_parquet(C.INTERIM / "betas.parquet")
    draws = pd.read_parquet(C.MODELS / "harm_draws.parquet")
    yearly, seam = _assemble_national(rates, draws)
    s = summary
    ok_seam = seam["ratio"] <= C.SEAM_RATIO_MAX and seam["chow_p_raw"] < 0.01 and seam["chow_p_harm"] > 0.05
    h1 = H.pair_days(rates, "J1", "N")
    sp_nrt = None
    harm = {
        "selected_model": s["selected_model"], "yearly": yearly,
        "betas": [{"step": r.step, "division": r.division, "month": int(r.month), "pass": r["pass"], "loc": r["loc"],
                   "beta": _beta_ci(draws, r), "rung_used": int(r.rung_used), "n_celldays": int(r.n_celldays), "n_days": int(r.n_days)}
                  for _, r in betas.iterrows() if np.isfinite(r.beta)],
        "loso_by_season": [{"season": x["season"], "model": x["model"], "mae": x["mae"], "bias": x["bias"], "covered": x["covered"]} for x in s["loso_by_season"]],
        "loso_pooled": s["loso_pooled"], "seam": seam,
    }
    if sp_nrt:
        harm["sp_nrt_ratio"] = sp_nrt
    from .export import _dump, nan_to_none

    _dump(nan_to_none(harm), PUB / "harmonization.json")
    _harm_report(s, seam, ok_seam, betas, len(h1))
    # A6f determinism: hash of the frozen draws
    import hashlib

    sha = hashlib.sha256((C.MODELS / "harm_draws.parquet").read_bytes()).hexdigest()
    (C.INTERIM / "harm_draws.sha256").write_text(sha)
    lo, hi = C.LOSO_COVERAGE_TARGET
    cov = s["loso_pooled"]["covered"]["p50"]
    if not (lo <= cov <= hi):
        log.error("A6d FAILED: pooled LOSO coverage %.3f outside (%.2f, %.2f)", cov, lo, hi)
    if not ok_seam:
        log.error("A6e FAILED: seam criterion %s", seam)
    assert lo <= cov <= hi, f"A6d: pooled coverage {cov:.3f} outside {C.LOSO_COVERAGE_TARGET}"
    assert ok_seam, f"A6e: seam criterion not met: {seam}"


def _beta_ci(draws, r):
    d = draws[(draws.chain_step == r.step) & (draws.division == r.division) & (draws.month == r.month) & (draws["pass"] == r["pass"]) & (draws["loc"] == r["loc"])].beta
    d = d[np.isfinite(d)]
    if len(d) == 0:
        return {"p50": float(r.beta), "lo": float(r.beta), "hi": float(r.beta)}
    return {"p50": float(r.beta), "lo": float(d.quantile(0.025)), "hi": float(d.quantile(0.975))}


def _assemble_national(rates: pd.DataFrame, draws: pd.DataFrame):
    """National season totals: raw splice (Aqua ≤2011-12, raw S-NPP after) vs harmonized (β1-converted S-NPP)."""
    from .harmonize import STRATUM, seam_stat

    r = rates.copy()
    r["season"] = season_series(r.date_local)
    r["month"] = r.date_local.dt.month
    clear_day = r.groupby(["date_local", "sensor", "pass"]).agg(clear=("clear_cells", "sum"), cells=("cells", "sum"))
    ok = (clear_day.clear / clear_day.cells >= 0.2).rename("ok").reset_index()
    r = r.merge(ok, on=["date_local", "sensor", "pass"])
    r = r[r.ok]
    b1 = draws[draws.chain_step == "A<-N"].pivot_table(index=STRATUM, columns="draw", values="beta")
    n = r[r.sensor == "N"].merge(b1, left_on=STRATUM, right_index=True, how="left")
    dcols = list(b1.columns)
    B = n[dcols].to_numpy()
    med = np.nanmedian(B, axis=1)
    B = np.where(np.isnan(B), med[:, None], B)
    conv = B * n.fire_cells.to_numpy()[:, None]
    daily_clear = n.groupby("date_local").clear_cells.sum() / 2  # two passes share the same clear cells
    conv_df = pd.DataFrame(conv, index=n.index).groupby(n.date_local).sum()
    rate_draws = 1000 * conv_df.div(daily_clear.reindex(conv_df.index), axis=0)
    seas = season_series(pd.Series(rate_draws.index)).to_numpy()
    harm_n = rate_draws.groupby(seas).sum()

    def season_raw(sensor):
        x = r[r.sensor == sensor]
        dd = x.groupby("date_local").agg(f=("fire_cells", "sum"), c=("clear_cells", "sum"))
        dd["rate"] = 1000 * dd.f / (dd.c / 2)
        return dd.rate.groupby(season_series(pd.Series(dd.index)).to_numpy()).sum()

    raw_a, raw_n, raw_t = season_raw("A"), season_raw("N"), season_raw("T")
    seasons = [f"{y}-{(y + 1) % 100:02d}" for y in range(2003, 2026)]
    yearly, raw_s, harm_s = [], {}, {}
    for s in seasons:
        y = int(s[:4])
        if y < 2012:
            if s not in raw_a:
                continue
            h = {"p50": float(raw_a[s]), "lo": float(raw_a[s]), "hi": float(raw_a[s])}
            raw = float(raw_a[s])
        else:
            if s not in harm_n.index:
                continue
            q = harm_n.loc[s].quantile([0.5, 0.025, 0.975]).to_numpy()
            h = {"p50": float(q[0]), "lo": float(q[1]), "hi": float(q[2])}
            raw = float(raw_n.get(s, np.nan))
        raw_s[s], harm_s[s] = raw, h["p50"]
        yearly.append({"season": s, "raw_sum": raw, "raw_by_sensor": {k: float(v[s]) for k, v in (("T", raw_t), ("A", raw_a), ("N", raw_n)) if s in v},
                       "h": h, "aqua_obs": float(raw_a[s]) if s in raw_a else None})
    seam = seam_stat(pd.Series(raw_s), pd.Series(harm_s))
    return yearly, seam


def _harm_report(s, seam, ok_seam, betas, n_j1):
    L = ["# Harmonization report (A6)", "", f"Selected model: **{s['selected_model']}** (M1 ships only on >10% pooled MAE gain).",
         f"Pooled LOSO MAE — M0 {s['loso_pooled_m0']['mae']:.4f}, M1 {s['loso_pooled_m1']['mae']:.4f}",
         f"Pooled 95% coverage ({s['loso_pooled']['model']}): {s['loso_pooled']['covered']['p50']:.3f} [{s['loso_pooled']['covered']['lo']:.3f}, {s['loso_pooled']['covered']['hi']:.3f}] — target {C.LOSO_COVERAGE_TARGET}: **{'PASS' if s['coverage_pass'] else 'FAIL'}**",
         "", "## Seam", f"d_raw {seam['d_raw']:.2f}, d_harm {seam['d_harm']:.2f}, ratio {seam['ratio']:.3f}, Chow p raw {seam['chow_p_raw']:.2g}, harm {seam['chow_p_harm']:.3f} — **{'PASS' if ok_seam else 'FAIL'}**",
         "", "## Rung usage by chain step", betas.groupby(["step", "rung_used"]).size().unstack(fill_value=0).to_markdown(),
         "", f"NOAA-20 ↔ S-NPP paired stratum-days: {n_j1}. NOAA-20 SP/NRT ratio: not computable (FIRMS SP ends 2026-06-30, NRT starts 2026-07-01; no overlap) — stated limitation."]
    (C.REPORTS / "harmonization_report.md").write_text("\n".join(L) + "\n", encoding="utf-8")


# --- metrics: calendars -------------------------------------------------------------------
def metrics_stage(levels=("district", "upazila")) -> None:
    from . import metrics as M
    from .export import _dump, split_labels

    branch = C.load_derived()["GATE_BRANCH"]["value"]
    keys = [s["key"] for s in split_labels(branch)]
    betas = pd.read_parquet(C.INTERIM / "betas.parquet")
    draws = pd.read_parquet(C.MODELS / "harm_draws.parquet")
    bvar = draws[draws.chain_step == "A<-N"].groupby(["division", "month", "pass", "loc"]).beta.var().rename("bvar")
    cd = _celldays_enriched()
    cd = cd[cd.sensor.isin(["T", "A", "N", "J1"])]
    cd["w"] = M.conversion_weights(cd, betas).to_numpy()
    cd = cd.merge(bvar, left_on=["division", "month", "pass", "loc"], right_index=True, how="left")
    cd["era"] = M.era_sensor(cd.date_local) == cd.sensor
    cd["cat"] = _categories(cd, branch)
    uc = pd.read_parquet(C.INTERIM / "unit_cells.parquet")
    clear = pd.read_parquet(C.INTERIM / "clear.parquet")
    units = read_units()
    total = uc.groupby("unit_id").size()
    out_units = []
    rng = C.rng("metrics")
    for level in levels:
        lu = units[units.level == level]
        ucl = uc[uc.level == level][["unit_id", "cell_id"]]
        x = cd.merge(ucl, on="cell_id")
        for uid, g in x.groupby("unit_id"):
            cal, share = _calendar(uid, g, clear[clear.unit_id == uid], int(total.get(uid, 0)), level == "district", keys, branch, rng)
            if cal is None:
                continue
            _dump(cal, PUB / "calendar" / f"{uid}.json")
            out_units.append((uid, share))
        log.info("%s calendars: %d", level, len(lu))
    _write_aoi(units, dict(out_units), branch)
    from .nrt import write_models_for_nrt

    write_models_for_nrt()
    _write_grid_tiles(cd)
    _write_events()


def _categories(cd: pd.DataFrame, branch: str) -> np.ndarray:
    from .metrics import harvest_key

    if branch == "nokiln":
        return harvest_key(cd.date_local)
    labels = pd.read_parquet(C.INTERIM / "labels.parquet")
    det = pd.read_parquet(C.INTERIM / "detections.parquet", columns=["cell_id", "date_local", "sensor", "pass"])
    lab = labels.merge(det, left_on="det_idx", right_index=True)
    lab["sensor"], lab["pass"] = lab.sensor.astype(str), lab["pass"].astype(str)
    rank = lab.label.map({"kiln": 0, "vegetation": 1, "unknown": 2})
    lab = lab.assign(r=rank).groupby(["cell_id", "date_local", "sensor", "pass"]).r.min().rename("r").reset_index()
    m = cd[["cell_id", "date_local", "sensor", "pass"]].merge(lab, how="left", on=["cell_id", "date_local", "sensor", "pass"])
    if branch in ("from2012", "partial"):
        m.loc[(cd.date_local < pd.Timestamp("2012-07-01")).to_numpy(), "r"] = 2  # no pre-2012 kiln claim (non-claim 8)
    return np.array(["kiln", "vegetation", "unknown"], dtype=object)[m.r.fillna(2).astype(int).to_numpy()]


def _runs(mask: np.ndarray) -> list[list[int]]:
    d = np.diff(np.r_[0, mask.astype(int), 0])
    s, e = np.flatnonzero(d == 1), np.flatnonzero(d == -1) - 1
    return [[int(a), int(b)] for a, b in zip(s, e)]


def _calendar(uid, g, clear, cells, is_district, keys, branch, rng):
    from . import metrics as M

    if cells == 0:
        return None, None
    end = pd.Timestamp.today().normalize() - pd.Timedelta(days=1)
    idx = pd.date_range(DAY0, end)
    n = len(idx)
    cf = clear.pivot_table(index="date_local", columns="sensor", values="clear_frac").reindex(idx)
    era = M.era_sensor(pd.Series(idx))
    cf_era = np.select([era == "A", era == "N"], [cf.get("A", pd.Series(np.nan, idx)).to_numpy(), cf.get("N", pd.Series(np.nan, idx)).to_numpy()],
                       cf.get("N", pd.Series(np.nan, idx)).to_numpy())
    observed = np.nan_to_num(cf_era) >= 0.2
    di = ((g.date_local - DAY0).dt.days).to_numpy()
    raw = {}
    for s in ("T", "A", "N", "J1"):
        m = (g.sensor == s).to_numpy()
        if not m.any():
            continue
        cnt = np.bincount(di[m], minlength=n)[:n].astype(float)
        c = cf[s].to_numpy() if s in cf else (cf["N"].to_numpy() if "N" in cf else np.full(n, np.nan))
        raw[s] = np.where(np.nan_to_num(c) >= 0.2, 1000 * cnt / np.maximum(np.nan_to_num(c) * cells, 1), 0.0)
    e = g[g.era & g.w.notna()]
    de = ((e.date_local - DAY0).dt.days).to_numpy()
    denom = np.maximum(np.nan_to_num(cf_era) * cells, 1)
    conv = np.bincount(de, weights=e.w.to_numpy(), minlength=n)[:n]
    h = np.where(observed, 1000 * conv / denom, np.nan)
    parts = {k: np.where(observed, 1000 * np.bincount(de[(e.cat == k).to_numpy()], weights=e.w.to_numpy()[(e.cat == k).to_numpy()], minlength=n)[:n] / denom, 0) for k in keys}
    # weekly CI: Poisson count noise + β variance (delta method), on the weekly ratio estimator
    var_d = np.bincount(de, weights=(e.w ** 2 + e.bvar.fillna(0)).to_numpy(), minlength=n)[:n]
    wk = np.arange(n) // 7
    W = wk.max() + 1
    sc = np.bincount(wk, weights=np.where(observed, conv, 0), minlength=W)
    sv = np.bincount(wk, weights=np.where(observed, var_d, 0), minlength=W)
    sd = np.bincount(wk, weights=np.where(observed, denom, 0), minlength=W)
    nobs = np.bincount(wk, weights=observed.astype(float), minlength=W)
    with np.errstate(invalid="ignore", divide="ignore"):
        hw = 1000 * sc / sd
        half = 1000 * 1.96 * np.sqrt(sv) / sd
    h_lo = np.where(nobs > 0, np.clip(hw - half, 0, None), 0)
    h_hi = np.where(nobs > 0, hw + half, 0)
    hs = pd.Series(h, idx)
    normal = M.normals(hs)
    unusual, critical = M.flags(hs, normal)
    kiln_series = pd.Series(parts.get(keys[0], np.zeros(n)), idx) if branch != "nokiln" else hs.fillna(0)
    mon = kiln_series[kiln_series.index.month.isin(C.MONSOON_MONTHS)]
    null = mon.groupby(mon.index.year).mean()
    nulls = pd.Series(kiln_series.index.year, idx).map(null).fillna(0).to_numpy()
    index = M.activity_index(kiln_series - nulls + 0, 0.0, branch).to_numpy()
    seasons = M.season_metrics(hs, rng)
    nz = np.flatnonzero((np.nan_to_num(h) > 0) | np.any([v > 0 for v in raw.values()], axis=0))
    r3 = lambda a: np.round(np.nan_to_num(a[nz]), 3).tolist()  # noqa: E731
    cal = {"unit_id": uid, "day0": "2003-01-01", "days": nz.tolist(), "raw": {s: r3(v) for s, v in raw.items()}, "h": r3(h),
           "split": [{"key": k, "values": r3(parts[k])} for k in keys], "index": r3(index),
           "nodata": _runs(~observed), "week0": "2003-01-01",
           "h_lo": np.round(h_lo, 3).tolist(), "h_hi": np.round(np.nan_to_num(h_hi), 3).tolist(),
           "normal": {k: np.round(np.nan_to_num(normal[k].to_numpy()), 3).tolist() for k in ("p10", "p50", "p90")},
           "unusual": unusual, "critical": [list(c) for c in critical], "seasons": seasons}
    if is_district:
        cal["clear_frac"] = {s: np.round(np.nan_to_num(cf[s].to_numpy()) * 100).astype(int).tolist() for s in ("A", "N") if s in cf}
    post = idx >= pd.Timestamp("2012-07-01")
    tot = np.nansum(h[post])
    share = float(np.nansum(parts.get(keys[0], np.zeros(n))[post]) / tot) if tot > 0 and branch != "nokiln" else None
    return cal, share


def _write_aoi(units, shares, branch):
    import geopandas as gpd

    from .export import _dump

    inv = pd.read_parquet(C.INTERIM / "inventory.parquet")
    bd = inv[inv.country == "BD"]
    pts = gpd.GeoDataFrame(bd, geometry=gpd.points_from_xy(bd.lon, bd.lat), crs=4326)
    for level in ("district", "upazila"):
        u = units[units.level == level].copy()
        cnt = gpd.sjoin(pts, u[["unit_id", "geometry"]], predicate="within").groupby("unit_id").size()
        u["kiln_count"] = u.unit_id.map(cnt).fillna(0).astype(int) if branch != "nokiln" else None
        u["kiln_share"] = u.unit_id.map(shares).round(3) if branch != "nokiln" else None
        tol = 0.002 if level == "district" else 0.004  # ~200 m / ~400 m: below map display resolution, inside budgets
        u["geometry"] = u.geometry.simplify(tol)
        gj = json.loads(u[["unit_id", "level", "name_en", "name_bn", "division", "kiln_count", "kiln_share", "geometry"]].to_json(na="null"))
        for f in gj["features"]:
            f.pop("id", None)
            f["geometry"]["coordinates"] = _round(f["geometry"]["coordinates"])
        _dump(gj, PUB / "aoi" / f"{level}s.geojson")


def _round(c):
    return [_round(x) for x in c] if isinstance(c[0], list) else [round(c[0], 4), round(c[1], 4)]


def _write_grid_tiles(cd):
    from .export import _dump

    sidx = {"T": 0, "A": 1, "N": 2, "J1": 3}
    x = cd[cd.sensor.isin(["A", "N"])]
    lat_r = x.cell_id // C.GRID_COLS
    col = x.cell_id % C.GRID_COLS
    tile = (np.floor(C.GRID_ORIGIN_LON + col * C.GRID_STEP).astype(int).astype(str) + "_" + np.floor(C.GRID_ORIGIN_LAT + lat_r * C.GRID_STEP).astype(int).astype(str))
    day = (x.date_local - DAY0).dt.days
    sp = x.sensor.map(sidx) * 2 + (x["pass"] == "N").astype(int)
    df = pd.DataFrame({"tile": tile.to_numpy(), "cell": x.cell_id.to_numpy(), "day": day.to_numpy(), "sp": sp.to_numpy()})
    for t, g in df.groupby("tile"):
        _dump({"tile": t, "day0": "2003-01-01", "rows": g[["cell", "day", "sp"]].to_numpy().tolist()}, PUB / "grid" / f"{t}.json")


def _write_events():
    from .export import _dump

    pol = pd.read_csv(C.STATIC / "policy_events.csv")
    crop = pd.read_csv(C.STATIC / "crop_calendar.csv")
    _dump({"policy": pol.rename(columns={"source_url": "url"}).to_dict("records"),
           "harvest": [{"crop": r.crop, "start_doy": int(pd.Timestamp(r.harvest_start).dayofyear), "end_doy": int(pd.Timestamp(r.harvest_end).dayofyear), "url": r.source_url}
                       for r in crop.itertuples()]}, PUB / "events.json")


def figures() -> None:
    """P1 money shots (offline PNGs) from the public JSON."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    C.FIGURES.mkdir(parents=True, exist_ok=True)
    h = json.loads((PUB / "harmonization.json").read_text(encoding="utf-8"))
    y = h["yearly"]
    s = [r["season"] for r in y]
    fig, ax = plt.subplots(figsize=(10, 4.8), dpi=150)
    ax.plot(s, [r["raw_sum"] for r in y], "--o", color="#9a9a9a", ms=3, label="Raw (sensors spliced)")
    ax.fill_between(s, [r["h"]["lo"] for r in y], [r["h"]["hi"] for r in y], color="#fdba74", alpha=0.6, label="95% interval")
    ax.plot(s, [r["h"]["p50"] for r in y], "-o", color="#c2410c", lw=2.5, ms=3, label="Harmonized (Aqua-MODIS equivalent)")
    ax.plot(s, [r["aqua_obs"] for r in y], "-", color="#2563eb", lw=1, label="Aqua as observed (check)")
    ax.axvline("2012-13", color="k", lw=0.8, ls=":")
    ax.set_title(f"The 2012 jump is a sensor artefact: harmonized jump = {h['seam']['ratio'] * 100:.0f}% of raw")
    ax.set_ylabel("Season fire activity (per 1,000 clear cells)")
    ax.tick_params(axis="x", rotation=60)
    ax.legend(frameon=False, fontsize=8)
    fig.tight_layout()
    fig.savefig(C.FIGURES / "money_jump.png")
    v = json.loads((PUB / "validation.json").read_text(encoding="utf-8"))
    p = v["profiles"]
    fig, ax = plt.subplots(figsize=(10, 4.2), dpi=150)
    wk = pd.to_datetime(p["week"])
    ax.plot(wk, p["kiln_day"], color="#b45309", lw=2.5, label="Kiln clusters · day")
    ax.plot(wk, p["kiln_night"], color="#b45309", ls="--", label="Kiln clusters · night")
    ax.plot(wk, p["ctrl_day"], color="#2563eb", lw=2.5, label="Matched controls · day")
    ax.plot(wk, p["ctrl_night"], color="#2563eb", ls="--", label="Matched controls · night")
    nok = C.load_derived()["GATE_BRANCH"]["value"] == "nokiln"
    ax.set_title(f"Pre-registered gate {C.GATE_SEASON}: kiln clusters are no brighter than matched controls" if nok
                 else f"Kilns burn for months, crop fires for days — gate season {C.GATE_SEASON}")
    ax.set_ylabel("Share of clear days with a detection")
    ax.legend(frameon=False, fontsize=8)
    fig.tight_layout()
    fig.savefig(C.FIGURES / "money_plateau.png")


def write_baseline() -> dict:
    """I1: freeze the headline numbers; I3 (clean-clone rerun) asserts against them."""
    h = json.loads((PUB / "harmonization.json").read_text(encoding="utf-8"))
    v = json.loads((PUB / "validation.json").read_text(encoding="utf-8"))
    b = {"gate_branch": C.load_derived()["GATE_BRANCH"]["value"], "seam": h["seam"], "loso_pooled": h["loso_pooled"],
         "selected_model": h["selected_model"], "gates": [g for g in v["gates"] if g["gate"] in ("G1", "G2")],
         "holdouts": v["classifier"]["holdouts"], "pr_auc": v["classifier"]["pr_auc"]}
    (C.REPORTS / "baseline.json").write_text(json.dumps(b, indent=1), encoding="utf-8")
    return b
