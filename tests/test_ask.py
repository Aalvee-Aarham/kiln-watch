"""Ask Kiln Watch on the committed synthetic fixture, with a scripted client: no network, no key."""
import json
from types import SimpleNamespace as NS

from kilnwatch import config as C
from kilnwatch.ask import MAX_STEPS, Data, ask, find_area, guard, harmonization_evidence, numbers

FIXT = C.ROOT / "web" / "fixtures" / "full" / "data"  # synthetic, committed


def _client(*turns):
    """Each turn is a list of blocks; a tool call is ('tool', name, input), text is a str."""
    seen = []

    def create(**kw):
        seen.append(kw)
        blocks = turns[min(len(seen) - 1, len(turns) - 1)]
        content = [NS(type="tool_use", id=f"t{i}", name=b[1], input=b[2]) if isinstance(b, tuple) else NS(type="text", text=b) for i, b in enumerate(blocks)]
        return NS(content=content, stop_reason="tool_use" if any(c.type == "tool_use" for c in content) else "end_turn")

    return NS(beta=NS(messages=NS(create=create))), seen


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
    assert seen[0]["model"] == "claude-opus-5-5" and all("tool_choice" not in kw for kw in seen)  # auto: forced choice is a 400 on Opus 5.5
    assert json.loads(seen[1]["messages"][-1]["content"][0]["content"])["share_of_2012_jump_removed_pct"] == pct


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
