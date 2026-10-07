# Kiln-method transfer report (Amendment 2)

Rules: PREREGISTRATION_AMENDMENTS.md, Amendment 2. Calibration clusters are excluded from every test.

Bangladesh self-check (descriptive): the window learned from its 400 pilot clusters is core Dec–Apr, off Jul–Oct (Amendment 1 fixed Dec–Apr / Jul–Oct).

## Pakistan: first test

10,585 kilns, 7,509 clusters; 2,000 sampled, 0 dropped for lack of controls. Control rungs: {'0': 3846, '1': 1886, '2': 228, '3': 40}.

### Night lights (400 calibration, 1600 confirmation clusters)

Learned window: core Nov–Mar, off Jul–Oct.

**TL: FAIL**

| Criterion | Value | Threshold | p | |
|---|---|---|---|---|
| Contrast: median A, 2022-23 (n = 1600) | 0.1318 | > 0, Wilcoxon p < 0.01 | 1.3e-50 | PASS |
| Prevalence: share of clusters with A > 0 | 0.6856 | ≥ 0.60 |  | PASS |
| Replication: seasons with median A > 0 (13 evaluable) | 1 | ≥ 0.75 |  | PASS |
| Placebo: first control as pseudo-kiln (n = 1600) | -0.02712 | Wilcoxon p > 0.05 | 7.6e-06 | FAIL |

Median A by season: 2012-13 0.0338 (n=1600), 2013-14 0.0667 (n=1600), 2014-15 0.0263 (n=1600), 2015-16 0.0967 (n=1600), 2016-17 0.102 (n=1600), 2017-18 0.107 (n=1600), 2018-19 0.0998 (n=1600), 2019-20 0.0745 (n=1600), 2020-21 0.0885 (n=1600), 2021-22 0.0817 (n=1600), 2022-23 0.132 (n=1600), 2023-24 0.0832 (n=1600), 2024-25 0.132 (n=1600)

**LL: FAIL**

| Criterion | Value | Threshold | p | |
|---|---|---|---|---|
| Contrast: median A, 2022-23 (n = 1600) | 0.145 | > 0, Wilcoxon p < 0.01 | 6.5e-59 | PASS |
| Prevalence: share of clusters with A > 0 | 0.7037 | ≥ 0.60 |  | PASS |
| Replication: seasons with median A > 0 (13 evaluable) | 1 | ≥ 0.75 |  | PASS |
| Placebo: first control as pseudo-kiln (n = 1600) | -0.02915 | Wilcoxon p > 0.05 | 1.5e-07 | FAIL |

Median A by season: 2012-13 0.0691 (n=1600), 2013-14 0.106 (n=1600), 2014-15 0.0499 (n=1600), 2015-16 0.127 (n=1600), 2016-17 0.124 (n=1600), 2017-18 0.131 (n=1600), 2018-19 0.133 (n=1600), 2019-20 0.0984 (n=1600), 2020-21 0.0941 (n=1600), 2021-22 0.0994 (n=1600), 2022-23 0.145 (n=1600), 2023-24 0.095 (n=1600), 2024-25 0.117 (n=1600)

Monthly kiln excess, confirmation clusters (median [95% CI]): Jul 0.199, Aug 0.2, Sep 0.244, Oct 0.321, Nov 0.413, Dec 0.416, Jan 0.312, Feb 0.365, Mar 0.354, Apr 0.315, May 0.284, Jun 0.262

### Sentinel-1 radar (150 calibration, 600 confirmation clusters)

Learned window: core Jan–May, off Jul–Oct.

**TS: PASS**

| Criterion | Value | Threshold | p | |
|---|---|---|---|---|
| Contrast: median A, 2022-23 (n = 600) | 0.2952 | > 0, Wilcoxon p < 0.01 | 2.1e-15 | PASS |
| Prevalence: share of clusters with A > 0 | 0.66 | ≥ 0.60 |  | PASS |
| Replication: seasons with median A > 0 (10 evaluable) | 1 | ≥ 0.75 |  | PASS |
| Placebo: first control as pseudo-kiln (n = 600) | 0.0365 | Wilcoxon p > 0.05 | 0.5 | PASS |

Median A by season: 2015-16 0.334 (n=600), 2016-17 0.35 (n=600), 2017-18 0.402 (n=600), 2018-19 0.256 (n=600), 2019-20 0.237 (n=600), 2020-21 0.266 (n=600), 2021-22 0.318 (n=600), 2022-23 0.295 (n=600), 2023-24 0.276 (n=600), 2024-25 0.443 (n=600)

**LS: PASS**

| Criterion | Value | Threshold | p | |
|---|---|---|---|---|
| Contrast: median A, 2022-23 (n = 600) | 0.3303 | > 0, Wilcoxon p < 0.01 | 9.1e-19 | PASS |
| Prevalence: share of clusters with A > 0 | 0.645 | ≥ 0.60 |  | PASS |
| Replication: seasons with median A > 0 (10 evaluable) | 1 | ≥ 0.75 |  | PASS |
| Placebo: first control as pseudo-kiln (n = 600) | 0.05489 | Wilcoxon p > 0.05 | 0.43 | PASS |

Median A by season: 2015-16 0.434 (n=600), 2016-17 0.468 (n=600), 2017-18 0.434 (n=600), 2018-19 0.322 (n=600), 2019-20 0.322 (n=600), 2020-21 0.392 (n=600), 2021-22 0.42 (n=600), 2022-23 0.33 (n=600), 2023-24 0.421 (n=600), 2024-25 0.534 (n=600)

Monthly kiln excess, confirmation clusters (median [95% CI]): Jul -0.249, Aug -0.294, Sep -0.383, Oct -0.305, Nov -0.346, Dec -0.346, Jan -0.197, Feb 0.271, Mar 0.26, Apr 0.221, May 0.16, Jun -0.117

## Pakistan: retest (Amendment 4)

10,585 kilns, 7,509 clusters; 2,000 sampled, 7 dropped for lack of controls. Control rungs: {'0': 3361, '1': 1611, '2': 806, '3': 201}.

### Night lights (397 calibration, 1596 confirmation clusters)

Learned window: core Nov–Mar, off Jul–Oct.

**TL: PASS**

| Criterion | Value | Threshold | p | |
|---|---|---|---|---|
| Contrast: median A, 2022-23 (n = 1596) | 0.1701 | > 0, Wilcoxon p < 0.01 | 9.7e-92 | PASS |
| Prevalence: share of clusters with A > 0 | 0.7375 | ≥ 0.60 |  | PASS |
| Replication: seasons with median A > 0 (13 evaluable) | 1 | ≥ 0.75 |  | PASS |
| Placebo: first control as pseudo-kiln (n = 1596) | -0.0107 | Wilcoxon p > 0.05 | 0.11 | PASS |

Median A by season: 2012-13 0.0235 (n=1596), 2013-14 0.0794 (n=1596), 2014-15 0.0279 (n=1596), 2015-16 0.129 (n=1596), 2016-17 0.159 (n=1596), 2017-18 0.171 (n=1596), 2018-19 0.136 (n=1596), 2019-20 0.0741 (n=1596), 2020-21 0.132 (n=1596), 2021-22 0.119 (n=1596), 2022-23 0.17 (n=1596), 2023-24 0.12 (n=1596), 2024-25 0.163 (n=1596)

**LL: PASS**

| Criterion | Value | Threshold | p | |
|---|---|---|---|---|
| Contrast: median A, 2022-23 (n = 1596) | 0.1909 | > 0, Wilcoxon p < 0.01 | 7.2e-109 | PASS |
| Prevalence: share of clusters with A > 0 | 0.7632 | ≥ 0.60 |  | PASS |
| Replication: seasons with median A > 0 (13 evaluable) | 1 | ≥ 0.75 |  | PASS |
| Placebo: first control as pseudo-kiln (n = 1596) | -0.006958 | Wilcoxon p > 0.05 | 0.09 | PASS |

Median A by season: 2012-13 0.0778 (n=1596), 2013-14 0.128 (n=1596), 2014-15 0.0542 (n=1596), 2015-16 0.154 (n=1596), 2016-17 0.187 (n=1596), 2017-18 0.172 (n=1596), 2018-19 0.181 (n=1596), 2019-20 0.117 (n=1596), 2020-21 0.132 (n=1596), 2021-22 0.144 (n=1596), 2022-23 0.191 (n=1596), 2023-24 0.121 (n=1596), 2024-25 0.138 (n=1596)

Monthly kiln excess, confirmation clusters (median [95% CI]): Jul 0.302, Aug 0.281, Sep 0.339, Oct 0.451, Nov 0.565, Dec 0.568, Jan 0.433, Feb 0.502, Mar 0.492, Apr 0.418, May 0.406, Jun 0.362

## India: first test

22,459 kilns, 18,665 clusters; 2,000 sampled, 0 dropped for lack of controls. Control rungs: {'0': 3805, '1': 1950, '2': 166, '3': 79}.

### Night lights (400 calibration, 1600 confirmation clusters)

Learned window: core Jan–May, off Jul–Oct.

**TL: FAIL**

| Criterion | Value | Threshold | p | |
|---|---|---|---|---|
| Contrast: median A, 2022-23 (n = 1600) | 0.1577 | > 0, Wilcoxon p < 0.01 | 5.3e-36 | PASS |
| Prevalence: share of clusters with A > 0 | 0.6412 | ≥ 0.60 |  | PASS |
| Replication: seasons with median A > 0 (13 evaluable) | 1 | ≥ 0.75 |  | PASS |
| Placebo: first control as pseudo-kiln (n = 1600) | -0.03705 | Wilcoxon p > 0.05 | 0.0043 | FAIL |

Median A by season: 2012-13 0.00558 (n=1600), 2013-14 0.042 (n=1600), 2014-15 0.0558 (n=1600), 2015-16 0.0497 (n=1600), 2016-17 0.0763 (n=1600), 2017-18 0.0945 (n=1600), 2018-19 0.0947 (n=1600), 2019-20 0.0906 (n=1600), 2020-21 0.126 (n=1600), 2021-22 0.129 (n=1600), 2022-23 0.158 (n=1600), 2023-24 0.174 (n=1600), 2024-25 0.175 (n=1600)

**LL: FAIL**

| Criterion | Value | Threshold | p | |
|---|---|---|---|---|
| Contrast: median A, 2022-23 (n = 1600) | 0.1682 | > 0, Wilcoxon p < 0.01 | 8.5e-42 | PASS |
| Prevalence: share of clusters with A > 0 | 0.6569 | ≥ 0.60 |  | PASS |
| Replication: seasons with median A > 0 (13 evaluable) | 1 | ≥ 0.75 |  | PASS |
| Placebo: first control as pseudo-kiln (n = 1600) | -0.04017 | Wilcoxon p > 0.05 | 0.011 | FAIL |

Median A by season: 2012-13 0.0162 (n=1600), 2013-14 0.0549 (n=1600), 2014-15 0.0605 (n=1600), 2015-16 0.0646 (n=1600), 2016-17 0.0949 (n=1600), 2017-18 0.0977 (n=1600), 2018-19 0.104 (n=1600), 2019-20 0.101 (n=1600), 2020-21 0.13 (n=1600), 2021-22 0.133 (n=1600), 2022-23 0.168 (n=1600), 2023-24 0.189 (n=1600), 2024-25 0.179 (n=1600)

Monthly kiln excess, confirmation clusters (median [95% CI]): Jul 0.0018, Aug -0.0032, Sep 0.0091, Oct 0.0191, Nov 0.055, Dec 0.0821, Jan 0.0762, Feb 0.127, Mar 0.148, Apr 0.147, May 0.103, Jun 0.0574

### Sentinel-1 radar (150 calibration, 600 confirmation clusters)

Learned window: core Feb–Jun, off Jul–Oct.

**TS: PASS**

| Criterion | Value | Threshold | p | |
|---|---|---|---|---|
| Contrast: median A, 2022-23 (n = 600) | 0.4296 | > 0, Wilcoxon p < 0.01 | 6e-33 | PASS |
| Prevalence: share of clusters with A > 0 | 0.7067 | ≥ 0.60 |  | PASS |
| Replication: seasons with median A > 0 (10 evaluable) | 1 | ≥ 0.75 |  | PASS |
| Placebo: first control as pseudo-kiln (n = 600) | 0.001787 | Wilcoxon p > 0.05 | 0.44 | PASS |

Median A by season: 2015-16 0.521 (n=594), 2016-17 0.548 (n=600), 2017-18 0.572 (n=600), 2018-19 0.486 (n=598), 2019-20 0.249 (n=600), 2020-21 0.527 (n=600), 2021-22 0.319 (n=600), 2022-23 0.43 (n=600), 2023-24 0.304 (n=600), 2024-25 0.357 (n=600)

**LS: PASS**

| Criterion | Value | Threshold | p | |
|---|---|---|---|---|
| Contrast: median A, 2022-23 (n = 600) | 0.6774 | > 0, Wilcoxon p < 0.01 | 1.4e-47 | PASS |
| Prevalence: share of clusters with A > 0 | 0.7633 | ≥ 0.60 |  | PASS |
| Replication: seasons with median A > 0 (10 evaluable) | 1 | ≥ 0.75 |  | PASS |
| Placebo: first control as pseudo-kiln (n = 600) | 0.05273 | Wilcoxon p > 0.05 | 0.05 | PASS |

Median A by season: 2015-16 0.829 (n=594), 2016-17 0.74 (n=600), 2017-18 0.787 (n=600), 2018-19 0.883 (n=598), 2019-20 0.359 (n=600), 2020-21 0.63 (n=600), 2021-22 0.62 (n=600), 2022-23 0.677 (n=600), 2023-24 0.678 (n=600), 2024-25 0.527 (n=600)

Monthly kiln excess, confirmation clusters (median [95% CI]): Jul 0.371, Aug 0.274, Sep 0.382, Oct 0.474, Nov 0.368, Dec 0.245, Jan 0.349, Feb 0.957, Mar 1.16, Apr 1.45, May 1.14, Jun 0.83

## India: retest (Amendment 4)

22,459 kilns, 18,665 clusters; 2,000 sampled, 110 dropped for lack of controls. Control rungs: {'0': 2942, '1': 1599, '2': 932, '3': 197}.

### Night lights (380 calibration, 1510 confirmation clusters)

Learned window: core Jan–May, off Jul–Oct.

**TL: FAIL**

| Criterion | Value | Threshold | p | |
|---|---|---|---|---|
| Contrast: median A, 2022-23 (n = 1510) | 0.1686 | > 0, Wilcoxon p < 0.01 | 1.3e-30 | PASS |
| Prevalence: share of clusters with A > 0 | 0.6576 | ≥ 0.60 |  | PASS |
| Replication: seasons with median A > 0 (13 evaluable) | 0.9231 | ≥ 0.75 |  | PASS |
| Placebo: first control as pseudo-kiln (n = 1509) | -0.027 | Wilcoxon p > 0.05 | 0.024 | FAIL |

Median A by season: 2012-13 -0.0085 (n=1510), 2013-14 0.056 (n=1510), 2014-15 0.0398 (n=1510), 2015-16 0.084 (n=1510), 2016-17 0.142 (n=1510), 2017-18 0.141 (n=1510), 2018-19 0.144 (n=1510), 2019-20 0.108 (n=1510), 2020-21 0.154 (n=1510), 2021-22 0.205 (n=1510), 2022-23 0.169 (n=1510), 2023-24 0.216 (n=1510), 2024-25 0.273 (n=1510)

**LL: PASS**

| Criterion | Value | Threshold | p | |
|---|---|---|---|---|
| Contrast: median A, 2022-23 (n = 1510) | 0.1888 | > 0, Wilcoxon p < 0.01 | 6.7e-37 | PASS |
| Prevalence: share of clusters with A > 0 | 0.6748 | ≥ 0.60 |  | PASS |
| Replication: seasons with median A > 0 (13 evaluable) | 1 | ≥ 0.75 |  | PASS |
| Placebo: first control as pseudo-kiln (n = 1509) | -0.01769 | Wilcoxon p > 0.05 | 0.082 | PASS |

Median A by season: 2012-13 0.0187 (n=1510), 2013-14 0.0745 (n=1510), 2014-15 0.0647 (n=1510), 2015-16 0.1 (n=1510), 2016-17 0.158 (n=1510), 2017-18 0.15 (n=1510), 2018-19 0.158 (n=1510), 2019-20 0.116 (n=1510), 2020-21 0.167 (n=1510), 2021-22 0.225 (n=1510), 2022-23 0.189 (n=1510), 2023-24 0.219 (n=1510), 2024-25 0.266 (n=1510)

Monthly kiln excess, confirmation clusters (median [95% CI]): Jul 0.06, Aug 0.0562, Sep 0.0574, Oct 0.0896, Nov 0.166, Dec 0.19, Jan 0.15, Feb 0.257, Mar 0.271, Apr 0.258, May 0.219, Jun 0.144

## Afghanistan: first test

672 kilns, 496 clusters; 496 sampled, 0 dropped for lack of controls. Control rungs: {'0': 1450, '1': 35, '2': 3}.

### Night lights (99 calibration, 397 confirmation clusters)

Learned window: core Jul–Nov, off Jan–Apr.

**TL: FAIL**

| Criterion | Value | Threshold | p | |
|---|---|---|---|---|
| Contrast: median A, 2022-23 (n = 397) | 0.001559 | > 0, Wilcoxon p < 0.01 | 0.75 | FAIL |
| Prevalence: share of clusters with A > 0 | 0.5113 | ≥ 0.60 |  | FAIL |
| Replication: seasons with median A > 0 (13 evaluable) | 0.2308 | ≥ 0.75 |  | FAIL |
| Placebo: first control as pseudo-kiln (n = 397) | -0.01691 | Wilcoxon p > 0.05 | 0.15 | PASS |

Median A by season: 2012-13 -0.0144 (n=397), 2013-14 -0.000671 (n=397), 2014-15 -0.00858 (n=397), 2015-16 -0.00387 (n=397), 2016-17 -0.0101 (n=397), 2017-18 -0.0156 (n=397), 2018-19 0.00992 (n=397), 2019-20 -0.0223 (n=397), 2020-21 -0.0172 (n=397), 2021-22 0.000594 (n=397), 2022-23 0.00156 (n=397), 2023-24 -0.0159 (n=397), 2024-25 -0.0184 (n=397)

**LL: FAIL**

| Criterion | Value | Threshold | p | |
|---|---|---|---|---|
| Contrast: median A, 2022-23 (n = 397) | -0.01568 | > 0, Wilcoxon p < 0.01 | 0.8 | FAIL |
| Prevalence: share of clusters with A > 0 | 0.4509 | ≥ 0.60 |  | FAIL |
| Replication: seasons with median A > 0 (13 evaluable) | 0.7692 | ≥ 0.75 |  | PASS |
| Placebo: first control as pseudo-kiln (n = 397) | 0.003893 | Wilcoxon p > 0.05 | 0.42 | PASS |

Median A by season: 2012-13 0.00282 (n=397), 2013-14 0.00423 (n=397), 2014-15 -0.00417 (n=397), 2015-16 -0.00391 (n=397), 2016-17 0.0191 (n=397), 2017-18 0.0129 (n=397), 2018-19 0.00818 (n=397), 2019-20 0.0247 (n=397), 2020-21 0.0226 (n=397), 2021-22 0.00311 (n=397), 2022-23 -0.0157 (n=397), 2023-24 0.0274 (n=397), 2024-25 0.0178 (n=397)

Monthly kiln excess, confirmation clusters (median [95% CI]): Jul 0.02, Aug 0.0141, Sep 0.0133, Oct 0.0108, Nov 0.0009, Dec 0.011, Jan 0.0026, Feb -0.0072, Mar -0.0019, Apr 0.0114, May 0.0225, Jun 0.029

