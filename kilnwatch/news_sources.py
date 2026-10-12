"""News sources and polite fetching for the `news` stage (docs/news_plan.md §4, §5.1 steps 1-3).

Everything that touches the network lives here: the hand-built source list, the site check, robots.txt, pacing,
caps, retries and sitemap parsing. A 403 or 429 skips the host for the run; the user agent never changes.
"""
from __future__ import annotations

import csv
import logging
import time
import urllib.robotparser
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from . import config as C

log = logging.getLogger("kilnwatch.news")

SOURCES_CSV = C.STATIC / "news_sources.csv"
LOCAL_TZ = timezone(timedelta(hours=6))  # Bangladesh, UTC+6, no daylight saving
TIMEOUT_S = (10, 40)  # connect, read
MAX_SITEMAP_BYTES = 25_000_000  # a Daily Star yearly sitemap of 50 000 links is about 9 MB
MAX_ARTICLE_BYTES = 4_000_000
MAX_ROBOTS_BYTES = 500_000
MAX_SITEMAPS_PER_HOST_PER_RUN = 40  # sitemap and robots requests, counted apart from article fetches
MAX_REDIRECTS = 3
MAX_SITEMAP_ENTRIES = 60_000  # the sitemap protocol allows 50 000 per file
MAX_CRAWL_DELAY_S = 60.0
ARCHIVES = ("none", "dailystar_yearly", "dhakatribune_monthly", "samakal_daily")


@dataclass(frozen=True)
class Source:
    key: str
    outlet: str
    domain: str
    lang: str
    news_sitemap: str
    archive: str
    status: str
    reason: str
    checked_on: str


def load_sources(path: Path | None = None) -> list[Source]:
    with open(path or SOURCES_CSV, encoding="utf-8", newline="") as f:
        rows = [Source(**{k: (v or "").strip() for k, v in r.items()}) for r in csv.DictReader(f)]
    for s in rows:
        if s.status not in ("active", "excluded") or s.lang not in ("en", "bn") or s.archive not in ARCHIVES:
            raise ValueError(f"news_sources.csv: bad row {s.key!r}")
        if s.status == "active" and not s.news_sitemap.startswith("https://"):
            raise ValueError(f"news_sources.csv: active source {s.key!r} has no https news sitemap")
    if len({s.key for s in rows}) != len(rows):
        raise ValueError("news_sources.csv: repeated key")
    return rows


def site_check(url: str, sources: list[Source]) -> Source | None:
    """The active source a link belongs to: https only, host equal to or a subdomain of the source's domain.
    The longest matching domain wins (bangla.bdnews24.com is bdnews24_bn, not bdnews24)."""
    try:
        p = urlsplit(url.strip())
        host = (p.hostname or "").lower().rstrip(".")
    except ValueError:
        return None
    if p.scheme != "https" or not host or p.username or p.password:
        return None
    hits = [s for s in sources if s.status == "active" and (host == s.domain or host.endswith("." + s.domain))]
    return max(hits, key=lambda s: len(s.domain)) if hits else None


# --- dates -------------------------------------------------------------------

def local_date(value: str | None) -> date | None:
    """A sitemap or page timestamp as a local (UTC+6) date. Naive timestamps are taken as local time."""
    if not value or not isinstance(value, str):
        return None
    v = value.strip()
    try:
        if len(v) == 10:
            return date.fromisoformat(v)
        dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt.astimezone(LOCAL_TZ).date() if dt.tzinfo else dt.date()


def today_local() -> date:
    return datetime.now(LOCAL_TZ).date()


# --- fetching ----------------------------------------------------------------

class FetchError(Exception):
    """Base class; `definitive` failures are marked seen, the others are retried on a later run."""
    definitive = False


class Blocked(FetchError):
    """The host answered 403 or 429: skip the outlet for this run and record a gap."""


class CapReached(FetchError):
    """The per-host cap for this run is used up."""


class RobotsDisallowed(FetchError):
    """robots.txt disallows our user agent for this URL."""


class Transient(FetchError):
    """Timeout, connection error, 5xx after retries, or an unexpected status."""


class Gone(FetchError):
    definitive = True  # 404 / 410


class Refused(FetchError):
    definitive = True  # 401 / 402 / 451 (paywall or legal block: never bypassed), off-site redirect, oversize


class Fetcher:
    """Polite HTTP: robots.txt per host (cached for the run), >= NEWS_FETCH_DELAY_S between requests to one host,
    per-host caps, size caps, timeouts, and at most NEWS_MAX_RETRIES retries with backoff for transient errors."""

    def __init__(self, session=None, sleep=time.sleep, clock=time.monotonic, delay_s: float = C.NEWS_FETCH_DELAY_S):
        if session is None:
            import requests

            session = requests.Session()
        self.s = session
        self.sleep, self.clock, self.delay_s = sleep, clock, float(delay_s)
        self.last: dict[str, float] = {}
        self.n = {"article": Counter(), "sitemap": Counter()}
        self.cap = {"article": C.NEWS_MAX_FETCH_PER_HOST_PER_RUN, "sitemap": MAX_SITEMAPS_PER_HOST_PER_RUN}
        self.blocked: dict[str, str] = {}
        self._robots: dict[str, urllib.robotparser.RobotFileParser] = {}
        self.robots_status: dict[str, str] = {}

    # robots.txt
    def robots(self, host: str) -> urllib.robotparser.RobotFileParser:
        if host in self._robots:
            return self._robots[host]
        rp = urllib.robotparser.RobotFileParser()
        try:
            body = self._get(f"https://{host}/robots.txt", "sitemap", MAX_ROBOTS_BYTES, check_robots=False, follow=False)
            rp.parse(body.decode("utf-8", errors="replace").splitlines())
            self.robots_status[host] = "ok"
        except Gone:
            rp.allow_all = True  # no robots.txt: everything allowed (RFC 9309)
            self.robots_status[host] = "none (404)"
        except Refused:
            rp.disallow_all = True  # 401/403 on robots.txt: treat the whole site as disallowed
            self.robots_status[host] = "refused"
        except FetchError as e:
            rp.disallow_all = True  # unreachable: be conservative for this run
            self.robots_status[host] = f"unreachable ({type(e).__name__})"
        self._robots[host] = rp
        return rp

    def allowed(self, url: str) -> bool:
        host = (urlsplit(url).hostname or "").lower()
        return self.robots(host).can_fetch(C.NEWS_USER_AGENT, url)

    def google_extended_disallowed(self, host: str) -> bool:
        """True when robots.txt names Google-Extended with any Disallow rule (the publisher's AI opt-out), or when
        the whole site is disallowed."""
        rp = self.robots(host)
        if rp.disallow_all:
            return True
        for e in getattr(rp, "entries", []):
            if "google-extended" in (a.lower() for a in e.useragents) and any(not r.allowance and r.path for r in e.rulelines):
                return True
        return False

    def _crawl_delay(self, host: str) -> float:
        rp = self._robots.get(host)
        d = None
        if rp is not None:
            try:
                d = rp.crawl_delay(C.NEWS_USER_AGENT)
            except Exception:  # noqa: BLE001 - a malformed Crawl-delay line falls back to our own delay
                d = None
        return max(self.delay_s, min(float(d or 0), MAX_CRAWL_DELAY_S))

    def _wait(self, host: str) -> None:
        if host in self.last:
            gap = self._crawl_delay(host) - (self.clock() - self.last[host])
            if gap > 0:
                self.sleep(gap)
        self.last[host] = self.clock()

    def get(self, url: str, kind: str = "article", same_site=None) -> bytes:
        """GET one URL. `kind` is 'article' or 'sitemap' (separate caps). `same_site(url) -> bool` approves redirects."""
        return self._get(url, kind, MAX_ARTICLE_BYTES if kind == "article" else MAX_SITEMAP_BYTES, check_robots=True,
                         follow=True, same_site=same_site)

    def _get(self, url: str, kind: str, max_bytes: int, check_robots: bool, follow: bool, same_site=None) -> bytes:
        for _hop in range(MAX_REDIRECTS + 1):
            p = urlsplit(url)
            host = (p.hostname or "").lower()
            if p.scheme != "https" or not host:
                raise Refused("not https")
            if host in self.blocked:
                raise Blocked(self.blocked[host])
            if check_robots and not self.allowed(url):
                raise RobotsDisallowed(url)
            status, headers, body = self._request(url, host, kind, max_bytes)
            if 300 <= status < 400:
                loc = headers.get("Location") or headers.get("location")
                if not follow or not loc:
                    raise Transient(f"http {status}")
                nxt = urljoin(url, loc)
                if same_site is not None and not same_site(nxt):
                    raise Refused("redirect off-site")
                url = nxt
                continue
            return body
        raise Refused("too many redirects")

    def _request(self, url: str, host: str, kind: str, max_bytes: int):
        import requests

        last = "no attempt"
        for attempt in range(C.NEWS_MAX_RETRIES + 1):
            if self.n[kind][host] >= self.cap[kind]:
                raise CapReached(f"{kind} cap {self.cap[kind]} for {host}")
            if attempt:
                self.sleep(self.delay_s * 2 ** attempt)  # backoff, transient errors only
            self._wait(host)
            self.n[kind][host] += 1
            try:
                r = self.s.get(url, headers={"User-Agent": C.NEWS_USER_AGENT, "Accept-Language": "en, bn"},
                               timeout=TIMEOUT_S, stream=True, allow_redirects=False)
            except (requests.Timeout, requests.ConnectionError) as e:
                last = type(e).__name__
                continue
            try:
                st = r.status_code
                if st in (403, 429):
                    self.blocked[host] = f"http {st}"
                    raise Blocked(f"http {st}")
                if 500 <= st < 600:
                    last = f"http {st}"
                    continue
                if st in (404, 410):
                    raise Gone(f"http {st}")
                if st in (401, 402, 451):
                    raise Refused(f"http {st}")
                if 300 <= st < 400:
                    return st, dict(r.headers), b""
                if st != 200:
                    raise Transient(f"http {st}")
                try:
                    return st, dict(r.headers), _read_capped(r, max_bytes)
                except requests.RequestException as e:  # timeout or reset while reading the body
                    last = type(e).__name__
                    continue
            finally:
                close = getattr(r, "close", None)
                if close:
                    close()
        raise Transient(last)


def _read_capped(r, max_bytes: int) -> bytes:
    n = r.headers.get("Content-Length") if hasattr(r, "headers") else None
    if n and n.isdigit() and int(n) > max_bytes:
        raise Refused(f"response larger than {max_bytes} bytes")
    buf = bytearray()
    for chunk in r.iter_content(65536):
        buf += chunk
        if len(buf) > max_bytes:
            raise Refused(f"response larger than {max_bytes} bytes")
    return bytes(buf)


# --- sitemaps ----------------------------------------------------------------

@dataclass(frozen=True)
class Entry:
    loc: str
    date: date | None  # news:publication_date, else lastmod (local date)
    title: str  # news:title when the sitemap has one, else ""
    is_index: bool  # a <sitemap> entry of a sitemap index


def parse_sitemap(body: bytes) -> list[Entry]:
    """Entries of a urlset or sitemapindex. defusedxml refuses DTDs and entity tricks in untrusted XML."""
    from defusedxml import ElementTree as ET

    root = ET.fromstring(body)
    out: list[Entry] = []
    for el in root:
        tag = el.tag.rsplit("}", 1)[-1]
        if tag not in ("url", "sitemap"):
            continue
        loc = next(((c.text or "").strip() for c in el if c.tag.rsplit("}", 1)[-1] == "loc"), None)  # not image:loc
        lastmod = pub = title = None
        for sub in el.iter():
            t = sub.tag.rsplit("}", 1)[-1]
            txt = (sub.text or "").strip()
            if t == "lastmod":
                lastmod = txt
            elif t == "publication_date":
                pub = txt
            elif t == "title" and sub.tag.startswith("{http://www.google.com/schemas/sitemap-news"):
                title = txt
        if loc:
            out.append(Entry(loc, local_date(pub) or local_date(lastmod), title or "", tag == "sitemap"))
        if len(out) >= MAX_SITEMAP_ENTRIES:
            break
    return out
