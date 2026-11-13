"""Vercel entry point: the Kiln Watch FastAPI app as one Python function (routes /api/* and /mcp).

Vercel's disk is read-only except /tmp, so the bundled data (region records, outlook snapshot) is copied there on a
cold start and the app writes caches next to it. /tmp is wiped between cold starts: caches and alerts are ephemeral.
"""
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TMP = Path("/tmp/kw")

if not (TMP / "regions" / "index.json").exists():
    shutil.copytree(ROOT / "data" / "regions", TMP / "regions", dirs_exist_ok=True)
    (TMP / "global").mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "data" / "global" / "outlook.json", TMP / "global" / "outlook.json")
    if (ROOT / "data" / "sensor_days.parquet").exists():
        shutil.copy2(ROOT / "data" / "sensor_days.parquet", TMP / "sensor_days.parquet")

os.environ["KW_DATA"] = str(TMP)
os.environ["KW_SERVERLESS"] = "1"  # no background builds/refreshes or email loop: functions freeze after replying
os.environ["HOME"] = "/tmp"  # DuckDB installs its httpfs/spatial extensions under ~/.duckdb
sys.path.insert(0, str(ROOT / "server"))

from kw.api import app  # noqa: E402,F401
