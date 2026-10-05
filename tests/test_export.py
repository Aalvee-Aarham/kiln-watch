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
