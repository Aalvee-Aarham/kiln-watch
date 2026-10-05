# Blockers

Appended when an automated verification fails three times with substantively different fixes. Columns: step · failing assertion · what was tried · smallest reproducing command.

| Date | Step | Failing assertion | What was tried | Resolution / reproducing command |
|---|---|---|---|---|
| 2026-10-06 | A2 | `len(unit_cells)` for Bangladesh within 250 000–350 000 → got 129 332 | Checked cell membership (centroid-in-polygon on HDX ADM2), grid size at 23.7°N (1.02 × 1.11 km), and Bangladesh area (147 570 km²) | The bound is a plan defect: 250k–350k brackets the BBOX rectangle (480 × 620 = 297 600), not the country. Replaced by an area-derived check (expected ≈ 130 000 ± 10%). Not a pre-registered constant. **Needs human sign-off.** `python -m kilnwatch grid` |
