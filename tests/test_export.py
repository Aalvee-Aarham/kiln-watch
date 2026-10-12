import json

import pytest

from kilnwatch import config as C
from kilnwatch.export import assert_public_safe, check_public_dir, write_regulator


@pytest.mark.parametrize("key", sorted(C.FORBIDDEN_PUBLIC_KEYS))
def test_public_safe_names(key):
    with pytest.raises(ValueError):
        assert_public_safe({"ok": [{"nested": {key: 1}}]})


def test_public_safe_values(tmp_path):
    f = tmp_path / "a.json"
    f.write_text(json.dumps({"type": "Feature", "geometry": {"type": "Point", "coordinates": [90.1, 23.2]}}))
    with pytest.raises(ValueError):
        check_public_dir(tmp_path, n_clusters=120, n_kilns=900)
    f.write_text(json.dumps({"leak": list(range(120))}))
    with pytest.raises(ValueError):
        check_public_dir(tmp_path, n_clusters=120, n_kilns=900)
    f.write_text(json.dumps({"fine": list(range(10))}))
    check_public_dir(tmp_path, n_clusters=120, n_kilns=900)


def test_regulator_path_guard():
    with pytest.raises(ValueError):
        write_regulator(C.ROOT / "web" / "public" / "regulator")


def test_rebuild_drops_an_outlook_it_cannot_estimate(tmp_path):
    """An outlook.json left by an earlier build must not survive a build whose backtest is not estimable."""
    import shutil

    from kilnwatch.export import add_overlap

    src = C.ROOT / "web" / "fixtures" / "full" / "data"  # synthetic, committed
    d = tmp_path / "data"
    (d / "calendar").mkdir(parents=True)
    shutil.copy(src / "harmonization.json", d / "harmonization.json")
    shutil.copy(src / "calendar" / "BD3026.json", d / "calendar" / "BD3026.json")  # one district: no backtest possible
    (d / "outlook.json").write_text('{"ships": true}')
    add_overlap(d)
    assert not (d / "outlook.json").exists()


def test_check_budgets_flags_flat_oversize_only(tmp_path):
    from kilnwatch.export import check_budgets

    (tmp_path / "meta.json").write_text("x" * 50_001)  # one byte over its 50 KB budget
    (tmp_path / "harmonization.json").write_text("x" * 1_000)  # comfortably under: not flagged
    assert check_budgets(tmp_path) == [f"meta.json: {50_001} > 50000"]


def test_check_budgets_flags_incompressible_calendars(tmp_path):
    import os

    from kilnwatch.export import check_budgets

    (tmp_path / "calendar").mkdir()
    (tmp_path / "calendar" / "BD50.json").write_bytes(os.urandom(160_000))  # random bytes barely compress
    (tmp_path / "calendar" / "BD51.json").write_text("x" * 200_000)  # compresses far under the gzip limit
    errs = check_budgets(tmp_path)
    assert len(errs) == 1 and errs[0].startswith("calendar/BD50.json")


def test_check_budgets_total_cap(tmp_path):
    from kilnwatch.export import check_budgets

    with open(tmp_path / "big.bin", "wb") as f:
        f.truncate(100_000_001)  # sparse file: the size is what the budget sums
    assert any(e.startswith("total") for e in check_budgets(tmp_path))


def test_ask_cache_refreshes_only_with_a_key():
    from kilnwatch.export import refresh_ask_cache

    calls = []
    assert refresh_ask_cache(env={}, build=calls.append) is False and calls == []
    assert refresh_ask_cache(env={"ANTHROPIC_API_KEY": ""}, build=calls.append) is False and calls == []
    assert refresh_ask_cache(env={"ANTHROPIC_API_KEY": "x"}, build=calls.append) is True and len(calls) == 1
