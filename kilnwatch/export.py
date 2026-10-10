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
          "aoi/districts.geojson": 400_000, "aoi/upazilas.geojson": 1_500_000, "nrt/current_season.json": 300_000,
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


def meta(branch: str, data_versions=None, params=None) -> dict:
    return {
        "generated_at": pd.Timestamp.now(tz="UTC").isoformat(timespec="seconds"),
        "git_sha": _git_sha(), "prereg_sha": _git_sha("PREREGISTRATION.md"),
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


def _dump(obj, path: Path):
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
        errs.append(f"total {total} > 100 MB: rerun with --downscale upazila2012, then --downscale upazilaweekly")
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
    _dump(meta(branch, dv), out / "meta.json")
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


def publish() -> None:
    check_public_dir(C.WEB_DATA)
    for f in C.WEB_DATA.rglob("*.json"):
        assert_public_safe(json.loads(f.read_text(encoding="utf-8")))
    tar = C.ROOT / "public-data.tar.gz"
    with tarfile.open(tar, "w:gz") as t:
        for p in C.WEB_DATA.rglob("*"):
            if p.is_file() and "nrt" not in p.relative_to(C.WEB_DATA).parts:
                t.add(p, arcname=str(p.relative_to(C.WEB_DATA)))
    sha = _git_sha()
    subprocess.run(["gh", "release", "view", "data-current"], cwd=C.ROOT, capture_output=True).returncode == 0 or \
        subprocess.run(["gh", "release", "create", "data-current", "--title", "Public data (current)", "--notes", "Real public export. Rolling."], cwd=C.ROOT, check=True)
    subprocess.run(["gh", "release", "upload", "data-current", str(tar), "--clobber"], cwd=C.ROOT, check=True)
    subprocess.run(["gh", "release", "create", f"data-{sha}", str(tar), "--title", f"Public data {sha}", "--notes", "Immutable provenance copy."], cwd=C.ROOT, check=False)
    tar.unlink()


# --- fixtures (synthetic, one complete set per branch) ---------------------------------------
_BD: dict | None = None


def _bd_geometry() -> dict:
    """Simplified COD-AB ADM2/ADM3 shapes from data/static (committed), so fixture maps draw
    the real country outline. Public CC BY-IGO boundaries only — no kiln data (invariant 3)."""
    global _BD
    if _BD is None:
        _BD = {}
        for lvl in ("district", "upazila"):
            fc = json.loads((C.STATIC / f"bd_{lvl}s.geojson").read_text(encoding="utf-8"))
            _BD[lvl] = {"by_name": {f["properties"]["name_en"]: f for f in fc["features"]}, "all": fc["features"]}
    return _BD


def write_fixtures(out: Path = C.WEB_FIXT) -> None:
    real = _real_release_dir()
    for b in BRANCHES:
        if b == "nokiln" and real is not None:  # the real run's gate_branch is nokiln: ship it as a verbatim offline copy
            _fixture_set_real(out / b / "data", real)
        else:
            _fixture_set(b, out / b / "data")


RELEASE_TARBALL = C.ROOT / "data" / "releases" / "public-data.tar.gz"
RELEASE_NRT = C.ROOT / "data" / "releases" / "nrt-current.json"


def _real_release_dir() -> Path | None:
    """Extract the committed immutable public-data release once (data/releases/public, gitignored).

    Source: GitHub release data-<sha> (`gh release download <tag> --pattern public-data.tar.gz`),
    plus a snapshot of the live site's real NRT season. Absent tarball -> fixtures stay synthetic."""
    if not RELEASE_TARBALL.exists():
        return None
    cache = RELEASE_TARBALL.parent / "public"
    if not (cache / "meta.json").exists():
        cache.mkdir(parents=True, exist_ok=True)
        with tarfile.open(RELEASE_TARBALL) as tf:
            tf.extractall(cache)
    if RELEASE_NRT.exists():
        nrt = cache / "nrt" / "current_season.json"
        if not nrt.exists():
            nrt.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(RELEASE_NRT, nrt)
    return cache


def _fixture_set_real(d: Path, src: Path) -> None:
    if d.exists():
        shutil.rmtree(d)
    shutil.copytree(src, d)
    # kiln_activity season CIs from release c310275 predate the activity.py p50 fix (bootstrap median):
    # a CI that cannot bracket its median is treated as not estimable, the file's own convention for degenerate rows.
    ka_p = d / "kiln_activity.json"
    ka = json.loads(ka_p.read_text(encoding="utf-8"))
    repairs = 0
    for a in [ka.get("national"), *ka.get("areas", {}).values()]:
        for s in a.get("seasons") or []:
            for m in ("onset", "end", "duration", "peak", "peak_value"):
                v = s.get(m)
                if v and not (v["lo"] <= v["p50"] <= v["hi"]):
                    s[m] = None
                    repairs += 1
    m = json.loads((d / "meta.json").read_text(encoding="utf-8"))
    m["demo"] = {"mode": "real-offline-copy", "source_sha": m.get("git_sha"),
                 "nrt_updated_at": json.loads((d / "nrt" / "current_season.json").read_text(encoding="utf-8")).get("updated_at") if (d / "nrt" / "current_season.json").exists() else None,
                 "note_en": "Offline demo: verbatim copy of the real pipeline export. The live site refreshes daily.",
                 "note_bn": "অফলাইন ডেমো: প্রকৃত পাইপলাইন রপ্তানির হুবহু অনুলিপি। লাইভ সাইট প্রতিদিন হালনাগাদ হয়।"}
    if repairs:
        m["demo"]["repairs"] = {"kiln_activity_ci_nullled": repairs}
    _dump(m, d / "meta.json")
    if repairs:
        ka_p.write_text(json.dumps(ka, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
        log.info("real fixture: nulled %d non-bracketing season CIs in kiln_activity.json", repairs)


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


def _fixture_set(branch: str, d: Path) -> None:
    rng = np.random.default_rng(C.SEED)
    if d.exists():
        shutil.rmtree(d)
    m = meta(branch, {"fixtures": "synthetic"})
    m["git_sha"], m["prereg_sha"], m["generated_at"] = "fixture", "fixture", "2026-10-06T00:00:00+00:00"
    _dump(m, d / "meta.json")
    keys = [s["key"] for s in m["split_labels"]]
    units = [("BD3026", "district", "Dhaka", "ঢাকা", "Dhaka", 25.0, 0.6, "plateau", (90.2, 23.6, 90.6, 24.0)),
             ("BD5081", "district", "Rajshahi", "রাজশাহী", "Rajshahi", 4.0, 0.2, "spike", (88.3, 24.2, 88.8, 24.6)),
             ("BD4047", "district", "Khulna", "খুলনা", "Khulna", 2.0, 0.1, "mixed", (89.3, 22.4, 89.7, 22.9)),
             ("BD302614", "upazila", "Dhamrai", "ধামরাই", "Dhaka", 30.0, 0.7, "plateau", (90.1, 23.85, 90.25, 24.0)),
             ("BD508131", "upazila", "Godagari", "গোদাগাড়ী", "Rajshahi", 3.0, 0.15, "spike", (88.3, 24.4, 88.45, 24.55))]
    feats = {"district": [], "upazila": []}
    used = set()
    for uid, lvl, en, bn, div, kc, ks, kind, box in units:
        w, s, e, n = box
        kc_out = None if branch in ("nokiln",) else kc
        real = _bd_geometry()[lvl]["by_name"].get(en)
        if real is not None:  # real COD-AB shape for the synthetic unit, so the map looks like Bangladesh
            used.add(real["properties"]["unit_id"])
        geom = real["geometry"] if real is not None else {"type": "Polygon", "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]]}
        feats[lvl].append({"type": "Feature", "properties": {"unit_id": uid, "level": lvl, "name_en": en, "name_bn": bn, "division": div,
                                                              "kiln_count": kc_out, "kiln_share": None if kc_out is None else ks},
                           "geometry": geom})
        _dump(_fixture_calendar(uid, kind, lvl == "district", keys, rng, branch), d / "calendar" / f"{uid}.json")
    for f in _bd_geometry()["district"]["all"]:  # every real district is selectable in the demo
        pid = f["properties"]["unit_id"]
        if pid not in used:
            _dump(_fixture_calendar(pid, "quiet", True, keys, rng, branch), d / "calendar" / f"{pid}.json")
    for lvl, fs in feats.items():
        rest = [f for f in _bd_geometry()[lvl]["all"] if f["properties"]["unit_id"] not in used]  # complete the country, no data
        fs.extend({"type": "Feature", "properties": {**f["properties"], "kiln_count": None, "kiln_share": None}, "geometry": f["geometry"]}
                  for f in rest)
        _dump({"type": "FeatureCollection", "features": fs}, d / "aoi" / f"{lvl}s.geojson")
    _dump(_fixture_harmonization(rng), d / "harmonization.json")
    _dump(_fixture_validation(branch, rng), d / "validation.json")
    _dump(events_payload(), d / "events.json")
    days = 97
    nrt_d = {u[0]: {"h": [round(float(x), 3) for x in rng.gamma(2, 0.5, days)], "above_p90_days": int(rng.integers(0, 6))}
             for u in units if u[1] == "district"}
    for f in _bd_geometry()["district"]["all"]:  # full-country choropleth in the demo
        pid = f["properties"]["unit_id"]
        if pid not in nrt_d:
            nrt_d[pid] = {"h": [round(float(x), 2) for x in rng.gamma(2, 0.15, days)], "above_p90_days": int(rng.integers(0, 4))}
    _dump({"updated_at": "2026-10-05T03:00:00Z", "provisional": True, "season": "2026-27", "day0": "2026-07-01",
           "national": {"h": [round(float(x), 3) for x in rng.gamma(2, 0.5, days)], "split": [{"key": k, "values": [round(float(x), 3) for x in rng.gamma(2, 0.2, days)]} for k in keys]},
           "districts": nrt_d},
          d / "nrt" / "current_season.json")
    _dump({"tile": "90_23", "day0": "2003-01-01", "rows": [[int(1136241 + i), int(4000 + i % 300), int(i % 6)] for i in range(500)]}, d / "grid" / "90_23.json")
    _dump(_fixture_kiln_activity(rng), d / "kiln_activity.json")


def _fixture_kiln_activity(rng):
    """Synthetic kiln_activity.json: half-monthly excess that is high Dec–Apr, ~0 Jul–Oct."""
    from .activity import NON_CLAIMS, P_ROWS

    per = [pd.Timestamp(y, m, dd) for y in range(2012, 2026) for m in range(1, 13) for dd in (1, 16)]
    shape = lambda t: 1.0 if t.month in (12, 1, 2, 3, 4) else 0.5 if t.month in (11, 5) else 0.0
    ci = lambda v, w: {"p50": v, "lo": v - w, "hi": v + w}

    def area(n, level):
        e = [round(shape(t) * 0.8 + float(rng.normal(0, 0.05)), 3) for t in per]
        seasons = [{"season": f"{y}-{(y + 1) % 100:02d}", "onset": ci(138 + int(rng.integers(-8, 9)), 8), "end": ci(305 + int(rng.integers(-8, 9)), 8),
                    "duration": ci(167, 12), "peak": ci(214, 15), "peak_value": ci(0.8, 0.1)} for y in range(2012, 2025)]
        a = {"n_clusters": n, "seasons": seasons}
        if level != "upazila":
            a |= {"e": e, "lo": [round(v - 0.1, 3) for v in e], "hi": [round(v + 0.1, 3) for v in e]}
        return a
    tests = [{"test": "GL", "criterion": c, "value": v, "threshold": th, "p": p, "pass": True} for c, v, th, p in (
        ("Contrast: median A, 2022-23 (n = 3100)", 0.31, "> 0, Wilcoxon p < 0.01", 1e-40), ("Prevalence: share of clusters with A > 0", 0.74, "≥ 0.60", None),
        ("Replication: seasons with median A > 0 (13 evaluable)", 1.0, "≥ 0.75", None), ("Placebo: first control as pseudo-kiln (n = 3000)", 0.0, "Wilcoxon p > 0.05", 0.4))]
    return {"pilots": P_ROWS, "layer": "ntl", "tests": tests, "pass": {"GL": True}, "cadence": "half-month",
            "non_claims": [{"en": e, "bn": b} for e, b in NON_CLAIMS],
            "contamination": {"detections": 200000, "kiln_share": 0.0015, "control_share": 0.0014, "period": "2012–2026"},
            "periods": [t.strftime("%Y-%m-%d") for t in per], "national": area(3653, "national"),
            "areas": {"BD3026": area(120, "district"), "BD302614": area(30, "upazila")}, "transfer": _fixture_transfer()}


def _fixture_transfer():
    """Synthetic Amendment 2 block. No random draws, so every other fixture file stays byte-identical."""
    order = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]

    def prof(active):
        p50 = [0.4 if m in active else 0.0 for m in order]
        return {"months": order, "p50": p50, "lo": [round(v - 0.05, 3) for v in p50], "hi": [round(v + 0.05, 3) for v in p50], "n_clusters": 1600}

    def rows(tag, ok, placebo_ok=True):
        return [{"test": tag, "criterion": c, "value": v, "threshold": th, "p": p, "pass": ok if i < 3 else ok and placebo_ok} for i, (c, v, th, p) in enumerate((
            ("Contrast: median A, 2022-23 (n = 1580)", 0.2 if ok else -0.05, "> 0, Wilcoxon p < 0.01", 1e-20 if ok else 0.9),
            ("Prevalence: share of clusters with A > 0", 0.7 if ok else 0.45, "≥ 0.60", None),
            ("Replication: seasons with median A > 0 (13 evaluable)", 1.0 if ok else 0.3, "≥ 0.75", None),
            ("Placebo: first control as pseudo-kiln (n = 1580)", 0.0 if placebo_ok else -0.03, "Wilcoxon p > 0.05", 0.5 if placebo_ok else 1e-6)))]

    def country(code, name, kilns, clusters, core, off, active, strict_ok, placebo_ok=True, design="A2"):
        ok = placebo_ok
        ch = {"learned": {"core": core, "off": off}, "profile": prof(active), "n_calibration": 400, "n_confirmation": 1600,
              "tests": rows("TL", strict_ok, placebo_ok) + rows("LL", True, placebo_ok), "pass": {"TL": strict_ok and ok, "LL": ok}}
        return {"code": code, "name": name, "design": design, "n_kilns": kilns, "n_clusters": clusters, "n_sampled": 2000, "n_dropped": 20,
                "evaluable": True, "channels": {"ntl": ch}}
    bd = {"code": "BD", "name": "Bangladesh", "n_clusters": 3653,
          "channels": {"ntl": {"learned": {"core": [12, 1, 2, 3, 4], "off": [7, 8, 9, 10]}, "profile": prof((12, 1, 2, 3, 4)), "tests": [], "pass": {}}}}
    pk = country("PK", "Pakistan", 10585, 7509, [2, 3, 4, 5, 6], [9, 10, 11, 12], (1, 2, 3, 4, 5, 6, 9, 10), False, placebo_ok=False)
    pk["retest"] = country("PK", "Pakistan", 10585, 7509, [2, 3, 4, 5, 6], [9, 10, 11, 12], (1, 2, 3, 4, 5, 6, 9, 10), False, design="A4")
    return {"countries": [bd, pk, country("IN", "India", 22459, 18665, [1, 2, 3, 4, 5], [7, 8, 9, 10], (1, 2, 3, 4, 5, 6), True)]}


def _fixture_calendar(uid, kind, is_district, keys, rng, branch):
    n_days = (pd.Timestamp("2025-06-30") - pd.Timestamp("2003-01-01")).days + 1
    dates = pd.date_range("2003-01-01", periods=n_days)
    doy = dates.dayofyear.to_numpy()
    month = dates.month.to_numpy()
    firing = np.isin(month, C.FIRING_MONTHS)
    if kind == "plateau":
        lam = np.where(firing, 1.2, 0.1)
    elif kind == "spike":
        lam = 0.05 + 3.0 * np.exp(-0.5 * ((doy - 110) / 6) ** 2) + 2.0 * np.exp(-0.5 * ((doy - 330) / 5) ** 2)
    elif kind == "quiet":  # real districts without a demo unit: low, compressible series
        lam = np.where(firing, rng.uniform(0.08, 0.3), 0.003)
    else:
        lam = np.where(firing, 0.5, 0.05) + 1.0 * np.exp(-0.5 * ((doy - 105) / 8) ** 2)
    h = rng.gamma(2, lam / 2)
    h[rng.random(n_days) < (0.97 if kind == "quiet" else 0.35)] = 0
    post = dates >= pd.Timestamp("2012-07-01")
    raw_a = np.where(dates < pd.Timestamp("2022-01-01"), h * rng.uniform(0.8, 1.2, n_days), 0)
    raw_n = np.where(dates >= pd.Timestamp("2012-01-20"), h * 4.0 * rng.uniform(0.8, 1.2, n_days), 0)
    raw_t = h * 0.7 * rng.uniform(0.7, 1.3, n_days)
    nod = (np.isin(month, C.MONSOON_MONTHS) & (rng.random(n_days) < 0.3))
    h[nod] = 0
    nz = np.flatnonzero((h > 0) | (raw_n > 0) | (raw_a > 0))
    share = {"plateau": 0.7, "spike": 0.1, "mixed": 0.35, "quiet": 0.2}[kind]
    if branch in ("from2012", "partial"):
        share_arr = np.where(post, share, 0.0)
    else:
        share_arr = np.full(n_days, share)
    parts = [h * share_arr, h * (1 - share_arr) * 0.85, h * (1 - share_arr) * 0.15]
    if branch == "nokiln":
        hk = np.select([(doy >= 305), (doy >= 91) & (doy <= 151)], [0, 1], 2)
        parts = [np.where(hk == i, h, 0) for i in range(3)]
    runs, start = [], None
    for i, v in enumerate(np.r_[nod, False]):
        if v and start is None:
            start = i
        elif not v and start is not None:
            runs.append([start, i - 1])
            start = None
    r3 = lambda a: [round(float(x), 3) for x in a]  # noqa: E731
    weeks = int(np.ceil(n_days / 7))
    wk = np.array([h[i * 7:(i + 1) * 7].mean() for i in range(weeks)])
    cal = {"unit_id": uid, "day0": "2003-01-01", "days": nz.tolist(),
           "raw": {"T": r3(raw_t[nz]), "A": r3(raw_a[nz]), "N": r3(raw_n[nz])}, "h": r3(h[nz]),
           "split": [{"key": k, "values": r3(p[nz])} for k, p in zip(keys, parts)],
           "index": r3(pd.Series(parts[0] if branch != "nokiln" else h).rolling(7, min_periods=1).mean().to_numpy()[nz]),
           "nodata": runs, "week0": "2003-01-01", "h_lo": r3(wk * 0.8), "h_hi": r3(wk * 1.25),
           "normal": {"p10": r3(np.full(366, 0.0)), "p50": r3(0.5 + 0.5 * np.sin(np.arange(366) / 58)), "p90": r3(1.5 + np.sin(np.arange(366) / 58))},
           "unusual": nz[h[nz] > 2.5][:200].tolist(), "critical": [[123, 200], [270, 300]],
           "seasons": [{"season": f"{y}-{(y + 1) % 100:02d}", "midpoint": {"p50": 230.0, "lo": 220.0, "hi": 240.0},
                        "duration": {"p50": 150.0 if kind == "plateau" else 40.0, "lo": 130.0 if kind == "plateau" else 30.0, "hi": 170.0 if kind == "plateau" else 55.0},
                        "peak": {"p50": 1.5, "lo": 1.2, "hi": 1.9}, "first": f"{y}-11-03", "last": f"{y + 1}-05-20"} for y in range(2003, 2025)]}
    if is_district:
        if kind == "quiet":  # seasonal constant, no daily noise: compresses to almost nothing
            cf = {s: np.where(np.isin(month, C.MONSOON_MONTHS), 30, 80).tolist() for s in ("A", "N")}
        else:
            cf = {s: [int(x) for x in np.where(np.isin(month, C.MONSOON_MONTHS), 30, 80) + rng.integers(-10, 10, n_days)] for s in ("A", "N")}
        cal["clear_frac"] = cf
    if branch == "nokiln":
        cal["index"] = r3(pd.Series(h).rolling(7, min_periods=1).mean().to_numpy()[nz])
    return cal


def _fixture_harmonization(rng):
    seasons = [f"{y}-{(y + 1) % 100:02d}" for y in range(2003, 2025)]
    yearly = []
    for s in seasons:
        y = int(s[:4])
        base = 100 + 3 * (y - 2003) + rng.normal(0, 5)
        raw_n = base * 4 if y >= 2012 else None
        raw_a = base if y < 2021 else base * 0.8
        raw = raw_n if raw_n else raw_a
        yearly.append({"season": s, "raw_sum": round(raw, 1), "raw_by_sensor": {k: round(v, 1) for k, v in {"A": raw_a, "N": raw_n, "T": base * 0.7}.items() if v},
                       "h": {"p50": round(base, 1), "lo": round(base * 0.9, 1), "hi": round(base * 1.1, 1)}, "aqua_obs": round(raw_a, 1)})
    betas = [{"step": "A<-N", "division": dv, "month": m, "pass": p, "loc": loc, "beta": {"p50": 0.25, "lo": 0.22, "hi": 0.28},
              "rung_used": 0 if p == "D" else 1, "n_celldays": 420, "n_days": 60}
             for dv in ("Dhaka", "Rajshahi") for m in (1, 2, 12) for p in ("D", "N") for loc in ("kiln", "other")]
    loso = [{"season": s, "model": "M0", "mae": 0.12, "bias": 0.01, "covered": 0.93} for s in seasons[9:18]]
    return {"selected_model": "M0", "yearly": yearly, "betas": betas, "loso_by_season": loso,
            "loso_pooled": {"model": "M0", "n": 4200, "covered": {"p50": 0.94, "lo": 0.93, "hi": 0.95}},
            "seam": {"d_raw": 310.0, "d_harm": 12.0, "ratio": 0.039, "chow_p_raw": 0.0001, "chow_p_harm": 0.61},
            "sp_nrt_ratio": {"p50": 1.02, "lo": 0.97, "hi": 1.08}}


def _fixture_validation(branch, rng):
    weeks = [d.strftime("%Y-%m-%d") for d in pd.date_range("2018-11-05", periods=30, freq="W-MON")]
    gp = branch not in ("nightfire", "nokiln")
    g2 = branch == "full"
    v = {"gates": [{"gate": "G0", "criterion": "Share of kiln clusters with a type=2 detection", "value": 0.41, "threshold": "informational"},
                   {"gate": "G1", "criterion": "All three criteria", "value": 1.0 if gp else 0.0, "threshold": "all hold", "pass": gp},
                   {"gate": "G1", "criterion": "Contrast: mean DR(kiln) / mean DR(control)", "value": 5.2 if gp else 1.3, "threshold": "≥ 3, perm p < 0.01", "p": 0.0001 if gp else 0.3, "pass": gp},
                   {"gate": "G2", "criterion": "All three criteria", "value": 1.0 if g2 else 0.0, "threshold": "all hold", "pass": g2}],
         "profiles": {"week": weeks, "kiln_day": [0.2] * 30, "kiln_night": [0.15] * 30, "ctrl_day": [0.05] * 25 + [0.4] * 5, "ctrl_night": [0.01] * 30},
         "radius_sweep": [{"radius_m": r, "kiln": k, "ctrl": c} for r, k, c in ((200, 0.12, 0.01), (400, 0.2, 0.03), (750, 0.25, 0.08), (1500, 0.3, 0.2))],
         "classifier": {"pr_curve": [[r / 10, 1 - r / 25] for r in range(11)], "pr_auc": {"p50": 0.81, "lo": 0.78, "hi": 0.84}, "baseline_pr_auc": 0.52, "prevalence": 0.3,
                        "importance": [{"feature": f, "value": round(0.1 / (i + 1), 3)} for i, f in enumerate(["p30", "is_night", "bt_diff", "frp", "iso1"])],
                        "holdouts": [{"kind": k, "pr_auc": {"p50": 0.78, "lo": 0.7, "hi": 0.83}} for k in ("spatial", "temporal", "cross_sensor_N_J1", "cross_sensor_J1_J2")],
                        "labelset": [{"kind": "footprint_only", "pr_auc": {"p50": 0.81, "lo": 0.78, "hi": 0.84}}, {"kind": "with_type2", "pr_auc": {"p50": 0.84, "lo": 0.81, "hi": 0.87}}],
                        "ablation_no_persistence": {"p50": 0.66, "lo": 0.62, "hi": 0.7}},
         "controls": {"dropped_frac": 0.06, "by_division": {"Dhaka": 0.12, "Rajshahi": 0.02}, "rung_counts": {"0": 900, "1": 200, "2": 80}},
         "candidates": {"n": 37, "by_district": {"Dhaka": 12, "Rajshahi": 5}},
         "skipped": [{"stage": "s2score", "reason": "data/static/s2_checks.csv absent"}]}
    if branch == "full":
        v["tropomi"] = {"treatment": "HKFI", "did_no2": {"p50": 2.1e-6, "lo": 0.8e-6, "hi": 3.3e-6},
                        "monthly": [{"month": f"2020-{m:02d}", "belt_minus_ring": 1e-6 * (m % 6), "index": 0.2 * (m % 6)} for m in range(1, 13)]}
        v["pm25"] = [{"lag": lag, "r_kiln": {"p50": 0.3 - 0.1 * lag, "lo": 0.1 - 0.1 * lag, "hi": 0.5 - 0.1 * lag},
                      "r_veg": {"p50": 0.1, "lo": -0.1, "hi": 0.3}} for lag in range(3)]
        v["transfer"] = {"district": "Faisalabad", "dr_computed": True, "pr_auc": {"p50": 0.7, "lo": 0.62, "hi": 0.77}, "gate_pass": True}
    if branch == "nokiln":
        v["tropomi"] = {"treatment": "HBI", "did_no2": {"p50": 1e-6, "lo": -0.5e-6, "hi": 2.5e-6}, "monthly": []}
    return v


def run(regulator=False, fixtures=False, check_public=None, publish_=False, downscale="none") -> None:
    if fixtures:
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
