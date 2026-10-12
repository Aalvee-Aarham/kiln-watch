"""Adversarial cases for the Ask agent; every case is a scripted model, so the suite runs with no network and no key."""
from kilnwatch.ask import Data, ask, harmonization_evidence
from tests.test_ask import FIXT, _client


def test_out_of_scope_question_answered_without_numbers():
    text = "I can only answer about fire activity in Bangladesh."
    client, _ = _client([text])
    out = ask("What is the capital of France?", client, Data(FIXT))
    assert out["blocked"] is False and out["answer"] == text and out["tools"] == []


def test_out_of_scope_with_invented_number_is_blocked():
    client, _ = _client(["Bangladesh has 42 districts with kilns."])
    out = ask("How many districts have kilns?", client, Data(FIXT))
    assert out["blocked"] is True and 42.0 in out["unsupported"]


def test_correct_number_wrong_claim_passes_the_guard_documented_limit():
    d = Data(FIXT)
    pct = harmonization_evidence(d)["share_of_2012_jump_removed_pct"]
    client, _ = _client([("tool", "harmonization_evidence", {})], [f"{pct}% of all fires in Bangladesh are removed by the correction."])
    out = ask("How many fires does the correction remove?", client, d)
    assert out["blocked"] is False  # the claim is false (pct is about the 2012 seam), but the guard checks values, not meaning


def test_empty_search_is_answered_honestly():
    client, _ = _client([("tool", "find_area", {"name": ""})], ["I could not find that place."])
    out = ask("Where is it?", client, Data(FIXT))
    assert out["tools"][0]["result"]["matches"] == [] and out["blocked"] is False


def test_unknown_tool_is_reported():
    client, _ = _client([("tool", "delete_everything", {})], ["Done."])
    out = ask("Clean up", client, Data(FIXT))
    assert out["tools"][0]["result"] == {"error": "unknown tool delete_everything"} and out["blocked"] is False
