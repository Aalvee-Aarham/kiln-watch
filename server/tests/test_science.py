"""Run: python -m pytest server/tests  (or: python server/tests/test_science.py)"""
import datetime as dt
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from kw import science as sc  # noqa: E402
from kw.regions import envelopes, validate_bbox  # noqa: E402


def test_iso_week_boundaries():
    assert sc.week_key(dt.date(2021, 1, 1)) == "2020-W53"   # belongs to the previous ISO year
    assert sc.week_key(dt.date(2015, 12, 31)) == "2015-W53"
    assert sc.week_key(dt.date(2019, 12, 30)) == "2020-W01"  # belongs to the next ISO year
    assert sc.period_bounds("2020-W53") == (dt.date(2020, 12, 28), dt.date(2021, 1, 3))
    assert sc.calendar_month("2020-W53") == 12               # Thursday 2020-12-31
    assert sc.calendar_month("2020-W01") == 1                # Thursday 2020-01-02


def test_leap_year_and_periods():
    assert sc.period_bounds("2024-02") == (dt.date(2024, 2, 1), dt.date(2024, 2, 29))
    assert sc.period_bounds("2023-02")[1] == dt.date(2023, 2, 28)
    ks = sc.periods(dt.date(2000, 11, 1), dt.date(2001, 2, 3))
    assert ks == ["2000-11", "2000-12", "2001-01", "2001-02"]
    wk = sc.periods(dt.date(2020, 12, 20), dt.date(2021, 1, 12), weekly=True)
    assert wk == ["2020-W51", "2020-W52", "2020-W53", "2021-W01", "2021-W02"]


def test_calibration_recovers_ratio_and_handles_zero():
    pairs = [(m, 30.0 * (1 + (i % 3)), 100.0 * (1 + (i % 3))) for i in range(60) for m in [i % 12 + 1]]
    fit = sc.ratio_calibration(pairs)
    assert abs(fit["pooled"] - 0.3) < 1e-9 and all(abs(b - 0.3) < 1e-9 for b in fit["beta"])
    assert fit["sigma2"] == 0.0025 and fit["tau2"] == 0.0  # perfect fit -> floor, no between-month spread
    zero = sc.ratio_calibration([(1, 0.0, 0.0)] * 5)
    assert zero["calibrated"] is False and zero["beta"] == [1.0] * 12


def test_shrinkage_pulls_sparse_month_to_pooled():
    pairs = [(1, 50.0, 100.0)] * 20 + [(2, 5.0, 2.0)]  # month 2 has a wild ratio from tiny counts
    fit = sc.ratio_calibration(pairs)
    assert abs(fit["beta"][1] - fit["pooled"]) < abs(2.5 - fit["pooled"])


def test_combine():
    assert sc.combine([]) is None
    y, var = sc.combine([(10.0, 0.0, 10.0)])
    assert y == 10.0 and abs(var - 10.0) < 1e-9
    y, _ = sc.combine([(10.0, 0.01, 10.0), (12.0, 0.01, 12.0)])
    assert 10.0 < y < 12.0
    y, _ = sc.combine([(0.0, 0.0, 1.0), (0.0, 0.05, 0.1)])  # all-zero cell stays zero, no division error
    assert y == 0.0


def test_versus_history_and_partial_exclusion():
    keys = [f"{y}-01" for y in range(2001, 2012)]
    vals = [10.0] * 10 + [40.0]
    h = sc.versus_history(vals, keys, [False] * 11)
    assert h["pct"][-1] == 100.0 and h["rank"][-1] == 1 and h["ratio"][-1] == 4.0 and h["n"][-1] == 11
    h2 = sc.versus_history(vals, keys, [False] * 10 + [True])
    assert h2["median"][0] == 10.0  # the partial period is scored but never part of anyone's baseline
    assert h2["rank"][-1] == 1


def test_mann_kendall_and_steps():
    seasons = [[(y, float(y + m)) for y in range(2001, 2021)] for m in range(12)]
    r = sc.seasonal_mann_kendall(seasons)
    assert r["tau"] == 1.0 and r["p"] < 1e-6 and r["sen_per_year"] == 1.0
    flat = [[(y, 5.0) for y in range(2001, 2011)] for _ in range(12)]
    assert sc.seasonal_mann_kendall(flat)["tau"] is None  # all ties: no trend is measurable
    keys = [f"{y}-{m:02d}" for y in range(2008, 2016) for m in range(1, 13)]
    seasonal = [10.0 + 5 * (int(k[5:]) in (7, 8, 9)) for k in keys]
    assert sc.step_ratio(keys, seasonal, [False] * len(keys), "2012-01") == 1.0
    jumped = [v * (5.5 if k > "2012-01" else 1) for k, v in zip(keys, seasonal)]
    assert sc.step_ratio(keys, jumped, [False] * len(keys), "2012-01") > 3


def test_quantile_map_is_safe():
    src, ref = [0.0, 1.0, 2.0], [10.0, 20.0, 30.0]
    assert sc.quantile_map(0.5, src, ref) == (15.0, True)
    assert sc.quantile_map(3.0, src, ref) == (31.0, False)  # flagged extrapolation
    for bad in ([], [1.0], [2.0, 1.0], [0.0, math.nan]):
        try:
            sc.quantile_map(0.5, bad, ref[: len(bad)] or [0.0])
            raise AssertionError("accepted malformed quantiles")
        except ValueError:
            pass
    try:
        sc.quantile_map(0.5, src, [1.0, 2.0])
        raise AssertionError("accepted mismatched lengths")
    except ValueError:
        pass
    assert sc.wasserstein2(ref, ref) == 0.0
    assert sc.quantiles([1, 2, 3, 4, 5], 3) == [1, 3, 5]


def test_metrics():
    m = sc.metrics([2.0, 4.0, 6.0], [1.0, 2.0, 3.0])
    assert m["bias_pct"] == 100.0 and m["spearman"] == 1.0
    assert sc.metrics([], [])["n"] == 0


def test_bbox_antimeridian():
    assert envelopes((170.0, -20.0, -170.0, -10.0)) == [(170.0, -20.0, 180.0, -10.0), (-180.0, -20.0, -170.0, -10.0)]
    assert validate_bbox([178, -20, -179, -16]) == (178.0, -20.0, -179.0, -16.0)  # 3° x 4° across 180
    for bad in ([0, 0, 0], [0, 10, 1, 5], [0, 0, 50, 50], [0, 0, 0, 1]):
        try:
            validate_bbox(bad)
            raise AssertionError(f"accepted {bad}")
        except ValueError:
            pass


def test_warning_level_thresholds():
    assert sc.warning_level(95, None, 500, 20) == "elevated"
    assert sc.warning_level(80, 10, 500, 20) == "watch" and sc.warning_level(50, 92, 500, 20) == "watch"
    assert sc.warning_level(50, 50, 500, 20) == "normal" and sc.warning_level(5, 50, 500, 20) == "quiet"
    assert sc.warning_level(99, 99, 50, 20) == "insufficient"      # sparse area is never alarmed
    assert sc.warning_level(99, 99, 500, 9) == "insufficient"      # too few earlier years
    assert sc.warning_level(95, 95, 500, 20, month_scale=0.3) == "insufficient"  # near-zero off-season is no alarm
    assert sc.warning_level(95, 95, 500, 20, month_scale=40) == "elevated"
    assert sc.percentile_rank(5, [1, 5, 9, 5]) == 50.0 and sc.percentile_rank(5, []) is None


def test_recency_weighted_history():
    xs, eq = [1, 2, 3, 4, 5], [1] * 5
    assert sc.weighted_median(xs, eq) == 3 and sc.weighted_percentile_rank(3, xs, eq) == sc.percentile_rank(3, xs)
    w = sc.recency_weights([2016, 2026], 2026)
    assert w[1] == 1 and abs(w[0] - 0.5) < 1e-12                       # 10-year half-life
    # warming record: old Mays ~10 hotspots, recent Mays ~100. A May of 60 is extreme vs all years, ordinary vs recent ones
    keys = [f"{y}-05" for y in range(2003, 2027)]
    vals = [10.0] * 14 + [100.0] * 9 + [60.0]
    h = sc.versus_history(vals, keys, [False] * len(keys))
    assert h["median"][-1] == 10 and h["wmedian"][-1] == 100
    assert h["wpct"][-1] < h["pct"][-1]
    assert set(h) >= {"wmedian", "wratio", "wpct"} and len(h["wpct"]) == len(keys)


def test_match_months_verdict():
    from kw.news import match_months
    months = [{"period": "2023-05", "percentile": 98}, {"period": "2023-06", "percentile": 95},
              {"period": "2023-07", "percentile": 40}, {"period": "2023-08", "percentile": 30}]
    items = {"2023-05": 3, "2023-07": 1}
    rows, v = match_months(months, items)
    assert [r["verdict"] for r in rows] == ["corroborated", "satellite_only", "reported_typical"]  # quiet Aug dropped
    assert v["unusual_months"] == 2 and v["corroborated"] == 1 and v["tone"] == "confirmed"
    assert match_months(months, {})[1]["tone"] == "unverified"          # anomalies, no reports: never "proven"
    assert match_months(months[2:], {})[1]["tone"] == "neutral"
    rows, _ = match_months([{"period": "2024-05", "percentile": 80, "recent_percentile": 93}], {})
    assert rows[0]["verdict"] == "satellite_only" and rows[0]["unusual_vs"] == ["recent years"]


def test_article_fire_check():
    from kw.news import article_fire_check
    weekly = {"periods": ["2023-W19", "2023-W20", "2023-W21"],
              "classes": {"veg": {"hotspots": {"v": [5.0, 300.0, 4.0]},
                                  "history": {"pct": [40.0, 97.0, 30.0], "wpct": [35.0, 95.0, 20.0]}}}}
    items = [{"date": "2023-05-22"},                       # W21; the week before (W20) was extreme -> unusual
             {"date": "2023-05-10"},                       # W19 typical, W18 not in record -> typical
             {"date": "2023-05-23", "relevant": False},    # not about a wildfire: annotated, not counted
             {"date": "1999-01-01"}, {"date": ""}]         # outside the record / undated
    checked, unusual = article_fire_check(items, weekly)
    assert (checked, unusual) == (2, 1)
    assert items[0]["fire"]["period"] == "2023-W20" and items[0]["fire"]["unusual"]
    assert items[1]["fire"]["unusual"] is False and items[3]["fire"] is None and items[4]["fire"] is None
    winter = {"periods": ["2023-W51"], "classes": {"veg": {"hotspots": {"v": [2.0]}, "history": {"pct": [96.0], "wpct": [97.0]}}}}
    it = [{"date": "2023-12-20"}]
    assert article_fire_check(it, winter) == (1, 0) and it[0]["fire"]["too_few"]   # 2 hotspots is never "unusual"
    from kw.news import match_months
    assert match_months([{"period": "2023-12", "value": 1.0, "percentile": 99}], {})[0] == []


def test_outlook_cell():
    from kw.science import outlook_cell
    hist = [0] * 10 + [20] * 10                                  # half the years quiet, half busy next month
    assert outlook_cell(hist, [2] * 20, 2)[0] == "season"        # busy season ahead, today typical
    assert outlook_cell(hist, [2] * 20, 40)[0] == "watch"        # ...and today far above normal
    assert outlook_cell([0] * 20, [2] * 20, 40)[0] == "above"    # off-season burst
    assert outlook_cell([0] * 20, [0] * 19 + [1], 3)[0] is None  # 3 hotspots never count as unusual
    assert outlook_cell([30] * 20, [3] * 20, 3)[4] is True       # usual next 30 days 10x the last 30: rising
    assert outlook_cell([], [], 0)[0] is None


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
