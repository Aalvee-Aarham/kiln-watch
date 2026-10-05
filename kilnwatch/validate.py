"""Validation layers, strongest first (architecture §5.8). Writes interim/public/validation.json."""
from __future__ import annotations

import json
import logging

import numpy as np
import pandas as pd

from . import config as C
from .stats import bootstrap_ci, wilson

log = logging.getLogger("kilnwatch.validate")


def _ci(t):
    return {"p50": float(t[0]), "lo": float(t[1]), "hi": float(t[2])}


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
    aoi = json.loads((C.INTERIM / "public" / "aoi" / "upazilas.geojson").read_text(encoding="utf-8"))
    kc = {f["properties"]["unit_id"]: f["properties"]["kiln_count"] or 0 for f in aoi["features"]}
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
        for i, d in enumerate(c["days"]):
            kiln[d] = kiln.get(d, 0) + sp.get("kiln", [0] * len(c["days"]))[i]
            veg[d] = veg.get(d, 0) + sp.get("vegetation", [0] * len(c["days"]))[i]
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


def run(only=None) -> dict:
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
