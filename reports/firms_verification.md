# FIRMS verification (independent re-fetch)

Area-level totals only. Compares a fresh NASA FIRMS pull (same code path as ingest) with the
committed real export and a published Bangladesh reference.

## Fresh detections by sensor (bbox 88.0-92.8 E, 20.5-26.7 N)

| sensor | product | fresh count | committed `ingest_counts.md` total |
|---|---|---|---|
| A | Aqua | 122914 | 229227 |
| J1 | NOAA-20 | 301139 | 301096 |
| J2 | NOAA-21 | 87276 | 87245 |
| N | S-NPP | 571952 | 571917 |
| T | Terra | 17017 | 32324 |

A (`Aqua`) is lower here only because this run starts 2012-01-01 while the committed pull
starts 2000-11-01; the rank comparison below uses only shared seasons.

## Shape vs the committed series (levels are not comparable across the harmonization; rank only)

| sensor | shared seasons | Spearman vs committed | fresh count (shared seasons) |
|---|---|---|---|
| N | 15 | 0.839 | 571772 |
| A | 15 | 0.818 | 122896 |

## Sensor ordering

Median fresh N/A over shared seasons: **4.75** (published Bangladesh factor ~3.6, Vadrevu et al. 2019).

## S-NPP annual fire-days vs published reference (AURSEE, NASA FIRMS S-NPP 375 m)

- pairs: 14
- Spearman: **0.908**
- fresh fire-days total: 370210
- reference fire-days total: 100123
