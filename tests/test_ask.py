"""Ask Kiln Watch on the committed synthetic fixture, with a scripted client: no network, no key."""
import json
import shutil
from types import SimpleNamespace as NS

import numpy as np
import pandas as pd

from kilnwatch import config as C
from kilnwatch.ask import (
    DEMO_QUESTIONS,
    MAX_STEPS,
    MONTHS,
    SYSTEM,
    Data,
    _busy_months,
    ask,
    build_cache,
    find_area,
    guard,
    harmonization_evidence,
    numbers,
    this_season,
)

FIXT = C.ROOT / "web" / "fixtures" / "full" / "data"  # synthetic, committed


def _client(*turns):
    """Scripted Gemini: each turn is a list of blocks, or (blocks, "refusal"); a tool call is ('tool', name, args), text is a str.
    Returns (client, seen): the client takes a generateContent body and answers in Gemini's JSON shape."""
    seen = []

    def generate(body):
        seen.append(body)
        turn = turns[min(len(seen) - 1, len(turns) - 1)]
        blocks, stop = turn if isinstance(turn, tuple) else (turn, None)
        if stop == "refusal":
            return {"candidates": [{"finishReason": "SAFETY"}]}
        parts = [{"functionCall": {"id": f"t{i}", "name": b[1], "args": b[2]}} if isinstance(b, tuple) else {"text": b} for i, b in enumerate(blocks)]
        return {"candidates": [{"content": {"role": "model", "parts": parts}, "finishReason": "STOP"}]}

    return generate, seen


def test_numbers_reads_bangla_digits_and_ignores_codes():
    assert numbers("৯৭% of BD3026 in 2012-13, 1,234.5") == {97.0, 2012.0, 13.0, 1234.5}  # a hyphen between digits is not a minus


def test_guard_blocks_a_number_no_tool_returned():
    assert guard("Burning peaks in March, 97% removed.", [{"share_pct": 97}]) == []
    assert guard("About 40% more fire this year.", [{"share_pct": 97}]) == [40.0]


def test_loop_calls_project_functions_and_passes_the_gate():
    d = Data(FIXT)
    pct = harmonization_evidence(d)["share_of_2012_jump_removed_pct"]
    client, seen = _client([("tool", "harmonization_evidence", {})], [f"The correction removed {pct}% of the 2012 jump."])
    out = ask("Did the correction work?", client, d)
    assert out["answer"] and not out["blocked"] and out["tools"][0]["name"] == "harmonization_evidence"
    assert all(b["toolConfig"]["functionCallingConfig"]["mode"] == "AUTO" for b in seen)  # the model chooses; never forced
    assert all(b["systemInstruction"]["parts"][0]["text"] == SYSTEM for b in seen)  # instructions never inside the user turn
    assert seen[1]["contents"][-1]["parts"][0]["functionResponse"] == {"id": "t0", "name": "harmonization_evidence", "response": out["tools"][0]["result"]}
    assert seen[1]["contents"][-1]["parts"][0]["functionResponse"]["response"]["share_of_2012_jump_removed_pct"] == pct
    assert seen[1]["contents"][-2] == {"role": "model", "parts": [{"functionCall": {"id": "t0", "name": "harmonization_evidence", "args": {}}}]}  # whole turn echoed


def test_invented_number_is_blocked():
    client, _ = _client([("tool", "find_area", {"name": "Dhaka"})], ["Dhaka burns 12345 times a year."])
    out = ask("How much does Dhaka burn?", client, Data(FIXT))
    assert out["blocked"] and out["answer"] is None and 12345.0 in out["unsupported"]


def test_step_cap():
    client, seen = _client([("tool", "find_area", {"name": "Dhaka"})])  # never stops calling tools
    out = ask("loop", client, Data(FIXT))
    assert out["blocked"] and len(seen) == MAX_STEPS


def test_find_area_puts_the_district_first():
    m = find_area(Data(FIXT), "Dhaka")["matches"]
    assert m[0]["name_en"] == "Dhaka" and m[0]["level"] == "district"


def test_tool_arguments_cannot_reach_a_path_or_crash_the_loop():
    from kilnwatch.ask import _run, area_fire_calendar

    d = Data(FIXT)
    for bad in ("../../../outside/x", "BD3026/../../meta", 3026, None):
        assert "error" in _run(area_fire_calendar, d, {"unit_id": bad})
    assert "error" in _run(area_fire_calendar, d, {"unit_id": "BD3026", "extra": 1})  # unexpected argument: reported, not raised
    assert "error" not in _run(area_fire_calendar, d, {"unit_id": "BD3026"})


def test_outlook_tool_matches_the_web_rule_at_the_window_start(tmp_path):
    """Data to 31 October: the forecast for 1-14 November is row 0 (web/src/lib/outlook.test.ts has the same case)."""
    import shutil

    from kilnwatch.ask import two_week_outlook

    src = tmp_path / "data"
    shutil.copytree(C.ROOT / "web" / "fixtures" / "nokiln" / "data", src)
    nrt = json.loads((src / "nrt" / "current_season.json").read_text(encoding="utf-8"))
    for v in nrt["districts"].values():
        v["h"] = [0.0] * 123  # 1 Jul .. 31 Oct 2026, no fire
    (src / "nrt" / "current_season.json").write_text(json.dumps(nrt), encoding="utf-8")
    out = two_week_outlook(Data(src), "BD3026")
    o = json.loads((src / "outlook.json").read_text(encoding="utf-8"))
    assert out["data_to"] == "2026-10-31" and out["state"] == "on"
    assert out["usual_chance_for_time_of_year_pct"] == round(100 * o["districts"]["BD3026"]["clim"][0])


def test_refusal_is_reported_not_filled_in():
    client, _ = _client(([], "refusal"))
    out = ask("anything", client, Data(FIXT))
    assert out["blocked"] is True and out["reason"] == "refusal" and out["answer"] is None and out["tools"] == []


def test_build_cache_writes_payload_and_keeps_blocked_answers(tmp_path):
    shutil.copytree(FIXT, tmp_path / "data")
    n = len(DEMO_QUESTIONS)
    turns = [["No numbers here."] for _ in range(n)]
    turns[1] = ["There are 42 districts."]  # one model turn per question, so only question 1 invents a number
    client, seen = _client(*turns)
    p = build_cache(tmp_path / "data", client=client, out=tmp_path / "ask.json")
    assert (tmp_path / "ask.json").exists() and len(seen) == n
    assert p["model"] == "gemini-3.5-flash-lite" and len(p["answers"]) == n
    assert [a["blocked"] for a in p["answers"]] == [i == 1 for i in range(n)]
    assert 42.0 in p["answers"][1]["unsupported"]
    assert [a["lang"] for a in p["answers"]] == [lang for _, lang in DEMO_QUESTIONS]
    assert p["data_build"] == json.loads((FIXT / "meta.json").read_text(encoding="utf-8"))["git_sha"]
    assert json.loads((tmp_path / "ask.json").read_text(encoding="utf-8")) == p


def test_this_season_reads_the_district_and_marks_provisional():
    nrt = json.loads((FIXT / "nrt" / "current_season.json").read_text(encoding="utf-8"))
    dist = next(iter(nrt["districts"]))
    out = this_season(Data(FIXT), dist)
    h = nrt["districts"][dist]["h"]
    assert out["data_to"] == (pd.Timestamp(nrt["day0"]) + pd.Timedelta(days=len(h) - 1)).strftime("%Y-%m-%d")
    assert out["unusual_days_so_far"] == nrt["districts"][dist]["above_p90_days"]
    assert out["provisional"] is True and out["season"] == nrt["season"]
    assert "BD9999" not in nrt["districts"]
    assert this_season(Data(FIXT), "BD9999") == {"error": "no live data for this district"}


def test_busy_months_all_zero_year_returns_none():
    assert MONTHS[5] == "December"  # the season year starts in July
    assert _busy_months(np.zeros(366)) is None
    x = np.zeros(366)
    x[153:184] = 1.0  # 1-31 December in the July-start season year
    assert _busy_months(x) == {"usual_first_month": "December", "busiest_month": "December", "usual_last_month": "December"}


def test_when_text_matches_the_web_rule():
    from kilnwatch.ask import _when_text

    # the same fixed cases as web/src/lib/plain.test.ts whenText
    assert [_when_text(d) for d in (0, 153, 168, 183)] == ["early July", "early December", "mid-December", "late December"]


def test_kiln_seasons_national_and_area():
    import math
    import statistics

    from kilnwatch.ask import _when_text, kiln_seasons

    ka = json.loads((FIXT / "kiln_activity.json").read_text(encoding="utf-8"))
    for uid, block in ((None, ka["national"]), ("BD3026", ka["areas"]["BD3026"])):
        rows = [r for r in block["seasons"] if r["onset"] and r["end"]][-3:]
        out = kiln_seasons(Data(FIXT), uid) if uid else kiln_seasons(Data(FIXT))
        t = out["typical_season"]
        assert out["kiln_clusters"] == block["n_clusters"]
        assert t["starts"] == _when_text(statistics.median(r["onset"]["p50"] for r in rows))
        assert t["ends"] == _when_text(statistics.median(r["end"]["p50"] for r in rows))
        dur = statistics.median(r["duration"]["p50"] if r["duration"] else r["end"]["p50"] - r["onset"]["p50"] for r in rows)
        assert t["length_days"] == math.floor(dur + 0.5)
        assert t["seasons_used"] == [r["season"] for r in rows]


def test_kiln_seasons_honest_errors(tmp_path):
    from kilnwatch.ask import _run, kiln_seasons

    shutil.copytree(FIXT, tmp_path / "d")
    (tmp_path / "d" / "kiln_activity.json").unlink()
    assert "no kiln analysis" in kiln_seasons(Data(tmp_path / "d"))["error"]
    assert kiln_seasons(Data(FIXT), "BD99") == {"error": "no kiln season for BD99"}
    # "national" is asked for by omitting unit_id; a string that is not an area code never reaches the tool
    assert "unit_id must be an area code" in _run(kiln_seasons, Data(FIXT), {"unit_id": "national"})["error"]


def test_national_trend_matches_harmonization_yearly():
    from kilnwatch.ask import national_trend

    y = json.loads((FIXT / "harmonization.json").read_text(encoding="utf-8"))["yearly"]
    out = national_trend(Data(FIXT))
    peak = max(y, key=lambda r: r["h"]["p50"])
    assert out["n_seasons"] == len(y)
    assert out["first_season"] == {"season": y[0]["season"], "harmonized": y[0]["h"]["p50"]}
    assert out["latest_season"] == {"season": y[-1]["season"], "harmonized": y[-1]["h"]["p50"], "range_95": [y[-1]["h"]["lo"], y[-1]["h"]["hi"]]}
    assert out["peak_season"] == {"season": peak["season"], "harmonized": peak["h"]["p50"]}


def test_new_tool_outputs_are_public_safe():
    from kilnwatch.ask import kiln_seasons, national_trend
    from kilnwatch.export import assert_public_safe

    for out in (kiln_seasons(Data(FIXT)), kiln_seasons(Data(FIXT), "BD3026"), national_trend(Data(FIXT))):
        assert "error" not in out
        assert_public_safe(out)  # raises on a forbidden key such as kiln_id or a kiln coordinate


def test_retry_delay_follows_geminis_retry_info_and_is_capped():
    from kilnwatch.ask import _retry_delay

    def reply(body):
        return NS(json=lambda: body)

    rate = {"error": {"details": [{"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "36s"}]}}
    assert _retry_delay(reply(rate), default=2) == 37.0
    assert _retry_delay(reply({"error": {"details": [{"@type": "x.RetryInfo", "retryDelay": "300s"}]}}), default=2) == 60.0
    assert _retry_delay(reply({"error": {"code": 503}}), default=4) == 4


def test_gemini_client_retries_a_rate_limit_then_succeeds(monkeypatch):
    import time

    from kilnwatch import ask as A

    replies = [NS(status_code=429, ok=False, text="", json=lambda: {}), NS(status_code=200, ok=True, text="", json=lambda: {"candidates": []})]
    posts = []
    monkeypatch.setattr(time, "sleep", lambda s: None)
    monkeypatch.setattr("requests.Session.post", lambda self, *a, **k: posts.append(k) or replies[len(posts) - 1])
    assert A.gemini_client("test-key")({"contents": []}) == {"candidates": []}
    assert len(posts) == 2 and posts[0]["headers"] == {"x-goog-api-key": "test-key"}  # the key only in the header


def test_tools_return_what_unusual_means_so_the_90_is_traceable():
    from kilnwatch.ask import UNUSUAL_MEANS, two_week_outlook

    assert "90th-percentile" in UNUSUAL_MEANS and numbers(UNUSUAL_MEANS) == {90.0}
    assert this_season(Data(FIXT), "BD3026")["unusual_day_means"] == UNUSUAL_MEANS
    nokiln = C.ROOT / "web" / "fixtures" / "nokiln" / "data"
    assert two_week_outlook(Data(nokiln), "BD3026")["unusual_day_means"] == UNUSUAL_MEANS
    # so an answer that explains the threshold now passes the guard
    assert guard("Unusual means above the 90th percentile.", [this_season(Data(FIXT), "BD3026")]) == []


def test_p_values_are_reported_so_they_can_be_quoted_exactly():
    from kilnwatch.ask import _p_value

    assert _p_value(5.953444009358959e-05) == "below 0.001" and _p_value(0.0001) == "below 0.001"
    assert _p_value(0.2858583481577078) == 0.286 and _p_value(0.001) == 0.001
    out = harmonization_evidence(Data(C.ROOT / "web" / "fixtures" / "nokiln" / "data"))
    assert (out["chow_p_raw"], out["chow_p_harmonized"]) == ("below 0.001", 0.286)
    assert guard("The break is significant before (p below 0.001) and gone after (p = 0.286).", [out]) == []

