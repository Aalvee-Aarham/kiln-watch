# Kiln Watch research data — data dictionary

Harmonized MODIS + VIIRS burning activity for Bangladesh's 64 districts and their upazilas, from 1 Jan 2003. Every table is built from the project's public export, so it is area-level only: no kiln, cluster or coordinate data. `manifest.json` lists every file with its row count and SHA-256, the data build it came from (`source_build`) and the pre-registration commit (`prereg_sha`). Licence: CC BY 4.0 (`LICENSE.txt`). Method: `docs/architecture.md` and `docs/PREREGISTRATION.md` in the repository.

**Unit of activity.** *Aqua-MODIS-equivalent fire cell-days per 1,000 cloud-free cells* (0.01° grid). Aqua MODIS is the reference until season 2012-13, then Suomi NPP VIIRS converted to it, then NOAA-20 VIIRS chained through Suomi NPP after 2 Nov 2026. Seasons run 1 July – 30 June and are labelled `"2018-19"`. Dates are local (UTC+6).

| File | One row per | Columns |
|---|---|---|
| `units.*` | district or upazila | `unit_id` (HDX COD-AB p-code), `level`, `name_en`, `division` |
| `calendar_daily.parquet` | unit × day | `observed` (the era sensor saw ≥ 20% of the unit cloud-free; for NOAA-20 days after Suomi NPP ends on 2 Nov 2026 with no cached NOAA-20 fraction, the Suomi NPP clear-fraction climatology for that day of year stands in, as in the daily near-real-time update); `h` harmonized activity (**NaN when not observed**, 0 when observed with no fire); `raw_T`, `raw_A`, `raw_N`, `raw_J1` each sensor's own rate before conversion; `split_<key>` harmonized activity in each part of the split (`aman`/`boro`/`other` harvest windows under the published `nokiln` branch), NaN when not observed |
| `calendar_monthly.*` | unit × month | `observed_days`; `h_sum` and each `raw_*` / `split_*` summed over the month's days |
| `calendar_weekly_ci.*` | unit × week | `h_lo`, `h_hi`: 95% interval of the weekly harmonized rate (Poisson count noise plus calibration uncertainty) |
| `season_metrics.*` | unit × season | `midpoint`, `duration` (days since 1 July; d90 − d10 of cumulative activity), `peak` (15-day smoothed maximum), each with `_p50`, `_lo`, `_hi` from a week-block bootstrap; `first`, `last` active dates (biased by detection limits) |
| `calibration_betas.*` | chain step × stratum | `step` (`A<-N`, `N<-J1`, `J1<-J2`), stratum `division`, `month`, `pass` (D/N), `loc` (kiln-footprint cells or other); `beta_p50`, `beta_lo`, `beta_hi` (season-block bootstrap 95%); `rung_used` (pooling level, 0 = own stratum); `n_celldays`, `n_days` |
| `national_yearly.*` | season | `raw_sum` spliced raw record; `h_p50`, `h_lo`, `h_hi` harmonized; `aqua_observed` Aqua as recorded (the check series); `raw_<sensor>` |
| `kiln_seasons_by_area.*` | area × season | Brick-kiln season from NASA Black Marble night lights (Amendment 1), areas with ≥ 5 kiln clusters only: `n_clusters`; `onset`, `end`, `duration`, `peak` (days since 1 July) with `_p50`, `_lo`, `_hi`. `unit_id = national` is all of Bangladesh |

**Known limits.** Leave-one-season-out coverage of the calibration was 0.985 against a pre-registered 0.90–0.97 (intervals conservative). The NOAA-21 step has no valid β yet. "No detection" is not "no fire": see `observed`. Detection counts are not emissions.
