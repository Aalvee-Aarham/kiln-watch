"""`python -m kilnwatch news`: find, read and check newspaper stories (docs/news_plan.md §5.1).

Discover links in the papers' own sitemaps -> filter (site, date, seen, blocklist, keywords; no network, no AI) ->
fetch the article politely -> gazetteer -> excerpt -> Gemini extraction -> guards in code -> news store.
Daily runs read the news sitemaps and the last 2 days of the dated archives, then spend any model-call budget left on
the history, newest first, back to NEWS_HISTORY_FROM. Article text never leaves memory; only its sha256 is stored.
"""
from __future__ import annotations

import csv
import hashlib
import logging
import shutil
import subprocess
import tempfile
from collections import Counter
from dataclasses import dataclass, replace
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from . import config as C
from . import news_store as S
from .news_extract import (
    Gazetteer,
    Keywords,
    ModelOutputInvalid,
    ModelStop,
    ModelTransient,
    QuotaExhausted,
    air_story_ok,
    configured_providers,
    excerpt,
    extract,
    guard,
    national_ok,
    parse_page,
    reset_providers,
    slug_text,
)
from .news_sources import Blocked, CapReached, Entry, Fetcher, FetchError, Gone, RobotsDisallowed, Source, load_sources, parse_sitemap, site_check, today_local

log = logging.getLogger("kilnwatch.news")

BLOCKLIST_CSV = C.STATIC / "news_blocklist.csv"
RELEASE_TAG = "news-current"
RELEASE_ASSET = "news-store.json"
DAILY_ARCHIVE_DAYS = 2  # daily runs also read this many days of each dated archive, to catch a missed run
MAX_HISTORY_STEPS_PER_RUN = 120  # archive units (a day, a month or a year) per run, over all history outlets
MAX_CHILD_SITEMAPS = 5  # when a news sitemap is an index, how many of its newest children to read
GAPS_KEPT = 200
CHECKPOINT_EVERY = 10  # save the store after this many processed links, so a crash loses little model work
DRY_RUN_SHOWN = 15
HISTORY_FROM = date.fromisoformat(C.NEWS_HISTORY_FROM)
ARCHIVE_FROM = {"dailystar_yearly": HISTORY_FROM, "dhakatribune_monthly": date(2013, 4, 1),
                "samakal_daily": date(2020, 1, 1)}
DAILYSTAR_INDEX = "https://www.thedailystar.net/sitemap.xml"
DHAKATRIBUNE_MONTH = "https://www.dhakatribune.com/{y:04d}-{m:02d}-01.xml"
SAMAKAL_DAY = "https://samakal.com/sitemap/sitemap-daily-{d}.xml"
UNRESOLVED = ("stopped", "cap", "blocked", "transient")


@dataclass(frozen=True)
class Link:
    url: str
    source: Source
    title: str
    date: date | None


def make_fetcher() -> Fetcher:
    return Fetcher()


def load_blocklist(path: Path | None = None) -> set[str]:
    p = Path(path or BLOCKLIST_CSV)
    if not p.exists():
        return set()
    with open(p, encoding="utf-8", newline="") as f:
        return {S.news_id(r["url"]) for r in csv.DictReader(f) if (r.get("url") or "").strip()}


class Run:
    """State of one run: the store, the caps and budget, and which outlets are skipped."""

    def __init__(self, store: dict, sources: list[Source], fetcher: Fetcher, keywords: Keywords, gaz: Gazetteer,
                 blocklist: set[str], today: date, budget: int, dry_run: bool = False):
        self.store, self.sources, self.fetcher = store, sources, fetcher
        self.keywords, self.gaz, self.blocklist = keywords, gaz, blocklist
        self.today, self.budget, self.dry_run = today, budget, dry_run
        self.calls = 0
        self.stop: str | None = None
        self.excluded: dict[str, str] = {}  # source key -> reason it is skipped this run
        self.stats: Counter = Counter()
        self.processed = 0
        self.ds_index: dict[int, list[str]] | None = None

    @property
    def active(self) -> list[Source]:
        return [s for s in self.sources if s.status == "active"]

    def gap(self, s: Source, reason: str) -> None:
        if self.dry_run:
            return
        gaps = S.coverage(self.store, s.key)["gaps"]
        g = {"date": self.today.isoformat(), "reason": reason}
        if g not in gaps:
            gaps.append(g)
        del gaps[:-GAPS_KEPT]

    def exclude(self, s: Source, reason: str) -> None:
        if s.key not in self.excluded:
            log.warning("news: skipping %s for this run: %s", s.key, reason)
            self.excluded[s.key] = reason
            self.gap(s, reason)

    def same_outlet(self, s: Source):
        return lambda u: site_check(u, self.sources) is s


# --- discovery ---------------------------------------------------------------

def outlet_ok(run: Run, s: Source) -> bool:
    """robots.txt reachable, Google-Extended not disallowed (the publisher's AI opt-out), not blocked this run."""
    if s.key in run.excluded:
        return False
    host = s.news_sitemap.split("/")[2].lower()
    run.fetcher.robots(host)
    st = run.fetcher.robots_status.get(host, "")
    if st.startswith(("unreachable", "refused")):
        run.exclude(s, f"robots.txt {st}")
        return False
    if run.fetcher.google_extended_disallowed(host):
        run.exclude(s, "robots.txt disallows Google-Extended")
        return False
    return True


def read_sitemap(run: Run, s: Source, url: str, follow_index: bool = False) -> list[Entry] | None:
    """Entries of one sitemap (None on failure, with the gap recorded). A 403/429 skips the outlet for the run."""
    try:
        entries = parse_sitemap(run.fetcher.get(url, "sitemap", same_site=run.same_outlet(s)))
    except Blocked as e:
        run.exclude(s, f"{e} on {url}")
        return None
    except CapReached:
        run.stats["sitemap_cap"] += 1
        return None
    except RobotsDisallowed:
        run.gap(s, f"robots.txt disallows {url}")
        return None
    except FetchError as e:
        run.gap(s, f"{type(e).__name__} {e} on {url}")
        return None
    except Exception as e:  # noqa: BLE001 - unreadable XML from one outlet must not stop the others
        run.gap(s, f"unreadable sitemap {url}: {type(e).__name__}")
        return None
    if follow_index and entries and all(e.is_index for e in entries):
        kids = sorted(entries, key=lambda e: e.date or date.min, reverse=True)[:MAX_CHILD_SITEMAPS]
        out: list[Entry] = []
        for k in kids:
            got = read_sitemap(run, s, k.loc)
            out += got or []
        return out
    return [e for e in entries if not e.is_index]


def dailystar_index(run: Run, s: Source) -> dict[int, list[str]] | None:
    """Year -> that year's archive sitemaps, in file order (sitemap-YYYY-1.xml, -2.xml, ...)."""
    if run.ds_index is None:
        import re

        try:
            raw = parse_sitemap(run.fetcher.get(DAILYSTAR_INDEX, "sitemap", same_site=run.same_outlet(s)))
        except Blocked as e:
            run.exclude(s, f"{e} on {DAILYSTAR_INDEX}")
            return None
        except Exception as e:  # noqa: BLE001
            run.gap(s, f"archive index unreadable: {type(e).__name__}")
            return None
        idx: dict[int, list[tuple[int, str]]] = {}
        for e in raw:
            m = re.search(r"/sitemaps/(\d{4})/sitemap-\1-(\d+)\.xml$", e.loc)
            if m:
                idx.setdefault(int(m.group(1)), []).append((int(m.group(2)), e.loc))
        run.ds_index = {y: [u for _, u in sorted(v)] for y, v in idx.items()}
    return run.ds_index


def archive_unit(run: Run, s: Source, day: date, daily: bool = False) -> tuple[date, date, list[str]] | None:
    """The archive unit holding `day`: (first date, last date, sitemap URLs)."""
    if s.archive == "samakal_daily":
        return day, day, [SAMAKAL_DAY.format(d=day.isoformat())]
    if s.archive == "dhakatribune_monthly":
        start = day.replace(day=1)
        end = (start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        return start, end, [DHAKATRIBUNE_MONTH.format(y=day.year, m=day.month)]
    if s.archive == "dailystar_yearly":
        idx = dailystar_index(run, s)
        if idx is None:
            return None
        urls = idx.get(day.year, [])
        return date(day.year, 1, 1), date(day.year, 12, 31), (urls[-1:] if daily else urls)
    return None


def archive_links(run: Run, s: Source, start: date, end: date, urls: list[str], lo: date, hi: date) -> list[Link] | None:
    """Links of an archive unit dated in [lo, hi]. Dates are the sitemap's lastmod, clamped into the unit (a
    yearly file can list an article updated later); an entry without a date takes the unit's first day."""
    out: list[Link] = []
    for u in urls:
        got = read_sitemap(run, s, u)
        if got is None:
            return None
        for e in got:
            d = min(max(e.date or start, start), end)
            if lo <= d <= hi:
                out.append(Link(e.loc, s, e.title, d))
    return out


def discover_daily(run: Run) -> list[Link]:
    links: list[Link] = []
    for s in run.active:
        if not outlet_ok(run, s):
            continue
        entries = read_sitemap(run, s, s.news_sitemap, follow_index=True)
        if entries is None:
            continue
        cov = S.coverage(run.store, s.key)
        if not run.dry_run:
            cov["last_scanned"] = run.today.isoformat()
            dates = [e.date for e in entries if e.date]
            if dates:
                oldest = max(min(dates), HISTORY_FROM).isoformat()
                cov["read_back_to"] = min(cov["read_back_to"] or oldest, oldest)
        links += [Link(e.loc, s, e.title, e.date) for e in entries]
        if s.archive != "none" and s.key not in run.excluded:
            lo = run.today - timedelta(days=DAILY_ARCHIVE_DAYS - 1)
            for d in sorted({lo + timedelta(days=i) for i in range(DAILY_ARCHIVE_DAYS)}, reverse=True):
                unit = archive_unit(run, s, d, daily=True)
                if unit is None:
                    break
                if s.archive != "samakal_daily" and d != run.today and unit[0] <= run.today <= unit[1]:
                    continue  # the same monthly or yearly file as today's
                got = archive_links(run, s, *unit, lo=lo, hi=run.today)
                links += got or []
    return links


def filter_links(run: Run, links: list[Link]) -> list[Link]:
    """Site check, date range, not seen, not blocklisted, keyword on headline or URL slug. No network, no AI."""
    out, ids = [], set()
    for ln in links:
        src = site_check(ln.url, run.sources)
        if src is None:
            run.stats["off_site"] += 1
            continue
        if src.key in run.excluded:
            continue
        if ln.date is not None and not (HISTORY_FROM <= ln.date <= run.today):
            run.stats["out_of_range"] += 1
            continue
        nid = S.news_id(ln.url)
        if nid in ids or S.is_seen(run.store, ln.url) or nid in run.blocklist:
            continue
        if not run.keywords.link_matches(ln.title, ln.url):
            continue
        ids.add(nid)
        out.append(replace(ln, source=src))
    return sorted(out, key=lambda x: (x.date or run.today, x.url), reverse=True)


# --- one article -------------------------------------------------------------

def drop(run: Run, ln: Link, reason: str) -> str:
    S.mark_dropped(run.store, ln.url, reason)
    run.stats[f"dropped:{reason}"] += 1
    return f"dropped:{reason}"


def process(run: Run, ln: Link) -> str:
    """Fetch, read and check one link. Returns 'kept', 'dropped:<reason>' (marked seen), or an unresolved state
    ('stopped', 'cap', 'blocked', 'transient', 'robots'), which is not marked seen and is retried later."""
    if run.stop:
        return "stopped"
    if ln.source.key in run.excluded:
        return "blocked"
    if run.calls >= run.budget:
        run.stop = f"model-call budget of {run.budget} used"
        return "stopped"
    try:
        body = run.fetcher.get(ln.url, "article", same_site=lambda u: site_check(u, run.sources) is not None)
    except Blocked as e:
        run.exclude(ln.source, str(e))
        return "blocked"
    except CapReached:
        run.stats["article_cap"] += 1
        return "cap"
    except RobotsDisallowed:
        run.stats["robots_disallowed"] += 1
        return "robots"
    except FetchError as e:
        if e.definitive:
            return drop(run, ln, "fetch_gone" if isinstance(e, Gone) else "fetch_refused")
        run.stats["transient"] += 1
        return "transient"
    page = parse_page(body.decode("utf-8", errors="replace"))
    del body
    text = "\n".join(page.paragraphs)  # in memory only: never logged, written or stored
    if not text:
        return drop(run, ln, "no_text")
    title = page.title or ln.title
    if not title:
        return drop(run, ln, "no_title")
    pub = page.published or ln.date
    if pub is None:
        return drop(run, ln, "no_date")
    if not (HISTORY_FROM <= pub <= run.today):
        return drop(run, ln, "outside_range")
    cands = run.gaz.find(title + "\n" + text)
    allow_nat = not cands and national_ok(title + "\n" + text)
    if not cands and not allow_nat:
        return drop(run, ln, "no_place")
    ex = excerpt(title, page.paragraphs, run.keywords, run.gaz, cands)
    allowed = cands or [S.NATIONAL]
    run.calls += 1
    try:
        out = extract(ex, allowed, {u: run.gaz.label(u) for u in allowed}, pub)
    except QuotaExhausted:
        run.stop = "model quota (429)"
        return "stopped"
    except ModelStop as e:
        run.stop = f"model error: {e}"
        return "stopped"
    except ModelTransient:
        run.stats["transient"] += 1
        return "transient"
    except ModelOutputInvalid:
        return drop(run, ln, "schema_invalid")
    model = out.pop("_model", C.NEWS_MODEL)
    fields, reason = guard(out, ex, cands, allow_nat, pub, run.today)
    if reason:
        return drop(run, ln, reason)
    item = {"news_id": S.news_id(ln.url), "url": ln.url, "source": ln.source.key, "outlet": ln.source.outlet,
            "lang": ln.source.lang, "title": title, "published_date_local": pub.isoformat(), **fields,
            "text_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
            "extracted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "model": model}
    if S.validate_item(item):
        return drop(run, ln, "schema_invalid")
    S.merge(run.store, [item])
    run.stats["kept"] += 1
    return "kept"


def process_all(run: Run, links: list[Link]) -> list[str]:
    out = []
    for ln in links:
        st = process(run, ln)
        out.append(st)
        run.processed += 1
        if run.processed % CHECKPOINT_EVERY == 0:
            checkpoint(run)
        if run.stop:
            break
    return out


# --- history -----------------------------------------------------------------

def initial_cursor(today: date) -> date:
    """Before any history: everything from the dates the daily run reads is covered by the daily run."""
    return today - timedelta(days=DAILY_ARCHIVE_DAYS - 1)


def history_step(run: Run, s: Source) -> str:
    """Read one archive unit just before the outlet's cursor, newest first, and move the cursor back to the newest
    link still unresolved (or to the unit's start). Returns 'advanced', 'stalled' or 'done'."""
    cov = S.coverage(run.store, s.key)
    floor = max(HISTORY_FROM, ARCHIVE_FROM[s.archive])
    cursor = date.fromisoformat(cov["history_cursor"]) if cov["history_cursor"] else initial_cursor(run.today)
    if cursor <= floor:
        return "done"
    day = cursor - timedelta(days=1)
    unit = archive_unit(run, s, day)
    if unit is None:
        return "stalled"
    lo = max(unit[0], floor)
    links = archive_links(run, s, *unit, lo=lo, hi=day)
    if links is None:
        return "stalled"
    cands = filter_links(run, links)
    if run.dry_run:
        show(f"history {s.key} {lo}..{day}", cands)
        return "stalled"
    states = process_all(run, cands)
    states += ["stopped"] * (len(cands) - len(states))  # not reached: unresolved
    first = next((ln for ln, st in zip(cands, states) if st in UNRESOLVED), None)
    new = min((first.date or day) + timedelta(days=1) if first else lo, cursor)  # never forwards
    cov["history_cursor"] = new.isoformat()
    cov["read_back_to"] = min(cov["read_back_to"] or new.isoformat(), new.isoformat())
    return "advanced" if new < cursor else "stalled"


def history(run: Run) -> None:
    """Round-robin over the archive outlets, one unit per outlet per turn, until the budget, the caps or
    MAX_HISTORY_STEPS_PER_RUN stop it, or every outlet reaches NEWS_HISTORY_FROM."""
    outlets = [s for s in run.active if s.archive != "none"]
    live = [s for s in outlets if outlet_ok(run, s)]
    steps = 0
    while live and steps < MAX_HISTORY_STEPS_PER_RUN and not run.stop:
        for s in list(live):
            if steps >= MAX_HISTORY_STEPS_PER_RUN or run.stop:
                break
            steps += 1
            if s.key in run.excluded or history_step(run, s) != "advanced":
                live.remove(s)
    log.info("news history: %d steps; cursors %s", steps,
             {s.key: S.coverage(run.store, s.key)["history_cursor"] for s in outlets})


# --- store -------------------------------------------------------------------

def apply_air_rule(store: dict) -> int:
    """Drop stored air_health stories whose quote names no burning source (the rule came after they were stored)."""
    out = [i for i in store["items"] if not air_story_ok(i["kind"], i["quote"])]
    for i in out:
        store["items"].remove(i)
        store["seen"][i["news_id"]] = "not_relevant"
        store["dropped"]["not_relevant"] = store["dropped"].get("not_relevant", 0) + 1
    return len(out)


def stage_check(store: dict) -> None:
    """Every stored item passes validate_item; fail loudly otherwise."""
    bad = {i.get("news_id", "?"): S.validate_item(i) for i in store["items"]}
    bad = {k: v for k, v in bad.items() if v}
    if bad:
        raise AssertionError(f"news store fails its stage check: {dict(list(bad.items())[:5])}")


def checkpoint(run: Run) -> None:
    if run.dry_run:
        return
    stage_check(run.store)
    S.save(run.store)


# --- flags -------------------------------------------------------------------

def show(label: str, links: list[Link]) -> None:
    print(f"\n{label}: {len(links)} would be fetched")
    for ln in links[:DRY_RUN_SHOWN]:
        print(f"  {ln.date or '????-??-??'}  {ln.source.key:<13} {(ln.title or slug_text(ln.url))[:110]}")
    if len(links) > DRY_RUN_SHOWN:
        print(f"  ... and {len(links) - DRY_RUN_SHOWN} more")


def do_check_sources(sources: list[Source], fetcher: Fetcher, today: date) -> int:
    """robots.txt, Google-Extended and feed reachability per outlet; no article fetches, no AI."""
    from tabulate import tabulate

    store = S.empty()
    run = Run(store, sources, fetcher, Keywords([]), None, set(), today, 0, dry_run=True)  # type: ignore[arg-type]
    rows = []
    for s in sources:
        if s.status != "active":
            rows.append([s.key, s.lang, "excluded", "", "", "", "", s.reason])
            continue
        host = s.news_sitemap.split("/")[2].lower()
        fetcher.robots(host)
        robots = fetcher.robots_status.get(host, "?")
        gext = "disallowed" if fetcher.google_extended_disallowed(host) else "allowed"
        feed_ok = "yes" if fetcher.allowed(s.news_sitemap) else "NO"
        entries = read_sitemap(run, s, s.news_sitemap, follow_index=True) if feed_ok == "yes" else None
        if entries is None:
            feed = "failed: " + "; ".join(g["reason"] for g in store["coverage"].get(s.key, {}).get("gaps", [])) \
                if s.key not in run.excluded else f"failed: {run.excluded[s.key]}"
            feed = feed if feed != "failed: " else "failed"
        else:
            dates = [e.date for e in entries if e.date]
            on = sum(site_check(e.loc, sources) is not None for e in entries)
            span = f"{min(dates)}..{max(dates)}" if dates else "no dates"
            feed = f"{len(entries)} links ({on} on-site), {sum(bool(e.title) for e in entries)} titles, {span}"
        arch = ""
        if s.archive != "none" and s.key not in run.excluded:
            unit = archive_unit(run, s, today - timedelta(days=1), daily=True)
            got = archive_links(run, s, *unit, lo=unit[0], hi=unit[1]) if unit else None
            arch = f"{len(got)} links in {unit[0]}..{unit[1]}" if got is not None else "failed"
            if s.archive == "dailystar_yearly" and run.ds_index:
                arch += f"; index years {min(run.ds_index)}-{max(run.ds_index)}"
        rows.append([s.key, s.lang, robots, gext, feed_ok, feed, arch, s.reason])
    print(tabulate(rows, headers=["source", "lang", "robots.txt", "Google-Extended", "feed allowed", "news sitemap",
                                  "archive (yesterday's unit)", "note"]))
    return 0


def do_policy_review(store: dict) -> int:
    items = [i for i in store["items"] if i["kind"] == "policy"]
    print(f"{len(items)} policy stories (for a person to add, with sources, to data/static/policy_events.csv)")
    for i in sorted(items, key=lambda i: i["published_date_local"], reverse=True):
        print(f"- {i['published_date_local']} · {i['outlet']} · {i['title']}\n  {i['url']}\n  {i['claim_en']}")
    return 0


def do_publish(store_path: Path | None = None) -> int:
    """Upload the store as release asset news-store.json on release news-current (created if missing)."""
    p = Path(store_path or S.STORE_PATH)
    if not p.exists():
        log.error("news --publish: no store at %s", p)
        return 2
    stage_check(S.load(p))
    with tempfile.TemporaryDirectory() as tmp:
        asset = Path(tmp) / RELEASE_ASSET
        shutil.copyfile(p, asset)
        if subprocess.run(["gh", "release", "view", RELEASE_TAG], capture_output=True).returncode != 0:
            subprocess.run(["gh", "release", "create", RELEASE_TAG, "--title", "News store (news-current)",
                            "--notes", "Kiln Watch news store, written by `python -m kilnwatch news` (docs/news_plan.md)."],
                           check=True)
        subprocess.run(["gh", "release", "upload", RELEASE_TAG, str(asset), "--clobber"], check=True)
    log.info("news: published %s to release %s", RELEASE_ASSET, RELEASE_TAG)
    return 0


def run(backfill: bool = False, check_sources: bool = False, dry_run: bool = False, publish: bool = False,
        policy_review: bool = False, limit: int | None = None) -> int:
    """The `news` stage. Returns 0 on success."""
    if publish:
        return do_publish()
    if policy_review:
        return do_policy_review(S.load())
    sources = load_sources()
    today = today_local()
    if check_sources:
        return do_check_sources(sources, make_fetcher(), today)
    if limit is not None and limit < 0:
        log.error("news: --limit must be >= 0")
        return 2
    budget = C.NEWS_MAX_LLM_CALLS_PER_RUN if limit is None else min(limit, C.NEWS_MAX_LLM_CALLS_PER_RUN)
    if not dry_run and budget > 0 and not configured_providers():
        log.error("news: no model key is set (GEMINI_API_KEY, or a fallback in NEWS_PROVIDERS, in .env); --dry-run and --check-sources need none")
        return 2
    reset_providers()
    store = S.load()
    if apply_air_rule(store) and not dry_run:
        S.save(store)
    stage_check(store)
    r = Run(store, sources, make_fetcher(), Keywords.load(), Gazetteer.load(), load_blocklist(), today, budget, dry_run)
    if not backfill:
        cands = filter_links(r, discover_daily(r))
        if dry_run:
            for s in r.active:
                show(f"daily {s.key}" + (f" (skipped: {r.excluded[s.key]})" if s.key in r.excluded else ""),
                     [c for c in cands if c.source.key == s.key])
            print(f"\ndaily total: {len(cands)} candidates; filtered out: {dict(r.stats)}")
        else:
            process_all(r, cands)
    if backfill or (not dry_run and not r.stop and r.calls < r.budget):
        history(r)
    if dry_run:
        return 0
    stage_check(r.store)
    S.save(r.store)
    kept = r.stats["kept"]
    drops = {k.split(":", 1)[1]: v for k, v in r.stats.items() if k.startswith("dropped:")}
    log.info("news: %d model calls, %d kept, dropped %s, other %s%s; store holds %d items", r.calls, kept, drops,
             {k: v for k, v in r.stats.items() if k != "kept" and not k.startswith("dropped:")},
             f"; stopped: {r.stop}" if r.stop else "", len(r.store["items"]))
    return 0
