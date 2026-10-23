"""CLI smoke: dispatch wiring, the `ask` usage error and `all`'s fail-fast GEE-cache guard (implementation_plan §7.1)."""
import pytest

from kilnwatch import __main__ as M


def test_ask_without_question_is_a_usage_error(capsys):
    assert M.main(["ask"]) == 2
    assert "give a question" in capsys.readouterr().err


def test_all_fails_fast_without_the_gee_cache(monkeypatch, tmp_path, capsys):
    (tmp_path / "gee" / "clear" / "admin").mkdir(parents=True)  # the exact tree the guard requires
    assert M._gee_cache_ready(tmp_path) and not M._gee_cache_ready(tmp_path / "gee")
    monkeypatch.setattr(M, "_gee_cache_ready", lambda root: False)
    assert M.main(["all"]) == 2
    assert "GeeCacheMissing" in capsys.readouterr().err


def test_unknown_stage_is_an_argparse_error():
    with pytest.raises(SystemExit) as e:
        M.main(["bogus"])
    assert e.value.code == 2


def test_export_dispatch_passes_every_flag(monkeypatch, tmp_path):
    from kilnwatch import export

    calls = {}
    monkeypatch.setattr(export, "run", lambda *a: calls.update(args=a))
    assert M.main(["export", "--check-public", str(tmp_path)]) == 0
    assert calls["args"] == (False, False, str(tmp_path), False)

    assert M.main(["export", "--regulator", "--fixtures"]) == 0
    assert calls["args"] == (True, True, None, False)


def test_verify_firms_dispatch(monkeypatch):
    from kilnwatch import verify_firms

    calls = {}
    monkeypatch.setattr(verify_firms, "run", lambda *a: calls.update(args=a))
    assert M.main(["verify-firms", "--cached-only", "--start", "2024-01-01"]) == 0
    assert calls["args"] == (None, "2024-01-01", None, True)


def test_release_publishes_then_rebuilds_fixtures_from_the_fresh_release(monkeypatch):
    from kilnwatch import export

    calls = []
    monkeypatch.setattr(export, "run", lambda **kw: calls.append(("export", kw)))
    monkeypatch.setattr(M.subprocess, "run", lambda argv, **kw: calls.append(("gh", argv[:3])))
    monkeypatch.setattr(M.shutil, "rmtree", lambda path, **kw: calls.append(("rmtree", path.name)))
    assert M.main(["release"]) == 0
    assert calls == [("export", {"publish_": True}), ("gh", ["gh", "release", "download"]),
                     ("rmtree", "public"), ("export", {"fixtures": True})]

