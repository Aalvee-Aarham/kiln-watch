import json
import re
import subprocess

from kilnwatch import config as C

PRE = ["FIRING_MONTHS", "MONSOON_MONTHS", "CONF_KEEP", "MIN_SNPP_CELLDAYS", "MIN_PAIRED_DAYS", "LOSO_COVERAGE_TARGET",
       "SEAM_RATIO_MAX", "CONTROL_DROP_MAX", "CONTROL_DROP_MAX_DIV", "GATE_SEASON"]


def test_preregistered_constants_match():
    text = (C.ROOT / "docs" / "PREREGISTRATION.md").read_text(encoding="utf-8")
    for name in PRE:
        m = re.search(rf"^{name} = (.+)$", text, re.M)
        assert m, f"{name} missing from docs/PREREGISTRATION.md"
        assert eval(m.group(1)) == getattr(C, name), name


def test_derived_constants_carry_source_and_date():
    if not C.DERIVED_PATH.exists():
        return
    for k, v in json.loads(C.DERIVED_PATH.read_text(encoding="utf-8")).items():
        assert v.get("source") and v.get("date"), k


def test_prereg_commit_precedes_reports():
    def first(path):
        out = subprocess.run(["git", "log", "--reverse", "--format=%ct", "--", path], cwd=C.ROOT, capture_output=True, text=True).stdout.split()
        return int(out[0]) if out else None

    # History stays on the original root path: its first commit is the pre-registration's creation,
    # which must keep preceding reports/ even after the file moved to docs/.
    pre, rep = first("PREREGISTRATION.md"), first("reports")
    assert pre is not None
    assert rep is None or pre <= rep
