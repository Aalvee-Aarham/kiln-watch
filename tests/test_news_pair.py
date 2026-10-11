"""news-pair (docs/news_plan.md §5.2-5.4, §11) on tiny synthetic exports with hand-computed answers. No real data."""
import json
from datetime import date, timedelta

import numpy as np
import pytest

from kilnwatch import config as C
from kilnwatch import news_pair as P
from kilnwatch import news_store as S
from kilnwatch.ask import MONTHS, _busy_months, _season_profile
from kilnwatch.nrt import above_p90

DAY0 = date(2003, 1, 1)
DISTRICTS = {"BD1001": ("Alpha", "আলফা"), "BD1002": ("Beta", "বেটা"), "BD1003": ("Gamma", "গামা")}
TEN_SEASONS = [f"{y}-{(y + 1) % 100:02d}" for y in range(2003, 2013)]  # calendar 2003-01-01 .. 2013-06-30


def idx(d: str) -> int:
    return (date.fromisoformat(d) - DAY0).days


def seasons(durations):
    return [{"season": s, "midpoint": None, "duration": None if v is None else {"p50": v, "lo": v, "hi": v}, "peak": None}
            for s, v in durations]


def calendar(uid, end="2013-06-30", h=None, unusual=(), nodata=(), durations=None, p90=1.0):
    """A sparse calendar file; clear_frac is dense, so the calendar covers 2003-01-01 .. `end`."""
    h = h or {}
    keys = sorted(h, key=idx)
    vals = [h[k] for k in keys]
    return {"unit_id": uid, "day0": "2003-01-01", "days": [idx(k) for k in keys], "raw": {"N": vals}, "h": vals, "split": [],
            "nodata": [[idx(a), idx(b)] for a, b in nodata], "week0": "2003-01-01", "h_lo": [], "h_hi": [],
            "normal": {"p10": [0.0] * 366, "p50": [0.0] * 366, "p90": [p90] * 366}, "unusual": sorted(idx(d) for d in unusual),
            "critical": [], "seasons": seasons(durations if durations is not None else [(s, 30.0) for s in TEN_SEASONS]),
            "clear_frac": {"N": [80] * (idx(end) + 1)}}


def profile(by_month: dict[int, float]) -> dict[str, float]:
    """h on every day of the given calendar months, 2003-07-01 .. 2013-06-30."""
    out, d = {}, date(2003, 7, 1)
    for _ in range(3653):  # bounded: ten seasons of days
        if d > date(2013, 6, 30):
            break
        if by_month.get(d.month):
            out[d.isoformat()] = by_month[d.month]
        d += timedelta(days=1)
    return out


def export(tmp_path, cals, nrt=None, kiln=None):
    feats = [{"type": "Feature", "geometry": None, "properties": {"unit_id": u, "level": "district", "name_en": en, "name_bn": bn}}
             for u, (en, bn) in DISTRICTS.items()]
    feats.append({"type": "Feature", "geometry": None, "properties": {"unit_id": "BD10010001", "level": "upazila", "name_en": "Up", "name_bn": "উপ"}})
    files = {"meta.json": {"git_sha": "test"}, "aoi/districts.geojson": {"type": "FeatureCollection", "features": feats},
             **{f"calendar/{u}.json": c for u, c in cals.items()}}
    if nrt is not None:
        files["nrt/current_season.json"] = nrt
    if kiln is not None:
        files["kiln_activity.json"] = kiln
    for rel, obj in files.items():
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")
    return tmp_path


def story(slug, kind, units, event, pub=None):
    url = f"https://example.com/news/{slug}"
    pub = pub or event
    from kilnwatch.grid import season_of

    it = {"news_id": S.news_id(url), "url": url, "source": "example_daily", "outlet": "Example Daily", "lang": "en",
          "title": f"Synthetic test story: {slug}", "published_date_local": pub, "event_date_local": event, "event_date_stated": True,
          "season": season_of(event), "kind": kind, "unit_ids": list(units), "claim_en": "A synthetic claim.", "claim_bn": "একটি কৃত্রিম দাবি।",
          "quote": "A synthetic quote.", "text_sha256": "0" * 64, "extracted_at": f"{pub}T00:00:00+00:00", "model": C.NEWS_MODEL}
    assert S.validate_item(it) == []
    return it


def store(*items, dropped=None):
    return {**S.empty(), "updated_at": "2026-01-01T00:00:00+00:00", "items": list(items), "dropped": dropped or {}}


def pair(src, *items, **kw):
    """Run news-pair; return (index, places, {news_id: item}, {unit: place file})."""
    kw = {"sources": None, "blocklist": None, "generated_at": "2026-01-01T00:00:00+00:00", **kw}
    res = P.run(src, store=store(*items, dropped=kw.pop("dropped", None)), **kw)
    n = src / "news"
    if res["published"] == 0:
        assert not n.exists()
        return None, None, {}, {}
    read = lambda p: json.loads(p.read_text(encoding="utf-8"))  # noqa: E731
    index, places = read(n / "index.json"), read(n / "places.json")
    items_out = {it["news_id"]: it for s in index["seasons"] for v in read(n / f"{s}.json")["months"].values() for it in v}
    place_files = {p.stem: read(p) for p in (n / "place").glob("*.json")}
    return index, places, items_out, place_files


def one(src, it, **kw):
    return pair(src, it, **kw)[2].get(it["news_id"])


# --- the shared p90 helper ------------------------------------------------------------------
def test_above_p90_matches_the_nrt_comparison():
    p90 = np.arange(366, dtype=float)  # day of season i has normal i
    h = np.array([1.0, 0.5, 3.0, 3.0] + [0.0] * 362 + [0.5, -1.0])  # 368 days: days 366, 367 wrap to normals 0 and 1
    assert above_p90(h, p90).tolist() == [True, False, True, False] + [False] * 362 + [True, False]
    assert above_p90(h, p90).tolist() == (h > p90[np.arange(len(h)) % 366]).tolist()  # the expression nrt.py used before


# --- what satellites saw ---------------------------------------------------------------------
def test_burning_window_and_season_so_far(tmp_path):
    cal = calendar("BD1001", unusual=["2009-06-30", "2010-01-02", "2010-01-05", "2010-01-09", "2010-01-11"],
                   nodata=[("2009-06-20", "2009-06-30"), ("2010-01-07", "2010-01-08")])
    it = one(export(tmp_path, {"BD1001": cal}), story("b", "burning", ["BD1001"], "2010-01-10"))
    assert it["sat"] == {"type": "window", "level": "district", "provisional": False,
                         "before": {"from": "2010-01-04", "to": "2010-01-10", "unusual_days": 2, "not_observed_days": 2}}
    # 1 July 2009 .. 10 Jan 2010 only: 30 June 2009 (last season) and 11 Jan (after the story) are not counted
    assert it["season_so_far"] == {"unusual_days": 3, "not_observed_days": 2, "provisional": False, "to": "2010-01-10"}


@pytest.mark.parametrize("cloudy,unusual", [(3, 1), (4, None)])
def test_cant_tell_when_most_of_the_window_was_not_observed(tmp_path, cloudy, unusual):
    end = (date(2010, 1, 4) + timedelta(days=cloudy - 1)).isoformat()
    cal = calendar("BD1001", unusual=["2010-01-09"], nodata=[("2010-01-04", end)])
    it = one(export(tmp_path, {"BD1001": cal}), story("c", "burning", ["BD1001"], "2010-01-10"))
    assert C.NEWS_CLOUDY_MIN_DAYS == 4
    assert it["sat"]["before"]["unusual_days"] == unusual and it["sat"]["before"]["not_observed_days"] == cloudy


@pytest.mark.parametrize("cloudy,unusual", [(7, 1), (8, None)])
def test_cant_tell_scales_to_the_14_day_window(tmp_path, cloudy, unusual):
    end = (date(2009, 12, 28) + timedelta(days=cloudy - 1)).isoformat()
    cal = calendar("BD1001", unusual=["2010-01-10"], nodata=[("2009-12-28", end)])
    it = one(export(tmp_path, {"BD1001": cal}), story("e", "enforcement", ["BD1001"], "2010-01-10"))
    assert it["sat"]["before"]["from"] == "2009-12-28"  # 14 days ending on the event date
    assert it["sat"]["before"]["unusual_days"] == unusual


def test_enforcement_after_window_is_null_until_complete(tmp_path):
    h = [0.0] * 40  # NRT 2013-07-01 .. 2013-08-09
    h[19], h[29] = 2.0, 3.0  # 20 July and 30 July above the p90 normal of 1.0
    nrt = {"season": "2013-14", "day0": "2013-07-01", "districts": {"BD1001": {"h": h, "above_p90_days": 2}}}
    src = export(tmp_path, {"BD1001": calendar("BD1001")}, nrt=nrt)
    done, open_ = story("done", "enforcement", ["BD1001"], "2013-07-26"), story("open", "enforcement", ["BD1001"], "2013-07-27")
    out = pair(src, done, open_)[2]
    a = out[done["news_id"]]["sat"]
    assert a["provisional"] is True
    assert a["before"] == {"from": "2013-07-13", "to": "2013-07-26", "unusual_days": 1, "not_observed_days": None}
    assert a["after"] == {"from": "2013-07-27", "to": "2013-08-09", "unusual_days": 1, "not_observed_days": None}
    assert out[open_["news_id"]]["sat"]["after"] is None  # 28 Jul .. 10 Aug: the last day is not in the data yet
    assert out[done["news_id"]]["season_so_far"] == {"unusual_days": 1, "not_observed_days": None, "provisional": True, "to": "2013-07-26"}


def test_burning_story_has_no_after_window(tmp_path):
    it = one(export(tmp_path, {"BD1001": calendar("BD1001")}), story("b", "burning", ["BD1001"], "2010-01-10"))
    assert "after" not in it["sat"]


KILN = {"layer": "ntl", "areas": {
    "BD1001": {"n_clusters": 10, "seasons": [
        {"season": "2008-09", "onset": {"p50": 0, "lo": 0, "hi": 0}, "end": {"p50": 365, "lo": 365, "hi": 365}},  # older than the last 3
        {"season": "2009-10", "onset": {"p50": 130, "lo": 120, "hi": 140}, "end": {"p50": 300, "lo": 290, "hi": 310}},
        {"season": "2010-11", "onset": {"p50": 138, "lo": 130, "hi": 146}, "end": {"p50": 305, "lo": 295, "hi": 315}},
        {"season": "2011-12", "onset": {"p50": 140, "lo": 130, "hi": 150}, "end": {"p50": 310, "lo": 300, "hi": 320}},
        {"season": "2012-13", "onset": {"p50": 10, "lo": 5, "hi": 15}, "end": None}]},  # no end: not used
    "BD1002": {"n_clusters": 3, "seasons": [{"season": "2011-12", "onset": {"p50": 130, "lo": 1, "hi": 200}, "end": {"p50": 300, "lo": 200, "hi": 330}}]}}}


def test_kiln_months_inside_outside_and_no_estimate(tmp_path):
    cals = {u: calendar(u) for u in DISTRICTS}
    jan, aug = story("jan", "kilns_operating", ["BD1001"], "2012-01-15"), story("aug", "kilns_operating", ["BD1001"], "2012-08-15")
    few, none = story("few", "kilns_operating", ["BD1002"], "2012-01-15"), story("none", "kilns_operating", ["BD1003"], "2012-01-15")
    out = pair(export(tmp_path, cals, kiln=KILN), jan, aug, few, none)[2]
    # median onset 138 -> November (day 123..152), median end 305 -> May (day 304..334)
    months = [11, 12, 1, 2, 3, 4, 5]
    assert out[jan["news_id"]]["sat"] == {"type": "kiln_months", "usual_months": months, "inside": True}
    assert out[aug["news_id"]]["sat"] == {"type": "kiln_months", "usual_months": months, "inside": False}
    for it in (few, none):  # fewer than 5 clusters, or no area: no estimate
        assert out[it["news_id"]]["sat"] == {"type": "kiln_months", "usual_months": None, "inside": None}


def test_air_health_uses_the_busy_months(tmp_path):
    cal = calendar("BD1001", h=profile({11: 0.5, 12: 1.0, 1: 1.0, 2: 0.5}))
    it = one(export(tmp_path, {"BD1001": cal}), story("air", "air_health", ["BD1001"], "2012-12-10"))
    assert it["sat"] == {"type": "burning_season", "usual_months": [11, 12, 1, 2], "inside": True}  # no outlook: no outlook_frac


def test_national_window_counts_districts(tmp_path):
    cals = {"BD1001": calendar("BD1001", unusual=["2010-01-08"]), "BD1002": calendar("BD1002", unusual=["2010-01-05", "2010-01-06"]),
            "BD1003": calendar("BD1003", unusual=["2010-01-01", "2009-08-01"])}
    it = one(export(tmp_path, cals), story("n", "burning", [S.NATIONAL], "2010-01-10"))
    assert it["sat"] == {"type": "window", "level": "national", "provisional": False,
                         "before": {"from": "2010-01-04", "to": "2010-01-10", "unusual_days": None, "not_observed_days": None, "districts_unusual": 2}}
    assert it["season_so_far"] == {"unusual_days": None, "not_observed_days": None, "districts_unusual": 3, "provisional": False, "to": "2010-01-10"}
    assert it["how_common"] is None


# --- how common is fire here ------------------------------------------------------------------
def test_busy_months_peaking_in_december(tmp_path):
    cal = calendar("BD1001", h=profile({10: 0.1, 11: 0.5, 12: 1.0, 1: 0.3}))
    busy = _busy_months(_season_profile(cal))
    assert busy == {"usual_first_month": "November", "busiest_month": "December", "usual_last_month": "January"}
    assert P.place_record(cal)["typical"] == {"first_month": 11, "busiest_month": 12, "last_month": 1}
    assert MONTHS.index("November") == 4  # season order (0 = July), the index the conversion starts from


def test_record_counts_full_seasons_and_only_positive_durations():
    durations = [("2002-03", 50.0)] + [(s, 30.0) for s in TEN_SEASONS[:6]] + [(TEN_SEASONS[6], 0.0), (TEN_SEASONS[7], None), ("2013-14", 40.0)]
    rec = P.place_record(calendar("BD1001", durations=durations))
    # 2003-01-01 .. 2013-06-30 holds the full seasons 2003-04 .. 2012-13; 2002-03 and 2013-14 are partial
    assert rec["record_from"] == "2003-04" and rec["seasons_in_record"] == 10
    assert rec["seasons_with_burning"] == 6  # duration 0 and a missing duration are not burning seasons
    assert rec["typical_duration_days"] == 30.0
    assert P.place_record(calendar("BD1001", end="2013-06-29"))["seasons_in_record"] == 9  # 2012-13 not complete


def test_verdict_inside_and_outside_the_typical_months(tmp_path):
    cal = calendar("BD1001", h=profile({11: 0.5, 12: 1.0, 1: 1.0, 2: 0.5}))
    jan, jul = story("jan", "burning", ["BD1001"], "2012-01-15"), story("jul", "burning", ["BD1001"], "2012-07-15")
    out = pair(export(tmp_path, {"BD1001": cal}), jan, jul)[2]
    assert out[jan["news_id"]]["how_common"] == "common_now"
    assert out[jul["news_id"]]["how_common"] == "outside_season"


@pytest.mark.parametrize("cal", [
    calendar("BD1001", durations=[]),  # all-zero calendar: no typical year
    calendar("BD1001", h=profile({11: 0.5, 12: 1.0, 1: 1.0, 2: 0.5}),
             durations=[(s, 30.0 if i < 3 else 0.0) for i, s in enumerate(TEN_SEASONS)]),  # 3 of 10 < 0.5
])
def test_rare(tmp_path, cal):
    assert C.NEWS_RARE_SEASON_FRAC == 0.5
    it = one(export(tmp_path, {"BD1001": cal}), story("r", "burning", ["BD1001"], "2012-01-15"))
    assert it["how_common"] == "rare"


def test_five_of_ten_is_not_rare():
    place = P.place_record(calendar("BD1001", h=profile({12: 1.0}), durations=[(s, 30.0 if i < 5 else 0.0) for i, s in enumerate(TEN_SEASONS)]))
    assert P.verdict(place, date(2011, 12, 5)) == "common_now"


# --- earlier news, places, counts ----------------------------------------------------------------
def test_earlier_news_counts_only_strictly_earlier_stories_of_the_first_unit(tmp_path):
    cals = {u: calendar(u) for u in DISTRICTS}
    a = story("a", "burning", ["BD1001"], "2011-12-01", "2011-12-02")
    b = story("b", "burning", ["BD1002", "BD1001"], "2011-12-03", "2011-12-04")  # names BD1001 second: still counts
    c = story("c", "burning", ["BD1003"], "2011-12-04", "2011-12-05")  # another district
    d = story("d", "burning", ["BD1001"], "2011-12-10", "2011-12-10")
    e = story("e", "burning", ["BD1001"], "2011-12-10", "2011-12-10")  # same day as d: neither is earlier
    out = pair(export(tmp_path, cals), a, b, c, d, e)[2]
    assert out[a["news_id"]]["earlier_news"] == 0
    assert out[b["news_id"]]["earlier_news"] == 0  # unit_ids[0] = BD1002 has nothing before it
    assert out[c["news_id"]]["earlier_news"] == 0
    assert out[d["news_id"]]["earlier_news"] == 2 and out[e["news_id"]]["earlier_news"] == 2


def test_multi_district_story_is_listed_under_every_unit(tmp_path):
    cals = {u: calendar(u) for u in DISTRICTS}
    m = story("m", "burning", ["BD1002", "BD1001"], "2011-12-03")
    index, places, out, pf = pair(export(tmp_path, cals), m, story("x", "burning", ["BD1001"], "2011-11-03"))
    assert index["counts"] == {"2011-12": {"BD1001": 2, "BD1002": 1}}
    assert set(pf) == {"BD1001", "BD1002"}
    assert m["news_id"] in {r["news_id"] for rows in pf["BD1002"]["months"].values() for r in rows}
    assert [r["news_id"] for rows in pf["BD1001"]["months"].values() for r in rows][0] == m["news_id"]  # newest first
    assert places["BD1001"]["news_total"] == 2 and places["BD1002"]["news_total"] == 1 and places["BD1003"]["news_total"] == 0
    assert places["BD1001"]["news_from"] == "2011-11-03"
    assert places[S.NATIONAL] == {"unit_id": "BGD", "name_en": "Bangladesh", "name_bn": "বাংলাদেশ", "record_from": None, "seasons_in_record": 0,
                                  "seasons_with_burning": 0, "typical_duration_days": None, "typical": None, "news_total": 0, "news_from": None}
    assert set(places) == set(DISTRICTS) | {S.NATIONAL}  # the upazila feature is not a place


def test_policy_and_blocklisted_items_never_appear(tmp_path):
    cals = {u: calendar(u) for u in DISTRICTS}
    keep = story("keep", "burning", ["BD1001"], "2011-12-01")
    pol = story("pol", "policy", [S.NATIONAL], "2011-12-02")
    bad = story("bad", "burning", ["BD1002"], "2011-12-03")
    index, places, out, pf = pair(export(tmp_path, cals), keep, pol, bad, blocklist=["http://www.example.com/news/bad/?utm=x"],
                                  dropped={"not_relevant": 2})
    assert set(out) == {keep["news_id"]}
    assert index["counts"] == {"2011-12": {"BD1001": 1}} and set(pf) == {"BD1001"}
    assert places["BD1002"]["news_total"] == 0 and places[S.NATIONAL]["news_total"] == 0
    assert index["dropped"] == [{"reason": "blocklisted", "n": 1}, {"reason": "not_relevant", "n": 2}]


def test_blocklist_csv(tmp_path):
    cals = {u: calendar(u) for u in DISTRICTS}
    bl = tmp_path / "news_blocklist.csv"
    bl.write_text("url,reason,removed_by,removed_on\nhttps://example.com/news/bad,wrong district,tester,2026-01-01\n", encoding="utf-8")
    out = pair(export(tmp_path / "x", cals), story("ok", "burning", ["BD1001"], "2011-12-01"), story("bad", "burning", ["BD1001"], "2011-12-02"), blocklist=bl)[2]
    assert len(out) == 1
    assert P._blocklist(tmp_path / "missing.csv") == set()


def test_out_of_coverage_story_is_dropped(tmp_path):
    cals = {u: calendar(u) for u in DISTRICTS}
    ok, late = story("ok", "burning", ["BD1001"], "2011-12-01"), story("late", "air_health", ["BD1001"], "2013-08-01")
    index, _, out, _ = pair(export(tmp_path, cals), ok, late)
    assert set(out) == {ok["news_id"]}
    assert {"reason": "no_satellite_data", "n": 1} in index["dropped"]


def test_no_published_story_writes_nothing(tmp_path):
    src = export(tmp_path, {u: calendar(u) for u in DISTRICTS})
    (src / "news").mkdir()
    (src / "news" / "index.json").write_text("{}", encoding="utf-8")  # left by an earlier run
    assert P.run(src, store=store(story("late", "burning", ["BD1001"], "2013-08-01")), sources=None, blocklist=None)["published"] == 0
    assert not (src / "news").exists()


# --- output safety and the contract ------------------------------------------------------------
def test_outputs_are_public_safe_and_follow_the_contract(tmp_path):
    cals = {u: calendar(u, h=profile({12: 1.0})) for u in DISTRICTS}
    items = [story("a", "burning", ["BD1001"], "2011-12-01"), story("b", "enforcement", ["BD1002", "BD1003"], "2011-12-05"),
             story("c", "kilns_operating", ["BD1001"], "2012-01-15"), story("d", "air_health", ["BD1003"], "2012-02-01"),
             story("e", "air_health", [S.NATIONAL], "2012-02-02")]
    src = export(tmp_path, cals, kiln=KILN)
    index, places, out, pf = pair(src, *items)
    assert set(index) == {"generated_at", "store_updated_at", "data_build", "model", "seasons", "rules", "sources", "counts", "dropped"}
    assert index["rules"] == {"burn_window_days": 7, "enforce_window_days": 14, "cloudy_min_days": 4, "rare_season_frac": 0.5, "earlier_shown": 3}
    assert index["data_build"] == "test" and index["seasons"] == ["2011-12"]
    assert index["sources"] == [{"key": "example_daily", "outlet": "Example Daily", "lang": "en", "status": "active", "read_back_to": None, "last_scanned": None}]
    assert len(out) == len(items)
    for it in out.values():
        assert tuple(it) == P.ITEM_KEYS
    for f in (src / "news").rglob("*.json"):
        for o, _ in P._walk(json.loads(f.read_text(encoding="utf-8"))):
            if isinstance(o, dict):
                assert not (C.FORBIDDEN_PUBLIC_KEYS | P.COORD_KEYS) & set(o), f
            if isinstance(o, list):
                assert len(o) <= C.NEWS_MAX_ITEMS_PER_MONTH


def test_generation_is_byte_identical(tmp_path):
    cals = {u: calendar(u) for u in DISTRICTS}
    src = export(tmp_path, cals)
    it = story("a", "burning", ["BD1001"], "2011-12-01")
    pair(src, it)
    first = {p.relative_to(src).as_posix(): p.read_bytes() for p in (src / "news").rglob("*.json")}
    pair(src, it)
    assert first == {p.relative_to(src).as_posix(): p.read_bytes() for p in (src / "news").rglob("*.json")}
    assert not (src / ".news-build").exists()


def test_rerun_removes_files_it_no_longer_writes(tmp_path):
    src = export(tmp_path, {u: calendar(u) for u in DISTRICTS})
    a, b = story("a", "burning", ["BD1001"], "2011-12-01"), story("b", "burning", ["BD1002"], "2010-12-01")
    pair(src, a, b)
    assert (src / "news" / "2010-11.json").exists() and (src / "news" / "place" / "BD1002.json").exists()
    pair(src, a)
    assert sorted(p.relative_to(src / "news").as_posix() for p in (src / "news").rglob("*.json")) == \
        ["2011-12.json", "index.json", "place/BD1001.json", "places.json"]


def test_month_over_the_cap_fails_the_stage_check(tmp_path, monkeypatch):
    cals = {u: calendar(u) for u in DISTRICTS}
    src = export(tmp_path, cals)
    monkeypatch.setattr(C, "NEWS_MAX_ITEMS_PER_MONTH", 1)
    with pytest.raises(AssertionError, match="NEWS_MAX_ITEMS_PER_MONTH"):
        pair(src, story("a", "burning", ["BD1001"], "2011-12-01"), story("b", "burning", ["BD1002"], "2011-12-02"))
    assert not (src / "news").exists()


def test_unknown_unit_fails_loudly(tmp_path):
    src = export(tmp_path, {u: calendar(u) for u in DISTRICTS})
    with pytest.raises(ValueError, match="not districts"):
        pair(src, story("a", "burning", ["BD9999"], "2011-12-01"))
