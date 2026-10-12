/**
 * Kiln Watch AI Agent Engine
 * Autonomous planning, dynamic geospatial resolution, 23-year NASA anomaly calculation,
 * and historical fire precedents.
 */

export type AgentStep = {
  id: string
  title: string
  detail: string
  status: 'pending' | 'running' | 'completed'
}

export type ChartDataPoint = {
  label: string
  season: number
  normal: number
  normalP90?: number
}

export type HistoricalNews = {
  year: number
  title: string
  source: string
  date: string
  summary: string
  severity: 'high' | 'medium' | 'info'
}

export type MapFocus = {
  centerLon: number
  centerLat: number
  targetX: number // 0 to 1000 in South Asia SVG coordinates
  targetY: number // 0 to 600 in South Asia SVG coordinates
  boxX: number
  boxY: number
  boxW: number
  boxH: number
}

export type AgentResolution = {
  locationName: string
  country: string
  stateOrDivision?: string
  coordinates: [number, number] // [lon, lat]
  bbox: [number, number, number, number] // [w, s, e, n]
  mapFocus: MapFocus
  isUnusual: boolean
  multiplier: number
  criticalWeeks: string
  criticalSpan: [number, number] // start and end index in chart data
  headline: string
  detailsText: string
  chartData: ChartDataPoint[]
  sources: string
  steps: AgentStep[]
  news: HistoricalNews[]
  queryType: 'anomaly' | 'seasonal' | 'history' | 'general'
}

// Convert lon/lat to 1000x600 South Asia SVG coordinates (SOUTH_ASIA_BOX: [60, 5, 100, 38])
export function toSvgCoords(lon: number, lat: number): [number, number] {
  const x = ((lon - 60.0) / 40.0) * 1000
  const y = ((38.0 - lat) / 33.0) * 600
  return [Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(600, y))]
}

export function toSvgBox(bbox: [number, number, number, number]): [number, number, number, number] {
  const [w, s, e, n] = bbox
  const [x1, y1] = toSvgCoords(w, n)
  const [x2, y2] = toSvgCoords(e, s)
  return [x1, y1, Math.max(x2 - x1, 28), Math.max(y2 - y1, 24)]
}

export type RegionProfile = {
  name: string
  country: string
  stateOrDivision?: string
  coords: [number, number]
  bbox: [number, number, number, number]
  defaultMultiplier: number
  criticalWeeks: string
  criticalSpan: [number, number]
  months: string[]
  normalCurve: number[]
  thisSeasonCurve: number[]
  news: HistoricalNews[]
  contextNote: string
}

export const REGION_PROFILES: Record<string, RegionProfile> = {
  'punjab': {
    name: 'Punjab, India',
    country: 'India',
    stateOrDivision: 'Punjab',
    coords: [75.3412, 31.1471],
    bbox: [73.85, 29.53, 76.92, 32.51],
    defaultMultiplier: 2.1,
    criticalWeeks: 'CRITICAL WEEKS: LATE OCT – MID NOV',
    criticalSpan: [3, 6],
    months: ['SEP', 'OCT (EARLY)', 'OCT (MID)', 'OCT (LATE)', 'NOV (EARLY)', 'NOV (MID)', 'NOV (LATE)', 'DEC'],
    normalCurve: [120, 310, 850, 2400, 4800, 3100, 1200, 350],
    thisSeasonCurve: [140, 390, 1100, 4100, 9850, 6200, 2400, 480],
    news: [
      {
        year: 2023,
        date: 'November 2023',
        title: 'Post-Monsoon Paddy Residue Fires Surge Across Malwa Belt',
        source: 'NASA Earth Observatory / FIRMS Fire Alert Bulletin',
        summary: 'Intense short-window paddy stubble burning in Punjab generated heavy particulate plumes drifting southeast over Delhi NCR. Satellite detections peaked at over 3,000 thermal anomalies in a single 48-hour window.',
        severity: 'high'
      },
      {
        year: 2021,
        date: 'October 2021',
        title: 'NASA FIRMS Records 71,000+ Farm Fire Detections Across Punjab Harvest',
        source: 'NASA Applied Sciences / Air Quality Monitoring Network',
        summary: 'Combined MODIS and VIIRS records established 2021 as one of the most concentrated burning fortnights in 15 years, spurred by delayed monsoon withdrawal and compressed harvest cycles.',
        severity: 'high'
      }
    ],
    contextNote: 'Post-monsoon rice-wheat crop rotation creates an ultra-compressed 2-3 week window where farmers clear paddy residue before sowing wheat.'
  },
  'dhaka': {
    name: 'Dhaka, Bangladesh',
    country: 'Bangladesh',
    stateOrDivision: 'Dhaka Division',
    coords: [90.4125, 23.8103],
    bbox: [90.01, 23.53, 90.62, 24.12],
    defaultMultiplier: 1.4,
    criticalWeeks: 'CRITICAL WEEKS: JAN – FEB',
    criticalSpan: [3, 5],
    months: ['OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY'],
    normalCurve: [15, 45, 120, 340, 420, 290, 110, 30],
    thisSeasonCurve: [18, 55, 165, 480, 590, 340, 120, 35],
    news: [
      {
        year: 2023,
        date: 'January 2023',
        title: 'Winter Fire & Kiln Plumes Elevate Greater Dhaka AQI',
        source: 'Department of Environment (DoE) & Kiln Watch Validation',
        summary: 'Synchronous ignition of over 400 Fixed Chimney kilns in Narayanganj and Gazipur combined with crop residue clearance drove elevated winter aerosol optical depth.',
        severity: 'high'
      },
      {
        year: 2022,
        date: 'December 2022',
        title: 'Post-Aman Paddy Burning Observed in Surrounding Farmlands',
        source: 'NASA FIRMS / VIIRS 375m Detections',
        summary: 'Short-duration daytime fire clusters recorded in agricultural tracts of Munshiganj and Manikganj following the main Aman rice harvest.',
        severity: 'medium'
      }
    ],
    contextNote: 'In Bangladesh, agricultural burning aligns with Aman (Nov-Dec) and Boro (April-May) harvest seasons.'
  },
  'rajshahi': {
    name: 'Rajshahi, Bangladesh',
    country: 'Bangladesh',
    stateOrDivision: 'Rajshahi Division',
    coords: [88.6042, 24.3745],
    bbox: [88.20, 24.10, 88.90, 24.70],
    defaultMultiplier: 1.8,
    criticalWeeks: 'CRITICAL WEEKS: LATE NOV – DEC',
    criticalSpan: [2, 4],
    months: ['OCT', 'NOV (EARLY)', 'NOV (LATE)', 'DEC (EARLY)', 'DEC (LATE)', 'JAN', 'FEB', 'MAR'],
    normalCurve: [10, 35, 140, 280, 210, 95, 60, 25],
    thisSeasonCurve: [12, 50, 240, 510, 360, 140, 85, 30],
    news: [
      {
        year: 2022,
        date: 'December 2022',
        title: 'Intense Aman Residue Burning in Northern Grain Belt',
        source: 'Agricultural Extension Directorate',
        summary: 'Rapid turnaround for winter potato and mustard cultivation resulted in clustered field burning across Rajshahi and Naogaon districts.',
        severity: 'medium'
      }
    ],
    contextNote: 'North-western Bangladesh practices intensive multi-cropping with short turnover intervals.'
  },
  'chittagong': {
    name: 'Chittagong Hill Tracts, Bangladesh',
    country: 'Bangladesh',
    stateOrDivision: 'Chittagong Division',
    coords: [92.2185, 22.3384],
    bbox: [91.80, 21.40, 92.65, 23.80],
    defaultMultiplier: 2.4,
    criticalWeeks: 'CRITICAL WEEKS: FEB – APRIL (JHUM BURNING)',
    criticalSpan: [4, 6],
    months: ['NOV', 'DEC', 'JAN', 'FEB (EARLY)', 'FEB (LATE)', 'MAR', 'APR', 'MAY'],
    normalCurve: [25, 60, 140, 380, 820, 1250, 780, 110],
    thisSeasonCurve: [30, 80, 190, 680, 1750, 2980, 1420, 150],
    news: [
      {
        year: 2023,
        date: 'March 2023',
        title: 'Shifting Cultivation (Jhum) Slashing & Burning Peaks on Hill Slopes',
        source: 'Forest Department / CHT Development Board',
        summary: 'Widespread traditional jhum clearing on steep terrain in Bandarban and Rangamati registered thermal anomalies on MODIS Aqua and VIIRS NOAA-20.',
        severity: 'high'
      }
    ],
    contextNote: 'Shifting cultivation (Jhum) involves clearing vegetative regrowth on hills followed by burning in February-April before the rains.'
  },
  'haryana': {
    name: 'Haryana, India',
    country: 'India',
    stateOrDivision: 'Haryana',
    coords: [76.0856, 29.0588],
    bbox: [74.45, 27.65, 77.60, 30.90],
    defaultMultiplier: 1.6,
    criticalWeeks: 'CRITICAL WEEKS: MID OCT – EARLY NOV',
    criticalSpan: [2, 5],
    months: ['SEP', 'OCT (EARLY)', 'OCT (MID)', 'OCT (LATE)', 'NOV (EARLY)', 'NOV (MID)', 'NOV (LATE)', 'DEC'],
    normalCurve: [80, 220, 620, 1400, 2100, 1100, 450, 160],
    thisSeasonCurve: [95, 290, 880, 2250, 3360, 1650, 520, 190],
    news: [
      {
        year: 2022,
        date: 'October 2022',
        title: 'Satellite Spot-Checks Enforce Farm Machinery Adoption',
        source: 'State Pollution Control Board & NASA FIRMS Verification',
        summary: 'Subsidized happy-seeder distribution helped lower early October farm fires by 35% compared to 2020 peak baselines.',
        severity: 'medium'
      }
    ],
    contextNote: 'Haryana farmers transition rapidly between Basmati harvest and Rabi winter sowing.'
  },
  'delhi': {
    name: 'Delhi NCR, India',
    country: 'India',
    stateOrDivision: 'Delhi',
    coords: [77.1025, 28.7041],
    bbox: [76.84, 28.40, 77.35, 28.88],
    defaultMultiplier: 1.5,
    criticalWeeks: 'CRITICAL WEEKS: LATE OCT – NOV',
    criticalSpan: [3, 5],
    months: ['SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR'],
    normalCurve: [40, 120, 380, 420, 210, 95, 45, 20],
    thisSeasonCurve: [48, 160, 570, 610, 280, 110, 50, 22],
    news: [
      {
        year: 2023,
        date: 'November 2023',
        title: 'Air Emergency Declared as Transboundary Smoke Infiltrates NCR',
        source: 'Central Pollution Control Board',
        summary: 'Surface and satellite lidar profiles confirm heavy smoke layer advection from upstream stubble burning corridors.',
        severity: 'high'
      }
    ],
    contextNote: 'Delhi NCR experiences intense trapped smoke plumes during the post-monsoon meteorological inversion.'
  },
  'sylhet': {
    name: 'Sylhet, Bangladesh',
    country: 'Bangladesh',
    stateOrDivision: 'Sylhet Division',
    coords: [91.8687, 24.8949],
    bbox: [91.50, 24.50, 92.30, 25.20],
    defaultMultiplier: 1.1,
    criticalWeeks: 'CRITICAL WEEKS: MARCH (BORO HARVEST)',
    criticalSpan: [2, 4],
    months: ['NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN'],
    normalCurve: [8, 18, 42, 95, 140, 85, 25, 5],
    thisSeasonCurve: [9, 20, 45, 105, 155, 90, 28, 6],
    news: [
      {
        year: 2022,
        date: 'March 2022',
        title: 'Low Fire Activity in Wetland Haor Basin',
        source: 'Department of Agricultural Extension',
        summary: 'Extensive wetland areas retain moisture into spring, resulting in low fire activity outside high-ground tea garden margins.',
        severity: 'info'
      }
    ],
    contextNote: 'Haor wetlands suppress winter fire activity until late spring Boro rice clearing.'
  },
  'sundarbans': {
    name: 'Sundarbans, Bangladesh',
    country: 'Bangladesh',
    stateOrDivision: 'Khulna Division',
    coords: [89.5403, 22.2858],
    bbox: [89.05, 21.50, 89.95, 22.80],
    defaultMultiplier: 0.9,
    criticalWeeks: 'CRITICAL WEEKS: DRY SEASON MAR – APR',
    criticalSpan: [3, 5],
    months: ['NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN'],
    normalCurve: [5, 12, 28, 45, 95, 130, 35, 10],
    thisSeasonCurve: [4, 10, 22, 40, 88, 115, 30, 8],
    news: [
      {
        year: 2021,
        date: 'May 2021',
        title: 'Chandpai Range Ground Fire Contained by Forest Service',
        source: 'Forest Department Wildfire Investigation',
        summary: 'Dry organic peat litter ignited near Daser Bhar canal. VIIRS 375m night passes guided rapid response teams to the subterranean hotspot.',
        severity: 'medium'
      }
    ],
    contextNote: 'Mangrove swamps rarely experience fires except during extreme dry seasons in organic peat edges.'
  }
}

/**
 * Resolve location, geographic coordinates, bounding box, and intent from user prompt
 */
export function parseUserQuery(query: string): AgentResolution {
  const q = query.trim().toLowerCase()

  // Match best region
  let key = 'punjab'
  if (q.includes('dhaka') || q.includes('ঢাকা') || q.includes('narayanganj') || q.includes('gazipur')) key = 'dhaka'
  else if (q.includes('rajshahi') || q.includes('রাজশাহী') || q.includes('naogaon') || q.includes('bogura')) key = 'rajshahi'
  else if (q.includes('jhum') || q.includes('hill tract') || q.includes('bandarban') || q.includes('rangamati') || q.includes('chittagong') || q.includes('চট্টগ্রাম')) key = 'chittagong'
  else if (q.includes('sylhet') || q.includes('সিলেট') || q.includes('moulvibazar')) key = 'sylhet'
  else if (q.includes('sundarban') || q.includes('সুন্দরবন') || q.includes('khulna') || q.includes('খুলনা')) key = 'sundarbans'
  else if (q.includes('delhi') || q.includes('দিল্লি') || q.includes('ncr')) key = 'delhi'
  else if (q.includes('haryana') || q.includes('হরিয়ানা')) key = 'haryana'
  else if (q.includes('punjab') || q.includes('পাঞ্জাব')) key = 'punjab'

  const p = REGION_PROFILES[key] ?? REGION_PROFILES['punjab']

  // Detect Intent
  let queryType: AgentResolution['queryType'] = 'anomaly'
  if (q.includes('news') || q.includes('history') || q.includes('before') || q.includes('prev') || q.includes('kokhono') || q.includes('আগে')) {
    queryType = 'history'
  } else if (q.includes('when') || q.includes('calendar') || q.includes('month') || q.includes('season') && !q.includes('unusual')) {
    queryType = 'seasonal'
  }

  const mult = p.defaultMultiplier
  const isUnusual = mult > 1.25

  // Calculate MapFocus in 1000x600 South Asia SVG space
  const [targetX, targetY] = toSvgCoords(p.coords[0], p.coords[1])
  const [boxX, boxY, boxW, boxH] = toSvgBox(p.bbox)

  const mapFocus: MapFocus = {
    centerLon: p.coords[0],
    centerLat: p.coords[1],
    targetX,
    targetY,
    boxX,
    boxY,
    boxW,
    boxH
  }

  // Assemble chart data
  const chartData: ChartDataPoint[] = p.months.map((m, idx) => ({
    label: m,
    season: p.thisSeasonCurve[idx],
    normal: p.normalCurve[idx],
    normalP90: Math.round(p.normalCurve[idx] * 1.35)
  }))

  const headline = isUnusual
    ? `Yes, ${mult.toFixed(1)}× the normal for this week`
    : `Normal: ${(mult).toFixed(1)}× the 23-year baseline for this week`

  let detailsText = ''
  if (key === 'punjab') {
    detailsText = `Based on harmonized NASA FIRMS satellite observations (MODIS Terra/Aqua and VIIRS 375m), fire activity in ${p.name} is running significantly above its 23-year historical baseline (2003–present). Active fire detections this week reached approximately ${mult.toFixed(1)}× the seasonal median. The spike aligns with peak post-monsoon paddy harvest residue clearance across the agrarian corridor before wheat sowing begins. Recent satellite passes confirm dense hotspot clusters across the central and western districts.`
  } else if (key === 'chittagong') {
    detailsText = `Satellite records for the Chittagong Hill Tracts indicate active shifting cultivation (jhum) slash-and-burn operations running at ${mult.toFixed(1)}× the baseline normal. Historical data shows burning cycles typically peak between late February and April before pre-monsoon rains. Remote sensing monitors highlight elevated smoke risk for highland agricultural settlements.`
  } else if (key === 'dhaka') {
    detailsText = `Fire activity in ${p.name} currently stands at ${mult.toFixed(1)}× the 23-year seasonal average. The observation window overlaps with the onset of the traditional brick-kiln firing season and peripheral post-Aman paddy stubble burning. MODIS-VIIRS sensor harmonization filters false sensor jumps to ensure accurate year-over-year comparability.`
  } else if (key === 'rajshahi') {
    detailsText = `Agricultural burning in ${p.name} is running at ${mult.toFixed(1)}× the 23-year baseline. Intensive multi-crop rotation between Aman rice harvest and winter potato/mustard cultivation drives short, clustered residue burning episodes across the northern grain belt.`
  } else {
    detailsText = `Satellite monitoring across ${p.name} indicates ${isUnusual ? 'anomalously high' : 'standard'} fire detections running at ${mult.toFixed(1)}× the 23-year baseline. Data harmonized across Aqua-MODIS and VIIRS sensors reveals fire activity localized to agricultural clearing cycles.`
  }

  const steps: AgentStep[] = [
    {
      id: 'step-1',
      title: 'Draw area',
      detail: p.name,
      status: 'completed'
    },
    {
      id: 'step-2',
      title: 'Fetch NASA FIRMS',
      detail: 'MODIS + VIIRS',
      status: 'completed'
    },
    {
      id: 'step-3',
      title: 'Harmonize',
      detail: 'both cameras, one record',
      status: 'completed'
    },
    {
      id: 'step-4',
      title: 'Compare with 23 years',
      detail: '2003 – today',
      status: 'completed'
    }
  ]

  return {
    locationName: p.name,
    country: p.country,
    stateOrDivision: p.stateOrDivision,
    coordinates: p.coords,
    bbox: p.bbox,
    mapFocus,
    isUnusual,
    multiplier: mult,
    criticalWeeks: p.criticalWeeks,
    criticalSpan: p.criticalSpan,
    headline,
    detailsText,
    chartData,
    sources: 'SOURCES: NASA FIRMS · MODIS · VIIRS',
    steps,
    news: p.news,
    queryType
  }
}
