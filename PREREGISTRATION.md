# Kiln Watch — Pre-registration

**Committed before any data is analysed.** Never edited after its first commit; deviations go to `PREREGISTRATION_AMENDMENTS.md` as dated amendments.

## Phase 0 answers recorded at registration (6 Oct 2026)

- **0.2 Lee et al. 2021:** no openly licensed standalone data release was found (paper data points to SentinelKilnDB, CC BY-NC). Lee is therefore not eligible under rule 1.
- **Primary inventory (rule applied):** APAD *IGP Brick Kilns Bangladesh* (CC BY 4.0, 4,760 kilns, AWS Open Data, accessed 2026-10-06). SentinelKilnDB is CC BY-NC → validation only.
- **APAD imagery window:** the APAD documentation does not state an imagery date. The dataset was released in 2025 (Hamdani et al., *Sci. Data* 2025 companion); we take its window as ending with the **2023-24** dry season, the latest complete dry season before release. This is an assumption, stated here before analysis.
- **GATE_SEASON = 2023-24** (1 Nov 2023 – 31 May 2024), derived from the inventory by the rule below, never chosen first.
- **0.3 Transfer district:** Faisalabad, Pakistan (APAD IGP Pakistan inventory, CC BY 4.0; HDX COD-AB Pakistan boundary, CC BY-IGO).
- **0.4 VIIRS SP `type` column:** present for VIIRS S-NPP SP and NOAA-20 SP; absent for NRT products.
- **G0 STA screen:** the STA mask is the source of FIRMS `type=2`; G0 is measured as the share of kiln clusters with ≥1 `type=2` VIIRS detection in calendar 2023, and the converse.

## Pre-registered constants

```
FIRING_MONTHS = (11, 12, 1, 2, 3, 4, 5)
MONSOON_MONTHS = (6, 7, 8, 9, 10)
CONF_KEEP = ('nominal', 'high')
MIN_SNPP_CELLDAYS = 100
MIN_PAIRED_DAYS = 10
LOSO_COVERAGE_TARGET = (0.90, 0.97)
SEAM_RATIO_MAX = 0.25
CONTROL_DROP_MAX = 0.20
CONTROL_DROP_MAX_DIV = 0.40
GATE_SEASON = '2023-24'
```

**Hypothesis.** A firing brick kiln presents a small, very hot sub-pixel area whose integrated radiant flux may exceed the VIIRS 375 m detection threshold, especially at night. Detectability depends on hot-area fraction × temperature, not temperature alone. **Untested.** No published method detects kilns thermally; all published kiln mapping uses optical imagery.

**Plausibility statement.** A per-cluster clear-day detection rate below 0.03 is physically plausible but insufficient for a per-cluster calendar. The site-level eligibility rule below therefore sets a deliberately demanding bar, and failing it is an expected outcome, not an anomaly.

**Primary inventory rule — applied first, without reference to any season.**
1. Open licence. **CC BY-NC does not qualify, so SentinelKilnDB is validation-only.**
2. A documented ground-truth or imagery window that contains at least one complete dry season (1 Nov – 31 May) from 2012-13 onward, so that S-NPP observed it.
3. Among inventories meeting 1 and 2, the one with the most kilns inside Bangladesh.

**Gate season selection rule — applied second, from the chosen inventory.** `GATE_SEASON` is the **latest** complete dry season (1 Nov – 31 May) inside the primary inventory's window. If the primary inventory is Lee et al. 2021, that is 2018-11-01 to 2019-05-31. The season is **never** chosen first, and the inventory rule never refers to it, so the two cannot define each other.

**Units.** Inventory kiln clusters (DBSCAN with the A4b diameter cap), each with 3 matched controls per the A4c ladder.
**Detection filter.** Confidence nominal+high; linking radius = the detection's own pixel half-diagonal.

**G1 (VIIRS S-NPP) passes only if all three hold:**
1. **Shape (primary):** median S(kiln) ≥ 2 × median S(control) **and** median P(kiln) < median P(control); one-sided Mann–Whitney p < 0.01 for both.
2. **Contrast:** mean DR(kiln) / mean DR(control) ≥ 3; permutation test (10 000 shuffles within district strata) p < 0.01.
3. **Seasonality:** DR(kiln, Nov–May) ≥ 3 × DR(kiln, Jun–Oct).

**Reported, not gating:** G0's STA overlap; night-only contrast as a ratio; radius sweep; per-cluster DR distribution; results at "all" and "high" confidence.
**Site-level eligibility.** A cluster gets its own calendar (regulator export only) if season DR ≥ 0.10 with ≥ 10 detection-days.

| Gate | Rule |
|---|---|
| G0 | Declared prior screen. STA mask overlap with the primary inventory. **Informational; does not gate.** Run after this file is committed. |
| G2 (MODIS Terra+Aqua) | The same three criteria |
| G3 | Descriptive (`type` distribution, STA overlap detail) |
| GN (Nightfire) | The same three criteria; "beats G1" = higher median kiln DR with all three met |

| Other pre-registered choice | Rule |
|---|---|
| Calibration seasons | All complete firing seasons where both sensors have full coverage, ending before Aqua's drift. Derived in A1a and asserted against the archive. |
| Stratum sufficiency | ≥ 100 S-NPP cell-days **and** ≥ 10 paired days; otherwise escalate the ladder |
| Pooling across day/night | Forbidden for night-specific outputs; such strata terminate at rung 4 and emit `nodata` |
| Harmonization model selection | M1 ships only if its **pooled leave-one-season-out** MAE is >10% below M0's |
| Coverage target | 0.90–0.97 applied to coverage **pooled across all held-out observations in all folds**; per-season values are diagnostic only |
| Seam criterion | `d_harm ≤ 0.25 × d_raw`, with `chow_p_raw < 0.01` and `chow_p_harm > 0.05` |
| Classifier thresholds | Chosen for kiln-like precision ≥ 0.8 on validation folds, frozen before the temporal and cross-sensor holdouts |

*No rule is edited after its commit. Deviations are added as dated amendments in a new file, never by editing this one.*

##  Non-claims (published on the Method page)

1. That any kiln is operating illegally. Outputs are inspection leads.
2. That a kiln was off because there was no detection. We say only "no detection on N cloud-free days."
3. That detection counts are emissions. Any emissions figure is a labelled order-of-magnitude estimate.
4. That a satellite can see a licence, a kiln's technology, or exact distances to schools.
5. That the calibration holds outside its training coverage (seasons 2012-13 … 2020-21, Bangladesh).
6. That the 2013 Act caused any change. Before-and-after comparisons are descriptive.
7. That thermal kiln detection is an established method. It is a hypothesis we tested; the gate results are published.
8. Any pre-2012 kiln history, unless Gate G2 passes.
9. That the classifier is independent of FIRMS's own static-source logic wherever `type=2` labels were used. The footprint-only comparison and the persistence ablation are published alongside.
