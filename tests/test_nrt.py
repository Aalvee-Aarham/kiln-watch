from datetime import date
from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest

from kilnwatch import config as C
from kilnwatch import ingest, nrt


def _fake_session(status, text):
    reply = SimpleNamespace(status_code=status, text=text, ok=200 <= status < 400)
    return lambda: SimpleNamespace(get=lambda url, timeout: reply)


@pytest.mark.parametrize("status,text", [(400, "Invalid MAP_KEY."), (400, "Exceeding allowed transaction limit"), (503, "<html>down</html>")])
def test_non_csv_reply_fails_and_hides_key(monkeypatch, status, text):
    monkeypatch.setattr(C, "FIRMS_MAP_KEY", "SECRETKEY123")
    monkeypatch.setattr(ingest, "session", _fake_session(status, text))
    with pytest.raises(RuntimeError) as e:
        nrt.fetch(5)
    assert "SECRETKEY123" not in str(e.value)


@pytest.mark.parametrize("status,text", [(404, ""), (200, ""), (200, "  \n")])
def test_empty_reply_is_no_detections(monkeypatch, status, text):
    monkeypatch.setattr(ingest, "session", _fake_session(status, text))
    assert nrt.fetch(5).empty


# --- the S-NPP -> NOAA-20 era switch (frozen at SNPP_END = 2026-11-02) ------------------------


def test_era_switches_the_day_after_snpp_end():
    assert nrt.era_of(date(2026, 11, 1)) == "N"
    assert nrt.era_of(nrt.SNPP_END) == "N"  # S-NPP's own last data day is still the N era
    assert nrt.era_of(date(2026, 11, 3)) == "J1"


def test_snpp_source_dropped_after_its_end_date():
    assert "VIIRS_SNPP_NRT" in nrt.sources_for(nrt.SNPP_END)
    assert "VIIRS_SNPP_NRT" not in nrt.sources_for(date(2026, 11, 3))
    assert "VIIRS_NOAA20_NRT" in nrt.sources_for(date(2026, 11, 3))  # J1 carries the record alone


def test_j1_era_chains_both_beta_steps():
    idx = pd.MultiIndex.from_tuples([("Dhaka", 11, "D", "other"), ("Rajshahi", 2, "N", "kiln")],
                                    names=["division", "month", "pass", "loc"])
    b1 = pd.Series([2.0, 3.0], index=idx)
    b2 = pd.Series([5.0, 7.0], index=idx)
    assert list(nrt.era_beta_weights(b1, b2, idx, "N")) == [2.0, 3.0]  # S-NPP era: the A<-N step alone
    assert list(nrt.era_beta_weights(b1, b2, idx, "J1")) == [10.0, 21.0]  # after: chained w = b1 * b2
    # a key the calibration never saw falls back to NaN here; run() imputes the b1 median and reports the share
    miss = pd.MultiIndex.from_tuples([("Dhaka", 11, "D", "other"), ("Khulna", 6, "D", "other")], names=idx.names)
    assert np.isnan(nrt.era_beta_weights(b1, b2, miss, "J1")[1])
