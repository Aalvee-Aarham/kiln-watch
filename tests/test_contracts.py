"""Every exported file matches implementation_plan §7.3, under all five gate_branch fixture sets."""
import json
from pathlib import Path

import pytest

from kilnwatch import config as C
from kilnwatch.export import BRANCHES, write_fixtures

FIXT = C.ROOT / "web" / "fixtures"


@pytest.fixture(scope="module", autouse=True)
def fixtures():
    write_fixtures(FIXT)


def load(branch, rel):
    return json.loads((FIXT / branch / "data" / rel).read_text(encoding="utf-8"))


def has(obj, keys):
    missing = [k for k in keys if k not in obj]
    assert not missing, missing


@pytest.mark.parametrize("branch", BRANCHES)
def test_meta(branch):
    m = load(branch, "meta.json")
    has(m, ["generated_at", "git_sha", "prereg_sha", "params", "data_versions", "credits", "non_claims", "gate_branch",
            "split_labels", "activity_index", "grid"])
    assert m["gate_branch"] == branch
    assert m["activity_index"]["key"] == ("HBI" if branch == "nokiln" else "HKFI")
    assert set(m["grid"]) == {"origin_lat", "origin_lon", "step", "rows", "cols"}
    assert len(m["non_claims"]) == 9


@pytest.mark.parametrize("branch", BRANCHES)
def test_calendars(branch):
    m = load(branch, "meta.json")
    keys = [s["key"] for s in m["split_labels"]]
    files = sorted((FIXT / branch / "data" / "calendar").glob("*.json"))
    assert len(files) >= 5
    for f in files:
        c = json.loads(f.read_text(encoding="utf-8"))
        has(c, ["unit_id", "day0", "days", "raw", "h", "split", "nodata", "week0", "h_lo", "h_hi", "normal", "unusual", "critical", "seasons"])
        n = len(c["days"])
        assert c["day0"] == "2003-01-01"
        assert c["days"] == sorted(c["days"])
        assert len(c["h"]) == n
        assert all(len(v) == n for v in c["raw"].values())
        assert [s["key"] for s in c["split"]] == keys
        assert all(len(s["values"]) == n for s in c["split"])
        if "index" in c:
            assert len(c["index"]) == n
        assert len(c["h_lo"]) == len(c["h_hi"])
        assert all(len(c["normal"][k]) == 366 for k in ("p10", "p50", "p90"))
        for s in c["seasons"]:
            for k in ("midpoint", "duration", "peak"):
                assert s[k]["lo"] <= s[k]["p50"] <= s[k]["hi"]


@pytest.mark.parametrize("branch", BRANCHES)
def test_harmonization(branch):
    h = load(branch, "harmonization.json")
    has(h, ["selected_model", "yearly", "betas", "loso_by_season", "loso_pooled", "seam"])
    has(h["seam"], ["d_raw", "d_harm", "ratio", "chow_p_raw", "chow_p_harm"])
    for b in h["betas"]:
        has(b, ["step", "division", "month", "pass", "loc", "beta", "rung_used", "n_celldays", "n_days"])


@pytest.mark.parametrize("branch", BRANCHES)
def test_validation(branch):
    v = load(branch, "validation.json")
    has(v, ["gates", "profiles", "radius_sweep", "classifier", "controls", "candidates"])
    assert {"spatial", "temporal", "cross_sensor_N_J1", "cross_sensor_J1_J2"} == {x["kind"] for x in v["classifier"]["holdouts"]}
    if "tropomi" in v:
        assert v["tropomi"]["treatment"] == ("HBI" if branch == "nokiln" else "HKFI")


@pytest.mark.parametrize("branch", BRANCHES)
def test_other_files(branch):
    e = load(branch, "events.json")
    has(e, ["policy", "harvest"])
    n = load(branch, "nrt/current_season.json")
    assert n["provisional"] is True
    has(n, ["updated_at", "season", "day0", "national", "districts"])
    for lvl in ("districts", "upazilas"):
        g = load(branch, f"aoi/{lvl}.geojson")
        for f in g["features"]:
            has(f["properties"], ["unit_id", "level", "name_en", "name_bn", "division", "kiln_count", "kiln_share"])
    t = json.loads(next((FIXT / branch / "data" / "grid").glob("*.json")).read_text())
    assert all(len(r) == 3 for r in t["rows"])


def test_fixture_dir_is_not_public_dir():
    assert Path(FIXT).resolve() != C.WEB_DATA.resolve()
