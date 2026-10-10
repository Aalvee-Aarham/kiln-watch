"""Reference geography for the world map (#/region), built once from Natural Earth (public domain) into data/static.

    python -m kilnwatch.geography <dir with ne_50m_admin_0_countries / ne_10m_admin_1_states_provinces /
                                   ne_10m_populated_places .geojson>

Outlines are simplified for display (South Asia kept finer, where the project works). Cities are plain records, not
GeoJSON points: they are public place names for labels and search, never data of ours.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from . import config as C

SOUTH_ASIA = ("AFG", "BGD", "BTN", "IND", "LKA", "MDV", "NPL", "PAK")
SOURCE = "Natural Earth v5 (public domain), simplified for display; de facto boundaries, not an endorsement of any claim"


def _round(c, dp):
    return [_round(x, dp) for x in c] if isinstance(c[0], list) else [round(c[0], dp), round(c[1], dp)]


def _features(g, props, tol, dp):
    import geopandas as gpd

    g = g.copy()
    g["geometry"] = g.geometry.simplify(tol, preserve_topology=True)
    out = []
    for _, r in g.iterrows():
        if r.geometry is None or r.geometry.is_empty:
            continue
        geom = json.loads(gpd.GeoSeries([r.geometry]).to_json())["features"][0]["geometry"]
        geom["coordinates"] = _round(geom["coordinates"], dp)
        out.append({"type": "Feature", "properties": props(r), "geometry": geom})
    return out


def _clean(s):
    return None if s is None or (isinstance(s, float) and s != s) or str(s).strip() == "" else str(s)


def build(ne: Path, out: Path = C.STATIC) -> dict:
    import geopandas as gpd

    ne = Path(ne)
    c0 = gpd.read_file(ne / "ne_50m_admin_0_countries.geojson")
    a1 = gpd.read_file(ne / "ne_10m_admin_1_states_provinces.geojson")
    pp = gpd.read_file(ne / "ne_10m_populated_places.geojson")

    countries = _features(c0, lambda r: {"unit_id": r.ADM0_A3, "level": "country", "name_en": r.NAME_EN, "name_bn": _clean(r.NAME_BN) or r.NAME_EN,
                                         "division": r.CONTINENT, "kiln_count": None, "kiln_share": None}, 0.03, 2)
    # Natural Earth leaves a few minor-island areas unnamed (codes like "MEX+99?"): label them by their country.
    name = lambda r: _clean(r.name_en) or _clean(r["name"]) or f"{r.admin} (unnamed area)"  # noqa: E731
    state = lambda r: {"unit_id": r.adm1_code, "level": "state", "name_en": name(r), "name_bn": _clean(r.name_bn) or name(r),  # noqa: E731
                       "division": r.admin, "type_en": _clean(r.type_en), "adm0": r.adm0_a3, "kiln_count": None, "kiln_share": None}
    sa = a1.adm0_a3.isin(SOUTH_ASIA)
    states = _features(a1[sa], state, 0.01, 3) + _features(a1[~sa], state, 0.05, 2)  # finer where the project works
    pp = pp.sort_values(["SCALERANK", "POP_MAX"], ascending=[True, False])
    cities = [[_clean(r.NAME_EN) or r.NAME, _clean(r.NAME_BN) or _clean(r.NAME_EN) or r.NAME, round(float(r.LATITUDE), 3), round(float(r.LONGITUDE), 3),
               int(r.SCALERANK), int(r.POP_MAX) if r.POP_MAX == r.POP_MAX and r.POP_MAX > 0 else None, r.ADM0_A3, _clean(r.ADM1NAME), int(r.ADM0CAP)]
              for r in pp.itertuples()]
    files = {
        "world_countries.geojson": {"type": "FeatureCollection", "source": SOURCE + " (1:50m Admin 0)", "features": countries},
        "world_states.geojson": {"type": "FeatureCollection", "source": SOURCE + " (1:10m Admin 1)", "features": states},
        "world_cities.json": {"source": SOURCE + " (1:10m populated places; population = POP_MAX estimate)",
                              "fields": ["name_en", "name_bn", "lat", "lon", "rank", "pop", "adm0", "adm1", "capital"], "rows": cities},
    }
    for name, obj in files.items():
        s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
        tmp = out / (name + ".tmp")
        tmp.write_text(re.sub(r"\bNaN\b", "null", s), encoding="utf-8")
        tmp.replace(out / name)
    return {k: len(v.get("features", v.get("rows", []))) for k, v in files.items()}


if __name__ == "__main__":
    print(build(Path(sys.argv[1])))
