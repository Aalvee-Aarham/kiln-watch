"""More report sources: Google News RSS (all years, local languages), GDACS wildfire events, a worldwide latest-news
feed, and report search for any free-text place. Same rules as news.py: matched by place, box and dates only, and
missing reports are never evidence of absence.

Google News RSS terms allow personal, non-commercial use; set NEWS_GOOGLE=0 to turn it off.
"""
import datetime as dt
import email.utils
import json
import os
import time
import urllib.parse
import xml.etree.ElementTree as ET

from .news import COUNTRY_LANG, _cached, _get, _nominatim_lock, _run, open_wildfires

GN_LOCALE = {"en": ("en-US", "US", "US:en"), "es": ("es-419", "MX", "MX:es-419"), "pt": ("pt-BR", "BR", "BR:pt-419"),
             "fr": ("fr", "FR", "FR:fr"), "bn": ("bn", "BD", "BD:bn"), "hi": ("hi", "IN", "IN:hi"),
             "id": ("id", "ID", "ID:id"), "ru": ("ru", "RU", "RU:ru")}
GN_WORDS = {"en": 'wildfire OR bushfire OR "forest fire" OR "stubble burning" OR "crop burning" OR blaze',
            "es": 'incendio OR "incendio forestal" OR quema', "pt": "queimada OR incêndio OR fogo",
            "fr": 'incendie OR "feu de forêt"', "bn": "আগুন OR অগ্নিকাণ্ড OR ইটভাটা", "hi": "आग OR पराली OR दावानल",
            "id": "kebakaran OR karhutla", "ru": 'пожар OR "лесной пожар"'}


def google_on():
    return os.environ.get("NEWS_GOOGLE", "1") != "0"


def google_news(query, lang="en", start=None, end=None):
    """Google News RSS search (up to ~100 items); after:/before: bound the window."""
    hl, gl, ceid = GN_LOCALE.get(lang, GN_LOCALE["en"])
    q = query + (f" after:{start - dt.timedelta(days=1)}" if start else "") + (f" before:{end + dt.timedelta(days=1)}" if end else "")
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": q, "hl": hl, "gl": gl, "ceid": ceid})
    root = ET.fromstring(_get(url, 30))
    items = []
    for it in root.iter("item"):
        title = it.findtext("title") or ""
        outlet = it.findtext("source") or ""
        if outlet and title.endswith(" - " + outlet):
            title = title[: -len(outlet) - 3]
        try:
            d = email.utils.parsedate_to_datetime(it.findtext("pubDate") or "").date()
        except (TypeError, ValueError):
            d = None
        if d and ((start and d < start) or (end and d > end)):
            continue
        items.append({"source": "Google News", "title": title, "date": str(d) if d else "", "url": it.findtext("link"),
                      "lang": lang, "outlet": outlet})
    return items, url, q


def _inside(bbox, lat, lon, pad=0.5):
    w, s, e, n = bbox
    return s - pad <= lat <= n + pad and ((w - pad <= lon <= e + pad) if w <= e else (lon >= w or lon <= e))


def gdacs(start, end, bbox=None):
    """GDACS wildfire events (EU JRC / UN; burned-area severity from GWIS), optionally inside a box."""
    q = urllib.parse.urlencode({"eventlist": "WF", "fromdate": str(start), "todate": str(end)})
    url = f"https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?{q}"
    body = _get(url, 40)
    feats = json.loads(body).get("features", []) if body.strip() else []  # HTTP 204 = no events
    items = []
    for f in feats:
        p = f.get("properties", {})
        lon, lat = (f.get("geometry", {}).get("coordinates") or [None, None])[:2]
        if bbox and (lat is None or not _inside(bbox, lat, lon)):
            continue
        items.append({"source": "GDACS", "title": p.get("name") or p.get("description"), "date": (p.get("fromdate") or "")[:10],
                      "url": (p.get("url") or {}).get("report"), "lang": "en", "outlet": f"GDACS {p.get('alertlevel', '')} alert".strip(),
                      "lat": lat, "lon": lon, "severity": (p.get("severitydata") or {}).get("severitytext"),
                      "country": p.get("country"), "to": (p.get("todate") or "")[:10], "alert": p.get("alertlevel")})
    return items, url


def _google_for(places, langs, start, end):
    """Google News for an area: one query per language and calendar year (each feed is capped near 100 items)."""
    pl = " OR ".join(f'"{p}"' for p in places[:4] if p)
    spans, a = [], start
    while a <= end:
        b = min(end, dt.date(a.year, 12, 31))
        spans.append((a, b))
        a = b + dt.timedelta(days=1)
    out, urls = [], []
    for lang in [x for x in dict.fromkeys(langs + ["en"]) if x in GN_LOCALE][:3]:
        for a, b in spans[-6:]:  # ponytail: last 6 years per language keeps one search near 10 s
            items, url, _ = google_news(f"({pl}) ({GN_WORDS[lang]})", lang, a, b)
            out += items
            urls.append(url)
    return out, urls[0] if urls else "", f"({pl}) + fire words in {', '.join(langs)}"


def extra_sources(meta, start, end, sources, items):
    """Google News and GDACS for an area search, appended to sources/items in place (called by news._search)."""
    places = meta.get("places") or [meta.get("name", "")]
    langs = meta.get("lang") or ["en"]
    if google_on():
        src, it = _run("Google News", "Online news via Google News RSS, all years, local languages",
                       lambda: _google_for(places, langs, start, end), f"gn:{places}:{langs}:{start}:{end}", end)
        sources.append(src)
        items += it
    if end >= dt.date(2017, 1, 1):
        src, it = _run("GDACS", "Global Disaster Alert and Coordination System wildfire events (EU JRC/UN, burned area from GWIS)",
                       lambda: gdacs(max(start, dt.date(2017, 1, 1)), end, meta["bbox"]), f"gdacs:{meta['bbox']}:{start}:{end}", end)
        sources.append(src)
        items += it


def geocode(q):
    """Free-text place -> name, country, a box of 0.5-4 degrees around it, languages (Nominatim, cached a year)."""
    def fetch():
        with _nominatim_lock:
            time.sleep(1.1)
            qs = urllib.parse.urlencode({"q": q, "format": "jsonv2", "limit": 1, "addressdetails": 1, "accept-language": "en"})
            res = json.loads(_get(f"https://nominatim.openstreetmap.org/search?{qs}"))
        if not res:
            return None
        p = res[0]
        s, n, w, e = map(float, p["boundingbox"])
        cl = lambda v: min(4.0, max(0.5, v))  # noqa: E731
        lat, lon, hw, hh = (s + n) / 2, (w + e) / 2, cl(e - w) / 2, cl(n - s) / 2
        a = p.get("address", {})
        cc = (a.get("country_code") or "").lower()
        name = ", ".join(str(p.get("display_name", q)).split(",")[:2]).strip()
        places = list(dict.fromkeys([name.split(",")[0].strip(), *[v for v in (a.get("county"), a.get("state")) if v]]))
        return {"name": name, "country": a.get("country"), "country_code": cc, "lat": round(lat, 4), "lon": round(lon, 4),
                "bbox": [round(max(-180, lon - hw), 2), round(max(-90, lat - hh), 2), round(min(180, lon + hw), 2),
                         round(min(90, lat + hh), 2)], "places": places, "lang": COUNTRY_LANG.get(cc, []) + ["en"]}
    return _cached(f"geo:{q.strip().lower()}", 365 * 86400, fetch)


def search_place(place, start, end):
    """Reports for ANY place name (no built area needed): geocode, then every source."""
    from .news import _search
    g = geocode(place)
    if not g:
        raise ValueError(f"no place called '{place}'")
    end = min(end, dt.date.today())
    if end < start:
        raise ValueError("end must be after start")
    r = _search({"bbox": g["bbox"], "places": g["places"], "lang": g["lang"], "name": g["name"], "country": g["country"]},
                start, end, wide=(end - start).days > 62)
    r["items"].sort(key=lambda i: i.get("date") or "", reverse=True)
    return {"place": g, **r, "caveat": "Matched by place name, area box and dates only; open each report to verify. "
                                       "Absence of reports is not evidence of absence."}


LATEST_QUERIES = [("en", 'wildfire OR "forest fire" OR bushfire'), ("es", '"incendio forestal"'),
                  ("pt", 'queimada OR "incêndio florestal"'), ("fr", '"feu de forêt" OR "incendie de forêt"'),
                  ("id", 'karhutla OR "kebakaran hutan"'), ("hi", "जंगल आग OR पराली"), ("bn", "বনে আগুন OR দাবানল")]


def latest(days=7):
    """Worldwide fire news and events of the last `days` days: Google News in 7 languages, GDACS and NASA EONET."""
    days = max(1, min(int(days), 30))
    end = dt.date.today()
    start = end - dt.timedelta(days=days)

    def fetch():
        sources, items = [], []
        jobs = [(f"Google News ({lang})", (lambda lang=lang, q=q: google_news(f"{q} when:{days}d", lang)[0]))
                for lang, q in (LATEST_QUERIES if google_on() else [])]
        jobs += [("GDACS", lambda: gdacs(start, end)[0]),
                 ("NASA EONET", lambda: [{"source": "NASA EONET", "title": e["title"], "date": e["date"], "url": e["url"],
                                          "lang": "en", "outlet": "NASA EONET", "lat": e["lat"], "lon": e["lon"]}
                                         for e in open_wildfires() if e["date"] >= str(start)])]
        for name, fn in jobs:
            try:
                it = fn()
                items += it
                sources.append({"name": name, "count": len(it), "error": None})
            except Exception as ex:  # one failing source never blanks the feed; it is listed as failed
                sources.append({"name": name, "count": 0, "error": str(ex)[:120]})
        seen, out = set(), []
        for i in sorted(items, key=lambda i: i.get("date") or "", reverse=True):
            k = (i.get("title") or "").strip().lower()[:90]
            if k and k not in seen:
                seen.add(k)
                out.append(i)
        return {"window": [str(start), str(end)], "sources": sources, "items": out,
                "note": "Headlines matched by fire keywords only; not linked to satellite detections. Open each to verify."}
    return _cached(f"latest:{days}:{end}", 1800, fetch)
