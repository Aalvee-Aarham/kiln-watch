"""The `news` stage (docs/news_plan.md §5.1, §11): closed-form properties on synthetic sitemaps and synthetic article
pages written for these tests. No network: the HTTP session is faked and the model call (`extract`) is mocked."""
import hashlib
import json
from datetime import date, timedelta
from urllib.parse import quote

import pytest
import requests

from kilnwatch import config as C
from kilnwatch import news
from kilnwatch import news_store as S
from kilnwatch.news_extract import Gazetteer, Keywords, Place, event_date, excerpt, guard, numbers_ok, quote_ok, slug_text
from kilnwatch.news_sources import Blocked, CapReached, Fetcher, RobotsDisallowed, Source, Transient, parse_sitemap, site_check

TODAY = date(2026, 1, 20)


def src(key, domain, lang="en", archive="none", status="active", feed=None):
    return Source(key, key.title(), domain, lang, feed or f"https://www.{domain}/news.xml", archive, status, "", "2026-10-11")


SOURCES = [src("dailystar", "thedailystar.net", archive="dailystar_yearly"), src("samakal", "samakal.com", "bn", "samakal_daily"),
           src("bdnews24", "bdnews24.com"), src("bdnews24_bn", "bangla.bdnews24.com", "bn"),
           src("prothomalo", "prothomalo.com", "bn"), src("kk", "kalerkantho.com", "bn", status="excluded")]
DISTRICTS = [Place("BD3026", "Dhaka", "ঢাকা"), Place("BD3033", "Gazipur", "গাজীপুর"), Place("BD4044", "Jhenaidah", "ঝিনাইদহ"),
             Place("BD4087", "Satkhira", "সাতক্ষীরা"), Place("BD5552", "Lalmonirhat", "লালমনিরহাট"), Place("BD5010", "Bogura", "বগুড়া"),
             Place("BD2015", "Chattogram", "চট্টগ্রাম"), Place("BD4589", "Sherpur", "শেরপুর"), Place("BD5585", "Rangpur", "রংপুর")]
UPAZILAS = [("BD30260072", "Savar"), ("BD30330034", "Kaliganj"), ("BD40440033", "Kaliganj"), ("BD40870047", "Kaliganj"),
            ("BD55520039", "Kaliganj"), ("BD30330030", "Gazipur Sadar"), ("BD50100001", "Sherpur"), ("BD50100002", "Bogura Sadar"),
            ("BD20150003", "Sadar Dakkhin"), ("BD20150004", "Kotwali"), ("BD20150005", "Hathazari")]
ALIASES = [("BD2015", "Chittagong", "en"), ("BD5010", "Bogra", "en"), ("BD2015", "চিটাগাং", "bn")]
KEYWORDS = [("en", "brick kiln"), ("en", "brickfield"), ("en", "smog"), ("en", "air pollution"), ("en", "AQI"),
            ("en", "mobile court"), ("bn", "ইটভাটা"), ("bn", "বায়ুদূষণ"), ("bn", "খড় পোড়ানো")]


def gaz():
    return Gazetteer(DISTRICTS, UPAZILAS, ALIASES)


def kw():
    return Keywords(KEYWORDS)


# --- fakes -------------------------------------------------------------------

class Clock:
    def __init__(self):
        self.t = 0.0
        self.sleeps = []

    def sleep(self, s):
        self.sleeps.append(s)
        self.t += s

    def __call__(self):
        return self.t


class Resp:
    def __init__(self, status, body=b"", headers=None):
        self.status_code, self.body, self.headers = status, body if isinstance(body, bytes) else body.encode("utf-8"), headers or {}

    def iter_content(self, n):
        for i in range(0, len(self.body), n):
            yield self.body[i:i + n]

    def close(self):
        pass


class Session:
    """routes: url -> (status, body) | [(status, body), ...] (consumed in order) | Exception. Unknown URLs are 404,
    except robots.txt, which allows everything unless given."""

    def __init__(self, routes, clock):
        self.routes, self.clock, self.calls = dict(routes), clock, []

    def get(self, url, headers=None, **kw):
        assert headers["User-Agent"] == C.NEWS_USER_AGENT  # the user agent never changes
        self.calls.append((url, self.clock.t))
        r = self.routes.get(url)
        if r is None:
            return Resp(200, "User-agent: *\nAllow: /\n") if url.endswith("/robots.txt") else Resp(404)
        if isinstance(r, list):
            r = r.pop(0) if len(r) > 1 else r[0]
        if isinstance(r, Exception):
            raise r
        return Resp(*r)

    def n(self, url):
        return sum(u == url for u, _ in self.calls)


def fetcher(routes):
    clock = Clock()
    return Fetcher(session=Session(routes, clock), sleep=clock.sleep, clock=clock), clock


def urlset(entries, news_ns=True):
    rows = []
    for loc, d, title in entries:
        n = (f"<news:news><news:publication_date>{d}T10:00:00+06:00</news:publication_date><news:title><![CDATA[{title}]]></news:title></news:news>"
             if news_ns and title else f"<lastmod>{d}T10:00:00+06:00</lastmod>")
        rows.append(f"<url><loc>{loc}</loc><image:image><image:loc>https://img.example/x.jpg</image:loc></image:image>{n}</url>")
    return ('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
            'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
            + "".join(rows) + "</urlset>")


SECRET = "Zanzibar-marker paragraph that must never be stored anywhere at all"


def article(title, published, paras):
    ld = json.dumps({"@context": "https://schema.org", "@type": "NewsArticle", "headline": title, "datePublished": published})
    body = "".join(f"<p>{p}</p>" for p in paras)
    return (f'<html><head><title>{title} | Example Daily</title><meta property="og:title" content="Wrong og title">'
            f'<script type="application/ld+json">{ld}</script></head><body><article>{body}</article></body></html>')


KILN_PARAS = ["A mobile court fined 12 brick kilns in Kaliganj upazila of Gazipur on Sunday, officials of the district said.",
              "The drive ran from morning until the evening and covered several villages along the river bank there.",
              SECRET + " and it continues here with more words to be long enough.",
              "Officials said the kilns were operating without environmental clearance this season in the area."]
QUOTE = "A mobile court fined 12 brick kilns in Kaliganj upazila of Gazipur on Sunday, officials of the district said."


def good_extract(excerpt_text, allowed, labels, published):
    return {"kind": "enforcement", "unit_ids": [allowed[0]], "event_date_local": (published - timedelta(days=2)).isoformat(),
            "claim_en": "A mobile court fined 12 brick kilns.", "claim_bn": "ভ্রাম্যমাণ আদালত ১২টি ইটভাটাকে জরিমানা করেছে।", "quote": QUOTE}


def make_run(routes, store=None, budget=10, sources=SOURCES):
    f, clock = fetcher(routes)
    r = news.Run(store or S.empty(), sources, f, kw(), gaz(), set(), TODAY, budget)
    return r, f, clock


def link(url, s=SOURCES[0], title="Brick kilns fined", d=TODAY):
    return news.Link(url, s, title, d)


# --- site check --------------------------------------------------------------

def test_site_check_accepts_the_outlet_and_its_subdomains_only():
    assert site_check("https://www.thedailystar.net/news/a-1", SOURCES).key == "dailystar"
    assert site_check("https://thedailystar.net/news/a-1", SOURCES).key == "dailystar"
    assert site_check("https://thedailystar.net.evil.com/news/a-1", SOURCES) is None
    assert site_check("https://evil-thedailystar.net/news/a-1", SOURCES) is None
    assert site_check("https://www.haal.fashion/style/x", SOURCES) is None
    assert site_check("http://www.thedailystar.net/news/a-1", SOURCES) is None
    assert site_check("https://www.kalerkantho.com/a/1", SOURCES) is None  # excluded outlet
    assert site_check("https://bangla.bdnews24.com/x/1", SOURCES).key == "bdnews24_bn"  # longest domain wins


# --- keyword filter ----------------------------------------------------------

def test_keywords_match_headlines_and_url_encoded_bangla_slugs():
    k = kw()
    assert k.match("Brick kilns razed in Savar")
    assert k.match("Dhaka's AQI tops the list again")
    assert not k.match("Aqib scores a century")  # short terms need both word boundaries
    assert not k.match("Fire at garment factory kills 3, building gutted")
    assert not k.match("আগুনে পুড়ল কারখানা")  # a building fire: no bare আগুন in the list
    url = "https://samakal.com/whole-country/article/1/" + quote("ইটভাটায়-অভিযান-জরিমানা")
    assert slug_text(url).endswith("ইটভাটায় অভিযান জরিমানা")
    assert k.link_matches("", url)
    assert not k.link_matches("", "https://samakal.com/whole-country/article/2/" + quote("আগুনে-পুড়ল-দোকান"))


# --- gazetteer ---------------------------------------------------------------

def test_gazetteer_names_aliases_upazilas_and_generic_names():
    g = gaz()
    assert g.find("Smog over Dhaka and Rangpur") == ["BD3026", "BD5585"]  # first-mention order
    assert g.find("Rangpur, then Dhaka") == ["BD5585", "BD3026"]
    assert g.find("Chittagong port") == ["BD2015"]  # alias
    assert g.find("Bogra kilns") == ["BD5010"]
    assert g.find("ঢাকায় বায়ুদূষণ, চিটাগাংয়েও") == ["BD3026", "BD2015"]  # Bangla case endings
    assert g.find("Savar brickfields") == ["BD3026"]  # upazila -> district
    assert g.find("Hathazari upazila") == ["BD2015"]
    assert g.find("Sadar upazila and Kotwali police station") == []  # generic names ignored
    assert g.find("Gazipur Sadar") == ["BD3033"]
    assert g.find("Sherpur district") == ["BD4589"]  # a district name means the district, not the Bogura upazila


def test_ambiguous_upazila_gives_all_its_districts_unless_one_is_named():
    g = gaz()
    assert g.find("Kaliganj kilns fined") == sorted(["BD3033", "BD4044", "BD4087", "BD5552"])
    assert g.find("Kaliganj upazila of Gazipur") == ["BD3033"]


# --- guards ------------------------------------------------------------------

def test_number_guard_normalises_bangla_digits_and_separators():
    assert numbers_ok("৪০টি ইটভাটা", "Officials closed 40 kilns.")
    assert numbers_ok("40 kilns", "৪০টি ইটভাটা বন্ধ করা হয়েছে।")
    assert numbers_ok("1200 people", "About 1,200 people were affected.")
    assert numbers_ok("1,200 people", "About 1200 people were affected.")
    assert not numbers_ok("41 kilns", "Officials closed 40 kilns.")


def test_quote_must_be_a_verbatim_substring_after_whitespace_normalisation():
    ex = "Headline\n\nThe drive shut   12 kilns\non Monday. Then it rained."
    assert quote_ok("The drive shut 12 kilns on Monday.", ex)
    assert not quote_ok("The drive closed 12 kilns on Monday.", ex)
    assert not quote_ok("", ex)


def test_event_date_window():
    pub = date(2026, 1, 14)
    lag = C.NEWS_EVENT_MAX_LAG_DAYS
    assert event_date("2026-01-12", pub) == (date(2026, 1, 12), True)
    assert event_date((pub - timedelta(days=lag)).isoformat(), pub) == (pub - timedelta(days=lag), True)
    assert event_date((pub - timedelta(days=lag + 1)).isoformat(), pub) == (pub, False)
    assert event_date("2026-01-15", pub) == (pub, False)  # after publication
    assert event_date(None, pub) == (pub, False)
    assert event_date("not a date", pub) == (pub, False)


def out(**kw):
    o = {"kind": "enforcement", "unit_ids": ["BD3033"], "event_date_local": "2026-01-12", "claim_en": "A court fined 12 kilns.",
         "claim_bn": "১২টি ভাটাকে জরিমানা।", "quote": "The court fined 12 kilns on Monday."}
    o.update(kw)
    return o


EX = "Kilns fined\n\nThe court fined 12 kilns on Monday. It was cold."


def g(o, cands=("BD3033", "BD3026"), nat=False, pub=date(2026, 1, 14)):
    return guard(o, EX, list(cands), nat, pub, TODAY)


def test_guard_reasons():
    fields, reason = g(out(unit_ids=["BD3026", "BD3033"]))
    assert reason is None and fields["unit_ids"] == ["BD3033", "BD3026"] and fields["season"] == "2025-26"  # candidate order
    assert g(out(kind="not_relevant"))[1] == "not_relevant"
    assert g(out(kind="factory_fire"))[1] == "schema_invalid"
    assert g(out(unit_ids="BD3033"))[1] == "schema_invalid"
    assert g({"kind": "burning"})[1] == "schema_invalid"
    assert g(out(unit_ids=["BD5585"]))[1] == "unit_not_candidate"
    assert g(out(unit_ids=[]))[1] == "unit_not_candidate"
    assert g(out(unit_ids=["BGD"]))[1] == "unit_not_candidate"  # national only when no district is a candidate
    assert g(out(unit_ids=["BGD"]), cands=(), nat=True)[0]["unit_ids"] == ["BGD"]
    assert g(out(quote="The court fined twelve kilns on Monday."))[1] == "quote_not_verbatim"
    assert g(out(claim_en="A court fined 13 kilns."))[1] == "number_not_in_quote"
    assert g(out(claim_bn="১৩টি ভাটাকে জরিমানা।"))[1] == "number_not_in_quote"
    assert g(out(event_date_local="2026-01-20"))[0]["event_date_stated"] is False  # after publication
    assert g(out(), pub=date(2012, 6, 30))[1] == "outside_range"  # season 2011-12
    assert g(out(event_date_local=None), pub=TODAY + timedelta(days=1))[1] == "outside_range"  # future


def test_length_caps():
    long_claim = " ".join(["word"] * (C.NEWS_CLAIM_MAX_WORDS + 1))
    assert g(out(claim_en=long_claim))[1] == "too_long"
    assert g(out(claim_bn=long_claim))[1] == "too_long"
    assert g(out(claim_en=" ".join(["word"] * C.NEWS_CLAIM_MAX_WORDS)))[1] is None
    long_ex = "H\n\n" + " ".join(["w"] * 40)
    q = " ".join(["w"] * (C.NEWS_QUOTE_MAX_WORDS + 1))
    assert guard(out(quote=q, claim_en="x", claim_bn="x"), long_ex, ["BD3033"], False, date(2026, 1, 14), TODAY)[1] == "too_long"


def test_excerpt_is_capped_and_keeps_first_and_relevant_paragraphs():
    paras = [f"para{i} " + "filler " * 10 for i in range(10)]
    paras[7] = "Brick kiln smoke in Dhaka " + "x " * 5
    ex = excerpt("Title", paras, kw(), gaz(), ["BD3026"])
    assert "para0" in ex and "para2" in ex and "Brick kiln smoke" in ex and "para5" not in ex
    big = excerpt("Title", ["word " * 400, "word " * 400], kw(), gaz(), [], max_words=600)
    assert len(big.split()) == 600


# --- sitemaps ----------------------------------------------------------------

def test_sitemap_parsing_takes_the_page_loc_not_the_image_loc():
    xml = urlset([("https://www.thedailystar.net/news/a-1", "2026-01-19", "Smog & haze"), ("https://www.thedailystar.net/news/b-2", "2026-01-18", "")])
    es = parse_sitemap(xml.encode())
    assert [e.loc for e in es] == ["https://www.thedailystar.net/news/a-1", "https://www.thedailystar.net/news/b-2"]
    assert es[0].title == "Smog & haze" and es[0].date == date(2026, 1, 19) and es[1].title == ""


def test_sitemap_parser_refuses_entity_expansion():
    bomb = b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;">]><urlset><url><loc>&b;</loc></url></urlset>'
    with pytest.raises(Exception):
        parse_sitemap(bomb)


# --- polite fetching ---------------------------------------------------------

def test_robots_disallow_is_honoured():
    f, _ = fetcher({"https://www.thedailystar.net/robots.txt": (200, "User-agent: *\nDisallow: /private/\n")})
    with pytest.raises(RobotsDisallowed):
        f.get("https://www.thedailystar.net/private/story-1")
    assert f.s.n("https://www.thedailystar.net/private/story-1") == 0
    assert f.s.n("https://www.thedailystar.net/robots.txt") == 1
    with pytest.raises(Exception):
        f.get("https://www.thedailystar.net/news/other")  # allowed by robots; 404 here
    assert f.s.n("https://www.thedailystar.net/robots.txt") == 1  # cached per host for the run


def test_google_extended_opt_out_excludes_the_outlet():
    r, f, _ = make_run({"https://www.thedailystar.net/robots.txt": (200, "User-agent: Google-Extended\nDisallow: /\n\nUser-agent: *\nAllow: /\n")})
    assert f.google_extended_disallowed("www.thedailystar.net")
    assert not news.outlet_ok(r, SOURCES[0])
    assert "Google-Extended" in r.excluded["dailystar"]
    assert S.coverage(r.store, "dailystar")["gaps"][0]["reason"] == "robots.txt disallows Google-Extended"
    f2, _ = fetcher({"https://www.x.com/robots.txt": (200, "User-agent: GPTBot\nDisallow: /\n")})
    assert not f2.google_extended_disallowed("www.x.com")


def test_403_skips_the_outlet_for_the_run_with_a_gap():
    a, b = "https://www.thedailystar.net/news/kiln-1", "https://www.thedailystar.net/news/kiln-2"
    r, f, _ = make_run({a: (403, "")})
    assert r.calls == 0
    assert news.process(r, link(a)) == "blocked"
    assert news.process(r, link(b)) == "blocked"
    assert f.s.n(b) == 0  # never requested
    assert f.s.n(a) == 1  # no retry on 403
    assert "http 403" in r.excluded["dailystar"]
    assert S.coverage(r.store, "dailystar")["gaps"] and not S.is_seen(r.store, a)
    with pytest.raises(Blocked):
        f.get("https://www.thedailystar.net/news/kiln-3")


def test_requests_to_one_host_are_spaced_and_retries_are_bounded():
    url = "https://samakal.com/a/1"
    f, clock = fetcher({url: (500, "")})
    with pytest.raises(Transient):
        f.get(url)
    times = [t for u, t in f.s.calls if u == url]
    assert len(times) == C.NEWS_MAX_RETRIES + 1
    every = [t for u, t in f.s.calls if "samakal.com" in u]
    assert all(b - a >= C.NEWS_FETCH_DELAY_S for a, b in zip(every, every[1:]))


def test_timeouts_are_retried_then_transient():
    url = "https://samakal.com/a/2"
    f, _ = fetcher({url: requests.Timeout("slow")})
    with pytest.raises(Transient):
        f.get(url)
    assert f.s.n(url) == C.NEWS_MAX_RETRIES + 1


def test_per_host_cap_stops_fetching():
    f, _ = fetcher({})
    f.cap["article"] = 2
    for i in range(2):
        with pytest.raises(Exception):
            f.get(f"https://samakal.com/a/{i}")  # 404s, but counted
    with pytest.raises(CapReached):
        f.get("https://samakal.com/a/9")
    assert f.s.n("https://samakal.com/a/9") == 0


def test_size_cap_refuses_oversized_pages():
    from kilnwatch import news_sources

    url = "https://samakal.com/a/big"
    f, _ = fetcher({url: (200, b"x" * (news_sources.MAX_ARTICLE_BYTES + 1))})
    with pytest.raises(news_sources.Refused):
        f.get(url)


def test_off_site_redirect_is_refused():
    from kilnwatch import news_sources

    url = "https://www.thedailystar.net/news/r-1"
    f, _ = fetcher({url: (301, "", {"Location": "https://evil.example/x"})})
    with pytest.raises(news_sources.Refused):
        f.get(url, same_site=lambda u: site_check(u, SOURCES) is not None)
    assert f.s.n("https://evil.example/x") == 0


# --- one article -------------------------------------------------------------

def test_kept_item_is_valid_and_article_text_never_reaches_the_store(monkeypatch, tmp_path):
    url = "https://www.thedailystar.net/news/kiln-drive-1"
    monkeypatch.setattr(news, "extract", good_extract)
    r, _, _ = make_run({url: (200, article("Mobile court fines brick kilns in Gazipur", "2026-01-19T09:00:00+06:00", KILN_PARAS))})
    assert news.process(r, link(url, title="Sitemap title")) == "kept"
    it = r.store["items"][0]
    assert S.validate_item(it) == []
    assert it["title"] == "Mobile court fines brick kilns in Gazipur"  # from JSON-LD, not og:title, sitemap or model
    assert it["published_date_local"] == "2026-01-19" and it["event_date_local"] == "2026-01-17" and it["event_date_stated"]
    assert it["unit_ids"] == ["BD3033"] and it["season"] == "2025-26" and set(it) == set(S.ITEM_KEYS)
    assert len(it["text_sha256"]) == 64 and r.calls == 1
    p = tmp_path / "store.json"
    S.save(r.store, p)
    blob = p.read_text(encoding="utf-8")
    assert "Zanzibar" not in blob and "river bank" not in blob


def test_published_date_is_converted_to_local_time(monkeypatch):
    url = "https://www.thedailystar.net/news/kiln-drive-2"
    monkeypatch.setattr(news, "extract", good_extract)
    r, _, _ = make_run({url: (200, article("Brick kilns fined in Gazipur", "2026-01-18T19:30:00Z", KILN_PARAS))})
    assert news.process(r, link(url)) == "kept"
    assert r.store["items"][0]["published_date_local"] == "2026-01-19"  # 19:30 UTC = 01:30 next day in UTC+6


def test_definitive_drops_are_marked_seen_and_counted(monkeypatch):
    url = "https://www.thedailystar.net/news/fire-1"
    monkeypatch.setattr(news, "extract", lambda *a: {**good_extract(*a), "kind": "not_relevant"})
    r, f, _ = make_run({url: (200, article("Kiln story in Gazipur", "2026-01-19T09:00:00+06:00", KILN_PARAS))})
    assert news.process(r, link(url)) == "dropped:not_relevant"
    assert S.is_seen(r.store, url) and r.store["dropped"] == {"not_relevant": 1} and r.store["items"] == []
    assert news.filter_links(r, [link(url)]) == []  # never fetched again


def test_no_place_is_dropped_without_a_model_call(monkeypatch):
    url = "https://www.thedailystar.net/news/kiln-x"
    called = []
    monkeypatch.setattr(news, "extract", lambda *a: called.append(1))
    paras = ["Brick kilns elsewhere in the world are discussed at length in this long paragraph today."] * 3
    r, _, _ = make_run({url: (200, article("Brick kilns abroad", "2026-01-19T09:00:00+06:00", paras))})
    assert news.process(r, link(url)) == "dropped:no_place" and not called and r.calls == 0


def test_transient_errors_are_not_marked_seen(monkeypatch):
    a, b, c = (f"https://www.thedailystar.net/news/kiln-{i}" for i in "abc")
    page = (200, article("Brick kilns in Gazipur", "2026-01-19T09:00:00+06:00", KILN_PARAS))

    def flaky(*args):
        from kilnwatch.news_extract import ModelTransient
        raise ModelTransient("503")

    monkeypatch.setattr(news, "extract", flaky)
    r, _, _ = make_run({a: (503, ""), b: page})
    assert news.process(r, link(a)) == "transient" and not S.is_seen(r.store, a)  # 5xx after retries
    assert news.process(r, link(b)) == "transient" and not S.is_seen(r.store, b)  # model 5xx

    def quota(*args):
        from kilnwatch.news_extract import QuotaExhausted
        raise QuotaExhausted("429")

    monkeypatch.setattr(news, "extract", quota)
    r2, _, _ = make_run({c: page})
    assert news.process(r2, link(c)) == "stopped" and r2.stop and not S.is_seen(r2.store, c)
    assert news.process(r2, link(b)) == "stopped"  # extraction stops for the run
    assert r2.store["seen"] == {} and r2.store["dropped"] == {}


def test_model_call_budget_stops_the_loop(monkeypatch):
    monkeypatch.setattr(news, "extract", good_extract)
    urls = [f"https://www.thedailystar.net/news/kiln-{i}" for i in range(5)]
    page = (200, article("Brick kilns in Gazipur", "2026-01-19T09:00:00+06:00", KILN_PARAS))
    r, f, _ = make_run({u: page for u in urls}, budget=2)
    states = news.process_all(r, [link(u) for u in urls])
    assert r.calls == 2 and states[:2] == ["kept", "kept"] and states[2] == "stopped" and len(states) == 3
    assert sum(f.s.n(u) for u in urls) == 2  # no fetch once the budget is used


def test_filter_drops_off_site_old_seen_blocklisted_and_unmatched():
    r, _, _ = make_run({})
    ok = link("https://www.thedailystar.net/news/brick-kiln-drive-1", title="")
    seen = link("https://www.thedailystar.net/news/smog-2")
    S.mark_dropped(r.store, seen.url, "not_relevant")
    blocked = link("https://www.thedailystar.net/news/smog-3")
    r.blocklist = {S.news_id(blocked.url)}
    links = [ok, seen, blocked, link("https://www.haal.fashion/smog"), link("https://www.thedailystar.net/news/smog-4", d=date(2012, 6, 30)),
             link("https://www.thedailystar.net/news/cricket-5", title="Cricket"), link(ok.url + "/", title="")]
    assert [x.url for x in news.filter_links(r, links)] == [ok.url]


# --- discovery and history ---------------------------------------------------

def test_daily_discovery_reads_the_feed_and_records_coverage():
    s = SOURCES[2]
    feed = urlset([("https://bdnews24.com/bangladesh/abc1", "2026-01-20", "Smog blankets Dhaka"),
                   ("https://bdnews24.com/sport/abc2", "2026-01-19", "Cricket"), ("https://www.haal.fashion/abc3", "2026-01-19", "Smog style")])
    r, _, _ = make_run({s.news_sitemap: (200, feed)}, sources=[s])
    cands = news.filter_links(r, news.discover_daily(r))
    assert [c.url for c in cands] == ["https://bdnews24.com/bangladesh/abc1"]
    cov = S.coverage(r.store, "bdnews24")
    assert cov["last_scanned"] == "2026-01-20" and cov["read_back_to"] == "2026-01-19"


def samakal_routes(days, kiln_every=1):
    routes = {}
    for i, d in enumerate(days):
        url = news.SAMAKAL_DAY.format(d=d.isoformat())
        loc = f"https://samakal.com/whole-country/article/{i}/" + quote("ইটভাটায়-অভিযান")
        routes[url] = (200, urlset([(loc, d.isoformat(), "")], news_ns=False))
        routes[loc] = (200, article("ইটভাটায় অভিযান, গাজীপুর", f"{d.isoformat()}T09:00:00+06:00", KILN_PARAS))
    return routes


def test_history_cursor_moves_strictly_backwards_and_stops_at_the_history_start(monkeypatch):
    s = SOURCES[1]
    start = TODAY - timedelta(days=8)
    monkeypatch.setattr(news, "HISTORY_FROM", start)
    monkeypatch.setitem(news.ARCHIVE_FROM, "samakal_daily", start - timedelta(days=100))
    monkeypatch.setattr(news, "extract", good_extract)
    r, f, _ = make_run(samakal_routes([TODAY - timedelta(days=i) for i in range(0, 30)]), budget=100, sources=[s])
    cursors = []
    for _ in range(50):  # bounded
        st = news.history_step(r, s)
        cursors.append(S.coverage(r.store, "samakal")["history_cursor"])
        if st == "done":
            break
    assert st == "done"
    assert all(b < a for a, b in zip(cursors[:-2], cursors[1:-1]))  # strictly backwards until done
    assert cursors[-1] == start.isoformat()
    assert len(r.store["items"]) == (news.initial_cursor(TODAY) - start).days  # one story per day read
    assert all(i["published_date_local"] >= start.isoformat() for i in r.store["items"])
    n = len(f.s.calls)
    assert news.history_step(r, s) == "done" and len(f.s.calls) == n  # nothing fetched once done


def test_history_with_the_real_start_date_is_done_without_requests():
    s = SOURCES[1]
    r, f, _ = make_run({}, sources=[s])
    S.coverage(r.store, "samakal")["history_cursor"] = C.NEWS_HISTORY_FROM
    assert news.history_step(r, s) == "done" and f.s.calls == []


def test_history_cursor_stays_above_unresolved_links(monkeypatch):
    s = SOURCES[1]
    days = [TODAY - timedelta(days=i) for i in range(0, 5)]
    monkeypatch.setattr(news, "extract", good_extract)
    r, _, _ = make_run(samakal_routes(days), budget=0, sources=[s])  # no model budget: nothing can be resolved
    cur0 = news.initial_cursor(TODAY)
    assert news.history_step(r, s) == "stalled"
    assert S.coverage(r.store, "samakal")["history_cursor"] == cur0.isoformat()  # never forwards, never past unread links


def test_history_loop_is_bounded_by_its_step_cap(monkeypatch):
    s = SOURCES[1]
    monkeypatch.setattr(news, "MAX_HISTORY_STEPS_PER_RUN", 3)
    monkeypatch.setattr(news, "extract", good_extract)
    r, f, _ = make_run(samakal_routes([TODAY - timedelta(days=i) for i in range(0, 30)]), budget=100, sources=[s])
    news.history(r)
    assert len([u for u, _ in f.s.calls if "sitemap-daily" in u]) == 3
    assert S.coverage(r.store, "samakal")["history_cursor"] == (news.initial_cursor(TODAY) - timedelta(days=3)).isoformat()


def test_dailystar_archive_dates_are_clamped_into_the_folder_year():
    s = SOURCES[0]
    index = ('<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
             '<sitemap><loc>https://www.thedailystar.net/sitemaps/2025/sitemap-2025-1.xml</loc></sitemap>'
             '<sitemap><loc>https://www.thedailystar.net/sitemaps/2025/sitemap-2025-2.xml</loc></sitemap>'
             '<sitemap><loc>https://www.thedailystar.net/sitemaps/1970/sitemap-1970-1.xml</loc></sitemap></sitemapindex>')
    y2 = urlset([("https://www.thedailystar.net/news/smog-late", "2026-02-01", ""), ("https://www.thedailystar.net/news/smog-dec", "2025-12-30", "")], news_ns=False)
    r, _, _ = make_run({news.DAILYSTAR_INDEX: (200, index), "https://www.thedailystar.net/sitemaps/2025/sitemap-2025-2.xml": (200, y2)}, sources=[s])
    start, end, urls = news.archive_unit(r, s, date(2025, 12, 31), daily=True)
    assert (start, end) == (date(2025, 1, 1), date(2025, 12, 31)) and urls == ["https://www.thedailystar.net/sitemaps/2025/sitemap-2025-2.xml"]
    links = news.archive_links(r, s, start, end, urls, lo=start, hi=end)
    assert sorted(ln.date for ln in links) == [date(2025, 12, 30), date(2025, 12, 31)]
    assert sorted(r.ds_index) == [1970, 2025]


# --- the stage ---------------------------------------------------------------

def test_run_end_to_end_stores_checked_items_only(monkeypatch, tmp_path):
    s = SOURCES[2]
    url = "https://bdnews24.com/bangladesh/kiln1"
    feed = urlset([(url, "2026-01-19", "Brick kilns fined in Gazipur")])
    f, _ = fetcher({s.news_sitemap: (200, feed), url: (200, article("Brick kilns fined in Gazipur", "2026-01-19T09:00:00+06:00", KILN_PARAS))})
    monkeypatch.setattr(S, "STORE_PATH", tmp_path / "news" / "store.json")
    monkeypatch.setattr(news, "load_sources", lambda: [s])
    monkeypatch.setattr(news, "make_fetcher", lambda: f)
    monkeypatch.setattr(news, "today_local", lambda: TODAY)
    monkeypatch.setattr(news, "load_blocklist", lambda: set())
    monkeypatch.setattr(news.Keywords, "load", classmethod(lambda cls: kw()))
    monkeypatch.setattr(news.Gazetteer, "load", classmethod(lambda cls: gaz()))
    monkeypatch.setattr(news, "extract", good_extract)
    monkeypatch.setattr(C, "GEMINI_API_KEY", "test-key-not-real")
    assert news.run(limit=5) == 0
    store = S.load(S.STORE_PATH)
    assert [i["url"] for i in store["items"]] == [url] and all(S.validate_item(i) == [] for i in store["items"])
    assert "Zanzibar" not in S.STORE_PATH.read_text(encoding="utf-8")
    assert store["items"][0]["text_sha256"] != hashlib.sha256(b"").hexdigest()
    assert news.run(limit=5) == 0  # a re-run fetches nothing new and changes no item
    assert S.load(S.STORE_PATH)["items"] == store["items"]


def test_limit_never_exceeds_the_per_run_cap(monkeypatch):
    seen = {}
    monkeypatch.setattr(C, "GEMINI_API_KEY", "test-key-not-real")
    monkeypatch.setattr(news, "load_sources", lambda: [])
    monkeypatch.setattr(news, "make_fetcher", lambda: fetcher({})[0])
    monkeypatch.setattr(news.Keywords, "load", classmethod(lambda cls: kw()))
    monkeypatch.setattr(news.Gazetteer, "load", classmethod(lambda cls: gaz()))
    monkeypatch.setattr(news, "load_blocklist", lambda: set())
    monkeypatch.setattr(S, "load", lambda path=None: S.empty())
    monkeypatch.setattr(S, "save", lambda store, path=None: None)
    orig = news.Run.__init__

    def spy(self, *a, **kw):
        orig(self, *a, **kw)
        seen["budget"] = self.budget

    monkeypatch.setattr(news.Run, "__init__", spy)
    assert news.run(limit=10_000) == 0
    assert seen["budget"] == C.NEWS_MAX_LLM_CALLS_PER_RUN
    assert news.run(limit=-1) == 2


# --- the model fallback chain (NEWS_PROVIDERS), providers mocked ---------------------------------
from kilnwatch import news_extract as X  # noqa: E402

GOOD_REPLY = json.dumps({"kind": "burning", "unit_ids": ["BD3026"], "event_date_local": None,
                         "claim_en": "Fields burned.", "claim_bn": "মাঠে আগুন।", "quote": "Fields burned."})
CHAIN = ({"name": "a", "api": "openai", "model": "m-a", "key": "KEY_A", "base_url": "https://a.example"},
         {"name": "b", "api": "openai", "model": "m-b", "key": "KEY_B", "base_url": "https://b.example"},
         {"name": "c", "api": "openai", "model": "m-c", "key": "KEY_C", "base_url": "https://c.example"})


def chain(monkeypatch, replies, keys=("KEY_A", "KEY_B", "KEY_C")):
    """replies: provider name -> list of outcomes ('ok', 429, 503, 401, 'bad'); records the call order."""
    calls = []
    monkeypatch.setattr(C, "NEWS_PROVIDERS", CHAIN)
    for k in ("KEY_A", "KEY_B", "KEY_C"):
        monkeypatch.setattr(C, k, "x" if k in keys else "", raising=False)

    def call(p, prompt, sch):
        calls.append(p["name"])
        r = replies[p["name"]].pop(0)
        if r == "ok":
            return GOOD_REPLY
        if r == "bad":
            return "not json"
        X._classify(r)

    monkeypatch.setattr(X, "_call_openai", call)
    X.reset_providers()
    return calls


def ask():
    return X.extract("Fields burned.", ["BD3026"], {"BD3026": "Dhaka"}, date(2026, 1, 14))


def test_first_provider_answers_and_is_named(monkeypatch):
    calls = chain(monkeypatch, {"a": ["ok"]})
    assert ask()["_model"] == "a:m-a" and calls == ["a"]


def test_quota_moves_to_the_next_provider_for_the_rest_of_the_run(monkeypatch):
    calls = chain(monkeypatch, {"a": [429], "b": ["ok", "ok"]})
    assert ask()["_model"] == "b:m-b"
    assert ask()["_model"] == "b:m-b"
    assert calls == ["a", "b", "b"]  # a is not asked again this run


def test_refusal_drops_the_provider_and_transient_errors_only_skip_it_once(monkeypatch):
    calls = chain(monkeypatch, {"a": [401], "b": [503, "ok"], "c": ["ok"]})
    assert ask()["_model"] == "c:m-c"  # a refused (dropped), b had a 5xx (skipped for this article)
    assert ask()["_model"] == "b:m-b"  # b is tried again on the next article
    assert calls == ["a", "b", "c", "b"]


def test_providers_without_a_key_are_skipped(monkeypatch):
    calls = chain(monkeypatch, {"b": ["ok"]}, keys=("KEY_B",))
    assert ask()["_model"] == "b:m-b" and calls == ["b"]


def test_every_provider_spent_raises_quota_and_none_configured_raises_stop(monkeypatch):
    chain(monkeypatch, {"a": [429], "b": [429], "c": [401]})
    with pytest.raises(X.QuotaExhausted):
        ask()
    chain(monkeypatch, {}, keys=())
    with pytest.raises(X.ModelStop):
        ask()


def test_last_failure_is_reported_when_nobody_answers(monkeypatch):
    chain(monkeypatch, {"a": ["bad"], "b": [503], "c": [429]})
    with pytest.raises(X.ModelTransient):
        ask()
    chain(monkeypatch, {"a": [429], "b": [429], "c": ["bad"]})
    with pytest.raises(X.ModelOutputInvalid):
        ask()


def test_a_fenced_json_reply_is_read():
    assert X.parse_reply("```json\n" + GOOD_REPLY + "\n```")["kind"] == "burning"
    with pytest.raises(X.ModelOutputInvalid):
        X.parse_reply("[1, 2]")


def test_openai_compatible_call_sends_json_mode_seed_and_key(monkeypatch):
    import requests
    sent = {}

    class R:
        status_code = 200

        def json(self):
            return {"choices": [{"message": {"content": GOOD_REPLY}}]}

    def post(url, json=None, timeout=None, headers=None):
        sent.update(url=url, body=json, headers=headers, timeout=timeout)
        return R()

    monkeypatch.setattr(requests, "post", post)
    monkeypatch.setattr(C, "MISTRAL_API_KEY", "k-test")
    p = {"name": "mistral", "api": "openai", "model": "mistral-small-latest", "key": "MISTRAL_API_KEY",
         "base_url": "https://api.mistral.ai/v1/", "seed_param": "random_seed"}
    assert X.parse_reply(X._call_openai(p, "prompt", X.schema(["BD3026"])))["kind"] == "burning"
    assert sent["url"] == "https://api.mistral.ai/v1/chat/completions"
    assert sent["body"]["response_format"] == {"type": "json_object"} and "random_seed" in sent["body"] and "seed" not in sent["body"]
    assert sent["headers"]["Authorization"] == "Bearer k-test" and sent["timeout"] > 0
