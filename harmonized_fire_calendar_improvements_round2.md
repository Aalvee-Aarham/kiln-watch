# Improvements, Round 2 — MODIS/VIIRS Fire Harmonization Brief

Research date: 2026-11-10. Hackathon: 14–15 November 2026.

**Scope.** These points add to the 23 in `harmonized_fire_calendar_improvements.md` and do not repeat them. Where a
point corrects that file or the master prompt, it says so.

**Evidence status.** The official challenge page was read in full. Every other fact comes from web-search summaries
of the linked sources, so open the source before quoting a number in the submission. Items marked *(verify)* have
thin or conflicting sources.

---

## A. Eligibility and rules — settle these first

1. **Check the pre-hackathon work rule before writing more code.** The official Participant FAQ says "Teams are not
   allowed to begin working on the challenges prior to the hackathon." Both briefs assume a platform built ahead of
   time, and the public `kiln-watch-2026` repository already appears in search results. Ask the Local Lead or Space
   Apps Connect, in writing, what is allowed before the window (research and learning the data, versus code), and
   plan the build and the repository history around the answer. If earlier code cannot be used, these briefs become
   the plan for a 48-hour build, and the cut line in point 48 becomes mandatory.

2. **Re-check scope on 13 November.** The challenge's Resources tab ("Resources will be available on Friday,
   November 13"), the Project Submission Guide and the Judging & Awards Guide are all published that day. Use the
   listed resources visibly; they show what the challenge authors expect teams to work with.

3. **Keep an AI-use log starting now.** The 2026 rules require each submission to describe how AI tools were used and
   to credit every external dataset, library and image in the references field; uncited material can be removed.
   Project videos should not show recognisable names, voices or faces. Teams are limited to six people.

4. **Drop the NASA framing and the "CHRONOS" name.** The master prompt's header "[NASA Earthdata] CHRONOS-FIRMS"
   reads as an official NASA product, and two competing entries already use "Chronos" (flare-chronos and FIREWORK
   CHRONOS). Credit "Data: NASA FIRMS" and keep an independent name.

## B. Facts both files get wrong or miss (as of 2026-11-10)

5. **Suomi-NPP has ended; treat it as a documented event.** This corrects point 1 of the improvements file. NASA
   Earthdata and FIRMS announced that the Suomi-NPP VIIRS active-fire stream stopped updating at 13:00 UTC on
   2 November 2026. The archive before that date stays available, and FIRMS directs users to NOAA-20 and NOAA-21.
   The master prompt's date was right; its "33% drop" and "0.0% step-change" figures are still unsupported. Keep
   deriving availability from the data, and show the real cutover as a headline result (point 22).

6. **MODIS end dates keep moving, and Aqua drifts too.** Terra's equator crossing time drifted from 10:30 to about
   09:00 by late 2025. Aqua is drifting later, to about 15:50 by August 2026. The master prompt corrects only Terra.
   The planned end of MODIS data collection differs between sources: LAADS (April 2025) gave about August 2026 for
   Aqua and January 2027 for Terra; CAMS (February 2026) gives January 2027 for Terra and about September 2027 for
   Aqua *(verify the current status)*. Calibrate every MODIS link on pre-drift years only (up to about 2020), and
   never hard-code an end date.

7. **Choose the reference orbit, not only the reference sensor.** The early-afternoon and post-midnight orbit (about
   13:30 and 01:30) is the only one observed continuously from 2002 (Aqua) through Suomi-NPP, NOAA-20, NOAA-21 and
   future JPSS satellites. The morning orbit has only Terra, and NASA states that no follow-on instrument is planned
   for it in NASA-managed missions. A "Terra + Aqua" reference therefore contains a morning component that would
   have to be modelled for every year after Terra ends. Make "Aqua-equivalent afternoon and night hotspots" the
   primary scale. Use Terra only to extend the record back to 2000–2002, through a Terra-to-Aqua link calibrated on
   2002–2020, with wider intervals.

8. **Fix the near-real-time seam under the "current month".** The challenge's main use case compares the current
   month with the historical median. The current month is always near-real-time (NRT) data, later replaced by
   standard processing, while the history is standard. FIRMS records this in the `version` field (for example
   `6.1NRT` versus `6.1`, and `2.0NRT` versus `2.0`). Measure the NRT-to-standard count difference on months where
   both exist, apply or report it, and label current-month cells as provisional.

9. **Carry `version` through the pipeline and never mix collections silently.** VIIRS Collection 2 uses reprocessed
   radiances and new quality flags that suppress spurious detections common in Collection 1. A collection change
   inside one satellite's series is a possible step of its own; test for it the same way as a satellite change.

10. **Do not treat the three VIIRS instruments as identical.** NOAA's NOAA-21 documentation reports fire radiative
    power (FRP) about 10% higher than Suomi-NPP and NOAA-20, because its M13 band is shifted and uses a different
    FRP coefficient. The NOAA-20 review found "no precise match" with Suomi-NPP. Keep a measured link per satellite,
    for counts and for FRP.

11. **Test the confidence filter instead of assuming it is neutral.** A 2025 preprint reports that low-confidence
    night detections are systematically absent from the VIIRS product, so "drop VIIRS low" removes daytime
    detections only. MODIS confidence (0–100) is a different scale. Report results with and without the filter, and
    calibrate on the filtered set that will actually be published.

## C. Harmonization method

12. **Replace the "14-stage physics" with one published mechanism: the detection limit.** A 2026 paper in
    Geoscientific Model Development shows that the FRP detection limit of MODIS and VIIRS is approximately a linear
    function of pixel area, with different coefficients by day and by night. The preprint gives about 3.7 MW for
    MODIS at nadir on a clear night; at the MODIS swath edge, where pixels approach 10 km², the limit is roughly ten
    times higher, while VIIRS stays nearly constant across its swath. FIRMS rows carry `scan` and `track`, so pixel
    area is known for every detection without any QA bitmask. Build a small forward simulator: group the VIIRS
    detections from one overpass into MODIS-sized footprints, sum their FRP, and keep a group only if it exceeds the
    MODIS limit for that pixel size. The result is a MODIS-equivalent hotspot count from first principles, and it
    still works in years with no MODIS data.

13. **Show that two independent routes agree.** Compare the simulator's VIIRS-to-MODIS ratio with the empirical
    overlap-period ratio, by region and month. Agreement is the strongest validity evidence available in a weekend;
    disagreement shows where the method is weak. No competitor found so far does this.

14. **Build the calibration backbone on near-simultaneous Aqua and Suomi-NPP overpasses.** The two share the same
    orbit phase, so pairs within about 10–15 minutes isolate the sensor effect from fire growth. This is the
    simultaneous-overpass design used in sensor cross-calibration, and Li et al. (2018) used contemporaneous
    Aqua and Suomi-NPP detections. Flare-chronos already reports 20,552 Aqua–Suomi-NPP pairs, so pairing alone does
    not differentiate; add sensitivity to the time threshold, and stratify by the scan angle of both sensors. Never
    calibrate Terra directly against VIIRS, because they observe a different hour of the fire day.

15. **Calibrate day and night separately.** Detection limits differ between day and night for both sensors, and
    VIIRS gains most at night. FIRMS provides `daynight`. Fit separate links and add the results.

16. **Make the link depend on fire regime, and test it on years when the regime shifts.** Published VIIRS-to-MODIS
    ratios vary widely: about 6.5 for crop-residue fires in Punjab; in Northeast Asia MODIS missed 65% of VIIRS fire
    pixels in forest and 83% in low-biomass land; one competitor measures 2.2–4.9 across its regions. A single ratio
    per area and month fails when the mix changes, for example a large-forest-fire year in a cropland region.
    Stratify by land cover or by cluster size (the number of adjacent detections), and hold out years with an
    unusual mix.

17. **State that the two directions are not symmetric.** Converting VIIRS to MODIS-equivalent discards information
    and is well-posed. Converting MODIS to VIIRS-equivalent must invent small fires that MODIS never saw. Publish
    the Aqua-equivalent record as the default, and label any VIIRS-equivalent reconstruction before 2012 as
    modelled, with visibly wider intervals. This gives a reasoned answer to the "which reference?" question that
    the master prompt leaves as a toggle.

18. **Use a count model with an exposure offset, and avoid regression dilution.** Fit each link as a ratio of sums,
    or as a Poisson or negative-binomial model with the logarithm of observing opportunity as an offset. Ordinary
    regression of MODIS on VIIRS, which several competitors use (one with a LightGBM Tweedie model), is biased
    toward a low slope because both sensors are noisy. Estimate the shrinkage strength from the data with a
    hierarchical or empirical-Bayes fit instead of fixing κ₀ = 50.

19. **Borrow NASA's own cloud and overpass correction.** The MODIS monthly Climate Modeling Grid fire products (the
    MOD14CM/MYD14CM family) provide cloud-and-overpass-corrected fire pixel counts and mean cloud fraction. Use
    their formulation in place of the master prompt's Ω with a 0.15 floor, and use the product as an external
    benchmark for the MODIS-era series. One measured fact worth citing: MODIS swath gaps alone cause about 12.5%
    mean monthly FRP omission relative to VIIRS in an Africa study, so the ratio also depends on latitude.

20. **Handle persistent heat sources with a multi-year location mask, and validate it.** Recent work masks
    refineries, gas flares and volcanoes with a multi-year prior, and a GOFC-GWIS dataset identifies static
    anomalies from detection counts and months of activity (14,892 sites over ten years). Small persistent sources
    such as brick kilns are visible to VIIRS and mostly invisible to MODIS, so they are where the 2012 step is most
    extreme; harmonize them as a separate series. Report the mask's precision and recall against an independent
    kiln or industrial inventory *(find and verify an open one)* before labelling anything a kiln.

21. **Keep FRP secondary; the literature disagrees on its direction.** Li et al. (2018) found VIIRS FRP sums 11%
    above MODIS. The VFEIv0 emission inventory scales VIIRS FRP up by 1.2 to match MODIS. One competitor measures
    VIIRS at 0.50–0.89 of MODIS. A 2026 Remote Sensing paper applies a cloud correction and a scan-angle correction
    before fusing the two. Present FRP per sensor with these caveats, not as one harmonized total.

## D. Validation that experts cannot wave away

22. **Run sensor-denial experiments; they simulate the future exactly.** (a) Pretend MODIS ended in 2016, harmonize
    2017–2020 from VIIRS alone, and compare with the real MODIS values. (b) Withhold Suomi-NPP for 2024 to October
    2026 and check that the harmonized series stays inside its stated interval. (c) Show the real series across
    2 November 2026. These three plots answer the challenge's stated goal for the harmonization phase, that "the
    sensor of origin no longer matters".

23. **Test chain closure.** The chain from NOAA-21 to NOAA-20 to Suomi-NPP to Aqua compounds error at each link.
    Compare the direct NOAA-20-to-Aqua link (2018–2020) with the composed one, and the direct NOAA-21-to-Suomi-NPP
    link (2024–2026) with the composed one. Report the mismatch as systematic error and widen the intervals by it.

24. **Estimate each satellite's noise by triple collocation.** Three VIIRS instruments flew together from 2024 to
    November 2026. Triple collocation estimates the random error of each without assuming any one is the truth; the
    ESA CCI Soil Moisture record uses it to set its merging weights. This replaces assumed variances in the
    inverse-variance stitch.

25. **Add placebo step tests.** Run the continuity test at dates with no satellite change to obtain its false-alarm
    rate. Test on the difference from a stable reference series, as climate-record homogenization does, so that real
    fire trends are not mistaken for artefacts. Report each step as an estimate with an interval, never as "0.0%".

26. **Prove the intervals are calibrated.** Check that 95% intervals contain about 95% of held-out values. If they
    do not, widen them, using a block bootstrap by year or conformal intervals. Several competitors draw uncertainty
    bands; none found so far shows coverage.

27. **Check that harmonization preserves trends.** Over 2003–2020 the trend (Sen slope) of the harmonized series
    should match the Aqua-only trend within uncertainty. If distribution mapping is kept for FRP, use a
    trend-preserving form such as quantile delta mapping.

28. **Test era parity with independent events.** Take dated fire events from NASA EONET, GDACS or national agency
    reports, and measure how often they appear as high-percentile periods before 2012 and after 2012. Equal hit
    rates across eras are direct, non-circular evidence of harmonization. This uses event records as labels, which
    is sounder than inferring anything from missing news.

29. **Publish one drift-signature figure.** Plot the monthly MODIS-to-VIIRS ratio from 2012 to 2026. A line that is
    flat until about 2020 and bends afterward is visible proof of orbit drift, and it justifies leaving late MODIS
    out of the calibration without any geostationary modelling.

## E. Calendar and product — match the challenge wording

30. **Lead with what the challenge text literally asks for.** The Objectives ask for "a calendar of burning activity
    showing the number of hotspots detected from the early 2000s to the present", by month and year, for a selected
    region and date range. Make the month-by-year matrix of harmonized hotspot counts the first screen, in units
    called hotspots. Offer fire cell-days and weekly views as secondary. The challenge text names only months, so
    pentads and ISO weeks need a stated local reason, such as short crop-burning windows.

31. **Answer the challenge's three questions in plain sentences.** Which periods of the year burn most, which years
    burned most, and how the current period compares with history. Generate one deterministic sentence for each,
    for example "October 2026 so far: higher than 23 of the previous 24 Octobers."

32. **Use median, percentile and rank instead of sigma.** The challenge says "historical median". Fire counts are
    skewed, so the master prompt's ±2σ "SFAI" thresholds misfire, and flare-chronos already uses robust z-scores.
    Report the percentile and the rank among years, in wording managers know from Global Forest Watch ("unusually
    high compared to the same week in previous years"). Do not claim rarity beyond what about 25 years can support.

33. **Add "critical periods" explicitly.** The challenge names them twice. From the harmonized climatology, compute
    the season start, peak and end (for example the weeks that contain the central 80% of annual activity), the
    season length, and whether these are shifting over the record. Add a cumulative-activity curve for the current
    year against the historical minimum, median and maximum. The combined GWIS seasonal record reaches back only to
    2012; an envelope from 2002 is a concrete gain to state in the pitch.

34. **Deliver the three downloads the challenge describes.** (a) A CSV of the hotspots found by the search, with the
    FIRMS columns plus satellite, static-source flag and processing version. (b) The calendar table with raw,
    harmonized, lower bound, upper bound, satellites used and coverage. (c) The charts as PNG or SVG, and a one-page
    printable area brief. The master prompt offers a single CSV.

35. **Specify the accessible colour ramp instead of offering a palette menu.** Default to a colour-blind-safe
    sequential ramp (cividis or viridis) on a logarithmic or quantile scale, because counts are heavy-tailed. Use a
    colour-blind-safe diverging ramp only for the difference from the median. Show unobserved or low-coverage cells
    with hatching or grey, never with the zero colour. Print the number in each cell, make the grid a real
    keyboard-navigable table, and never use emoji as the only status signal.

36. **Add a partner-agency preset and Spanish.** The challenge image is credited to CONAE, Argentina's space agency.
    CONAE's hotspot viewer serves Aqua, Terra, NOAA-20 and Suomi-NPP detections side by side, and a study of
    Argentina's national protected areas switches from MODIS (2003–2011) to VIIRS (2012–2020). Reproduce one of
    those protected-area series and show the 2012 step disappear. Offer Spanish and Bengali labels, and keep the
    Bangladesh preset as the local story.

37. **Treat early warning as a climatological outlook.** State what share of annual activity the next four weeks
    usually hold, and where this year is tracking. One competitor offers a 30-day machine-learning forecast; do not
    add one unless a hindcast beats climatology.

38. **Consider a "detected versus reported" panel.** The challenge's considerations list "Number of fires detected
    and reported". Where open official fire statistics exist for the area, plot them beside the satellite record
    with clear labels; otherwise link to the agency.

39. **Optional: rank the current fire among past events.** The challenge mentions "how a current fire compares with
    previous ones". NASA's open-source FEDS algorithm (the fireatlas repository) is the reference for grouping VIIRS
    detections into fire events. A simple space-time clustering with a top-ten table is enough. Label event sizes by
    sensor era, because they are not comparable across sensors.

## F. Technology and AI

40. **Numbers from tools, words from the model.** Render every figure in an AI answer from tool output through a
    template, and let the model write only the connecting prose. Cache answers for the demo areas, and show a
    deterministic summary when the free-tier API is rate-limited. Add a fixed set of about 20 questions with known
    answers and report the score. Flare-chronos already ships a grounded narrative service, so an evaluated one is
    the differentiator.

41. **Make the demo independent of live services.** Presets, calendars and evidence must load from committed
    snapshots if source.coop, GDELT or the model API fail during judging. Show a "last detection ingested" date per
    satellite; it doubles as live proof of the Suomi-NPP end. If the data mirror lags, top up the current month from
    the FIRMS API with a free key.

42. **Precompute a stratum ratio table for instant custom areas, and release it.** A table of links by region, land
    cover, month and day or night makes any drawn area fast, and gives small areas a prior to shrink toward.
    GFED5NRT (ESSD, 2026) scales VIIRS counts to the MODIS-era record with region- and biome-specific scalars from
    2012–2022; its reviewers asked for explicit uncertainty, and its authors call it a first step toward merged
    records. A small open table with validated intervals, deposited with a DOI, fills that stated gap and outlives
    the hackathon.

43. **Keep sensors pluggable.** Store one link per satellite in a table. NASA is examining Sentinel-3 SLSTR and
    METimage for the morning orbit; a design note that shows where they would slot in is enough.

## G. Competition positioning

44. **Know what is already table stakes.** More than 20 public repositories target this challenge. Most have
    overlap-period ratio calibration, a calendar and anomaly flags. The strongest found, flare-chronos (v2.0.1,
    9 November), has a 26-year by 73-pentad matrix, footprint reconstruction from scan angle, paired
    Aqua–Suomi-NPP calibration and AI narrative. FIREWORK plans VIIRS-equivalent cell-days with uncertainty bands,
    source labels and blind-spot warnings. Cell-days, uncertainty bands and AI narration no longer differentiate.

45. **Build on the open ground.** No public entry found shows: agreement between a physical model and the data
    (points 12–13); denial experiments that include the real 2 November cutover (22); measured satellite noise and
    calibrated intervals (24, 26); the near-real-time seam (8); era parity against independent events (28); or the
    partner agency's own case (36).

46. **Build the pitch on one figure and a claims table.** The hero figure is raw counts stepping up in 2012, 2018
    and 2024 beside the flat harmonized series. Follow it with the calendar, the current-month sentence and the
    download. Add a table that maps each claim to its evidence, and a limitations slide. Secondary sources list five
    judging criteria (impact, creativity, validity, relevance, presentation); confirm them in the guide on
    13 November. Finalists are reviewed by NASA and partner-agency subject-matter experts, so remove
    "zero-hallucination", "physically exact", "guarantees" and "0.0%" from every public text.

47. **Prepare for two audiences.** Local judging comes first and is general; global review is expert. Keep a
    plain-language story (a fivefold "rise in fires" in 2012 that was really a new satellite) and a methods
    appendix.

48. **Set the 48-hour cut line now.** Must have: area selection by drawing and by coordinates, a date range, the
    month-by-year harmonized calendar with the accessible ramp, the current-month comparison, the raw-versus-
    harmonized figure, the CSV download, and a methods page with the denial results. Next: interval coverage, season
    metrics, weekly view, Spanish and Bengali. Last: AI narration, MCP, events, news. Not this year: n8n, a 3D
    globe, multilingual RAG, burned area.

---

## Sources

**Challenge and rules**
- [Official challenge page](https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/?tab=details) (read in full)
- [Participant FAQ](https://www.spaceappschallenge.org/resources/participant-faqs/) · [Participant Terms and Conditions](https://www.spaceappschallenge.org/legal/) · [2026 event page](https://www.spaceappschallenge.org/2026/) · [Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide)
- [2025 Global Winners](https://www.spaceappschallenge.org/2025/awards/global-winners/)

**Sensor status**
- [Transitioning from Suomi NPP VIIRS & OMPS: What FIRMS Users Need to Know](https://www.earthdata.nasa.gov/news/blog/transitioning-from-suomi-npp-viirs-omps-what-firms-users-need-know)
- [MODIS to VIIRS Transition (LAADS DAAC)](https://ladsweb.modaps.eosdis.nasa.gov/learn/modis-to-viirs-transition) · [Aqua MODIS Acquisition Plan Through August 2026 (LP DAAC)](https://lpdaac.usgs.gov/news/aqua-modis-acquisition-plan-through-august-2026/) · [Terra orbital drift (MODIS Land)](https://modis-land.gsfc.nasa.gov/news.html)
- [Drifting away from MODIS in the CAMS Global Fire Assimilation System](https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system)
- [VIIRS Instruments Become More Essential As Terra and Aqua Drift](https://www.earthdata.nasa.gov/news/feature-articles/viirs-instruments-become-more-essential-terra-aqua-drift-traditional-orbits)
- [NASA continuity workshop slides (Sentinel-3 SLSTR, morning orbit)](https://www.earthdata.nasa.gov/s3fs-public/2023-03/RFI_TAA_continuity_workshop.pdf)
- [NOAA-21 Active Fires provisional readme](https://www.star.nesdis.noaa.gov/JPSS/documents/AMM/N21/NOAA-21_Active_Fires_Provisional_Readme.pdf) · [NOAA-20 Active Fire maturity review](https://www.star.nesdis.noaa.gov/JPSS/documents/AMM/N20/Land_ActiveFires_Iband_Beta_Provisional.pdf)

**FIRMS data details**
- [Active Fire Data Attributes for MODIS and VIIRS](https://www.earthdata.nasa.gov/data/tools/firms/active-fire-data-attributes-modis-viirs) · [FIRMS FAQ](https://www.earthdata.nasa.gov/data/tools/firms/faq)
- [VIIRS Collection 2 375 m Active Fire User Guide](https://ladsweb.modaps.eosdis.nasa.gov/archive/Document%20Archive/Science%20Data%20Product%20Documentation/VIIRS_C2_AF-375m_User_Guide_1.0.pdf) · [MODIS Fire User Guide, Collection 6.1 (CMG products)](https://LPDAAC.USGS.GOV/documents/1005/MOD14_User_Guide_V61.pdf)
- [Systematic Absence of Low-Confidence Nighttime Fire Detections in VIIRS (preprint)](https://arxiv.org/pdf/2510.26816)

**Harmonization science**
- [Observation operator and detection limits for MODIS and VIIRS FRP products (GMD, 2026)](https://gmd.copernicus.org/articles/19/10123/2026/)
- [Li et al. 2018, Comparison of FRP estimates from VIIRS and MODIS](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2017jd027823)
- [FRP correction and spatiotemporal fusion of MYD14 and VNP14IMG (Remote Sensing, 2026)](https://doi.org/10.3390/rs18101650)
- [MODIS versus VIIRS in Northeast Asia](https://doi.org/10.3390/rs12182870) · [FRP missed by MODIS in Africa](https://www.mdpi.com/2072-4292/12/10/1561) · [MODIS Aqua versus VIIRS in Punjab](https://pmc.ncbi.nlm.nih.gov/articles/PMC6108185/)
- [VFEIv0 VIIRS-based emission inventory](https://gmd.copernicus.org/articles/15/8085/2022/gmd-15-8085-2022.html) · [GFED5NRT (ESSD, 2026)](https://essd.copernicus.org/articles/18/7535/2026/)
- [Prior-based mask for persistent heat sources (Remote Sensing, 2026)](https://www.mdpi.com/2072-4292/18/6/904) · [GOFC-GWIS global static thermal anomalies](https://gofcgold.umd.edu/sites/default/files/2024-11/GOFC_GWIS_2024_Roberts_short.pdf)
- Cross-sensor harmonization in other fields: [ESA CCI Soil Moisture ATBD (CDF matching, triple collocation)](https://admin.climate.esa.int/media/documents/ESA_CCI_SM_RD_D2.1_v2_ATBD_v06.1_issue_1.1.pdf) · [Harmonized DMSP–VIIRS night lights](https://www.nature.com/articles/s41597-020-0510-y)

**Existing tools and partner agency**
- [NASA FEDS / fireatlas documentation](https://earth-information-system.github.io/fireatlas/docs) · [fireatlas repository](https://github.com/Earth-Information-System/fireatlas)
- [Global Forest Watch fire data](https://blog.globalforestwatch.org/fires/wildfire-trends-gfw-fire-data/) · [GFW on the Brazil fires](https://www.wri.org/insights/what-can-global-forest-watch-tell-us-about-fires-brazil) · [Our World in Data note on the GWIS record](https://ourworldindata.org/grapher/annual-number-of-fires)
- [CONAE hotspot viewer manual](https://catalogos5.conae.gov.ar/catalogofocos/Docs/035_CONAE_AQUA_TERRA_NOAA20_MODIS_VIIRS_FC_VISOR_ManualUsuarios_e02.pdf) · [Argentine protected-areas hotspot study](https://sib.gob.ar/novedades/caracterizacion-de-la-situacion-de-incendios-en-las-areas-protegidas-nacionales-de-argentina-a-partir-de-focos-de-calor-modis-y-viirs-periodo-2003-2019)

**Competing entries (public repositories)**
- [flare-chronos](https://github.com/the-aris-club/flare-chronos) · [FIREWORK_2](https://github.com/Dhruvsharma-DSAS/FIREWORK_2) · [firelens](https://github.com/shahmirkhan106/firelens) · [NasaSpaceApp2026](https://github.com/Vtheonly/NasaSpaceApp2026) · [SOHAM-0409](https://github.com/SOHAM-0409/NASA-Space-App-Challenge) · [TerraHarmonia](https://github.com/Rangga11268/TerraHarmonia) · [PruebaNASA](https://github.com/DenzelPereyda0248/PruebaNASA) · [FireHarmonize](https://github.com/harishk2086/FireHarmonize)
- [FireChronicle](https://github.com/bhavishyaone1/FireChronicle) · [Chronofire](https://github.com/shahedrayhan23/Chronofire) · [Emberline](https://github.com/AbhiramNimmala/Emberline) · [EarthFire](https://github.com/ehasanulhaque152/EarthFire) · [NPC_SpaceApps](https://github.com/ImtiazIftii/NPC_SpaceApps) · [Project_S.H.I.F.T](https://github.com/nasifnaser06-cyber/Project_S.H.I.F.T) · [EarthGuard](https://github.com/ekosantoso/earth)
