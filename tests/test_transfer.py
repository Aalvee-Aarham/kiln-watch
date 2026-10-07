import numpy as np
import pandas as pd

from kilnwatch import activity as A
from kilnwatch.export import assert_public_safe
from kilnwatch.transfer import LAST_YEAR, NOT_LAND, SEASON_ORDER, _km, evaluate, learn_window, missing_chunks, month_table, public_payload, ring_controls, split

# season-month profiles, Jul..Jun
BD = [0, 0, 0, 0, 0.5, 1, 1, 1, 1, 1, 0.5, 0.2]             # kilns Dec–Apr, quiet Jul–Oct
PK = [0.2, 0.2, 0.6, 0.6, 0, 0, 1, 1.2, 1.2, 1.2, 1.2, 1.2]  # smog closure Nov–Dec, busiest Feb–Jun


def test_learn_window_recovers_bangladesh_months():
    assert learn_window(BD) == ((12, 1, 2, 3, 4), (7, 8, 9, 10))


def test_learn_window_follows_a_different_calendar():
    # core: Feb–Jun has the highest 5-month mean (1.2); off: of the windows left of it, Sep–Dec is lowest (0.3)
    assert learn_window(PK) == ((2, 3, 4, 5, 6), (9, 10, 11, 12))


def test_learn_window_ties_take_the_earliest_start():
    assert learn_window([1.0] * 12) == ((7, 8, 9, 10, 11), (12, 1, 2, 3))


def test_learn_window_always_returns_disjoint_contiguous_windows():
    rng = np.random.default_rng(0)
    order = list(SEASON_ORDER)
    for _ in range(200):
        core, off = learn_window(rng.normal(size=12))
        ci, oi = [order.index(m) for m in core], [order.index(m) for m in off]
        assert len(core) == 5 and len(off) == 4 and not set(core) & set(off)
        assert ci == list(range(ci[0], ci[0] + 5)) and oi == list(range(oi[0], oi[0] + 4))


def test_split_is_seeded_nested_and_disjoint():
    ids = np.arange(7509)
    cal, conf = split(ids, np.random.default_rng(5))
    cal2, conf2 = split(ids, np.random.default_rng(5))
    assert (cal == cal2).all() and (conf == conf2).all()
    assert len(cal) == 400 and len(conf) == 1600 and not set(cal) & set(conf) and set(cal) | set(conf) <= set(ids)
    small_cal, small_conf = split(np.arange(500), np.random.default_rng(5))
    assert len(small_cal) == 400 and len(small_conf) == 100


def test_ring_controls_keep_their_distances():
    kl = pd.DataFrame({"lat": [30.0, 30.0, 30.02, 30.3], "lon": [72.0, 72.03, 72.0, 72.3]})
    reps = pd.DataFrame({"cluster_id": [0, 1], "lat": [30.0, 30.3], "lon": [72.0, 72.3]})
    land = lambda lat, lon: np.full(len(lat), 40)
    everywhere = lambda lat, lon: np.ones(len(lat), bool)
    ctrl = ring_controls(reps, {0: 40, 1: 40}, kl.lat, kl.lon, everywhere, land, np.random.default_rng(3))
    again = ring_controls(reps, {0: 40, 1: 40}, kl.lat, kl.lon, everywhere, land, np.random.default_rng(3))
    pd.testing.assert_frame_equal(ctrl, again)
    assert len(ctrl) == 6 and not ctrl.attrs["dropped"]
    m = ctrl.merge(reps, on="cluster_id")
    lat, lon = m.lat + m.dlat, m.lon + m.dlon
    d_rep = _km(m.lat.to_numpy(), m.lon.to_numpy(), lat.to_numpy(), lon.to_numpy())
    assert (d_rep >= 5 - 1e-6).all() and (d_rep <= 10 + 1e-6).all()           # rung 0 succeeds on open land
    nearest = np.array([_km(a, b, kl.lat.to_numpy(), kl.lon.to_numpy()).min() for a, b in zip(lat, lon)])
    assert (nearest >= 5 - 1e-6).all()
    for _, g in m.assign(la=lat, lo=lon).groupby("cluster_id"):
        d = _km(g.la.to_numpy()[:, None], g.lo.to_numpy()[:, None], g.la.to_numpy()[None, :], g.lo.to_numpy()[None, :])
        assert d[np.triu_indices(3, 1)].min() >= 5


def test_ring_controls_never_use_water_and_drop_short_clusters():
    reps = pd.DataFrame({"cluster_id": [7], "lat": [25.0], "lon": [85.0]})
    water = lambda lat, lon: np.full(len(lat), NOT_LAND[1])
    ctrl = ring_controls(reps, {7: 80}, [25.0], [85.0], lambda lat, lon: np.ones(len(lat), bool), water, np.random.default_rng(1), attempts=50)
    assert ctrl.empty and ctrl.attrs["dropped"] == [7]


def test_missing_chunks_counts_every_year_chunk_and_part(tmp_path):
    assert len(missing_chunks("ntl", 6000, tmp_path)) == 2 * (LAST_YEAR - 2012 + 1)        # 5,000-site chunks
    assert len(missing_chunks("s1", 3000, tmp_path)) == 3 * 2 * (LAST_YEAR - 2015 + 1)     # 1,000-site chunks, in + ring
    (tmp_path / "ntl").mkdir()
    (tmp_path / "ntl" / "2012_0_ntl.parquet").write_bytes(b"")
    assert "2012_0_ntl.parquet" not in missing_chunks("ntl", 6000, tmp_path)


def _half_months(first, last):
    return pd.DatetimeIndex([d + pd.Timedelta(days=k) for d in pd.date_range(first, last, freq="MS") for k in (0, 15)])


def test_a_different_calendar_fails_strict_months_and_passes_local_ones():
    """Kilns busy Jan–Oct and shut Nov–Dec: Bangladesh's Dec–Apr vs Jul–Oct contrast is negative; the learned one is not."""
    rng = np.random.default_rng(11)
    per = _half_months("2012-07-01", "2025-06-01")
    level = np.where(np.isin(per.month, (11, 12)), 0.0, 1.0)
    clusters = np.arange(400)
    cal, conf = clusters[:100], clusters[100:]
    e = pd.DataFrame({"cluster_id": np.repeat(clusters, len(per)), "period": np.tile(per, len(clusters))})
    e["e"] = np.tile(level, len(clusters)) + rng.normal(0, 0.3, len(e))
    ep = e.assign(e=rng.normal(0, 0.3, len(e)))                      # placebo: no seasonal signal
    window = learn_window(month_table(e, cal).median(axis=0).to_numpy())
    assert window == ((1, 2, 3, 4, 5), (9, 10, 11, 12))
    seasons = ("2012-13", "2024-25")
    assert not evaluate(e, ep, cal, conf, (A.CORE_MONTHS, A.OFF_MONTHS), seasons)["pass"]
    assert evaluate(e, ep, cal, conf, window, seasons)["pass"]


def test_public_payload_is_country_level_and_safe():
    prof = {"months": list(SEASON_ORDER), "p50": [0.1] * 12, "lo": [0.0] * 12, "hi": [0.2] * 12, "n_clusters": 1600}
    row = {"criterion": "Contrast", "value": 0.2, "threshold": "> 0", "p": 0.001, "pass": True}
    ch = {"n_calibration": 400, "n_confirmation": 1600, "learned": {"core": [1, 2, 3, 4, 5], "off": [9, 10, 11, 12]}, "profile": prof,
          "tests": {"TL": {"rows": [row], "pass": True}, "LL": {"rows": [row], "pass": True}}}
    res = {"bangladesh": {"code": "BD", "name": "Bangladesh", "n_clusters": 3653, "channels": {"ntl": {"learned": ch["learned"], "profile": prof}}},
           "countries": [{"code": "PK", "name": "Pakistan", "n_kilns": 10585, "n_clusters": 7509, "n_sampled": 2000, "n_dropped": 12,
                          "evaluable": True, "channels": {"ntl": ch}}]}
    pub = public_payload(res)
    assert_public_safe(pub)
    pk = pub["countries"][1]
    assert [t["test"] for t in pk["channels"]["ntl"]["tests"]] == ["TL", "LL"] and pk["channels"]["ntl"]["pass"] == {"TL": True, "LL": True}
    assert all(len(pk["channels"]["ntl"]["profile"][k]) == 12 for k in ("months", "p50", "lo", "hi"))
