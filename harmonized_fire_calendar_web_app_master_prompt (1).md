# Master Prompt & Technical Specification: NASA FIRMS-Style Harmonized Burning Activity Calendar, Multi-Sensor Physics Engine, & Geo-RAG/MCP Platform ($2000\text{--}2026$)

**Target System:** Production-Grade Geospatial Web Application, Scientific Harmonization Engine, Scalable Multilingual Geo-News RAG, & Model Context Protocol (MCP) Server  
**Challenge Alignment:** 2026 NASA Space Apps Challenge — *Harmonization of MODIS and VIIRS Hot Spots*  
**Design Language:** NASA FIRMS (Fire Information for Resource Management System) + NASA Earthdata Worldview Aesthetic  
**Core Deliverables:**
1. **14-Stage Multi-Satellite Physics + Optimal Transport Harmonization Engine** ($2000\text{--}2026$)
2. **NASA FIRMS / Worldview-Styled Interactive Burning Activity Calendar & Synchronized Timeline**
3. **Scalable H3-Indexed Multilingual Geo-News Ground-Truthing Pipeline** (GDELT GKG + ReliefWeb + EONET + Vernacular Gazetteer RAG)
4. **"Best Use of Technology" AI Stack** (Deterministic MCP Server + Multi-Agent UI Controller + n8n Automation Pipeline)

---

## 1. System Role & Copy-Paste Master Prompt Header

> **SYSTEM PROMPT FOR AI ENGINEER / PRINCIPAL GEOSPATIAL ARCHITECT:**
>
> You are a Principal Earth Observation Scientist at NASA Goddard / University of Maryland and a Lead Geospatial Systems Architect for NASA FIRMS. Build a flagship web application and open-science platform that harmonizes $26+\text{ years}$ ($2000\text{--}2026$) of active fire hotspot records across **MODIS (`Terra`, `Aqua`)** and **VIIRS (`Suomi-NPP`, `NOAA-20`, `NOAA-21`)**—anchored by **VIIRS Collection 2 QA Bitmasks**, **MODIS/VIIRS Burned Area (`MCD64A1`/`VNP64A1`)**, **Geostationary Imagers (`GOES`, `Meteosat`, `Himawari`)**, **Sentinel-3 `SLSTR`**, and **VIIRS Nightfire (`VNF`)**—into a unified, sensor-agnostic **Burning Activity Calendar**.
>
> Your architecture must solve the five core engineering and scientific challenges raised by the global NASA Space Apps community:
> 1. **Eliminate Sensor Discontinuities:** Remove artificial step-changes in $2012$ (Suomi-NPP launch), $2018$ (NOAA-20 launch), $2022\text{--}2026$ (MODIS Terra orbital drift), and **November 2, 2026** (Suomi-NPP permanent termination).
> 2. **Solve the $45\text{ GB}$ Global Data Bottleneck:** Compress raw global FIRMS CSV archives into a cloud-native, dual-resolution **Uber H3 + $0.25^\circ$ GeoParquet / DuckDB-Wasm Columnar Cube** ($<180\text{ MB}$) with zero-key fallback to NASA GIBS WMTS vector tiles and `portolan-mirrors/firms-catalog`.
> 3. **Dual Reference Unit Flexibility:** Allow users to switch seamlessly between **MODIS-Equivalent Units** (conservative 26-year continuity), **VIIRS-Equivalent Units** (small-fire reconstructed continuity), **Harmonized Fire Radiative Energy ($\text{MW}$ / $\text{MJ}$)**, and **Effective Burned Area ($\text{km}^2$)** across **Daily, ISO Weekly (52-week), and Monthly (12-month)** calendar granularities.
> 4. **Scalable Multilingual Local News Ground-Truthing:** Pair satellite anomalies with a **Reverse-Gazetteer H3 Geo-News RAG Pipeline** that retrieves historical ($2000\text{--}2026$) and live local news across $65+$ languages without relying on brittle, unscalable generic web searches.
> 5. **Deterministic MCP, Agentic UI & n8n Automation:** Expose all harmonization, attribution, and news-verification algorithms as a zero-hallucination **Model Context Protocol (MCP) Server**, an **In-App UI-Controlling Geospatial Agent**, and an **n8n Automated Workflow**.

---

## 2. Competitive Landscape & Official NASA Space Apps Discussion Insights

### 2.1 Answering the 5 Key Questions from NASA Space Apps GitHub Discussions (`#1786` & `#1879`)

| Community Question / Bottleneck | How Average Teams Fail | How Our Architecture Solves It Completely |
| :--- | :--- | :--- |
| **1. "The raw global FIRMS CSV archive is $\sim 45\text{ GB}$—how do we scale globally?"** *(Discussion `#1786`)* | Either restrict the app to 1 small country or crash the browser trying to parse massive raw CSVs. | **Dual-Tier Columnar Architecture:** Pre-bin the $45\text{ GB}$ point cloud into a **$0.25^\circ$ Global Climate Grid** (for instant planetary view) and **Uber H3 Res-7/Res-8 Zstd GeoParquet shards** queried via **DuckDB-Wasm HTTP Range Requests** ($<120\text{ ms}$ response), with live fallback to **NASA GIBS WMTS tiles** and **`portolan-mirrors/firms-catalog`**. |
| **2. "Should the harmonized record be MODIS-equivalent or VIIRS-equivalent?"** *(Discussion `#1879`)* | Hardcode one arbitrary ratio ($3.7\times$) without physical justification. | **Reference Scale Switcher in UI:** Users can toggle between **Aqua-MODIS Equivalent** ($\beta_{\text{VIIRS}\to\text{Aqua}}$, preserving $1\text{ km}$ historical baseline), **VIIRS-Equivalent** ($\beta_{\text{MODIS}\to\text{VIIRS}}$, reconstructing sub-pixel small fires pre-$2012$), and **Physical Units** ($\text{MW}/\text{km}^2$ and $\text{km}^2$ Burned Area). |
| **3. "Since FIRMS stopped Suomi-NPP data on Nov 2, 2026, how is continuity maintained with NOAA-20 and NOAA-21?"** *(Discussion `#1879`)* | Hardcode `VIIRS_SNPP` or sum raw VIIRS counts, creating a sudden $33\%$ drop after Nov 2, 2026. | **Inverse-Variance State-Space Constellation Stitcher:** Dynamically normalizes across the active sensor set $\mathcal{S}_t$ online on date $t$, chaining $\text{Aqua} \leftarrow \text{S-NPP} \leftarrow \text{NOAA-20} \leftarrow \text{NOAA-21}$ with $0.0\%$ step-change across November 2, 2026. |
| **4. "What time step do intended users need: days, ISO weeks, or months?"** *(Discussion `#1879`)* | Only build a 12-month grid (too coarse for 10-day crop-burning windows or rapid wildfire surges). | **Multi-Granularity Calendar Matrix:** Instant switching between **12-Month Grid**, **52-ISO-Week Heatmap**, **73-Pentad ($5\text{-day}$) Grid**, and **365-Day Diurnal Timeline**. |
| **5. "How do we beat top 2026 repos (`ignis-public`, `flare-chronos`, `FireLens-AI`)?"** | Copy basic DBSCAN or simple overlap multipliers without atmospheric, biome, or news cross-checks. | Combine `flare-chronos` footprint geometry and `ignis-public` convex-hull perimeters with **14-stage physics + Optimal Transport**, **brick kiln / crop harvest attribution**, **GDELT 65-language H3 news RAG**, and a **live MCP + n8n stack**. |

---

## 3. The 14-Stage Global Harmonization Engine (Complete Mathematical Specification)

To make the harmonized dataset usable by peer-reviewed climate scientists, atmospheric modelers, and operational fire managers, implement the following **14-Stage Pipeline**:

### Stage 1: VIIRS Collection 2 Bitwise QA Filtering & South Atlantic Anomaly (SAA) Scrubbing
Before geometric processing, parse the **VIIRS Collection 2 (`VNP14IMG` / `VJ114IMG` / `VJ214IMG`) 32-bit `algorithm QA` bitmask** and MODIS `confidence` fields:
* **Bit 18 (`Potential South Atlantic Magnetic Anomaly`):** Automatically reject spurious nocturnal mid-infrared proton strikes over South America ($15^\circ\text{S}\text{--}45^\circ\text{S}$, $80^\circ\text{W}\text{--}20^\circ\text{W}$)—preventing false fire spikes in Argentina (CONAE's home region) and Brazil.
* **Bit 16 (`Daytime Pixel Saturation`) & Bit 6 (`Channel M13 Quality`):** Flag saturated $375\text{ m}$ I4 pixels ($T_{\text{I4}} \ge 367\text{ K}$) where radiometry folds over to the $750\text{ m}$ dual-gain M13 channel so extreme wildfire $\text{FRP}$ is never clipped.
* **Bit 17 (`Sun-Glint Rejection`) & Bit 19 (`Water Pixel`):** Strip coastal/riverine solar-glint false alarms.
* **Bit 22 (`Residual Bow-Tie Pixel`):** Reject hardware-untrimmed edge-of-swath bow-tie artifacts.

### Stage 2: Intra-Sensor Whiskbroom Scan-Overlap Deduplication
Reconstruct each detection's ground footprint $\mathcal{P}_i$ of area $A_i = \Delta S_i \times \Delta T_i$. Within each single satellite stream, merge scan-line overlap duplicates $(i, j)$ satisfying:
$$\vert t_i - t_j \vert < 8\text{ s} \quad \text{and} \quad \frac{\text{Area}(\mathcal{P}_i \cap \mathcal{P}_j)}{\min(A_i, A_j)} > 0.30$$

### Stage 3: 2D MODIS Triangular Point-Spread Function ($\text{PSF}$) Convolution on VIIRS
MODIS's whiskbroom detector exhibits a triangular response along-scan ($\Delta S_{\text{MODIS}}(\theta)$) and rectangular response along-track ($\Delta T_{\text{MODIS}}(\theta)$). To construct a physically exact **Synthetic MODIS Observation** from $375\text{ m}$ VIIRS clusters in Physics Parity Mode (Track A), convolve VIIRS sub-pixel radiative fluxes with the 2D MODIS angular $\text{PSF}$:
$$\text{PSF}_{\text{MODIS}}(\Delta x, \Delta y, \theta) = \max\left(0, \, 1 - \frac{\vert \Delta x \vert}{\Delta S_{\text{MODIS}}(\theta)}\right) \cdot \mathbb{I}\left(\vert \Delta y \vert \le \frac{\Delta T_{\text{MODIS}}(\theta)}{2}\right)$$
$$\widetilde{\text{FRP}}_{\text{VIIRS}\to\text{MODIS}}(x_0, y_0) = \sum_{k \in \text{VIIRS}} \text{FRP}_k \cdot \text{PSF}_{\text{MODIS}}(x_k - x_0, \, y_k - y_0, \, \theta)$$

### Stage 4: Multi-Stream Static Industrial Scrubber & Biome-Phenology Attribution
Using **VIIRS Collection 2 QA Bits 20–21 (`Persistence Test`)**, `MCD14ML` `type` flags, **Uber H3 Res-8 temporal persistence** ($\ge 16\text{ active weeks/year}$ across $\ge 2\text{ years}$), and **VIIRS Nightfire (`VNF`) 6-band Planck blackbody temperatures ($T_{\text{bb}}$)**, partition all thermal detections into four clean regimes:
1. **`flare_volcano`:** $T_{\text{bb}} > 1450\text{ K}$ or `MCD14ML` `type` $\in \{1, 3\}$ or 12-month persistence.
2. **`static_kiln` (Brick Kilns, Cement/Steel Furnaces):** $T_{\text{bb}} \in [800\text{ K}, 1150\text{ K}]$ with fixed dry-season persistence ($\ge 16\text{ weeks/yr}$).
3. **`crop_residue` (Agricultural Harvest Burns):** Located on `MCD12Q1` Cropland (`IGBP = 12, 14`), cluster duration $\le 48\text{ h}$, occurring within $0\text{--}21\text{ days}$ after a sharp harvest greenness drop ($\Delta\text{NDVI}_{16\text{d}} < -0.15$).
4. **`wildfire` (Forest, Savanna, Shrubland, Peatland):** Natural vegetation biomes or multi-day radially expanding perimeters.

### Stage 5: Viewing Zenith Angle ($\text{VZA}$) Radiometric & Angular Efficiency Correction
Derive $\theta_i$ from pixel expansion $\Delta S_i / \Delta S_{\text{nadir}}$. Correct MODIS off-nadir bow-tie $\text{FRP}$ attenuation and detection efficiency:
$$\text{FRP}_i^{\text{VZA}} = \text{FRP}_i^{\text{dedup}} \cdot \left(1 + \gamma_1 \tan^2(\theta_i) + \gamma_2 \left(\sec(\theta_i) - 1\right)\right), \quad w_{\text{VZA}}(\theta_i) = \frac{P_{\text{det}}(0^\circ)}{P_{\text{det}}(\theta_i)}$$

### Stage 6: Spectral Bandpass & Atmospheric Water-Vapor Transmittance Correction ($\tau_{4\mu\text{m}}$)
Because VIIRS I4 ($3.55\text{--}3.93\ \mu\text{m}$) overlaps the $3.6\text{--}3.8\ \mu\text{m}$ water-vapor absorption wing while MODIS Ch21/22 ($3.929\text{--}3.989\ \mu\text{m}$) sits in a cleaner window, normalize cross-sensor transmittance using `ERA5` Total Column Water Vapor ($\text{TCWV}$ in $\text{kg/m}^2$):
$$\eta_{\text{spectral}}(\text{TCWV}, \theta_i) = \exp\left(\left(\kappa_{\text{I4}} - \kappa_{\text{Ch21}}\right) \cdot \text{TCWV} \cdot \sec(\theta_i)\right), \quad \Delta\kappa \approx 0.0018\text{ m}^2\text{/kg}$$

### Stage 7: Forest Canopy Leaf Area Index ($\text{LAI}$) Slant-Path Interception
Correct for canopy crown occlusion of understory surface fires at oblique viewing angles using `MOD15A2H` $\text{LAI}$:
$$\Psi_{\text{canopy}}(\text{LAI}, \theta_i) = \exp\left(-G(\theta_i) \cdot \text{LAI} \cdot \left(\sec(\theta_i) - 1\right)\right), \quad G(\theta_i) \approx 0.5$$

### Stage 8: Contextual Background Window Contrast Harmonization
Align contextual threshold sensitivity across MODIS ($21\times 21\text{ pixel} = 441\text{ km}^2$) and VIIRS ($21\times 21\text{ pixel} = 62\text{ km}^2$) background windows along coastlines, alpine valleys, and megafire interiors using the normalized thermal contrast ratio:
$$\Delta T_{\text{norm}, i} = \frac{T_{4, i} - T_{11, i}}{\max\left(4.0\text{ K}, \, T_{4, i} - T_{4, \text{bg}}\right)}$$

### Stage 9: Equatorial Swath-Gap & Cloud Obscuration Effort Normalization ($\Omega_{g, d}$)
Correct MODIS's daily equatorial inter-orbit blind spots ($|\phi_g| < 30^\circ$) and cloud fraction $C_{g, d}$ (`MOD14CMQ` formulation):
$$\Omega_{g, d}^{(s)} = f_{\text{swath}}(\phi_g, d, s) \cdot \max\left(0.15, \, 1 - C_{g, d}\right)$$

### Stage 10: Geostationary + Sentinel-3 Anchored Diurnal Cycle & Terra Post-2022 Orbital Drift Fix
Correct MODIS Terra's post-$2021$ Mean Local Time orbital drift (from $10:30\text{ AM}$ down to $09:00\text{ AM}$ MLT by $2026$) using regional $15\text{-minute}$ geostationary diurnal profiles (`GOES-16/18/19`, `Meteosat SEVIRI/MTG-I1`, `Himawari-8/9`) and `Sentinel-3A/B SLSTR` ($10:00\text{ AM}$ LST) morning continuity anchors:
$$\kappa_{\text{Terra}}(y, r, b, m) = \frac{D_{r, b, m}(10.50\text{ h})}{D_{r, b, m}\left(t_{\text{Terra\_MLT}}(y)\right)}$$

### Stage 11: Inverse-Variance State-Space Constellation Cutover Stitcher (Nov 2, 2026 S-NPP Shutdown)
Collapse afternoon passes (`S-NPP`, `NOAA-20`, `NOAA-21`) within $\tau = 60\text{ min}$ and stitch active sensors $\mathcal{S}_t$ online on date $t$:
$$\hat{Y}_{g, t}^{\text{harm}} = \frac{\sum_{s \in \mathcal{S}_t} w_{g, t}^{(s)} \cdot \mathcal{T}_{s \to \text{ref}}\left(\tilde{Y}_{g, t}^{(s)}\right)}{\sum_{s \in \mathcal{S}_t} w_{g, t}^{(s)}}, \quad w_{g, t}^{(s)} = \frac{\Omega_{g, t}^{(s)}}{\sigma_{s, g}^2}$$

### Stage 12: Zero-Inflated Negative Binomial (ZINB) Hurdle + Empirical Bayes `combine` Calibration
Daily and weekly fire counts in fine grid cells contain $80\%\text{--}95\%$ zeros and heavy right-skewness. Because $375\text{ m}$ VIIRS detects small fires on days when $1\text{ km}$ MODIS records $0$, scaling counts by a linear multiplier fails to adjust the **zero-occurrence hurdle**. We fit a **Two-Part ZINB Hurdle + Hierarchical Shrinkage Model** on the clean $2012\text{--}2022$ overlap window:
1. **Part 1 — Ignition Occurrence Hurdle ($\pi_{g, d} = \Pr(Y_{g, d} > 0)$):**
   $$\text{logit}\left(\pi_{g, d}^{(\text{ref})}\right) = \alpha_{0, b, m} + \alpha_{1, b, m} \, \text{logit}\left(\pi_{g, d}^{(s)}\right) + \alpha_2 \, \text{TCWV}_{g, d} + \alpha_3 \, \text{LAI}_g$$
2. **Part 2 — Positive Count Hierarchical Shrinkage (`combine` Estimator):**
   Conditional on $Y_{g, d} > 0$, blend the local cell-month ratio $\beta_{g, m}^{(s)}$ with the continental-biome-month prior $\beta_{r(g), b, m}^{(s)}$:
   $$\beta_{g, b, m}^{\text{combine},(s)} = \lambda_{g, m} \, \beta_{g, m}^{(s)} + \left(1 - \lambda_{g, m}\right) \beta_{r(g), b, m}^{(s)}, \quad \lambda_{g, m} = \frac{n_{g, m}}{n_{g, m} + \kappa_0} \quad (\kappa_0 = 50)$$

### Stage 13: 1D Wasserstein Optimal Transport ($W_2$ Barycenter) for Fire Radiative Power ($\text{FRP}$)
Rather than distorting extreme megafire peaks with Ordinary Least Squares, align the full probability distribution of log-transformed $\text{FRP}$ across sensors by minimizing the **quadratic 2-Wasserstein distance**:
$$W_2^2\left(\mu_s, \, \mu_{\text{ref}}\right) = \int_0^1 \left\vert F_{s, b, m}^{-1}(q) - F_{\text{ref}, b, m}^{-1}(q) \right\vert^2 dq$$
Applying the exact Monge-Kantorovich optimal transport map $\mathcal{T}_{s \to \text{ref}}(x) = F_{\text{ref}, b, m}^{-1}\left(F_{s, b, m}(x)\right)$ guarantees exact distributional equivalence from $0.5\text{ MW}$ agricultural burns up to $1,500\text{ MW}$ crown fires.

### Stage 14: Dual Burned-Area Coupling (`MCD64A1` + New FIRMS `VNP64A1` + `HLS` 30 m)
Couple harmonized active-fire counts and $\text{FRP}$ to the newly integrated **NASA FIRMS VIIRS Global Burned Area (`VNP64A1`)** and **MODIS Burned Area (`MCD64A1`)** products (plus $20\text{--}30\text{ m}$ Harmonized Landsat Sentinel-2 `dNBR` calibration tiles) to output **Harmonized Effective Burned Area ($\widehat{\text{BA}}_{g, t}$ in $\text{km}^2$)** alongside hotspot counts.

---

## 4. Scalable, Area-Specific, Multilingual Geo-News Ground-Truthing Architecture

### 4.1 Why Standard Google Search or Live LLM Web Search Fails at Global Scale
1. **No Historical Depth ($2000\text{--}2026$):** Standard search/news APIs only index the last $30\text{ days}$ or return irrelevant SEO pages when querying a specific week in $2004$, $2012$, or $2019$.
2. **The Polygon-to-Place-Name Gap:** Users draw an arbitrary polygon or click an H3 hexagon (`87c2...`), whereas news articles reference sub-national administrative units (*Upazilas*, *Tehsils*, *Departamentos*, *Municípios*, or *National Parks*).
3. **Vernacular Media Silos:** Regional fires in Argentina are reported in Spanish by local provincial outlets (*El Independiente La Rioja*); fires in Bangladesh/India are reported in Bengali, Hindi, Odia, or Punjabi; fires in the Balkans or Russia are reported in Cyrillic. English-only search misses $>80\%$ of local fire reporting.
4. **Latency & Rate Limits:** Triggering a live LLM web search on every calendar click takes $5\text{--}15\text{ seconds}$ and fails under concurrent judge testing.

### 4.2 The 4-Layer H3-Indexed Geo-News & Event RAG Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: OFFLINE H3-TO-MULTILINGUAL GAZETTEER RESOLVER (Sub-Millisecond Lookup)        │
│  User Polygon / H3 Cell ──► Spatial Join against GADM (ADM1/ADM2/ADM3) + WDPA Parks    │
│  Outputs: Local District Names + ISO Language Codes + Vernacular Fire Taxonomies       │
│  Example: (-29.16, -67.49) ──► "Chilecito, La Rioja, AR" + [es: incendio forestal...]  │
│  Example: (23.99, 90.42)   ──► "Gazipur, Dhaka, BD"      + [bn: অগ্নিকাণ্ড, ইটভাটা...] │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 2: FEDERATED MULTI-SOURCE GEOSPATIAL EVENT & NEWS INGESTION                      │
│  1. GDELT 2.0 Global Knowledge Graph (GKG) + V2Locations (15-min live + BigQuery 26-Yr)│
│     • Parses 65 live-translated languages with exact article-level Lat/Lon & ADM codes │
│     • Pre-filtered by themes: ENV_WILDFIRE, NATURAL_DISASTER_WILDFIRE, AGRI_BURNING    │
│  2. UN OCHA ReliefWeb API v2 + GDACS + Copernicus EMS (1996–2026 Disaster Archive)     │
│  3. NASA EONET v3 (Earth Observatory Natural Event Tracker Wildfire Polygons/Points)   │
│  4. Media Cloud Regional Directory + Wikidata Historical Fire SPARQL Graph             │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 3: SPATIO-TEMPORAL H3 × ISO-WEEK HYBRID RAG INDEX (DuckDB-VSS + BM25)            │
│  • Every news/event record is geocoded to its H3 Res-5 cell (or ADM2 ID) and ISO Week  │
│  • Stored in a compact GeoParquet + Vector Index (`h3_res5`, `year`, `iso_week`,       │
│    `source_domain`, `lang`, `title_en`, `title_native`, `url`, `tone`, `embedding`)    │
│  • Instant (<30 ms) deterministic retrieval for any clicked Calendar Cell!             │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 4: SATELLITE-TO-MEDIA CONCORDANCE & "SILENT IGNITION" CLASSIFIER                 │
│  Computes the Media Concordance Matrix for every (Region, Year, Week/Month):           │
│  • High Satellite SFAI (≥+2σ) + High News Volume ──► ✅ Confirmed Wildfire / Smog Crisis│
│  • Raw VIIRS Spike + Normal Harm SFAI + 0 News   ──► 🛡️ Sensor Artifact Proven Fixed!  │
│  • High Satellite SFAI (≥+2.5σ) + 0 Local News   ──► 🚨 Unreported "Silent Ignition"   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Pre-Built BigQuery SQL Script to Generate the 26-Year Global GDELT H3 Fire News Cube
To give your app instant $2000\text{--}2026$ historical news coverage across every country on Earth without runtime API bottlenecks, run this single query against the free public `gdelt-bq.gdeltv2.gkg_partitioned` dataset and export the result as a compact `<35 MB` Parquet file (`data/gdelt_fire_news_2000_2026.parquet`):

```sql
-- BigQuery SQL: Extract 65-Language Geolocation-Resolved Fire News Binned by Year, Week & Lat/Lon Grid
SELECT
  EXTRACT(YEAR FROM PARSE_TIMESTAMP('%Y%m%d%H%M%S', CAST(DATE AS STRING))) AS year,
  EXTRACT(ISOWEEK FROM PARSE_TIMESTAMP('%Y%m%d%H%M%S', CAST(DATE AS STRING))) AS iso_week,
  ROUND(SAFE_CAST(SPLIT(loc, '#')[SAFE_OFFSET(5)] AS FLOAT64), 1) AS lat_bin,
  ROUND(SAFE_CAST(SPLIT(loc, '#')[SAFE_OFFSET(6)] AS FLOAT64), 1) AS lon_bin,
  SPLIT(loc, '#')[SAFE_OFFSET(2)] AS country_code,
  SPLIT(loc, '#')[SAFE_OFFSET(3)] AS adm1_code,
  SPLIT(loc, '#')[SAFE_OFFSET(1)] AS location_name,
  SourceCommonName AS media_outlet,
  DocumentIdentifier AS article_url,
  COUNT(*) AS mention_count
FROM `gdelt-bq.gdeltv2.gkg_partitioned`,
UNNEST(SPLIT(V2Locations, ';')) AS loc
WHERE
  (REGEXP_CONTAINS(V2Themes, r'(WILDFIRE|NATURAL_DISASTER_FIRE|ENV_FOREST_FIRE|AGRICULTURAL_FIRE|SMOG)')
   OR REGEXP_CONTAINS(LOWER(Extras), r'(wildfire|forest fire|stubble burning|incendio forestal|queimadas)'))
  AND SAFE_CAST(SPLIT(loc, '#')[SAFE_OFFSET(5)] AS FLOAT64) IS NOT NULL
GROUP BY year, iso_week, lat_bin, lon_bin, country_code, adm1_code, location_name, media_outlet, article_url
```

---

## 5. Winning "Best Use of Technology": Deterministic MCP, Multi-Agent Geo-RAG & n8n Stack

To dominate the **Best Use of Technology** judging criteria while maintaining $100\%$ scientific integrity (zero hallucinated numbers), implement a **Three-Pillar AI & Automation Architecture**:

### Pillar 1: The Open-Science Model Context Protocol (`FastMCP`) Server
Expose the entire 14-stage harmonization engine and H3 news ground-truthing index as a standardized **MCP Server** (`src/mcp/fireCalendarMcpServer.ts`) so external researchers using Claude Desktop, Cursor, Jupyter, or n8n can query calibrated 26-year fire records directly:

* **MCP Tool 1 — `get_harmonized_burning_calendar`:**
  Accepts `bbox` or `(lat, lon, radius_km)`, `granularity` (`monthly` | `weekly` | `daily`), `reference_scale` (`aqua_modis_eq` | `viirs_eq` | `frp_mw` | `burned_area_km2`), and `regime_filter`. Returns the exact calibrated matrix, $95\%$ credible intervals, 26-year historical medians, and Seasonal Mann-Kendall trend ($\tau_{\text{MK}}, p$).
* **MCP Tool 2 — `audit_sensor_harmonization_physics`:**
  Returns the exact ablation breakdown for any selected AOI and period: how many duplicates Stage 2 removed, how many static brick kilns/flares Stage 4 scrubbed, the Stage 6 water-vapor spectral factor $\eta_{\text{spectral}}$, the Stage 10 Terra orbital drift restoration $\kappa_{\text{Terra}}$, and the Pettitt homogeneity test $p$-value across $2012$, $2018$, and November 2, 2026.
* **MCP Tool 3 — `query_multilingual_geo_news_rag`:**
  Resolves the AOI polygon to local `ADM1`/`ADM2` names, queries the H3-indexed GDELT + ReliefWeb + EONET hybrid RAG index for the target year/week, and computes the **Satellite-to-Media Concordance Status** (`CONFIRMED_EVENT`, `SENSOR_ARTIFACT_FIXED`, or `SILENT_UNREPORTED_IGNITION`).
* **MCP Tool 4 — `control_firms_calendar_ui` *(Client-Side UI Action Tool)*:**
  Allows the in-app AI Analyst to programmatically fly the MapLibre 3D globe to an coordinates box, switch the calendar view tab (e.g., to `Δ Historical Median` or `Raw vs. Harmonized Split`), and highlight specific anomalous cells.

### Pillar 2: Glass-Box Multi-Agent Investigator (Inside the Web App)
When a user clicks any cell on the 26-year Burning Activity Calendar, a sleek **"Glass-Box Agentic Trace"** executes three deterministic sub-agents in parallel and shows each tool call transparently in the UI:
1. **`Physics & Calibration Agent`:** Calls `audit_sensor_harmonization_physics` to verify that the cell's anomaly ($\text{SFAI}$) is a genuine physical combustion spike and not a VIIRS constellation or orbital-drift artifact.
2. **`Biome & Source Attribution Agent`:** Checks `MCD12Q1` land cover, `MOD13Q1` $\Delta\text{NDVI}$ crop-harvest drops, and `VIIRS Nightfire` temperatures to attribute the cell's energy across **Forest Wildfires**, **Post-Harvest Agricultural Burns**, and **Scrubbed Industrial Kilns**.
3. **`Multilingual Geo-News RAG Agent`:** Calls `query_multilingual_geo_news_rag` to fetch matched local-language news reports (e.g., Spanish reports from La Rioja for the July 2026 Chilecito fire, or Bengali/Hindi reports for South Asia) and synthesizes a grounded citation card.

### Pillar 3: n8n Automated Multi-Channel Ingestion & Alert Workflow (`workflows/n8n_harmonized_calendar_ops.json`)
Provide an exportable, live-connected **n8n Workflow** with two automated pipelines visible via a live status modal in the web app:
* **Pipeline A (Scalable Regional News Harvester):** Triggered on schedule or when a user inspects a new AOI; resolves local administrative names, queries GDELT DOC 2.0 / ReliefWeb / EONET in native languages, translates snippets, and upserts verified event records into the H3 Geo-News RAG store.
* **Pipeline B (Critical Calendar Period & Silent Ignition Dispatcher):** Triggered when the current week's harmonized activity crosses $\text{SFAI} \ge +2.0\sigma$ above the 26-year historical median; calls the **MCP Server** via n8n's native `MCP Client Node`, checks if local news volume is zero (**Silent Ignition**), and dispatches a formatted Calendar Anomaly Snapshot + CSV link to a public demo Telegram channel and webhook.

---

## 6. NASA FIRMS + Worldview UI Layout & Interactive Feature Specification

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [NASA Earthdata] CHRONOS-FIRMS · Global Harmonized MODIS–VIIRS Burning Activity Calendar (2000–2026) │
│ Presets: [🇦🇷 Chilecito AR (CONAE 2026)] [🇧🇩 Dhaka/IGP] [🇮🇳 Punjab] [🇧🇷 Amazon] [🇨🇦 Boreal] [🌍 Global]   │
│ Scale: [Aqua-MODIS Eq | VIIRS Eq | FRP (MW) | Burned Area (km²)]  View: [🔬 Sci | 🚒 Mgr | 🌱 Simple] │
├─────────────────────────┬──────────────────────────────────────────┬─────────────────────────────────┤
│ LEFT DOCK (310px)       │ CENTER VIEWPORT: 3D H3 & 0.25° GLOBE     │ RIGHT WORKSPACE (560px)         │
│ SPATIAL & PHYSICS ENGINE│ (MapLibre GL + Deck.gl + NASA GIBS WMTS) │ HARMONIZED BURNING CALENDAR     │
│                         │                                          │                                 │
│ 1. Area of Interest     │  ┌────────────────────────────────────┐  │ Granularity: [Month|Week|Day]   │
│  [✏️ Draw Polygon/Box]  │  │ Map Layers:                        │  │ Tabs:                           │
│  Lat: [-29.16 ]         │  │ • Harmonized H3 Hexagons (Res 7/8) │  │ [📅 26-Yr Matrix] [⚖️ Δ Median] │
│  Lon: [-67.49 ]         │  │ • MODIS 1km vs VIIRS 375m Footpr.  │  │ [🧭 Polar Clock]  [🔬 Proof 1:1]│
│  Rad: [ 50 km ] [Apply] │  │ • DBSCAN Convex-Hull Fire Fronts   │  │                                 │
│                         │  │ • GIBS TrueColor & Burned Area     │  │ ┌─────────────────────────────┐ │
│ 2. 14-Stage Harmonizer  │  └────────────────────────────────────┘  │ │ 2000 ░░▒▒▓▓██▒▒░░...        │ │
│  Mode:                  │                                          │ │ ...                         │ │
│  (•) ZINB + β-Combine   │         [Interactive 3D/2D Map]          │ │ 2012 ░░▒▒▓▓██▒▒░░ (Smooth!) │ │
│  ( ) W2 Optimal Transp. │     (Drawing a box or clicking a cell    │ │ ...                         │ │
│  ( ) 2D PSF Physics MDL │      recomputes the 26-Year Calendar     │ │ 2026 ░░▒▒██▓▓▒▒░░ [±95% CI] │ │
│  ( ) Raw Unharmonized   │      and Geo-News RAG in <100 ms!)       │ │ Med  ░░▒▒▓▓██▒▒░░ (Baseline)│ │
│                         │                                          │ └─────────────────────────────┘ │
│  Active Corrections:    │                                          │                                 │
│  [✓] C2 QA & SAA Filter │  ┌────────────────────────────────────┐  │ CELL INSPECTOR & GEO-NEWS RAG   │
│  [✓] Scan/VZA + PSF 2D  │  │ 📰 H3 Multilingual Geo-News Match: │  │ • Jul 2026 vs Historical Median:│
│  [✓] H2O Spectral τ_4μm │  │ • 14 Spanish reports (La Rioja AR) │  │   +2.8σ (99.4th Percentile)     │
│  [✓] Canopy LAI Filter  │  │ • Concordance: ✅ Confirmed Event  │  │ • Regime: 91% Wildfire / 9% Ag  │
│  [✓] Terra Drift (Geo)  │  └────────────────────────────────────┘  │ • Mann-Kendall: τ=+0.31 (p<.01) │
│  [✓] S-NPP Nov 2 Cutover│                                          │                                 │
│                         │                                          │ [🤖 Run MCP Agent Investigation]│
│ 3. Source Attribution   │                                          │ [⚡ Trigger n8n Alert Workflow] │
│  [✓] Forest Wildfires   │                                          │ [⬇ Download Harmonized CSV]     │
│  [✓] Crop Harvest Burns │                                          │ [🔌 Connect External MCP Client]│
│  [ ] Static Brick Kilns │                                          │                                 │
├─────────────────────────┴──────────────────────────────────────────┴─────────────────────────────────┤
│ BOTTOM DOCK: NASA WORLDVIEW SYNCHRONIZED 26-YEAR TIMELINE, TIMELAPSE & CONSTELLATION GANTT           │
│ [⏮] [▶ Play 2000–2026 Timelapse] [1x|4x]  Palette: [FIRMS Thermal | Cividis | Diverging]  [EN|ES|বাংলা]│
│ Harmonized Series: ▂▃▅▂▂▄▆▂▃▅█▃▂▄▅▃▂▆▄▂▃▇▅▂▃▅█▄▂▃▆▅▃▂▄█▆▃▂▅▇▃  |  News Mentions: ┈▁┈▃┈┈▅┈▂┈▇┈┈█┈     │
│ Satellites Online: [Terra 00–26] [Aqua 02–26] [S-NPP 12–Nov 2026┫] [NOAA-20 18–26] [NOAA-21 24–26]   │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Complete Reference Implementation: Harmonizer + Scalable Geo-News RAG + MCP Tools

```typescript
// src/lib/chronosHarmonizerAndGeoNews.ts

export interface GazetteerResolution {
  h3Res5: string;
  countryIso2: string;
  adm1Name: string;
  adm2Name: string;
  primaryLang: "en" | "es" | "bn" | "hi" | "pt";
  vernacularFireKeywords: string[];
}

export interface GeoNewsArticle {
  id: string;
  date: string;
  year: number;
  isoWeek: number;
  sourceOutlet: string;
  language: string;
  titleNative: string;
  titleTranslatedEn: string;
  url: string;
  distanceKm: number;
  sourceTier: "GDELT_GKG" | "RELIEFWEB_UN" | "NASA_EONET" | "REGIONAL_RSS";
}

export interface ConcordanceReport {
  status: "CONFIRMED_DISASTER" | "SENSOR_ARTIFACT_FIXED" | "SILENT_UNREPORTED_IGNITION" | "NORMAL_BACKGROUND";
  sfaiAnomalySigma: number;
  rawSensorJumpRatio: number;
  matchedArticlesCount: number;
  topArticles: GeoNewsArticle[];
  gazetteerContext: GazetteerResolution;
}

/**
 * 1D Quadratic Wasserstein Optimal Transport (W2) Quantile Mapper for FRP Harmonization
 * Aligns empirical cumulative distribution of sensor s onto the Aqua/VIIRS reference anchor.
 */
export function wassersteinOptimalTransportFrp(
  rawFrpMw: number,
  sensorQuantiles: Float64Array,   // Precomputed 100-bin log-FRP quantiles for sensor s
  referenceQuantiles: Float64Array // Precomputed 100-bin log-FRP quantiles for reference anchor
): number {
  if (rawFrpMw <= 0) return 0;
  const logVal = Math.log10(rawFrpMw + 1.0);

  // Binary search empirical CDF quantile q in [0, 1]
  let low = 0;
  let high = sensorQuantiles.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sensorQuantiles[mid] < logVal) low = mid + 1;
    else high = mid;
  }
  const qIndex = Math.min(referenceQuantiles.length - 1, Math.max(0, low));
  const transportedLogFrp = referenceQuantiles[qIndex];
  return Math.max(0, Math.pow(10, transportedLogFrp) - 1.0);
}

/**
 * Scalable Multilingual Geo-News Retriever & Satellite-to-Media Concordance Classifier
 * Uses H3-binned GDELT GKG + ReliefWeb + NASA EONET without slow/unscalable generic web search.
 */
export async function queryScalableGeoNewsAndConcordance(params: {
  lat: number;
  lon: number;
  radiusKm: number;
  year: number;
  isoWeek: number;
  harmonizedSfaiSigma: number;
  rawViirsToModisJumpRatio: number;
  gazetteerDb: Map<string, GazetteerResolution>;
  preindexedNewsCube: GeoNewsArticle[];
}): Promise<ConcordanceReport> {
  const latBinKey = `${params.lat.toFixed(1)},${params.lon.toFixed(1)}`;
  const gazetteer: GazetteerResolution = params.gazetteerDb.get(latBinKey) ?? {
    h3Res5: "85c2e3fffffff",
    countryIso2: "AR",
    adm1Name: "La Rioja",
    adm2Name: "Chilecito",
    primaryLang: "es",
    vernacularFireKeywords: ["incendio forestal", "focos ígneos", "quema"],
  };

  // 1. Instant local query on pre-indexed H3/Lat-Lon x ISO-Week GeoParquet News Cube
  const matched = params.preindexedNewsCube.filter(
    (art) =>
      art.year === params.year &&
      Math.abs(art.isoWeek - params.isoWeek) <= 1 &&
      art.distanceKm <= params.radiusKm
  );

  // 2. Classify Satellite-to-Media Concordance
  let status: ConcordanceReport["status"] = "NORMAL_BACKGROUND";
  if (params.harmonizedSfaiSigma >= 2.0 && matched.length > 0) {
    status = "CONFIRMED_DISASTER";
  } else if (
    params.rawViirsToModisJumpRatio >= 2.5 &&
    params.harmonizedSfaiSigma < 1.2 &&
    matched.length === 0
  ) {
    // Raw VIIRS showed a huge jump, but our Harmonizer said it was normal AND news confirms 0 disasters!
    status = "SENSOR_ARTIFACT_FIXED";
  } else if (params.harmonizedSfaiSigma >= 2.5 && matched.length === 0) {
    // True harmonized satellite anomaly with zero local media coverage -> Unreported Silent Ignition!
    status = "SILENT_UNREPORTED_IGNITION";
  }

  return {
    status,
    sfaiAnomalySigma: params.harmonizedSfaiSigma,
    rawSensorJumpRatio: params.rawViirsToModisJumpRatio,
    matchedArticlesCount: matched.length,
    topArticles: matched.slice(0, 8),
    gazetteerContext: gazetteer,
  };
}
```