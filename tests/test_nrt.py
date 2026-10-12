import json
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


# --- end-to-end rehearsal of the daily run on both sides of SNPP_END (no network) ---------------
def _rehearse(monkeypatch, tmp_path, today):
    """nrt.run on a fixed day: one district sees only NOAA-20, another only S-NPP, on the same dates."""
    import shutil

    from kilnwatch.grid import cell_center

    data = tmp_path / "data"
    shutil.copytree(C.ROOT / "web" / "fixtures" / "nokiln" / "data", data)  # calendars with real p90 normals
    monkeypatch.setattr(C, "WEB_DATA", data)
    monkeypatch.setattr(C, "load_derived", lambda: {"GATE_BRANCH": {"value": "nokiln"}})
    cells = pd.read_parquet(C.MODELS / "cells.parquet")
    d_j1, d_n = sorted(cells.district.unique())[:2]
    rows = []
    for dist, sensor in ((d_j1, "J1"), (d_n, "N")):
        lat, lon = cell_center(cells[cells.district == dist].cell_id.iloc[:3].to_numpy())
        for day in ("2026-10-20", "2026-10-28"):
            for la, lo in zip(lat, lon):
                rows.append({"lat": la, "lon": lo, "sensor": sensor, "conf_class": "nominal",
                             "date_local": pd.Timestamp(day), "pass": "N"})
    df = pd.DataFrame(rows)
    monkeypatch.setattr(nrt, "update_season_csv", lambda days, today=None: df.copy())
    return nrt.run(today=today), d_j1, d_n


def test_rehearsal_after_snpp_ends_uses_noaa20(monkeypatch, tmp_path):
    out, d_j1, d_n = _rehearse(monkeypatch, tmp_path, date(2026, 11, 10))
    assert out["era"] == "J1" and out["sensor"] == "NOAA-20"
    assert sum(out["districts"][d_j1]["h"]) > 0
    assert sum(out["districts"][d_n]["h"]) == 0  # S-NPP rows no longer count after the switch
    assert out["beta_imputed_frac"] == 0.0  # every stratum has an N<-J1 beta
    assert len(out["national"]["h"]) == (date(2026, 11, 10) - date(2026, 7, 1)).days + 1
    assert json.loads((tmp_path / "data" / "nrt" / "current_season.json").read_text(encoding="utf-8")) == out


def test_rehearsal_on_snpp_last_day_still_uses_snpp(monkeypatch, tmp_path):
    out, d_j1, d_n = _rehearse(monkeypatch, tmp_path, nrt.SNPP_END)
    assert out["era"] == "N" and out["sensor"] == "Suomi NPP"
    assert sum(out["districts"][d_n]["h"]) > 0
    assert sum(out["districts"][d_j1]["h"]) == 0
