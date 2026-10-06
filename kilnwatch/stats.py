"""Bootstrap, permutation, Wilson and Chow (architecture §5.4–5.7)."""
from __future__ import annotations

import numpy as np
from scipy import stats as st


def bootstrap_ci(x, stat=np.mean, n=1000, block=None, rng=None, level=0.95) -> tuple[float, float, float]:
    """(point, lo, hi). block=k resamples contiguous blocks of length k (week-block bootstrap)."""
    rng = rng if rng is not None else np.random.default_rng(0)
    x = np.asarray(x, dtype=float)
    if len(x) == 0:
        return (np.nan, np.nan, np.nan)
    point = float(stat(x))
    if block:
        nb = int(np.ceil(len(x) / block))
        starts = rng.integers(0, max(1, len(x) - block + 1), size=(n, nb))
        idx = (starts[..., None] + np.arange(block)).reshape(n, -1)[:, : len(x)]
    else:
        idx = rng.integers(0, len(x), size=(n, len(x)))
    draws = np.array([stat(x[i]) for i in idx])
    a = (1 - level) / 2
    return point, float(np.nanquantile(draws, a)), float(np.nanquantile(draws, 1 - a))


def perm_test(values, is_kiln, strata, stat=None, n=10_000, rng=None) -> float:
    """One-sided p for stat(kiln) - stat(control) >= observed, shuffling labels within strata (bounded n)."""
    rng = rng if rng is not None else np.random.default_rng(0)
    stat = stat or (lambda a, b: np.mean(a) / max(np.mean(b), 1e-12))
    v = np.asarray(values, dtype=float)
    lab = np.asarray(is_kiln, dtype=bool)
    strata = np.asarray(strata)
    obs = stat(v[lab], v[~lab])
    groups = [np.flatnonzero(strata == s) for s in np.unique(strata)]
    hits = 0
    perm = lab.copy()
    for _ in range(n):
        for g in groups:
            perm[g] = rng.permutation(lab[g])
        hits += stat(v[perm], v[~perm]) >= obs
    return (hits + 1) / (n + 1)


def wilson(k: int, n: int, level=0.95) -> tuple[float, float]:
    if n == 0:
        return (0.0, 1.0)
    z = st.norm.ppf(1 - (1 - level) / 2)
    p = k / n
    den = 1 + z**2 / n
    c = (p + z**2 / (2 * n)) / den
    h = z * np.sqrt(p * (1 - p) / n + z**2 / (4 * n**2)) / den
    return (float(c - h), float(c + h))


def chow_test(series, break_index: int) -> float:
    """Chow test for a structural break at break_index in a linear-trend model; returns p."""
    y = np.asarray(series, dtype=float)
    t = np.arange(len(y), dtype=float)
    k = 2

    def rss(yy, tt):
        X = np.c_[np.ones_like(tt), tt]
        beta, *_ = np.linalg.lstsq(X, yy, rcond=None)
        return float(np.sum((yy - X @ beta) ** 2))

    n = len(y)
    r_pooled = rss(y, t)
    r_split = rss(y[:break_index], t[:break_index]) + rss(y[break_index:], t[break_index:])
    if n - 2 * k <= 0:
        return np.nan
    if r_split <= 1e-12:
        return 0.0 if r_pooled > 1e-12 else 1.0
    f = ((r_pooled - r_split) / k) / (r_split / (n - 2 * k))
    return float(st.f.sf(f, k, n - 2 * k))
