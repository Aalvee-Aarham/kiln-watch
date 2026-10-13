# Data sources: Ask stage, Crops page, Sensors drawing

Where every figure on these three parts of the site comes from, after the dummy data was replaced
([real_data_plan.md](real_data_plan.md), 2026-10-13). The pipeline's own upstream data (NASA FIRMS, Earth Engine,
COD-AB boundaries and the rest) is credited in the [README](../README.md#credits-and-licences) and described in
[data-contracts.md](data-contracts.md); this page covers what the site reads and cites.

Every figure has one of three kinds of source:

1. **Kiln Watch's public export:** the JSON files under `web/public/data/` on the live site, or
   `web/fixtures/<branch>/data/` offline. The page computes each figure from them with tested helpers.
2. **Curated records the repo holds:** `data/static/*.csv`. Each row has its own source link and is published in
   `events.json`.
3. **Published sources:** cited sentence by sentence in `web/src/lib/cropSources.ts`. Each entry stores the URL,
   the date it was opened and the exact sentence that states the fact. A test (`cropSources.test.ts`) fails if a
   number shown on the page is not in that sentence.

## 1. Kiln Watch export files

| File | Used by | What it gives | Helpers |
|---|---|---|---|
| `aoi/districts.geojson` | Ask stage, Crops | District names, divisions and outlines (COD-AB Bangladesh, via OCHA HDX) | `bboxOf`, `inGeometry` |
| `calendar/<unit_id>.json` | Ask stage, Crops | The district's harmonized fire record since 2003: per-day activity, the split by harvest window, the 10th/50th/90th-percentile day-of-season normal, unusual days | `seasonMean`, `monthlyMeans`, `busyMonths`, `splitShares`, `monthsShare`, `seasonToDateRatio`, `completeSeasons`, `seasonVerdict` |
| `nrt/current_season.json` | Ask stage, Crops, Home | This season so far (provisional, updated daily): per-district activity and unusual days (above the 90th-percentile normal) | `districtFacts`, `seasonToDateRatio` |
| `kiln_activity.json` | Ask stage | Kiln seasons from NASA Black Marble night lights (Amendment 1) | `typicalSeason` |
| `harmonization.json` | Ask stage | The selected conversion model and the 2012 camera-jump test (shown in the "Harmonize" step) | — |
| `meta.json` | Ask stage, Crops | Split labels, grid geometry, build id | `cellCenter`, `sensorOf` |
| `grid/<lon>_<lat>.json` | Ask stage map, Crops (hill share) | Fire detections on the 0.01° grid, Aqua MODIS and Suomi NPP rows only, written by the main pipeline (not the daily job). All fires, not only kilns | `stageCells`, `hillShare` |
| `validation.json` | Crops | Partial correlation of Dhaka PM2.5 with burning (same-day row) | — |
| `events.json` | Ask stage records, Crops | Harvest windows, policy and satellite events (section 2) | — |
| `aoi/world_states.geojson`, `aoi/world_countries.geojson` | Region registry test | Natural Earth outlines that each place outside Bangladesh maps to | — |

Computed on the page:

- **"Unusual"** always means the existing rule: a day above that day's 90th-percentile normal.
- **The "×" figure on the Ask stage** is this season so far divided by the average of the same days in earlier
  seasons, leaving out the live season. It is a description, not a test.
- **The hill-district share** (89% in the current offline copy) counts Aqua MODIS detections only, as distinct
  1 km cell-days, from 2003 to the end of the last complete season.
- **Harvest-window shares** come from date ranges. Any fire inside a window counts, whatever is burning.

## 2. Curated records (`data/static/*.csv` → `events.json`)

| Record | Source |
|---|---|
| Aman harvest Nov–Dec, Boro harvest Apr–May | [FAO GIEWS Country Brief: Bangladesh](https://www.fao.org/giews/countrybrief/country.jsp?code=BGD) |
| Brick Kiln Control Act 2013 passed (2013-11-10) and in force (2014-07-01) | [The Financial Express](https://today.thefinancialexpress.com.bd/print/new-brick-making-law-from-july) |
| Gazette: concrete blocks to replace fired bricks in government works (2019-11-24) | [The Daily Star](https://www.thedailystar.net/backpage/news/check-air-pollution-bye-bye-brick-1834924) |
| COVID-19 general holiday begins (2020-03-26) | [Prothom Alo](https://en.prothomalo.com/bangladesh/govt-offices-to-remain-shut-from-26-march-to-4-april) |
| Aqua launched (2002-05-04) | [NASA Aqua](https://aqua.nasa.gov/) |
| Suomi NPP (2011-10-28), NOAA-20 (2017-11-18), NOAA-21 (2022-11-10) launched | [NOAA JPSS](https://www.noaasis.noaa.gov/POLAR/JPSS/jpss.html) |
| Suomi NPP stops delivering new data (2026-11-02) | [NASA Earthdata data alert](https://www.earthdata.nasa.gov/data/alerts-outages/content/data-alert-history/21880) |
| Terra MODIS planned end (Jan 2027), Aqua MODIS planned end (about Sep 2027) | [NASA Earthdata: transition from MODIS to VIIRS](https://www.earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs) |

## 3. Published sources (`web/src/lib/cropSources.ts`)

All opened and quoted on 2026-10-13. The quote column is copied word for word from the source; "…" joins two
passages from the same page.

### FAO GIEWS: [Country Brief: Bangladesh](https://www.fao.org/giews/countrybrief/country.jsp?code=BGD)

| Id | Shown as | Quote |
|---|---|---|
| `wheat-window` | In Bangladesh, the 2026 wheat crop was harvested in April. | Production of the 2026 wheat crop, harvested in April, is officially estimated at a bumper level of 1.2 million tonnes, owing to above‑average area planted and yields. |

This country brief is updated over time: re-check the sentence when the next season's brief is published.

### Banglapedia (Asiatic Society of Bangladesh)

| Id | Shown as | Quote | Page |
|---|---|---|---|
| `sugarcane-window` | In Bangladesh, sugarcane is harvested from October to March. | In Bangladesh the harvesting season extends from October to March. | [Sugarcane](https://en.banglapedia.org/index.php/Sugarcane) |
| `jhum-sowing` | In jhum, seeds are sown after the first rain in April. | In jhuming, seeds are sown after the first rain in April. | [Jhum](https://en.banglapedia.org/index.php/Jhum) |
| `jhum-fallow` | Jhum fallows have been cut from the traditional ten years to two to three years. | But in recent times, it has been dangerously reduced from its traditional ten year fallow period to two to three years. | [Jhum](https://en.banglapedia.org/index.php/Jhum) |
| `jhum-rotation` | The usual minimum rotation of 7-8 years has fallen to 3-4 years, which is still not sustainable. | The widely followed 7-8 years minimum rotation cycle has now been reduced to just 3-4 years but is still not sustainable. | [Jhum](https://en.banglapedia.org/index.php/Jhum) |
| `jhum-harm` | Jhum lowers soil fertility and brings erosion, deforestation and silting of rivers and lakes. | Harmful results of jhum cultivation include reduction of soil fertility, erosion of land, deforestation, and siltation of rivers and lakes. | [Jhum](https://en.banglapedia.org/index.php/Jhum) |

### Bhuvaneshwari, Hettiarachchi & Meegoda (2019), peer-reviewed

*Crop Residue Burning in India: Policy Challenges and Potential Solutions.* International Journal of Environmental
Research and Public Health 16(5):832. [doi:10.3390/ijerph16050832](https://doi.org/10.3390/ijerph16050832).
The full text was read through Europe PMC (PMC6427124).

| Id | Shown as | Quote |
|---|---|---|
| `burning-season` | In India, 80% of crop residue burning happens after the April–May and November–December harvests. | Jitendra et al. [ 45 ], reported that 80% of the crop residue burning took place during the post-harvest period of April-May and November-December. |
| `residue-shares` | In India, rice makes up about 43% of the crop residue burned, wheat about 21% and sugarcane about 19%. | Among different crop residue, major contribution was 43% of rice, followed by wheat to around 21%, sugarcane to 19% and oilseed crops around 5% [ 43 , 44 ]. |
| `soil-nutrients` | Burning one tonne of straw loses all of its organic carbon, 5.5 kg of nitrogen, 2.3 kg of phosphorus, 25 kg of potassium and 1.2 kg of sulphur. | According to NPMCR [ 7 ], it is reported that burning of one ton of straw accounts for the loss of entire amount of organic carbon, 5.5 kg of nitrogen, 2.3 kg of phosphorous, 25 kg of potassium and 1.2 kg of sulphur. |
| `soil-residue-content` | Crop residues hold about 80% of the nitrogen, 25% of the phosphorus, 50% of the sulphur and 20% of the potassium. | On an average crop residue of different crops contain approximately 80% of nitrogen (N), 25% of phosphorus (P), 50% of sulphur (S) and 20% of potassium (K). |
| `soil-heat` | Burning heats the soil to about 33.8–42.2 °C at 10 mm depth and depletes its bacteria and fungi; long-term effects reach 15 cm down. | Heat from burning of residues raises the soil temperature and causes depletion of the bacterial and fungal population. The residue burning increases the subsoil temperatures to nearly 33.8–42.2 °C at 10 mm depth [ 48 ], and long-term effects can even reach up to 15 cm of the top soil. |
| `soil-microflora` | Frequent burning lowers the soil's nitrogen and carbon and kills the microflora and fauna that benefit it. | Frequent burning reduces nitrogen and carbon potential of the soil and kills the microflora and fauna beneficial to the soil, and further removes the large portion of the organic matter. |
| `smoke-pollutants` | Residue burning raises CO₂, CO, NH₃, NOₓ, SOₓ, non-methane hydrocarbons, volatile organic compounds and particulate matter in the air. | Crop residue burning significantly increases the quantity of air pollutants such as CO 2 , CO, NH 3 , NO X , SO X , Non-methane hydrocarbon (NMHC), volatile organic compounds (VOCs), semi volatile organic compounds (SVOCs) and PM [ 46 , 47 ]. |
| `smoke-hazard` | The particulate matter and smog from residue burning are a health hazard. | The main adverse effects of crop residue burning include the emission of greenhouse gases (GHGs) that contributes to the global warming, increased levels of particulate matter (PM) and smog that cause health hazards, loss of biodiversity of agricultural lands, and the deterioration of soil fertility [ 22 ]. |
| `in-situ` | India's crop residue policy promotes mixing residue into the soil and mulching instead of burning. | The National Policy for Management of Crop Residue [ 7 ] specifically mentions in-situ management through methods such as direct incorporation into soils and mulching as methods that should be promoted in India not only to control crop residue burning but also to prevent environmental degradation in the croplands. |
| `satellite-monitoring` | The same policy calls for satellite remote sensing to monitor how crop residue is managed. | (3) Use satellite-based remote sensing technologies to monitor crop residue management with the National Remote Sensing Agency (NRSA) and Central Pollution Control Board (CPCB). |

### Scientific Reports (2025), peer-reviewed

*Perceptions of air pollution from stubble burning and its health risks in Punjab, India.*
[doi:10.1038/s41598-025-21235-8](https://doi.org/10.1038/s41598-025-21235-8) (full text via Europe PMC, PMC12559406).

| Id | Shown as | Quote |
|---|---|---|
| `pm25-body` | Fine particles (PM2.5) from stubble smoke can enter the respiratory and cardiovascular systems. | The PM 2.5 with aerodynamic diameter of 2.5 μm can enter the human respiratory and cardiovascular systems. |

### Indian Journal of Community Medicine (2024), peer-reviewed

*Perception and Practices Regarding Stubble Burning in Rural Community of Haryana.*
[doi:10.4103/ijcm.ijcm_820_22](https://doi.org/10.4103/ijcm.ijcm_820_22) (full text via Europe PMC, PMC11198530).

| Id | Shown as | Quote |
|---|---|---|
| `haryana-survey` | In a rural Haryana survey, around 70% of participants named respiratory illness as the worst effect of the air pollution. | Around 70% of the participants mentioned that respiratory illness is the most severe effect of air pollution. |
| `happy-seeder` | Zero-tillage drills such as the Turbo Happy Seeder sow wheat straight into the rice stubble right after the rice harvest. | Furthermore, the enhanced version of zero tillage drills with the Turbo Happy Seeder may sow wheat seed directly in the standing and lost rice stubbles immediately after rice harvesting. |

### NASA

| Id | Shown as | Quote | Page |
|---|---|---|---|
| `firms-min-fire` (Sensors page) | MODIS routinely detects flaming and smouldering fires of 1000 m². | MODIS routinely detects both flaming and smoldering fires 1000 m 2 in size. Under very good observing conditions (e.g., near nadir, little or no smoke, relatively homogeneous land surface, etc.) flaming fires one tenth this size can be detected. | [FIRMS FAQ: What size fires can be detected?](https://www.earthdata.nasa.gov/faq/firms-faq) |
| `terra` | Terra MODIS: launched December 18,1999; crosses the equator at 10:30 a.m., descending. | Launch Date: December 18,1999 … Equatorial crossing: 10:30 a.m., descending mode | [About Terra](https://terra.nasa.gov/about) |
| `aqua` | Aqua MODIS crosses the equator in the afternoon and is now drifting to later crossing times. | Aqua was formerly named EOS PM, signifying its afternoon equatorial crossing time. … slowly descending below the A-Train and drifting to later equatorial crossing times, and lower altitudes. | [NASA Aqua mission](https://science.nasa.gov/mission/aqua/) |

The Sensors drawing applies the MODIS share (1000 m² of a 1 km² pixel) to the 375 m VIIRS pixels too, and its
caption says so. The VIIRS algorithm paper (Schroeder et al. 2014, *Remote Sensing of Environment* 143:85–96,
[PDF](https://www.earthdata.nasa.gov/s3fs-public/imported/Schroeder_et_al_2014b_RSE.pdf)) gives detection only as
probability curves (its Fig. 4), not as one routine area to quote.

## 4. Sources checked and not used

| Source | Why not |
|---|---|
| [LightCastle Partners: Bangladesh wheat sector](https://lightcastlepartners.com/insights/2019/10/bangladesh-wheat-sector-demand-supply-mismatch/) (wheat sown Nov–Dec, harvested March to mid-April, citing the BBS crop calendar) | A consultancy blog. Replaced by FAO GIEWS |
| PhilRice "Don't burn rice straw"; UC Davis rice straw publication | Could not be opened (connection refused) |
| USDA FAS Bangladesh Grain and Feed Annual | Returned HTTP 403 |
| CCAFS "Curbing crop residue burning…" | Gives no figures, only "a public health emergency" |
| Sugar-mill news (Financial Express, Daily Star) | Give crushing start dates only, not the season |
| The 133 news items typed into the old Ask-stage registry | None had a URL. A news item is added to `web/src/lib/newsRecords.ts` only after its URL is opened and quoted; the list is empty for now |

## 5. Known gaps

- **Places outside Bangladesh** (57 on the Ask stage) show no fire figures. Fetching regional fire data must wait
  until Amendment 5 is agreed and committed ([amendment5_draft.md](amendment5_draft.md)).
- **Kiln method abroad (Amendments 2–4):**
  - The results are in the committed offline copy (`web/fixtures/nokiln`), but in no published release, so the live
    site does not show them.
  - Re-publishing the export (`python -m kilnwatch export --publish`) is the operator's decision.
  - Until then, the offline copy is not refreshed from the release, because that would drop these results.
- **Human spot-checks:** `docs/VERIFICATION.md` has two rows for a person to sign:
  - RD-1: the news records;
  - RD-2: the quotes in `cropSources.ts`.

## Adding or changing a published source

1. Open the URL and copy the sentence that states the fact into `quote`, verbatim.
2. Write `text` so that every number in it appears in `quote`.
3. Set `checked` to today's date.
4. Prefer UN or government agencies, then peer-reviewed papers (with a DOI), then reputable news. Never a source you
   could not open.
5. Run `cd web && npm test -- --run src/lib/cropSources.test.ts`.
6. Update the matching table on this page.
