"""Feasibility gates G0–GN (architecture §5.4, PREREGISTRATION.md). Writes reports/gate_report.md and GATE_BRANCH."""
from __future__ import annotations

import json
import logging

import numpy as np
import pandas as pd
from scipy.stats import mannwhitneyu

from . import config as C
from .kilns import link, link_points
from .stats import perm_test

log = logging.getLogger("kilnwatch.gates")
MIN_CLEAR = 0.2


def season_bounds(season: str):
    y = int(season[:4])
    return pd.Timestamp(y, 7, 1), pd.Timestamp(y + 1, 6, 30)


def S_stat(days: pd.DataFrame, season: str) -> float:
    """Share of the 30 weeks of Nov–May (from 1 Nov) with >=2 clear days that contain >=1 detection."""
    y = int(season[:4])
    d = days[(days.date >= pd.Timestamp(y, 11, 1)) & (days.date <= pd.Timestamp(y + 1, 5, 31))]
    wk = ((d.date - pd.Timestamp(y, 11, 1)).dt.days // 7).to_numpy()
    d = d[wk < 30]
    wk = wk[wk < 30]
    g = pd.DataFrame({"wk": wk, "clear": d.clear.to_numpy(), "hit": (d.det & d.clear).to_numpy()}).groupby("wk").sum()
    elig = g[g.clear >= 2]
    return float((elig.hit > 0).mean()) if len(elig) else np.nan


def P_stat(det_days: np.ndarray, window=14) -> float:
    """Best `window`-day rolling sum of detection-days ÷ season total (det_days: 0/1 per season day)."""
    x = np.asarray(det_days, float)
    tot = x.sum()
    if tot == 0:
        return np.nan
    best = np.convolve(x, np.ones(window), mode="valid").max() if len(x) >= window else tot
    return float(best / tot)


def unit_days(links: pd.DataFrame, det: pd.DataFrame, clear: pd.DataFrame, units: list[str], season: str, sensors) -> pd.DataFrame:
    """Per unit × day: clear (any sensor clear_frac >= MIN_CLEAR) and det (>=1 linked detection)."""
    lo, hi = season_bounds(season)
    days = pd.date_range(lo, hi, freq="D")
    cl = clear[clear.sensor.isin(sensors) & clear.date_local.between(lo, hi)]
    cl = cl.groupby(["unit_id", "date_local"]).clear_frac.max().ge(MIN_CLEAR)
    d = det.loc[det.sensor.isin(sensors) & det.date_local.between(lo, hi) & det.conf_class.isin(C.CONF_KEEP), ["date_local", "pass"]]
    lk = links.merge(d, left_on="det_idx", right_index=True)
    hit = lk.groupby(["unit_id", "date_local"]).size().gt(0)
    hit_n = lk[lk["pass"] == "N"].groupby(["unit_id", "date_local"]).size().gt(0)
    idx = pd.MultiIndex.from_product([units, days], names=["unit_id", "date_local"])
    out = pd.DataFrame(index=idx)
    out["clear"] = cl.reindex(idx, fill_value=False).to_numpy()
    out["det"] = hit.reindex(idx, fill_value=False).to_numpy()
    out["det_n"] = hit_n.reindex(idx, fill_value=False).to_numpy()
    return out.reset_index().rename(columns={"date_local": "date"})


def unit_stats(ud: pd.DataFrame, season: str) -> pd.DataFrame:
    rows = []
    y = int(season[:4])
    for uid, g in ud.groupby("unit_id", sort=False):
        m = g.date.dt.month
        fire = m.isin(C.FIRING_MONTHS)
        mon = m.isin(C.MONSOON_MONTHS)
        cf, cm = g.clear & fire, g.clear & mon
        firing = g[(g.date >= pd.Timestamp(y, 11, 1)) & (g.date <= pd.Timestamp(y + 1, 5, 31))]
        rows.append({
            "unit_id": uid,
            "clear_days": int(cf.sum()),
            "det_days": int((g.det & cf).sum()),
            "DR": (g.det & cf).sum() / cf.sum() if cf.sum() else np.nan,
            "DR_night": (g.det_n & cf).sum() / cf.sum() if cf.sum() else np.nan,
            "M": (g.det & cm).sum() / cm.sum() if cm.sum() else np.nan,
            "S": S_stat(g, season),
            "P": P_stat((firing.det & firing.clear).to_numpy()),
        })
    return pd.DataFrame(rows)


def evaluate(st: pd.DataFrame, is_kiln: np.ndarray, strata: np.ndarray, rng) -> dict:
    """The three pre-registered G1 criteria; returns values, thresholds, p and pass flags."""
    k, c = st[is_kiln], st[~is_kiln]
    sk, sc = k.S.dropna(), c.S.dropna()
    pk, pc = k.P.dropna(), c.P.dropna()
    p_s = mannwhitneyu(sk, sc, alternative="greater").pvalue if len(sk) and len(sc) else 1.0
    p_p = mannwhitneyu(pk, pc, alternative="less").pvalue if len(pk) and len(pc) else 1.0
    s_ratio = (sk.median() / sc.median()) if len(sc) and sc.median() > 0 else (np.inf if len(sk) and sk.median() > 0 else np.nan)
    shape = bool(s_ratio >= 2 and len(pk) and len(pc) and pk.median() < pc.median() and p_s < 0.01 and p_p < 0.01)
    ok = st.DR.notna().to_numpy()
    dr_ratio = k.DR.mean() / c.DR.mean() if c.DR.mean() > 0 else np.inf
    p_c = perm_test(st.DR.to_numpy()[ok], is_kiln[ok], strata[ok], n=10_000, rng=rng)
    contrast = bool(dr_ratio >= 3 and p_c < 0.01)
    fire_dr = k.DR.mean()
    mon_dr = k.M.mean()
    seas_ratio = fire_dr / mon_dr if mon_dr > 0 else np.inf
    seasonality = bool(seas_ratio >= 3)
    night_ratio = k.DR_night.mean() / c.DR_night.mean() if c.DR_night.mean() > 0 else np.inf
    return {
        "rows": [
            {"criterion": "Shape: median S(kiln) / median S(control)", "value": float(s_ratio), "threshold": "≥ 2, MW p < 0.01", "p": float(p_s)},
            {"criterion": "Shape: median P(kiln) vs median P(control)", "value": float(pk.median() if len(pk) else np.nan), "threshold": f"< {pc.median() if len(pc) else float('nan'):.3f}, MW p < 0.01", "p": float(p_p)},
            {"criterion": "Contrast: mean DR(kiln) / mean DR(control)", "value": float(dr_ratio), "threshold": "≥ 3, perm p < 0.01", "p": float(p_c)},
            {"criterion": "Seasonality: DR(Nov–May) / DR(Jun–Oct), kilns", "value": float(seas_ratio), "threshold": "≥ 3"},
        ],
        "shape": shape, "contrast": contrast, "seasonality": seasonality,
        "pass": shape and contrast and seasonality,
        "night_ratio": float(night_ratio),
        "median_dr_kiln": float(k.DR.median()),
    }


def branch(g1: bool, g2: bool, eligible: bool, gn: bool) -> str:
    if g1:
        if not eligible:
            return "partial"
        return "full" if g2 else "from2012"
    return "nightfire" if gn else "nokiln"


def run() -> dict:

    from .ingest import _parquet

    season = C.GATE_SEASON
    det = pd.read_parquet(C.INTERIM / "detections.parquet")
    kilns = pd.read_parquet(C.INTERIM / "kilns.parquet")
    ctrl = pd.read_parquet(C.INTERIM / "controls.parquet")
    clusters = pd.read_parquet(C.INTERIM / "clusters.parquet")
    clear = pd.read_parquet(C.INTERIM / "clear_footprints.parquet")
    pts = link_points(kilns, ctrl)
    near = det[det.lat.between(C.BBOX_S, C.BBOX_N)]
    links = link(near, pts, "pixel")
    _parquet(links.assign(radius_m="pixel"), C.INTERIM / "links.parquet")
    units = list(clusters.cluster_id.astype(str)) + list(ctrl.control_id)
    is_kiln = np.array([True] * len(clusters) + [False] * len(ctrl))
    dist_of = dict(zip(clusters.cluster_id.astype(str), clusters.district)) | dict(zip(ctrl.control_id, ctrl.district))
    strata = np.array([dist_of[u] for u in units])
    rng = C.rng("gates")

    results, stats_by_gate = {}, {}
    for gate, sensors in (("G1", ["N"]), ("G2", ["T", "A"])):
        ud = unit_days(links, det, clear, units, season, sensors)
        st = unit_stats(ud, season).set_index("unit_id").reindex(units).reset_index()
        stats_by_gate[gate] = (st, ud)
        results[gate] = evaluate(st, is_kiln, strata, rng)
        log.info("%s pass=%s", gate, results[gate]["pass"])

    g1st = stats_by_gate["G1"][0]
    elig = g1st[is_kiln & (g1st.DR >= 0.10) & (g1st.det_days >= 10)]
    eligible = len(elig) > 0

    # G0 — STA prior screen via FIRMS type=2 (derived from the STA mask), calendar 2023
    v23 = det[(det.sensor == "N") & (det.date_local.dt.year == 2023)]
    t2 = v23[v23.type == 2]
    l23 = link(t2, pts[pts.unit_type == "cluster"], "pixel")
    g0_kiln = l23.unit_id.nunique() / len(clusters)
    g0_conv = l23.det_idx.nunique() / len(t2) if len(t2) else np.nan
    # G3 — type distribution of kiln-linked detections
    kl = links[links.unit_type == "cluster"].merge(det[["type", "sensor"]], left_on="det_idx", right_index=True)
    g3 = kl.groupby("sensor", observed=True)["type"].value_counts(normalize=True, dropna=False).round(3).to_dict()

    # radius sweep and weekly profiles (pooled)
    sweep = []
    sn = near[(near.sensor == "N") & near.conf_class.isin(C.CONF_KEEP)]
    for r in (200, 400, 750, 1500):
        lk = link(sn, pts, r)
        ud = unit_days(lk, det, clear, units, season, ["N"])
        st = unit_stats(ud, season).set_index("unit_id").reindex(units)
        sweep.append({"radius_m": r, "kiln": float(st.DR[is_kiln].mean()), "ctrl": float(st.DR[~is_kiln].mean())})
    ud = stats_by_gate["G1"][1]
    ud["kiln"] = ud.unit_id.isin(set(np.array(units)[is_kiln]))
    ud["week"] = ud.date.dt.to_period("W").dt.start_time
    wk = ud[ud.clear].groupby(["week", "kiln"]).agg(day=("det", "mean"), night=("det_n", "mean")).unstack()
    profiles = {"week": [d.strftime("%Y-%m-%d") for d in wk.index],
                "kiln_day": wk[("day", True)].round(4).tolist(), "kiln_night": wk[("night", True)].round(4).tolist(),
                "ctrl_day": wk[("day", False)].round(4).tolist(), "ctrl_night": wk[("night", False)].round(4).tolist()}

    gn = False  # GN: EOG Nightfire credentials absent -> recorded as skipped
    gate_branch = branch(results["G1"]["pass"], results["G2"]["pass"], eligible, gn)
    C.write_derived("GATE_BRANCH", gate_branch, f"A5 gates on {season}: G1={results['G1']['pass']} G2={results['G2']['pass']} eligible={eligible} GN=skipped")

    gate_rows = [{"gate": "G0", "criterion": "Share of kiln clusters with ≥1 type=2 (STA) VIIRS detection, 2023", "value": round(g0_kiln, 4), "threshold": "informational"},
                 {"gate": "G0", "criterion": "Share of type=2 VIIRS detections linked to a kiln cluster, 2023", "value": round(float(g0_conv), 4), "threshold": "informational"}]
    for g in ("G1", "G2"):
        for r in results[g]["rows"]:
            gate_rows.append({"gate": g, **{k: (round(v, 5) if isinstance(v, float) else v) for k, v in r.items()}})
        gate_rows.append({"gate": g, "criterion": "All three criteria", "value": float(results[g]["pass"]), "threshold": "all hold", "pass": results[g]["pass"]})
    gate_rows.append({"gate": "G3", "criterion": "type distribution of kiln-linked detections", "value": 0.0, "threshold": json.dumps({str(k): v for k, v in g3.items()})[:300]})
    out = {"gate_rows": gate_rows, "profiles": profiles, "radius_sweep": sweep, "branch": gate_branch,
           "eligible_clusters": int(len(elig)), "night_ratio_G1": results["G1"]["night_ratio"],
           "dr_distribution": g1st[is_kiln].DR.describe().round(4).to_dict()}
    C.MODELS.mkdir(parents=True, exist_ok=True)
    (C.INTERIM / "gates.json").write_text(json.dumps(out, default=float, indent=1), encoding="utf-8")
    _write_report(out, results, season)
    return out


def _write_report(out, results, season):
    L = [f"# Gate report (A5) — gate season {season}", "",
         "Rules copied from PREREGISTRATION.md. Night figures are reported as ratios only.", "",
         "## G0 — STA prior screen (declared, non-gating)",
         "Mask vintage: FIRMS type=2 flag (derived from the Static Thermal Anomalies mask), calendar 2023.", ""]
    L += [f"- {r['criterion']}: **{r['value']}**" for r in out["gate_rows"] if r["gate"] == "G0"]
    for g in ("G1", "G2"):
        L += ["", f"## {g} — {'VIIRS S-NPP' if g == 'G1' else 'MODIS Terra+Aqua'}: **{'PASS' if results[g]['pass'] else 'FAIL'}**", "",
              "| Criterion | Value | Threshold | p |", "|---|---|---|---|"]
        L += [f"| {r['criterion']} | {r['value']:.4g} | {r['threshold']} | {r.get('p', '')} |" for r in results[g]["rows"]]
    L += ["", "## GN — VIIRS Nightfire: **skipped** (EOG credentials not configured)",
          "", f"Night-only kiln/control DR ratio (G1, reported not gating): {out['night_ratio_G1']:.3g}",
          f"Eligible clusters for site-level calendars (DR ≥ 0.10, ≥ 10 detection-days): {out['eligible_clusters']}",
          f"Per-cluster DR distribution: {out['dr_distribution']}", "",
          "## Radius sweep", "| radius m | kiln DR | control DR |", "|---|---|---|"]
    L += [f"| {s['radius_m']} | {s['kiln']:.4f} | {s['ctrl']:.4f} |" for s in out["radius_sweep"]]
    L += ["", f"## Decision (§13): `GATE_BRANCH = {out['branch']}`"]
    (C.REPORTS / "gate_report.md").write_text("\n".join(L) + "\n", encoding="utf-8")
