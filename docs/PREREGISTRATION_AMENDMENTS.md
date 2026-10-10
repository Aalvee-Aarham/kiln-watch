# Pre-registration amendments

`PREREGISTRATION.md` is never edited. Deviations and additions are recorded here, dated, **before** the data they govern are analysed.

---

## Amendment 1: kiln activity from non-fire channels (6 Oct 2026)

**Status when written:** G1 and G2 had failed (`GATE_BRANCH = nokiln`). GN could not run because VIIRS Nightfire has required a paid data licence since 10 Jan 2025. Six exploratory pilots had been run (below). No data from the confirmatory sample or the confirmatory season had been extracted.

### Why

Gates G1 and G2 show that brick kilns are essentially invisible to the FIRMS active-fire products. Across 2012–2026, at every confidence level, only 37 of 3,653 clusters ever produced a night-time VIIRS detection. Kiln heat therefore does not contaminate the burning calendar. But *when kilns operate* is still unknown. This amendment tests channels that observe kiln **activity** rather than kiln **fire**.

### Exploratory pilots (disclosed in full; all on the same sample)

Sample: the 400 Dhaka-division clusters in `data/interim/activity_pilot.json`, drawn by `pandas.sample(400, random_state=7)`, each with its 3 matched controls, season 2023-24.

| # | Channel | Measure | Kiln | Controls | Reading |
|---|---|---|---|---|---|
| P1 | FIRMS VIIRS (S-NPP, NOAA-20, NOAA-21; all confidences; 2012–2026; all clusters) | Clusters with ≥ 1 night detection | 37 / 3,653 | 47 / 10,959 | Invisible |
| P2 | ECOSTRESS L2T LSTE v2, 70 m, night | Max LST ≤ 100 m minus median LST 200–500 m | 0.52 K | 0.46 K | No signal |
| P3 | Landsat 8/9 C2 L2 surface temperature, day | Same anomaly, Dec–Apr / other months | 2.38 / 1.75 K | 0.88 / 0.67 K | Sees the kiln structure, not firing |
| P4 | TROPOMI SO₂ / NO₂, monthly upazila means | Seasonal amplitude regressed on log kiln density (division FE) | t = 0.95 / −1.19 | — | No signal |
| P5 | NASA Black Marble VNP46A2 night lights | Dec–Apr minus Jul–Oct mean radiance | +0.38 nW cm⁻² sr⁻¹ (80% > 0) | −0.01 (49% > 0) | Signal, p ≈ 5×10⁻³⁶ |
| P6 | Sentinel-1 IW VV, yard (≤ 100 m) minus ring (200–500 m) | Dec–Apr minus Jul–Oct | +0.47 dB | −0.10 dB | Signal, p ≈ 4×10⁻²⁶ |

P5 and P6 go forward to confirmation. P1–P4 are reported as negative results.

### Confirmatory tests GL (night lights) and GS (radar)

**Sample.** Every kiln cluster **except** the 400 pilot clusters, each with its 3 matched A4c controls (unchanged). Each cluster is represented by the kiln nearest its centroid. Each control point is that kiln translated by the control's (`dlat`, `dlon`), as in `kilns.link_points`.

**Measurements.**
- **GL:** VNP46A2 `DNB_BRDF_Corrected_NTL` where `Mandatory_Quality_Flag ≤ 1`. Half-month means (days 1–15 and 16–end), then the mean within a 250 m buffer at 463 m scale.
- **GS:** Sentinel-1 GRD, IW mode, VV in linear power, monthly mean. Δ = 10·log10(mean within 100 m) − 10·log10(mean within the 200–500 m ring), at 20 m scale.

**Per-cluster seasonal amplitude.** For period *t*, the excess is e(t) = x_kiln(t) − mean of x over the valid controls, which requires at least 2 valid controls. The amplitude is A = mean of e over Dec–Apr minus mean of e over Jul–Oct of the same season. A needs at least 3 valid Dec–Apr periods and at least 2 valid Jul–Oct periods.

**Primary confirmatory season: 2022-23** (not touched by any pilot).

**Each of GL and GS passes only if all four hold:**
1. **Contrast:** median A > 0, one-sided Wilcoxon signed-rank p < 0.01.
2. **Prevalence:** share of clusters with A > 0 ≥ 0.60.
3. **Replication:** the median A across clusters is > 0 in ≥ 75% of evaluable seasons. For GL these are 2012-13 to 2024-25; for GS, 2015-16 to 2024-25. A season is evaluable if ≥ 200 clusters have A.
4. **Placebo:** for each cluster, its first control stands in for the kiln and the other two serve as controls. In 2022-23 this placebo gives a Wilcoxon p > 0.05 (two-sided).

**What ships.**

| GL | GS | Product |
|---|---|---|
| ✅ | any | Public **kiln-season layer** from night lights. GS, if it passes, is shown as an independent check |
| ❌ | ✅ | Kiln-season layer from radar (2015–) |
| ❌ | ❌ | No kiln-season layer; all channels are reported as negative results on the Evidence page |

The FIRMS burning calendar, the harmonization and `GATE_BRANCH = nokiln` are unaffected in every case.

**Season metrics** (per area and season, never per kiln; areas need ≥ 5 clusters):
- **Kiln excess** E(t): the median over the area's clusters of e(t), minus the median of E over that season's Jul–Oct periods.
- Smooth E with a centred 3-period running mean. The **peak** is its maximum between 1 Sep and 30 Jun.
- **Onset** is the first period from 1 Sep with smoothed E ≥ 50% of the peak value. **End** is the last period before 30 Jun with smoothed E ≥ 50% of the peak value. **Duration** = end − onset.
- 95% intervals come from 1,000 bootstrap resamples of clusters, seeded from `config.SEED` with offset `activity`.

**Non-claims added.**
- Night lights measure activity at kiln sites (lighting, resident workers, open feed holes), not combustion or emissions.
- Radar measures brick stacks in kiln yards (production), not firing.
- A season with low night-light excess does not show that a given kiln was closed.

---

## Amendment 2: does the kiln method work outside Bangladesh? (7 Oct 2026)

**Status when written.** GL and GS passed in Bangladesh (Amendment 1). The transfer test pre-registered in `PREREGISTRATION.md` applied the frozen **FIRMS fire-detection classifier** to Faisalabad, Pakistan, and failed (PR-AUC 0.05 [0.02–0.14] against a prevalence of 0.03). That test concerns the fire-satellite method, which G1 and G2 had already rejected in Bangladesh; it says nothing about night lights or radar. Its result stays published as a failure and nothing below changes it.

No night-light, radar or other outcome value has been extracted for any kiln outside Bangladesh. Done before writing, without outcome data:
- APAD inventories downloaded: Pakistan (`Brick_Kilns_PK-Main_coal.csv`, 10,585 kilns) and India (`Brick_Kilns_IND-Main_coal.csv`, 22,459 kilns), CC BY 4.0.
- Clusters built by the A4 rule: Pakistan 7,509, India 18,665.
- The seeded samples and their controls (rules below) built from the inventories, ESA WorldCover and country borders only, to check that enough clusters get controls. Pakistan: 2,000 sampled, 0 dropped (controls on rungs 0/1/2/3: 3,846 / 1,886 / 228 / 40). India: 2,000 sampled, 0 dropped (3,805 / 1,950 / 166 / 79).
- One Earth Engine timing run, on Bangladesh sites only.

APAD's Africa file (144 industrial clay plants in four countries) is too small for a test that needs 200 clusters per season, and is not used.

### Why

Kiln calendars differ between countries. Punjab, Pakistan has ordered traditional kilns shut from 20 October to 31 December in each smog season since 2018 ([Arab News, 2018](https://arabnews.pk/node/1390406)). North-Indian kilns fire from January to June and stop for the July–September monsoon ([CPCB report to the NGT, O.A. 1016/2019](https://www.greentribunal.gov.in/sites/default/files/news_updates/Report%20by%20CPCB%20in%20O.A.%20No.%201016%20of%202019%20titled%20Utkarsh%20Panwar%20Vs.%20CPCB.pdf)). Bangladesh's fixed contrast (Dec–Apr against Jul–Oct) could therefore fail abroad because the calendar is different, not because night lights cannot see kilns. Each country gets two tests per channel: a strict copy of Amendment 1, and the same test with the kiln season learned locally on clusters that are kept out of the test.

### Sample (per country)

1. **Kilns:** the APAD "Main coal" file named above.
2. **Clusters:** the A4 rule unchanged: DBSCAN at `DBSCAN_EPS_M` = 318.2 m, 5 km diameter cap, 2% size cap.
3. **Sample:** sort the cluster ids and permute them with `numpy.random.default_rng(SEED + SEED_OFFSETS["transfer"] + i)`, with i = 0 for Pakistan and 1 for India. The first 2,000 are sampled. The first 400 of those are **calibration** clusters (Bangladesh's pilot also had 400); the other 1,600 are **confirmation** clusters.
4. **Controls:** three per cluster, placed around its representative kiln (the kiln nearest the centroid, as in Amendment 1). Rungs, tried in order: 5–10 km, 3–10 km and 3–15 km on the cluster's WorldCover class (the mode over its kilns), then 3–15 km on any class. Every control is at least the rung's minimum distance from **every** mapped kiln in all three APAD inventories (so borders do not hide kilns), inside the country (geoBoundaries ADM0), never on WorldCover water (80) or no-data (0), and at least 5 km from the cluster's other controls. At most 2,000 candidates per missing control per rung (`CONTROL_ATTEMPTS_MAX`), drawn from the same seeded generator. Clusters without three controls are dropped. If more than 20% of a country's sample is dropped (`CONTROL_DROP_MAX`), its tests are reported as **not evaluable**.

Distance rings replace Bangladesh's district and division areas, so the rule needs no administrative boundaries and runs in any country.

### Measurements

Identical to Amendment 1: the GL measurement for night lights and the GS measurement for radar. Years 2012–2025 for night lights and 2015–2025 for radar. Radar runs on a nested subsample, the first 150 calibration and the first 600 confirmation clusters that have controls, in the permuted order, because each radar site costs about three times as much Earth Engine compute.

The excess e(t) and the amplitude A follow Amendment 1 (e needs at least 2 valid controls; A needs at least 3 valid core periods and at least 2 valid off periods). Only the months of the window change between tests.

### Tests (per country and channel)

- **Strict: TL (night lights), TS (radar).** Amendment 1's window: core Dec–Apr, off Jul–Oct.
- **Local: LL (night lights), LS (radar).** The window is learned on the calibration clusters only. For each calibration cluster and calendar month, take the mean excess over seasons 2012-13 to 2024-25 (radar: those with data). The profile is the median of that over calibration clusters. **Core** is the 5 consecutive months, in July-to-June order without wrapping, with the highest mean profile. **Off** is the 4 consecutive months, not overlapping core, with the lowest mean. Ties go to the earliest start.

Each test passes only if Amendment 1's four criteria hold on the **confirmation** clusters:
1. **Contrast:** median A in 2022-23 > 0, one-sided Wilcoxon signed-rank p < 0.01.
2. **Prevalence:** share of clusters with A > 0 in 2022-23 ≥ 0.60.
3. **Replication:** median A > 0 in ≥ 75% of evaluable seasons (night lights 2012-13 to 2024-25, radar 2015-16 to 2024-25; a season is evaluable with ≥ 200 clusters).
4. **Placebo:** with each cluster's first control standing in for the kiln, two-sided Wilcoxon p > 0.05 in 2022-23.

**Primary test.** For each country, **LL** answers "does the night-light kiln method work here?" TL, TS and LS are reported beside it. A country passes only on its own LL. There is no pooled claim, and no claim about any country not tested.

**Bangladesh self-check (descriptive, not a test).** The same window learner runs on Bangladesh's 400 pilot clusters and its result is reported. Those clusters informed the Dec–Apr choice in Amendment 1, so it cannot confirm anything.

### What ships

Country-level only: inventory and sample sizes, control drops, learned windows, every test row, and each channel's monthly kiln-excess profile (median over confirmation clusters, with a 95% bootstrap interval over clusters from 1,000 resamples seeded at `SEED + SEED_OFFSETS["transfer"] + 10 + i`; Bangladesh `+ 20`). No kiln, cluster or coordinate is published.

| LL in a country | What the site says |
|---|---|
| Passes | The night-light kiln method works there, and its kiln calendar is shown |
| Fails | It did not pass there; the profile is shown as descriptive only |
| Not evaluable | Not tested, with the reason |

### Non-claims added

- A pass in one country says nothing about countries that were not tested.
- A learned window describes when kilns there are most active, not their legal operating dates.

---

## Amendment 3: Afghanistan, a kiln calendar outside South Asia's winter (7 Oct 2026)

**Status when written.** Amendment 2's extraction for Pakistan and India was running; none of its results had been looked at. No night-light or other outcome value had been extracted for any kiln in Afghanistan. Done before writing, without outcome data:
- SentinelKilnDB ([Mondal et al., NeurIPS 2025](https://huggingface.co/datasets/SustainabilityLabIITGN/SentinelKilnDB), CC BY-NC 4.0): only the `image_name` and `yolo_obb_label` columns were read (HTTP range requests; no image bytes).
- Kiln positions: the tile centre in the file name plus the oriented box's centre offset at 10 m per pixel (128 × 128 px tiles). The centre convention was checked against APAD Bangladesh: 29% of SentinelKilnDB kilns in the Bangladesh box fall within 150 m of an APAD kiln, against 1% for either corner convention. Repeats from overlapping tiles were merged within 100 m: 62,900 unique kilns (the paper reports 62,671).
- Afghanistan (geoBoundaries ADM0, public domain): 672 kilns, 496 clusters by the A4 rule.
- The sample and its controls (rules below), from the kilns, WorldCover and the border only: 496 sampled, 0 dropped (controls on rungs 0/1/2: 1,450 / 35 / 3).

### Why

Every Amendment 2 country keeps a dry-winter kiln season. Kilns near Kabul work a six-month season and stop when it is too cold ([The New Humanitarian, 2012](https://www.thenewhumanitarian.org/news/2012/05/16/bonded-labour-ensnares-entire-families)), so Afghanistan tests whether the method can find a kiln calendar that is not South Asia's.

### Rules

Amendment 2's rules apply unchanged except:
1. **Kilns:** SentinelKilnDB kilns inside Afghanistan, positioned and de-duplicated as above. The licence is non-commercial; only country-level statistics are published.
2. **Sample:** every cluster. The seeded permutation uses i = 2. The first 20% (rounded down: 99) calibrate; the other 397 confirm.
3. **Controls:** as Amendment 2, but kept at least the rung's minimum distance from every kiln in the APAD inventories **and** in SentinelKilnDB (62,900), so border and unmapped-inventory kilns are avoided.
4. **Channel:** night lights only (TL and LL). Radar is not run, to save Earth Engine quota.

LL is the primary test. Replication still needs at least 200 clusters with A for a season to be evaluable; with 397 confirmation clusters, seasons with poor night-light coverage may not qualify, and a test with no evaluable season fails its replication criterion.

### Non-claims added

- The Afghanistan kiln positions come from a detector-built, hand-validated dataset, not a government register.

---

## Amendment 4: retest away from kiln light, on fresh clusters (7 Oct 2026)

**Status when written.** Amendment 2's night-light tests in Pakistan had finished, and both **failed**, on the placebo criterion only. Contrast, prevalence and replication passed: median A in 2022-23 was 0.13 (TL) and 0.15 (LL) nW cm⁻² sr⁻¹, p < 10⁻⁵⁰; 69% and 70% of clusters had A > 0; 13 of 13 seasons were positive. The placebo medians were −0.027 and −0.029 (p = 8×10⁻⁶ and 1×10⁻⁷). Pakistan's radar tests then passed (TS and LS). Those verdicts stand. The design below was drafted from Pakistan's diagnosis while India was still running. Before this amendment was committed, India's results also arrived and were read: the same pattern (contrast, prevalence and replication pass; the placebo fails with a negative median), and radar passing. The 6 km rule below was fixed from Pakistan's diagnosis and feasibility alone. No Earth Engine value had been extracted for any cluster in the samples below, and Afghanistan had not run.

### Diagnosis (exploratory, on Pakistan's Amendment 2 sample)

A control's own seasonal amplitude (Dec–Apr minus Jul–Oct radiance, median over seasons) falls with its distance to the nearest mapped kiln: +0.064 at 3–5 km, +0.025 at 5–6 km, +0.011 at 6–8 km and −0.001 at 8–10 km. It rises with the number of kilns within 5 km: +0.019 with none, +0.10 with more than ten. Farmland near kilns therefore brightens in the kiln season, through light spill or kilns missing from the inventory. The control ladder found each cluster's first control on the 5–10 km rung in 80% of clusters but its third in only 49%, so "first control against the other two" compared far farmland with nearer farmland, which produces the negative placebo. The same spill makes the kiln contrast conservative. In Bangladesh, 91% of controls came from the 5–10 km rung (Pakistan 64%, India 63%), consistent with its placebo passing.

### Change

Everything not listed here is unchanged: measurement, excess, amplitude, the four criteria and their thresholds, and LL as the primary test.
1. **Fresh sample.** From each country's clusters that were **not** in its Amendment 2 sample, a new seeded sample (`SEED + SEED_OFFSETS["transfer"] + 30 + i`, i = 0 Pakistan, 1 India): 2,000 clusters, 400 calibration, 1,600 confirmation.
2. **Controls away from kiln light.** Rungs 6–15, 6–25 and 6–40 km on the cluster's WorldCover class, then 6–40 km on any class. Every control is at least 6 km from every kiln in the APAD inventories (Bangladesh, Pakistan, India) **and** in SentinelKilnDB (62,900 kilns). The other rules are Amendment 2's: inside the country, never water or no-data, at least 5 km apart, at most 2,000 candidates per missing control per rung, and more than 20% of the sample dropped means not evaluable.
3. **Random control order.** Each cluster's three controls are put in a seeded random order before the placebo takes the first one. This alone removes the order effect behind the failed placebo.
4. **Night lights only** (TL and LL).

**Why 6 km.** At 6–8 km the measured spill (+0.011) is a sixth of that at 3–5 km. An 8 km minimum was tried first, on inventory, WorldCover and borders only: in a 40-cluster Pakistan trial it left about 20% of clusters without three controls (45% with a 25 km search radius), so a country would sit on the not-evaluable line. With 6 km, the same trial dropped 1 of 40. The threshold was chosen on Pakistan's first sample and feasibility alone, and is tested only on clusters that sample never touched.

**Feasibility** (inventory, WorldCover and borders only). Pakistan: 2,000 sampled from 5,509 unused clusters, 7 dropped (controls on rungs 0/1/2/3: 3,361 / 1,611 / 806 / 201). India: 2,000 sampled from 16,665 unused clusters, 110 dropped (controls on rungs 0/1/2/3: 2,942 / 1,599 / 932 / 197).

### Reporting

Amendment 2's results are published unchanged as each country's **first test**, with this diagnosis. The retest is published beside them. A country's headline verdict is its retest LL where the retest ran.
