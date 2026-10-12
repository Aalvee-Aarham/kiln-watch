"""The news store's interface (kilnwatch/news_store.py): closed-form properties on synthetic items."""
import json

from kilnwatch import news_store as S


def item(url="https://www.thedailystar.net/news/bangladesh/kiln-drive-123", **kw):
    it = {"news_id": S.news_id(url), "url": url, "source": "dailystar", "outlet": "The Daily Star", "lang": "en",
          "title": "Synthetic headline", "published_date_local": "2026-01-14", "event_date_local": "2026-01-12",
          "event_date_stated": True, "season": "2025-26", "kind": "enforcement", "unit_ids": ["BD3026"],
          "claim_en": "A drive shut 12 kilns.", "claim_bn": "অভিযানে ১২টি ভাটা বন্ধ।", "quote": "The drive shut 12 kilns on Monday.",
          "text_sha256": "0" * 64, "extracted_at": "2026-10-11T03:00:00+00:00", "model": "gemini-3.8-flash"}
    it.update(kw)
    return it


def test_canonical_url_is_one_form_per_article():
    a = S.canonical_url("http://www.TheDailyStar.net/news/x/?utm_source=fb#top")
    assert a == "https://thedailystar.net/news/x"
    assert S.canonical_url("https://thedailystar.net/news/x") == a
    assert S.news_id("http://www.thedailystar.net/news/x/") == S.news_id("https://thedailystar.net/news/x?ref=1")
    assert S.news_id("https://thedailystar.net/news/y") != S.news_id("https://thedailystar.net/news/x")


def test_news_id_is_twelve_hex_digits():
    nid = S.news_id("https://samakal.com/whole-country/article/1")
    assert len(nid) == 12 and int(nid, 16) >= 0


def test_merge_is_idempotent():
    store = S.empty()
    batch = [item(), item("https://www.thedailystar.net/news/other-456")]
    assert S.merge(store, batch) == 2
    assert S.merge(store, batch) == 0
    assert len(store["items"]) == 2
    assert all(store["seen"][i["news_id"]] == "kept" for i in batch)


def test_dropped_links_are_counted_once_and_never_refetched():
    store = S.empty()
    S.mark_dropped(store, "https://samakal.com/a/1", "not_relevant")
    S.mark_dropped(store, "https://samakal.com/a/1/", "not_relevant")  # the same article
    S.mark_dropped(store, "https://samakal.com/a/2", "quote_not_verbatim")
    assert store["dropped"] == {"not_relevant": 1, "quote_not_verbatim": 1}
    assert S.is_seen(store, "https://www.samakal.com/a/1")
    assert not S.is_seen(store, "https://samakal.com/a/3")


def test_valid_item_passes():
    assert S.validate_item(item()) == []
    assert S.validate_item(item(unit_ids=["BGD"])) == []


def test_invalid_items_are_named():
    assert "kind 'factory_fire'" in S.validate_item(item(kind="factory_fire"))
    assert "news_id does not match url" in S.validate_item(item(news_id="000000000000"))
    assert "event after publication" in S.validate_item(item(event_date_local="2026-01-20", season="2025-26"))
    assert "a national story is also tagged with districts" in S.validate_item(item(unit_ids=["BGD", "BD3026"]))
    assert "unit_ids repeat" in S.validate_item(item(unit_ids=["BD3026", "BD3026"]))
    assert any(e.startswith("season") for e in S.validate_item(item(season="2026-27")))
    assert "missing quote" in S.validate_item({k: v for k, v in item().items() if k != "quote"})
    assert "event_date_stated is str" in S.validate_item(item(event_date_stated="yes"))


def test_event_on_season_boundary_takes_the_event_dates_season():
    it = item(published_date_local="2026-07-02", event_date_local="2026-06-30", season="2025-26")
    assert S.validate_item(it) == []


def test_save_load_roundtrip_is_atomic(tmp_path):
    p = tmp_path / "news" / "store.json"
    assert S.load(p) == S.empty()
    store = S.empty()
    S.merge(store, [item("https://www.thedailystar.net/news/b-2", published_date_local="2026-02-01", event_date_local="2026-02-01"), item()])
    S.coverage(store, "dailystar")["last_scanned"] = "2026-10-11"
    S.save(store, p)
    assert not list(p.parent.glob("*.tmp"))
    back = S.load(p)
    assert [i["published_date_local"] for i in back["items"]] == ["2026-01-14", "2026-02-01"]  # sorted on save
    assert back["coverage"]["dailystar"]["last_scanned"] == "2026-10-11"
    assert json.loads(p.read_text(encoding="utf-8"))["version"] == S.VERSION
