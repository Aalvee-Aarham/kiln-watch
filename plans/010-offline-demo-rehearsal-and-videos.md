# Plan 010: Offline demo rehearsal + the two judged videos

> **Executor**: the team (this plan is mostly human work with dated
> deadlines). Written 2026-10-21 against the 2026 Build Guide after every
> code plan (001–009) landed. Priority **P1** — Presentation (1–20) is
> unearned until these exist, and the guide's third deciding sentence is
> "the demo must run with the wifi off."

## Why this matters

The build guide's three score-deciding sentences: NASA data is the evidence
layer; deterministic code does the science; **the demo must run with the
wifi off** — "cache everything before the event and record a fallback
video." Two videos have hard deadlines: the **240-second local judging
video due day one at 18:30 (13 Nov)** and the **30-second global video due
14 Nov 12:00pm, English subtitles required** — "this is all a NASA judge
on the other side of the world will see." A full offline dry run must
succeed **by 12 November**.

## Current state (verified 2026-10-21)

- The site is a static PWA: service worker precaches the shell; data is
  precomputed into `web/public/data`; fixture builds
  (`DATA_SRC=fixtures FIXTURE_BRANCH=nokiln|full`) power 93 green e2e
  tests. The offline story is already real — it has just never been
  *rehearsed* as the guide demands.
- Cached `ask.json` answers work with no network; the BYO-key chat and the
  (undeployed) worker are optional extras — on the day, show the cached
  path or a hotspot, and say the live agent needs a key.
- No demo script, no recorded fallback, no video drafts exist
  (`ls docs/demo` → nothing; no `docs/*video*`).
- Plan 007's satellite switch is rehearsed; the event (13–14 Nov) runs in
  the NOAA-20 era, 11 days after S-NPP's last data day (2 Nov). The guide
  for challenge 9 says: "Say that in your video."

## Step 1 — The offline rehearsal (complete by 12 Nov)

Protocol, run at least twice before the event, second time on the venue
laptop:

1. `cd web && DATA_SRC=fixtures FIXTURE_BRANCH=full npm run build`
   then serve `dist/` locally, **wifi/adapter off**.
2. Walk the demo beats in order (see Step 2) against the offline build.
   Anything that fails offline is either a bug (fix it) or a live-only
   feature (cut it from the demo, say so honestly if asked).
3. Record the full pass as the **fallback video** (screen recording is
   fine — it exists so a dead projector or dead wifi cannot kill the demo).
   Store it with the submission materials, not in the repo (size).

**Verify**: rehearsal logged with a date ≤ 12 Nov; the fallback recording
exists and plays end to end.

## Step 2 — The 240-second local video (due 13 Nov 18:30)

Required content per the guide: team name, every member by name, the
problem and challenge statement, the solution approach, **NASA datasets
named out loud on camera**. Script beats (≈40s each):

1. **Problem + challenge** — name it: "Challenge 9, Harmonization of MODIS
   and VIIRS Hot Spots." Brick kilns, Bangladesh, DoE inspectors.
2. **The killer demo** — the raw↔harmonised toggle: raw counts step-change
   at the sensor transition; harmonised, the artefact disappears and the
   real seasonal signal shows. Then "is this unusual for this place at
   this time of year?" with the percentile answer.
3. **Why it can be trusted** — the Trust page: cameras-agree validation,
   leave-one-season-out, the provenance drawer behind a number ("open it
   during the demo — ten seconds, worth points").
4. **The timeliness beat** — S-NPP stopped 2 Nov; MODIS retires late 2026;
   this tool already runs on NOAA-20 with the switch marked on the page.
   Continuity is an operational problem, not an academic one.
5. **Datasets, out loud** — NASA FIRMS (MODIS + VIIRS on NOAA-20/21), NASA
   Black Marble night lights for kiln seasons, the published Bangladesh
   reference used for cross-checking.

**Rules**: clear English, 240 seconds understood by a global audience; no
recognisable name, voice or likeness of anyone under 18; confirm the exact
upload form with the Local Lead (the run of show differs per venue).

## Step 3 — The 30-second global video (due 14 Nov 12:00)

Team, problem, the thing working (the toggle), NASA data usage, impact —
**English subtitles required**. Thirty seconds is ~75 spoken words: write
it, time it, subtitle it. Reuse beat 2 and 5 above, compressed.

**Verify**: both videos uploaded per the Local Lead's form (240s) and the
global submission (30s) before their deadlines; subtitles present in the
30s cut.

## Done criteria

- [ ] Offline rehearsal performed on the venue laptop, dated ≤ 12 Nov
- [ ] Fallback recording of the full offline demo exists with the submission materials
- [ ] 240s video uploaded by 13 Nov 18:30 (challenge + datasets named on camera)
- [ ] 30s video with English subtitles uploaded by 14 Nov 12:00
- [ ] No under-18 name, voice or likeness anywhere in either cut

## STOP conditions

- The offline build fails on any demo beat → fix the bug or cut the beat;
  do not demo a live-only feature as if it were offline.
- The Local Lead's upload date differs from 13 Nov 18:30 → the Local Lead's
  date wins.
