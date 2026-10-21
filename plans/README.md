# Implementation Plans — kiln-watch (refined against the 2026 Build Guide)

Refined on **2026-10-21** against HEAD `2f0b5eb` and the complete
`docs/resource/space-apps-2026-build-guide.html` (NASA Space Apps 2026,
Bangladesh Local Events). Files 001–009 are **as-built records** of finished
work (verified against the live code and test runs); 010–011 are the
**executable** plans the guide adds. Copy this folder over the repo's
`plans/` to adopt it.

**The challenge**: #9 — Harmonization of MODIS and VIIRS Hot Spots
(thermal sensing & wildfires, Advanced·Intermediate).

## The guide's clock (corrected deadlines — the repo previously said "13 Nov submission")

| Date | What | Owner |
|------|------|-------|
| **28 Oct** | Full challenge statements + NASA's named datasets publish. Re-check our data plan against NASA's list that day; if NASA names an uncached dataset, caching it is that day's only job. Also confirm the 2026 statement (not a 2025 carry-over — "a project built against a 2025 statement is not judged"). | team |
| 2–12 Nov | Pre-build window. **A full offline dry run must succeed by 12 Nov** (Plan 010). | team |
| **13 Nov 07:00** | Day one begins (registration, ceremony 10:30, mentors 11:30). Global Offers + Submission/Judging guides publish that morning — align `docs/AI_USE.md` wording with the official text (Plan 011). | team |
| **13 Nov 18:30** | 240-second local judging video due (Plan 010). | team |
| **14 Nov 12:00** | **Freeze features at noon.** 30-second global video due (English subtitles required). Last four hours: videos, project page, public repo — nothing else. Global window 14–15 Nov. | team |

## Where the points come from (score sheet → kiln-watch evidence)

| Criterion | Points | kiln-watch's evidence (already built unless noted) |
|---|---|---|
| Impact | 1–20 | Brick-kiln regulation for DoE inspectors; Bangladesh framing the guide explicitly rewards; responder brief on ExpertsPage; unusual-activity feed (009). |
| Creativity | 1–20 | The raw↔harmonised toggle across 2003–2026 *is* the guide's named killer demo for this challenge; the guarded Ask agent is the second surprise. |
| Validity | 1–20 | Deterministic `src`-side science with the model only explaining (the guide's core rule — kiln-watch was built this way); TrustPage's leave-one-season-out + "Do the cameras agree after correction?" overlap validation; provenance/facts drawers; `verify_firms` cross-check cron (006). |
| Relevance | 1–20 | FIRMS MODIS+VIIRS is the evidence layer, not decoration; datasets named on-page (HowPage, SensorsPage) — **must also be named out loud on camera** (010). |
| Presentation | 1–20 | The two videos (010) — this criterion is currently *unearned* until they exist. |
| Teamwork | 1–5 | Roles in README; commit history across members. |
| User experience | 1–5 | Static PWA, works offline, no training needed. |
| NASA data usage | 1–5 | Top band needs NASA + another source clearly shown: NASA FIRMS + NASA Black Marble night lights + the published Bangladesh reference + DoE context — say this explicitly on the project page (011). |
| Category named / repo access / page complete | 0/1 each | All three are 15 minutes of care (011). "The points teams most often throw away." |
| Women participation | +5% | Team includes women members — confirm the registration field reflects it (011 checklist). |

## Plans

| Plan | Title | Status |
|------|-------|--------|
| 001–006 | Ask-agent, cache, worker, data-ops | DONE — as-built records in this folder (one open code nit: 004's outage guard; one approval: 006's 0.75 rule) |
| 007 | S-NPP → NOAA-20 switch rehearsal | DONE — **live switch 2 Nov; watch the first J1-era deploy** (checklist in file) |
| 008 | License + citation metadata | DONE |
| 009 | Unusual-activity Atom feed | DONE |
| **010** | **Offline demo rehearsal + the two videos** | **TODO — P1, dated (12 / 13 / 14 Nov)** |
| **011** | **Project page + AI disclosure + submission hygiene** | **TODO — P1 (draft now; align wording 13 Nov; submit 14 Nov)** |

## Decisions outstanding (human, not code)

- `GEMINI_API_KEY` as the GitHub secret (daily ask.json refresh) and, only if
  the worker is ever deployed, `wrangler secret put` (005's runbook — KV id
  is still the placeholder; the site is complete without it).
- Approve the 0.75 FIRMS drift rule (006) — before 13 Nov.
- The three `_to fill_` sections in `docs/AI_USE.md` — the team's own words (011).
- **28 Oct statement re-check** (table above) — put it on the calendar now.
- Amendment 5 sign-off before any F9 regional work.

## Rules that disqualify (guide, verbatim substance)

Everything built stays open source (MIT chosen, LICENSE exists — 008); every
source cited, even free ones; **no recognisable name, voice or likeness of
anyone under 18** in any video or submission. Simulated data honestly
labelled costs nothing; presented as real costs everything.
