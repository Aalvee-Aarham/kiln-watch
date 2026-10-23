"""Golden outputs of the Python Ask tools, for the worker's TypeScript parity tests (plans/005).

Run from the repo root: `PYTHONPATH=. python ask-worker/scripts/make_goldens.py`. It writes
`ask-worker/test/golden/<tool>.json` and `ask-worker/src/spec.json` (system prompt, tool schemas, model, step cap),
so the worker never carries a hand-copied prompt. `tests/test_ask_goldens.py` rebuilds both in memory and fails
when they drift from what is committed.
"""
from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path

from kilnwatch import ask
from kilnwatch import config as C

OUT = C.ROOT / "ask-worker"
FIXTURES = C.ROOT / "web" / "fixtures"
NOV_DAYS = 123  # 1 Jul .. 31 Oct 2026: the day before the outlook window opens (as in tests/test_ask.py)

# per tool: (dataset, arguments). Tools that take arguments get a happy and an error input; tools that take none get {}.
CASES: dict[str, list[tuple[str, dict]]] = {
    "find_area": [("full", {"name": "Dhaka"}), ("full", {"name": "rajshahi"}), ("full", {"name": ""}), ("full", {"name": "nowhere"})],
    "area_fire_calendar": [("full", {"unit_id": "BD3026"}), ("nokiln", {"unit_id": "BD3026"}), ("full", {"unit_id": "BD99"}),
                           ("full", {"unit_id": "../meta"})],
    "this_season": [("full", {"unit_id": "BD3026"}), ("full", {"unit_id": "BD302614"}), ("full", {"unit_id": "BD9999"})],
    "two_week_outlook": [("full", {"unit_id": "BD3026"}), ("nokiln", {"unit_id": "BD3026"}), ("nokiln_nov", {"unit_id": "BD3026"}),
                         ("nokiln_nov", {"unit_id": "BD5081"}), ("nokiln", {"unit_id": "BD9999"})],
    "harmonization_evidence": [("full", {}), ("nokiln", {})],
    "kiln_seasons": [("full", {}), ("full", {"unit_id": "BD3026"}), ("full", {"unit_id": "BD99"}), ("nokiln", {})],
    "national_trend": [("full", {}), ("nokiln", {})],
}


def nokiln_nov(root: Path) -> Path:
    """The nokiln fixture with every district's live series set to NOV_DAYS zero days (data to 31 October)."""
    dst = root / "nokiln_nov"
    shutil.copytree(FIXTURES / "nokiln" / "data", dst)
    p = dst / "nrt" / "current_season.json"
    nrt = json.loads(p.read_text(encoding="utf-8"))
    for v in nrt["districts"].values():
        v["h"] = [0.0] * NOV_DAYS
    p.write_text(json.dumps(nrt), encoding="utf-8")
    return dst


SAMPLE_CONTENTS = [{"role": "user", "parts": [{"text": "When does Dhaka burn?"}]}]


def spec() -> dict:
    """What the worker needs to make exactly the requests ask.py makes: model, cap, refusal reasons, prompt, tools."""
    return {"model": ask.MODEL, "max_steps": ask.MAX_STEPS, "gemini": ask.GEMINI, "refusals": sorted(ask.REFUSALS),
            "system": ask.SYSTEM, "tools": ask.GEMINI_TOOLS, "site": ask.SITE, "fire": ask.FIRE,
            "sample_request": {"contents": SAMPLE_CONTENTS, "body": ask.request(SAMPLE_CONTENTS)}}


def build() -> dict[str, list]:
    with tempfile.TemporaryDirectory() as tmp:
        dirs = {"full": FIXTURES / "full" / "data", "nokiln": FIXTURES / "nokiln" / "data", "nokiln_nov": nokiln_nov(Path(tmp))}
        assert set(CASES) == set(ask.FUNCS), "every agent tool needs golden cases"
        return {name: [{"data": ds, "input": args, "output": json.loads(json.dumps(ask._run(ask.FUNCS[name], ask.Data(dirs[ds]), args)))}
                       for ds, args in CASES[name]] for name in CASES}


def dumps(obj) -> str:
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, indent=1) + "\n"


if __name__ == "__main__":
    (OUT / "test" / "golden").mkdir(parents=True, exist_ok=True)
    for name, cases in build().items():
        (OUT / "test" / "golden" / f"{name}.json").write_text(dumps(cases), encoding="utf-8")
    (OUT / "src" / "spec.json").write_text(dumps(spec()), encoding="utf-8")
    print(f"wrote {len(CASES)} golden files and src/spec.json")
