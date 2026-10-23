import math

import numpy as np
import pandas as pd

from kilnwatch.gates import P_stat, S_stat, _ratio, branch, evaluate


def test_ratio_distinguishes_unmeasured_from_measured_zero():
    assert _ratio(0.9, 0.3) == 3.0
    assert _ratio(0.5, 0.0) == math.inf  # controls measured, saw nothing: real evidence of contrast
    assert math.isnan(_ratio(0.0, 0.0))  # both sides zero: no information either way
    assert math.isnan(_ratio(0.5, math.nan))  # unmeasured denominator is unknown, never inf


def _frame(s_k, p_k, dr_k, m_k, dr_c):
    n_c = len(dr_c)
    return pd.DataFrame({
        "S": s_k + [np.nan] * n_c, "P": p_k + [np.nan] * n_c,
        "DR": dr_k + dr_c, "DR_night": dr_k + dr_c, "M": m_k + [np.nan] * n_c,
    })


def test_evaluate_no_vacuous_pass_when_controls_unmeasured():
    # a partial cache can leave every control DR/S/P/M NaN; the criteria must be False, not inf-passed
    st = _frame(s_k=[0.8, 0.7], p_k=[0.9, 0.8], dr_k=[0.5, 0.4], m_k=[np.nan, np.nan], dr_c=[np.nan, np.nan])
    r = evaluate(st, np.array([True, True, False, False]), np.array(["d"] * 4), np.random.default_rng(7))
    assert not (r["shape"] or r["contrast"] or r["seasonality"] or r["pass"])
    s_r, _p_r, dr_r, seas_r = (row["value"] for row in r["rows"])  # rows: S ratio, P value, DR ratio, seasonality
    assert math.isnan(s_r) and math.isnan(dr_r) and math.isnan(seas_r)


def test_evaluate_seasonality_uses_measured_ratios():
    st = _frame(s_k=[0.8], p_k=[0.9], dr_k=[0.45], m_k=[0.01], dr_c=[0.02])
    r = evaluate(st, np.array([True, False]), np.array(["d"] * 2), np.random.default_rng(7))
    _s_r, _p_r, _dr_r, seas_r = (row["value"] for row in r["rows"])
    assert seas_r == 45.0  # 0.45 / 0.01, measured on both sides
    assert r["seasonality"] is True
    assert not r["contrast"]  # 1v1 cannot reach perm p < 0.01: the p backstop holds


def test_plateau_S():
    # Nov 1 - May 31 holds 30 full weeks; detections in 24 of them -> S = 24/30
    days = pd.date_range("2018-11-01", "2019-05-31")
    wk = (days - pd.Timestamp("2018-11-01")).days // 7
    df = pd.DataFrame({"date": days, "clear": True, "det": np.isin(wk, range(24))})
    assert abs(S_stat(df, "2018-19") - 0.80) < 0.01


def test_spike_P():
    x = np.zeros(212)
    x[50:60] = 1
    assert P_stat(x) == 1.0
    assert P_stat(np.ones(212)) < 0.15
    assert abs(P_stat(np.ones(212)) - 14 / 212) < 1e-9


def test_branch_table():
    assert branch(True, True, True, False) == "full"
    assert branch(True, False, True, False) == "from2012"
    assert branch(True, True, False, False) == "partial"
    assert branch(False, True, True, True) == "nightfire"
    assert branch(False, False, False, False) == "nokiln"


def test_unit_stats_rates_are_closed_form():
    from kilnwatch.gates import unit_stats

    d = pd.DataFrame({
        "unit_id": "BD50",
        "date": pd.to_datetime(["2018-11-01", "2018-11-02", "2018-11-03", "2018-11-04",
                                "2018-06-10", "2018-06-11", "2018-06-12"]),
        "clear": True,
        "det": [True, True, False, False, True, False, False],
        "det_n": [True, False, False, False, False, False, False],
    })
    st = unit_stats(d, "2018-19").iloc[0]
    assert st.clear_days == 4 and st.det_days == 2  # Nov-May clear days, and linked detections on them
    assert st.DR == 0.5  # 2 detection days / 4 clear fire-season days
    assert st.DR_night == 0.25  # 1 night-pass detection day / the same 4 clear days
    assert st.M == 1 / 3  # 1 detection / 3 clear monsoon days
