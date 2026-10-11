import numpy as np
import pandas as pd

from kilnwatch.metrics import conversion_weights, era_clear_frac, era_sensor, flags, harvest_key, normals


def test_era_switches_on_published_dates():
    # Aqua anchors the record until season 2012-13; S-NPP delivery ends 2 Nov 2026 (NASA Earthdata data alert)
    d = pd.Series(pd.to_datetime(["2012-06-30", "2012-07-01", "2026-11-01", "2026-11-02"]))
    assert era_sensor(d).tolist() == ["A", "N", "N", "J1"]


def test_noaa20_days_keep_a_denominator():
    idx = pd.DatetimeIndex(["2012-06-30", "2012-07-01", "2026-11-01", "2026-11-02", "2026-11-03"])
    cf = pd.DataFrame({"A": [0.9, 0.8, 0.7, 0.6, 0.5], "N": [0.1, 0.2, 0.3, np.nan, np.nan],
                       "J1": [np.nan, np.nan, np.nan, np.nan, 0.44]}, index=idx)
    clim_n = pd.Series({306: 0.55, 307: 0.66})  # day of year of 2 and 3 Nov 2026
    out = era_clear_frac(idx, cf, clim_n)
    # Aqua, then S-NPP, then NOAA-20: climatology where NOAA-20 has no cached fraction, its own value where it does
    assert out.tolist() == [0.9, 0.2, 0.3, 0.55, 0.44]


def test_no_noaa20_column_falls_back_to_climatology():
    idx = pd.DatetimeIndex(["2026-11-02"])
    out = era_clear_frac(idx, pd.DataFrame({"N": [np.nan]}, index=idx), pd.Series({306: 0.5}))
    assert out.tolist() == [0.5]


def test_normals_quantiles_are_linear_interpolation():
    # one day-of-season seen in two reference seasons: values {1, 3} -> p10/p50/p90 = 1.2 / 2.0 / 2.8 (linear)
    s = pd.Series([1.0, 3.0], index=pd.to_datetime(["2018-11-01", "2020-11-01"]))  # both season day 123
    n = normals(s)
    assert n.loc[123].tolist() == [1.2, 2.0, 2.8]
    assert np.isnan(n.loc[300]).all()  # no observation within +-7 days of season day 300


def test_normals_reference_window_excludes_other_seasons():
    s = pd.Series([1.0, 9.0], index=pd.to_datetime(["2018-11-01", "2020-11-01"]))
    n = normals(s, ref=("2018-19", "2018-19"))
    assert n.loc[123].tolist() == [1.0, 1.0, 1.0]  # the 2020-19 value never enters this normal


def _flat_normal(p90=1.0, p50=None):
    n = pd.DataFrame({"p10": np.zeros(366), "p50": p50 if p50 is not None else np.zeros(366), "p90": np.full(366, p90)})
    return n


def test_flags_mark_exactly_the_days_above_p90():
    dates = pd.to_datetime(["2018-11-01", "2018-11-02", "2018-11-03"])
    s = pd.Series([2.0, 0.5, 2.0], index=dates)  # above, below, above a flat p90 of 1.0
    unusual, _ = flags(s, _flat_normal(p90=1.0))
    day = lambda d: (pd.Timestamp(d) - pd.Timestamp("2003-01-01")).days  # noqa: E731
    assert unusual == [day("2018-11-01"), day("2018-11-03")]


def test_flags_never_mark_a_zero_fire_day():
    # p90 below zero would make 0 "above normal"; a fire-free day is never unusual
    s = pd.Series([0.0], index=pd.to_datetime(["2018-11-01"]))
    unusual, _ = flags(s, _flat_normal(p90=-1.0))
    assert unusual == []


def test_flags_critical_windows_are_long_top_quartile_runs():
    # p50 = 10 on season days 100..202 and 300..304, baseline 1 elsewhere: the 75th percentile is 10,
    # so both runs are hot, but only the >= 7 day run counts as critical
    p50 = np.ones(366)
    p50[100:203] = 10.0
    p50[300:305] = 10.0
    s = pd.Series([1.0], index=pd.to_datetime(["2018-11-01"]))  # unused by the critical branch
    _, crit = flags(s, _flat_normal(p90=1.0, p50=p50))
    assert crit == [(100, 202)]


def test_conversion_weights_follow_the_sensor_eras():
    betas = pd.DataFrame([
        {"step": "A<-N", "division": "D", "month": 11, "pass": "D", "loc": "other", "beta": 0.25},
        {"step": "N<-J1", "division": "D", "month": 11, "pass": "D", "loc": "other", "beta": 2.0},
    ])
    cd = pd.DataFrame({
        "sensor": ["A", "A", "N", "N", "J1", "J1"],
        "date_local": pd.to_datetime(["2010-11-01", "2013-11-01", "2010-11-01", "2013-11-01", "2026-11-01", "2026-12-01"]),
        "division": "D", "month": 11, "pass": "D", "loc": "other",
    })
    w = conversion_weights(cd, betas)
    assert w[0] == 1.0  # Aqua before S-NPP joined: the anchor
    assert np.isnan(w[1])  # Aqua after the calibration window starts: not converted
    assert np.isnan(w[2])  # S-NPP before it joined: not converted
    assert w[3] == 0.25  # S-NPP after 1 Jul 2012: beta_1
    assert np.isnan(w[4])  # NOAA-20 before S-NPP ended: not converted
    assert w[5] == 0.5  # NOAA-20 after: chained beta_1 * beta_2 = 0.25 * 2.0


def test_harvest_key_splits_the_pre_registered_windows():
    d = pd.Series(pd.to_datetime(["2024-04-01", "2024-05-31", "2024-11-01", "2024-12-31", "2024-01-15", "2024-03-31"]))
    # boro = Apr-May, aman = Nov-Dec; 31 Dec 2024 is doy 366 in a leap year and must still be aman
    assert harvest_key(d).tolist() == ["boro", "boro", "aman", "aman", "other", "other"]
