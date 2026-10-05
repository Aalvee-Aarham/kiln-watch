import numpy as np
import pandas as pd

from kilnwatch.harmonize import (STRATUM, fit_glm, fit_ratio, loso, loso_summary, pool_key, seam_stat)

SEASONS = [f"{y}-{(y + 1) % 100:02d}" for y in range(2012, 2021)]


def synth_pairs(beta=0.25, n_div=2, seed=0, clear=20_000, lam_new=8.0):
    """Pairs with Aqua count ~ Poisson(beta × S-NPP rate × clear/1000): a known closed-form truth."""
    rng = np.random.default_rng(seed)
    rows = []
    for s in SEASONS:
        y = int(s[:4])
        for d in pd.date_range(f"{y}-11-01", f"{y + 1}-04-30", freq="3D"):
            for div in [f"D{i}" for i in range(n_div)]:
                for pss in ("D", "N"):
                    for loc in ("kiln", "other"):
                        a_new = rng.gamma(4, lam_new / 4)
                        cnt_new = a_new * clear / 1000
                        cnt_ref = rng.poisson(beta * a_new * clear / 1000)
                        rows.append((div, d.month, pss, loc, d, s, 1000 * cnt_ref / clear, a_new, cnt_new, cnt_ref, clear, clear))
    return pd.DataFrame(rows, columns=STRATUM + ["date_local", "season", "a_ref", "a_new", "celldays_new", "fire_cells_ref", "clear_cells_ref", "clear_cells_new"])


def test_fit_ratio():
    b = fit_ratio(synth_pairs())
    assert abs(np.average(b.beta, weights=b.n_celldays) - 0.25) < 0.02
    assert (b.rung_used == 0).all()


def test_sufficiency():
    def one(n_cd, n_days):
        p = pd.DataFrame({"division": "D0", "month": 1, "pass": "D", "loc": "kiln", "season": "2015-16",
                          "date_local": pd.date_range("2016-01-01", periods=n_days), "a_ref": 1.0, "a_new": 4.0,
                          "celldays_new": n_cd / n_days})
        return int(fit_ratio(p).rung_used.iloc[0])
    assert one(99, 10) != 0          # 99 cell-days escalates (and finds nothing better: -1)
    assert one(100, 10) == 0         # 100 cell-days and 10 paired days does not


def test_pooling_ladder():
    p = synth_pairs()
    empty = pd.DataFrame({"division": ["DX", "DX"], "month": [1, 1], "pass": ["D", "N"], "loc": ["kiln", "kiln"]})
    b = fit_ratio(p, empty)
    assert b.rung_used.iloc[0] == 3 and b.rung_used.iloc[1] == 3   # unseen division pools nationally
    assert pool_key(("D0", 1, "N", "kiln"), 5) is None
    assert pool_key(("D0", 1, "D", "kiln"), 5) == ("national", "all", "all")
    # night stratum with too little data everywhere stays nodata instead of pooling across day/night
    tiny = p[(p["pass"] == "D")].copy()
    b2 = fit_ratio(tiny, pd.DataFrame({"division": ["D0"], "month": [1], "pass": ["N"], "loc": ["kiln"]}))
    assert np.isnan(b2.beta.iloc[0]) and b2.rung_used.iloc[0] == -1


def test_glm_alpha():
    p = synth_pairs(seed=1)
    m = fit_glm(p)
    assert m.alpha == 0
    coef = dict(zip(m.feature_names_, m.coef_))
    # rate_ref = 0.25 * a_new; a log-link fit on log1p(a_new) recovers a slope near 1 on the log scale
    assert abs(coef["log_new"] - 1.0) < 0.15
    pred = m.predict(np.c_[np.log1p([8.0]), np.zeros((1, len(m.feature_names_) - 1))])
    assert pred[0] > 0


def test_seam_statistic():
    seasons = [f"{y}-{(y + 1) % 100:02d}" for y in range(2003, 2025)]
    rng = np.random.default_rng(3)
    base = 10 + rng.normal(0, 0.3, len(seasons))
    post = np.array([int(s[:4]) >= 2012 for s in seasons])
    raw = pd.Series(np.where(post, base * 4.0, base), index=seasons)     # injected step: S-NPP sees 4x
    harm = pd.Series(np.where(post, raw * 0.25, raw), index=seasons)     # apply the true beta
    r = seam_stat(raw, harm)
    true_d = abs(raw[["2012-13", "2013-14"]].mean() - raw[["2009-10", "2010-11"]].mean())
    assert abs(r["d_raw"] - true_d) / true_d < 0.02
    assert r["d_harm"] < 0.25 * r["d_raw"]
    assert r["chow_p_raw"] < 0.01 and r["chow_p_harm"] > 0.05


def test_loso_mechanics():
    p = synth_pairs(seed=4)
    res = loso(p, "M0", n_draws=200, rng=np.random.default_rng(5))
    by, pooled = loso_summary(res)
    assert len(by) == len(SEASONS)
    assert 0.90 <= pooled["covered"]["p50"] <= 0.97


def test_fold_integrity():
    """No leave-one-season-out fold boundary falls inside a firing season (Nov–May)."""
    p = synth_pairs()
    for s in SEASONS:
        held = p[p.season == s].date_local
        firing = p[(p.date_local >= f"{s[:4]}-11-01") & (p.date_local <= f"{int(s[:4]) + 1}-05-31")]
        assert set(firing.date_local) <= set(held)
