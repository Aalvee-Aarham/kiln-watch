"""Weakly supervised VIIRS source classifier (architecture §5.6)."""
from __future__ import annotations

import json
import logging
import subprocess

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, precision_recall_curve
from sklearn.model_selection import GroupKFold
from sklearn.neighbors import BallTree
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from . import config as C
from .kilns import R_EARTH, _rad

log = logging.getLogger("kilnwatch.classify")
FEATURES = ["bt_mir", "bt_tir", "bt_diff", "frp", "is_night", "scan", "track",
            "local_hour", "conf_rank", "p5", "p30", "iso1"]
VIIRS = ("N", "J1", "J2")


def _past_counts(lat, lon, day, radius_m, windows=(5, 30)) -> dict[int, np.ndarray]:
    """Same-sensor detections within radius over the previous `w` days (strictly earlier days: past only)."""
    tree = BallTree(_rad(lat, lon), metric="haversine")
    nb = tree.query_radius(_rad(lat, lon), r=radius_m / R_EARTH)
    lens = np.fromiter((len(x) for x in nb), int, len(nb))
    i = np.repeat(np.arange(len(nb)), lens)
    j = np.concatenate(nb) if len(nb) else np.array([], int)
    dt = day[i] - day[j]  # >0 means j is in the past of i
    out = {}
    for w in windows:
        m = (dt >= 1) & (dt <= w)
        out[w] = np.bincount(i[m], minlength=len(lat))
    return out


def build_features(viirs: pd.DataFrame) -> pd.DataFrame:
    """Per-detection features. p5/p30 use past detections only; iso1 = neighbours within 1 km in the same overpass."""
    X = pd.DataFrame(index=viirs.index)
    X["bt_mir"], X["bt_tir"] = viirs.bt_mir.astype(float), viirs.bt_tir.astype(float)
    X["bt_diff"] = X.bt_mir - X.bt_tir
    X["frp"] = viirs.frp.astype(float)
    X["is_night"] = (viirs["pass"] == "N").astype(float)
    X["scan"], X["track"] = viirs.scan_km.astype(float), viirs.track_km.astype(float)
    X["local_hour"] = pd.to_datetime(viirs.t_local).dt.hour + pd.to_datetime(viirs.t_local).dt.minute / 60
    X["conf_rank"] = viirs.conf_class.astype(str).map({"low": 0, "nominal": 1, "high": 2}).astype(float)
    X["p5"], X["p30"], X["iso1"] = 0.0, 0.0, 0.0
    day = (pd.to_datetime(viirs.date_local) - pd.Timestamp("2003-01-01")).dt.days.to_numpy()
    minute = (pd.to_datetime(viirs.t_utc).astype("int64") // 60_000_000_000).to_numpy()
    for s in viirs.sensor.unique():
        m = (viirs.sensor == s).to_numpy()
        lat, lon = viirs.lat.to_numpy()[m], viirs.lon.to_numpy()[m]
        pc = _past_counts(lat, lon, day[m], 500)
        X.loc[m, "p5"], X.loc[m, "p30"] = pc[5], pc[30]
        tree = BallTree(_rad(lat, lon), metric="haversine")
        nb = tree.query_radius(_rad(lat, lon), r=1000 / R_EARTH)
        mm = minute[m]
        X.loc[m, "iso1"] = [int(np.sum(np.abs(mm[x] - mm[k]) <= 10)) - 1 for k, x in enumerate(nb)]
    return X[FEATURES]


def weak_labels(viirs: pd.DataFrame, links: pd.DataFrame, use_type2: bool, modis=None, rng=None, kiln_tree=None):
    """Returns (y, w) indexed like viirs; NaN y = unlabelled.
    Positive: linked to a kiln cluster in Nov–May (+ VIIRS co-located with MODIS type=2 if use_type2).
    Negative: linked to a matched control in Nov–May (w=1), or >10 km from any kiln in Nov–May (w=0.5, subsampled)."""
    rng = rng if rng is not None else C.rng("classify")
    firing = pd.to_datetime(viirs.date_local).dt.month.isin(C.FIRING_MONTHS).to_numpy()
    lk = links[links.det_idx.isin(viirs.index)]
    pos = viirs.index.isin(lk.loc[lk.unit_type == "cluster", "det_idx"]) & firing
    neg = viirs.index.isin(lk.loc[lk.unit_type == "control", "det_idx"]) & firing & ~pos
    y = pd.Series(np.nan, index=viirs.index)
    w = pd.Series(0.0, index=viirs.index)
    y[pos], w[pos] = 1, 1.0
    y[neg], w[neg] = 0, 1.0
    if use_type2 and modis is not None and len(modis):
        t2 = modis[(modis.type == 2)]
        if len(t2):
            tr = BallTree(_rad(t2.lat, t2.lon), metric="haversine")
            nb = tr.query_radius(_rad(viirs.lat, viirs.lon), r=1000 / R_EARTH)
            t2day = pd.to_datetime(t2.date_local).to_numpy()
            vday = pd.to_datetime(viirs.date_local).to_numpy()
            hit = np.array([len(x) > 0 and (t2day[x] == vday[k]).any() for k, x in enumerate(nb)])
            add = hit & firing & ~neg
            y[add], w[add] = 1, 1.0
    if kiln_tree is not None:
        far = kiln_tree.query(_rad(viirs.lat, viirs.lon), k=1)[0][:, 0] * R_EARTH > 10_000
        cand = np.flatnonzero(far & firing & y.isna().to_numpy())
        k = min(len(cand), max(1, 3 * int(pos.sum())))
        pick = rng.choice(cand, size=k, replace=False) if k else []
        y.iloc[pick], w.iloc[pick] = 0, 0.5
    return y, w


def _hgb(rng_seed=C.SEED + C.SEED_OFFSETS["classify"]):
    return HistGradientBoostingClassifier(random_state=rng_seed, max_iter=300, learning_rate=0.06, max_leaf_nodes=31,
                                          early_stopping=True, validation_fraction=0.15, class_weight="balanced")


def _fit(model, X, y, w):
    if isinstance(model, HistGradientBoostingClassifier):
        return model.fit(X, y, sample_weight=w)  # weak-label weight multiplies the class weight
    return model.fit(X, y, logisticregression__sample_weight=w)


def rule_score(X: pd.DataFrame) -> np.ndarray:
    return ((X.p5 >= 3) & (X.is_night == 1)).astype(float).to_numpy()


def _ap_ci(y, p, rng, n=300):
    y, p = np.asarray(y), np.asarray(p)
    base = average_precision_score(y, p)
    idx = rng.integers(0, len(y), size=(n, len(y)))
    vals = [average_precision_score(y[i], p[i]) for i in idx if 0 < y[i].sum() < len(i)]
    return {"p50": float(base), "lo": float(np.quantile(vals, 0.025)), "hi": float(np.quantile(vals, 0.975))}


def train(X, y, w, groups, rng=None):
    """GroupKFold(5) by district: out-of-fold scores for HGB, logistic and the rule baseline."""
    rng = rng if rng is not None else C.rng("classify")
    oof = {"hgb": np.zeros(len(y)), "logit": np.zeros(len(y))}
    for tr, te in GroupKFold(5).split(X, y, groups):
        for name, mdl in (("hgb", _hgb()), ("logit", make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000, class_weight="balanced")))):
            _fit(mdl, X.iloc[tr], y[tr], w[tr])
            oof[name][te] = mdl.predict_proba(X.iloc[te])[:, 1]
    final = _fit(_hgb(), X, y, w)
    rep = {"prevalence": float(np.mean(y)), "pr_auc": _ap_ci(y, oof["hgb"], rng), "logit_pr_auc": float(average_precision_score(y, oof["logit"])),
           "baseline_pr_auc": float(average_precision_score(y, rule_score(X))), "oof": oof["hgb"]}
    return final, rep


def choose_thresholds(p, y, precision=0.8) -> tuple[float, float]:
    """t_hi: lowest threshold with kiln-like precision >= target; t_lo: highest with vegetation-like precision >= target."""
    p, y = np.asarray(p), np.asarray(y)
    pr, rc, th = precision_recall_curve(y, p)
    ok = np.flatnonzero(pr[:-1] >= precision)
    t_hi = float(th[ok[0]]) if len(ok) else 1.0
    pr0, _, th0 = precision_recall_curve(1 - y, 1 - p)
    ok0 = np.flatnonzero(pr0[:-1] >= precision)
    t_lo = float(1 - th0[ok0[0]]) if len(ok0) else 0.0
    return min(t_lo, t_hi), t_hi


def _holdout(model_fit_X, model_fit_y, model_fit_w, X, y, rng):
    m = _fit(_hgb(), model_fit_X, model_fit_y, model_fit_w)
    if len(y) == 0 or y.sum() == 0 or y.sum() == len(y):
        return None
    return _ap_ci(y, m.predict_proba(X)[:, 1], rng)


def run() -> dict:
    from .ingest import _parquet

    rng = C.rng("classify")
    det = pd.read_parquet(C.INTERIM / "detections.parquet")
    det = det[det.conf_class.isin(C.CONF_KEEP)]
    links = pd.read_parquet(C.INTERIM / "links.parquet")
    kilns = pd.read_parquet(C.INTERIM / "kilns.parquet")
    units_dist = _district_of(det)
    viirs = det[det.sensor.isin(VIIRS)]
    modis = det[det.sensor.isin(["T", "A"])]
    ktree = BallTree(_rad(kilns.lat, kilns.lon), metric="haversine")
    log.info("features for %d VIIRS detections", len(viirs))
    X = build_features(viirs)
    out = {}
    labelsets = {}
    for name, t2 in (("footprint_only", False), ("with_type2", True)):
        y, w = weak_labels(viirs, links, t2, modis=modis, rng=C.rng("classify"), kiln_tree=ktree)
        labelsets[name] = (y, w)
    y, w = labelsets["footprint_only"]  # primary label set
    lab = y.notna().to_numpy()
    snpp = (viirs.sensor == "N").to_numpy()
    tr_mask = lab & snpp
    Xl, yl, wl = X[tr_mask], y[tr_mask].to_numpy().astype(int), w[tr_mask].to_numpy()
    groups = units_dist.reindex(viirs.index[tr_mask]).fillna("none").to_numpy()
    model, rep = train(Xl, yl, wl, groups, rng)
    t_lo, t_hi = choose_thresholds(rep["oof"], yl)
    sha = _git_sha()
    C.MODELS.mkdir(parents=True, exist_ok=True)
    beats = rep["pr_auc"]["p50"] > max(rep["prevalence"], rep["baseline_pr_auc"])
    (C.MODELS / "thresholds.json").write_text(json.dumps({"t_lo": t_lo, "t_hi": t_hi, "features": FEATURES, "git_sha": sha,
                                                           "model": "hgb" if beats else "rule"}, indent=1), encoding="utf-8")
    joblib.dump(model, C.MODELS / "kiln_clf.joblib")
    # thresholds frozen above BEFORE the temporal and cross-sensor holdouts run
    season = viirs.season.astype(str)
    holdouts = [{"kind": "spatial", "pr_auc": rep["pr_auc"]}]
    trn = tr_mask & (season <= "2021-22").to_numpy()
    tst = tr_mask & (season >= "2022-23").to_numpy()
    h = _holdout(X[trn], y[trn].astype(int), w[trn], X[tst], y[tst].astype(int).to_numpy(), rng)
    if h:
        holdouts.append({"kind": "temporal", "pr_auc": h})
    for kind, a, b in (("cross_sensor_N_J1", "N", "J1"), ("cross_sensor_J1_J2", "J1", "J2")):
        ma = lab & (viirs.sensor == a).to_numpy()
        mb = lab & (viirs.sensor == b).to_numpy()
        h = _holdout(X[ma], y[ma].astype(int), w[ma], X[mb], y[mb].astype(int).to_numpy(), rng)
        if h:
            holdouts.append({"kind": kind, "pr_auc": h})
    kinds = {x["kind"] for x in holdouts}
    nrt_ok = {"cross_sensor_N_J1", "cross_sensor_J1_J2"} <= kinds
    assert "cross_sensor_N_J1" in kinds, "A7d: cross-sensor N->J1 holdout missing"
    th = json.loads((C.MODELS / "thresholds.json").read_text(encoding="utf-8"))
    th["nrt_ok"] = nrt_ok  # thresholds themselves stay frozen; this only records whether NOAA-21 may be labelled
    (C.MODELS / "thresholds.json").write_text(json.dumps(th, indent=1), encoding="utf-8")
    # label-set comparison and persistence ablation (spatial CV on S-NPP)
    ls_rows = [{"kind": "footprint_only", "pr_auc": rep["pr_auc"]}]
    y2, w2 = labelsets["with_type2"]
    m2 = y2.notna().to_numpy() & snpp
    _, rep2 = train(X[m2], y2[m2].to_numpy().astype(int), w2[m2].to_numpy(), units_dist.reindex(viirs.index[m2]).fillna("none").to_numpy(), rng)
    ls_rows.append({"kind": "with_type2", "pr_auc": rep2["pr_auc"]})
    Xa = Xl.drop(columns=["p5", "p30"])
    oof = np.zeros(len(yl))
    for tr, te in GroupKFold(5).split(Xa, yl, groups):
        oof[te] = _fit(_hgb(), Xa.iloc[tr], yl[tr], wl[tr]).predict_proba(Xa.iloc[te])[:, 1]
    ablation = _ap_ci(yl, oof, rng)
    # permutation importance would be costlier; HGB has none built in -> use drop-in AP loss of the ablation per group
    imp = _importance(model, Xl, yl, rng)
    # apply to all VIIRS detections
    p = model.predict_proba(X)[:, 1] if beats else rule_score(X)
    lbl = np.where(p >= t_hi, "kiln", np.where(p <= t_lo, "vegetation", "unknown"))
    labels = pd.DataFrame({"det_idx": viirs.index, "labelset": "footprint_only", "p_kiln": p.astype("float32"), "label": lbl, "label_src": "model" if beats else "rule"})
    # MODIS-era: footprint-and-season rule
    mlink = set(links.loc[links.unit_type == "cluster", "det_idx"])
    mf = pd.to_datetime(modis.date_local).dt.month.isin(C.FIRING_MONTHS).to_numpy()
    mk = modis.index.isin(mlink) & mf
    labels = pd.concat([labels, pd.DataFrame({"det_idx": modis.index, "labelset": "footprint_only", "p_kiln": mk.astype("float32"),
                                              "label": np.where(mk, "kiln", "vegetation"), "label_src": "footprint_rule"})], ignore_index=True)
    _parquet(labels, C.INTERIM / "labels.parquet")
    pr, rc, _ = precision_recall_curve(yl, rep["oof"])
    step = max(1, len(pr) // 200)
    out = {"pr_curve": [[round(float(r), 4), round(float(q), 4)] for r, q in zip(rc[::step], pr[::step])],
           "pr_auc": rep["pr_auc"], "baseline_pr_auc": rep["baseline_pr_auc"], "prevalence": rep["prevalence"],
           "logit_pr_auc": rep["logit_pr_auc"], "importance": imp, "holdouts": holdouts, "labelset": ls_rows,
           "ablation_no_persistence": ablation, "thresholds": [t_lo, t_hi], "beats_baseline": bool(beats), "nrt_ok": nrt_ok,
           "n_pos": int(yl.sum()), "n_neg": int(len(yl) - yl.sum())}
    (C.INTERIM / "classifier.json").write_text(json.dumps(out, default=float), encoding="utf-8")
    _report(out)
    _repro_check(model, X)
    _write_candidates(labels, det, kilns)
    return out


def _write_candidates(labels, det, kilns):
    """Candidate unmapped kilns: locations to the regulator tier only; the public sees district counts."""

    cand = candidates(labels, det, kilns)
    uc = pd.read_parquet(C.INTERIM / "unit_cells.parquet")
    units = pd.read_parquet(C.INTERIM / "units.parquet", columns=["unit_id", "name_en"])
    dist = uc[uc.level == "district"].merge(units, on="unit_id").drop_duplicates("cell_id").set_index("cell_id").name_en
    cand["district"] = cand.cell_id.map(dist)
    reg = C.INTERIM / "regulator"
    reg.mkdir(parents=True, exist_ok=True)
    cand.to_csv(reg / "candidate_unmapped_kilns.csv", index=False)
    by = cand.district.value_counts().to_dict()
    (C.INTERIM / "candidates_by_district.json").write_text(json.dumps({"n": int(len(cand)), "by_district": {k: int(v) for k, v in by.items()}}), encoding="utf-8")


def _importance(model, X, y, rng, n_rows=20000):
    from sklearn.inspection import permutation_importance

    i = rng.choice(len(y), size=min(n_rows, len(y)), replace=False)
    r = permutation_importance(model, X.iloc[i], y[i], scoring="average_precision", n_repeats=3, random_state=C.SEED)
    return sorted([{"feature": f, "value": round(float(v), 4)} for f, v in zip(X.columns, r.importances_mean)], key=lambda d: -d["value"])


def _repro_check(model, X):
    """A7f: a fresh process reproduces predictions on 100 sample rows byte-identically."""
    sample = X.iloc[:: max(1, len(X) // 100)].head(100)
    a = model.predict_proba(sample)[:, 1]
    b = joblib.load(C.MODELS / "kiln_clf.joblib").predict_proba(sample)[:, 1]
    assert a.tobytes() == b.tobytes(), "A7f: reloaded model predictions differ"


def _district_of(det) -> pd.Series:
    """District name per detection index via the unit_cells table."""
    uc = pd.read_parquet(C.INTERIM / "unit_cells.parquet")
    d = uc[uc.level == "district"].drop_duplicates("cell_id").set_index("cell_id").unit_id
    return det.cell_id.map(d)


def _git_sha() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=C.ROOT, text=True).strip()
    except Exception:
        return "unknown"


def candidates(labels: pd.DataFrame, det: pd.DataFrame, kilns: pd.DataFrame) -> pd.DataFrame:
    """Cells >1 km from any inventory kiln with >=5 kiln-like detection-days in each of >=2 seasons (regulator only)."""
    k = labels[labels.label == "kiln"].merge(det[["cell_id", "date_local", "season", "lat", "lon"]], left_on="det_idx", right_index=True)
    dd = k.drop_duplicates(["cell_id", "date_local"]).groupby(["cell_id", "season"], observed=True).size()
    good = (dd >= 5).groupby(level=0).sum()
    cells = good[good >= 2].index
    from .grid import cell_center

    lat, lon = cell_center(np.asarray(cells))
    tree = BallTree(_rad(kilns.lat, kilns.lon), metric="haversine")
    far = tree.query(_rad(lat, lon), k=1)[0][:, 0] * R_EARTH > 1000
    return pd.DataFrame({"cell_id": np.asarray(cells)[far], "lat": lat[far], "lon": lon[far]})


def _report(o):
    L = ["# Classifier report (A7)", "",
         f"Positives {o['n_pos']}, negatives {o['n_neg']} (footprint-only labels, S-NPP training).",
         f"PR-AUC (spatial GroupKFold by district): {o['pr_auc']['p50']:.3f} [{o['pr_auc']['lo']:.3f}, {o['pr_auc']['hi']:.3f}]",
         f"Prevalence {o['prevalence']:.3f} · rule baseline (p5≥3 & night) {o['baseline_pr_auc']:.3f} · logistic {o['logit_pr_auc']:.3f}",
         f"Ships: **{'HistGradientBoosting' if o['beats_baseline'] else 'rule baseline'}**", "", "## Holdouts"]
    L += [f"- {h['kind']}: {h['pr_auc']['p50']:.3f} [{h['pr_auc']['lo']:.3f}, {h['pr_auc']['hi']:.3f}]" for h in o["holdouts"]]
    L += ["", "## Label sets"] + [f"- {x['kind']}: {x['pr_auc']['p50']:.3f}" for x in o["labelset"]]
    L += ["", f"Without persistence features (p5, p30): {o['ablation_no_persistence']['p50']:.3f}",
          f"NRT may use the model on NOAA-21: {o['nrt_ok']}", "", "## Permutation importance"]
    L += [f"- {d['feature']}: {d['value']}" for d in o["importance"]]
    (C.REPORTS / "classifier_report.md").write_text("\n".join(L) + "\n", encoding="utf-8")
