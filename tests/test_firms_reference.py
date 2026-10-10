"""Published-reference checks on the committed real FIRMS-derived export (invariant 8).

Reads `web/fixtures/nokiln/data/` (the verbatim offline copy of the real pipeline export) and
`tests/fixtures/firms_bd_reference.csv` (an independent published Bangladesh fire series). Only
committed files; no network.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from kilnwatch import config as CFG

REAL = CFG.WEB_FIXT / "nokiln" / "data"
REF = Path(__file__).with_name("fixtures") / "firms_bd_reference.csv"


def _spearman(a, b) -> float:
    ra, rb = pd.Series(a).rank().to_numpy(), pd.Series(b).rank().to_numpy()
    return float(np.corrcoef(ra, rb)[0, 1])


def _yearly() -> dict:
    d = json.loads((REAL / "harmonization.json").read_text(encoding="utf-8"))
    return {r["season"]: r for r in d["yearly"]}


def _reference() -> pd.DataFrame:
    return pd.read_csv(REF, comment="#")


def test_committed_export_is_the_real_offline_copy():
    m = json.loads((REAL / "meta.json").read_text(encoding="utf-8"))
    assert m.get("demo", {}).get("mode") == "real-offline-copy"


def test_reference_names_the_published_extremes():
    ref = _reference()
    assert ref.loc[ref.detected_km2.idxmax(), "year"] == 2014  # busiest year on record
    assert ref.loc[ref.detected_km2.idxmin(), "year"] == 2022  # quietest year on record


def test_sensor_ordering_matches_published_factor():
    # Vadrevu et al. 2019: VIIRS detects ~3.6x MODIS in Bangladesh. Assert the median N/A only
    # (2021-22/2022-23 depart on the known Aqua drift, so individual seasons are not asserted).
    y = _yearly()
    ratios = [r["raw_by_sensor"]["N"] / r["raw_by_sensor"]["A"]
              for r in y.values() if r["raw_by_sensor"].get("N") and r["raw_by_sensor"].get("A")]
    assert 2.5 <= float(np.median(ratios)) <= 5.0


def test_complete_season_extremes_match_the_reference():
    # The season containing the Mar-Apr 2014 peak is the maximum; the season containing
    # Mar-Apr 2022 is the minimum (aursee fire history). Exclude the trailing partial season.
    y = _yearly()
    seasons = [s for s in y if "2012-13" <= s <= "2024-25" and y[s]["raw_by_sensor"].get("N")]
    vals = {s: y[s]["raw_by_sensor"]["N"] for s in seasons}
    assert max(vals, key=vals.get) == "2013-14"
    assert min(vals, key=vals.get) == "2021-22"


def test_two_sensors_agree_on_the_same_fires():
    y = _yearly()
    both = [(r["raw_by_sensor"]["A"], r["raw_by_sensor"]["N"])
            for r in y.values() if r["raw_by_sensor"].get("A") and r["raw_by_sensor"].get("N")]
    assert _spearman([a for a, _ in both], [n for _, n in both]) > 0.4


def test_project_series_tracks_the_independent_reference():
    y, ref = _yearly(), _reference()
    proj, days = [], []
    for _, r in ref.iterrows():
        s = f"{int(r.year) - 1}-{int(r.year) % 100:02d}"  # calendar year Y ~ fire season (Y-1)-Y
        if s in y and y[s]["raw_by_sensor"].get("N"):
            proj.append(y[s]["raw_by_sensor"]["N"])
            days.append(r.fire_days)
    assert len(proj) >= 13
    assert _spearman(proj, days) >= 0.7
