# Classifier report (A7)

Positives 205, negatives 1158 (footprint-only labels, S-NPP training).
PR-AUC (spatial GroupKFold by district): 0.209 [0.174, 0.249]
Prevalence 0.150 · rule baseline (p5≥3 & night) 0.150 · logistic 0.244
Ships: **HistGradientBoosting**

## Holdouts
- spatial: 0.209 [0.174, 0.249]
- temporal: 0.334 [0.244, 0.466]
- cross_sensor_N_J1: 0.311 [0.239, 0.396]
- cross_sensor_J1_J2: 0.322 [0.181, 0.505]

## Label sets
- footprint_only: 0.209
- with_type2: 0.487

Without persistence features (p5, p30): 0.204
NRT may use the model on NOAA-21: True

## Permutation importance
- bt_mir: 0.1841
- bt_tir: 0.1399
- bt_diff: 0.1161
- iso1: 0.1012
- frp: 0.0979
- local_hour: 0.0858
- track: 0.0704
- scan: 0.0253
- p30: 0.0098
- conf_rank: 0.0
- p5: 0.0
- is_night: -0.0012
