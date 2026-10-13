"""Ask Kiln Watch (docs/roadmap.md F7): Gemini answers questions by calling the project's own functions.

The model retrieves, orchestrates and explains; it never computes. Every number in an answer must appear in a tool
result (`guard`), or the answer is blocked. Tools read only the public export, so an answer can hold nothing the
website does not already publish. Answers to the demo questions are cached to `ask.json` for offline use.
"""
from __future__ import annotations

import json
import logging
import math
import re
from pathlib import Path

import numpy as np
import pandas as pd

from . import config as C

log = logging.getLogger("kilnwatch.ask")
MODEL = "gemini-3.5-flash-lite"  # GA, supports function calling (ai.google.dev/gemini-api/docs/models)
GEMINI = "https://generativelanguage.googleapis.com/v1beta/models"
# a declined request: the prompt was blocked, or the answer stopped for one of these reasons
REFUSALS = {"SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY"}
MAX_STEPS = 6  # hard cap on model calls per question (no unbounded loops)
SITE = "https://aalvee-aarham.github.io/kiln-watch"
MONTHS = ["July", "August", "September", "October", "November", "December", "January", "February", "March", "April", "May", "June"]
DEMO_QUESTIONS = [
    ("When is burning season in Rajshahi, and is this year unusual so far?", "en"),
    ("Is burning in Dhaka district above normal right now, and what about the next two weeks?", "en"),
    ("Did the correction really remove the 2012 jump in fire counts?", "en"),
    ("নওগাঁ জেলায় কখন আগুন বেশি জ্বলে?", "bn"),
    ("When do brick kilns operate around Dhaka, and how long is their season?", "en"),
    ("How many kiln clusters does Bangladesh have, and when does their season run?", "en"),
]
SYSTEM = """You answer questions about fire activity in Bangladesh for Kiln Watch, a NASA Space Apps project that harmonizes \
MODIS and VIIRS fire detections into one burning calendar per district and upazila.

Rules:
- Use the tools for every fact. Never compute, estimate or round a number yourself: state numbers exactly as a tool returned them.
- If no tool answers the question, say so plainly instead of guessing.
- Fire activity counts satellite fire detections per cloud-free area. It is not smoke, air quality or emissions, and it never shows that a particular kiln or farmer broke the law.
- Say "provisional" when you use live data for this season.
- Answer in two to four short sentences, in the language of the question (English or Bangla)."""


class Data:
    """Read-only access to one public export directory."""

    def __init__(self, src: Path = C.WEB_DATA):
        self.src = Path(src)
        self._cache: dict[str, object] = {}

    def json(self, rel: str):
        if rel not in self._cache:
            p = self.src / rel
            self._cache[rel] = json.loads(p.read_text(encoding="utf-8")) if p.exists() else None
        return self._cache[rel]

    def prov(self, rel: str, dataset: str) -> dict:
        meta = self.json("meta.json") or {}
        return {"dataset_id": dataset, "source_url": f"{SITE}/data/{rel}", "data_build": meta.get("git_sha")}


FIRE = "NASA FIRMS MODIS C6.1 + VIIRS 375 m, harmonized to Aqua-MODIS equivalent (Kiln Watch)"
# in the tool results, so a model that explains "unusual" states a number our data returned
UNUSUAL_MEANS = "a day above that day's 90th-percentile normal for the district"


def _p_value(p: float) -> float | str:
    """A p-value as it is reported and can be quoted exactly: 3 decimals, or "below 0.001"."""
    return "below 0.001" if p < 0.001 else round(p, 3)


def find_area(d: Data, name: str) -> dict:
    units = [f["properties"] for lvl in ("district", "upazila") for f in (d.json(f"aoi/{lvl}s.geojson") or {}).get("features", [])]
    q = name.strip().lower()
    hits = [u for u in units if q and (q in u["name_en"].lower() or q in (u.get("name_bn") or ""))]
    hits.sort(key=lambda u: (u["name_en"].lower() != q, u["level"] != "district", u["name_en"]))
    return {"matches": [{k: u.get(k) for k in ("unit_id", "name_en", "name_bn", "level", "division")} for u in hits[:5]],
            "provenance": d.prov("aoi/districts.geojson", "OCHA HDX COD-AB Bangladesh boundaries")}


def _season_profile(cal: dict) -> np.ndarray:
    """Mean harmonized activity per day of season (0 = 1 July) over observed days, as the website's seasonMean."""
    from .research import calendar_daily

    df = calendar_daily(cal).dropna(subset=["h"])
    y = df.date.dt.year - (df.date.dt.month < 7)
    sd = ((df.date - pd.to_datetime(y.astype(str) + "-07-01")).dt.days).clip(upper=365)
    return df.h.groupby(sd).mean().reindex(range(366), fill_value=0).to_numpy()


def _busy_months(per_day: np.ndarray, share=0.25) -> dict | None:
    """Same rule as web/src/lib/plain.ts busyMonths: the peak month, widened while neighbours reach 25% of it."""
    starts = [0, 31, 62, 92, 123, 153, 184, 215, 243, 274, 304, 335, 366]
    m = [float(np.mean(per_day[a:b])) for a, b in zip(starts[:-1], starts[1:])]
    top = max(m)
    if not top > 0:
        return None
    peak = m.index(top)
    first = last = peak
    while first > 0 and m[first - 1] >= share * top:
        first -= 1
    while last < 11 and m[last + 1] >= share * top:
        last += 1
    return {"usual_first_month": MONTHS[first], "busiest_month": MONTHS[peak], "usual_last_month": MONTHS[last]}


def _when_text(day_of_season: float) -> str:
    """Same rule as web/src/lib/plain.ts whenText: day 0 = 1 July, non-leap season year."""
    d = pd.Timestamp("2001-07-01") + pd.Timedelta(days=math.floor(day_of_season + 0.5))  # JS Math.round, not banker's rounding
    return f"early {d.month_name()}" if d.day <= 10 else f"mid-{d.month_name()}" if d.day <= 20 else f"late {d.month_name()}"


def _typical_season(rows: list[dict], n: int = 3) -> dict | None:
    """Same rule as web/src/lib/plain.ts typicalSeason: medians over the last n seasons with a measured start and end."""
    ok = [r for r in rows if r.get("onset") and r.get("end")][-n:]
    if not ok:
        return None
    peaks = [r["peak"]["p50"] for r in ok if r.get("peak")]
    return {"onset": float(np.median([r["onset"]["p50"] for r in ok])), "end": float(np.median([r["end"]["p50"] for r in ok])),
            "peak": float(np.median(peaks)) if peaks else None,
            "duration": float(np.median([r["duration"]["p50"] if r.get("duration") else r["end"]["p50"] - r["onset"]["p50"] for r in ok])),
            "seasons": [r["season"] for r in ok]}


def area_fire_calendar(d: Data, unit_id: str) -> dict:
    rel = f"calendar/{unit_id}.json"
    cal = d.json(rel)
    if cal is None:
        return {"error": f"no calendar for {unit_id}"}
    seasons = [s for s in cal["seasons"] if s.get("duration")]
    last = seasons[-1] if seasons else None
    from .research import calendar_len

    n_days = calendar_len(cal)
    return {"unit_id": unit_id, "record_starts": cal["day0"], "years_of_record": round(n_days / 365.25),
            "typical_year": _busy_months(_season_profile(cal)), "seasons_measured": len(seasons),
            "latest_full_season": last and {"season": last["season"], "duration_days": last["duration"]["p50"], "duration_days_95ci": [last["duration"]["lo"], last["duration"]["hi"]]},
            "provenance": d.prov(rel, FIRE)}


def this_season(d: Data, unit_id: str) -> dict:
    nrt = d.json("nrt/current_season.json")
    dist = unit_id[:6]  # live data are by district (lib/geo.ts districtOf)
    if not nrt or dist not in nrt["districts"]:
        return {"error": "no live data for this district"}
    h = nrt["districts"][dist]["h"]
    as_of = pd.Timestamp(nrt["day0"]) + pd.Timedelta(days=len(h) - 1)
    return {"district": dist, "season": nrt["season"], "data_to": as_of.strftime("%Y-%m-%d"), "unusual_days_so_far": nrt["districts"][dist]["above_p90_days"], "unusual_day_means": UNUSUAL_MEANS,
            "provisional": True, "provenance": d.prov("nrt/current_season.json", "NASA FIRMS near-real-time VIIRS (NOAA-20, Suomi NPP), harmonized")}


def two_week_outlook(d: Data, unit_id: str) -> dict:
    """Mirror of web/src/lib/outlook.ts outlookFor, from outlook.json and the live season."""
    o, nrt = d.json("outlook.json"), d.json("nrt/current_season.json")
    dist = unit_id[:6]
    cal = d.json(f"calendar/{dist}.json")
    if not o or not o.get("ships") or not nrt or not cal or dist not in o["districts"] or dist not in nrt["districts"]:
        return {"error": "no tested outlook for this district"}
    h = nrt["districts"][dist]["h"]
    last = len(h) - 1
    as_of = pd.Timestamp(nrt["day0"]) + pd.Timedelta(days=last)
    mm, dd = (int(x) for x in o["start"].split("-"))
    opens = pd.Timestamp(int(nrt["season"][:4]), mm, dd)
    k = (as_of + pd.Timedelta(days=1) - opens).days // o["step_days"]  # row k forecasts from day (opens + 7k), as in the backtest
    base = {"district": dist, "data_to": as_of.strftime("%Y-%m-%d"), "unusual_day_means": UNUSUAL_MEANS, "provenance": d.prov("outlook.json", "Kiln Watch outlook, backtested on " + FIRE),
            "backtest_brier_skill": o["backtest"]["brier_skill"]}
    if k < 0 or k >= o["weeks"]:
        return {**base, "state": "outside the outlook window (1 November to mid-May)", "window_opens": opens.strftime("%Y-%m-%d")}
    p90 = cal["normal"]["p90"]
    recent = any(h[i] > 0 and h[i] > p90[i % len(p90)] for i in range(max(0, last - o["window_days"] + 1), last + 1))
    t = o["districts"][dist]
    if t["if_recent"][k] is None or t["if_quiet"][k] is None or t["clim"][k] is None:
        return {**base, "state": "no estimate for this week"}
    return {**base, "state": "on", "window_days": o["window_days"], "unusual_day_in_last_14_days": recent,
            "chance_of_unusual_day_next_14_days_pct": round(100 * (t["if_recent"] if recent else t["if_quiet"])[k]),
            "usual_chance_for_time_of_year_pct": round(100 * t["clim"][k])}


def harmonization_evidence(d: Data) -> dict:
    h = d.json("harmonization.json")
    out = {"sensor_change_season": "2012-13", "share_of_2012_jump_removed_pct": round(100 * (1 - h["seam"]["ratio"])), "chow_p_raw": _p_value(h["seam"]["chow_p_raw"]), "chow_p_harmonized": _p_value(h["seam"]["chow_p_harm"]),
           "loso_95pct_interval_coverage": round(h["loso_pooled"]["covered"]["p50"], 3), "loso_target": "0.90 to 0.97 (failed on the conservative side)",
           "provenance": d.prov("harmonization.json", FIRE)}
    for r in h.get("overlap", []):
        out[f"viirs_to_aqua_ratio_{r['period']}"] = {"raw": round(r["ratio_raw"]["p50"], 2), "harmonized": round(r["ratio_harm"]["p50"], 2), "seasons": r["seasons"]}
    return out



def kiln_seasons(d: Data, unit_id: str | None = None) -> dict:
    """Kiln working season from night lights for one area (unit_id) or the whole country (no unit_id)."""
    ka = d.json("kiln_activity.json")
    if ka is None:
        return {"error": "no kiln analysis in this data build"}
    block = ka.get("national") if unit_id is None else ka.get("areas", {}).get(unit_id)
    if block is None:
        return {"error": f"no kiln season for {unit_id}"}
    t = _typical_season(block.get("seasons", []))
    if t is None:
        return {"error": "no measured kiln season"}
    return {"area": unit_id or "Bangladesh (national)", "kiln_clusters": block["n_clusters"],
            "typical_season": {"starts": _when_text(t["onset"]), "busiest": _when_text(t["peak"]) if t["peak"] is not None else None,
                               "ends": _when_text(t["end"]), "length_days": math.floor(t["duration"] + 0.5), "seasons_used": t["seasons"]},
            "provenance": d.prov("kiln_activity.json", "Kiln Watch kiln activity from NASA Black Marble night lights, area-level")}


def national_trend(d: Data) -> dict:
    """The harmonized national fire series (Aqua-MODIS-equivalent units), from harmonization.json yearly."""
    h = d.json("harmonization.json")
    y = (h or {}).get("yearly") or []
    if not y:
        return {"error": "no national series in this data build"}
    p = max(y, key=lambda r: r["h"]["p50"])  # first wins ties
    return {"n_seasons": len(y), "first_season": {"season": y[0]["season"], "harmonized": y[0]["h"]["p50"]},
            "latest_season": {"season": y[-1]["season"], "harmonized": y[-1]["h"]["p50"], "range_95": [y[-1]["h"]["lo"], y[-1]["h"]["hi"]]},
            "peak_season": {"season": p["season"], "harmonized": p["h"]["p50"]},
            "units": "Aqua-MODIS-equivalent fire detections per season (harmonized)",
            "provenance": d.prov("harmonization.json", FIRE)}


TOOLS = [
    {"name": "find_area", "description": "Find Bangladesh districts and upazilas by English or Bangla name. Returns up to 5 matches with unit_id, names, level and division. Call this first to get a unit_id.",
     "input_schema": {"type": "object", "properties": {"name": {"type": "string", "description": "Area name, e.g. 'Rajshahi' or 'রাজশাহী'"}}, "required": ["name"], "additionalProperties": False}},
    {"name": "area_fire_calendar", "description": "The area's usual burning season from 23 years of harmonized NASA fire data: first, busiest and last month of a typical year, and the latest full season's length in days with its 95% interval.",
     "input_schema": {"type": "object", "properties": {"unit_id": {"type": "string"}}, "required": ["unit_id"], "additionalProperties": False}},
    {"name": "this_season", "description": "Live, provisional data for the area's district this season (from 1 July): the date the data run to and the number of unusual days (above that day's 90th-percentile normal) so far.",
     "input_schema": {"type": "object", "properties": {"unit_id": {"type": "string"}}, "required": ["unit_id"], "additionalProperties": False}},
    {"name": "two_week_outlook", "description": "Backtested chance (percent) of at least one unusual day in the district in the next 14 days, and the usual chance for that time of year. Runs 1 November to mid-May only.",
     "input_schema": {"type": "object", "properties": {"unit_id": {"type": "string"}}, "required": ["unit_id"], "additionalProperties": False}},
    {"name": "harmonization_evidence", "description": "Evidence that the MODIS-to-VIIRS correction works: share of the false 2012 jump removed, structural-break p-values, VIIRS/Aqua ratios before and after correction, and the interval coverage test.",
     "input_schema": {"type": "object", "properties": {}, "additionalProperties": False}},
    {"name": "kiln_seasons", "description": "When brick kilns usually operate, from NASA Black Marble night lights: the typical start, busiest time and end of the kiln season (early/mid/late month) and its length in days, as medians over the last 3 measured seasons, plus the number of kiln clusters. Give unit_id (from find_area) for a district; omit it for the whole country.",
     "input_schema": {"type": "object", "properties": {"unit_id": {"type": "string"}}, "additionalProperties": False}},
    {"name": "national_trend", "description": "The national harmonized fire series (Aqua-MODIS-equivalent detections per season): number of seasons, the first, latest (with its 95% range) and busiest season. Takes no arguments.",
     "input_schema": {"type": "object", "properties": {}, "additionalProperties": False}},
]
FUNCS = {"find_area": find_area, "area_fire_calendar": area_fire_calendar, "this_season": this_season,
         "two_week_outlook": two_week_outlook, "harmonization_evidence": harmonization_evidence,
         "kiln_seasons": kiln_seasons, "national_trend": national_trend}

_UNIT = re.compile(r"BD\d{2,10}")  # HDX COD-AB p-codes: anything else never reaches a file path


def _run(fn, data: Data, args: dict) -> dict:
    """Run one tool on model-supplied arguments; a bad argument or missing file becomes an error the model sees."""
    uid = args.get("unit_id")
    if "unit_id" in args and not (isinstance(uid, str) and _UNIT.fullmatch(uid)):
        return {"error": f"unit_id must be an area code such as BD3026 (from find_area), got {uid!r}"}
    try:
        return fn(data, **args)
    except Exception as e:  # noqa: BLE001 - reported to the model as a failed call, never raised out of the loop
        return {"error": f"{type(e).__name__}: {e}"}


_NUM = re.compile(r"(?<![\w.])-?\d[\d,]*(?:\.\d+)?")
_BN = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")


def numbers(text: str) -> set[float]:
    return {float(m.group().replace(",", "")) for m in _NUM.finditer(text.translate(_BN))}


def guard(answer: str, results: list[dict]) -> list[float]:
    """Numbers stated in the answer that no tool returned (empty = the answer passes)."""
    allowed = set().union(*(numbers(json.dumps(r, ensure_ascii=False)) for r in results)) if results else set()
    return sorted(n for n in numbers(answer) if n not in allowed)


def _declarations(tools: list[dict]) -> list[dict]:
    """TOOLS as Gemini function declarations (`parameters` is an OpenAPI-style schema: no additionalProperties)."""
    def schema(sc: dict) -> dict:
        out = {k: v for k, v in sc.items() if k != "additionalProperties"}
        if "properties" in out:
            out["properties"] = {k: schema(v) for k, v in out["properties"].items()}
        return out
    return [{"functionDeclarations": [{"name": t["name"], "description": t["description"], "parameters": schema(t["input_schema"])}
                                      for t in tools]}]


GEMINI_TOOLS = _declarations(TOOLS)


def request(contents: list[dict]) -> dict:
    """One generateContent body: instructions as systemInstruction, the model free to answer or call a tool."""
    return {"systemInstruction": {"parts": [{"text": SYSTEM}]}, "contents": contents, "tools": GEMINI_TOOLS,
            "toolConfig": {"functionCallingConfig": {"mode": "AUTO"}}, "generationConfig": {"maxOutputTokens": 4000}}


def _retry_delay(r, default: float, cap: float = 60.0) -> float:
    """Seconds to wait before retrying: Gemini's RetryInfo.retryDelay (e.g. "36s") on a rate limit, else `default`."""
    try:
        for d in r.json().get("error", {}).get("details", []):
            if d.get("@type", "").endswith("RetryInfo") and str(d.get("retryDelay", "")).endswith("s"):
                return min(float(d["retryDelay"][:-1]) + 1, cap)
    except ValueError:
        pass
    return min(default, cap)


def gemini_client(api_key: str | None = None, timeout: int = 60):
    """POST one request body to Gemini; the key travels in a header, never in a URL or a log line."""
    import requests

    key = api_key or C.GEMINI_API_KEY
    if not key:
        raise RuntimeError("GEMINI_API_KEY is empty. Put it in .env (see .env.example).")
    s = requests.Session()

    def generate(body: dict) -> dict:
        import time

        for attempt in range(5):  # bounded: rate limits and brief outages get four more tries, nothing else does
            r = s.post(f"{GEMINI}/{MODEL}:generateContent", headers={"x-goog-api-key": key}, json=body, timeout=timeout)
            if r.status_code not in (429, 500, 503) or attempt == 4:
                break
            time.sleep(_retry_delay(r, default=2 * 2**attempt))
        if not r.ok:
            raise RuntimeError(f"Gemini HTTP {r.status_code}: {r.text[:200]}")
        return r.json()

    return generate


def ask(question: str, client=None, data: Data | None = None) -> dict:
    """Bounded tool-use loop. Returns {question, answer|None, blocked, unsupported, tools: [{name, input, result}]}.

    `client` takes a request body and returns Gemini's JSON reply (gemini_client(); tests pass a scripted one)."""
    client = client or gemini_client()
    data = data or Data()
    contents, calls = [{"role": "user", "parts": [{"text": question}]}], []
    for _ in range(MAX_STEPS):
        r = client(request(contents))
        cand = (r.get("candidates") or [{}])[0]
        if (r.get("promptFeedback") or {}).get("blockReason") or cand.get("finishReason") in REFUSALS:
            return {"question": question, "answer": None, "blocked": True, "reason": "refusal", "tools": calls}
        parts = (cand.get("content") or {}).get("parts") or []
        uses = [p["functionCall"] for p in parts if "functionCall" in p]
        if not uses:
            text = "".join(p.get("text", "") for p in parts if not p.get("thought")).strip()
            if not text:
                return {"question": question, "answer": None, "blocked": True, "reason": f"no answer ({cand.get('finishReason')})", "tools": calls}
            bad = guard(text, [c["result"] for c in calls])
            return {"question": question, "answer": None if bad else text, "blocked": bool(bad), "unsupported": bad, "tools": calls}
        contents.append(cand["content"])  # the whole model turn: Gemini 3 needs its thought signatures back
        results = []
        for u in uses:
            args = u.get("args") or {}
            fn = FUNCS.get(u.get("name"))
            res = _run(fn, data, args) if fn else {"error": f"unknown tool {u.get('name')}"}
            calls.append({"name": u.get("name"), "input": args, "result": res})
            results.append({"functionResponse": {**({"id": u["id"]} if u.get("id") else {}), "name": u.get("name"), "response": res}})
        contents.append({"role": "user", "parts": results})
    return {"question": question, "answer": None, "blocked": True, "reason": f"step limit {MAX_STEPS}", "tools": calls}


def build_cache(src: Path = C.WEB_DATA, client=None, out: Path | None = None) -> dict:
    """Answer the demo questions once and write them to `ask.json` in the export, for the offline site."""
    from .export import dump_json

    data = Data(src)
    client = client or gemini_client()
    items = [{**ask(q, client, data), "lang": lang} for q, lang in DEMO_QUESTIONS]
    payload = {"model": MODEL, "generated_at": pd.Timestamp.now(tz="UTC").isoformat(timespec="seconds"),
               "data_build": (data.json("meta.json") or {}).get("git_sha"), "answers": items}
    dump_json(payload, Path(out or Path(src) / "ask.json"))
    log.info("ask cache: %d answers, %d blocked", len(items), sum(i["blocked"] for i in items))
    return payload
