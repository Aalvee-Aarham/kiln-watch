# Judge Q&A

**Why not just use FIRMS counts?** Counts mix sensors with different sensitivity and ignore clouds. A cloudy monsoon day with zero detections is "not observed", not "no fire". We divide by Earth Engine cloud-free land fractions and convert every sensor to Aqua-MODIS equivalents.

**How do you know the harmonization works?** (1) The pre-registered seam test passes: the 2012 jump falls to 3% of raw and the break disappears (Chow p 0.29). (2) Aqua, the same instrument across 2012, sits inside our band. (3) Leave-one-season-out validation; coverage was 0.985, above our 0.97 ceiling, so our intervals are conservative. We report that as a FAIL rather than move the goalposts.

**Why did kiln detection fail?** Fixed-chimney and zigzag kilns burn inside enclosed structures; the hot area is small and shielded, so integrated radiance stays below the VIIRS 375 m detection threshold. FIRMS also never flags them as static sources (type=2 overlap was 0). Night-time Nightfire (VIIRS DNB/SWIR) might, but EOG data needed credentials we lacked; it is the obvious next test.

**Doesn't that kill the project?** No. The harmonized calendar was always the core and ships in full. The negative result is itself useful: it warns everyone using fire counts as a kiln proxy.

**Was anything decided after seeing the data?** No. `PREREGISTRATION.md` was committed before analysis (see git history). Two plan defects found during the build (the A2 cell-count bound and the control-spacing wording) are logged in `BLOCKERS.md` with reasons.

**Privacy?** Public files carry area-level statistics only. Two automated checks (field names and values) block any kiln-level data before publication.

**Can it run elsewhere?** The grid spans 68–98°E, so the whole Indo-Gangetic Plain uses the same code. The Faisalabad transfer test is wired in.

**Why anchor to S-NPP after 2012 rather than keep Aqua?** Aqua's orbit began drifting in 2022. In the money-shot figure the blue Aqua line falls away in 2021-22 and 2022-23 while the harmonized series holds. The calibration window (2012-13 … 2020-21) ends before the drift for exactly this reason.
