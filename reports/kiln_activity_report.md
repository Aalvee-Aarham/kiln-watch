# Kiln activity report (Amendment 1)

Rules: PREREGISTRATION_AMENDMENTS.md. Pilot clusters are excluded from every test.

## Kiln heat inside the fire calendar (upper bound)

Of 234,693 Bangladesh VIIRS detections (Nov–May, nominal+high, 2012–2026), 0.150% fall on kiln-cluster footprints, against 0.142% on one set of matched-control footprints.

## Exploratory pilots (400 Dhaka clusters, 2023-24)

| Channel | Measure | Kiln | Control | Reading |
|---|---|---|---|---|
| FIRMS VIIRS active fire (S-NPP, NOAA-20, NOAA-21) | clusters with ≥ 1 night detection, 2012–2026 | 37 of 3,653 | 47 of 10,959 | invisible |
| ECOSTRESS 70 m land surface temperature (night) | site − surroundings, Dec–May | +0.52 K | +0.46 K | no signal |
| Landsat 8/9 surface temperature (day) | site − surroundings, Dec–Apr / other months | +2.4 / +1.8 K | +0.9 / +0.7 K | sees the kiln structure, not firing |
| Sentinel-5P TROPOMI SO₂ / NO₂ | winter excess vs kiln density (t) | t = 0.95 / −1.19 | — | no signal |
| NASA Black Marble night lights (VNP46A2) | Dec–Apr minus Jul–Oct radiance | +0.38 nW/cm²/sr (80% > 0) | −0.01 (49% > 0) | signal → test GL |
| Sentinel-1 radar VV (yard − ring) | Dec–Apr minus Jul–Oct | +0.47 dB | −0.10 dB | signal → test GS |

## GL (night lights): **PASS**

| Criterion | Value | Threshold | p | |
|---|---|---|---|---|
| Contrast: median A, 2022-23 (n = 3253) | 0.1952 | > 0, Wilcoxon p < 0.01 | 3.9e-154 | PASS |
| Prevalence: share of clusters with A > 0 | 0.72 | ≥ 0.60 |  | PASS |
| Replication: seasons with median A > 0 (13 evaluable) | 1 | ≥ 0.75 |  | PASS |
| Placebo: first control as pseudo-kiln (n = 3247) | 0.003974 | Wilcoxon p > 0.05 | 0.58 | PASS |

Median A by season: 2012-13 0.0873 (n=3253), 2013-14 0.0868 (n=3253), 2014-15 0.11 (n=3253), 2015-16 0.131 (n=3253), 2016-17 0.124 (n=3253), 2017-18 0.179 (n=3253), 2018-19 0.195 (n=3253), 2019-20 0.188 (n=3253), 2020-21 0.192 (n=3253), 2021-22 0.216 (n=3253), 2022-23 0.195 (n=3253), 2023-24 0.231 (n=3253), 2024-25 0.251 (n=3253)

## GS (Sentinel-1 radar): **PASS**

| Criterion | Value | Threshold | p | |
|---|---|---|---|---|
| Contrast: median A, 2022-23 (n = 3253) | 0.3024 | > 0, Wilcoxon p < 0.01 | 2.6e-58 | PASS |
| Prevalence: share of clusters with A > 0 | 0.6222 | ≥ 0.60 |  | PASS |
| Replication: seasons with median A > 0 (10 evaluable) | 0.9 | ≥ 0.75 |  | PASS |
| Placebo: first control as pseudo-kiln (n = 3253) | -0.02087 | Wilcoxon p > 0.05 | 0.12 | PASS |

Median A by season: 2015-16 0.0335 (n=3253), 2016-17 0.0947 (n=3253), 2017-18 0.0792 (n=3253), 2018-19 0.258 (n=3253), 2019-20 0.123 (n=3253), 2020-21 0.104 (n=3253), 2021-22 0.0405 (n=3253), 2022-23 0.302 (n=3253), 2023-24 0.211 (n=3253), 2024-25 -0.00256 (n=3253)

## Layer shipped: `ntl`

National kiln season (half-month resolution; 95% bootstrap interval over clusters):

| Season | Onset | End | Duration (days) | Peak |
|---|---|---|---|---|
| 2012-13 | 16 Jan [16 Dec – 16 Jan] | 16 Apr [16 Mar – 16 Apr] | 90 [59–121] | 16 Feb [16 Feb – 16 Feb] |
| 2013-14 | 16 Jan [16 Dec – 16 Jan] | 16 Apr [01 Apr – 16 Apr] | 90 [75–121] | 16 Feb [16 Feb – 16 Mar] |
| 2014-15 | 01 Jan [01 Dec – 01 Jan] | 16 Apr [01 Apr – 01 May] | 105 [90–136] | 01 Mar [01 Feb – 01 Mar] |
| 2015-16 | 16 Dec [01 Dec – 16 Dec] | 16 Apr [16 Apr – 16 Apr] | 122 [122–137] | 16 Feb [16 Feb – 16 Feb] |
| 2016-17 | 01 Dec [01 Dec – 01 Dec] | 01 Apr [01 Apr – 01 Apr] | 121 [121–121] | 01 Feb [01 Feb – 01 Mar] |
| 2017-18 | 01 Dec [01 Dec – 01 Dec] | 16 Apr [16 Apr – 16 Apr] | 136 [136–136] | 16 Feb [01 Feb – 01 Mar] |
| 2018-19 | 16 Nov [16 Nov – 16 Nov] | 16 Mar [16 Mar – 01 Apr] | 120 [120–136] | 16 Jan [16 Jan – 16 Jan] |
| 2019-20 | 16 Nov [16 Nov – 01 Dec] | 16 Apr [16 Apr – 16 Apr] | 152 [137–152] | 01 Jan [01 Jan – 01 Mar] |
| 2020-21 | 01 Dec [16 Nov – 01 Dec] | 16 Apr [16 Apr – 01 May] | 136 [136–166] | 16 Feb [16 Feb – 16 Feb] |
| 2021-22 | 01 Dec [01 Dec – 16 Dec] | 16 Apr [16 Apr – 01 May] | 136 [121–151] | 16 Feb [16 Jan – 16 Feb] |
| 2022-23 | 16 Nov [01 Nov – 16 Nov] | 16 Apr [16 Apr – 16 Apr] | 151 [151–166] | 16 Feb [16 Jan – 16 Feb] |
| 2023-24 | 16 Nov [16 Nov – 16 Nov] | 16 Apr [16 Apr – 16 Apr] | 152 [152–152] | 16 Feb [16 Feb – 01 Mar] |
| 2024-25 | 16 Nov [16 Nov – 16 Nov] | 01 May [16 Apr – 01 May] | 166 [151–166] | 16 Feb [16 Dec – 16 Mar] |
| 2025-26 | 16 Nov [16 Nov – 16 Nov] | 01 Apr [01 Apr – 01 Apr] | 136 [136–151] | 01 Feb [01 Jan – 01 Feb] |
