# DRAFT — Amendment 5: a harmonized fire calendar for South Asia

> **Not yet agreed or in force.** For the team to review, change and agree. Once agreed, copy it as the next section of [PREREGISTRATION_AMENDMENTS.md](PREREGISTRATION_AMENDMENTS.md), fill in the date and commit it **before any regional FIRMS or Earth Engine value is downloaded or looked at**. Points marked **Decide** need a choice first. Plan: [roadmap.md](roadmap.md) step F9.

## Amendment 5: harmonized fire calendar for South Asia (_date_)

**Status when written.** The Bangladesh harmonization, its tests and every amendment so far are complete and published. No FIRMS detection, Earth Engine clear fraction or calibration value has been downloaded, extracted or examined for any area outside Bangladesh for this purpose. The only regional material used so far is display material: Natural Earth country outlines and two NASA GIBS background images for the `#/region` map. (Amendments 2–4 used night lights and radar at kiln sites in Pakistan, India and Afghanistan, never fire detections.)

### Why

The challenge asks for a record that can be followed consistently across the MODIS-to-VIIRS change, and its build guide frames the demonstration over South Asia. Non-claim 5 says the Bangladesh calibration does not hold outside Bangladesh, so it cannot be reused. Each region needs its own calibration, tested by the same rules before anything is shown.

### Area and units

- **Countries:** Afghanistan, Bangladesh, Bhutan, India, Maldives, Nepal, Pakistan, Sri Lanka.
- **Units:** each country (ADM0) and its first-level divisions (ADM1). Bangladesh keeps its published district and upazila calendars unchanged; its ADM0/ADM1 rows are added alongside them.
- **Boundaries — Decide:** geoBoundaries CGAZ ADM0/ADM1 (CC BY 4.0, one consistent treatment of disputed areas) is proposed for analysis. The `#/region` map would then switch to the same source, so map and numbers agree.
- **Grid:** a second 0.01° grid for the region (origin 0°N 60°E, 3,900 rows × 3,800 columns), separate from the Bangladesh grid, whose constants and tests do not change.

### Data

- **Detections:** FIRMS archive (SP) and NRT for MODIS (Terra, Aqua) and VIIRS (S-NPP, NOAA-20, NOAA-21) over 60–98°E, 3–39°N, from 2003. Confidence filter `CONF_KEEP` as pre-registered. FIRMS bulk archive downloads, cached as for Bangladesh.
- **Clear fractions:** Earth Engine MOD14A1, MYD14A1 and VNP14A1 FireMask clear classes per unit per day, as for Bangladesh (fractions, never counts).

### Calibration (unchanged method, regional strata)

- Chain Aqua ← S-NPP ← NOAA-20, ratio model M0 (M1 only on a >10% pooled leave-one-season-out MAE gain), season-block bootstrap, as in Bangladesh.
- **Strata:** ADM1 × month × pass. There is no kiln-footprint class outside Bangladesh.
- **Pooling ladder:** ADM1 × month → ADM1 × month bucket → country × bucket → region × bucket → region × all months, per pass. Day and night are never pooled for night outputs (as pre-registered).
- **Sufficiency:** `MIN_SNPP_CELLDAYS` = 100 and `MIN_PAIRED_DAYS` = 10, as pre-registered.
- **Calibration seasons:** `CALIB_SEASONS` (2012-13 … 2020-21), derived by the pre-registered rule. Later seasons are held out.
- **Seed:** `SEED_OFFSETS["region"] = 9`.

### Tests, per country (each country is verdicted on its own)

1. **Seam.** As pre-registered: `d_harm ≤ 0.25 × d_raw` with `chow_p_raw < 0.01` and `chow_p_harm > 0.05`, on the national season series. If `chow_p_raw ≥ 0.01`, there is no detectable camera break to remove, and the verdict is "no detectable break" (not a pass and not a fail).
2. **Agreement on held-out seasons** (2021-22 onward, months both Aqua and S-NPP saw, `validate.overlap_agreement` on ADM1-months): passes if the harmonized VIIRS/Aqua ratio is within **0.80–1.25** (**Decide**) and the harmonized concordance is higher than the raw concordance.
3. **Interval coverage:** pooled leave-one-season-out 95% coverage against 0.90–0.97 is **reported, not gating**, as it is for Bangladesh, where it failed on the conservative side.

**What ships.** A country's harmonized calendar is published when test 2 passes and test 1 passes or finds no detectable break. Otherwise the country is shown with raw, unconverted activity only, labelled "not harmonized", and the failed test is published beside it. Results appear on the Trust page in the same pass/fail form as every other test.

### Non-claims added

- That the regional calibration holds outside its own training coverage (seasons 2012-13 … 2020-21, the eight countries).
- Any harmonized figure for a country whose tests did not pass.
- That a boundary shown implies a position on any territorial claim.

### Unchanged

Every Bangladesh result, threshold and output; Amendments 1–4; the kiln extension.
