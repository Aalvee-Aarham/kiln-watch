# Judge Q&A

**Why not just use FIRMS counts?** Counts mix sensors with different sensitivity and ignore clouds. A cloudy monsoon day with zero detections is "not observed", not "no fire". We divide by Earth Engine cloud-free land fractions and convert every sensor to Aqua-MODIS equivalents.

**How do you know the harmonization works?** (1) The pre-registered seam test passes: the 2012 jump falls to 3% of raw and the break disappears (Chow p 0.29). (2) Aqua, the same instrument across 2012, sits inside our band (23.4 corrected vs 23.7 observed in 2012-13), and on district-months both saw, VIIRS reads 4.4× Aqua raw and 1.04× corrected (concordance 0.62 → 0.98). (3) Leave-one-season-out validation; coverage was 0.985, above our 0.97 ceiling, so our intervals are conservative. We report that as a FAIL rather than move the goalposts.

**Why did kiln detection fail?** Fixed-chimney and zigzag kilns burn inside enclosed structures, under a layer of ash. The hot area is small and shielded, so its integrated radiance stays below the VIIRS 375 m detection threshold. FIRMS never flags kilns as static sources either (type=2 overlap was 0). In 14 years, at every confidence level, only 37 of 3,653 clusters ever produced a single night detection. ECOSTRESS (70 m, night) does not see them either. Landsat thermal (100 m, day) sees the kiln *structure* as a warm spot all year, firing or not. VIIRS Nightfire has needed a paid licence since January 2025, so GN stays untested.

**Then how do you see kilns?** Not as heat but as activity. Kilns run day and night through the season with workers on site, so the kiln sites brighten in NASA Black Marble night lights (VNP46A2) from November to April, compared with their own matched control sites and their own monsoon level. Sentinel-1 radar gives an independent check: brick stacks build up in the yard during the season.

**You tried six channels. Isn't that a fishing expedition?** All six are reported, failures included. Only the pilot (400 Dhaka clusters, one season) was exploratory. Before the confirmatory test we wrote the rules down as a dated amendment (`PREREGISTRATION_AMENDMENTS.md`), then ran it on the 3,253 clusters the pilot never used and on a season the pilot never touched (2022-23). It passed all four rules, including a placebo where a control site stands in for the kiln and the signal vanishes (p = 0.58).

**Why does the kiln night-light signal grow over the years?** The kiln season has lengthened (about 90 → 150 days), and its peak brightness has risen too. Part of that could be more electric lighting at kilns rather than more brick-making. That is why we report season *timing*, which is measured against each season's own peak, and not brightness as an activity index. Non-claim: night lights are not emissions.

**Doesn't that kill the project?** No. The harmonized calendar was always the core and ships in full. The negative result is itself useful: it warns everyone using fire counts as a kiln proxy. And the kiln season now has its own calendar, from the right sensor.

**Suomi NPP stops delivering data on 2 November 2026. Does the site still update?** Yes. The daily job carries on with NOAA-20, and the calibration chain Aqua ← S-NPP ← NOAA-20 keeps every year on the same scale. The NOAA-21 link is set up but not yet calibrated: there are not yet enough months in which both satellites' near-real-time data overlap.

**Was anything decided after seeing the data?** No. `PREREGISTRATION.md` was committed before analysis (see git history). Two plan defects found during the build (the A2 cell-count bound and the control-spacing wording) are logged in `BLOCKERS.md` with reasons.

**Privacy?** Public files carry area-level statistics only. Two automated checks (field names and values) block any kiln-level data before publication.

**Can it run elsewhere?** The method uses only global NASA data, so the same steps can run for any region, but each region needs its own calibration, tested by the same rules before it is shown; the Bangladesh calibration is not reused. Bangladesh is live. The South Asia pre-registration is drafted (`docs/amendment5_draft.md`), not yet agreed or run. For kilns: the fire-satellite classifier failed in Faisalabad, as G1/G2 predicted; the night-light method passed in Pakistan and India on a retest (Amendment 4) and failed in Afghanistan (Amendment 3).

**What does the AI agent actually do?** Ask Kiln Watch (`kilnwatch/ask.py`) gives Claude five project functions: find an area, its fire calendar, this season so far, the two-week outlook and the harmonization evidence. Claude chooses which to call, in at most 6 steps, and writes a short answer in English or Bangla. It never computes: `guard()` blocks any answer stating a number no function returned. From the command line it answers any question live; the website shows saved answers to demo questions, with every function call and result.

**Why anchor to S-NPP after 2012 rather than keep Aqua?** Aqua's orbit began drifting in 2022. In the money-shot figure the blue Aqua line falls away in 2021-22 and 2022-23 while the harmonized series holds. The calibration window (2012-13 … 2020-21) ends before the drift for exactly this reason.
