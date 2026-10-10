import hashlib
import json

import numpy as np
import pandas as pd
import pytest

from kilnwatch import config as C
from kilnwatch.research import calendar_daily, check_columns, write

FIXT = C.ROOT / "web" / "fixtures" / "full" / "data"  # synthetic, committed


def test_daily_keeps_no_fire_and_not_seen_apart():
    cal = {"unit_id": "X", "days": [1, 3], "h": [2.0, 5.0], "raw": {"N": [1.0, 4.0]}, "split": [{"key": "aman", "values": [2.0, 0.0]}],
           "nodata": [[3, 4]]}
    d = calendar_daily(cal)
    assert len(d) == 5 and str(d.date.iloc[0].date()) == "2003-01-01"
    assert d.observed.tolist() == [True, True, True, False, False]
    assert d.h.tolist()[:3] == [0.0, 2.0, 0.0] and np.isnan(d.h.iloc[3])   # day 3 had a detection but was not observed
    assert d.raw_N.tolist() == [0.0, 1.0, 0.0, 4.0, 0.0]                    # raw rates are kept as recorded


@pytest.mark.parametrize("col", sorted(C.FORBIDDEN_PUBLIC_KEYS) + ["lat", "Lon"])
def test_forbidden_columns_refused(col):
    with pytest.raises(ValueError):
        check_columns(pd.DataFrame({col: [1]}), "t")


def test_release_from_public_export(tmp_path):
    m = write(FIXT, tmp_path / "research")
    out = tmp_path / "research"
    for f, info in m["files"].items():  # manifest hashes are the files' own hashes
        assert hashlib.sha256((out / f).read_bytes()).hexdigest() == info["sha256"]
    daily = pd.read_parquet(out / "calendar_daily.parquet")
    for p in sorted((FIXT / "calendar").glob("*.json"))[:5]:  # dense h re-sums to the sparse file's observed values
        cal = json.loads(p.read_text(encoding="utf-8"))
        dd = daily[daily.unit_id == cal["unit_id"]]
        obs = np.ones(len(dd), bool)
        for a, b in cal["nodata"]:
            obs[a:b + 1] = False
        assert np.isclose(dd.h.sum(), sum(v for d, v in zip(cal["days"], cal["h"]) if obs[d]))
    monthly = pd.read_csv(out / "calendar_monthly.csv")
    assert np.isclose(monthly.h_sum.sum(), daily.h.sum())
    assert (out / "DATA_DICTIONARY.md").exists() and "CC BY 4.0" in (out / "LICENSE.txt").read_text()
