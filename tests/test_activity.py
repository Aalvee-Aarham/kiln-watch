import numpy as np
import pandas as pd

from kilnwatch.activity import amplitude, area_excess, confirm, excess, placebo_sites, season_metrics, season_of


def _sites(n):
    rows = []
    for c in range(n):
        rows.append({"site": f"k{c}", "cluster_id": c, "kind": "kiln"})
        rows += [{"site": f"c{c}_{j}", "cluster_id": c, "kind": "control"} for j in range(3)]
    return pd.DataFrame(rows)


def test_excess_is_kiln_minus_mean_of_valid_controls():
    s = _sites(2)
    t = pd.Timestamp("2022-01-01")
    p = pd.DataFrame({"site": ["k0", "c0_0", "c0_1", "c0_2", "k1", "c1_0"], "period": t, "x": [5.0, 1.0, 2.0, 3.0, 9.0, 1.0]})
    e = excess(p, s)
    assert e.cluster_id.tolist() == [0]          # cluster 1 has one valid control (< 2) -> dropped
    assert e.e.iloc[0] == 5.0 - 2.0


def test_amplitude_core_minus_off_and_minimums():
    per = _half_months("2022-07-01", "2023-06-01")
    core = np.isin(per.month, (12, 1, 2, 3, 4))
    e = pd.DataFrame({"cluster_id": 0, "period": per, "e": np.where(core, 1.5, 0.5)})
    a = amplitude(e)
    assert a.season.tolist() == ["2022-23"] and abs(a.A.iloc[0] - 1.0) < 1e-12
    thin = e[~np.isin(e.period.dt.month, (8, 9, 10))].iloc[:3]            # one Jul period only -> no amplitude
    assert amplitude(thin).empty


def test_placebo_replaces_kiln_by_first_control():
    p = placebo_sites(_sites(3))
    assert (p.kind == "kiln").sum() == 3 and not p.site.str.startswith("k").any()
    assert set(p[p.kind == "kiln"].site) == {"c0_0", "c1_0", "c2_0"}


def _half_months(first, last):
    """Period starts on the 1st and 16th, as activity._periods builds them."""
    return pd.DatetimeIndex([d + pd.Timedelta(days=k) for d in pd.date_range(first, last, freq="MS") for k in (0, 15)])


def test_season_metrics_boxcar():
    per = _half_months("2018-07-01", "2019-06-01")
    doy = np.asarray((per - pd.Timestamp("2018-07-01")).days)
    on = (per >= "2018-12-01") & (per < "2019-05-01")
    m = season_metrics(on.astype(float), doy)
    # a 3-period running mean turns each edge into 1/3 (outside) and 2/3 (inside): the 50% threshold keeps the box
    assert m["onset"][0] == (pd.Timestamp("2018-12-01") - pd.Timestamp("2018-07-01")).days
    assert m["end"][0] == (pd.Timestamp("2019-04-16") - pd.Timestamp("2018-07-01")).days
    assert m["duration"][0] == m["end"][0] - m["onset"][0]
    assert np.isnan(season_metrics(np.zeros(len(per)), doy)["onset"][0])   # no positive peak -> undefined


def test_area_excess_zero_offseason_median():
    per = _half_months("2020-07-01", "2021-06-01")
    rng = np.random.default_rng(0)
    M = rng.normal(3.0, 1.0, size=(25, len(per)))
    E = area_excess(M, per)[0]
    off = np.isin(per.month, (7, 8, 9, 10))
    assert abs(np.median(E[off])) < 1e-12


def test_confirm_respects_holdout_and_rules():
    rng = np.random.default_rng(1)
    seasons = [f"{y}-{(y + 1) % 100:02d}" for y in range(2012, 2025)]
    A = pd.DataFrame([{"cluster_id": c, "season": s, "A": rng.normal(0.4, 0.5)} for c in range(300) for s in seasons])
    null = pd.DataFrame([{"cluster_id": c, "season": s, "A": rng.normal(0.0, 0.5)} for c in range(300) for s in seasons])
    ok = confirm(A, null, exclude=set(), seasons=("2012-13", "2024-25"))
    assert ok["pass"]
    bad = confirm(null, null, exclude=set(), seasons=("2012-13", "2024-25"))
    assert not bad["pass"]
    # held-out rule: a huge signal confined to excluded (pilot) clusters must not pass
    pilot = A.assign(A=np.where(A.cluster_id < 100, 50.0, -0.3))
    assert not confirm(pilot, null, exclude=set(range(100)), seasons=("2012-13", "2024-25"))["pass"]


def test_season_label():
    t = pd.Series(pd.to_datetime(["2019-06-30", "2019-07-01", "2020-01-15"]))
    assert season_of(t).tolist() == ["2018-19", "2019-20", "2019-20"]
