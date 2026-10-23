"""FIRMS backfill: a failed window stops the stage instead of leaving a silent hole, and the MAP_KEY never reaches the log."""
from datetime import date

import pytest
import requests

from kilnwatch import config as C
from kilnwatch import ingest


def test_failed_window_raises_after_the_rest_are_fetched(monkeypatch, tmp_path, caplog):
    monkeypatch.setattr(C, "FIRMS_MAP_KEY", "SECRETKEY123")
    fetched = []

    def fake(source, start, s, force=False, root=None):
        if start == date(2020, 1, 6):
            raise requests.HTTPError(f"500 Server Error for url: {ingest.FIRMS}/api/area/csv/SECRETKEY123/{source}/x/5/{start}")
        fetched.append(start)

    monkeypatch.setattr(ingest, "area_window", fake)
    with pytest.raises(ingest.MissingWindows, match="1 of 4 windows failed"):
        ingest.backfill("MODIS_SP", date(2020, 1, 1), date(2020, 1, 16), workers=1, root=tmp_path)
    assert sorted(fetched) == [date(2020, 1, 1), date(2020, 1, 11), date(2020, 1, 16)]
    assert "SECRETKEY123" not in caplog.text and "<MAP_KEY>" in caplog.text


def test_complete_backfill_counts_windows(monkeypatch, tmp_path):
    monkeypatch.setattr(ingest, "area_window", lambda *a, **k: None)
    assert ingest.backfill("MODIS_SP", date(2020, 1, 1), date(2020, 1, 31), workers=2, root=tmp_path) == 7  # ceil(31 / 5)


# --- _pace: quota pacing must survive a failing status endpoint -------------------------------


class _Resp:
    def __init__(self, status_code=200, text=""):
        self.status_code, self.text, self.ok = status_code, text, status_code < 400


def _no_sleep(monkeypatch):
    slept = []
    monkeypatch.setattr(ingest.time, "sleep", lambda s: slept.append(s))
    return slept


def test_pace_waits_at_ceiling_until_under_it(monkeypatch):
    reads = iter([_make_status(4990), _make_status(4990), _make_status(100)])
    monkeypatch.setattr(ingest, "_pace_n", [0])
    slept = _no_sleep(monkeypatch)
    ingest._pace(type("S", (), {"get": staticmethod(lambda *a, **k: next(reads))})(), every=1)
    assert slept == [60, 60]  # two at-ceiling reads waited; the third read returned


def _make_status(used: int):
    return type("R", (), {"json": lambda self: {"current_transactions": used}})()


def test_pace_paces_conservatively_when_status_unreadable(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("endpoint down")

    monkeypatch.setattr(ingest, "_pace_n", [0])
    slept = _no_sleep(monkeypatch)
    ingest._pace(type("S", (), {"get": staticmethod(boom)})(), every=1)
    assert slept == [10, 10, 60]  # three failed reads, then one conservative interval — pacing never silently disabled


def test_area_window_raises_fast_on_a_really_invalid_key(monkeypatch, tmp_path):
    monkeypatch.setattr(ingest, "_pace_n", [0])
    monkeypatch.setattr(C, "FIRMS_MAP_KEY", "SECRETKEY123")
    slept = _no_sleep(monkeypatch)
    s = type("S", (), {"get": staticmethod(lambda *a, **k: _Resp(400, "Invalid MAP_KEY."))})()
    with pytest.raises(RuntimeError, match="Invalid MAP_KEY.*check FIRMS_MAP_KEY"):
        ingest.area_window("MODIS_SP", date(2020, 1, 1), s, root=tmp_path)
    assert slept == [90, 90]  # two waits, raise on the third strike: a bad key fails in ~3 min, not 18


def test_area_window_quota_recovery_still_bounded(monkeypatch, tmp_path):
    monkeypatch.setattr(ingest, "_pace_n", [0])
    slept = _no_sleep(monkeypatch)
    s = type("S", (), {"get": staticmethod(lambda *a, **k: _Resp(400, "Exceeding the usage limit"))})()
    with pytest.raises(RuntimeError, match="quota not recovered"):
        ingest.area_window("MODIS_SP", date(2020, 1, 1), s, root=tmp_path)
    assert len(slept) == 12  # genuine quota waits keep the full bounded retry ladder
