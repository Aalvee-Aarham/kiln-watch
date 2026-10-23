"""Every exported file matches implementation_plan §7.3, under all five gate_branch fixture sets."""
import json
from pathlib import Path

import pytest

from kilnwatch import config as C
from kilnwatch.export import BRANCHES
from kilnwatch.fixtures import write_fixtures

FIXT = C.WEB_FIXT  # replaced below by a fresh set: the tests check the generator, never rewrite the committed fixtures


@pytest.fixture(scope="module", autouse=True)
def fixtures(tmp_path_factory):
    global FIXT
    FIXT = tmp_path_factory.mktemp("fixtures")
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


def test_real_offline_branch_is_really_real():
    """With the committed release tarball, the nokiln fixture set is a verbatim real export, labeled as such."""
    if not (C.ROOT / "data" / "releases" / "public-data.tar.gz").exists():
        pytest.skip("real release tarball not present")
    m = load("nokiln", "meta.json")
    assert m["demo"]["mode"] == "real-offline-copy"
    assert "firms" in m["data_versions"] and "fixtures" not in m["data_versions"]
    assert m["git_sha"] not in ("fixture", "unknown")
    cal = json.loads((FIXT / "nokiln" / "data" / "calendar" / "BD4561.json").read_text(encoding="utf-8"))
    assert cal["days"], "Mymensingh real calendar must carry observed days"


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
    for o in h.get("overlap", []):
        has(o, ["period", "seasons", "n_months", "n_districts", "ratio_raw", "ratio_harm", "ccc_raw", "ccc_harm"])
        assert o["period"] in ("calibration", "held_out")
        for k in ("ratio_raw", "ratio_harm", "ccc_raw", "ccc_harm"):
            assert o[k]["lo"] <= o[k]["hi"]


@pytest.mark.parametrize("branch", BRANCHES)
def test_south_asia_map(branch):
    fc = load(branch, "aoi/south_asia.geojson")
    assert sorted(f["properties"]["unit_id"] for f in fc["features"]) == ["AFG", "BGD", "BTN", "IND", "LKA", "MDV", "NPL", "PAK"]
    for f in fc["features"]:
        has(f["properties"], ["unit_id", "level", "name_en", "name_bn", "division", "kiln_count", "kiln_share"])
        assert f["geometry"]["type"] in ("Polygon", "MultiPolygon")


@pytest.mark.parametrize("branch", BRANCHES)
def test_world_map_names(branch):
    """Every place the world map can search for has a name in English and Bangla (search reads both)."""
    for rel in ("aoi/world_countries.geojson", "aoi/world_states.geojson"):
        for f in load(branch, rel)["features"]:
            assert isinstance(f["properties"]["name_en"], str) and f["properties"]["name_en"], (rel, f["properties"]["unit_id"])
            assert isinstance(f["properties"]["name_bn"], str) and f["properties"]["name_bn"], (rel, f["properties"]["unit_id"])
    c = load(branch, "aoi/world_cities.json")
    assert c["fields"][:2] == ["name_en", "name_bn"] and all(r[0] and r[1] for r in c["rows"])


@pytest.mark.parametrize("branch", BRANCHES)
def test_outlook(branch):
    if not (FIXT / branch / "data" / "outlook.json").exists():
        pytest.skip("optional file: no outlook when its backtest is not estimable (synthetic calendars)")
    o = load(branch, "outlook.json")
    has(o, ["rule", "start", "step_days", "window_days", "weeks", "backtest", "ships", "districts"])
    assert o["ships"] == (o["backtest"]["brier_skill"]["lo"] > 0)  # the ship rule
    for d in o["districts"].values():
        assert len(d["clim"]) == len(d["if_recent"]) == len(d["if_quiet"]) == o["weeks"]
        assert all(0 <= v <= 1 for k in ("clim", "if_recent", "if_quiet") for v in d[k] if v is not None)


@pytest.mark.parametrize("branch", BRANCHES)
def test_kiln_activity(branch):
    k = load(branch, "kiln_activity.json")
    has(k, ["layer", "pilots", "tests", "pass"])
    assert k["layer"] in ("ntl", "s1", None)
    for t in k["tests"]:
        has(t, ["test", "criterion", "value", "threshold", "pass"])
        assert t["test"] in ("GL", "GS")
    if k["layer"]:
        n = len(k["periods"])
        assert k["periods"] == sorted(k["periods"]) and k["cadence"] in ("half-month", "month")
        for a in [k["national"], *k["areas"].values()]:
            has(a, ["n_clusters", "seasons"])
            assert a["n_clusters"] >= 5
            for key in ("e", "lo", "hi"):
                assert key not in a or len(a[key]) == n
            for s in a["seasons"]:
                for m in ("onset", "end", "duration", "peak"):
                    assert s[m] is None or s[m]["lo"] <= s[m]["p50"] <= s[m]["hi"]
    rows = k.get("transfer", {}).get("countries", [])
    for c in rows + [r["retest"] for r in rows if "retest" in r]:  # Amendments 2-4: country-level only
        has(c, ["code", "name", "n_clusters", "channels"])
        assert "retest" not in c.get("retest", {}), "a retest has no retest of its own"
        for kind, ch in c["channels"].items():
            assert kind in ("ntl", "s1")
            core, off = ch["learned"]["core"], ch["learned"]["off"]
            assert len(core) == 5 and len(off) == 4 and not set(core) & set(off)
            assert all(len(ch["profile"][key]) == 12 for key in ("months", "p50", "lo", "hi"))
            for t in ch["tests"]:
                has(t, ["test", "criterion", "value", "threshold", "pass"])
                assert t["test"] in ("TL", "LL", "TS", "LS")
            assert set(ch["pass"]) <= {t["test"] for t in ch["tests"]}


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
    has(e, ["policy", "harvest", "satellite"])
    for ev in e["policy"] + e["satellite"]:  # every event is dated, bilingual and sourced
        has(ev, ["date", "label_en", "label_bn", "url"])
        assert ev["url"].startswith("https://")
    assert [x["date"] for x in e["satellite"]] == sorted(x["date"] for x in e["satellite"])
    n = load(branch, "nrt/current_season.json")
    assert n["provisional"] is True
    has(n, ["updated_at", "season", "day0", "national", "districts"])
    for lvl in ("districts", "upazilas"):
        g = load(branch, f"aoi/{lvl}.geojson")
        for f in g["features"]:
            has(f["properties"], ["unit_id", "level", "name_en", "name_bn", "division", "kiln_count", "kiln_share"])
    t = json.loads(next((FIXT / branch / "data" / "grid").glob("*.json")).read_text())
    assert all(len(r) == 3 for r in t["rows"])


NEWS_KINDS = {"burning", "enforcement", "kilns_operating", "air_health"}
NEWS_ITEM_KEYS = ["news_id", "url", "outlet", "lang", "title", "published_date_local", "event_date_local", "event_date_stated",
                  "kind", "unit_ids", "claim_en", "claim_bn", "quote", "sat", "season_so_far", "how_common", "earlier_news"]


def _check_window(w, national):
    has(w, ["from", "to", "unusual_days", "not_observed_days"])
    assert w["from"] <= w["to"]
    assert ("districts_unusual" in w) == national
    if national:
        assert w["unusual_days"] is None and isinstance(w["districts_unusual"], int)
    for k in ("unusual_days", "not_observed_days"):
        assert w[k] is None or (isinstance(w[k], int) and w[k] >= 0)


def check_news(news: Path):
    """news/ against web/src/lib/types.ts (NewsIndex, NewsPlaces, NewsSeason, NewsPlaceStories) and its own counts."""
    rd = lambda rel: json.loads((news / rel).read_text(encoding="utf-8"))  # noqa: E731
    idx = rd("index.json")
    assert set(idx) == {"generated_at", "store_updated_at", "data_build", "model", "seasons", "rules", "sources", "counts", "dropped"}
    assert set(idx["rules"]) == {"burn_window_days", "enforce_window_days", "cloudy_min_days", "rare_season_frac", "earlier_shown"}
    assert idx["seasons"] == sorted(idx["seasons"], reverse=True)
    for s in idx["sources"]:
        has(s, ["key", "outlet", "lang", "status"])
        assert s["lang"] in ("en", "bn") and s["status"] in ("active", "excluded")
    assert all(set(d) == {"reason", "n"} and d["n"] > 0 for d in idx["dropped"])
    places = rd("places.json")
    assert "BGD" in places and places["BGD"]["typical"] is None
    for u, p in places.items():
        assert set(p) == {"unit_id", "name_en", "name_bn", "record_from", "seasons_in_record", "seasons_with_burning",
                          "typical_duration_days", "typical", "news_total", "news_from"} and p["unit_id"] == u
        assert 0 <= p["seasons_with_burning"] <= p["seasons_in_record"]
        assert p["typical"] is None or set(p["typical"]) == {"first_month", "busiest_month", "last_month"}
    counts: dict = {}
    for season in idx["seasons"]:
        f = rd(f"{season}.json")
        assert f["season"] == season
        for month, items in f["months"].items():
            for it in items:
                assert list(it) == NEWS_ITEM_KEYS
                assert it["kind"] in NEWS_KINDS and it["lang"] in ("en", "bn") and it["event_date_local"][:7] == month
                national = it["unit_ids"] == ["BGD"]
                sat = it["sat"]
                if sat["type"] == "window":
                    assert sat["level"] == ("national" if national else "district") and isinstance(sat["provisional"], bool)
                    _check_window(sat["before"], national)
                    assert ("after" in sat) == (it["kind"] == "enforcement")
                    if sat.get("after"):
                        _check_window(sat["after"], national)
                else:
                    assert not national and sat["type"] == ("kiln_months" if it["kind"] == "kilns_operating" else "burning_season")
                    assert (sat["usual_months"] is None) == (sat["inside"] is None)
                sf = it["season_so_far"]
                has(sf, ["unusual_days", "not_observed_days", "provisional", "to"])
                assert ("districts_unusual" in sf) == national and sf["to"] <= it["event_date_local"]
                assert (it["how_common"] is None) == national
                assert it["how_common"] in (None, "common_now", "outside_season", "rare") and it["earlier_news"] >= 0
                for u in it["unit_ids"]:
                    counts.setdefault(season, {}).setdefault(u, 0)
                    counts[season][u] += 1
    assert counts == idx["counts"]
    for u in {u for c in counts.values() for u in c}:
        pf = rd(f"place/{u}.json")
        rows = [r for v in pf["months"].values() for r in v]
        assert pf["unit_id"] == u and len(rows) == places[u]["news_total"] == sum(c.get(u, 0) for c in counts.values())
        assert all(set(r) == {"news_id", "date_local", "season", "kind", "outlet", "lang", "title", "url"} for r in rows)
        assert [r["date_local"] for r in rows] == sorted((r["date_local"] for r in rows), reverse=True)
    assert len(list((news / "place").glob("*.json"))) == len({u for c in counts.values() for u in c})


@pytest.mark.parametrize("branch", BRANCHES)
def test_news(branch):
    """News files are optional: `full` ships the synthetic set, the other synthetic sets none, nokiln only once a real
    news store snapshot exists."""
    news = FIXT / branch / "data" / "news"
    if branch == "full":
        assert (news / "index.json").exists()
        check_news(news)
        idx = load(branch, "news/index.json")
        assert {"no_satellite_data", "blocklisted"} <= {d["reason"] for d in idx["dropped"]}
        kinds = {it["kind"] for s in idx["seasons"] for v in load(branch, f"news/{s}.json")["months"].values() for it in v}
        assert kinds == NEWS_KINDS
    elif branch == "nokiln" and news.exists():
        check_news(news)
    else:
        assert not news.exists()


def test_fixture_dir_is_not_public_dir():
    assert Path(C.WEB_FIXT).resolve() != C.WEB_DATA.resolve()
