import numpy as np
import pandas as pd

from kilnwatch.gates import P_stat, S_stat, branch


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
