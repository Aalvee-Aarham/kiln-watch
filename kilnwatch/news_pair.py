"""news-pair (docs/news_plan.md §5.2-5.4): add the satellite parts to the checked news stories and write `news/`.

No AI, no network, no key. It runs at deploy time against the exact public export being deployed, so every number on
the news page matches the rest of the site. For each story it computes, from our own data only:

- `sat`: what the satellites saw around the event date (a window of unusual and not-observed days, the usual kiln
  months, or the usual burning months);
- `season_so_far` and `how_common`: how common fire is in that place, with one fixed verdict rule;
- `earlier_news`: how many stories about the same place were published before it.

A story whose event date our data do not cover cannot get its satellite parts, so it is not published; it is counted in
`index.dropped` as `no_satellite_data`. The output follows web/src/lib/types.ts (NewsIndex, NewsPlaces, NewsSeason,
NewsPlaceStories) exactly.
"""
from __future__ import annotations

import csv
import logging
import re
import shutil
import statistics
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np

from . import config as C
from . import news_store as S

log = logging.getLogger("kilnwatch.news_pair")
SOURCES_CSV = C.STATIC / "news_sources.csv"
BLOCKLIST_CSV = C.STATIC / "news_blocklist.csv"
NATIONAL_NAMES = ("Bangladesh", "বাংলাদেশ")
DISTRICT_ID = re.compile(r"BD\d{4}")  # district p-codes; upazila files (BD + 8 digits) are not places on this page
NO_DATA = "no_satellite_data"
BLOCKED = "blocklisted"
ITEM_KEYS = ("news_id", "url", "outlet", "lang", "title", "published_date_local", "event_date_local", "event_date_stated",
             "kind", "unit_ids", "claim_en", "claim_bn", "quote", "sat", "season_so_far", "how_common", "earlier_news")
PLACE_STORY_KEYS = ("news_id", "date_local", "season", "kind", "outlet", "lang", "title", "url")
VERDICTS = ("common_now", "outside_season", "rare")
COORD_KEYS = {"lat", "lon", "latitude", "longitude"}
SEASON_MONTH_STARTS = [0, 31, 62, 92, 123, 153, 184, 215, 243, 274, 304, 335]  # day of season (0 = 1 July), non-leap


# --- small date helpers ----------------------------------------------------------------
def _d(s: str) -> date:
    return date.fromisoformat(s[:10])


def _season_start(d: date) -> date:
    y = d.year if (d.month, d.day) >= C.SEASON_YEAR_START else d.year - 1
    return date(y, *C.SEASON_YEAR_START)


def _season_month(month: int) -> int:
    """Calendar month (1-12) -> season month index (0 = July ... 11 = June)."""
    return (month - 7) % 12


def _calendar_month(season_month: int) -> int:
    return (season_month + 6) % 12 + 1


def _season_month_of_day(day_of_season: float) -> int:
    """Mirror of web/src/components/plain.tsx seasonMonthOf: day of season -> season month index, non-leap starts."""
    i = 0
    while i < 11 and day_of_season >= SEASON_MONTH_STARTS[i + 1]:
        i += 1
    return i


# --- per-district daily record: calendar (past seasons) + NRT (current season) ------------------
def _cal_len(cal: dict) -> int:
    """Days the calendar covers from its day0. `clear_frac` is dense over the whole calendar (pipeline._calendar), so it
    gives the exact end; `research.calendar_len` (last active or not-observed day) is the fallback when it is absent."""
    from .research import calendar_len

    dense = [len(v) for v in (cal.get("clear_frac") or {}).values()]
    return max([calendar_len(cal), *dense])


class Daily:
    """One district's day-by-day status around a story: unusual, normal, not observed, or not covered.

    Past seasons come from the calendar: `unusual` (day indices since day0) and `nodata` (inclusive runs). Days inside
    the live NRT season come from NRT `h` against the calendar's `normal.p90` through `nrt.above_p90`, the one shared
    comparison; NRT carries no not-observed days, so those days are provisional and cloud is not checked."""

    def __init__(self, cal: dict, nrt_day0: str | None = None, nrt_h: list | None = None):
        self.day0 = _d(cal["day0"])
        self.n = _cal_len(cal)
        self.unusual = np.zeros(self.n, bool)
        u = np.asarray([i for i in cal["unusual"] if 0 <= i < self.n], dtype=int)
        self.unusual[u] = True
        self.nodata = np.zeros(self.n, bool)
        for a, b in cal["nodata"]:
            self.nodata[max(a, 0):min(b, self.n - 1) + 1] = True
        self.nrt0, self.nrt = None, np.zeros(0, bool)
        if nrt_day0 is not None and nrt_h is not None:
            from .nrt import above_p90

            self.nrt0 = _d(nrt_day0)
            self.nrt = above_p90(nrt_h, cal["normal"]["p90"])

    def day(self, d: date) -> tuple[bool, bool | None] | None:
        """(unusual, not_observed) for one day; not_observed is None on NRT days (not checked); None = not covered."""
        if self.nrt0 is not None and 0 <= (d - self.nrt0).days < len(self.nrt):
            return bool(self.nrt[(d - self.nrt0).days]), None
        i = (d - self.day0).days
        if 0 <= i < self.n:
            return bool(self.unusual[i]), bool(self.nodata[i])
        return None

    def covers(self, d: date) -> bool:
        return self.day(d) is not None

    def last_day(self) -> date:
        ends = [self.day0 + timedelta(days=self.n - 1)]
        if self.nrt0 is not None and len(self.nrt):
            ends.append(self.nrt0 + timedelta(days=len(self.nrt) - 1))
        return max(ends)

    def tally(self, d0: date, d1: date, full: bool) -> dict | None:
        """Unusual and not-observed days in [d0, d1] (inclusive). full=True: None unless every day is covered;
        full=False: count the covered days only (None when none is). `to` is the last covered day counted."""
        n_days = (d1 - d0).days + 1
        unusual, not_obs, provisional, to = 0, 0, False, None
        for k in range(max(n_days, 0)):  # bounded by the window length
            d = d0 + timedelta(days=k)
            s = self.day(d)
            if s is None:
                if full:
                    return None
                continue
            unusual += s[0]
            if s[1] is None:
                provisional = True
            else:
                not_obs += s[1]
            to = d
        if to is None:
            return None
        return {"unusual": unusual, "not_observed": None if provisional else not_obs, "provisional": provisional, "to": to}


def _window(daily: Daily, d0: date, d1: date) -> dict | None:
    """One district-level NewsWindow, or None when a day of it is not covered. "Can't tell" (unusual_days null) when at
    least NEWS_CLOUDY_MIN_DAYS of a NEWS_BURN_WINDOW_DAYS window were not observed: the same share for longer windows."""
    t = daily.tally(d0, d1, full=True)
    if t is None:
        return None
    n = (d1 - d0).days + 1
    cloudy = t["not_observed"] is not None and t["not_observed"] * C.NEWS_BURN_WINDOW_DAYS >= C.NEWS_CLOUDY_MIN_DAYS * n
    return {"from": d0.isoformat(), "to": d1.isoformat(), "unusual_days": None if cloudy else t["unusual"],
            "not_observed_days": t["not_observed"], "_provisional": t["provisional"]}


def _national_window(dailies: dict[str, Daily], d0: date, d1: date) -> dict | None:
    """National NewsWindow: districts with >= 1 unusual day, over the districts whose window is fully covered."""
    ts = [t for t in (dy.tally(d0, d1, full=True) for dy in dailies.values()) if t is not None]
    if not ts:
        return None
    return {"from": d0.isoformat(), "to": d1.isoformat(), "unusual_days": None, "not_observed_days": None,
            "districts_unusual": sum(t["unusual"] > 0 for t in ts), "_provisional": any(t["provisional"] for t in ts)}


def _public(w: dict | None) -> dict | None:
    return None if w is None else {k: v for k, v in w.items() if not k.startswith("_")}


# --- how common is fire here (§5.3) -------------------------------------------------------
def place_record(cal: dict | None) -> dict:
    """The record half of "How common is fire here?" for one district, from its calendar.

    - record_from / seasons_in_record: the seasons (1 July - 30 June) that lie wholly inside the calendar's coverage,
      from its day0 to its last covered day (`_cal_len`). A calendar from 2003-01-01 to 2026-10-05 gives 2003-04 ...
      2025-26: record_from "2003-04", seasons_in_record 23. Partial seasons at either end are not in the record.
    - seasons_with_burning: calendar `seasons[]` entries inside the record whose duration p50 > 0 (a duration object
      alone is not enough: a measured season can last 0 days).
    - typical_duration_days: the median of those durations (1 decimal), null when there is none.
    - typical: `ask._busy_months(ask._season_profile(cal))` (= plain.ts busyMonths) as calendar months 1-12; null when
      the profile is all zero.
    """
    empty = {"record_from": None, "seasons_in_record": 0, "seasons_with_burning": 0, "typical_duration_days": None, "typical": None}
    if cal is None:
        return empty
    from .ask import MONTHS, _busy_months, _season_profile
    from .grid import season_of

    day0 = _d(cal["day0"])
    last = day0 + timedelta(days=_cal_len(cal) - 1)
    first_y = day0.year if (day0.month, day0.day) <= C.SEASON_YEAR_START else day0.year + 1
    last_y = last.year - 1 if (last.month, last.day) >= (6, 30) else last.year - 2  # season y-(y+1) ends 30 June y+1
    record = [season_of(date(y, *C.SEASON_YEAR_START)) for y in range(first_y, last_y + 1)]
    inside = set(record)
    durations = [float(s["duration"]["p50"]) for s in cal["seasons"]
                 if s.get("season") in inside and s.get("duration") and s["duration"].get("p50") is not None and s["duration"]["p50"] > 0]
    busy = _busy_months(_season_profile(cal))
    typical = None if busy is None else {
        "first_month": _calendar_month(MONTHS.index(busy["usual_first_month"])),
        "busiest_month": _calendar_month(MONTHS.index(busy["busiest_month"])),
        "last_month": _calendar_month(MONTHS.index(busy["usual_last_month"]))}
    return {"record_from": record[0] if record else None, "seasons_in_record": len(record), "seasons_with_burning": len(durations),
            "typical_duration_days": round(statistics.median(durations), 1) if durations else None, "typical": typical}


def verdict(place: dict, event: date) -> str:
    """`rare` with no typical year or when seasons with burning / seasons in record < NEWS_RARE_SEASON_FRAC; otherwise
    `common_now` when the event month is inside the typical months (July-June order), else `outside_season`."""
    typ, n = place["typical"], place["seasons_in_record"]
    if typ is None or n == 0 or place["seasons_with_burning"] / n < C.NEWS_RARE_SEASON_FRAC:
        return "rare"
    m = _season_month(event.month)
    return "common_now" if _season_month(typ["first_month"]) <= m <= _season_month(typ["last_month"]) else "outside_season"


def busy_months(place: dict) -> list[int] | None:
    """The typical months as calendar months in July-June order, e.g. [11, 12, 1, 2]."""
    typ = place["typical"]
    if typ is None:
        return None
    return [_calendar_month(i) for i in range(_season_month(typ["first_month"]), _season_month(typ["last_month"]) + 1)]


def kiln_months(area: dict | None) -> list[int] | None:
    """Months kilns in the area usually work. Mirrors web/src/lib/plain.ts typicalSeason (median onset and end over the
    last 3 seasons with both) and components/plain.tsx windowLevels/seasonMonthOf (onset month to end month), so the
    news page and the Area page show the same months. None when the area has no estimate (< 5 clusters, no rows)."""
    if not area or (area.get("n_clusters") or 0) < 5:
        return None
    ok = [r for r in area.get("seasons") or [] if r.get("onset") and r.get("end")][-3:]
    if not ok:
        return None
    a = _season_month_of_day(statistics.median(r["onset"]["p50"] for r in ok))
    b = _season_month_of_day(statistics.median(r["end"]["p50"] for r in ok))
    return [_calendar_month(i) for i in range(a, b + 1)] if a <= b else None


# --- inputs -------------------------------------------------------------------------------
def _read_csv(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _blocklist(blocklist) -> set[str]:
    """news_ids (sha256 of the canonical URL) of blocklisted links. Accepts a CSV path (url,reason,removed_by,removed_on),
    a list of URLs, or None. A missing CSV means no blocklist."""
    if blocklist is None:
        return set()
    if isinstance(blocklist, (str, Path)):
        p = Path(blocklist)
        urls = [r["url"] for r in _read_csv(p) if (r.get("url") or "").strip()] if p.exists() else []
    else:
        urls = list(blocklist)
    return {S.news_id(u) for u in urls}


def _sources(sources, store: dict, items: list[dict]) -> list[dict]:
    """index.sources: rows of data/static/news_sources.csv (a path or a list of row dicts), with each outlet's coverage
    from the store. Without the CSV, falls back to the store's coverage keys, with outlet and language from its items."""
    rows = None
    if isinstance(sources, (str, Path)):
        rows = _read_csv(Path(sources)) if Path(sources).exists() else None
    elif sources is not None:
        rows = list(sources)
    if rows is None:
        seen = {}
        for it in items:
            seen.setdefault(it["source"], {"key": it["source"], "outlet": it["outlet"], "lang": it["lang"], "status": "active"})
        missing = sorted(set(store.get("coverage", {})) - set(seen))
        if missing:
            log.info("sources without the CSV or any item, not listed: %s", ", ".join(missing))
        rows = [seen[k] for k in sorted(seen)]
    out = []
    for r in rows:
        status = (r.get("status") or "").strip().lower()
        lang = (r.get("lang") or "").strip()
        if status not in ("active", "excluded") or lang not in S.LANGS:
            raise ValueError(f"news source {r.get('key')!r}: status {status!r} / lang {lang!r} not in the contract")
        cov = store.get("coverage", {}).get(r["key"], {})
        s = {"key": r["key"], "outlet": r["outlet"], "lang": lang, "status": status}
        if (r.get("reason") or "").strip():
            s["reason"] = r["reason"].strip()
        s["read_back_to"] = cov.get("read_back_to")
        s["last_scanned"] = cov.get("last_scanned")
        out.append(s)
    return out


def _districts(d) -> dict[str, tuple[str, str]]:
    fc = d.json("aoi/districts.geojson")
    if fc is None:
        raise FileNotFoundError(f"{d.src / 'aoi/districts.geojson'}: news-pair needs the district names")
    out = {}
    for f in fc["features"]:
        p = f["properties"]
        if p.get("level", "district") == "district" and DISTRICT_ID.fullmatch(p["unit_id"]):
            out[p["unit_id"]] = (p["name_en"], p.get("name_bn") or p["name_en"])
    return dict(sorted(out.items()))


# --- one story --------------------------------------------------------------------------------
def pair_item(it: dict, ctx: dict) -> dict | None:
    """The published NewsItem for one stored story, or None when our data do not cover it (no satellite parts)."""
    e = _d(it["event_date_local"])
    u0 = it["unit_ids"][0]
    national = u0 == S.NATIONAL
    dailies: dict[str, Daily] = ctx["dailies"]
    wlen = C.NEWS_ENFORCE_WINDOW_DAYS if it["kind"] == "enforcement" else C.NEWS_BURN_WINDOW_DAYS
    b0, b1 = e - timedelta(days=wlen - 1), e  # the window ends on the event date
    a0, a1 = e + timedelta(days=1), e + timedelta(days=C.NEWS_ENFORCE_WINDOW_DAYS)
    s0 = _season_start(e)
    if national:
        before = _national_window(dailies, b0, b1)
        if before is None:
            return None
        sat = {"type": "window", "level": "national", "provisional": before["_provisional"], "before": _public(before)}
        if it["kind"] == "enforcement":
            after = _national_window(dailies, a0, a1)
            sat["after"] = _public(after)
            sat["provisional"] = sat["provisional"] or bool(after and after["_provisional"])
        ts = [t for t in (dy.tally(s0, e, full=False) for dy in dailies.values()) if t is not None]
        to = max(t["to"] for t in ts)
        so_far = {"unusual_days": None, "not_observed_days": None, "districts_unusual": sum(t["unusual"] > 0 for t in ts),
                  "provisional": any(t["provisional"] for t in ts), "to": to.isoformat()}
        how = None
    else:
        dy = dailies.get(u0)
        if dy is None or not dy.covers(e):
            return None
        if it["kind"] in ("burning", "enforcement"):
            before = _window(dy, b0, b1)
            if before is None:
                return None
            sat = {"type": "window", "level": "district", "provisional": before["_provisional"], "before": _public(before)}
            if it["kind"] == "enforcement":
                after = _window(dy, a0, a1)  # None until all 14 days after the event are in the data
                sat["after"] = _public(after)
                sat["provisional"] = sat["provisional"] or bool(after and after["_provisional"])
        elif it["kind"] == "kilns_operating":
            months = kiln_months(ctx["kiln_areas"].get(u0))
            sat = {"type": "kiln_months", "usual_months": months, "inside": None if months is None else e.month in months}
        else:  # air_health
            months = busy_months(ctx["places"][u0])
            sat = {"type": "burning_season", "usual_months": months, "inside": None if months is None else e.month in months}
            o = ctx["outlook"](u0, e)
            if o is not ...:
                sat["outlook_frac"] = o
        t = dy.tally(s0, e, full=False)
        so_far = {"unusual_days": t["unusual"], "not_observed_days": t["not_observed"], "provisional": t["provisional"], "to": t["to"].isoformat()}
        how = verdict(ctx["places"][u0], e)
    out = {k: it[k] for k in ITEM_KEYS[:13]}
    out["unit_ids"] = list(it["unit_ids"])
    return {**out, "sat": sat, "season_so_far": so_far, "how_common": how, "earlier_news": 0}


def _outlook_fn(d):
    """outlook_frac for an air_health story: only when the outlook ships and the story is from the current week (event
    date within the 7 days ending on the last NRT day). `...` = leave the key out. Reuses ask.two_week_outlook."""
    from .ask import two_week_outlook

    o = d.json("outlook.json")
    if not o or not o.get("ships") or not d.json("nrt/current_season.json"):
        return lambda unit_id, event: ...

    def f(unit_id: str, event: date):
        r = two_week_outlook(d, unit_id)
        if "error" in r:
            return ...
        data_to = _d(r["data_to"])
        if not (data_to - timedelta(days=6) <= event <= data_to):
            return ...
        return round(r["chance_of_unusual_day_next_14_days_pct"] / 100, 2) if r.get("state") == "on" else None
    return f


# --- stage checks --------------------------------------------------------------------------
def _walk(obj, path="$"):
    stack = [(obj, path)]
    while stack:
        o, p = stack.pop()
        yield o, p
        if isinstance(o, dict):
            stack.extend((v, f"{p}.{k}") for k, v in o.items())
        elif isinstance(o, list):
            stack.extend((v, f"{p}[{i}]") for i, v in enumerate(o))


def check_outputs(index: dict, places: dict, seasons: dict[str, dict], place_files: dict[str, dict]) -> None:
    """Stage checks (§5.2): every published item has both satellite parts per the contract, the counts equal the items,
    every array stays at or below NEWS_MAX_ITEMS_PER_MONTH, and no key is forbidden or a coordinate."""
    from .export import assert_public_safe
    from .grid import season_of

    errs = []
    named: dict[str, dict[str, set]] = {}
    for season, f in seasons.items():
        if f["season"] != season:
            errs.append(f"{season}.json: season {f['season']!r}")
        for month, items in f["months"].items():
            for it in items:
                w = f"{season}/{month}/{it.get('news_id')}"
                if tuple(it) != ITEM_KEYS:
                    errs.append(f"{w}: keys {sorted(it)}")
                    continue
                national = it["unit_ids"] == [S.NATIONAL]
                sat, sf = it["sat"], it["season_so_far"]
                if sat.get("type") == "window":
                    windows = [sat["before"]] + ([sat["after"]] if sat.get("after") else [])
                    if sat["level"] != ("national" if national else "district") or not isinstance(sat["provisional"], bool):
                        errs.append(f"{w}: window level/provisional")
                    if ("after" in sat) != (it["kind"] == "enforcement"):
                        errs.append(f"{w}: 'after' only on enforcement stories")
                    for win in windows:
                        if not {"from", "to", "unusual_days", "not_observed_days"} <= set(win) or national != ("districts_unusual" in win):
                            errs.append(f"{w}: window keys {sorted(win)}")
                elif sat.get("type") in ("kiln_months", "burning_season"):
                    if national or (sat["type"] == "kiln_months") != (it["kind"] == "kilns_operating") or \
                            not {"usual_months", "inside"} <= set(sat) or (sat["usual_months"] is None) != (sat["inside"] is None):
                        errs.append(f"{w}: {sat['type']} part")
                else:
                    errs.append(f"{w}: sat type {sat.get('type')!r}")
                if not {"unusual_days", "not_observed_days", "provisional", "to"} <= set(sf) or national != ("districts_unusual" in sf):
                    errs.append(f"{w}: season_so_far keys {sorted(sf)}")
                if (it["how_common"] is None) != national or (it["how_common"] is not None and it["how_common"] not in VERDICTS):
                    errs.append(f"{w}: how_common {it['how_common']!r}")
                if not month == it["event_date_local"][:7] or season_of(it["event_date_local"]) != season:
                    errs.append(f"{w}: filed under the wrong month or season")
                for u in it["unit_ids"]:
                    named.setdefault(season, {}).setdefault(u, set()).add(it["news_id"])
    counts = {s: {u: len(ids) for u, ids in us.items()} for s, us in named.items()}
    if counts != index["counts"]:
        errs.append("index.counts do not equal the stories in the season files")
    if sorted(seasons, reverse=True) != index["seasons"]:
        errs.append("index.seasons do not list the season files, newest first")
    for u, pf in place_files.items():
        ids = {r["news_id"] for rows in pf["months"].values() for r in rows}
        want = set().union(*(us.get(u, set()) for us in named.values()))
        if ids != want or sum(map(len, pf["months"].values())) != places[u]["news_total"] or any(tuple(r) != PLACE_STORY_KEYS for rows in pf["months"].values() for r in rows):
            errs.append(f"place/{u}.json does not list exactly the stories naming {u}")
    if {u for us in named.values() for u in us} != set(place_files) or not set(place_files) <= set(places):
        errs.append("place files and places do not match the units named by stories")
    for name, obj in [("index", index), ("places", places), *seasons.items(), *((f"place/{u}", p) for u, p in place_files.items())]:
        assert_public_safe(obj)
        for o, p in _walk(obj):
            if isinstance(o, list) and len(o) > C.NEWS_MAX_ITEMS_PER_MONTH:
                errs.append(f"{name}: {p} has {len(o)} > NEWS_MAX_ITEMS_PER_MONTH entries")
            if isinstance(o, dict) and COORD_KEYS & set(o):
                errs.append(f"{name}: coordinate key at {p}")
    if errs:
        raise AssertionError("news-pair stage checks: " + "; ".join(errs[:20]))


# --- run -------------------------------------------------------------------------------------
def build(src: Path, store: dict, sources=SOURCES_CSV, blocklist=BLOCKLIST_CSV, generated_at: str | None = None):
    """All news files as objects: (index, places, {season: NewsSeason}, {unit_id: NewsPlaceStories}, dropped counts)."""
    from .ask import Data

    d = Data(src)
    districts = _districts(d)
    nrt = d.json("nrt/current_season.json")
    cals = {u: d.json(f"calendar/{u}.json") for u in districts}
    dailies = {}
    for u, cal in cals.items():
        if cal is None:
            continue
        h = (nrt or {}).get("districts", {}).get(u, {}).get("h")
        dailies[u] = Daily(cal, nrt["day0"] if h is not None else None, h)
    places = {u: {"unit_id": u, "name_en": en, "name_bn": bn, **place_record(cals[u])} for u, (en, bn) in districts.items()}
    places[S.NATIONAL] = {"unit_id": S.NATIONAL, "name_en": NATIONAL_NAMES[0], "name_bn": NATIONAL_NAMES[1], **place_record(None)}
    ka = d.json("kiln_activity.json") or {}
    ctx = {"dailies": dailies, "places": places, "kiln_areas": (ka.get("areas") or {}) if ka.get("layer") else {}, "outlook": _outlook_fn(d)}

    blocked = _blocklist(blocklist)
    bad = {it.get("news_id"): errs for it in store["items"] if (errs := S.validate_item(it))}
    if bad:
        raise ValueError(f"news store items fail validation: {dict(list(bad.items())[:5])}")
    dropped = {r: int(n) for r, n in (store.get("dropped") or {}).items() if n}
    unknown = sorted({u for it in store["items"] for u in it["unit_ids"]} - set(places))
    if unknown:
        raise ValueError(f"news store names unit_ids that are not districts of this export: {unknown[:10]}")
    pub = []
    for it in sorted(store["items"], key=lambda i: (i["published_date_local"], i["news_id"])):
        if it["kind"] not in S.KINDS_PUBLISHED:
            continue  # policy stories go to the Timeline review list, never the page
        if it["news_id"] in blocked:
            dropped[BLOCKED] = dropped.get(BLOCKED, 0) + 1
            continue
        out = pair_item(it, ctx)
        if out is None:
            dropped[NO_DATA] = dropped.get(NO_DATA, 0) + 1
            continue
        pub.append((it, out))

    # earlier news: published stories naming unit_ids[0], published strictly before this one
    for it, out in pub:
        u0 = it["unit_ids"][0]
        out["earlier_news"] = sum(1 for o, _ in pub if u0 in o["unit_ids"] and o["published_date_local"] < it["published_date_local"])
    seasons: dict[str, dict] = {}
    for it, out in sorted(pub, key=lambda p: (p[1]["event_date_local"], p[1]["published_date_local"], p[1]["news_id"]), reverse=True):
        f = seasons.setdefault(it["season"], {"season": it["season"], "months": {}})
        f["months"].setdefault(it["event_date_local"][:7], []).append(out)
    place_files: dict[str, dict] = {}
    for it, out in sorted(pub, key=lambda p: (p[1]["published_date_local"], p[1]["news_id"]), reverse=True):
        row = {"news_id": out["news_id"], "date_local": out["published_date_local"], "season": it["season"], "kind": out["kind"],
               "outlet": out["outlet"], "lang": out["lang"], "title": out["title"], "url": out["url"]}
        for u in it["unit_ids"]:
            pf = place_files.setdefault(u, {"unit_id": u, "months": {}})
            pf["months"].setdefault(row["date_local"][:7], []).append(row)
    for u, p in places.items():
        dates = [r["date_local"] for rows in place_files.get(u, {"months": {}})["months"].values() for r in rows]
        p["news_total"], p["news_from"] = len(dates), min(dates) if dates else None
    counts: dict[str, dict[str, int]] = {}
    for it, _ in pub:
        for u in it["unit_ids"]:
            c = counts.setdefault(it["season"], {})
            c[u] = c.get(u, 0) + 1
    meta = d.json("meta.json") or {}
    index = {"generated_at": generated_at or datetime.now(timezone.utc).isoformat(timespec="seconds"),
             "store_updated_at": store.get("updated_at"), "data_build": str(meta.get("git_sha") or "unknown"),
             "model": store.get("model") or C.NEWS_MODEL, "seasons": sorted(seasons, reverse=True),
             "rules": {"burn_window_days": C.NEWS_BURN_WINDOW_DAYS, "enforce_window_days": C.NEWS_ENFORCE_WINDOW_DAYS,
                       "cloudy_min_days": C.NEWS_CLOUDY_MIN_DAYS, "rare_season_frac": C.NEWS_RARE_SEASON_FRAC, "earlier_shown": C.NEWS_EARLIER_SHOWN},
             "sources": _sources(sources, store, [i for i, _ in pub] or store["items"]),
             "counts": {s: dict(sorted(c.items())) for s, c in sorted(counts.items())},
             "dropped": [{"reason": r, "n": n} for r, n in sorted(dropped.items())]}
    return index, places, seasons, place_files, dropped


def run(src: Path = C.WEB_DATA, store_path: Path | None = None, *, store: dict | None = None, sources=SOURCES_CSV,
        blocklist=BLOCKLIST_CSV, generated_at: str | None = None) -> dict:
    """Pair the store (or `store`, an in-memory store) with the export at `src` and write `src/news/`.

    `sources` and `blocklist` take a CSV path, a list (rows / URLs) or None. With no published story, `news/` is removed
    and nothing is written: the news page and its nav item stay hidden. The set is built in `src/.news-build/news/`,
    checked (stage checks, size budgets) and only then moved into `news/` file by file (atomic replaces), with files of
    an earlier run that this one no longer writes removed; a failed check leaves the previous set untouched."""
    from .export import _dump, check_budgets

    src = Path(src)
    store = store if store is not None else S.load(store_path)
    index, places, seasons, place_files, dropped = build(src, store, sources, blocklist, generated_at)
    out, build_dir = src / "news", src / ".news-build"
    n = sum(len(v) for f in seasons.values() for v in f["months"].values())
    if n == 0:
        if out.exists():
            shutil.rmtree(out)
        log.info("news-pair: no story to publish (dropped %s); news/ not written", dropped)
        return {"published": 0, "dropped": dropped, "seasons": [], "out": None}
    check_outputs(index, places, seasons, place_files)
    if build_dir.exists():
        shutil.rmtree(build_dir)
    try:
        new = build_dir / "news"
        _dump(index, new / "index.json")
        _dump(places, new / "places.json")
        for s, f in seasons.items():
            _dump(f, new / f"{s}.json")
        for u, pf in place_files.items():
            _dump(pf, new / "place" / f"{u}.json")
        errs = check_budgets(build_dir, only="news/")
        if errs:
            raise AssertionError("news budgets: " + "; ".join(errs))
        # swap in file by file: each replace is atomic, and Windows refuses directory renames under watched folders
        files = {p.relative_to(new) for p in new.rglob("*.json")}
        for rel in files:
            (out / rel).parent.mkdir(parents=True, exist_ok=True)
            (new / rel).replace(out / rel)
        for p in sorted(out.rglob("*"), reverse=True):  # files of an earlier run that this one no longer writes
            if p.is_file() and p.relative_to(out) not in files:
                p.unlink()
            elif p.is_dir() and not any(p.iterdir()):
                p.rmdir()
    finally:
        shutil.rmtree(build_dir, ignore_errors=True)
    log.info("news-pair: %d stories in %d seasons, %d place files; dropped %s", n, len(seasons), len(place_files), dropped)
    return {"published": n, "dropped": dropped, "seasons": index["seasons"], "out": str(out)}
