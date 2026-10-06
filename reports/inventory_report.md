# Inventory report (A4)

## Source agreement within 150 m
|      |   apad |
|:-----|-------:|
| apad |      1 |

Primary inventory: APAD (CC BY 4.0), 4760 kilns in Bangladesh. DoE register: about 7,000–7,500 kilns.
Registered-versus-detected gap: about 2240–2740 kilns.

DBSCAN_EPS_M = 318.2 m (median S-NPP half-diagonal). Clusters: 3653; max diameter 1632 m; max size 21.
Sensitivity (eps → clusters): {300: 3706, 550: 3176, 800: 2828}

Clustering uses a constant eps while linking uses per-detection radii: cluster membership is scale-stable, link attribution is not.

## Controls
```
{'dropped_frac': 0.0, 'by_division': {'Barishal': 0.0, 'Dhaka': 0.0, 'Khulna': 0.0, 'Mymensingh': 0.0, 'Rajshahi': 0.0, 'Rangpur': 0.0}, 'rung_counts': {'0': 9975, '1': 650, '2': 257, '3': 77}, 'wc_classes': {'40': 1986, '10': 1085, '30': 253, '80': 179, '50': 76, '60': 70, '95': 3, '90': 1}}
```

Interpretation: '>=5 km from other controls' is applied among a cluster's own three controls. Applied across all ~11,000 controls it would require disjoint 5 km discs covering more than Bangladesh's land area.
