"""analyze(): counts, nominal+high subsetting, rank correlation vs the committed export, and the published reference."""
import pandas as pd

from kilnwatch import verify_firms as vf


def test_analyze_counts_ranks_and_reference(monkeypatch):
    monkeypatch.setattr(vf, "_committed", lambda: {
        s: {"raw_by_sensor": {"N": n, "A": n / 2}}
        for s, n in [("2018-19", 4), ("2019-20", 8), ("2020-21", 16)]})
    plan = [("2018-19", "2019-01-15", 4), ("2019-20", "2020-01-15", 8), ("2020-21", "2021-01-15", 16)]
    rows = []
    for season, day, n in plan:  # fresh counts mirror the committed series exactly: Spearman must be 1
        for j in range(n):
            rows.append({"season": season, "sensor": "N", "date_local": pd.Timestamp(day) + pd.Timedelta(days=j % 3),
                         "conf_class": "low" if j == n - 1 else "nominal", "cell_id": j})
        for j in range(n // 2):
            rows.append({"season": season, "sensor": "A", "date_local": pd.Timestamp(day) + pd.Timedelta(days=j % 3),
                         "conf_class": "nominal", "cell_id": j})
    out = vf.analyze(pd.DataFrame(rows))

    n_1819 = next(r for r in out["season_by_sensor"] if r["season"] == "2018-19" and r["sensor"] == "N")
    assert (n_1819["count"], n_1819["count_nh"], n_1819["fire_days"]) == (4, 3, 4)  # the one low-confidence row drops
    assert out["shape_vs_committed"]["N"] == {"n": 3, "spearman_vs_committed": 1.0, "fresh_total": 28, "committed_total": 28.0}
    assert out["sensor_ordering"] == {"median_fresh_N_over_A": 2.0}  # every season reads N = 2x A
    assert out["reference"]["n"] == 3 and out["reference"]["fresh_fire_days_total"] == 28  # 2019-21 all in the published table
