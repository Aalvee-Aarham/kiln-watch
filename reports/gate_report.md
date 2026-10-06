# Gate report (A5) — gate season 2023-24

Rules copied from PREREGISTRATION.md. Night figures are reported as ratios only.

## G0 — STA prior screen (declared, non-gating)
Mask vintage: FIRMS type=2 flag (derived from the Static Thermal Anomalies mask), calendar 2023.

- Share of kiln clusters with ≥1 type=2 (STA) VIIRS detection, 2023: **0.0**
- Share of type=2 VIIRS detections linked to a kiln cluster, 2023: **0.0**

## G1 — VIIRS S-NPP: **FAIL**

| Criterion | Value | Threshold | p |
|---|---|---|---|
| Shape: median S(kiln) / median S(control) | nan | ≥ 2, MW p < 0.01 | 0.9797733349315448 |
| Shape: median P(kiln) vs median P(control) | 1 | < 1.000, MW p < 0.01 | 0.007139788208122509 |
| Contrast: mean DR(kiln) / mean DR(control) | 0.4643 | ≥ 3, perm p < 0.01 | 0.9643035696430357 |
| Seasonality: DR(Nov–May) / DR(Jun–Oct), kilns | 2.383 | ≥ 3 |  |

## G2 — MODIS Terra+Aqua: **FAIL**

| Criterion | Value | Threshold | p |
|---|---|---|---|
| Shape: median S(kiln) / median S(control) | nan | ≥ 2, MW p < 0.01 | 0.7714966524297087 |
| Shape: median P(kiln) vs median P(control) | 1 | < 1.000, MW p < 0.01 | 1.0 |
| Contrast: mean DR(kiln) / mean DR(control) | 0.7297 | ≥ 3, perm p < 0.01 | 0.811018898110189 |
| Seasonality: DR(Nov–May) / DR(Jun–Oct), kilns | inf | ≥ 3 |  |

## GN — VIIRS Nightfire: **skipped** (EOG credentials not configured)

Night-only kiln/control DR ratio (G1, reported not gating): inf
Eligible clusters for site-level calendars (DR ≥ 0.10, ≥ 10 detection-days): 0
Per-cluster DR distribution: {'count': 3604.0, 'mean': 0.0, 'std': 0.0003, 'min': 0.0, '25%': 0.0, '50%': 0.0, '75%': 0.0, 'max': 0.0149}

## Radius sweep
| radius m | kiln DR | control DR |
|---|---|---|
| 200 | 0.0000 | 0.0000 |
| 400 | 0.0000 | 0.0000 |
| 750 | 0.0001 | 0.0001 |
| 1500 | 0.0003 | 0.0005 |

## Decision (§13): `GATE_BRANCH = nokiln`
