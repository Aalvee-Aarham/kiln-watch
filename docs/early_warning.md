# Early warning: the `#/warnings` page

Branch `feat/early-warning` (based on `first-merge`). Added 24 Oct 2026.

## What it does

A new **Fire warnings** page (`#/warnings`, "Warnings" in the nav, after My area) answers "where should we look first?" for every district of Bangladesh. It is meant for both responders (DoE, emergency staff) and the public: one ranked list, plain sentences, district names in English and Bangla.

Districts are sorted into four groups, most urgent first:

| Group | Rule | Sorted by |
|---|---|---|
| Unusual fire in the last two weeks | The district's latest unusual day is less than 14 days before the last day of data | Most recent first, then most unusual days this season |
| In their critical burning period now | Today falls inside one of the district's critical periods | Most unusual days this season |
| Critical period starts within two weeks | The next critical period starts within 14 days (the **season-start heads-up**) | Soonest first |
| All other districts (collapsed) | None of the above | Next critical period, soonest first |

Each row says why, for example: *"Last unusual day 3 days ago · 4 days unusual this season · critical period starts 1 Nov 2026, in 27 days"*, and opens the district's My area page. When `outlook.json` ships (its backtest beats a normal year), the row also shows the two-week chance of an unusual day beside the usual chance.

**Terms.** An *unusual day* has more fire than 9 in 10 past seasons had on that date (above the district's p90 normal). A *critical period* is a stretch of at least 7 days when the district's typical (p50) day is in the busiest quarter of its year (`metrics.flags`). Both already existed in the pipeline.

## No new forecast

The page only combines outputs that already exist and are already tested: this season's unusual days, the calendars' critical periods (from every season since 2003), and the two-week outlook, which appears only when it passes its own backtest. The season-start heads-up is a historical pattern ("this district's critical period usually starts on 1 Nov"), not a prediction, and the page says so. This keeps the project rule that a forecast is shown only after it beats a normal year.

## How the data gets there

The page must not download 64 calendar files (about 150 KB each) to rank the districts. The daily `nrt` job already opens each district's calendar to read its p90 normal, so it now also writes two small fields per district into `nrt/current_season.json`:

- `last_unusual`: the date of the latest unusual day this season, or `null`
- `critical`: a copy of the calendar's critical windows (day-of-season pairs, inclusive, 0 = 1 July)

The page then reads only `nrt/current_season.json`, `outlook.json` (optional) and `aoi/districts.geojson`. Both fields are optional in the TypeScript type: with an older live file the page still lists districts and notes that critical periods appear after the next daily update. **The live site picks the fields up on the next daily deploy; no full pipeline re-run or data release is needed.**

## Files changed

| File | Change |
|---|---|
| `kilnwatch/nrt.py` | Reads each district calendar once; writes `last_unusual` and `critical` per district |
| `kilnwatch/fixtures.py` | Synthetic live files get the two fields, with no new random draws (every other fixture file stays byte-identical) |
| `web/fixtures/{full,from2012,nightfire}/data/nrt/current_season.json` | Regenerated: only the two new fields differ |
| `web/src/lib/warnings.ts` (new) | `nextCritical` (current or next critical window, wrapping to next season) and `warningsFor` (levels and ranking) |
| `web/src/pages/WarningsPage.tsx` (new) | The page |
| `web/src/lib/outlook.ts` | `outlookFor` split: new `outlookWith` takes the "unusual in the last two weeks" flag directly, so the page needs no calendars. `outlookFor` behaves as before |
| `web/src/lib/types.ts` | `NrtSeason.districts[*]` gains optional `last_unusual` and `critical` |
| `web/src/main.tsx`, `components/ui.tsx`, `lib/i18n.ts` | Route, nav tab, nav labels (`warnings`, `warningsShort`) |
| `web/e2e/smoke.spec.ts` | `#/warnings` added to the pages rendered with no console errors |
| `docs/data-contracts.md`, `docs/web-frontend.md` | Contract and page/lib rows |
| `docs/VERIFICATION.md` | Two unsigned `WARN` rows for a person to check |

## Tests

- `tests/test_nrt.py::test_rehearsal_publishes_warning_inputs`: after a rehearsed daily run, every district's `critical` equals its calendar's, and `last_unusual` is set exactly when the district has unusual days, within the season.
- `web/src/lib/warnings.test.ts`: windows are inclusive at both ends; days-until counts; wrap to next season; the 13-vs-14-day "recent" boundary; group order; outlook only when it ships; older files without the new fields.
- Existing `outlook.test.ts` passes unchanged after the split.

Run at the time of writing: `ruff` clean; `pytest` (nrt, contracts, export) 78 passed, 1 skipped; web typecheck, lint, 196 unit tests and the `full` fixture build pass; Playwright smoke for `#/warnings` passes in day, night and phone width.

## For a person to check

- The Bangla headings and nav label (`docs/VERIFICATION.md`, `WARN` rows).
- After the first real daily run: the unusual districts match `#/season`, and a few critical-period dates match the shaded critical period on each district's calendar chart.
- Row text beyond the headings is English only, like the rest of the site's page bodies; district names show in both scripts.

## Not done

- No notifications or subscriptions: the existing Atom feed (`nrt/alerts.xml`, linked from the page via `#/season`) remains the way to be told.
- No new tested forecast of season start. If wanted, it would need its own backtest and a "ships only if it beats climatology" gate, as the outlook has.
