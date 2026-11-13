"""Run: python server/tests/test_alerts.py  — alert rule, once-per-month polling, n8n workflow shape (uses a temp store)."""
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from kw import alerts, tools  # noqa: E402


def test_tops_rule():
    assert alerts.tops(10, 5, 1.0, 5) is True
    assert alerts.tops(10, 10, 1.0, 5) is False          # equal to the median is not "above"
    assert alerts.tops(3, 0, 1.0, 5) is False            # tiny counts never alert
    assert alerts.tops(11, 5, 2.0, 5) is True and alerts.tops(9, 5, 2.0, 5) is False


def test_poll_notifies_once_per_month_and_workflow_has_token():
    alerts.FILE = Path(tempfile.mkdtemp()) / "alerts.json"
    a = alerts.create(region_id="punjab", ratio=0.5, min_hotspots=0)   # low bar: this month tops 0.5 x median
    first = alerts.check(a["token"], once=True)
    again = alerts.check(a["token"], once=True)
    assert first["status"] == "ready" and first["triggered"] is True and "not a forecast" in first["message"]
    assert again["triggered"] is False and again["already_notified"] is True
    assert alerts.check(a["token"])["triggered"] is True  # plain status ignores the once-per-month mark
    wf = alerts.workflow(a["token"], "http://host:8000/")
    assert wf["nodes"][1]["parameters"]["url"] == f"http://host:8000/api/alerts/{a['token']}/poll"
    alerts.delete(a["token"])
    try:
        alerts.check(a["token"])
        raise AssertionError("deleted alert still answered")
    except tools.NotFound:
        pass


def test_bad_input():
    for kw in ({"region_id": "nowhere"}, {"region_id": "punjab", "ratio": 0}, {"bbox": [0, 0, 50, 50]}):
        try:
            alerts.create(**kw)
            raise AssertionError(f"accepted {kw}")
        except (tools.NotFound, ValueError):
            pass


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
