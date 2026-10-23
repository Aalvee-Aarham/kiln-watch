"""The worker's golden files and spec.json equal what the Python agent produces now (plans/005).

Rebuilt in memory, never written: a Python-side change to a tool, the prompt or the tool schemas fails here until
`PYTHONPATH=. python ask-worker/scripts/make_goldens.py` is rerun and the TypeScript port is checked against it.
"""
import importlib.util
import json

from kilnwatch import config as C

_spec = importlib.util.spec_from_file_location("make_goldens", C.ROOT / "ask-worker" / "scripts" / "make_goldens.py")
mg = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mg)  # the folder name has a hyphen, so it cannot be imported by name


def test_golden_files_match_the_python_tools():
    built = mg.build()
    for name, cases in built.items():
        committed = json.loads((C.ROOT / "ask-worker" / "test" / "golden" / f"{name}.json").read_text(encoding="utf-8"))
        assert committed == cases, f"{name}: rerun ask-worker/scripts/make_goldens.py and check the worker port"


def test_spec_matches_the_python_agent():
    committed = json.loads((C.ROOT / "ask-worker" / "src" / "spec.json").read_text(encoding="utf-8"))
    assert committed == json.loads(json.dumps(mg.spec()))
