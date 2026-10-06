# Harmonization report (A6)

Selected model: **M0** (M1 ships only on >10% pooled MAE gain).
Pooled LOSO MAE — M0 0.0037, M1 0.0047
Pooled 95% coverage (M0): 0.985 [0.982, 0.987] — target (0.9, 0.97): **FAIL**

## Seam
d_raw 55.12, d_harm 1.59, ratio 0.029, Chow p raw 6e-05, harm 0.286 — **PASS**

## Rung usage by chain step
| step   |   -1 |   0 |   1 |   2 |   3 |
|:-------|-----:|----:|----:|----:|----:|
| A<-N   |    0 |  47 |  44 |  54 | 191 |
| J1<-J2 |   84 |   0 |   0 |   0 |   0 |
| N<-J1  |    0 |  50 |  33 |  42 | 211 |

NOAA-20 ↔ S-NPP paired stratum-days: 140302. NOAA-20 SP/NRT ratio: not computable (FIRMS SP ends 2026-06-30, NRT starts 2026-07-01; no overlap) — stated limitation.
