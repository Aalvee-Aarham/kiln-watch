"""The news item store (docs/news_plan.md §5): the one interface between `news` (writes it) and `news-pair` (reads it).

One JSON file, data/news/store.json, published as the release asset `news-current`. It holds every checked story the
model has read, each outlet's coverage, and the id of every link already processed, so no article is fetched or
extracted twice. It never holds article text, and it holds no satellite number: `news-pair` adds those at deploy time.
"""
from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from . import config as C

STORE_PATH = C.NEWS_DIR / "store.json"
VERSION = 1
NATIONAL = "BGD"  # stories about Bangladesh as a whole; the country-level unit_id of aoi/south_asia.geojson
KINDS_PUBLISHED = ("burning", "enforcement", "kilns_operating", "air_health")
KINDS = KINDS_PUBLISHED + ("policy",)  # policy stories feed the Timeline review list, never the page
LANGS = ("en", "bn")
ITEM_KEYS = {  # the stored item's schema: key -> type
    "news_id": str, "url": str, "source": str, "outlet": str, "lang": str, "title": str,
    "published_date_local": str, "event_date_local": str, "event_date_stated": bool, "season": str,
    "kind": str, "unit_ids": list, "claim_en": str, "claim_bn": str, "quote": str,
    "text_sha256": str, "extracted_at": str, "model": str,
}
# unit_ids are ordered by first mention in the article; the satellite parts of a story use unit_ids[0].


def canonical_url(url: str) -> str:
    """One form per article: https, lower-case host without 'www.', no query or fragment, no trailing slash."""
    p = urlsplit(url.strip())
    host = p.netloc.lower()
    host = host[4:] if host.startswith("www.") else host
    return urlunsplit(("https", host, p.path.rstrip("/") or "/", "", ""))


def news_id(url: str) -> str:
    """First 12 hex digits of sha256(canonical URL)."""
    return hashlib.sha256(canonical_url(url).encode("utf-8")).hexdigest()[:12]


def empty() -> dict:
    return {"version": VERSION, "updated_at": None, "model": C.NEWS_MODEL, "items": [], "coverage": {}, "dropped": {}, "seen": {}}


def load(path: Path | None = None) -> dict:
    """The store at `path` (default data/news/store.json); an empty store when the file does not exist yet."""
    p = Path(path or STORE_PATH)
    if not p.exists():
        return empty()
    store = json.loads(p.read_text(encoding="utf-8"))
    if store.get("version") != VERSION:
        raise ValueError(f"{p}: store version {store.get('version')!r}, expected {VERSION}")
    return store


def save(store: dict, path: Path | None = None) -> None:
    """Atomic write (*.tmp, then rename). Items are sorted so the file diffs cleanly between runs."""
    p = Path(path or STORE_PATH)
    p.parent.mkdir(parents=True, exist_ok=True)
    store["items"] = sorted(store["items"], key=lambda i: (i["published_date_local"], i["news_id"]))
    store["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(store, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
    tmp.replace(p)


def validate_item(item: dict) -> list[str]:
    """Schema problems of one stored item; [] means valid. `news` runs this over the whole store as a stage check."""
    errs = [f"missing {k}" for k in ITEM_KEYS if k not in item]
    errs += [f"{k} is {type(item[k]).__name__}" for k, t in ITEM_KEYS.items() if k in item and not isinstance(item[k], t)]
    if errs:
        return errs
    if item["news_id"] != news_id(item["url"]):
        errs.append("news_id does not match url")
    if item["kind"] not in KINDS:
        errs.append(f"kind {item['kind']!r}")
    if item["lang"] not in LANGS:
        errs.append(f"lang {item['lang']!r}")
    if not item["unit_ids"] or not all(isinstance(u, str) and u for u in item["unit_ids"]):
        errs.append("unit_ids empty or not strings")
    elif NATIONAL in item["unit_ids"] and len(item["unit_ids"]) > 1:
        errs.append("a national story is also tagged with districts")
    elif len(set(item["unit_ids"])) != len(item["unit_ids"]):
        errs.append("unit_ids repeat")
    for k in ("published_date_local", "event_date_local"):
        try:
            date.fromisoformat(item[k])
        except ValueError:
            errs.append(f"{k} {item[k]!r}")
    if errs:
        return errs
    if item["event_date_local"] > item["published_date_local"]:
        errs.append("event after publication")
    from .grid import season_of

    if item["season"] != season_of(item["event_date_local"]):
        errs.append(f"season {item['season']!r} is not the event date's season")
    return errs


def merge(store: dict, items: list[dict]) -> int:
    """Add items whose news_id is new and mark them seen; returns how many were added. A repeat merge adds nothing."""
    have = {i["news_id"] for i in store["items"]}
    added = 0
    for it in items:
        if it["news_id"] in have:
            continue
        store["items"].append(it)
        store["seen"][it["news_id"]] = "kept"
        have.add(it["news_id"])
        added += 1
    return added


def mark_dropped(store: dict, url: str, reason: str) -> None:
    """A definitive drop (a guard failure, not relevant, policy): never fetched again, counted by reason.
    Transient failures (timeouts, 5xx, rate limits) must not be marked: the link is retried on a later run."""
    nid = news_id(url)
    if nid in store["seen"]:
        return
    store["seen"][nid] = reason
    store["dropped"][reason] = store["dropped"].get(reason, 0) + 1


def is_seen(store: dict, url: str) -> bool:
    return news_id(url) in store["seen"]


def coverage(store: dict, source: str) -> dict:
    """One outlet's coverage record, created on first use. Dates are YYYY-MM-DD (local)."""
    return store["coverage"].setdefault(source, {"read_back_to": None, "last_scanned": None, "history_cursor": None, "gaps": []})
