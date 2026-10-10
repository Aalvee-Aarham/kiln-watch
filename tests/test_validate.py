import numpy as np
import pytest

from kilnwatch.validate import ccc, overlap_agreement


def test_ccc_closed_form():
    x = np.array([1.0, 2.0, 3.0])
    assert ccc(x, x) == pytest.approx(1.0)
    # mean 2 vs 4, variances 2/3 and 8/3, covariance 4/3: 2*(4/3) / (2/3 + 8/3 + 4) = 8/22
    assert ccc(x, 2 * x) == pytest.approx(8 / 22)


def _cal(uid, seed):
    """District calendar where raw VIIRS reads exactly 4x Aqua and the harmonized series equals Aqua."""
    n = (np.datetime64("2023-06-30") - np.datetime64("2003-01-01")).astype(int) + 1
    rng = np.random.default_rng(seed)
    days = np.arange(n)
    a = rng.gamma(2, 1, n)
    return {"unit_id": uid, "day0": "2003-01-01", "days": days.tolist(), "raw": {"A": a.tolist(), "N": (4 * a).tolist()}, "h": a.tolist(),
            "clear_frac": {"A": [80] * n, "N": [80] * n}}


def test_overlap_agreement_recovers_scale():
    out = overlap_agreement([_cal(f"D{i}", i) for i in range(3)], calib=("2012-13", "2013-14", "2014-15", "2015-16", "2016-17", "2017-18", "2018-19", "2019-20", "2020-21"),
                            rng=np.random.default_rng(0), n_boot=20)
    assert [r["period"] for r in out] == ["calibration", "held_out"]
    for r in out:
        assert r["ratio_raw"]["p50"] == pytest.approx(4.0) and r["ratio_harm"]["p50"] == pytest.approx(1.0)
        assert r["ccc_harm"]["p50"] == pytest.approx(1.0) and r["ccc_raw"]["p50"] < 0.5
    assert out[1]["seasons"] == "2021-22…2022-23"


def test_cloudy_days_are_left_out():
    c = _cal("D0", 0)
    c["clear_frac"]["A"] = [10] * len(c["clear_frac"]["A"])  # Aqua never saw the ground
    assert overlap_agreement([c, _cal("D1", 1)], rng=np.random.default_rng(0), n_boot=5) == []  # one district left: no estimate
