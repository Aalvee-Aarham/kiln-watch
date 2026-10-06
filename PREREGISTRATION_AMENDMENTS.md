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
