"""Ask Kiln Watch (docs/roadmap.md F7): Claude answers questions by calling the project's own functions.

The model retrieves, orchestrates and explains; it never computes. Every number in an answer must appear in a tool
result (`guard`), or the answer is blocked. Tools read only the public export, so an answer can hold nothing the
website does not already publish. Answers to the demo questions are cached to `ask.json` for offline use.
"""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path

import numpy as np
import pandas as pd

from . import config as C

log = logging.getLogger("kilnwatch.ask")
MODEL = "claude-opus-5-5"
MAX_STEPS = 6  # hard cap on model calls per question (no unbounded loops)
SITE = "https://aalvee-aarham.github.io/kiln-watch"
MONTHS = ["July", "August", "September", "October", "November", "December", "January", "February", "March", "April", "May", "June"]
DEMO_QUESTIONS = [
    ("When is burning season in Rajshahi, and is this year unusual so far?", "en"),
    ("Is burning in Dhaka district above normal right now, and what about the next two weeks?", "en"),
    ("Did the correction really remove the 2012 jump in fire counts?", "en"),
    ("নওগাঁ জেলায় কখন আগুন বেশি জ্বলে?", "bn"),
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


def area_fire_calendar(d: Data, unit_id: str) -> dict:
    rel = f"calendar/{unit_id}.json"
    cal = d.json(rel)
    if cal is None:
        return {"error": f"no calendar for {unit_id}"}
    seasons = [s for s in cal["seasons"] if s.get("duration")]
    last = seasons[-1] if seasons else None
    n_days = max(cal["days"][-1] if cal["days"] else 0, max((e for _, e in cal["nodata"]), default=0)) + 1
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
    return {"district": dist, "season": nrt["season"], "data_to": as_of.strftime("%Y-%m-%d"), "unusual_days_so_far": nrt["districts"][dist]["above_p90_days"],
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
    k = (as_of - opens).days // o["step_days"]
    base = {"district": dist, "data_to": as_of.strftime("%Y-%m-%d"), "provenance": d.prov("outlook.json", "Kiln Watch outlook, backtested on " + FIRE),
            "backtest_brier_skill": o["backtest"]["brier_skill"]}
    if k < 0 or k >= o["weeks"]:
        return {**base, "state": "outside the outlook window (1 November to mid-May)", "window_opens": opens.strftime("%Y-%m-%d")}
    p90 = cal["normal"]["p90"]
    recent = any(h[i] > 0 and h[i] > p90[i % len(p90)] for i in range(max(0, last - o["window_days"] + 1), last + 1))
    t = o["districts"][dist]
    return {**base, "state": "on", "window_days": o["window_days"], "unusual_day_in_last_14_days": recent,
            "chance_of_unusual_day_next_14_days_pct": round(100 * (t["if_recent"] if recent else t["if_quiet"])[k]),
            "usual_chance_for_time_of_year_pct": round(100 * t["clim"][k])}


def harmonization_evidence(d: Data) -> dict:
    h = d.json("harmonization.json")
    out = {"sensor_change_season": "2012-13", "share_of_2012_jump_removed_pct": round(100 * (1 - h["seam"]["ratio"])), "chow_p_raw": h["seam"]["chow_p_raw"], "chow_p_harmonized": h["seam"]["chow_p_harm"],
           "loso_95pct_interval_coverage": round(h["loso_pooled"]["covered"]["p50"], 3), "loso_target": "0.90 to 0.97 (failed on the conservative side)",
           "provenance": d.prov("harmonization.json", FIRE)}
    for r in h.get("overlap", []):
        out[f"viirs_to_aqua_ratio_{r['period']}"] = {"raw": round(r["ratio_raw"]["p50"], 2), "harmonized": round(r["ratio_harm"]["p50"], 2), "seasons": r["seasons"]}
    return out


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
]
FUNCS = {"find_area": find_area, "area_fire_calendar": area_fire_calendar, "this_season": this_season,
         "two_week_outlook": two_week_outlook, "harmonization_evidence": harmonization_evidence}

_NUM = re.compile(r"(?<![\w.])-?\d[\d,]*(?:\.\d+)?")
_BN = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")


def numbers(text: str) -> set[float]:
    return {float(m.group().replace(",", "")) for m in _NUM.finditer(text.translate(_BN))}


def guard(answer: str, results: list[dict]) -> list[float]:
    """Numbers stated in the answer that no tool returned (empty = the answer passes)."""
    allowed = set().union(*(numbers(json.dumps(r, ensure_ascii=False)) for r in results)) if results else set()
    return sorted(n for n in numbers(answer) if n not in allowed)


def ask(question: str, client=None, data: Data | None = None) -> dict:
    """Bounded tool-use loop. Returns {question, answer|None, blocked, unsupported, tools: [{name, input, result}]}."""
    if client is None:
        import anthropic

        client = anthropic.Anthropic()
    data = data or Data()
    messages, calls = [{"role": "user", "content": question}], []
    for _ in range(MAX_STEPS):
        r = client.beta.messages.create(model=MODEL, max_tokens=4000, system=SYSTEM, tools=TOOLS, messages=messages,
                                        output_config={"effort": "low"}, betas=["server-side-fallback-2026-07-01"], fallbacks="default")
        if r.stop_reason == "refusal":
            return {"question": question, "answer": None, "blocked": True, "reason": "refusal", "tools": calls}
        uses = [b for b in r.content if b.type == "tool_use"]
        if not uses:
            text = "".join(b.text for b in r.content if b.type == "text").strip()
            bad = guard(text, [c["result"] for c in calls])
            return {"question": question, "answer": None if bad else text, "blocked": bool(bad), "unsupported": bad, "tools": calls}
        messages.append({"role": "assistant", "content": r.content})
        results = []
        for u in uses:
            fn = FUNCS.get(u.name)
            res = fn(data, **u.input) if fn else {"error": f"unknown tool {u.name}"}
            calls.append({"name": u.name, "input": u.input, "result": res})
            results.append({"type": "tool_result", "tool_use_id": u.id, "content": json.dumps(res, ensure_ascii=False), **({"is_error": True} if "error" in res else {})})
        messages.append({"role": "user", "content": results})
    return {"question": question, "answer": None, "blocked": True, "reason": f"step limit {MAX_STEPS}", "tools": calls}


def build_cache(src: Path = C.WEB_DATA, client=None, out: Path | None = None) -> dict:
    """Answer the demo questions once and write them to `ask.json` in the export, for the offline site."""
    from .export import _dump

    data = Data(src)
    items = [{**ask(q, client, data), "lang": lang} for q, lang in DEMO_QUESTIONS]
    payload = {"model": MODEL, "generated_at": pd.Timestamp.now(tz="UTC").isoformat(timespec="seconds"),
               "data_build": (data.json("meta.json") or {}).get("git_sha"), "answers": items}
    _dump(payload, Path(out or Path(src) / "ask.json"))
    log.info("ask cache: %d answers, %d blocked", len(items), sum(i["blocked"] for i in items))
    return payload
