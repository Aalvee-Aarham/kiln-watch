"""Corroborating reports for a calendar cell: NASA EONET events + GDELT DOC news (+ ReliefWeb if configured).

Matching is by place name, bounding box and date window only. Missing reports are reported as "none found in
the searched sources" — never as proof that a fire did or did not happen.
"""
import datetime as dt
import hashlib
import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from . import science as sc
from .firms import DATA

UA = "KilnWatch/1.0 (open-source fire harmonization app)"
CACHE = DATA / "news_cache"
GDELT_START = dt.date(2017, 1, 1)  # the DOC API rejects earlier start dates ("Invalid query start date")
WINDOW_PAD = dt.timedelta(days=3)

KEYWORDS = {
    "en": ["wildfire", "bushfire", '"forest fire"', '"stubble burning"', '"brick kiln"', '"gas flare"', "blaze"],
    "es": ["incendio", '"incendio forestal"', "quema"],
    "pt": ["queimada", "incêndio"],
    "fr": ["incendie", '"feu de forêt"'],
    "bn": ["আগুন", "অগ্নিকাণ্ড", "ইটভাটা"],
    "hi": ["आग", "पराली"],
    "pa": ["ਪਰਾਲੀ", "ਅੱਗ"],
    "id": ["kebakaran", "karhutla"],
    "ru": ["пожар"],
}
COUNTRY_LANG = {"bd": ["bn"], "in": ["hi", "pa"], "ar": ["es"], "br": ["pt"], "ca": ["fr"], "mx": ["es"],
                "es": ["es"], "pt": ["pt"], "fr": ["fr"], "id": ["id"], "ru": ["ru"], "cl": ["es"], "bo": ["es"],
                "co": ["es"], "pe": ["es"], "py": ["es"], "ve": ["es"]}

_gdelt_lock = threading.Lock()
_gdelt_last = [0.0]
_nominatim_lock = threading.Lock()


def _get(url, timeout=30, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def _cached(key, ttl_s, fn):
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / (hashlib.sha1(key.encode()).hexdigest() + ".json")
    if f.exists() and time.time() - f.stat().st_mtime < ttl_s:
        return json.loads(f.read_text(encoding="utf-8"))
    val = fn()
    f.write_text(json.dumps(val, ensure_ascii=False), encoding="utf-8")
    return val


def _ttl(end):
    """Old windows never change; recent ones are re-checked hourly."""
    return 30 * 86400 if (dt.date.today() - end).days > 14 else 3600


def reverse_geocode(lat, lon):
    """Place names for a custom area via OpenStreetMap Nominatim (free, 1 request/second policy)."""
    def fetch():
        with _nominatim_lock:
            time.sleep(1.1)
            q = urllib.parse.urlencode({"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 8, "accept-language": "en"})
            j = json.loads(_get(f"https://nominatim.openstreetmap.org/reverse?{q}"))
        a = j.get("address", {})
        cc = (a.get("country_code") or "").lower()
        places = [v for v in (a.get("county"), a.get("state_district"), a.get("state"), a.get("region")) if v]
        name = ", ".join(dict.fromkeys(places[:2] + [a.get("country")] if a.get("country") else places[:2])) or None
        return {"name": name, "country": a.get("country"), "country_code": cc, "places": list(dict.fromkeys(places)),
                "lang": COUNTRY_LANG.get(cc, []) + ["en"]}
    try:
        return _cached(f"rev:{lat:.2f},{lon:.2f}", 365 * 86400, fetch)
    except Exception:
        return {"name": None, "country": None, "places": [], "lang": ["en"]}


def eonet(bbox, start, end, limit=50):
    w, s, e, n = bbox
    q = urllib.parse.urlencode({"category": "wildfires", "status": "all", "start": str(start), "end": str(end),
                                "bbox": f"{w},{n},{e},{s}", "limit": limit})
    url = f"https://eonet.gsfc.nasa.gov/api/v3/events?{q}"
    events = json.loads(_get(url, 40)).get("events", [])
    items = []
    for ev in events:
        geo = ev.get("geometry") or [{}]
        g = geo[-1]
        coords = g.get("coordinates") if g.get("type") == "Point" else None
        items.append({
            "source": "NASA EONET", "title": ev.get("title"), "date": (g.get("date") or "")[:10],
            "url": (ev.get("sources") or [{}])[0].get("url") or ev.get("link"), "lang": "en",
            "outlet": ", ".join(s_.get("id", "") for s_ in ev.get("sources", [])),
            "lon": coords[0] if coords else None, "lat": coords[1] if coords else None,
        })
    return items, url


def open_wildfires():
    """Wildfire events NASA EONET currently lists as open, worldwide (cached one hour)."""
    def fetch():
        data = json.loads(_get("https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&limit=200", 40))
        out = []
        for ev in data.get("events", []):
            g = (ev.get("geometry") or [{}])[-1]
            if g.get("type") != "Point":
                continue
            out.append({"title": ev.get("title"), "date": (g.get("date") or "")[:10], "lon": g["coordinates"][0],
                        "lat": g["coordinates"][1], "url": (ev.get("sources") or [{}])[0].get("url") or ev.get("link")})
        return sorted(out, key=lambda e: e["date"], reverse=True)
    return _cached("eonet-open", 3600, fetch)


def _gdelt_query(places, langs):
    words = []
    for lang in dict.fromkeys(langs + ["en"]):
        words += KEYWORDS.get(lang, [])
    ps = [f'"{p}"' if " " in p else p for p in dict.fromkeys(places[:5]) if p]
    pl = " OR ".join(ps)
    return f"{f'({pl})' if len(ps) > 1 else pl} ({' OR '.join(dict.fromkeys(words))})"  # GDELT rejects (x) without OR


def _gdelt_get(params, start, end):
    q = urllib.parse.urlencode({**params, "format": "json", "startdatetime": start.strftime("%Y%m%d000000"),
                                "enddatetime": end.strftime("%Y%m%d235959")})
    url = f"https://api.gdeltproject.org/api/v2/doc/doc?{q}"
    with _gdelt_lock:  # GDELT asks for at most one request every 5 seconds
        wait = 5.5 - (time.time() - _gdelt_last[0])
        if wait > 0:
            time.sleep(wait)
        try:
            body = _get(url, 45)
        finally:
            _gdelt_last[0] = time.time()
    try:
        return json.loads(body), url
    except json.JSONDecodeError:
        raise RuntimeError(body.strip()[:200] or "GDELT returned an empty response")


def gdelt_volume(places, langs, start, end):
    """Matching article count per month over the whole window (one request, not capped like the article list)."""
    query = _gdelt_query(places, langs)
    j, url = _gdelt_get({"query": query, "mode": "timelinevolraw"}, start, end)
    out = {}
    for x in ((j.get("timeline") or [{}])[0].get("data") or []):
        d = x.get("date") or ""
        if len(d) >= 6:
            out[f"{d[:4]}-{d[4:6]}"] = out.get(f"{d[:4]}-{d[4:6]}", 0) + int(x.get("value") or 0)
    return out, url, query


def gdelt(places, langs, start, end, maxrecords=40):
    query = _gdelt_query(places, langs)
    j, url = _gdelt_get({"query": query, "mode": "artlist", "maxrecords": maxrecords, "sort": "hybridrel"}, start, end)
    arts = j.get("articles", [])
    items = [{"source": "GDELT", "title": a.get("title"), "date": (a.get("seendate") or "")[:8], "url": a.get("url"),
              "lang": a.get("language"), "outlet": a.get("domain"), "country": a.get("sourcecountry")} for a in arts]
    for it in items:
        d = it["date"]
        it["date"] = f"{d[:4]}-{d[4:6]}-{d[6:8]}" if len(d) == 8 else d
    return items, url, query


def reliefweb(country, start, end):
    appname = os.environ.get("RELIEFWEB_APPNAME")
    body = json.dumps({
        "limit": 20, "profile": "list", "sort": ["date.created:desc"],
        "query": {"value": "fire OR wildfire OR \"forest fire\"", "fields": ["title"]},
        "filter": {"operator": "AND", "conditions": [
            {"field": "primary_country.name", "value": country},
            {"field": "date.created", "value": {"from": f"{start}T00:00:00+00:00", "to": f"{end}T23:59:59+00:00"}}]},
    }).encode()
    url = f"https://api.reliefweb.int/v2/reports?appname={urllib.parse.quote(appname)}"
    data = json.loads(_get(url, 40, data=body, headers={"Content-Type": "application/json"}))
    return [{"source": "ReliefWeb", "title": d["fields"].get("title"), "url": d["fields"].get("url"),
             "date": (d["fields"].get("date", {}).get("created") or "")[:10], "lang": "en",
             "outlet": "UN OCHA ReliefWeb"} for d in data.get("data", [])], url.split("?")[0]


def _run(name, coverage, fn, key, end):
    out = {"name": name, "coverage": coverage, "searched": True, "count": 0, "error": None, "query": None}
    try:
        res = _cached(key, _ttl(end), lambda: list(fn()))
        items = res[0]
        out["query"] = res[2] if len(res) > 2 else res[1]
        out["url"] = res[1]
        out["count"] = len(items)
        return out, items
    except urllib.error.HTTPError as ex:
        out["error"] = "rate-limited by the provider, try again shortly" if ex.code == 429 else f"HTTP {ex.code}"
    except Exception as ex:
        out["error"] = str(ex)[:200]
    return out, []


def assess(hist, n_items, sources):
    """hist: the period's rank/percentile against the same period in other years (from the calendar)."""
    searched = [s["name"] for s in sources if s["searched"] and not s["error"]]
    failed = [s["name"] for s in sources if s["error"]]
    caveat = ("Reports are matched by place name and date window only; open them to verify. "
              "Absence of reports is not evidence of absence: coverage varies by language, outlet and year.")
    pct = (hist or {}).get("percentile")
    if pct is None:
        label, tone = "Not enough history to compare this period", "neutral"
    elif pct >= 90 and n_items:
        label, tone = "Unusually high compared with the same period in other years, with matching reports", "confirmed"
    elif pct >= 90:
        label, tone = "Unusually high compared with the same period in other years; no matching reports found", "unverified"
    elif pct <= 10:
        label, tone = "Unusually low compared with the same period in other years", "low"
    else:
        label, tone = "Within the typical range for this time of year", "neutral"
    return {"label": label, "tone": tone, "rank": (hist or {}).get("rank"), "of_years": (hist or {}).get("of_years"),
            "percentile": pct, "reports_found": n_items, "sources_searched": searched, "sources_failed": failed,
            "caveat": caveat}


def _search(meta, start, end, wide=False):
    """All sources for one area and date window; wide=True asks each source for more rows (multi-year windows)."""
    bbox = meta["bbox"]
    places = meta.get("places") or [meta.get("name", "")]
    langs = meta.get("lang") or ["en"]
    sources, items = [], []

    src, it = _run("NASA EONET", "Curated natural events, mostly 2016 onward", lambda: eonet(bbox, start, end, 200 if wide else 50),
                   f"eonet:{bbox}:{start}:{end}:{wide}", end)
    sources.append(src)
    items += it

    if end < GDELT_START:
        sources.append({"name": "GDELT", "coverage": "Global online news, searchable from 2017-01-01",
                        "searched": False, "count": 0, "error": None,
                        "query": "not searched: period is before GDELT DOC coverage"})
    else:
        src, it = _run("GDELT", "Global online news in 65 languages, searchable from 2017-01-01",
                       lambda: gdelt(places, langs, max(start, GDELT_START), end, 250 if wide else 40),
                       f"gdelt:{places}:{langs}:{start}:{end}:{wide}", end)
        sources.append(src)
        items += it

    from .news_more import extra_sources  # late import: news_more imports this module
    extra_sources(meta, start, end, sources, items)

    if os.environ.get("RELIEFWEB_APPNAME") and meta.get("country"):
        src, it = _run("ReliefWeb", "UN OCHA humanitarian reports", lambda: reliefweb(meta["country"], start, end),
                       f"rw:{meta['country']}:{start}:{end}", end)
        sources.append(src)
        items += it

    seen, unique = set(), []
    for i in items:
        title = (i.get("title") or "").split(" | ")[0].strip().lower()  # drop " | Outlet name" suffixes
        if i.get("url") and i["url"] not in seen and (not title or title not in seen):  # syndicated copies share a title
            seen.update([i["url"], title])
            unique.append(i)
    return {"window": [str(start), str(end)], "places": places, "languages": langs, "sources": sources, "items": unique}


def reports(meta, period, hist):
    a, b = sc.period_bounds(period)
    r = _search(meta, a - WINDOW_PAD, min(b + WINDOW_PAD, dt.date.today()))
    return {"period": period, **r, "items": r["items"][:60], "assessment": assess(hist, len(r["items"]), r["sources"])}


# Off-season periods sit near zero in every year, so 2 hotspots can rank "top 10%"; never call that unusual
# (same floor as the early warning's 5-hotspot minimum).
MIN_UNUSUAL_HOTSPOTS = 5

MONTH_VERDICT = {
    "corroborated": "Unusually high, and reports match",
    "satellite_only": "Unusually high, no matching reports found",
    "reported_typical": "Reports found, but detections were typical for the month",
    "no_history": "Reports found; not enough history to compare",
}


def match_months(months, counts):
    """Join report counts to the monthly record and give each month and the whole window a rule-based verdict.

    months: [{period, value, percentile, recent_percentile, ...}] from the calendar; counts: {'YYYY-MM': reports}.
    A month is unusually high at or above the 90th percentile against all years OR against the recency-weighted
    baseline (recent years count more), so a month that is only unusual by today's standards is not missed.
    """
    rows = []
    for m in months:
        n, a, w = counts.get(m["period"], 0), m.get("percentile"), m.get("recent_percentile")
        flags = [name for name, x in (("all years", a), ("recent years", w)) if x is not None and x >= 90
                 and (m.get("value") is None or m["value"] >= MIN_UNUSUAL_HOTSPOTS)]
        pct = None if a is None and w is None else (90 if flags else 0)
        if pct is None:
            v = "no_history" if n else None
        elif pct >= 90:
            v = "corroborated" if n else "satellite_only"
        else:
            v = "reported_typical" if n else None
        if v:
            rows.append({**m, "reports": n, "verdict": v, "label": MONTH_VERDICT[v], "unusual_vs": flags})
    count = lambda k: sum(r["verdict"] == k for r in rows)  # noqa: E731
    ok, typ = count("corroborated"), count("reported_typical")
    hi = ok + count("satellite_only")
    if not rows:
        label, tone = "No unusually high months and no matching reports in this window", "neutral"
    elif not hi:
        label, tone = "Reports exist, but no month was unusually high in the satellite record", "low"
    elif ok / hi >= 0.5:
        label, tone = f"News agrees with the satellite record: {ok} of {hi} unusually high months have matching reports", "confirmed"
    elif ok:
        label, tone = f"Partly agrees: {ok} of {hi} unusually high months have matching reports", "unverified"
    else:
        label, tone = f"{hi} unusually high month{'s' if hi > 1 else ''}, none with matching reports in these sources", "unverified"
    return rows, {"label": label, "tone": tone, "unusual_months": hi, "corroborated": ok, "reported_typical": typ}


def article_fire_check(items, weekly):
    """Attach to each dated report the satellite record at that time: the ISO week it was published and the week
    before (news often lags the fire), keeping the more unusual of the two. 'unusual' = top 10% for that week of the
    year against all years or against the recency-weighted baseline. Returns (checked, in_unusual_weeks)."""
    idx = {k: i for i, k in enumerate(weekly["periods"])}
    c = weekly["classes"]["veg"]
    h, v = c["history"], c["hotspots"]["v"]
    wp = h.get("wpct") or [None] * len(v)
    checked = unusual = 0
    for it in items:
        it["fire"] = None
        try:
            d = dt.date.fromisoformat((it.get("date") or "")[:10])
        except ValueError:
            continue
        best = None
        for k in (sc.week_key(d), sc.week_key(d - dt.timedelta(days=7))):
            i = idx.get(k)
            if i is None or v[i] is None:
                continue
            row = {"period": k, "value": v[i], "pct": h["pct"][i], "wpct": wp[i]}
            row["too_few"] = v[i] < MIN_UNUSUAL_HOTSPOTS
            row["unusual"] = not row["too_few"] and any(x is not None and x >= 90 for x in (row["pct"], row["wpct"]))
            score = max(x for x in (row["pct"], row["wpct"], -1) if x is not None)
            if best is None or score > best[0]:
                best = (score, row)
        if best:
            it["fire"] = best[1]
            if it.get("relevant") is not False:
                checked += 1
                unusual += best[1]["unusual"]
    return checked, unusual


def _relevance(meta, items, classify):
    """Mark items relevant True/False with the classifier (Gemini); on any failure leave them unmarked."""
    if not classify or not items:
        return {"checked": False, "reason": "Gemini is not configured" if not classify else "no items"}
    titles = [i.get("title") or "" for i in items]
    area = ", ".join(dict.fromkeys([meta.get("name") or "", *(meta.get("places") or [])[:4], meta.get("country") or ""]))
    key = "rel:" + hashlib.sha1(json.dumps([area, titles], ensure_ascii=False).encode()).hexdigest()
    try:
        labels, model = _cached(key, 365 * 86400, lambda: list(classify(titles, area)))
    except Exception as ex:
        return {"checked": False, "reason": str(ex)[:200]}
    for it, ok in zip(items, labels):
        it["relevant"] = ok
    return {"checked": True, "model": model, "kept": sum(labels), "dropped": len(labels) - sum(labels)}


def timeline(meta, start, end, months, weekly=None, classify=None):
    """Reports for a multi-month window, matched month by month against the harmonized record.

    classify(titles, area) -> (labels, model) optionally drops headlines that are not about a vegetation fire here;
    weekly (the weekly block) adds, per article, the satellite record in the week it was published."""
    end = min(end, dt.date.today())
    r = _search(meta, start, end, wide=True)
    relevance = _relevance(meta, r["items"], classify)
    month = lambda it: (it.get("date") or "")[:7]  # noqa: E731
    counts, method = {}, "GDELT article volume per month, plus listed NASA EONET/ReliefWeb items"
    vol = None
    if end >= GDELT_START:
        try:  # the article list is capped at 250, so per-month counts come from GDELT's volume timeline
            vol = _cached(f"gdeltvol:{r['places']}:{r['languages']}:{start}:{end}", _ttl(end),
                          lambda: list(gdelt_volume(r["places"], r["languages"], max(start, GDELT_START), end)))[0]
        except Exception:
            method = "listed items only (GDELT volume timeline unavailable, so busy months may be undercounted)"
    for it in r["items"]:
        if it.get("relevant") is False:
            continue
        if vol is None or it["source"] != "GDELT":
            counts[month(it)] = counts.get(month(it), 0) + 1
    for k, n in (vol or {}).items():
        counts[k] = counts.get(k, 0) + n
    rows, verdict = match_months(months, counts)
    failed = [s["name"] for s in r["sources"] if s["error"]]
    if not any(s["searched"] and not s["error"] for s in r["sources"]):  # nothing searched: no verdict, not "no reports"
        verdict = {**verdict, "label": "Couldn't check: no news source answered. Try again shortly.", "tone": "neutral"}
    elif vol is None and end >= GDELT_START:  # the capped article sample favours some months; say so, don't hide it
        verdict = {**verdict, "label": verdict["label"] + " (from a capped sample of articles; search again for full monthly counts)"}
        for row in rows:
            if row["verdict"] == "satellite_only":
                row["label"] = "Unusually high; none in the capped article sample"
    checked, in_unusual = article_fire_check(r["items"], weekly) if weekly else (0, 0)
    return {**r, "months": rows, "verdict": {**verdict, "sources_failed": failed, "count_method": method},
            "relevance": relevance, "article_check": {"articles": checked, "in_unusual_weeks": in_unusual},
            "caveat": "Reports are matched by place name and month only, and each source returns at most a few hundred of "
                      "its most relevant items for the window: open them to verify. GDELT news starts in 2017. "
                      "Absence of reports is not evidence of absence, and reports in a typical month may describe "
                      "other fires (buildings, industry) rather than what the satellites saw."}
