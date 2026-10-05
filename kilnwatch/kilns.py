"""Inventory reconciliation, clusters with a diameter cap, matched controls, detection linking (architecture §5.3)."""
from __future__ import annotations

import logging
from typing import Literal

import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN
from sklearn.neighbors import BallTree

from . import config as C
from .grid import pixel_radius_m

log = logging.getLogger("kilnwatch.kilns")
R_EARTH = 6_371_000.0


def _rad(lat, lon):
    return np.radians(np.c_[np.asarray(lat, float), np.asarray(lon, float)])


def haversine_m(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi, dl = p2 - p1, np.radians(np.asarray(lon2) - np.asarray(lon1))
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * R_EARTH * np.arcsin(np.sqrt(a))


def reconcile(inv: pd.DataFrame, radius_m=150) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Cross-match sources within radius_m; returns (primary kilns with matched_srcs, agreement matrix)."""
    srcs = sorted(inv["src"].unique())
    agree = pd.DataFrame(index=srcs, columns=srcs, dtype=float)
    trees = {s: BallTree(_rad(g.lat, g.lon), metric="haversine") for s, g in inv.groupby("src")}
    for a in srcs:
        ga = inv[inv.src == a]
        for b in srcs:
            cnt = trees[b].query_radius(_rad(ga.lat, ga.lon), r=radius_m / R_EARTH, count_only=True)
            agree.loc[a, b] = float(np.mean(cnt > 0))
    prim = inv[(inv.src == "apad") & (inv.country == "BD")].copy()  # primary by the §12 rule (PREREGISTRATION.md)
    prim["matched_srcs"] = ""
    for b in srcs:
        if b == "apad":
            continue
        hit = trees[b].query_radius(_rad(prim.lat, prim.lon), r=radius_m / R_EARTH, count_only=True) > 0
        prim.loc[hit, "matched_srcs"] += b + ";"
    prim["kiln_id"] = np.arange(len(prim))
    return prim.reset_index(drop=True), agree


def measure_eps(viirs: pd.DataFrame) -> float:
    """Median VIIRS S-NPP pixel half-diagonal over Bangladesh, metres."""
    n = viirs[viirs.sensor == "N"]
    return float(np.median(pixel_radius_m(n.scan_km, n.track_km)))


def _diameter_m(lat, lon) -> float:
    if len(lat) < 2:
        return 0.0
    # ponytail: O(n^2) over a cluster's kilns; clusters are capped at 2% of kilns (~95 points)
    la, lo = np.asarray(lat), np.asarray(lon)
    return float(haversine_m(la[:, None], lo[:, None], la[None, :], lo[None, :]).max())


def _bisect(idx: np.ndarray, lat, lon, max_diam_m, max_n) -> list[np.ndarray]:
    """Recursive bisection on the longest axis until every part has diameter <= cap and size <= max_n."""
    out, stack = [], [idx]
    while stack:
        part = stack.pop()
        if len(part) <= 1 or (len(part) <= max_n and _diameter_m(lat[part], lon[part]) <= max_diam_m):
            out.append(part)
            continue
        y = lat[part] * 111_000
        x = lon[part] * 111_000 * np.cos(np.radians(lat[part].mean()))
        axis = x if np.ptp(x) >= np.ptp(y) else y
        cut = np.median(axis)
        left, right = part[axis <= cut], part[axis > cut]
        if len(right) == 0:  # ties at the median: split by order
            o = np.argsort(axis, kind="stable")
            left, right = part[o[: len(o) // 2]], part[o[len(o) // 2:]]
        stack += [left, right]
    return out


def cluster(kilns: pd.DataFrame, eps_m: float, max_diam_m=C.MAX_CLUSTER_DIAM_M, max_share=C.MAX_CLUSTER_SHARE):
    """DBSCAN(min_samples=1) = connected components at eps; oversize components are bisected."""
    import geopandas as gpd

    lat, lon = kilns.lat.to_numpy(), kilns.lon.to_numpy()
    lab = DBSCAN(eps=eps_m / R_EARTH, min_samples=1, metric="haversine", algorithm="ball_tree").fit_predict(_rad(lat, lon))
    max_n = max(1, int(np.floor(max_share * len(kilns))))
    cid = np.empty(len(kilns), dtype=int)
    k = 0
    for g in np.unique(lab):
        for part in _bisect(np.flatnonzero(lab == g), lat, lon, max_diam_m, max_n):
            cid[part] = k
            k += 1
    kilns = kilns.assign(cluster_id=cid)
    pts = gpd.GeoDataFrame(kilns, geometry=gpd.points_from_xy(lon, lat), crs=4326).to_crs(C.METRIC_CRS)
    pts["geometry"] = pts.buffer(250)
    foot = pts.dissolve("cluster_id").reset_index()
    agg = kilns.groupby("cluster_id").agg(n_kilns=("kiln_id", "size"), lat=("lat", "mean"), lon=("lon", "mean"))
    agg["diameter_m"] = [_diameter_m(g.lat.to_numpy(), g.lon.to_numpy()) for _, g in kilns.groupby("cluster_id")]
    clusters = gpd.GeoDataFrame(agg.reset_index().merge(foot[["cluster_id", "geometry"]], on="cluster_id"), crs=C.METRIC_CRS).to_crs(4326)
    return kilns, clusters


def assert_clusters(clusters, n_kilns) -> None:
    assert clusters.diameter_m.max() <= C.MAX_CLUSTER_DIAM_M + 1e-6, "A4b: cluster diameter > cap"
    assert clusters.n_kilns.max() <= max(1, C.MAX_CLUSTER_SHARE * n_kilns), "A4b: cluster > 2% of kilns"


RUNGS = [  # (area level, min km from kiln, max km, require same wc class)
    ("district", 5, 10, True),
    ("district", 3, 10, True),
    ("division", 3, 10, True),
    ("division", 3, 10, False),  # rung 3: nearest matching class within division -> class requirement relaxed
]


def sample_controls(clusters, kilns, districts, divisions, n=3, rng=None, wc_lookup=None, attempts=C.CONTROL_ATTEMPTS_MAX):
    """Seeded rejection sampling, at most `attempts` candidate points per control per rung, recording rung_used.

    Candidates are drawn in vectorised batches inside the (simplified, prepared) area polygon. A cluster's three
    controls are >= 5 km apart from each other. wc_lookup(lat[], lon[]) -> class[]; None treats every point as matching.
    """
    import shapely

    rng = rng if rng is not None else C.rng("kilns")
    ktree = BallTree(_rad(kilns.lat, kilns.lon), metric="haversine")
    polys = {}
    for lvl, gdf in (("district", districts), ("division", divisions)):
        g = gdf.set_index("name_en").geometry.simplify(0.002)
        shapely.prepare(g.values)
        polys[lvl] = g
    rows, dropped = [], []
    for c in clusters.itertuples():
        got: list[tuple[float, float, int]] = []
        for rung, (lvl, kmin, kmax, same_wc) in enumerate(RUNGS):
            poly = polys[lvl].get(getattr(c, lvl), None)
            if poly is None:
                continue
            w, s, e, nn = poly.bounds
            budget = attempts * (n - len(got))
            while len(got) < n and budget > 0:
                k = min(512, budget)
                budget -= k
                x, y = rng.uniform(w, e, k), rng.uniform(s, nn, k)
                ok = shapely.contains_xy(poly, x, y)
                x, y = x[ok], y[ok]
                if not len(x):
                    continue
                d_km = ktree.query(_rad(y, x), k=1)[0][:, 0] * R_EARTH / 1000
                ok = (d_km >= kmin) & (d_km <= kmax)
                x, y = x[ok], y[ok]
                if same_wc and wc_lookup is not None and getattr(c, "wc_class", None) is not None and len(x):
                    ok = np.asarray(wc_lookup(y, x)) == c.wc_class
                    x, y = x[ok], y[ok]
                for lat, lon in zip(y, x):
                    if got and haversine_m(lat, lon, np.array([g[0] for g in got]), np.array([g[1] for g in got])).min() < 5000:
                        continue
                    got.append((float(lat), float(lon), rung))
                    if len(got) == n:
                        break
            if len(got) == n:
                break
        if len(got) < n:
            dropped.append(c.cluster_id)
            continue
        for j, (lat, lon, rung) in enumerate(got):
            rows.append({"control_id": f"{c.cluster_id}_{j}", "cluster_id": c.cluster_id, "lat": lat, "lon": lon,
                         "dlat": lat - c.lat, "dlon": lon - c.lon, "district": c.district, "division": c.division, "rung_used": rung})
    ctrl = pd.DataFrame(rows)
    ctrl.attrs["dropped"] = dropped
    return ctrl


def control_report(clusters, ctrl) -> dict:
    dropped = set(ctrl.attrs.get("dropped", []))
    drop = clusters.cluster_id.isin(dropped)
    by_div = clusters.assign(d=drop).groupby("division")["d"].mean().round(3).to_dict()
    rung_counts = ctrl.rung_used.value_counts().sort_index()
    return {"dropped_frac": float(drop.mean()), "by_division": by_div,
            "rung_counts": {str(k): int(v) for k, v in rung_counts.items()}}


def link(det: pd.DataFrame, points: pd.DataFrame, radius: Literal["pixel"] | float) -> pd.DataFrame:
    """Link detections to units whose (translated) kiln points lie within radius metres.

    points: lat, lon, unit_type, unit_id. radius 'pixel' uses each detection's own pixel half-diagonal.
    Returns det_idx, unit_type, unit_id.
    """
    if len(points) == 0 or len(det) == 0:
        return pd.DataFrame(columns=["det_idx", "unit_type", "unit_id"])
    tree = BallTree(_rad(points.lat, points.lon), metric="haversine")
    r = pixel_radius_m(det.scan_km, det.track_km) if radius == "pixel" else np.full(len(det), float(radius))
    hits = tree.query_radius(_rad(det.lat, det.lon), r=np.asarray(r) / R_EARTH)
    lens = np.fromiter((len(h) for h in hits), int, len(hits))
    if lens.sum() == 0:
        return pd.DataFrame(columns=["det_idx", "unit_type", "unit_id"])
    di = np.repeat(det.index.to_numpy(), lens)
    pi = np.concatenate([h for h in hits if len(h)])
    out = pd.DataFrame({"det_idx": di, "unit_type": points.unit_type.to_numpy()[pi], "unit_id": points.unit_id.to_numpy()[pi]})
    return out.drop_duplicates()


def link_points(kilns, ctrl) -> pd.DataFrame:
    """Kiln points per cluster plus the same points translated to each control (identical area by construction)."""
    kp = pd.DataFrame({"lat": kilns.lat, "lon": kilns.lon, "unit_type": "cluster", "unit_id": kilns.cluster_id.astype(str)})
    if len(ctrl) == 0:
        return kp
    m = ctrl.merge(kilns[["cluster_id", "lat", "lon"]].rename(columns={"lat": "klat", "lon": "klon"}), on="cluster_id")
    cp = pd.DataFrame({"lat": m.klat + m.dlat, "lon": m.klon + m.dlon, "unit_type": "control", "unit_id": m.control_id})
    return pd.concat([kp, cp], ignore_index=True)


def run() -> None:
    import geopandas as gpd

    from .ingest import _parquet, read_units

    inv = pd.read_parquet(C.INTERIM / "inventory.parquet")
    det = pd.read_parquet(C.INTERIM / "detections.parquet", columns=["sensor", "scan_km", "track_km", "season"])
    kilns, agree = reconcile(inv)
    eps = measure_eps(det)
    C.write_derived("DBSCAN_EPS_M", round(eps, 1), "median VIIRS S-NPP pixel half-diagonal over Bangladesh (A4a)")
    kilns, clusters = cluster(kilns, eps)
    assert_clusters(clusters, len(kilns))
    units = read_units()
    dist = units[units.level == "district"]
    divs = units[units.level == "division"]
    cp = gpd.GeoDataFrame(clusters[["cluster_id"]], geometry=gpd.points_from_xy(clusters.lon, clusters.lat), crs=4326)
    j = gpd.sjoin(cp, dist[["name_en", "division", "geometry"]], how="left", predicate="within").drop_duplicates("cluster_id")
    # clusters whose centroid falls just outside the coastline snap to the nearest district
    miss = j.name_en.isna()
    if miss.any():
        near = gpd.sjoin_nearest(cp[miss.values].to_crs(C.METRIC_CRS), dist[["name_en", "division", "geometry"]].to_crs(C.METRIC_CRS))
        j.loc[miss, ["name_en", "division"]] = near[["name_en", "division"]].values
    clusters["district"] = j["name_en"].values
    clusters["division"] = j["division"].values
    ctrl = sample_controls(clusters, kilns, dist, divs)
    rep = control_report(clusters, ctrl)
    sens = {e: int(cluster(kilns.drop(columns="cluster_id"), e)[1].shape[0]) for e in (300, 550, 800)}
    lines = ["# Inventory report (A4)", "", "## Source agreement within 150 m", agree.to_markdown(), "",
             f"Primary inventory: APAD (CC BY 4.0), {len(kilns)} kilns in Bangladesh. DoE register: about 7,000–7,500 kilns.",
             f"Registered-versus-detected gap: about {7000 - len(kilns)}–{7500 - len(kilns)} kilns.", "",
             f"DBSCAN_EPS_M = {eps:.1f} m (median S-NPP half-diagonal). Clusters: {len(clusters)}; "
             f"max diameter {clusters.diameter_m.max():.0f} m; max size {clusters.n_kilns.max()}.",
             f"Sensitivity (eps → clusters): {sens}", "",
             "Clustering uses a constant eps while linking uses per-detection radii: cluster membership is scale-stable, link attribution is not.", "",
             "## Controls", f"```\n{rep}\n```", "",
             "Interpretation: '>=5 km from other controls' is applied among a cluster's own three controls. Applied across all "
             "~11,000 controls it would require disjoint 5 km discs covering more than Bangladesh's land area."]
    (C.REPORTS / "inventory_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    log.info("controls: %s", rep)
    (C.INTERIM / "controls_report.json").write_text(__import__("json").dumps(rep), encoding="utf-8")
    assert rep["dropped_frac"] <= C.CONTROL_DROP_MAX, f"A4c: national control drop {rep['dropped_frac']:.2f} > {C.CONTROL_DROP_MAX}"
    worst = max(rep["by_division"].values())
    assert worst <= C.CONTROL_DROP_MAX_DIV, f"A4c: division drop {worst:.2f} > {C.CONTROL_DROP_MAX_DIV}"
    kt = BallTree(_rad(kilns.lat, kilns.lon), metric="haversine")
    near_m = kt.query(_rad(ctrl.lat, ctrl.lon), k=1)[0][:, 0] * R_EARTH
    assert (near_m >= 2999).all(), "A4c: control within 3 km of a kiln"
    _parquet(kilns, C.INTERIM / "kilns.parquet")
    _parquet(clusters.to_wkb(), C.INTERIM / "clusters.parquet")
    _parquet(ctrl, C.INTERIM / "controls.parquet")
    # A4d: link every detection to clusters (kiln points) and controls (translated points) within its own pixel radius
    det = pd.read_parquet(C.INTERIM / "detections.parquet", columns=["lat", "lon", "scan_km", "track_km"])
    links = link(det, link_points(kilns, ctrl), "pixel")
    _parquet(links.assign(radius_m="pixel"), C.INTERIM / "links.parquet")
    log.info("links: %d detection-unit links", len(links))
