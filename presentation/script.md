# Kiln Watch: 2-minute pitch script

**[0:00 Hook]** In 2012 NASA's sharper VIIRS camera joined the older MODIS cameras, and fire counts jumped. Nothing new was burning. The camera had changed. MODIS ends in 2027, and without a bridge, more than twenty years of fire history cannot be compared with the years to come.

**[0:15 Problem: `money_jump.png`]** MODIS sees the ground in 1 km squares; VIIRS in 375 m squares, about seven to one MODIS square. VIIRS notices small fires MODIS misses. Join the two records as they are and our first region, Bangladesh, shows a jump of 55 units in a single season. It comes from the camera, not the land.

**[0:30 How we harmonize]** Kiln Watch puts both cameras on one scale in four steps. We match the days both cameras saw the same ground. We learn an exchange rate between them, by region, month, and day or night. We correct for cloud, because a cloudy day is "not seen", not "no fire". And every number gets a 95% range.

**[0:50 Proof]** The fake 2012 jump falls from 55.1 to 1.6 units: **97%** of it was the camera. A break test that fires on the raw record (p = 0.00006) goes quiet after correction (p = 0.29). The cameras now agree: VIIRS read **4.4×** MODIS; corrected, **1.04×**, and the agreement score rises from 0.62 to **0.98**. Our corrected 2012-13 value, 23.4, matches what MODIS saw directly, 23.7. We publish the failures too: our ranges turned out too wide, not too narrow.

**[1:05 The calendar: My area]** Pick an area. You get every day since 2003 on one scale: the normal season, the unusual days, the critical weeks, this season updated daily from NASA FIRMS, and a tested two-week outlook. In English and Bangla.

**[1:20 The AI agent: Ask Kiln Watch]** Ask "Is this fire season unusual?" in plain words. The agent picks its own steps: it finds the area, then calls our calendar, this-season and outlook functions on NASA FIRMS data. Our code computes every number; the AI only explains, and an answer with a number our code did not return is blocked. Each answer shows the data behind it.

**[1:35 Two extensions]** Extension 1, crops: each area's burning is split into the Aman and Boro harvest windows, so farm officers can plan around them. Extension 2, kilns: fire satellites cannot see enclosed brick kilns, so we read the kiln season from NASA Black Marble night lights and checked it with Sentinel-1 radar. In a pre-registered test, 72% of 3,253 held-out kiln clusters light up in kiln season, and the season has grown from about 3 to about 5 months.

**[1:50 Who and what next]** Emergency responders and forest officers, farm officers, inspectors and scientists. Bangladesh is live; South Asia is in progress, each region tested before it is shown. Next, we want to pilot with forest and fire services.

**[1:58 Close]** Kiln Watch: one fire record from MODIS and VIIRS, and a burning calendar for any area.
