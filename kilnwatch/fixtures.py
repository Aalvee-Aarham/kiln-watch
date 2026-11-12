"""Synthetic fixture sets for the offline demo site, one per gate branch (plus the verbatim real copy).

Split out of export.py: the safety-checked export tier and the demo-data factory change for different
reasons and at different rates. `export --fixtures` and tests/test_contracts.py are the callers.
"""
from __future__ import annotations

import json
import logging
import shutil
import tarfile
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from . import config as C
from .export import BRANCHES, add_overlap, dump_json, events_payload, meta, write_region
from .ingest import atomic_write

log = logging.getLogger("kilnwatch.fixtures")


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
RELEASE_NEWS_STORE = C.ROOT / "data" / "releases" / "news-store.json"  # committed snapshot of the news-current store


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
            tf.extractall(cache, filter="data")  # rejects path traversal and devices in the release asset
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
    dump_json(events_payload(), d / "events.json")  # curated data/static CSVs, not pipeline output: always current
    add_overlap(d)  # derived from the public calendars alone, so it can be recomputed on the frozen release
    write_region(d)
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
    dump_json(m, d / "meta.json")
    if repairs:
        atomic_write(ka_p, json.dumps(ka, separators=(",", ":"), ensure_ascii=False))
        log.info("real fixture: nulled %d non-bracketing season CIs in kiln_activity.json", repairs)
    if RELEASE_NEWS_STORE.exists():  # real news paired with this verbatim copy, as the deploy job does
        from . import news_pair, news_store

        store = news_store.load(RELEASE_NEWS_STORE)
        news_pair.run(d, store=store, generated_at=store.get("updated_at") or "unknown")


def _fixture_set(branch: str, d: Path) -> None:
    rng = np.random.default_rng(C.SEED)
    if d.exists():
        shutil.rmtree(d)
    m = meta(branch, {"fixtures": "synthetic"})
    m["git_sha"], m["prereg_sha"], m["generated_at"] = "fixture", "fixture", "2026-10-06T00:00:00+00:00"
    dump_json(m, d / "meta.json")
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
        dump_json(_fixture_calendar(uid, kind, lvl == "district", keys, rng, branch), d / "calendar" / f"{uid}.json")
    for f in _bd_geometry()["district"]["all"]:  # every real district is selectable in the demo
        pid = f["properties"]["unit_id"]
        if pid not in used:
            dump_json(_fixture_calendar(pid, "quiet", True, keys, rng, branch), d / "calendar" / f"{pid}.json")
    for lvl, fs in feats.items():
        rest = [f for f in _bd_geometry()[lvl]["all"] if f["properties"]["unit_id"] not in used]  # complete the country, no data
        fs.extend({"type": "Feature", "properties": {**f["properties"], "kiln_count": None, "kiln_share": None}, "geometry": f["geometry"]}
                  for f in rest)
        dump_json({"type": "FeatureCollection", "features": fs}, d / "aoi" / f"{lvl}s.geojson")
    dump_json(_fixture_harmonization(rng), d / "harmonization.json")
    dump_json(_fixture_validation(branch, rng), d / "validation.json")
    dump_json(events_payload(), d / "events.json")
    days = 97
    nrt_d = {u[0]: {"h": [round(float(x), 3) for x in rng.gamma(2, 0.5, days)], "above_p90_days": int(rng.integers(0, 6))}
             for u in units if u[1] == "district"}
    for f in _bd_geometry()["district"]["all"]:  # full-country choropleth in the demo
        pid = f["properties"]["unit_id"]
        if pid not in nrt_d:
            nrt_d[pid] = {"h": [round(float(x), 2) for x in rng.gamma(2, 0.15, days)], "above_p90_days": int(rng.integers(0, 4))}
    for pid, v in nrt_d.items():  # no random draws: the warning fields leave every other fixture byte-identical
        cal = d / "calendar" / f"{pid}.json"
        v["critical"] = json.loads(cal.read_text(encoding="utf-8"))["critical"] if cal.exists() else None
        # the latest unusual day 0, 5, 10 ... days before the last day of data, so the demo has both recent and older ones
        n_up = v["above_p90_days"]
        v["last_unusual"] = (date(2026, 7, 1) + timedelta(days=days - 1 - 5 * (n_up - 1))).isoformat() if n_up else None
    dump_json({"updated_at": "2026-10-05T03:00:00Z", "provisional": True, "season": "2026-27", "day0": "2026-07-01",
           "national": {"h": [round(float(x), 3) for x in rng.gamma(2, 0.5, days)], "split": [{"key": k, "values": [round(float(x), 3) for x in rng.gamma(2, 0.2, days)]} for k in keys]},
           "districts": nrt_d},
          d / "nrt" / "current_season.json")
    dump_json({"tile": "90_23", "day0": "2003-01-01", "rows": [[int(1136241 + i), int(4000 + i % 300), int(i % 6)] for i in range(500)]}, d / "grid" / "90_23.json")
    dump_json(_fixture_kiln_activity(rng), d / "kiln_activity.json")
    add_overlap(d)
    write_region(d)
    if branch == "full":  # last, and with no random draws: every other fixture file stays byte-identical
        _fixture_news(d)


FIXTURE_NEWS_SOURCES = [  # fictional outlets on reserved example domains (RFC 2606)
    {"key": "example_daily", "outlet": "Example Daily", "domain": "example.com", "lang": "en", "status": "active", "reason": ""},
    {"key": "namuna_dainik", "outlet": "নমুনা দৈনিক", "domain": "example.org", "lang": "bn", "status": "active", "reason": ""},
    {"key": "example_weekly", "outlet": "Example Weekly", "domain": "example.net", "lang": "en", "status": "excluded",
     "reason": "Synthetic test outlet: no news sitemap"},
]


def _fixture_news_store() -> dict:
    """A small synthetic news store: clearly synthetic stories on fictional outlets, all four published kinds, national
    stories, multi-district stories, a policy story (never published), a blocklisted one and one outside the data (dropped
    as no_satellite_data). Dates fall inside the synthetic calendars (to 2025-06-30) and NRT (2026-07-01 to 2026-10-05).
    No random draws."""
    import hashlib

    from . import news_store as S
    from .grid import season_of

    dhaka, rajshahi, khulna = "BD3026", "BD5081", "BD4047"
    rows = [  # slug, source, kind, unit_ids, event, published, stated, title, claim_en, claim_bn, quote
        ("burning-rajshahi", "example_daily", "burning", [rajshahi], "2025-01-10", "2025-01-11", True,
         "Synthetic test story: field fires reported near Rajshahi", "Field fires burned on 3 farms near Rajshahi.",
         "রাজশাহীর কাছে 3টি খামারে মাঠে আগুন জ্বলেছে।", "Fires burned on 3 farms outside the town on Friday."),
        ("smoke-khulna-dhaka", "namuna_dainik", "burning", [khulna, dhaka], "2024-12-05", "2024-12-06", True,
         "নমুনা পরীক্ষার খবর: খুলনা ও ঢাকায় খড় পোড়ানো", "Straw burning was reported in Khulna and Dhaka.",
         "খুলনা ও ঢাকায় খড় পোড়ানোর খবর পাওয়া গেছে।", "খুলনা ও ঢাকায় খড় পোড়ানো হয়েছে বলে জানা গেছে।"),
        ("court-dhaka-feb", "example_daily", "enforcement", [dhaka], "2025-02-03", "2025-02-04", True,
         "Synthetic test story: mobile court fines kilns in Dhaka", "A mobile court fined 4 kilns in Dhaka district.",
         "ঢাকা জেলায় ভ্রাম্যমাণ আদালত 4টি ভাটাকে জরিমানা করেছে।", "The mobile court fined 4 kilns during the drive."),
        ("court-dhaka-june", "namuna_dainik", "enforcement", [dhaka], "2025-06-25", "2025-06-26", True,
         "নমুনা পরীক্ষার খবর: ঢাকায় অভিযান", "Officials ran an enforcement drive in Dhaka.",
         "ঢাকায় কর্মকর্তারা অভিযান চালিয়েছেন।", "কর্মকর্তারা ঢাকায় অভিযান চালিয়েছেন।"),
        ("kilns-dhaka-jan", "example_daily", "kilns_operating", [dhaka], "2025-01-20", "2025-01-20", False,
         "Synthetic test story: kilns fire up around Dhaka", "Kilns around Dhaka were operating this week.",
         "এই সপ্তাহে ঢাকার আশপাশে ভাটা চালু ছিল।", "Kilns around the city were operating this week."),
        ("kilns-rajshahi-nov", "namuna_dainik", "kilns_operating", [rajshahi], "2024-11-15", "2024-11-16", True,
         "নমুনা পরীক্ষার খবর: রাজশাহীতে ভাটা চালু", "Kilns in Rajshahi started work for the season.",
         "রাজশাহীতে ভাটাগুলো মৌসুমের কাজ শুরু করেছে।", "রাজশাহীতে ভাটাগুলো কাজ শুরু করেছে।"),
        ("haze-dhaka-dec", "example_daily", "air_health", [dhaka], "2024-12-20", "2024-12-21", True,
         "Synthetic test story: haze over Dhaka", "Haze over Dhaka was linked to burning nearby.",
         "ঢাকার ওপর ধোঁয়াশা আশপাশের আগুনের সঙ্গে যুক্ত।", "The haze over the city was linked to burning nearby."),
        ("haze-national-jan", "example_daily", "air_health", [S.NATIONAL], "2025-01-05", "2025-01-06", True,
         "Synthetic test story: smog across Bangladesh", "Smog covered much of Bangladesh.",
         "বাংলাদেশের বেশিরভাগ এলাকা ধোঁয়াশায় ঢাকা ছিল।", "Smog covered much of the country on Sunday."),
        ("burning-rajshahi-sep", "example_daily", "burning", [rajshahi], "2026-09-20", "2026-09-21", True,
         "Synthetic test story: early field burning in Rajshahi", "Early field burning was seen in Rajshahi.",
         "রাজশাহীতে আগেভাগে মাঠে আগুন দেখা গেছে।", "Early field burning was seen in the district."),
        ("court-khulna-aug", "namuna_dainik", "enforcement", [khulna], "2026-08-10", "2026-08-11", True,
         "নমুনা পরীক্ষার খবর: খুলনায় ভ্রাম্যমাণ আদালত", "A mobile court closed 2 kilns in Khulna.",
         "খুলনায় ভ্রাম্যমাণ আদালত 2টি ভাটা বন্ধ করেছে।", "ভ্রাম্যমাণ আদালত 2টি ভাটা বন্ধ করেছে।"),
        ("court-dhaka-sep", "example_daily", "enforcement", [dhaka, rajshahi], "2026-09-28", "2026-09-29", True,
         "Synthetic test story: kiln drive in Dhaka and Rajshahi", "Officials raided kilns in Dhaka and Rajshahi.",
         "কর্মকর্তারা ঢাকা ও রাজশাহীতে ভাটায় অভিযান চালিয়েছেন।", "Officials raided kilns in both districts."),
        ("kilns-dhaka-aug", "namuna_dainik", "kilns_operating", [dhaka], "2026-08-20", "2026-08-21", False,
         "নমুনা পরীক্ষার খবর: ঢাকায় বর্ষায় ভাটা", "Some kilns near Dhaka were reported working in the monsoon.",
         "বর্ষায় ঢাকার কাছে কিছু ভাটা চালু থাকার খবর।", "বর্ষায় কিছু ভাটা চালু ছিল বলে জানা গেছে।"),
        ("air-dhaka-oct", "example_daily", "air_health", [dhaka], "2026-10-02", "2026-10-03", True,
         "Synthetic test story: air quality dips in Dhaka", "Air quality in Dhaka fell this week.",
         "এই সপ্তাহে ঢাকার বায়ুর মান কমেছে।", "Air quality in the city fell this week."),
        ("burning-national-oct", "namuna_dainik", "burning", [S.NATIONAL], "2026-10-01", "2026-10-02", True,
         "নমুনা পরীক্ষার খবর: দেশজুড়ে নাড়া পোড়ানো", "Stubble burning was reported across the country.",
         "দেশজুড়ে নাড়া পোড়ানোর খবর পাওয়া গেছে।", "দেশজুড়ে নাড়া পোড়ানোর খবর পাওয়া গেছে।"),
        ("policy-national", "example_daily", "policy", [S.NATIONAL], "2026-09-15", "2026-09-15", False,
         "Synthetic test story: new kiln rules proposed", "New kiln rules were proposed.",
         "নতুন ভাটা নীতিমালা প্রস্তাব করা হয়েছে।", "New kiln rules were proposed on Tuesday."),
        ("blocked-dhaka", "example_daily", "burning", [dhaka], "2026-09-10", "2026-09-11", True,
         "Synthetic test story: removed by the blocklist", "This story is on the blocklist.",
         "এই খবরটি বাদের তালিকায় আছে।", "This story is on the blocklist."),
        ("outside-data-rajshahi", "namuna_dainik", "burning", [rajshahi], "2025-10-10", "2025-10-11", True,
         "নমুনা পরীক্ষার খবর: তথ্যের বাইরের তারিখ", "Field burning was reported in Rajshahi.",
         "রাজশাহীতে মাঠে আগুনের খবর পাওয়া গেছে।", "রাজশাহীতে মাঠে আগুনের খবর পাওয়া গেছে।"),
    ]
    domains = {r["key"]: r["domain"] for r in FIXTURE_NEWS_SOURCES}
    outlets = {r["key"]: (r["outlet"], r["lang"]) for r in FIXTURE_NEWS_SOURCES}
    store = S.empty()
    for slug, src, kind, units, event, pub, stated, title, claim_en, claim_bn, quote in rows:
        url = f"https://{domains[src]}/news/{pub[:4]}/{slug}"
        store["items"].append({
            "news_id": S.news_id(url), "url": url, "source": src, "outlet": outlets[src][0], "lang": outlets[src][1], "title": title,
            "published_date_local": pub, "event_date_local": event, "event_date_stated": stated, "season": season_of(event),
            "kind": kind, "unit_ids": units, "claim_en": claim_en, "claim_bn": claim_bn, "quote": quote,
            "text_sha256": hashlib.sha256(f"synthetic:{slug}".encode()).hexdigest(), "extracted_at": f"{pub}T06:00:00+00:00",
            "model": C.NEWS_MODEL})
    store["updated_at"] = "2026-10-05T03:00:00+00:00"
    store["coverage"] = {"example_daily": {"read_back_to": "2024-07-01", "last_scanned": "2026-10-05", "history_cursor": "2024-07-01", "gaps": []},
                         "namuna_dainik": {"read_back_to": "2025-07-01", "last_scanned": "2026-10-05", "history_cursor": None, "gaps": []}}
    store["dropped"] = {"not_relevant": 6, "quote_not_verbatim": 2, "number_not_in_quote": 1}
    return store


def _fixture_news(d: Path) -> None:
    """news/ for the `full` fixture: the synthetic store paired with this fixture set's own calendars and NRT."""
    from . import news_pair

    store = _fixture_news_store()
    blocked = [i["url"] for i in store["items"] if i["url"].endswith("/blocked-dhaka")]
    news_pair.run(d, store=store, sources=FIXTURE_NEWS_SOURCES, blocklist=blocked, generated_at="2026-10-06T00:00:00+00:00")


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
