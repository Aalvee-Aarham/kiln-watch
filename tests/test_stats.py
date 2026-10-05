import numpy as np

from kilnwatch.stats import bootstrap_ci, chow_test, perm_test, wilson


def test_wilson():
    lo, hi = wilson(3, 10)
    assert abs(lo - 0.1078) < 1e-4 and abs(hi - 0.6032) < 1e-4


def test_perm():
    rng = np.random.default_rng(1)
    a = np.r_[rng.normal(10, 1, 30), rng.normal(1, 1, 30)].clip(0.01)
    lab = np.r_[np.ones(30, bool), np.zeros(30, bool)]
    strata = np.tile([0, 1, 2], 20)
    assert perm_test(a, lab, strata, n=2000, rng=rng) < 0.01
    same = np.ones(60)
    assert perm_test(same, lab, strata, n=2000, rng=rng) > 0.2


def test_chow():
    rng = np.random.default_rng(2)
    noise = rng.normal(0, 1, 20)
    step = noise + np.r_[np.zeros(10), np.full(10, 10.0)]
    assert chow_test(step, 10) < 0.01
    assert chow_test(noise, 10) > 0.2


def test_bootstrap_ci_orders():
    p, lo, hi = bootstrap_ci(np.arange(100.0), n=500, rng=np.random.default_rng(0))
    assert lo <= p <= hi
    p, lo, hi = bootstrap_ci(np.arange(100.0), n=500, block=7, rng=np.random.default_rng(0))
    assert lo <= p <= hi
