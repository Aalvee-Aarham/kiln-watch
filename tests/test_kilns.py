import numpy as np
import pandas as pd
import shapely

from kilnwatch.kilns import cluster, sample_controls


def test_cluster_split():
    # a chain of 40 points 200 m apart (~0.0018 deg) along a parallel chains into one component of ~7.8 km
    lat = np.full(40, 23.5)
    lon = 90.0 + np.arange(40) * 200 / (111_320 * np.cos(np.radians(23.5)))
    k = pd.DataFrame({"kiln_id": range(40), "lat": lat, "lon": lon})
    _, cl = cluster(k, eps_m=300, max_share=1.0)
    assert len(cl) >= 2 and (cl.diameter_m < 5000).all()


def test_controls_ladder():
    import geopandas as gpd

    # district fully covered by kilns: no 3–10 km location exists -> escalate to the division (rung 2)
    dist = gpd.GeoDataFrame({"name_en": ["D"]}, geometry=[shapely.box(90.0, 23.0, 90.05, 23.05)], crs=4326)
    div = gpd.GeoDataFrame({"name_en": ["V"]}, geometry=[shapely.box(90.0, 23.0, 91.0, 24.0)], crs=4326)
    g = np.linspace(90.0, 90.05, 6)
    kl = pd.DataFrame([(23.0 + (i * 0.01), x) for i in range(6) for x in g], columns=["lat", "lon"])
    cl = pd.DataFrame({"cluster_id": [0], "lat": [23.025], "lon": [90.025], "district": ["D"], "division": ["V"]})
    ctrl = sample_controls(cl, kl, dist, div, n=3, rng=np.random.default_rng(0), attempts=2000)
    assert len(ctrl) == 3 and set(ctrl.rung_used) == {2}
