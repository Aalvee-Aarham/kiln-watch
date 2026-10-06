# Classifier report (A7)

Positives 205, negatives 1194 (footprint-only labels, S-NPP training).
PR-AUC (spatial GroupKFold by district): 0.218 [0.180, 0.276]
Prevalence 0.147 · rule baseline (p5≥3 & night) 0.146 · logistic 0.230
Ships: **HistGradientBoosting**

## Holdouts
- spatial: 0.218 [0.180, 0.276]
- temporal: 0.327 [0.241, 0.486]
- cross_sensor_N_J1: 0.291 [0.231, 0.378]
- cross_sensor_J1_J2: 0.348 [0.194, 0.495]

## Label sets
- footprint_only: 0.218
- with_type2: 0.334

Without persistence features (p5, p30): 0.218
NRT may use the model on NOAA-21: True

## Permutation importance
- iso1: 0.2413
- bt_tir: 0.2331
- frp: 0.2141
- bt_diff: 0.1609
- local_hour: 0.1294
- track: 0.1173
- scan: 0.1071
- bt_mir: 0.0931
- p30: 0.0628
- conf_rank: 0.0
- p5: 0.0
- is_night: -0.0074
