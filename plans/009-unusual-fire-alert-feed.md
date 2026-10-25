# Plan 009: Static Atom feed of unusual districts — refined as-built

> Refinement of `plans/009-unusual-fire-alert-feed.md`, verified against
> HEAD `2f0b5eb` on 2026-10-21. Complete; no executable work remains.

## Status

- **DONE** — commit `75fdb6a` ("feat(nrt): publish a static Atom feed of
  districts with unusual fire activity"), with a review fix in `fa5deee`
  (the builder now uses a plain `xmlns` attribute instead of registering a
  namespace process-wide).

## What shipped (verified 2026-10-21)

- `kilnwatch/nrt.py` — `alerts_atom(season, updated_at, rows, site)` at
  line 37: a pure builder (no clock, no I/O — testable), called by `run()`,
  writing the feed under `web/public/data/nrt/` atomically. Because the
  daily job already uploads that whole directory, the feed ships with **no
  workflow change**.
- One feed item per district gaining an unusual (`above_p90`) day, linking
  to that district's page — DoE analysts can watch it in any feed reader;
  the site stays serverless.
- `web/index.html` declares feed discovery; the season page links it.
- A `BUDGET` entry bounds the file size; feed content is tested (the XML is
  outside `assert_public_safe`'s `*.json`/`*.geojson` scan, so the tests
  carry the safety burden — as the plan specified).

## Verify today

```bash
python -m pytest tests/test_nrt.py -q     # feed builder tests, in the 204
```

## Follow-ups

- Operator check when convenient: confirm the feed is reachable and valid
  on the live site (`https://aalvee-aarham.github.io/kiln-watch/data/nrt/…`)
  after any daily deploy, and subscribe one team reader to it as a canary.

## Maintenance notes

- If Plan 005's worker gains a health-check later, `verify.yml` is the
  natural home — do not couple it to the feed.
