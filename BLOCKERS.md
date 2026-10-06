# Blockers

Appended when an automated verification fails three times with substantively different fixes. Columns: step · failing assertion · what was tried · smallest reproducing command.

| Date | Step | Failing assertion | What was tried | Resolution / reproducing command |
|---|---|---|---|---|
| 2026-10-06 | A2 | `len(unit_cells)` for Bangladesh within 250 000–350 000 → got 129 332 | Checked cell membership (centroid-in-polygon on HDX ADM2), grid size at 23.7°N (1.02 × 1.11 km), and Bangladesh area (147 570 km²) | The bound is a plan defect: 250k–350k brackets the BBOX rectangle (480 × 620 = 297 600), not the country. Replaced by an area-derived check (expected ≈ 130 000 ± 10%). Not a pre-registered constant. **Needs human sign-off.** `python -m kilnwatch grid` |
| 2026-10-06 | A6d | Pooled leave-one-season-out 95% coverage in (0.90, 0.97) → got **0.985** [0.982, 0.987], M0 selected | Not retried: the failure is a result, not a code fault. Mechanics pass on synthetic data (`tests/test_harmonize.py::test_loso_mechanics`). Likely cause: many held-out division × week × pass × loc observations have near-zero counts, where 95% quantile intervals of a discrete Poisson over-cover. Changing the observation unit or interval method after seeing the result would violate the pre-registration. | Published as FAIL on the Evidence page and in `reports/harmonization_report.md`; intervals are conservative (too wide), not optimistic. The seam criterion (A6e) PASSES. Downstream stages continue (independent). **Needs human sign-off.** `python -m kilnwatch harmonize` |
