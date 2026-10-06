import json
from datetime import date
from pathlib import Path

import numpy as np
import pytest

from kilnwatch import config as C
from kilnwatch.grid import cell_center, cell_id, pixel_radius_m, season_of

CASES = [
    {"name": "dhaka", "lat": 23.7810, "lon": 90.4125, "id": 1136241},
    {"name": "faisalabad", "lat": 31.4200, "lon": 73.0800, "id": 3426508},
]


def test_cell_id_worked():
    lat, lon = 23.7810, 90.4125
    assert int(cell_id(lat, lon)) == 378 * 3000 + 2241 == 1_136_241


def test_center_roundtrip():
    la, lo = cell_center(1_136_241)
    assert abs(la - 23.785) < 1e-9 and abs(lo - 90.415) < 1e-9


def test_transfer_region():
    assert int(cell_id(31.42, 73.08)) == 3_426_508 != 1_136_241


@pytest.mark.parametrize("lat,lon", [(23.0, 100.0), (19.0, 90.0)])
def test_out_of_grid_raises(lat, lon):
    with pytest.raises(ValueError):
        cell_id(lat, lon)


def test_pixel_radius():
    assert abs(float(pixel_radius_m(0.39, 0.36)) - 265.4) < 0.1
    assert abs(float(pixel_radius_m(1.0, 1.0)) - 707.1) < 0.1


def test_unit_cell_count_arithmetic():
    rows = round((C.BBOX_N - C.BBOX_S) / C.GRID_STEP)
    cols = round((C.BBOX_E - C.BBOX_W) / C.GRID_STEP)
    assert rows * cols == 620 * 480 == 297_600


def test_season_of():
    assert season_of(date(2018, 6, 30)) == "2017-18"
    assert season_of(date(2018, 7, 1)) == "2018-19"


def test_write_grid_cases():
    """Writes the Python/TS parity fixture read by web/src/lib/box.test.ts."""
    out = {"grid": {"origin_lat": C.GRID_ORIGIN_LAT, "origin_lon": C.GRID_ORIGIN_LON, "step": C.GRID_STEP,
                    "rows": C.GRID_ROWS, "cols": C.GRID_COLS},
           "cases": CASES, "out_of_grid": [{"lat": 23.0, "lon": 100.0}, {"lat": 19.0, "lon": 90.0}]}
    for c in CASES:
        assert int(cell_id(c["lat"], c["lon"])) == c["id"]
    p = Path(__file__).parent / "fixtures" / "grid_cases.json"
    p.write_text(json.dumps(out, indent=1))
    assert np.isfinite(json.loads(p.read_text())["cases"][0]["id"])
