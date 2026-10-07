# Submission draft (P2)

- **Project name:** Kiln Watch
- **Challenge:** Harmonization of MODIS and VIIRS Hot Spots (NASA Space Apps 2026)
- **High-level summary:** Kiln Watch harmonizes 20+ years of MODIS and VIIRS active-fire detections over Bangladesh into one calibrated, cloud-corrected burning calendar with uncertainty, for every district and upazila, updated daily and continuing after S-NPP's shutdown via NOAA-20/21. A pre-registered test shows that brick kilns, a major source of Dhaka's winter smog, are invisible to NASA fire products, so the fire calendar is not contaminated by them. We then found the NASA product that does see kilns: Black Marble night lights. In a held-out, pre-specified test, 72% of 3,253 kiln clusters brighten in the working season and a placebo shows nothing. That gives Bangladesh's first kiln-season calendar beside its fire calendar.
- **Link to project repository:** https://github.com/Aalvee-Aarham/kiln-watch
- **Link to final project (site):** https://aalvee-aarham.github.io/kiln-watch/
- **NASA data used:** FIRMS MODIS C6.1 and VIIRS 375 m (S-NPP, NOAA-20, NOAA-21) SP and NRT; MOD14A1/MYD14A1/VNP14A1 daily fire masks; Black Marble VNP46A2 night lights; ECOSTRESS L2T LSTE v2 and Landsat 8/9 Collection 2 surface temperature (tested for kilns, reported negative). All imagery via Google Earth Engine.
- **Space agency partner data:** Copernicus Sentinel-1 SAR and Sentinel-5P TROPOMI (ESA); ERA5-Land (ECMWF)
- **Other data:** APAD kiln inventory (CC BY 4.0), OCHA HDX boundaries (CC BY-IGO), OpenAQ (CC BY 4.0)
- **Use of AI:** Code written with an AI coding assistant (Claude) under human direction. The original analysis decisions were pre-registered by the team. Amendment 1 (kiln activity from night lights and radar) was proposed, pre-specified and run with the AI assistant at the team's request.
- **Build dates:** planning, pipeline, data processing and first results on 5–6 Oct 2026; the plain-language redesign and its interactive apps on 7 Oct 2026. The git history shows every date.
