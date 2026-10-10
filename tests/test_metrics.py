import numpy as np
import pandas as pd

from kilnwatch.metrics import era_clear_frac, era_sensor


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
