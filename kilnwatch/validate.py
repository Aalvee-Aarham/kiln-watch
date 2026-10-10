"""Validation layers, strongest first (architecture §5.8). Writes interim/public/validation.json."""
from __future__ import annotations

import json
import logging

import numpy as np
import pandas as pd

from . import config as C
from .research import calendar_len
from .stats import bootstrap_ci, wilson

log = logging.getLogger("kilnwatch.validate")


def _ci(t):
    return {"p50": float(t[0]), "lo": float(t[1]), "hi": float(t[2])}


def ccc(x, y) -> float:
    """Lin's concordance correlation coefficient: 1 only when y equals x, so unlike Pearson's r it drops when one
    sensor reads on a different scale (Lin 1989, Biometrics 45:255)."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    mx, my = x.mean(), y.mean()
    return float(2 * np.mean((x - mx) * (y - my)) / (x.var() + y.var() + (mx - my) ** 2))


def _overlap_months(cal: dict) -> pd.DataFrame | None:
    """District-months where Aqua MODIS and S-NPP VIIRS both saw >= 20% of the district cloud-free on >= 5 days:
    mean Aqua rate (the reference), mean raw VIIRS rate and mean harmonized (VIIRS converted) rate."""
    cf = cal.get("clear_frac") or {}
    if "A" not in cf or "N" not in cf or "A" not in cal["raw"] or "N" not in cal["raw"]:
        return None
    n = len(cf["A"])
    days = np.asarray(cal["days"], int)
    keep = days < n

    def dense(v):
        out = np.zeros(n)
        out[days[keep]] = np.asarray(v, float)[keep]
        return out

    dates = pd.Timestamp(cal["day0"]) + pd.to_timedelta(np.arange(n), "D")
    from .metrics import SNPP_END, SNPP_START

    both = (np.asarray(cf["A"]) >= 20) & (np.asarray(cf["N"]) >= 20) & (dates >= SNPP_START) & (dates < SNPP_END)
    df = pd.DataFrame({"month": dates.to_period("M"), "aqua": dense(cal["raw"]["A"]), "viirs_raw": dense(cal["raw"]["N"]), "viirs_harm": dense(cal["h"])})[both]
    m = df.groupby("month").agg(aqua=("aqua", "mean"), viirs_raw=("viirs_raw", "mean"), viirs_harm=("viirs_harm", "mean"), n=("aqua", "size"))
    m = m[m.n >= 5].reset_index()
    from .grid import season_series

    m["season"] = season_series(m.month.dt.to_timestamp()).to_numpy()
    return m.assign(unit_id=cal["unit_id"])


def overlap_agreement(cals: list[dict], calib=None, rng=None, n_boot=200) -> list[dict]:
    """Does VIIRS agree with Aqua MODIS on the months both flew? For the calibration seasons and the held-out
    seasons after them: ratio of total VIIRS to total Aqua activity (1 = same scale) and Lin's CCC, raw vs
    harmonized, with 95% intervals from a bootstrap over districts."""
    calib = tuple(calib or C.CALIB_SEASONS)
    rng = rng if rng is not None else C.rng("validate")
    frames = [m for m in (_overlap_months(c) for c in cals) if m is not None and len(m)]
    if not frames:
        return []
    allm = pd.concat(frames, ignore_index=True)
    out = []
    for period, sel in (("calibration", allm.season.isin(calib)), ("held_out", ~allm.season.isin(calib) & (allm.season > calib[-1]))):
        d = allm[sel]
        if d.unit_id.nunique() < 2 or not d.aqua.sum() > 0:  # no Aqua activity to compare against: no estimate
            continue
        groups = [g for _, g in d.groupby("unit_id")]

        def stats(x):
            return {"ratio_raw": x.viirs_raw.sum() / x.aqua.sum(), "ratio_harm": x.viirs_harm.sum() / x.aqua.sum(),
                    "ccc_raw": ccc(x.aqua, x.viirs_raw), "ccc_harm": ccc(x.aqua, x.viirs_harm)}

        point = stats(d)
        boots = [stats(pd.concat([groups[i] for i in rng.integers(0, len(groups), len(groups))])) for _ in range(n_boot)]
        ci = {k: {"p50": round(float(point[k]), 4), "lo": round(float(np.nanquantile([b[k] for b in boots], 0.025)), 4),
                  "hi": round(float(np.nanquantile([b[k] for b in boots], 0.975)), 4)} for k in point}
        seasons = sorted(d.season.unique())
        out.append({"period": period, "seasons": f"{seasons[0]}…{seasons[-1]}", "n_months": int(len(d)), "n_districts": len(groups), **ci})
    return out


OUTLOOK_FROM, OUTLOOK_STEPS, OUTLOOK_DAYS, OUTLOOK_SHRINK = (11, 1), 28, 14, 5  # 1 Nov, weekly to mid-May, 14-day windows


def _outlook_rows(cals: list[dict]) -> pd.DataFrame:
    """One row per district × season × week of the firing window: s = any unusual day (above the day's p90 normal)
    in the 14 days before, t = any unusual day in the 14 days after."""
    rows = []
    day0 = pd.Timestamp(cals[0]["day0"]) if cals else pd.Timestamp("2003-01-01")
    for c in cals:
        n = calendar_len(c)
        u = np.zeros(n, int)
        u[np.asarray(c["unusual"], int)] = 1
        cu = np.r_[0, np.cumsum(u)]
        for y in range(day0.year, (day0 + pd.Timedelta(days=n)).year + 1):  # windows past the end are skipped below
            start = pd.Timestamp(y, *OUTLOOK_FROM)
            for k in range(OUTLOOK_STEPS):
                i = (start - day0).days + 7 * k
                if i - OUTLOOK_DAYS < 0 or i + OUTLOOK_DAYS > n:
                    continue
                rows.append((c["unit_id"], f"{y}-{(y + 1) % 100:02d}", k, cu[i] - cu[i - OUTLOOK_DAYS] >= 1, cu[i + OUTLOOK_DAYS] - cu[i] >= 1))
    return pd.DataFrame(rows, columns=["unit_id", "season", "week", "s", "t"])


def _outlook_probs(train: pd.DataFrame, keys: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """Climatology b = P(t | district, week) and the outlook p = P(t | district, week, s), shrunk towards b."""
    clim = train.groupby(["unit_id", "week"]).t.mean()
    b = clim.reindex(pd.MultiIndex.from_frame(keys[["unit_id", "week"]])).to_numpy()
    g = train.groupby(["unit_id", "week", "s"]).t
    idx = pd.MultiIndex.from_frame(keys[["unit_id", "week", "s"]])
    pc, nc = g.mean().reindex(idx).to_numpy(), g.size().reindex(idx).fillna(0).to_numpy()
    return (nc * np.nan_to_num(pc) + OUTLOOK_SHRINK * b) / (nc + OUTLOOK_SHRINK), b


def outlook(cals: list[dict], rng=None, n_boot=200) -> dict | None:
    """Two-week unusual-fire outlook per district, and its leave-one-season-out backtest against the district ×
    week climatology (Brier skill score, district bootstrap). `ships` only when the lower 95% bound is above 0.
    Exploratory, not pre-registered: the rule and the shrinkage were fixed before the first backtest run. The
    probabilities are fitted without the held-out season; the p90 normal that defines an unusual day uses all seasons."""
    allrows = _outlook_rows(cals)
    df = allrows
    if df.empty or df.unit_id.nunique() < 2:
        return None
    rng = rng if rng is not None else C.rng("validate")
    p, b = np.empty(len(df)), np.empty(len(df))
    for s in df.season.unique():
        te = (df.season == s).to_numpy()
        p[te], b[te] = _outlook_probs(df[~te], df[te])
    df = df.assign(p=p, b=b)
    ok = np.isfinite(df.b)
    df = df[ok]

    def bss(x):
        with np.errstate(invalid="ignore", divide="ignore"):  # a resample with no unusual day has no skill to score
            return 1 - np.mean((x.p - x.t) ** 2) / np.mean((x.b - x.t) ** 2)

    groups = [g for _, g in df.groupby("unit_id")]
    if not np.isfinite(bss(df)):  # no unusual days to score against: the backtest is not estimable, publish nothing
        return None
    boots = [bss(pd.concat([groups[i] for i in rng.integers(0, len(groups), len(groups))])) for _ in range(n_boot)]
    if not np.isfinite(boots).any():
        return None
    skill = {"p50": round(float(bss(df)), 4), "lo": round(float(np.nanquantile(boots, 0.025)), 4), "hi": round(float(np.nanquantile(boots, 0.975)), 4)}
    table = {}
    for uid in sorted(allrows.unit_id.unique()):
        k = pd.DataFrame({"unit_id": uid, "week": np.repeat(np.arange(OUTLOOK_STEPS), 2), "s": np.tile([True, False], OUTLOOK_STEPS)})
        pk, bk = _outlook_probs(allrows, k)
        table[uid] = {"clim": [round(float(x), 3) for x in bk[::2]], "if_recent": [round(float(x), 3) for x in pk[::2]], "if_quiet": [round(float(x), 3) for x in pk[1::2]]}
    seasons = sorted(df.season.unique())
    return {"rule": "Chance of at least one unusual day (above the day's 90th-percentile normal) in the next 14 days, given whether the last 14 days had one",
            "start": f"{OUTLOOK_FROM[0]:02d}-{OUTLOOK_FROM[1]:02d}", "step_days": 7, "window_days": OUTLOOK_DAYS, "weeks": OUTLOOK_STEPS,
            "backtest": {"seasons": f"{seasons[0]}…{seasons[-1]}", "n": int(len(df)), "n_districts": len(groups), "baseline": "district × week climatology",
                         "base_rate": round(float(df.t.mean()), 4), "brier_skill": skill},
            "ships": bool(skill["lo"] > 0), "districts": table}


def shape_all_seasons() -> list[dict] | None:
    """Layer 1: gate statistics on every season with footprint clear fractions (2012-13 → 2024-25 when cached)."""
    from .gates import unit_days, unit_stats

    p = C.INTERIM / "clear_footprints.parquet"
    if not p.exists():
        return None
    clear = pd.read_parquet(p)
    det = pd.read_parquet(C.INTERIM / "detections.parquet")
    links = pd.read_parquet(C.INTERIM / "links.parquet")
    clusters = pd.read_parquet(C.INTERIM / "clusters.parquet")
    ctrl = pd.read_parquet(C.INTERIM / "controls.parquet")
    units = list(clusters.cluster_id.astype(str)) + list(ctrl.control_id)
    k = np.array([True] * len(clusters) + [False] * len(ctrl))
    rows = []
    seasons = sorted({s for s in clear.date_local.map(lambda d: f"{d.year - (d.month < 7)}-{(d.year - (d.month < 7) + 1) % 100:02d}")})
    for s in seasons:
        st = unit_stats(unit_days(links, det, clear, units, s, ["N"]), s).set_index("unit_id").reindex(units)
        if st.clear_days.sum() == 0:
            continue
        rows.append({"season": s, "S_kiln": float(st.S[k].median()), "S_ctrl": float(st.S[~k].median()),
                     "DR_ratio": float(st.DR[k].mean() / max(st.DR[~k].mean(), 1e-9)),
                     "night_ratio": float(st.DR_night[k].mean() / max(st.DR_night[~k].mean(), 1e-9)), "M_kiln": float(st.M[k].mean())})
    return rows


def s2_score() -> dict | None:
    f = C.STATIC / "s2_checks.csv"
    if not f.exists():
        return None
    d = pd.read_csv(f)
    piv = d.pivot_table(index="candidate_ref", columns="rater", values="verdict", aggfunc="first")
    agree = piv.dropna()
    yes = (agree == "kiln").all(axis=1)
    lo, hi = wilson(int(yes.sum()), len(agree))
    from sklearn.metrics import cohen_kappa_score

    kappa = cohen_kappa_score(agree.iloc[:, 0], agree.iloc[:, 1]) if agree.shape[1] >= 2 else np.nan
    return {"precision_s2": {"p50": float(yes.mean()), "lo": lo, "hi": hi}, "kappa": float(kappa)}


def tropomi_did(branch: str) -> dict | None:
    """Layer 4: belts (upazilas with >=50 kilns) vs rings (upazilas 10–30 km away with <5 kilns); DiD firing − monsoon."""
    from .ingest import read_units

    files = sorted((C.RAW / "gee" / "s5p" / "NO2").glob("*.parquet"))
    if not files:
        return None
    no2 = pd.concat([pd.read_parquet(f) for f in files])
    units = read_units()
    up = units[units.level == "upazila"].copy()
    import geopandas as gpd

    inv = pd.read_parquet(C.INTERIM / "inventory.parquet")
    inv = inv[inv.country == "BD"]
    pts = gpd.GeoDataFrame(inv, geometry=gpd.points_from_xy(inv.lon, inv.lat), crs=4326)
    kc = gpd.sjoin(pts, up[["unit_id", "geometry"]], predicate="within").groupby("unit_id").size()
    up["k"] = up.unit_id.map(kc).fillna(0)
    cen = up.to_crs(C.METRIC_CRS).geometry.centroid
    belts = up[up.k >= 50]
    pairs = []
    for b in belts.itertuples():
        d = cen.distance(cen[b.Index])
        ring = up[(d > 10_000) & (d < 30_000) & (up.k < 5)]
        if len(ring):
            pairs.append((b.unit_id, list(ring.unit_id)))
    if not pairs:
        return None
    no2["month_n"] = pd.to_datetime(no2.month).dt.month
    no2["year"] = pd.to_datetime(no2.month).dt.year
    v = no2.pivot_table(index=["year", "month_n", "month"], columns="unit_id", values="mean")
    diff = pd.DataFrame({b: v[b] - v[r].mean(axis=1) for b, r in pairs if b in v and all(x in v for x in r)}).mean(axis=1)
    dd = diff.reset_index().rename(columns={0: "bmr"})
    yearly = dd.groupby("year").apply(lambda g: g[g.month_n.isin(C.FIRING_MONTHS)].bmr.mean() - g[g.month_n.isin(C.MONSOON_MONTHS)].bmr.mean(), include_groups=False).dropna()
    did = bootstrap_ci(yearly.to_numpy(), n=1000, rng=C.rng("validate"))
    nat = json.loads((C.INTERIM / "public" / "calendar" / f"{belts.iloc[0].unit_id}.json").read_text(encoding="utf-8")) if len(belts) else None
    idx_month = {}
    if nat and "index" in nat:
        s = pd.Series(nat["index"], index=pd.Timestamp("2003-01-01") + pd.to_timedelta(nat["days"], "D"))
        idx_month = s.resample("MS").mean().to_dict()
    monthly = [{"month": r.month, "belt_minus_ring": float(r.bmr), "index": float(idx_month.get(pd.Timestamp(r.month + "-01"), 0.0) or 0.0)}
               for r in dd.itertuples() if np.isfinite(r.bmr)]
    return {"treatment": "HBI" if branch == "nokiln" else "HKFI", "did_no2": _ci(did), "monthly": monthly[-72:]}


def pm25_lags() -> list[dict] | None:
    """Layer 5: partial correlation of Dhaka PM2.5 with lagged kiln and vegetation indices, month+year FE and ERA5 weather."""
    p = C.INTERIM / "pm25.parquet"
    cal_p = C.INTERIM / "public" / "calendar"
    dhaka = next((f for f in cal_p.glob("BD3026*.json")), None) if cal_p.exists() else None
    if not p.exists() or dhaka is None:
        return None
    pm = pd.read_parquet(p)
    pm["date"] = pd.to_datetime(pm.date)
    # Dhaka division-wide signals: sum district calendars of Dhaka division
    days, kiln, veg = {}, {}, {}
    for f in cal_p.glob("BD30*.json"):
        if len(f.stem) != 6:
            continue
        c = json.loads(f.read_text(encoding="utf-8"))
        sp = {s["key"]: s["values"] for s in c["split"]}
        z = [0.0] * len(c["days"])
        # kiln branches: kiln-like vs vegetation-like; nokiln: non-harvest ('other') vs harvest windows (aman + boro)
        a = sp.get("kiln", sp.get("other", z))
        b = sp["vegetation"] if "vegetation" in sp else [x + y for x, y in zip(sp.get("aman", z), sp.get("boro", z))]
        for i, d in enumerate(c["days"]):
            kiln[d] = kiln.get(d, 0) + a[i]
            veg[d] = veg.get(d, 0) + b[i]
            days[d] = 1
    idx = pd.Timestamp("2003-01-01") + pd.to_timedelta(sorted(days), "D")
    sig = pd.DataFrame({"kiln": [kiln[d] for d in sorted(days)], "veg": [veg[d] for d in sorted(days)]}, index=idx)
    sig = sig.reindex(pd.date_range(idx.min(), idx.max())).fillna(0)
    era = sorted((C.RAW / "gee" / "era5").glob("*.parquet"))
    w = pd.read_parquet(era[0]).set_index("date") if era else None
    rng = C.rng("validate")
    out = []
    for lag in (0, 1, 2):
        df = pm.set_index("date").join(sig.shift(lag), how="inner")
        if w is not None:
            df = df.join(w, how="left")
        df = df.dropna()
        if len(df) < 60:
            return None
        X = pd.get_dummies(pd.DataFrame({"m": df.index.month.astype(str), "y": df.index.year.astype(str)}), dtype=float)
        if w is not None:
            X = pd.concat([X.set_index(df.index), df[[c for c in w.columns if c in df]]], axis=1)
        else:
            X.index = df.index

        def partial(col, X=X, df=df):
            def r(ix):
                Z = np.c_[np.ones(len(ix)), X.to_numpy()[ix]]
                ry = df.pm25.to_numpy()[ix] - Z @ np.linalg.lstsq(Z, df.pm25.to_numpy()[ix], rcond=None)[0]
                rx = df[col].to_numpy()[ix] - Z @ np.linalg.lstsq(Z, df[col].to_numpy()[ix], rcond=None)[0]
                return np.corrcoef(rx, ry)[0, 1]
            n = len(df)
            pt = r(np.arange(n))
            nb = n // 7
            draws = [r(np.concatenate([np.arange(b * 7, b * 7 + 7) for b in rng.integers(0, nb, nb)])) for _ in range(200)]
            return {"p50": float(pt), "lo": float(np.nanquantile(draws, 0.025)), "hi": float(np.nanquantile(draws, 0.975))}
        out.append({"lag": lag, "r_kiln": partial("kiln"), "r_veg": partial("veg")})
    return out


def run() -> dict:
    from .export import _dump, nan_to_none

    gates = json.loads((C.INTERIM / "gates.json").read_text(encoding="utf-8"))
    clf = json.loads((C.INTERIM / "classifier.json").read_text(encoding="utf-8"))
    branch = C.load_derived()["GATE_BRANCH"]["value"]
    ctrl = json.loads((C.INTERIM / "controls_report.json").read_text(encoding="utf-8"))
    v = {"gates": gates["gate_rows"], "profiles": gates["profiles"], "radius_sweep": gates["radius_sweep"],
         "classifier": {k: clf[k] for k in ("pr_curve", "pr_auc", "baseline_pr_auc", "prevalence", "importance", "holdouts", "labelset", "ablation_no_persistence")},
         "controls": ctrl, "candidates": {"n": 0, "by_district": {}}, "skipped": []}
    cand = C.INTERIM / "candidates_by_district.json"
    if cand.exists():
        v["candidates"] = json.loads(cand.read_text(encoding="utf-8"))
    skipped = v["skipped"]
    layer1 = shape_all_seasons()
    if layer1:
        (C.INTERIM / "shape_all_seasons.json").write_text(json.dumps(layer1), encoding="utf-8")
    else:
        skipped.append({"stage": "shape", "reason": "footprint clear fractions cached for the gate season only"})
    skipped.append({"stage": "skdb", "reason": "SentinelKilnDB not downloaded (CC BY-NC, validation-only; Should tier)"})
    s2 = s2_score()
    if s2:
        v["candidates"].update(s2)
    else:
        skipped.append({"stage": "s2score", "reason": "data/static/s2_checks.csv absent (two-rater check not yet done)"})
    for name, fn in (("tropomi", lambda: tropomi_did(branch)), ("pm25", pm25_lags)):
        try:
            r = fn()
        except Exception as e:  # a validation layer never fails `all`
            log.warning("%s failed: %s", name, e)
            r = None
        if r:
            v[name] = r
        else:
            skipped.append({"stage": name, "reason": "inputs unavailable"})
    tr = C.INTERIM / "transfer.json"
    if tr.exists():
        t = json.loads(tr.read_text(encoding="utf-8"))
        if t.get("dr_computed"):
            v["transfer"] = t
        else:
            skipped.append({"stage": "transfer", "reason": "transfer clear fractions not computed"})
    else:
        skipped.append({"stage": "transfer", "reason": "transfer test not run"})
    skipped.append({"stage": "closure", "reason": "no DoE demolition records available"})
    _dump(nan_to_none(v), C.INTERIM / "public" / "validation.json")
    L = ["# Validation report (A9)", "", "Layers ranked by evidential strength.", ""]
    if layer1:
        L += ["## Layer 1 — shape across seasons", pd.DataFrame(layer1).round(3).to_markdown(index=False), ""]
    for k in ("tropomi", "pm25", "transfer"):
        if k in v:
            L += [f"## {k}", "```", json.dumps(v[k] if k != "tropomi" else {x: y for x, y in v[k].items() if x != "monthly"}, indent=1, default=float), "```", ""]
    L += ["## Skipped"] + [f"- {s['stage']}: {s['reason']}" for s in skipped]
    (C.REPORTS / "validation_report.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    return v
