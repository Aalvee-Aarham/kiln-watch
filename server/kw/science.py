"""Harmonization statistics. Pure stdlib on purpose: every number in the app traces to a few readable lines."""
import bisect
import calendar
import datetime as dt
import math
import statistics

# ---------- calendar keys ----------

def month_key(d: dt.date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def week_key(d: dt.date) -> str:
    y, w, _ = d.isocalendar()
    return f"{y:04d}-W{w:02d}"


def period_bounds(key: str):
    """Inclusive (start, end) dates of a 'YYYY-MM' or ISO 'YYYY-Www' key."""
    if "-W" in key:
        y, w = int(key[:4]), int(key[6:])
        start = dt.date.fromisocalendar(y, w, 1)
        return start, start + dt.timedelta(days=6)
    y, m = int(key[:4]), int(key[5:7])
    return dt.date(y, m, 1), dt.date(y, m, calendar.monthrange(y, m)[1])


def calendar_month(key: str) -> int:
    """Calendar month used for seasonal calibration. ISO weeks belong to the month of their Thursday."""
    if "-W" in key:
        return dt.date.fromisocalendar(int(key[:4]), int(key[6:]), 4).month
    return int(key[5:7])


def season_index(key: str) -> int:
    """0-based season slot for anomalies and trends: month 1-12, or ISO week 1-53."""
    return int(key[6:]) - 1 if "-W" in key else int(key[5:7]) - 1


def periods(start: dt.date, end: dt.date, weekly=False):
    keys, d = [], start
    fn = week_key if weekly else month_key
    while d <= end:
        k = fn(d)
        if not keys or keys[-1] != k:
            keys.append(k)
        d += dt.timedelta(days=1 if not weekly else 7)
    if fn(end) != keys[-1]:
        keys.append(fn(end))
    return keys


# ---------- calibration ----------

def ratio_calibration(pairs):
    """Ratio-of-totals calibration of a source sensor onto a reference sensor (no regression dilution).

    pairs: (calendar_month, ref_value, src_value) for co-observed training periods (already coverage-normalised).
    Each calendar month gets its own log-ratio, shrunk toward the pooled log-ratio by empirical Bayes: the
    between-month variance tau2 is estimated from the data (method of moments), and a month with sampling
    variance v keeps weight tau2/(tau2+v). sigma2 is the extra-Poisson variance of the log residual: the
    calibration error left after counting noise is accounted for.
    """
    num, den = [0.0] * 12, [0.0] * 12
    for m, r, s in pairs:
        num[m - 1] += r
        den[m - 1] += s
    N, D = sum(num), sum(den)
    if N <= 0 or D <= 0:
        return {"beta": [1.0] * 12, "pooled": 1.0, "sigma2": 1.0, "tau2": 0.0, "n": len(pairs), "calibrated": False}
    pooled = N / D
    L = math.log(pooled)
    obs = [(math.log(num[i] / den[i]), 1 / num[i] + 1 / den[i]) for i in range(12) if num[i] > 0 and den[i] > 0]
    tau2 = max(0.0, statistics.fmean((x - L) ** 2 for x, _ in obs) - statistics.fmean(v for _, v in obs)) if obs else 0.0
    beta = []
    for i in range(12):
        if num[i] > 0 and den[i] > 0:
            v = 1 / num[i] + 1 / den[i]
            lam = tau2 / (tau2 + v) if tau2 > 0 else 0.0
            beta.append(math.exp(lam * math.log(num[i] / den[i]) + (1 - lam) * L))
        else:
            beta.append(pooled)
    resid, noise = [], []
    for m, r, s in pairs:
        if r + s >= 10:
            resid.append(math.log((r + 0.5) / (beta[m - 1] * s + 0.5)))
            noise.append(1 / (r + 0.5) + 1 / (s + 0.5))
    if len(resid) >= 3:
        sigma2 = max(0.0025, statistics.pvariance(resid) - statistics.fmean(noise))
    else:
        sigma2 = 0.25  # ponytail: too few co-observed months to estimate; wide prior until more data
    return {"beta": beta, "pooled": pooled, "sigma2": sigma2, "tau2": tau2, "n": len(pairs), "calibrated": True}


def combine(estimates):
    """Inverse-variance mean of per-sensor estimates already in reference units.

    estimates: (value, sigma2_rel, counting_var) per sensor. Variances are evaluated at the pooled mean, so a
    sensor that happens to read low does not earn extra weight (a known bias of naive Poisson weighting).
    Returns (value, variance) or None when no sensor observed the period.
    """
    if not estimates:
        return None
    mu = statistics.fmean(v for v, _, _ in estimates)
    weights = []
    for v, s2, cv in estimates:
        counting = cv * (mu / v) if v > 0 else cv
        weights.append(1.0 / max(mu * mu * s2 + counting, 1e-9))
    W = sum(weights)
    return sum(w * e[0] for w, e in zip(weights, estimates)) / W, 1.0 / W


# ---------- anomaly, trend, steps ----------

HALF_LIFE_YEARS = 10.0  # recent-weighted baseline: a year this much older counts half as much


def recency_weights(years, ref, half_life=HALF_LIFE_YEARS):
    """Exponential-decay weights w = 0.5 ** ((ref - year) / half_life), the EWMA idea used for 'optimal climate
    normals': a changing climate makes recent years a better picture of what is normal now."""
    return [0.5 ** ((ref - y) / half_life) for y in years]


def weighted_median(xs, ws):
    """Smallest x whose cumulative weight reaches half the total (the lower weighted median)."""
    pairs = sorted(zip(xs, ws))
    half, acc = sum(ws) / 2, 0.0
    for x, w in pairs:
        acc += w
        if acc >= half - 1e-12:
            return x
    return pairs[-1][0]


def weighted_percentile_rank(x, xs, ws):
    """Share of weight below x, ties counted half (reduces to the plain percentile rank for equal weights)."""
    tot = sum(ws)
    return 100 * (sum(w for v, w in zip(xs, ws) if v < x) + 0.5 * sum(w for v, w in zip(xs, ws) if v == x)) / tot


def versus_history(values, keys, partial, min_years=5):
    """Each period against the same month/week in all other complete years: median, ratio to median,
    percentile and rank (1 = highest, among this period and the others). Fire counts are skewed, so no sigma.
    w* fields repeat the median/ratio/percentile with recency weights (half-life HALF_LIFE_YEARS, relative to the
    latest year in the record), so they answer "unusual compared with recent years"."""
    by_season = {}
    for i, k in enumerate(keys):
        if values[i] is not None and not partial[i]:
            by_season.setdefault(season_index(k), []).append(i)
    out = {"median": [], "ratio": [], "pct": [], "rank": [], "n": [], "wmedian": [], "wratio": [], "wpct": []}
    ref = max((int(k[:4]) for k in keys), default=0)
    for i, k in enumerate(keys):
        idx = [j for j in by_season.get(season_index(k), []) if j != i]
        others = [values[j] for j in idx]
        if values[i] is None or len(others) < min_years:
            for v in out.values():
                v.append(None)
            continue
        med = statistics.median(others)
        below = sum(x < values[i] for x in others) + 0.5 * sum(x == values[i] for x in others)
        out["median"].append(round(med, 2))
        out["ratio"].append(round(values[i] / med, 3) if med > 0 else None)
        out["pct"].append(round(100 * below / len(others), 1))
        out["rank"].append(1 + sum(x > values[i] for x in others))
        out["n"].append(len(others) + 1)
        ws = recency_weights([int(keys[j][:4]) for j in idx], ref)
        wmed = weighted_median(others, ws)
        out["wmedian"].append(round(wmed, 2))
        out["wratio"].append(round(values[i] / wmed, 3) if wmed > 0 else None)
        out["wpct"].append(round(weighted_percentile_rank(values[i], others, ws), 1))
    return out


def _norm_sf(x):
    return 0.5 * math.erfc(x / math.sqrt(2))


def seasonal_mann_kendall(seasons):
    """Hirsch seasonal Mann-Kendall with tie correction and seasonal Sen slope.

    seasons: list of per-season chronological lists of (year, value). Returns tau, p (two-sided), z,
    sen slope (units per year) and number of values used.
    """
    S = var = pairs = 0
    slopes = []
    n_used = 0
    for series in seasons:
        xs = [(y, v) for y, v in series if v is not None]
        n = len(xs)
        n_used += n
        if n < 2:
            continue
        for i in range(n):
            for j in range(i + 1, n):
                d = xs[j][1] - xs[i][1]
                S += (d > 0) - (d < 0)
                slopes.append(d / (xs[j][0] - xs[i][0]))
        pairs += n * (n - 1) // 2
        ties = {}
        for _, v in xs:
            ties[v] = ties.get(v, 0) + 1
        var += (n * (n - 1) * (2 * n + 5) - sum(t * (t - 1) * (2 * t + 5) for t in ties.values())) / 18
    if pairs == 0 or var <= 0:
        return {"tau": None, "p": None, "z": None, "sen_per_year": None, "n": n_used}
    z = (S - 1) / math.sqrt(var) if S > 0 else (S + 1) / math.sqrt(var) if S < 0 else 0.0
    return {
        "tau": round(S / pairs, 3),
        "p": round(2 * _norm_sf(abs(z)), 4),
        "z": round(z, 2),
        "sen_per_year": round(statistics.median(slopes), 3),
        "n": n_used,
    }


def step_ratio(keys, values, partial, transition, window=24, min_side=12):
    """Level change across a sensor transition on a deseasonalised series: mean(after) / mean(before).

    Each value is divided by its calendar-month climatology so seasonality is not mistaken for a step.
    The transition period itself is excluded (it is part-observed by the new sensor).
    """
    clim = {}
    for k, v, p in zip(keys, values, partial):
        if v is not None and not p:
            clim.setdefault(calendar_month(k), []).append(v)
    clim = {m: statistics.fmean(v) for m, v in clim.items()}
    if transition not in keys:
        return None
    t = keys.index(transition)

    def side(idx):
        out = []
        for i in idx:
            if 0 <= i < len(keys) and values[i] is not None and not partial[i]:
                c = clim.get(calendar_month(keys[i]), 0)
                if c > 0:
                    out.append(values[i] / c)
        return out

    before = side(range(t - window, t))
    after = side(range(t + 1, t + 1 + window))
    if len(before) < min_side or len(after) < min_side or statistics.fmean(before) <= 0:
        return None
    return round(statistics.fmean(after) / statistics.fmean(before), 3)


# ---------- validation ----------

def _ranks(xs):
    order = sorted(range(len(xs)), key=xs.__getitem__)
    r = [0.0] * len(xs)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and xs[order[j + 1]] == xs[order[i]]:
            j += 1
        for k in range(i, j + 1):
            r[order[k]] = (i + j) / 2 + 1
        i = j + 1
    return r


def spearman(a, b):
    if len(a) < 3:
        return None
    ra, rb = _ranks(a), _ranks(b)
    try:
        return round(statistics.correlation(ra, rb), 3)
    except statistics.StatisticsError:  # constant input
        return None


def metrics(pred, truth):
    n = len(truth)
    if n == 0:
        return {"n": 0}
    st = sum(truth)
    err = [p - t for p, t in zip(pred, truth)]
    return {
        "n": n,
        "bias_pct": round(100 * sum(err) / st, 1) if st > 0 else None,
        "mae": round(statistics.fmean(abs(e) for e in err), 2),
        "rmse": round(math.sqrt(statistics.fmean(e * e for e in err)), 2),
        "spearman": spearman(pred, truth),
    }


# ---------- distribution matching (diagnostic) ----------

def quantiles(values, n=21):
    xs = sorted(v for v in values if v is not None and math.isfinite(v))
    if len(xs) < 2:
        return None
    out = []
    for i in range(n):
        pos = (len(xs) - 1) * i / (n - 1)
        lo = math.floor(pos)
        hi = min(lo + 1, len(xs) - 1)
        out.append(xs[lo] + (xs[hi] - xs[lo]) * (pos - lo))
    return out


def _check_q(q, name):
    if not q or len(q) < 2:
        raise ValueError(f"{name}: need at least 2 quantiles")
    if any(not math.isfinite(v) for v in q):
        raise ValueError(f"{name}: non-finite quantile")
    if any(b < a for a, b in zip(q, q[1:])):
        raise ValueError(f"{name}: quantiles must be non-decreasing")


def quantile_map(x, src_q, ref_q):
    """Monotone quantile mapping x -> reference scale, with linear interpolation between bins.

    Outside the training support the edge offset is carried (x - src_edge + ref_edge) and the value is
    flagged, so extrapolation is never silent. Returns (mapped, in_support).
    """
    _check_q(src_q, "src_q")
    _check_q(ref_q, "ref_q")
    if len(src_q) != len(ref_q):
        raise ValueError("src_q and ref_q must have equal length")
    if not math.isfinite(x):
        raise ValueError("x must be finite")
    if x < src_q[0]:
        return x - src_q[0] + ref_q[0], False
    if x > src_q[-1]:
        return x - src_q[-1] + ref_q[-1], False
    i = bisect.bisect_right(src_q, x) - 1
    i = min(i, len(src_q) - 2)
    span = src_q[i + 1] - src_q[i]
    f = (x - src_q[i]) / span if span > 0 else 0.0
    pos = i + f
    lo = math.floor(pos)
    hi = min(lo + 1, len(ref_q) - 1)
    return ref_q[lo] + (ref_q[hi] - ref_q[lo]) * (pos - lo), True


def wasserstein2(q1, q2):
    """W2 distance between two distributions given equal-probability quantile vectors."""
    _check_q(q1, "q1")
    _check_q(q2, "q2")
    if len(q1) != len(q2):
        raise ValueError("quantile vectors must have equal length")
    return math.sqrt(statistics.fmean((a - b) ** 2 for a, b in zip(q1, q2)))


# ---------- early warning (climatological outlook, no forecast model) ----------

WARNING_RULE = ("elevated: month-to-date at or above the 90th percentile of the same days in earlier years; "
                "watch: month at or above the 75th percentile or the latest complete week at or above the 90th; "
                "quiet: month at or below the 10th; otherwise normal. Not scored when a typical year has fewer than "
                "100 hotspots, fewer than 10 earlier years exist, or this month so far and its usual level are both "
                "under 5 hotspots (too few to rank).")


def percentile_rank(value, others):
    """Share of earlier values below `value` (ties count half), 0-100; None without a basis."""
    if not others:
        return None
    below = sum(x < value for x in others) + 0.5 * sum(x == value for x in others)
    return round(100 * below / len(others), 1)


def warning_level(pct_month, pct_week, typical_year_total, n_prior, month_scale=None):
    # ponytail: 5 is a judgement floor (below it percentile ranks are mostly ties); tune with placebo months
    if pct_month is None or n_prior < 10 or (typical_year_total or 0) < 100 or (month_scale is not None and month_scale < 5):
        return "insufficient"
    if pct_month >= 90:
        return "elevated"
    if pct_month >= 75 or (pct_week is not None and pct_week >= 90):
        return "watch"
    return "quiet" if pct_month <= 10 else "normal"


OUTLOOK_RULE = ("30-day outlook per 0.5° cell, Aqua MODIS only (one sensor since 2003, so no cross-sensor step). "
                "season: the next 30 days usually bring at least 5 hotspots (median of earlier years). "
                "above: the last 30 days are at or above the 90th percentile of the same days in earlier years and at "
                "least 5 hotspots. watch: both at once. rising: the usual next 30 days are at least twice the usual last 30.")


def outlook_cell(fwd, back, now, floor=5):
    """One cell of the worldwide outlook. fwd/back: hotspots in the next/last 30 calendar days of each earlier year
    (zeros included), now: the last 30 days this year. Returns (class or None, usual, p90, pct_now, rising).
    Climatology plus the present anomaly: says what is usual and how unusual today is, never predicts."""
    q = quantiles(fwd, 11)
    if not q:
        return None, 0, 0, None, False
    usual, p90 = q[5], q[9]
    pct = percentile_rank(now, back) if back else None
    above = now >= floor and pct is not None and pct >= 90
    season = usual >= floor
    rising = season and usual >= 2 * max(quantiles(back, 11)[5] if len(back) > 1 else 0, 1)
    cls = "watch" if above and season else "above" if above else "season" if season else None
    return cls, round(usual, 1), round(p90, 1), pct, rising
