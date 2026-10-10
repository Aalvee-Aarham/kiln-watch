"""Research data release (docs/roadmap.md F2): the public export re-shaped as tidy CSV + Parquet tables.

Built only from the public tier (default `web/public/data`), so it can hold nothing the website does not already
publish: area-level calendars, the calibration table and national series. No kiln, cluster or coordinate column.
"""
from __future__ import annotations

import hashlib
import json
import logging
import shutil
from pathlib import Path

import numpy as np
import pandas as pd

from . import config as C
from .export import _git_sha

log = logging.getLogger("kilnwatch.research")
DAY0 = pd.Timestamp("2003-01-01")
FORBIDDEN_COLUMNS = C.FORBIDDEN_PUBLIC_KEYS | {"lat", "lon", "latitude", "longitude"}
LICENCE = "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Cite as: Kiln Watch, NASA Space Apps 2026, https://github.com/Aalvee-Aarham/kiln-watch"


def _units(src: Path) -> pd.DataFrame:
    rows = []
    for level in ("district", "upazila"):
        p = src / "aoi" / f"{level}s.geojson"
        if p.exists():
            rows += [{k: f["properties"].get(k) for k in ("unit_id", "level", "name_en", "division")} for f in json.loads(p.read_text(encoding="utf-8"))["features"]]
    return pd.DataFrame(rows, columns=["unit_id", "level", "name_en", "division"]).drop_duplicates("unit_id")


def calendar_len(cal: dict) -> int:
    """Days covered by a sparse calendar file: through its last active day or its last not-observed run."""
    return max(cal["days"][-1] if cal["days"] else 0, max((e for _, e in cal["nodata"]), default=0)) + 1


def calendar_daily(cal: dict) -> pd.DataFrame:
    """One sparse calendar file → one row per day from day0. h is NaN on not-observed days and 0 on observed days with
    no fire, so "no fire" and "not seen" stay different facts."""
    days = np.asarray(cal["days"], dtype=int)
    n = calendar_len(cal)
    observed = np.ones(n, bool)
    for a, b in cal["nodata"]:
        observed[a:b + 1] = False

    def dense(values):
        out = np.zeros(n)
        out[days] = values
        return out

    df = pd.DataFrame({"unit_id": cal["unit_id"], "date": DAY0 + pd.to_timedelta(np.arange(n), "D"), "observed": observed})
    df["h"] = np.where(observed, dense(cal["h"]), np.nan)
    for s, v in cal["raw"].items():
        df[f"raw_{s}"] = dense(v)
    for part in cal["split"]:
        df[f"split_{part['key']}"] = np.where(observed, dense(part["values"]), np.nan)
    return df


def season_rows(cal: dict) -> list[dict]:
    out = []
    for s in cal["seasons"]:
        r = {"unit_id": cal["unit_id"], "season": s["season"], "first": s.get("first"), "last": s.get("last")}
        for m in ("midpoint", "duration", "peak"):
            for q in ("p50", "lo", "hi"):
                r[f"{m}_{q}"] = s[m][q] if s.get(m) else None
        out.append(r)
    return out


def check_columns(df: pd.DataFrame, name: str) -> None:
    """Name-level safety check for tables: the research tier may never carry kiln-level or coordinate columns."""
    bad = FORBIDDEN_COLUMNS & {c.lower() for c in df.columns}
    if bad:
        raise ValueError(f"{name}: forbidden column(s) {sorted(bad)}")


def write(src: Path = C.WEB_DATA, out: Path = C.ROOT / "research") -> dict:
    src, out = Path(src), Path(out)
    meta = json.loads((src / "meta.json").read_text(encoding="utf-8"))
    tmp = out.with_name(out.name + ".tmp")
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir(parents=True)
    units = _units(src)
    cals = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((src / "calendar").glob("*.json"))]
    daily = pd.concat([calendar_daily(c) for c in cals], ignore_index=True)
    tables = {
        "units": units,
        "calendar_daily": daily,
        "calendar_monthly": daily.assign(month=daily.date.dt.to_period("M").astype(str)).groupby(["unit_id", "month"], as_index=False)
                                 .agg(observed_days=("observed", "sum"), h_sum=("h", "sum"), **{c: (c, "sum") for c in daily.columns if c.startswith(("raw_", "split_"))}),
        "calendar_weekly_ci": pd.DataFrame([{"unit_id": c["unit_id"], "week_start": (pd.Timestamp(c["week0"]) + pd.Timedelta(weeks=i)).strftime("%Y-%m-%d"),
                                             "h_lo": lo, "h_hi": hi} for c in cals for i, (lo, hi) in enumerate(zip(c["h_lo"], c["h_hi"]))]),
        "season_metrics": pd.DataFrame([r for c in cals for r in season_rows(c)]),
    }
    harm = json.loads((src / "harmonization.json").read_text(encoding="utf-8"))
    tables["calibration_betas"] = pd.DataFrame([{**{k: b[k] for k in ("step", "division", "month", "pass", "loc", "rung_used", "n_celldays", "n_days")},
                                                 "beta_p50": b["beta"]["p50"], "beta_lo": b["beta"]["lo"], "beta_hi": b["beta"]["hi"]} for b in harm["betas"]])
    tables["national_yearly"] = pd.DataFrame([{"season": y["season"], "raw_sum": y["raw_sum"], "h_p50": y["h"]["p50"], "h_lo": y["h"]["lo"], "h_hi": y["h"]["hi"],
                                               "aqua_observed": y.get("aqua_obs"), **{f"raw_{k}": v for k, v in y["raw_by_sensor"].items()}} for y in harm["yearly"]])
    ka_p = src / "kiln_activity.json"
    if ka_p.exists():
        ka = json.loads(ka_p.read_text(encoding="utf-8"))
        tables["kiln_seasons_by_area"] = pd.DataFrame([{"unit_id": uid, "n_clusters": a["n_clusters"], "season": s["season"],
                                                        **{f"{m}_{q}": (s[m] or {}).get(q) for m in ("onset", "end", "duration", "peak") for q in ("p50", "lo", "hi")}}
                                                       for uid, a in [("national", ka["national"]), *ka.get("areas", {}).items()] for s in a.get("seasons") or []])
    files = {}
    for name, df in tables.items():
        check_columns(df, name)
        df.to_parquet(tmp / f"{name}.parquet", index=False)
        files[f"{name}.parquet"] = len(df)
        if name != "calendar_daily":  # ~5M rows: Parquet only
            df.to_csv(tmp / f"{name}.csv", index=False)
            files[f"{name}.csv"] = len(df)
    shutil.copyfile(Path(__file__).with_name("research_dictionary.md"), tmp / "DATA_DICTIONARY.md")
    (tmp / "LICENSE.txt").write_text(LICENCE + "\n", encoding="utf-8")
    manifest = {"source_build": meta.get("git_sha"), "prereg_sha": meta.get("prereg_sha"), "gate_branch": meta.get("gate_branch"),
                "generated_from": meta.get("generated_at"), "code_sha": _git_sha(), "licence": LICENCE,
                "files": {f: {"rows": n, "sha256": hashlib.sha256((tmp / f).read_bytes()).hexdigest()} for f, n in sorted(files.items())}}
    (tmp / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    if out.exists():
        shutil.rmtree(out)
    tmp.replace(out)
    log.info("research release: %d tables in %s", len(tables), out)
    return manifest
