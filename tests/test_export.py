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
