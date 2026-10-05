import numpy as np
import pandas as pd

from kilnwatch.classify import FEATURES, build_features


def test_no_leakage_features():
    banned = {"lat", "lon", "latitude", "longitude", "date", "month", "date_local", "season", "doy"}
    assert not banned & set(FEATURES)


def _det(dates):
    n = len(dates)
    t = pd.to_datetime(dates) + pd.Timedelta(hours=1)
    return pd.DataFrame({"sensor": "N", "lat": np.full(n, 23.5), "lon": np.full(n, 90.5), "bt_mir": 330.0, "bt_tir": 295.0,
                         "frp": 3.0, "pass": "N", "scan_km": 0.4, "track_km": 0.4, "t_utc": t, "t_local": t + pd.Timedelta(hours=6),
                         "date_local": pd.to_datetime(dates), "conf_class": "nominal"})


def test_past_only_windows():
    base = _det(["2020-01-01", "2020-01-02", "2020-01-03", "2020-01-05"])
    p5_before = build_features(base).p5.to_numpy()
    fut = pd.concat([base, _det(["2020-01-20"])], ignore_index=True)
    assert np.array_equal(build_features(fut).p5.to_numpy()[:4], p5_before)
    assert p5_before.tolist() == [0, 1, 2, 3]
