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
