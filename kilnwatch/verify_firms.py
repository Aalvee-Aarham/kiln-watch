"""Independent NASA FIRMS cross-check (not part of `all`, not a test, not in CI).

Re-fetches FIRMS for the project's analysis box with the project's own ingestion + normalisation
code, recomputes annual counts and `fire_days` (unique cell x day), and compares the result with
the committed real export and a published Bangladesh reference. Writes
`reports/firms_verification.md` and `.json`. Area-level totals only: no kiln data (invariant 3).

Run: `python -m kilnwatch verify-firms [--sources S ...] [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--cached-only]`
"""
from __future__ import annotations

import json
import logging
from datetime import date

import numpy as np
import pandas as pd

from . import config as C
from . import ingest as I

log = logging.getLogger("kilnwatch.verify_firms")

VERIFY_ROOT = C.RAW / "verify" / "firms"  # gitignored (under data/raw)
REAL_EXPORT = C.WEB_FIXT / "nokiln" / "data"
REFERENCE = C.ROOT / "tests" / "fixtures" / "firms_bd_reference.csv"
KEEP_CONF = ("nominal", "high")


def _spearman(a, b) -> float | None:
    if len(a) < 3:
        return None
    ra, rb = pd.Series(list(a)).rank().to_numpy(), pd.Series(list(b)).rank().to_numpy()
    if np.std(ra) == 0 or np.std(rb) == 0:
        return None
    return round(float(np.corrcoef(ra, rb)[0, 1]), 3)


def _download(sources: list[str], start: date | None, end: date | None) -> None:
    av = I.data_availability().set_index("data_id")
    for src in sources:
        lo = pd.Timestamp(av.loc[src, "min_date"]).date()
        hi = pd.Timestamp(av.loc[src, "max_date"]).date()
        if start:
            lo = max(lo, start)
        if end:
            hi = min(hi, end)
        if lo > hi:
            log.warning("%s: no window in range", src)
            continue
        n = I.backfill(src, lo, hi, workers=4, root=VERIFY_ROOT)
        log.info("%s: %d windows %s..%s", src, n, lo, hi)


def _season_counts(det: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
    """count and fire_days (unique cell x day) by the given keys, plus the nominal+high subset."""
    g = det.groupby(keys, observed=True)
    out = g.size().rename("count").to_frame()
    out["fire_days"] = (det.drop_duplicates([*keys, "cell_id", "date_local"])
                        .groupby(keys, observed=True).size())
    nh = det[det.conf_class.astype(str).isin(KEEP_CONF)]
    out["count_nh"] = nh.groupby(keys, observed=True).size()
    out["fire_days_nh"] = (nh.drop_duplicates([*keys, "cell_id", "date_local"])
                           .groupby(keys, observed=True).size())
    return out.fillna(0).astype(int).reset_index()


def _committed() -> dict:
    d = json.loads((REAL_EXPORT / "harmonization.json").read_text(encoding="utf-8"))
    return {r["season"]: r for r in d["yearly"]}


def analyze(det: pd.DataFrame) -> dict:
    """Pure: turn a normalised detections frame into the comparison payload (testable, no I/O)."""
    season = _season_counts(det, ["season", "sensor"])
    year = _season_counts(det.assign(year=det.date_local.dt.year), ["year", "sensor"])
    pivot = season.pivot_table(index="season", columns="sensor", values="count", aggfunc="sum").fillna(0)
    comm = _committed()
    common = sorted(set(pivot.index) & set(comm))

    def comm_val(kind: str, s: str):
        return comm[s]["raw_by_sensor"].get(kind)

    shape = {}
    for sens in ("N", "A"):
        xs = [comm_val(sens, s) for s in common]
        ys = [float(pivot.loc[s, sens]) if sens in pivot.columns else 0.0 for s in common]
        shape[sens] = {"n": len(common), "spearman_vs_committed": _spearman(xs, ys),
                       "fresh_total": int(sum(ys)), "committed_total": (round(float(sum(v for v in xs if v is not None)), 1)
                                                                        if any(v is not None for v in xs) else None)}

    # sensor ordering across common seasons: median fresh N/A
    na = [float(pivot.loc[s, "N"]) / float(pivot.loc[s, "A"])
          for s in common if "N" in pivot.columns and "A" in pivot.columns and pivot.loc[s, "A"]] if common else []
    sensor_ratio = {"median_fresh_N_over_A": round(float(np.median(na)), 2) if na else None}

    # S-NPP annual fire_days vs the published reference (calendar year). The reference is built
    # from the VIIRS S-NPP product only, so compare sensor N alone, not N+NOAA-20+NOAA-21.
    snpp = year[year.sensor == "N"].groupby("year", as_index=False).sum(numeric_only=True)
    got = dict(zip(snpp.year, snpp.fire_days))
    ref = pd.read_csv(REFERENCE, comment="#")
    pairs = [(int(r.year), int(r.fire_days)) for _, r in ref.iterrows() if int(r.year) in got]
    reference = {"n": len(pairs),
                 "spearman": _spearman([v for _, v in pairs], [got[y] for y, _ in pairs]),
                 "fresh_fire_days_total": int(sum(got[y] for y, _ in pairs)),
                 "reference_fire_days_total": int(sum(v for _, v in pairs))}
    return {"season_by_sensor": season.to_dict("records"),
            "year_by_sensor": year.to_dict("records"),
            "shape_vs_committed": shape, "sensor_ordering": sensor_ratio, "reference": reference}


def _write_reports(payload: dict) -> None:
    C.REPORTS.mkdir(exist_ok=True)
    (C.REPORTS / "firms_verification.json").write_text(json.dumps(payload, indent=1, default=str), encoding="utf-8")
    r = payload
    fresh: dict[str, int] = {}
    for row in r["season_by_sensor"]:
        fresh[row["sensor"]] = fresh.get(row["sensor"], 0) + int(row["count"])
    lines = ["# FIRMS verification (independent re-fetch)", "",
             "Area-level totals only. Compares a fresh NASA FIRMS pull (same code path as ingest) with the",
             "committed real export and a published Bangladesh reference.", "",
             "## Fresh detections by sensor (bbox 88.0-92.8 E, 20.5-26.7 N)", "",
             "| sensor | product | fresh count | committed `ingest_counts.md` total |",
             "|---|---|---|---|"]
    comm_counts = {"T": 32324, "A": 229227, "N": 571917, "J1": 301096, "J2": 87245}
    names = {"T": "Terra", "A": "Aqua", "N": "S-NPP", "J1": "NOAA-20", "J2": "NOAA-21"}
    for sens in sorted(fresh):
        lines.append(f"| {sens} | {names.get(sens, sens)} | {fresh[sens]} | {comm_counts.get(sens, '-')} |")
    lines += ["",
              "A (`Aqua`) is lower here only because this run starts 2012-01-01 while the committed pull",
              "starts 2000-11-01; the rank comparison below uses only shared seasons.", "",
              "## Shape vs the committed series (levels are not comparable across the harmonization; rank only)", "",
              "| sensor | shared seasons | Spearman vs committed | fresh count (shared seasons) |",
              "|---|---|---|---|"]
    for sens, v in r["shape_vs_committed"].items():
        lines.append(f"| {sens} | {v['n']} | {v['spearman_vs_committed']} | {v['fresh_total']} |")
    lines += ["", "## Sensor ordering", "",
              f"Median fresh N/A over shared seasons: **{r['sensor_ordering']['median_fresh_N_over_A']}** "
              "(published Bangladesh factor ~3.6, Vadrevu et al. 2019).", "",
              "## S-NPP annual fire-days vs published reference (AURSEE, NASA FIRMS S-NPP 375 m)", "",
              f"- pairs: {r['reference']['n']}",
              f"- Spearman: **{r['reference']['spearman']}**",
              f"- fresh fire-days total: {r['reference']['fresh_fire_days_total']}",
              f"- reference fire-days total: {r['reference']['reference_fire_days_total']}", ""]
    (C.REPORTS / "firms_verification.md").write_text("\n".join(lines), encoding="utf-8")


def run(sources: list[str] | None = None, start: str | None = None, end: str | None = None,
        cached_only: bool = False) -> dict:
    sources = sources or list(I.SOURCES)
    if not cached_only:
        if not C.FIRMS_MAP_KEY:
            raise SystemExit("FIRMS_MAP_KEY is empty. Put it in .env, or run with --cached-only.")
        _download(sources, pd.Timestamp(start).date() if start else None, pd.Timestamp(end).date() if end else None)
    api = VERIFY_ROOT / "api"
    if not api.exists() or not any(api.glob("*/*.csv")):
        raise SystemExit(f"No cached detections under {api}. Run without --cached-only first.")
    det = I.load_firms(sources, root=api)
    log.info("verify: %d detections (cached=%s)", len(det), cached_only)
    payload = analyze(det)
    payload["meta"] = {"sources": sources, "start": start, "end": end, "cached_only": cached_only,
                       "n_detections": int(len(det)), "bbox": [C.BBOX_W, C.BBOX_S, C.BBOX_E, C.BBOX_N]}
    _write_reports(payload)
    return payload
