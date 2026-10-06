# Validation report (A9)

Layers ranked by evidential strength.

## Layer 1 — shape across seasons
| season   |   S_kiln |   S_ctrl |   DR_ratio |   night_ratio |   M_kiln |
|:---------|---------:|---------:|-----------:|--------------:|---------:|
| 2023-24  |        0 |        0 |      0.464 |       1353.51 |        0 |

## tropomi
```
{
 "treatment": "HBI",
 "did_no2": {
  "p50": -5.943798976639813e-06,
  "lo": -7.549086568937292e-06,
  "hi": -4.656424819663961e-06
 }
}
```

## pm25
```
[
 {
  "lag": 0,
  "r_kiln": {
   "p50": -0.04406283771651541,
   "lo": -0.1401973296222062,
   "hi": 0.0695181346496636
  },
  "r_veg": {
   "p50": 0.02468427149349009,
   "lo": -0.044940690121566956,
   "hi": 0.10466533065566015
  }
 },
 {
  "lag": 1,
  "r_kiln": {
   "p50": -0.04511406989013228,
   "lo": -0.141183870189004,
   "hi": 0.04802437962332151
  },
  "r_veg": {
   "p50": 0.023529415462954506,
   "lo": -0.038940087244362744,
   "hi": 0.09268264935566708
  }
 },
 {
  "lag": 2,
  "r_kiln": {
   "p50": -0.05358511529572594,
   "lo": -0.15357550461213326,
   "hi": 0.05533772353134904
  },
  "r_veg": {
   "p50": 0.0011008181004209647,
   "lo": -0.043631683750104275,
   "hi": 0.050903583852110613
  }
 }
]
```

## transfer
```
{
 "district": "Faisalabad",
 "dr_computed": true,
 "pr_auc": {
  "p50": 0.04981441644160811,
  "lo": 0.021826466907009155,
  "hi": 0.1413797094961359
 },
 "gate_pass": false,
 "n_pos": 10,
 "n_neg": 305,
 "prevalence": 0.031746031746031744,
 "dr_kiln_area": 0.043689320388349516
}
```

## Skipped
- skdb: SentinelKilnDB not downloaded (CC BY-NC, validation-only; Should tier)
- s2score: data/static/s2_checks.csv absent (two-rater check not yet done)
- closure: no DoE demolition records available
