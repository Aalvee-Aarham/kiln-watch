# Claims register — every pitch number with its source

| Claim | Value | Source | Geography / period |
|---|---|---|---|
| Raw VIIRS-era jump | d_raw = 55.1 season-activity units | `reports/harmonization_report.md` (seam) | Bangladesh, 2009-10/2010-11 vs 2012-13/2013-14 |
| Harmonized jump | d_harm = 1.6 → ratio 0.029 (pass ≤ 0.25) | same | same |
| Break test | Chow p raw 6.0e-5; harmonized 0.29 | same | seasons 2003-04 … 2024-25 excl. 2011-12 |
| Aqua check, 2012-13 | harmonized 23.4 [21.8–24.9] vs Aqua observed 23.7 | `web/public/data/harmonization.json` yearly | Bangladesh |
| Kiln detectability | DR(kiln)/DR(control) = 0.46, perm p = 0.96 (pass ≥ 3, p < 0.01) | `reports/gate_report.md` G1 | 3,653 clusters, 10,959 controls, season 2023-24 |
| Eligible clusters | 0 of 3,653 | same | same |
| MODIS (G2) | DR ratio 0.73, FAIL | same | same |
| Kiln inventory | 4,760 kilns (APAD, CC BY 4.0) | `reports/inventory_report.md` | Bangladesh |
| Detections analysed | 1,221,809 | `reports/ingest_counts.md` | BBOX 88–92.8°E, 20.5–26.7°N, 2003-01 → 2026-10 |
| LOSO coverage | 0.985 [0.982–0.987] — FAIL (conservative) | `reports/harmonization_report.md` | 9 calibration seasons |
| Kiln clusters ever detected at night by VIIRS | 37 of 3,653 (controls: 47 of 10,959) | `PREREGISTRATION_AMENDMENTS.md` P1 | Bangladesh, S-NPP + NOAA-20 + NOAA-21, all confidences, 2012–2026 |
| Kiln heat inside the fire calendar | 351 of 234,693 VIIRS detections (0.15%) on kiln footprints vs 0.14% on matched farmland | `reports/kiln_activity_report.md` | Bangladesh, Nov–May, nominal+high, 2012–2026 |
| Night-light test GL: share of held-out clusters with seasonal excess > 0 | 0.72 (pass ≥ 0.60) | `reports/kiln_activity_report.md` | 3,253 clusters (pilot excluded), season 2022-23 |
| GL replication | 13 of 13 seasons with median excess > 0 | same | 2012-13 … 2024-25 |
| GL placebo | median 0.004, Wilcoxon p = 0.58 (pass p > 0.05) | same | 2022-23 |
| Radar test GS (Sentinel-1 VV yard − ring) | median +0.30 dB, 62% of clusters > 0, 9/10 seasons, placebo p = 0.12: PASS | `reports/kiln_activity_report.md` | 3,253 held-out clusters, 2022-23; seasons 2015-16 … 2024-25 |
| Kiln season (national, night lights) | onset mid-Nov, end mid-Apr, peak Feb (recent seasons); length ≈ 90 d (2012-13) → ≈ 150 d (2022-25) | same, season table | Bangladesh, all 3,653 clusters |
