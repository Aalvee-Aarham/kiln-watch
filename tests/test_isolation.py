"""NFR10: no test module references data/raw, data/interim or data/raw/gee."""
import re
from pathlib import Path

PAT = re.compile(r"data[/\\]+(raw|interim)|\bRAW\b|\bINTERIM\b")


def test_no_test_reads_real_data():
    here = Path(__file__).parent
    bad = [p.name for p in here.glob("test_*.py") if p.name != Path(__file__).name and PAT.search(p.read_text(encoding="utf-8"))]
    assert not bad, f"tests referencing real data: {bad}"
