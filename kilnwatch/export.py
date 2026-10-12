"""Public tier (web/public/data), regulator tier (offline), fixtures, safety checks, publish (architecture §5.9)."""
from __future__ import annotations

import gzip
import json
import logging
import shutil
import subprocess
import tarfile
from pathlib import Path

import numpy as np
import pandas as pd

from . import config as C

log = logging.getLogger("kilnwatch.export")
BUDGET = {"meta.json": 50_000, "events.json": 50_000, "harmonization.json": 200_000, "validation.json": 500_000,
          "aoi/districts.geojson": 400_000, "aoi/south_asia.geojson": 100_000, "aoi/world_countries.geojson": 1_000_000, "aoi/world_states.geojson": 3_500_000, "aoi/world_cities.json": 700_000, "aoi/upazilas.geojson": 1_500_000, "nrt/current_season.json": 300_000, "nrt/alerts.xml": 100_000, "outlook.json": 200_000,
          "kiln_activity.json": 1_500_000}
BUDGET_GZ = {"calendar/": 150_000, "grid/": 1_000_000}
SPLITS = {
    "kiln": [("kiln", "Kiln-like heat", "ভাটা-সদৃশ তাপ"), ("vegetation", "Vegetation fires", "উদ্ভিদ আগুন"), ("unknown", "Unknown", "অজানা")],
    "nightfire": [("kiln", "Kiln-like heat (Nightfire)", "ভাটা-সদৃশ তাপ (নাইটফায়ার)"), ("vegetation", "Vegetation fires", "উদ্ভিদ আগুন"), ("unknown", "Unknown", "অজানা")],
    "nokiln": [("aman", "Aman harvest window", "আমন কাটার সময়"), ("boro", "Boro harvest window", "বোরো কাটার সময়"), ("other", "Other burning", "অন্যান্য আগুন")],
}
BRANCHES = ("full", "from2012", "partial", "nightfire", "nokiln")


def split_labels(branch: str):
    rows = SPLITS["nokiln" if branch == "nokiln" else "nightfire" if branch == "nightfire" else "kiln"]
    return [{"key": k, "label_en": e, "label_bn": b} for k, e, b in rows]


def activity_meta(branch: str):
    if branch == "nokiln":
        return {"key": "HBI", "label_en": "Harmonized Burning Index", "label_bn": "সমন্বিত দহন সূচক"}
    return {"key": "HKFI", "label_en": "Harmonized Kiln Firing Index", "label_bn": "সমন্বিত ভাটা জ্বালানো সূচক"}


def _git_sha(path=None) -> str:
    try:
        args = ["git", "log", "-1", "--format=%h"] + ([str(path)] if path else [])
        return subprocess.check_output(args, cwd=C.ROOT, text=True).strip() or "uncommitted"
    except Exception:
        return "unknown"


def _first_sha(path: str) -> str:
    # The commit that created the file: prereg provenance must not drift to a later move commit.
    try:
        out = subprocess.check_output(["git", "log", "--reverse", "--format=%h", "--", path], cwd=C.ROOT, text=True).split()
        return out[0] if out else "unknown"
    except Exception:
        return "unknown"


def meta(branch: str, data_versions=None, params=None) -> dict:
    return {
        "generated_at": pd.Timestamp.now(tz="UTC").isoformat(timespec="seconds"),
        "git_sha": _git_sha(), "prereg_sha": _first_sha("PREREGISTRATION.md"),
        "params": params or {"GATE_SEASON": C.GATE_SEASON, "MIN_SNPP_CELLDAYS": C.MIN_SNPP_CELLDAYS, "MIN_PAIRED_DAYS": C.MIN_PAIRED_DAYS,
                             "SEAM_RATIO_MAX": C.SEAM_RATIO_MAX, "DBSCAN_EPS_M": C.DBSCAN_EPS_M, "CALIB_SEASONS": f"{C.CALIB_SEASONS[0]}…{C.CALIB_SEASONS[-1]}"},
        "data_versions": data_versions or {},
        "credits": C.CREDITS,
        "non_claims": [{"en": e, "bn": b} for e, b in C.NON_CLAIMS],
        "gate_branch": branch,
        "split_labels": split_labels(branch),
        "activity_index": activity_meta(branch),
        "grid": {"origin_lat": C.GRID_ORIGIN_LAT, "origin_lon": C.GRID_ORIGIN_LON, "step": C.GRID_STEP, "rows": C.GRID_ROWS, "cols": C.GRID_COLS},
    }


def dump_json(obj, path: Path):
    assert_public_safe(obj)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False, allow_nan=False, default=_clean), encoding="utf-8")
    tmp.replace(path)


def _clean(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if not np.isfinite(o) else float(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    if isinstance(o, (pd.Timestamp,)):
        return o.strftime("%Y-%m-%d")
    raise TypeError(type(o))


def nan_to_none(o):
    if isinstance(o, float) and not np.isfinite(o):
        return None
    if isinstance(o, dict):
        return {k: nan_to_none(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [nan_to_none(v) for v in o]
    return o


# --- safety checks -------------------------------------------------------------------
def assert_public_safe(obj) -> None:
    """Name-level check: refuses any FORBIDDEN_PUBLIC_KEYS anywhere in the object."""
    stack = [obj]
    while stack:
        o = stack.pop()
        if isinstance(o, dict):
            bad = C.FORBIDDEN_PUBLIC_KEYS & set(o)
            if bad:
                raise ValueError(f"forbidden public key(s): {sorted(bad)}")
            stack.extend(o.values())
        elif isinstance(o, (list, tuple)):
            stack.extend(o)


def check_public_dir(path: Path, n_clusters=None, n_kilns=None, admin_bounds=None) -> None:
    """Value-level check: no point geometry outside the admin boundary set except unit centroids;
    no array whose length equals len(clusters) or len(kilns)."""
    path = Path(path)
    if n_clusters is None and (C.INTERIM / "clusters.parquet").exists():
        n_clusters = len(pd.read_parquet(C.INTERIM / "clusters.parquet", columns=["cluster_id"]))
    if n_kilns is None and (C.INTERIM / "kilns.parquet").exists():
        n_kilns = len(pd.read_parquet(C.INTERIM / "kilns.parquet", columns=["kiln_id"]))
    forbidden_len = {n for n in (n_clusters, n_kilns) if n and n > 50}
    for f in sorted(path.rglob("*.json")) + sorted(path.rglob("*.geojson")):
        obj = json.loads(f.read_text(encoding="utf-8"))
        assert_public_safe(obj)
        stack = [(obj, f.name)]
        while stack:
            o, where = stack.pop()
            if isinstance(o, dict):
                if o.get("type") == "Point":
                    raise ValueError(f"{f}: point geometry in public data ({where})")
                if o.get("type") == "Feature" and o.get("geometry", {}).get("type") in ("Point", "MultiPoint"):
                    raise ValueError(f"{f}: point feature in public data")
                stack.extend((v, k) for k, v in o.items())
            elif isinstance(o, list):
                if len(o) in forbidden_len and not (f.parent.name in ("calendar", "grid") and where in ("days", "rows", "values", "h", "h_lo", "h_hi", "index", "unusual", "T", "A", "N", "J1", "J2", "p10", "p50", "p90")):
                    raise ValueError(f"{f}: array '{where}' has cluster/kiln cardinality {len(o)}")
                stack.extend((v, where) for v in o if isinstance(v, (dict, list)))


def check_budgets(path: Path) -> list[str]:
    errs = []
    for rel, lim in BUDGET.items():
        p = path / rel
        if p.exists() and p.stat().st_size > lim:
            errs.append(f"{rel}: {p.stat().st_size} > {lim}")
    for prefix, lim in BUDGET_GZ.items():
        for p in (path / prefix).glob("*.json"):
            gz = len(gzip.compress(p.read_bytes()))
            if gz > lim:
                errs.append(f"{prefix}{p.name}: {gz} gz > {lim}")
    total = sum(p.stat().st_size for p in path.rglob("*") if p.is_file())
    if total > 100_000_000:
        errs.append(f"total {total} > 100 MB")
    return errs


# --- public ------------------------------------------------------------------------
def write_public(out: Path = C.WEB_DATA) -> None:
    """Assemble the public tier from interim products written by metrics/validate."""
    branch = C.load_derived()["GATE_BRANCH"]["value"]
    out.mkdir(parents=True, exist_ok=True)
    src = C.INTERIM / "public"
    for p in src.rglob("*"):
        if p.is_file():
            dst = out / p.relative_to(src)
            dst.parent.mkdir(parents=True, exist_ok=True)
            if p.suffix in (".json", ".geojson"):
                assert_public_safe(json.loads(p.read_text(encoding="utf-8")))
            shutil.copyfile(p, dst)
    dv = {"firms": "FIRMS API SP+NRT, fetched " + pd.Timestamp.today().strftime("%Y-%m-%d"), "apad": "APAD IGP Brick Kilns BAN (accessed 2026-10-06)",
          "boundaries": "HDX COD-AB BGD v03 (2023-05-21)"}
    add_overlap(out)
    write_region(out)
    dump_json(meta(branch, dv), out / "meta.json")
    check_public_dir(out)
    errs = check_budgets(out)
    if errs:
        raise AssertionError("A10 budgets: " + "; ".join(errs))
    log.info("public export written to %s", out)


def write_regulator(out: Path = C.REGULATOR_DIR) -> None:
    out = Path(out).resolve()
    web = (C.ROOT / "web").resolve()
    if out == web or web in out.parents:
        raise ValueError("write_regulator refuses any path inside web/")
    out.mkdir(parents=True, exist_ok=True)
    reg = C.INTERIM / "regulator"
    if reg.exists():
        for p in reg.iterdir():
            shutil.copyfile(p, out / p.name)
    (out / "README.md").write_text("# Kiln Watch — restricted regulator export\n\nNever host. Inspection leads only.\n\n## Non-claims\n"
                                   + "\n".join(f"{i + 1}. {e}" for i, (e, _) in enumerate(C.NON_CLAIMS))
                                   + "\n\nProximity components are listed side by side, never as a composite score.\n", encoding="utf-8")


def refresh_ask_cache(env=None, build=None) -> bool:
    """Rebuild ask.json when an Anthropic key is set; otherwise warn and keep the old answers (the key is optional)."""
    import os

    env = os.environ if env is None else env
    if not env.get("ANTHROPIC_API_KEY"):
        log.warning("no ANTHROPIC_API_KEY: ask.json not refreshed (the page shows its build date)")
        return False
    if build is None:
        from .ask import build_cache as build  # lazy: ask imports export lazily too

    build(C.WEB_DATA)
    return True


def publish() -> None:
    check_public_dir(C.WEB_DATA)
    for f in C.WEB_DATA.rglob("*.json"):
        assert_public_safe(json.loads(f.read_text(encoding="utf-8")))
    refresh_ask_cache()  # before packaging, so releases carry fresh answers
    if (C.WEB_DATA / "ask.json").exists():  # new content since the checks above
        assert_public_safe(json.loads((C.WEB_DATA / "ask.json").read_text(encoding="utf-8")))
    tar = C.ROOT / "public-data.tar.gz"
    with tarfile.open(tar, "w:gz") as t:
        for p in C.WEB_DATA.rglob("*"):
            if p.is_file() and "nrt" not in p.relative_to(C.WEB_DATA).parts:
                t.add(p, arcname=str(p.relative_to(C.WEB_DATA)))
    from . import research

    research.write(C.WEB_DATA, C.ROOT / "research")  # CSV + Parquet tables built from the same public files
    rzip = Path(shutil.make_archive(str(C.ROOT / "kilnwatch-research-data"), "zip", C.ROOT / "research"))
    sha = _git_sha()
    subprocess.run(["gh", "release", "view", "data-current"], cwd=C.ROOT, capture_output=True).returncode == 0 or \
        subprocess.run(["gh", "release", "create", "data-current", "--title", "Public data (current)", "--notes", "Real public export. Rolling."], cwd=C.ROOT, check=True)
    subprocess.run(["gh", "release", "upload", "data-current", str(tar), str(rzip), "--clobber"], cwd=C.ROOT, check=True)
    subprocess.run(["gh", "release", "create", f"data-{sha}", str(tar), str(rzip), "--title", f"Public data {sha}", "--notes", "Immutable provenance copy."], cwd=C.ROOT, check=False)
    tar.unlink()
    rzip.unlink()


# --- fixtures (synthetic, one complete set per branch) ---------------------------------------
def add_overlap(d: Path) -> None:
    """harmonization.json gains `overlap` (Aqua vs VIIRS on the months both flew) and `outlook.json` is written (the
    backtested two-week unusual-fire outlook): both from the district calendars in the same export."""
    from .validate import overlap_agreement

    cals = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((d / "calendar").glob("*.json"))]
    hp = d / "harmonization.json"
    h = json.loads(hp.read_text(encoding="utf-8"))
    h["overlap"] = overlap_agreement([c for c in cals if c.get("clear_frac")])
    dump_json(nan_to_none(h), hp)
    from .validate import outlook

    o = outlook([c for c in cals if c.get("clear_frac")])  # districts: the NRT job publishes districts only
    if o:
        dump_json(nan_to_none(o), d / "outlook.json")
    else:  # not estimable for this build: an outlook left by an earlier build would no longer match its calendars
        (d / "outlook.json").unlink(missing_ok=True)


def write_region(d: Path) -> None:
    """The world map's reference geography (#/region), from committed Natural Earth extracts in data/static (public
    domain, de facto boundaries): South Asia's eight countries, every country, every state/province, and city names as
    plain records (not point features). Place names and outlines only: no data of ours."""
    dump_json(json.loads((C.STATIC / "south_asia_countries.geojson").read_text(encoding="utf-8")), d / "aoi" / "south_asia.geojson")
    for name in ("world_countries.geojson", "world_states.geojson", "world_cities.json"):  # kilnwatch/geography.py builds these
        dump_json(json.loads((C.STATIC / name).read_text(encoding="utf-8")), d / "aoi" / name)


def events_payload() -> dict:
    """events.json from the real curated CSVs in data/static (same payload the pipeline writes)."""
    pol = pd.read_csv(C.STATIC / "policy_events.csv")
    sat = pd.read_csv(C.STATIC / "satellite_events.csv")
    crop = pd.read_csv(C.STATIC / "crop_calendar.csv")
    return {"policy": pol.rename(columns={"source_url": "url"}).to_dict("records"),
            "satellite": sat.rename(columns={"source_url": "url"}).to_dict("records"),
            "harvest": [{"crop": r.crop, "start_doy": int(pd.Timestamp(r.harvest_start).dayofyear),
                         "end_doy": int(pd.Timestamp(r.harvest_end).dayofyear), "url": r.source_url}
                        for r in crop.itertuples()]}


def run(regulator=False, fixtures=False, check_public=None, publish_=False) -> None:
    if fixtures:
        from .fixtures import write_fixtures

        write_fixtures()
        return
    if check_public:
        check_public_dir(Path(check_public))
        print("public data checks passed:", check_public)
        return
    if regulator:
        write_regulator()
        return
    if publish_:
        publish()
        return
    write_public()
