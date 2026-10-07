"""Constants typed PRE-REGISTERED / DERIVED / FIXED (implementation_plan §6).

PRE-REGISTERED: truth lives in PREREGISTRATION.md; tests/test_config.py asserts equality.
DERIVED: written by a named step to config_derived.json with source + date.
FIXED: engineering choice.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ImportError:  # CI installs python-dotenv; tolerate its absence
    pass

# --- FIXED: grid -----------------------------------------------------------
GRID_ORIGIN_LAT = 20.0
GRID_ORIGIN_LON = 68.0
GRID_STEP = 0.01
GRID_ROWS = 1500
GRID_COLS = 3000
BBOX_W, BBOX_S, BBOX_E, BBOX_N = 88.0, 20.5, 92.8, 26.7
METRIC_CRS = "EPSG:3106"
SENSORS = {"T": "Terra", "A": "Aqua", "N": "S-NPP", "J1": "NOAA-20", "J2": "NOAA-21"}
SEASON_YEAR_START = (7, 1)

# --- PRE-REGISTERED ----------------------------------------------------------
FIRING_MONTHS = (11, 12, 1, 2, 3, 4, 5)
MONSOON_MONTHS = (6, 7, 8, 9, 10)
CONF_KEEP = ("nominal", "high")
MIN_SNPP_CELLDAYS = 100
MIN_PAIRED_DAYS = 10
LOSO_COVERAGE_TARGET = (0.90, 0.97)
SEAM_RATIO_MAX = 0.25
CONTROL_DROP_MAX = 0.20
CONTROL_DROP_MAX_DIV = 0.40
GATE_SEASON = "2023-24"  # by the §12 rule from the primary inventory (APAD); see PREREGISTRATION.md

# --- FIXED: kiln geometry, seeds, privacy ----------------------------------
MAX_CLUSTER_DIAM_M = 5_000
MAX_CLUSTER_SHARE = 0.02
CONTROL_ATTEMPTS_MAX = 2_000
SEED = 20261114
SEED_OFFSETS = {"kilns": 1, "gates": 2, "harmonize": 3, "classify": 4, "metrics": 5, "validate": 6, "activity": 7, "transfer": 8}
FORBIDDEN_PUBLIC_KEYS = {"kiln_id", "cluster_id", "candidate", "kiln_lat", "kiln_lon"}
TRANSFER_DISTRICT = "Faisalabad"

# --- Paths -------------------------------------------------------------------
DATA = ROOT / "data"
RAW = DATA / "raw"
INTERIM = DATA / "interim"
MODELS = DATA / "models"
STATIC = DATA / "static"
NRT_DIR = DATA / "nrt"
REPORTS = ROOT / "reports"
FIGURES = REPORTS / "figures"
WEB_DATA = ROOT / "web" / "public" / "data"
WEB_FIXT = ROOT / "web" / "fixtures"
REGULATOR_DIR = ROOT / "regulator"

FIRMS_MAP_KEY = os.environ.get("FIRMS_MAP_KEY", "")
OPENAQ_API_KEY = os.environ.get("OPENAQ_API_KEY", "")
EE_PROJECT = os.environ.get("EE_PROJECT", "")

# --- DERIVED (config_derived.json) -----------------------------------------
DERIVED_PATH = Path(__file__).with_name("config_derived.json")
_DERIVED_DEFAULTS = {
    "CALIB_SEASONS": {"value": [f"{y}-{(y + 1) % 100:02d}" for y in range(2012, 2021)]},
    "DBSCAN_EPS_M": {"value": 400.0},
    "WATER_CHECK_UNIT": {"value": None},
    "GATE_BRANCH": {"value": "full"},
}


def load_derived() -> dict:
    d = dict(_DERIVED_DEFAULTS)
    if DERIVED_PATH.exists():
        d.update(json.loads(DERIVED_PATH.read_text(encoding="utf-8")))
    return d


def write_derived(key: str, value, source: str) -> None:
    """A DERIVED constant is written with its source and date by the step that derives it."""
    from datetime import date

    d = json.loads(DERIVED_PATH.read_text(encoding="utf-8")) if DERIVED_PATH.exists() else {}
    d[key] = {"value": value, "source": source, "date": date.today().isoformat()}
    tmp = DERIVED_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(d, indent=2), encoding="utf-8")
    tmp.replace(DERIVED_PATH)
    globals()[key] = tuple(value) if isinstance(value, list) else value


_d = load_derived()
CALIB_SEASONS = tuple(_d["CALIB_SEASONS"]["value"])
DBSCAN_EPS_M = float(_d["DBSCAN_EPS_M"]["value"])
WATER_CHECK_UNIT = _d["WATER_CHECK_UNIT"]["value"]
GATE_BRANCH = _d["GATE_BRANCH"]["value"]


def rng(stage: str):
    import numpy as np

    return np.random.default_rng(SEED + SEED_OFFSETS[stage])


# --- Public metadata ---------------------------------------------------------
CREDITS = [
    {"name": "NASA FIRMS (MODIS C6.1, VIIRS 375 m)", "url": "https://firms.modaps.eosdis.nasa.gov/", "licence": "NASA open data"},
    {"name": "Google Earth Engine: MOD14A1, MYD14A1, VNP14A1, ESA WorldCover, Sentinel-5P", "url": "https://earthengine.google.com/", "licence": "Per-dataset open terms"},
    {"name": "NASA Black Marble VNP46A2 night lights (Román et al. 2018), via Earth Engine", "url": "https://blackmarble.gsfc.nasa.gov/", "licence": "NASA open data"},
    {"name": "Copernicus Sentinel-1 SAR GRD (ESA), via Earth Engine", "url": "https://sentinels.copernicus.eu/", "licence": "Copernicus open licence"},
    {"name": "NASA ECOSTRESS L2T LSTE v2 and USGS/NASA Landsat 8/9 C2 L2 (kiln pilots only)", "url": "https://ecostress.jpl.nasa.gov/", "licence": "NASA / USGS open data"},
    {"name": "APAD IGP Brick Kilns Bangladesh / Pakistan / India", "url": "https://registry.opendata.aws/asset-data-igp-brick-kilns-ban/", "licence": "CC BY 4.0"},
    {"name": "geoBoundaries ADM0 Pakistan and India (Amendment 2 controls)", "url": "https://www.geoboundaries.org/", "licence": "ODbL 1.0 (Pakistan), CC0 1.0 (India)"},
    {"name": "OCHA HDX COD-AB Bangladesh & Pakistan", "url": "https://data.humdata.org/dataset/cod-ab-bgd", "licence": "CC BY-IGO"},
    {"name": "OpenAQ v3", "url": "https://openaq.org/", "licence": "CC BY 4.0"},
    {"name": "CARTO Positron basemap / OpenStreetMap", "url": "https://carto.com/attributions", "licence": "ODbL / CC BY"},
]

NON_CLAIMS = [
    ("That any kiln is operating illegally. Outputs are inspection leads.", "কোনো ভাটা অবৈধভাবে চলছে — এমন দাবি নয়। ফলাফল শুধু পরিদর্শনের সূত্র।"),
    ("That a kiln was off because there was no detection. We say only \"no detection on N cloud-free days.\"", "শনাক্ত না হওয়া মানে ভাটা বন্ধ ছিল — এমন নয়।"),
    ("That detection counts are emissions. Any emissions figure is a labelled order-of-magnitude estimate.", "শনাক্তকরণ সংখ্যা নির্গমন নয়।"),
    ("That a satellite can see a licence, a kiln's technology, or exact distances to schools.", "উপগ্রহ লাইসেন্স, প্রযুক্তি বা স্কুলের সঠিক দূরত্ব দেখতে পারে না।"),
    ("That the calibration holds outside its training coverage (seasons 2012-13 … 2020-21, Bangladesh).", "প্রশিক্ষণ পরিসরের বাইরে ক্যালিব্রেশন প্রযোজ্য — এমন দাবি নয়।"),
    ("That the 2013 Act caused any change. Before-and-after comparisons are descriptive.", "২০১৩ সালের আইন কোনো পরিবর্তন ঘটিয়েছে — এমন দাবি নয়।"),
    ("That thermal kiln detection is an established method. It is a hypothesis we tested; the gate results are published.", "তাপীয় ভাটা শনাক্তকরণ প্রতিষ্ঠিত পদ্ধতি নয়; এটি পরীক্ষিত অনুমান।"),
    ("Any pre-2012 kiln history, unless Gate G2 passes.", "G2 পাস না করলে ২০১২-র আগের ভাটা ইতিহাস দাবি করা হয় না।"),
    ("That the classifier is independent of FIRMS's own static-source logic wherever type=2 labels were used.", "type=2 লেবেল ব্যবহৃত হলে শ্রেণিবিন্যাসক FIRMS-এর নিজস্ব যুক্তি থেকে স্বাধীন নয়।"),
]
