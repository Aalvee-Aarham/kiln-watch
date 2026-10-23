"""run_clear: a failed month stops the stage (resumable) instead of returning a holed clear table."""
import pandas as pd
import pytest

from kilnwatch import gee


def _frame(month: str) -> pd.DataFrame:
    return pd.DataFrame({"unit_id": ["BD50"], "date_local": [pd.Timestamp(f"{month}-15")], "clear_frac": [0.9]})


def test_run_clear_raises_when_a_month_is_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(gee, "CACHE", tmp_path)
    monkeypatch.setattr(gee, "_fc", lambda *a, **k: object())
    monkeypatch.setattr(gee, "load_clear", lambda us: pd.DataFrame())

    def fake(sensor, fc, month, id_col, reducer):
        if month == "2003-02":
            raise RuntimeError("gee timeout")  # fails all 3 bounded attempts
        return _frame(month)

    monkeypatch.setattr(gee, "daily_clear_fraction", fake)
    with pytest.raises(gee.MissingMonths, match="1 of 2 months missing.*rerun to resume"):
        gee.run_clear("admin", pd.DataFrame({"unit_id": ["BD50"]}), sensors=("A",), first="2003-01", last="2003-02", workers=1)
    ok = tmp_path / "clear" / "admin" / "A" / "2003-01.parquet"
    assert ok.exists()  # the good month is cached: a rerun resumes, it does not start over
    assert not (tmp_path / "clear" / "admin" / "A" / "2003-02.parquet").exists()


def test_run_clear_returns_the_cache_when_complete(monkeypatch, tmp_path):
    monkeypatch.setattr(gee, "CACHE", tmp_path)
    monkeypatch.setattr(gee, "_fc", lambda *a, **k: object())
    loaded = pd.DataFrame({"unit_id": ["BD50"]})
    monkeypatch.setattr(gee, "load_clear", lambda us: loaded)
    monkeypatch.setattr(gee, "daily_clear_fraction", lambda s, fc, m, i, r: _frame(m))
    out = gee.run_clear("admin", pd.DataFrame({"unit_id": ["BD50"]}), sensors=("A",), first="2003-01", last="2003-01", workers=1)
    assert out is loaded
