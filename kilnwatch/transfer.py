"""Does the night-light kiln method work outside Bangladesh? (PREREGISTRATION_AMENDMENTS.md, Amendment 2)

Per country: APAD kilns -> clusters (the A4 rule) -> a seeded sample, split into calibration and confirmation clusters
-> three distance-ring controls per cluster -> Black Marble night lights (and Sentinel-1 radar on a nested subsample) at
every site -> the four Amendment 1 criteria, once with Bangladesh's months (strict) and once with months learned on the
calibration clusters only (local). Public output is country-level only: no kiln, cluster or coordinate leaves data/interim.
"""
from __future__ import annotations

import json
import logging
import warnings

import numpy as np
import pandas as pd
from sklearn.neighbors import BallTree

from . import activity as A
from . import config as C
from .kilns import R_EARTH, _rad, cluster

log = logging.getLogger("kilnwatch.transfer")
COUNTRIES = {
    "PK": {"name": "Pakistan", "inventory": "apad_transfer/Brick_Kilns_PK-Main_coal.csv", "adm0": "PAK"},
    "IN": {"name": "India", "inventory": "apad_ind/Brick_Kilns_IND-Main_coal.csv", "adm0": "IND"},
}
ALL_INVENTORIES = ("apad_bd/Brick_kilns_BAN-Main_coal.csv", "apad_transfer/Brick_Kilns_PK-Main_coal.csv", "apad_ind/Brick_Kilns_IND-Main_coal.csv")
N_SAMPLE, N_CAL = 2000, 400        # clusters per country; 400 calibration clusters, as Bangladesh's pilot
N_S1_CAL, N_S1_CONF = 150, 600     # radar runs on a nested subsample (about 3x the Earth Engine cost per site)
RINGS = [(5, 10, True), (3, 10, True), (3, 15, True), (3, 15, False)]  # (min km, max km, same WorldCover class)
NOT_LAND = (0, 80)                 # WorldCover no-data and permanent water never host a control
SEASON_ORDER = (7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6)
CORE_LEN, OFF_LEN = 5, 4           # Amendment 1 window lengths (Dec–Apr, Jul–Oct)
PROFILE_SEASONS = ("2012-13", "2024-25")
LAST_YEAR = 2025                   # last calendar year extracted: every evaluated season ends by June 2025
CACHE = C.RAW / "gee" / "transfer"
TESTS = {"TL": ("ntl", "strict"), "LL": ("ntl", "local"), "TS": ("s1", "strict"), "LS": ("s1", "local")}


# --- sample, sites and controls (inventory, WorldCover and borders only) ------------------
def load_kilns(rel: str) -> pd.DataFrame:
    d = pd.read_csv(C.RAW / "inventories" / rel, encoding="utf-8-sig").dropna(subset=["lat", "lon"])
    return pd.DataFrame({"kiln_id": np.arange(len(d)), "lat": d.lat.to_numpy(float), "lon": d.lon.to_numpy(float)})


def split(cluster_ids, rng, n=N_SAMPLE, n_cal=N_CAL) -> tuple[np.ndarray, np.ndarray]:
    """Seeded permutation of the sorted ids; the first n are sampled and the first n_cal of those calibrate.
    Both parts keep the permuted order, so a nested subsample is a prefix of each."""
    perm = rng.permutation(np.sort(np.asarray(cluster_ids)))[:n]
    return perm[:n_cal], perm[n_cal:]


def representatives(kilns: pd.DataFrame, clusters: pd.DataFrame) -> pd.DataFrame:
    """The kiln nearest each cluster centroid (ties by kiln_id), as activity.sites picks it."""
    k = kilns.merge(clusters[["cluster_id", "lat", "lon"]].rename(columns={"lat": "clat", "lon": "clon"}), on="cluster_id")
    k["d2"] = (k.lat - k.clat) ** 2 + ((k.lon - k.clon) * np.cos(np.radians(k.clat))) ** 2
    return k.sort_values(["cluster_id", "d2", "kiln_id"]).drop_duplicates("cluster_id")[["cluster_id", "lat", "lon"]].reset_index(drop=True)


def ring_controls(reps: pd.DataFrame, wc_class: dict, kiln_lat, kiln_lon, inside, wc_lookup, rng, n=3, attempts=C.CONTROL_ATTEMPTS_MAX) -> pd.DataFrame:
    """Seeded rejection sampling around each cluster's representative kiln, rung by rung (RINGS).

    A control lies min..max km from that kiln and >= min km from every mapped kiln (all inventories), inside the
    country, never on water or no-data, and on rungs 0-2 on the cluster's WorldCover class. A cluster's controls are
    >= 5 km apart. At most `attempts` candidates per missing control per rung; clusters short of n controls are dropped.
    inside(lat, lon) -> bool[]; wc_lookup(lat, lon) -> class[].
    """
    tree = BallTree(_rad(kiln_lat, kiln_lon), metric="haversine")
    rows, dropped = [], []
    for c in reps.itertuples():
        got: list[tuple[float, float, int]] = []
        for rung, (kmin, kmax, same) in enumerate(RINGS):
            budget = attempts * (n - len(got))
            while len(got) < n and budget > 0:
                k = min(512, budget)
                budget -= k
                r = np.sqrt(rng.uniform(kmin ** 2, kmax ** 2, k))  # uniform over the annulus area
                th = rng.uniform(0, 2 * np.pi, k)
                lat = c.lat + r * np.cos(th) / 111.32
                lon = c.lon + r * np.sin(th) / (111.32 * np.cos(np.radians(c.lat)))
                d_km = tree.query(_rad(lat, lon), k=1)[0][:, 0] * R_EARTH / 1000
                cls = np.asarray(wc_lookup(lat, lon))
                ok = (d_km >= kmin) & ~np.isin(cls, NOT_LAND) & np.asarray(inside(lat, lon))
                if same:
                    ok &= cls == wc_class[c.cluster_id]
                for la, lo in zip(lat[ok], lon[ok]):
                    if got and _km(la, lo, np.array([g[0] for g in got]), np.array([g[1] for g in got])).min() < 5:
                        continue
                    got.append((float(la), float(lo), rung))
                    if len(got) == n:
                        break
            if len(got) == n:
                break
        if len(got) < n:
            dropped.append(c.cluster_id)
            continue
        rows += [{"control_id": f"{c.cluster_id}_{j}", "cluster_id": c.cluster_id, "dlat": la - c.lat, "dlon": lo - c.lon, "rung_used": rung}
                 for j, (la, lo, rung) in enumerate(got)]
    ctrl = pd.DataFrame(rows, columns=["control_id", "cluster_id", "dlat", "dlon", "rung_used"])
    ctrl.attrs["dropped"] = dropped
    return ctrl


def _km(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    a = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(np.radians(np.asarray(lon2) - lon1) / 2) ** 2
    return 2 * R_EARTH / 1000 * np.arcsin(np.sqrt(a))


# --- local calendar (pure) ----------------------------------------------------------
def month_table(e: pd.DataFrame, members, seasons=PROFILE_SEASONS) -> pd.DataFrame:
    """Clusters x 12 season-months (Jul..Jun): each cluster's mean excess per calendar month over the seasons."""
    x = e[e.cluster_id.isin(set(members))]
    x = x.assign(season=A.season_of(x.period), m=x.period.dt.month)
    x = x[(x.season >= seasons[0]) & (x.season <= seasons[1])]
    return x.groupby(["cluster_id", "m"]).e.mean().unstack().reindex(columns=list(SEASON_ORDER))


def learn_window(profile, core_len=CORE_LEN, off_len=OFF_LEN) -> tuple[tuple[int, ...], tuple[int, ...]]:
    """Core: the core_len consecutive season-months (Jul..Jun, no wrap) with the highest mean profile. Off: the off_len
    consecutive months, disjoint from core, with the lowest mean. Ties go to the earliest start. A 5-month core always
    leaves 4 free consecutive months on one side, so an off window always exists."""
    p = np.asarray(profile, float)

    def mean(i, n):
        w = p[i:i + n]
        return np.nanmean(w) if np.isfinite(w).any() else np.nan

    cores = [(mean(i, core_len), i) for i in range(12 - core_len + 1)]
    ci = max((c for c in cores if np.isfinite(c[0])), key=lambda c: (c[0], -c[1]))[1]
    taken = set(range(ci, ci + core_len))
    offs = [(mean(j, off_len), j) for j in range(12 - off_len + 1) if not taken & set(range(j, j + off_len))]
    oj = min((o for o in offs if np.isfinite(o[0])), key=lambda o: (o[0], o[1]))[1]
    return tuple(SEASON_ORDER[ci:ci + core_len]), tuple(SEASON_ORDER[oj:oj + off_len])


def profile_ci(table: pd.DataFrame, rng, n_boot=A.N_BOOT) -> dict:
    """Median over clusters per season-month, with a 95% bootstrap interval over clusters."""
    M = table.to_numpy(float)
    idx = rng.integers(0, len(M), size=(n_boot, len(M)))
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        B = np.stack([np.nanmedian(M[i], axis=0) for i in idx])
        p50 = np.nanmedian(M, axis=0)
    r = lambda a: [None if not np.isfinite(v) else round(float(v), 4) for v in a]
    return {"months": list(SEASON_ORDER), "p50": r(p50), "lo": r(np.nanpercentile(B, 2.5, axis=0)), "hi": r(np.nanpercentile(B, 97.5, axis=0)),
            "n_clusters": int(len(M))}


def evaluate(e, e_placebo, cal, conf, window, seasons) -> dict:
    """The four Amendment 1 criteria on the confirmation clusters (calibration clusters are the excluded pilot)."""
    keep = set(cal) | set(conf)
    amp = lambda x: A.amplitude(x[x.cluster_id.isin(keep)], *window)
    return A.confirm(amp(e), amp(e_placebo), set(cal), seasons)


# --- stage ---------------------------------------------------------------------------
def prepare(cc: str) -> dict:
    """Clusters, the seeded sample and its controls for one country (no Earth Engine outcome data)."""
    import geopandas as gpd
    import shapely

    from .gee import wc_lookup_fn

    kilns = load_kilns(COUNTRIES[cc]["inventory"])
    kilns, clusters = cluster(kilns, C.DBSCAN_EPS_M)
    rng = np.random.default_rng(C.SEED + C.SEED_OFFSETS["transfer"] + list(COUNTRIES).index(cc))
    cal, conf = split(clusters.cluster_id, rng)
    sampled = np.concatenate([cal, conf])
    reps = representatives(kilns, clusters[clusters.cluster_id.isin(sampled)])
    pad = 0.2  # degrees: room for 15 km rings
    w, s, e, n = reps.lon.min() - pad, reps.lat.min() - pad, reps.lon.max() + pad, reps.lat.max() + pad
    look = wc_lookup_fn(bbox=(round(w, 2), round(s, 2), round(e, 2), round(n, 2)), path=CACHE / cc / "worldcover_grid.npz")
    km = kilns.assign(wc=look(kilns.lat.to_numpy(), kilns.lon.to_numpy()))
    wc_class = km.groupby("cluster_id").wc.agg(lambda x: x.mode().iloc[0]).to_dict()
    poly = gpd.read_file(C.RAW / "boundaries" / "adm0" / f"{COUNTRIES[cc]['adm0']}.geojson").union_all()
    shapely.prepare(poly)
    every = pd.concat([load_kilns(f) for f in ALL_INVENTORIES], ignore_index=True)
    ctrl = ring_controls(reps, wc_class, every.lat, every.lon, lambda lat, lon: shapely.contains_xy(poly, lon, lat), look, rng)
    dropped = set(ctrl.attrs["dropped"])
    return {"kilns": kilns, "clusters": clusters, "reps": reps, "ctrl": ctrl, "wc_class": wc_class,
            "cal": np.array([c for c in cal if c not in dropped]), "conf": np.array([c for c in conf if c not in dropped]),
            "n_sampled": len(sampled), "dropped": len(dropped)}


def sites_for(prep: dict) -> pd.DataFrame:
    keep = set(prep["cal"]) | set(prep["conf"])
    cl = prep["clusters"][prep["clusters"].cluster_id.isin(keep)]
    s = A.sites(prep["kilns"][prep["kilns"].cluster_id.isin(keep)], cl, prep["ctrl"][prep["ctrl"].cluster_id.isin(keep)])
    return s.sort_values(["cluster_id", "site"]).reset_index(drop=True)


def country_result(cc: str, prep: dict, kinds=("ntl", "s1"), extract=True) -> dict:
    s = sites_for(prep)
    rng = np.random.default_rng(C.SEED + C.SEED_OFFSETS["transfer"] + 10 + list(COUNTRIES).index(cc))
    cache = CACHE / cc / "activity"
    out = {"code": cc, "name": COUNTRIES[cc]["name"], "n_kilns": int(len(prep["kilns"])), "n_clusters": int(len(prep["clusters"])),
           "n_sampled": prep["n_sampled"], "n_dropped": prep["dropped"], "control_rungs": {str(k): int(v) for k, v in prep["ctrl"].rung_used.value_counts().sort_index().items()},
           "evaluable": prep["dropped"] <= C.CONTROL_DROP_MAX * prep["n_sampled"], "channels": {}}
    if not out["evaluable"]:
        log.warning("%s: %d of %d sampled clusters lack controls: not evaluable (A4c rule)", cc, prep["dropped"], prep["n_sampled"])
        return out
    for kind in kinds:
        cal, conf = (prep["cal"], prep["conf"]) if kind == "ntl" else (prep["cal"][:N_S1_CAL], prep["conf"][:N_S1_CONF])
        sk = s[s.cluster_id.isin(set(cal) | set(conf))]
        if extract:
            A.extract(kind, sk, last_year=LAST_YEAR, cache=cache)
        missing = missing_chunks(kind, len(sk), cache)
        if missing:  # never test on a partial extraction: rerun to resume
            log.error("%s %s: %d Earth Engine chunks missing (e.g. %s); skipped", cc, kind, len(missing), missing[0])
            continue
        p = A.panel(kind, cache=cache)
        e, ep = A.excess(p, sk), A.excess(p, A.placebo_sites(sk))
        learned = learn_window(month_table(e, cal).median(axis=0, skipna=True).to_numpy())
        ch = {"n_calibration": len(cal), "n_confirmation": len(conf), "learned": {"core": list(learned[0]), "off": list(learned[1])},
              "profile": profile_ci(month_table(e, conf), rng), "tests": {}}
        for t, (k, mode) in TESTS.items():
            if k != kind:
                continue
            window = (A.CORE_MONTHS, A.OFF_MONTHS) if mode == "strict" else learned
            ch["tests"][t] = evaluate(e, ep, cal, conf, window, A.REPLICATION[kind])
            log.info("%s %s pass=%s", cc, t, ch["tests"][t]["pass"])
        out["channels"][kind] = ch
    return out


def missing_chunks(kind: str, n_sites: int, cache) -> list[str]:
    """Cache files activity.extract writes for these sites, years FIRST_YEAR..LAST_YEAR, that are not on disk."""
    n = A.CHUNK[kind]
    parts = ["ntl"] if kind == "ntl" else ["in", "ring"]
    names = [f"{y}_{i // n}_{part}.parquet" for y in range(A.FIRST_YEAR[kind], LAST_YEAR + 1) for i in range(0, n_sites, n) for part in parts]
    return [f for f in names if not (cache / kind / f).exists()]


def bangladesh_reference(rng) -> dict:
    """Descriptive only: Bangladesh's profile on its confirmation clusters, and the window learned from its 400 pilot clusters."""
    s = A.sites(pd.read_parquet(C.INTERIM / "kilns.parquet"), pd.read_parquet(C.INTERIM / "clusters.parquet"), pd.read_parquet(C.INTERIM / "controls.parquet"))
    e = A.excess(A.panel("ntl"), s)
    pilot = set(json.loads((C.INTERIM / "activity_pilot.json").read_text(encoding="utf-8"))["cluster_ids"])
    conf = sorted(set(e.cluster_id) - pilot)
    learned = learn_window(month_table(e, pilot).median(axis=0, skipna=True).to_numpy())
    return {"code": "BD", "name": "Bangladesh", "n_clusters": int(s.cluster_id.nunique()),
            "channels": {"ntl": {"learned": {"core": list(learned[0]), "off": list(learned[1])}, "profile": profile_ci(month_table(e, conf), rng)}}}


def prepare_summary(countries=tuple(COUNTRIES)) -> dict:
    """Sample and controls only (inventory, WorldCover, borders): the feasibility numbers, no outcome data."""
    out = {}
    for cc in countries:
        p = prepare(cc)
        out[cc] = {"kilns": len(p["kilns"]), "clusters": len(p["clusters"]), "sampled": p["n_sampled"], "dropped": p["dropped"],
                   "calibration": len(p["cal"]), "confirmation": len(p["conf"]), "rungs": p["ctrl"].rung_used.value_counts().sort_index().to_dict(),
                   "wc_classes": pd.Series([p["wc_class"][c] for c in np.concatenate([p["cal"], p["conf"]])]).value_counts().to_dict()}
        log.info("%s prepare: %s", cc, out[cc])
    (C.INTERIM / "transfer_prep.json").write_text(json.dumps(out, default=A._num, indent=1), encoding="utf-8")
    return out


def run(countries=tuple(COUNTRIES), kinds=("ntl", "s1"), extract=True) -> dict:
    res = {"countries": []}
    for cc in countries:
        prep = prepare(cc)
        log.info("%s: %d clusters, %d sampled, %d dropped (no controls)", cc, len(prep["clusters"]), prep["n_sampled"], prep["dropped"])
        res["countries"].append(country_result(cc, prep, kinds, extract))
    res["bangladesh"] = bangladesh_reference(np.random.default_rng(C.SEED + C.SEED_OFFSETS["transfer"] + 20))
    (C.INTERIM / "transfer_activity.json").write_text(json.dumps(res, default=A._num, indent=0), encoding="utf-8")
    _write_public(res)
    _write_report(res)
    return res


def public_payload(res: dict) -> dict:
    """Country-level only. Test rows keep Amendment 1's shape so the site reads them like GL and GS."""
    out = []
    for c in [res["bangladesh"], *res["countries"]]:
        row = {k: c[k] for k in ("code", "name", "n_kilns", "n_clusters", "n_sampled", "n_dropped", "evaluable") if k in c}
        row["channels"] = {}
        for kind, ch in c.get("channels", {}).items():
            row["channels"][kind] = {"learned": ch["learned"], "profile": ch["profile"],
                                     **{k: ch[k] for k in ("n_calibration", "n_confirmation") if k in ch},
                                     "tests": [{"test": t, **r} for t, v in ch.get("tests", {}).items() for r in v["rows"]],
                                     "pass": {t: v["pass"] for t, v in ch.get("tests", {}).items()}}
        out.append(row)
    return {"countries": out}


def _write_public(res: dict) -> None:
    from .export import _dump, assert_public_safe, nan_to_none

    p = C.INTERIM / "public" / "kiln_activity.json"
    pub = json.loads(p.read_text(encoding="utf-8"))
    pub["transfer"] = nan_to_none(json.loads(json.dumps(public_payload(res), default=A._num)))
    assert_public_safe(pub)
    _dump(pub, p)


MONTH = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _write_report(res: dict) -> None:
    span = lambda ms: f"{MONTH[ms[0]]}–{MONTH[ms[-1]]}"
    L = ["# Kiln-method transfer report (Amendment 2)", "", "Rules: PREREGISTRATION_AMENDMENTS.md, Amendment 2. Calibration clusters are excluded from every test.", ""]
    b = res["bangladesh"]["channels"]["ntl"]
    L += [f"Bangladesh self-check (descriptive): the window learned from its 400 pilot clusters is core {span(b['learned']['core'])}, "
          f"off {span(b['learned']['off'])} (Amendment 1 fixed Dec–Apr / Jul–Oct).", ""]
    for c in res["countries"]:
        L += [f"## {c['name']}", "", f"{c['n_kilns']:,} kilns, {c['n_clusters']:,} clusters; {c['n_sampled']:,} sampled, {c['n_dropped']} dropped for lack of controls. "
              f"Control rungs: {c.get('control_rungs')}.", ""]
        if not c["evaluable"]:
            L += ["Not evaluable: more than 20% of sampled clusters lack three controls.", ""]
            continue
        for kind, ch in c["channels"].items():
            L += [f"### {'Night lights' if kind == 'ntl' else 'Sentinel-1 radar'} ({ch['n_calibration']} calibration, {ch['n_confirmation']} confirmation clusters)", "",
                  f"Learned window: core {span(ch['learned']['core'])}, off {span(ch['learned']['off'])}.", ""]
            for t, v in ch["tests"].items():
                L += [f"**{t}: {'PASS' if v['pass'] else 'FAIL'}**", "", "| Criterion | Value | Threshold | p | |", "|---|---|---|---|---|"]
                pf = lambda p: "" if p is None or not np.isfinite(p) else f"{p:.2g}"
                L += [f"| {r['criterion']} | {r['value']:.4g} | {r['threshold']} | {pf(r.get('p'))} | {'PASS' if r['pass'] else 'FAIL'} |" for r in v["rows"]]
                L += ["", "Median A by season: " + ", ".join(f"{x['season']} {x['median']:.3g} (n={x['count']})" for x in v["by_season"]), ""]
            pr = ch["profile"]
            L += ["Monthly kiln excess, confirmation clusters (median [95% CI]): " + ", ".join(
                f"{MONTH[m]} {'–' if p is None else f'{p:.3g}'}" for m, p in zip(pr["months"], pr["p50"])), ""]
    (C.REPORTS / "transfer_report.md").write_text("\n".join(L) + "\n", encoding="utf-8")
