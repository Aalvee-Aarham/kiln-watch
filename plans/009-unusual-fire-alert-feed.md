# Plan 009: Publish a static Atom feed of districts with unusual fire activity

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on.
> On any STOP condition, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 98fa82a..HEAD -- kilnwatch/nrt.py kilnwatch/export.py tests/test_nrt.py web/index.html web/src/pages/OtherPages.tsx docs/operations.md docs/data-contracts.md`
> Plan 007 changes `nrt.py`, `tests/test_nrt.py` and `OtherPages.tsx` first
> (a `today` parameter, `era`/`sensor` fields, a label) — that is expected
> drift. Anything else that differs from the excerpts below is a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S-M
- **Risk**: LOW (a new static file written by the daily job; no new service)
- **Depends on**: Plan 007 (both edit `nrt.run` and the "This season" page; 007 first avoids conflicts)
- **Category**: direction
- **Planned at**: commit `98fa82a`, 2026-10-12

## Why this matters

The first users in `docs/PRODUCT.md` are Department of Environment analysts
"cross-checking a district's burning calendar before an inspection round".
The daily job already decides, per district, how many days this season ran
above the 90th-percentile normal (`above_p90_days`) — but nobody is told:
an analyst has to remember to open the site. The product is static by
principle ("offline-first static hosting", `plans/README.md` rejected
list), so push notifications or email would need a server. An **Atom
feed** is a static file: feed readers, Outlook, Slack/Teams RSS apps and
automation tools can all watch it. Each time a district gains an unusual
day, readers see a new item linking to that district's page.

## Current state

- `kilnwatch/nrt.py` `run()` builds per-district output (lines 146–155):
  ```python
  districts = {}
  cal_dir = C.WEB_DATA / "calendar"
  for dist_id in cells.district.unique():
      h = dist_h.get(dist_id, np.zeros(n_days))
      above = 0
      f = cal_dir / f"{dist_id}.json"
      if f.exists():
          p90 = np.asarray(json.loads(f.read_text(encoding="utf-8"))["normal"]["p90"])
          above = int(np.sum(h > p90[np.arange(n_days) % 366]))
      districts[dist_id] = {"h": np.round(h, 3).tolist(), "above_p90_days": above}
  out = {"updated_at": ..., "season": season, "day0": day0.strftime("%Y-%m-%d"), ...}
  dump_json(out, C.WEB_DATA / "nrt" / "current_season.json")
  ```
  (After Plan 007, `run` takes `today` and `out` has `era`/`sensor`.)
- Everything under `web/public/data/nrt/` is uploaded by the daily `nrt`
  job and deployed (`.github/workflows/deploy.yml:28-29`, `deploy` job
  download at 43–44) — a file written there ships with **no workflow change**.
- District names: `C.WEB_DATA / "aoi" / "districts.geojson"`, features with
  `properties.unit_id` and `properties.name_en` (e.g. `BD1004`, `Barguna`).
- Site URL: `kilnwatch/ask.py:22` — `SITE = "https://aalvee-aarham.github.io/kiln-watch"`
  (import it lazily inside the function: `from .ask import SITE`).
  District page route: `#/area/<unit_id>` (`web/src/main.tsx:38`); season
  page `#/season` (line 55).
- Safety checks: `export.check_public_dir` (`export.py:119-145`) scans only
  `*.json` and `*.geojson`, and `assert_public_safe` checks dict keys
  against `C.FORBIDDEN_PUBLIC_KEYS` — **an XML file is not checked**, so this
  plan tests the feed's content itself. Size budgets: `export.BUDGET`
  (`export.py:18-20`, e.g. `"nrt/current_season.json": 300_000`).
- Writes are atomic (CLAUDE.md conventions): `from .ingest import atomic_write`.
- Web: `web/index.html` `<head>` (title at line 15); the "This season" page
  is `ThisSeasonPage` in `web/src/pages/OtherPages.tsx`. `dataUrl(rel)`
  (used in `AreaPage.tsx:85`) builds a URL to a data file.

## Commands you will need

| Purpose | Command (repo root) | Expected |
|---|---|---|
| Install | `pip install -r requirements.txt -c constraints.txt` (Python 3.11) | exit 0 |
| Lint | `python -m ruff check .` | "All checks passed!" |
| Tests | `python -m pytest -q` | all pass |
| Web | `cd web && npm run lint && npm run typecheck && npm test -- --run` | exit 0 |
| Web build + e2e | `cd web && DATA_SRC=fixtures FIXTURE_BRANCH=nokiln npm run build && npm run e2e` | all pass |

## Scope

**In scope**:
- `kilnwatch/nrt.py` — a pure `alerts_atom()` and its call in `run()`
- `kilnwatch/export.py` — one `BUDGET` entry
- `tests/test_nrt.py` — feed tests
- `web/index.html`, `web/src/pages/OtherPages.tsx` — feed discovery and a link
- `docs/operations.md`, `docs/data-contracts.md`

**Out of scope**:
- Workflows (the existing `nrt/` artifact already carries the file).
- Email, push or any server component.
- Fixture generation (`kilnwatch/fixtures.py`) — fixtures have no feed; the
  page link only shows when the file exists.
- Any kiln-level content: the feed is district-level only (invariant 3).

## Git workflow

- Branch `plan-009-alert-feed`; commits `feat(nrt): <...>`, `feat(web): <...>`.
- No push/PR unless instructed.

## Steps

### Step 1: Record each district's latest unusual day

In the districts loop in `run()`, alongside `above`, compute the last day
above normal:

```python
last_day = None
if f.exists():
    p90 = ...
    over = np.flatnonzero(h > p90[np.arange(n_days) % 366])
    above = int(len(over))
    last_day = (day0 + pd.Timedelta(days=int(over[-1]))).strftime("%Y-%m-%d") if len(over) else None
```

Keep `districts[dist_id]` exactly as before (no new JSON field); collect
`(dist_id, above, last_day)` in a local list `alert_rows` for Step 3.

**Verify**: `python -m pytest tests/test_nrt.py -q` → all existing tests pass.

### Step 2: A pure Atom builder

Add to `nrt.py`:

```python
def alerts_atom(season: str, updated_at: str, rows: list[dict], site: str) -> str:
    """Atom feed: one entry per district with unusual days. An entry's id includes the day count, so each new
    unusual day appears in readers as a new item; ordering and timestamps come from the data, not the clock."""
    import xml.etree.ElementTree as ET

    A = "http://www.w3.org/2005/Atom"
    ET.register_namespace("", A)
    feed = ET.Element(f"{{{A}}}feed")
    ET.SubElement(feed, f"{{{A}}}title").text = "Kiln Watch: districts with unusual fire activity (provisional)"
    ET.SubElement(feed, f"{{{A}}}id").text = f"{site}/data/nrt/alerts.xml"
    ET.SubElement(feed, f"{{{A}}}updated").text = updated_at
    ET.SubElement(feed, f"{{{A}}}link", rel="self", href=f"{site}/data/nrt/alerts.xml")
    ET.SubElement(feed, f"{{{A}}}link", rel="alternate", href=f"{site}/#/season")
    ET.SubElement(ET.SubElement(feed, f"{{{A}}}author"), f"{{{A}}}name").text = "Kiln Watch"
    for r in sorted(rows, key=lambda r: (r["last_day"], r["unit_id"]), reverse=True):
        e = ET.SubElement(feed, f"{{{A}}}entry")
        days = "day" if r["days"] == 1 else "days"
        ET.SubElement(e, f"{{{A}}}title").text = f"{r['name']}: {r['days']} unusual fire {days} so far in {season}"
        ET.SubElement(e, f"{{{A}}}id").text = f"{site}/#/area/{r['unit_id']}?season={season}&days={r['days']}"
        ET.SubElement(e, f"{{{A}}}updated").text = f"{r['last_day']}T00:00:00Z"
        ET.SubElement(e, f"{{{A}}}link", rel="alternate", href=f"{site}/#/area/{r['unit_id']}")
        ET.SubElement(e, f"{{{A}}}summary").text = (
            f"Fire activity in {r['name']} district was above its 90th-percentile normal on {r['days']} {days} "
            f"this season, most recently {r['last_day']}. Provisional near-real-time data from NASA FIRMS.")
    return ET.tostring(feed, encoding="unicode", xml_declaration=True)
```

`rows` items: `{"unit_id", "name", "days", "last_day"}`; only districts
with `days > 0` are passed in.

**Verify**: `python -c "from kilnwatch.nrt import alerts_atom; print(alerts_atom('2026-27', '2026-11-10T03:00:00+00:00', [], 'https://x')[:60])"`
→ starts with `<?xml version='1.0' encoding='utf-8'?>`.

### Step 3: Write the feed in `run()`

After `dump_json(out, ...)`:

```python
from .ask import SITE
from .ingest import atomic_write

aoi = json.loads((C.WEB_DATA / "aoi" / "districts.geojson").read_text(encoding="utf-8"))
names = {f["properties"]["unit_id"]: f["properties"]["name_en"] for f in aoi["features"]}
rows = [{"unit_id": d, "name": names.get(d, d), "days": n, "last_day": last} for d, n, last in alert_rows if n > 0]
atomic_write(C.WEB_DATA / "nrt" / "alerts.xml", alerts_atom(season, out["updated_at"], rows, SITE))
```

If `aoi/districts.geojson` is missing, fall back to `names = {}` (the feed
uses ids) — wrap the read in `if (...).exists()`.

Add `"nrt/alerts.xml": 100_000` to `export.BUDGET`.

**Verify**: `python -m ruff check .` → clean.

### Step 4: Tests in `tests/test_nrt.py`

1. `test_alerts_atom_is_valid_and_orders_by_latest_day` — call
   `alerts_atom("2026-27", "2026-11-10T03:00:00+00:00", rows, "https://example.org/kw")`
   with rows `[{"unit_id": "BD3026", "name": "Dhaka", "days": 3, "last_day": "2026-11-08"}, {"unit_id": "BD1004", "name": "A & B", "days": 1, "last_day": "2026-11-09"}]`.
   Parse with `xml.etree.ElementTree.fromstring` (namespace
   `{http://www.w3.org/2005/Atom}`). Assert: 2 entries; the first entry's
   title is `"A & B: 1 unusual fire day so far in 2026-27"` (later day
   first; `&` survives escaping); the second's link `href` is
   `"https://example.org/kw/#/area/BD3026"`; its id ends with `days=3`;
   its `updated` is `"2026-11-08T00:00:00Z"`.
2. `test_alerts_atom_id_changes_only_when_the_count_changes` — the same
   district with `days` 3 vs 4 gives different entry ids; the same inputs
   twice give byte-identical output (deterministic).
3. `test_alerts_feed_has_no_forbidden_names` — build a feed from the rows in
   test 1 and assert no name in `C.FORBIDDEN_PUBLIC_KEYS` appears in the
   text (`assert not [k for k in C.FORBIDDEN_PUBLIC_KEYS if k in xml]`).
4. If Plan 007's rehearsal helper `_rehearse` exists in this file, extend
   `test_rehearsal_after_snpp_ends_uses_noaa20` to also assert
   `(tmp_path / "data" / "nrt" / "alerts.xml").exists()` and that it parses.
   If the helper does not exist, STOP (Plan 007 must land first).

**Verify**: `python -m pytest tests/test_nrt.py -q` → all pass (3 new, 1 extended).

### Step 5: Discovery on the site

- `web/index.html` `<head>`, after `<title>`:
  `<link rel="alternate" type="application/atom+xml" title="Kiln Watch: unusual fire activity" href="data/nrt/alerts.xml" />`
  (relative to the `/kiln-watch/` base).
- `OtherPages.tsx` `ThisSeasonPage`: show a "Get alerts (Atom feed)" link
  to `dataUrl('nrt/alerts.xml')` **only when the file exists** — fixtures
  and offline copies have no feed. Check once with
  `fetch(dataUrl('nrt/alerts.xml'), { method: 'HEAD' })` in a `useEffect`,
  store `ok` in state, and render
  `<a className="btn" href={dataUrl('nrt/alerts.xml')}>Get alerts (Atom feed)</a>`
  plus one muted sentence: "Add this link to a feed reader, Outlook or a
  Slack/Teams RSS app to hear when a district runs above normal."

**Verify**: `cd web && npm run lint && npm run typecheck && npm test -- --run` → exit 0;
`DATA_SRC=fixtures FIXTURE_BRANCH=nokiln npm run build && npm run e2e` → all
pass (no feed in fixtures, so no link renders).

### Step 6: Docs

- `docs/data-contracts.md`: add a row for `nrt/alerts.xml` — "Atom feed:
  one entry per district with `above_p90_days > 0`; entry id includes the
  count; district-level only; 100 KB".
- `docs/operations.md`, "Daily deploy" step 1: "…and writes
  `nrt/alerts.xml`, the Atom feed of districts above normal."

**Verify**: `grep -c "alerts.xml" docs/data-contracts.md docs/operations.md` → each at least `1`.

## Test plan

Step 4: pure-function tests (structure, ordering, escaping, id semantics,
determinism, forbidden names) plus one end-to-end assertion through Plan
007's rehearsal. Fixed expected values only.

## Done criteria

- [ ] `python -m ruff check .` exits 0; `python -m pytest -q` exits 0 with the new feed tests
- [ ] `grep -c '"nrt/alerts.xml"' kilnwatch/export.py` → `1`
- [ ] Web lint, typecheck, unit tests, nokiln build and e2e pass
- [ ] `grep -c 'application/atom+xml' web/index.html` → `1`
- [ ] Scope check: `git diff --name-only 98fa82a -- . ':!plans'` lists only this plan's in-scope files (plus Plan 007's, if it landed in the same branch)
- [ ] `plans/README.md` row updated

## STOP conditions

- Plan 007 has not landed (no `today` parameter in `nrt.run`) — do 007 first.
- The excerpted districts loop differs from Current state beyond Plan 007's changes.
- Any feed text would need data finer than a district (an upazila, a
  cell, a coordinate) — that is out of scope and against invariant 3.

## Maintenance notes

- Readers dedupe by entry id: changing the id scheme re-notifies every
  subscriber once. Change it only deliberately.
- If the team later wants per-district feeds, generate
  `nrt/alerts/<unit_id>.xml` from the same builder (one more loop), and add
  a budget for the folder.
- The feed inherits the NRT data's provisional status; every entry says so.
