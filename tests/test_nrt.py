from types import SimpleNamespace

import pytest

from kilnwatch import config as C
from kilnwatch import ingest, nrt


def _fake_session(status, text):
    reply = SimpleNamespace(status_code=status, text=text, ok=200 <= status < 400)
    return lambda: SimpleNamespace(get=lambda url, timeout: reply)


@pytest.mark.parametrize("status,text", [(400, "Invalid MAP_KEY."), (400, "Exceeding allowed transaction limit"), (503, "<html>down</html>")])
def test_non_csv_reply_fails_and_hides_key(monkeypatch, status, text):
    monkeypatch.setattr(C, "FIRMS_MAP_KEY", "SECRETKEY123")
    monkeypatch.setattr(ingest, "session", _fake_session(status, text))
    with pytest.raises(RuntimeError) as e:
        nrt.fetch(5)
    assert "SECRETKEY123" not in str(e.value)


@pytest.mark.parametrize("status,text", [(404, ""), (200, ""), (200, "  \n")])
def test_empty_reply_is_no_detections(monkeypatch, status, text):
    monkeypatch.setattr(ingest, "session", _fake_session(status, text))
    assert nrt.fetch(5).empty
