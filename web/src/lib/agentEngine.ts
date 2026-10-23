/**
 * Kiln Watch Ask stage engine: finds the place a question is about, then fills the stage from the public export.
 * Every figure comes from the files passed in (calendar, live season, kiln seasons, events); nothing is typed in.
 * Places outside Bangladesh have names and map extents only until the South Asia calendar (Amendment 5).
 */
import { REGION_REGISTRY, findRegionInQuery, type HistoricalNews, type RegionProfile } from './regionRegistry'
import { completeSeasons, lastDay, seasonMean, seasonToDateRatio, seasonVerdict } from './calendar'
import { dataUrl } from './data'
import { dayIso, dateToDay } from './days'
import { cellCenter } from './box'
import { inGeometry } from './geo'
import { districtFacts } from './geminiPrompt'
import { busyMonths, monthlyMeans, SEASON_MONTHS } from './plain'
import { NEWS_RECORDS } from './newsRecords'
import type { Calendar, Events, GridTile, Harmonization, KilnActivity, Meta, NrtSeason } from './types'

export { REGION_REGISTRY, findRegionInQuery, type HistoricalNews, type RegionProfile }
export const REGION_PROFILES = REGION_REGISTRY

export type AgentStep = {
  id: string
  title: string
  detail: string
  status: 'pending' | 'running' | 'completed'
}

export type ChartDataPoint = {
  label: string
  season: number | null     // this season, monthly mean; null for months not reached yet
  normal: number | null     // typical year (seasons before the live one), monthly mean
  normalP90?: number | null // typical high: monthly mean of the daily 90th-percentile normal
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
  zoom: number
  bbox: [number, number, number, number]
}

export type AgentResolution = {
  locationName: string
  country: string
  stateOrDivision?: string
  unitId: string | null                          // Bangladesh district id, when the place is one
  coordinates: [number, number] | null           // [lon, lat]
  bbox: [number, number, number, number] | null  // [w, s, e, n]
  mapFocus: MapFocus | null
  isUnusual: boolean                             // pre-registered rule: any day above the 90th-percentile normal
  multiplier: number | null                      // this season so far vs the same days before it (descriptive)
  criticalWeeks: string
  criticalSpan: [number, number] | null          // month indices in chartData
  headline: string
  detailsText: string
  chartData: ChartDataPoint[]
  sources: string
  steps: AgentStep[]
  news: HistoricalNews[]
  queryType: 'anomaly' | 'seasonal' | 'history' | 'general'
  /** True when the figures were filled from Kiln Watch data. */
  measured: boolean
  /** measured; loading (a Bangladesh place whose files are on their way); error (a file failed); outside (not measured
   * before Amendment 5); none (no place found). */
  status: 'measured' | 'loading' | 'error' | 'outside' | 'none'
}

/** The files the stage reads; the page fetches them and passes them in, so this module stays pure. */
export type StageData = {
  unitId: string | null
  unitName: string | null
  division: string | null
  alsoNames: string[]
  cal: Calendar | null
  nrt: NrtSeason | null
  ka: KilnActivity | null
  events: Events | null
  meta: Meta | null
  harm: Harmonization | null
  failed: string[]   // data files that could not be loaded
}
export const EMPTY_STAGE_DATA: StageData = { unitId: null, unitName: null, division: null, alsoNames: [], cal: null, nrt: null, ka: null, events: null, meta: null, harm: null, failed: [] }

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

const STOP_WORDS = ['is', 'this', 'fire', 'season', 'unusual', 'when', 'show', 'tell', 'me', 'about', 'how', 'check', 'what', 'the', 'in', 'at', 'right', 'now']

/** Step 1, no data needed: the place a question is about, and what it asks. */
export function resolveQuery(query: string): { profile: RegionProfile | null; queryType: AgentResolution['queryType']; placeText: string } {
  const q = query.trim().toLowerCase()
  let queryType: AgentResolution['queryType'] = 'anomaly'
  if (q.includes('news') || q.includes('history') || q.includes('before') || q.includes('prev') || q.includes('kokhono') || q.includes('আগে')) {
    queryType = 'history'
  } else if (q.includes('when') || q.includes('calendar') || q.includes('month') || q.includes('season') && !q.includes('unusual')) {
    queryType = 'seasonal'
  }
  const placeText = query.replace(/[?.,!]/g, '').split(' ').filter((w) => !STOP_WORDS.includes(w.toLowerCase()))
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim()
  return { profile: findRegionInQuery(q), queryType, placeText }
}

function focusOf(p: RegionProfile): MapFocus {
  const [targetX, targetY] = toSvgCoords(p.coords[0], p.coords[1])
  const [boxX, boxY, boxW, boxH] = toSvgBox(p.bbox)
  const zoom = Math.min(Math.max(1000 / (boxW * 2.2), 2.0), 5.5)
  return { centerLon: p.coords[0], centerLat: p.coords[1], targetX, targetY, boxX, boxY, boxW, boxH, zoom, bbox: p.bbox }
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** Dated records with their sources: the place's own complete seasons, linked news reports, then policy and satellite events. */
function records(profile: RegionProfile | null, d: StageData): HistoricalNews[] {
  const own: HistoricalNews[] = []
  if (d.cal && d.nrt && d.unitId) {
    for (const s of completeSeasons(d.cal, d.nrt.season).slice(-5).reverse()) {
      const v = seasonVerdict(d.cal, s)
      own.push({ year: Number(s.slice(0, 4)) + 1, date: `Season ${s}`, title: `${s}: ${plural(v.unusual, 'unusual day')}`, summary: v.text,
        source: `Kiln Watch, calendar/${d.unitId}.json`, url: dataUrl(`calendar/${d.unitId}.json`), severity: v.unusual > 0 ? 'high' : 'info' })
    }
  }
  const news: HistoricalNews[] = NEWS_RECORDS.filter((r) => profile && r.place_key === profile.key).map((r) => ({
    year: Number(r.date.slice(0, 4)), date: r.date, title: r.title, source: r.publisher, summary: r.summary, url: r.url, severity: 'info' }))
  const events: HistoricalNews[] = [...(d.events?.policy ?? []).map((e) => ({ ...e, place: 'Bangladesh' })), ...(d.events?.satellite ?? []).map((e) => ({ ...e, place: 'Satellites' }))]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => ({ year: Number(e.date.slice(0, 4)), date: e.date, title: e.label_en, source: e.place, summary: `${e.place}: ${e.label_en}.`, url: e.url, severity: 'info' }))
  return [...own, ...news, ...events]
}

/** Step 2: fill the resolution from the files passed in. */
export function buildResolution(r: ReturnType<typeof resolveQuery>, data: StageData): AgentResolution {
  const p = r.profile
  const name = p?.name ?? (r.placeText || 'No place found')
  const base = {
    locationName: name, country: p?.country ?? '', stateOrDivision: p?.stateOrDivision,
    unitId: p?.unit.kind === 'bd' ? p.unit.unit_id : null,
    coordinates: p ? p.coords : null, bbox: p ? p.bbox : null, mapFocus: p ? focusOf(p) : null,
    queryType: r.queryType, news: records(p, data),
  }
  const step = (id: number, title: string, detail: string, done: boolean): AgentStep => ({ id: `step-${id}`, title, detail, status: done ? 'completed' : 'pending' })
  const TITLES = ['Draw area', 'Fetch NASA FIRMS', 'Harmonize', 'Compare with 23 years'] as const

  const { cal, nrt } = data
  const live = base.unitId && nrt ? nrt.districts[base.unitId]?.h : undefined
  if (!p || p.unit.kind !== 'bd' || !cal || !nrt || !live) {
    const outside = p?.unit.kind === 'ne'
    const status: AgentResolution['status'] = !p ? 'none' : outside ? 'outside' : data.failed.length ? 'error' : 'loading'
    const why = { none: 'no place found in the question', outside: 'not measured yet (Amendment 5)', error: `could not load ${data.failed.join(', ')}`, loading: 'loading the data files…', measured: '' }[status]
    return {
      ...base, isUnusual: false, multiplier: null, criticalSpan: null, chartData: [], measured: false, status,
      criticalWeeks: { none: 'NO PLACE FOUND', outside: 'NOT MEASURED YET', error: 'DATA NOT LOADED', loading: 'LOADING', measured: '' }[status],
      headline: status === 'none' ? 'No place found in the question. Try a Bangladesh district.'
        : status === 'outside' ? `No measured data for ${name} yet: it arrives with the South Asia calendar (Amendment 5).`
          : status === 'error' ? `Could not load ${data.failed.join(', ')} for ${name}. Try again, or open its page under My area.`
            : `Loading Kiln Watch data for ${name}…`,
      detailsText: !p ? 'Kiln Watch could not find a known place in the question. It measures every district of Bangladesh; try one by name, such as Dhaka or Rajshahi.'
        : outside ? `${name} is on the map from Natural Earth boundaries. Kiln Watch has no fire measurements outside Bangladesh until the South Asia calendar (Amendment 5) is agreed and its tests pass.`
          : `Loading the calendar, the live season and the kiln seasons for ${name}.`,
      sources: outside ? 'SOURCES: Natural Earth boundaries · measured data after Amendment 5' : 'SOURCES: Kiln Watch public export',
      steps: [step(1, TITLES[0], p ? `${name}${outside ? ' (Natural Earth)' : ''}` : 'no place found', Boolean(p)),
        ...TITLES.slice(1).map((t, i) => step(i + 2, t, why, false))],
    }
  }

  const id = p.unit.unit_id
  const unitName = data.unitName ?? name
  const before = completeSeasons(cal, nrt.season)
  const typical = seasonMean(cal, cal.h, nrt.season)
  const ratio = seasonToDateRatio(cal, live, nrt.season)
  const multiplier = ratio === null ? null : Math.round(ratio * 10) / 10
  const unusual = nrt.districts[id].above_p90_days
  const dataTo = dayIso(dateToDay(nrt.day0) + live.length - 1)
  const span = before.length ? `${before[0]}–${before.at(-1)}` : 'record'
  const ratioText = multiplier === null ? '' : `; ${multiplier.toFixed(1)}× the ${span} average for the same days`
  // A place shown through one of its districts (the Sundarbans through Bagerhat) says so where the figures are.
  const via = data.alsoNames.length || p.name.split(',')[0] !== unitName ? `Figures for ${unitName} district: ` : ''
  const headline = via + (unusual > 0 ? `Yes: ${plural(unusual, 'unusual day')} so far in ${nrt.season}${ratioText}`
    : `No unusual days so far in ${nrt.season}${ratioText}`)
  const bm = busyMonths(seasonMean(cal)) // the same rule as the Area page and districtFacts
  const normal = monthlyMeans(typical), p90 = monthlyMeans(cal.normal.p90), season = monthlyMeans(live)
  const chartData = SEASON_MONTHS.map((m, i) => ({ label: m.slice(0, 3).toUpperCase(), season: season[i], normal: normal[i], normalP90: p90[i] }))
  const facts = districtFacts(unitName, id, cal, nrt, data.ka)
  const also = data.alsoNames.length ? ` Figures for ${unitName}, one of the districts this place spans (also ${data.alsoNames.join(', ')}).` : ''
  const detailsText = `${unitName}: fires usually run ${facts.fireSeasonMonths}. ${plural(unusual, 'unusual day')} so far in ${nrt.season} (provisional, data to ${dataTo}). `
    + (facts.kilnSeason ? `Brick kilns typically work ${facts.kilnSeason}.` : 'No reliable night-light kiln season found for this district.') + also
  const harm = data.harm
  return {
    ...base, measured: true, status: 'measured', isUnusual: unusual > 0, multiplier, headline, detailsText, chartData,
    criticalWeeks: bm ? `BUSIEST MONTHS: ${SEASON_MONTHS[bm.first].toUpperCase()} – ${SEASON_MONTHS[bm.last].toUpperCase()}` : 'NO BUSY MONTHS',
    criticalSpan: bm ? [bm.first, bm.last] : null,
    sources: `SOURCES: calendar/${id}.json · nrt/current_season.json (updated ${nrt.updated_at.slice(0, 10)}) · kiln_activity.json${data.meta ? ` · Kiln Watch build ${data.meta.git_sha}` : ''}`,
    steps: [
      step(1, TITLES[0], `${unitName}${data.division ? `, ${data.division} Division` : ''}; ${p.bbox.map((v) => v.toFixed(2)).join(', ')} (W, S, E, N)`, true),
      step(2, TITLES[1], `MODIS + VIIRS to ${dayIso(lastDay(cal))}; this season to ${dataTo}`, true),
      step(3, TITLES[2], harm ? `model ${harm.selected_model}; 2012 camera jump reduced by ${Math.round((1 - harm.seam.ratio) * 100)}%` : 'harmonization.json not loaded', Boolean(harm)),
      step(4, TITLES[3], `day-of-season normal from the record since 2003 (${plural(before.length, 'complete season')})`, true),
    ],
  }
}

/** Map dots: one per distinct grid cell with a fire detection on or after `fromDay`, inside the area's geometry.
 * Grid tiles hold Aqua MODIS and Suomi NPP detections (pipeline.py _write_grid_tiles); every fire, not only kilns.
 * At most `max` dots (invariant 9); `total` counts them all and `lastDay` is the newest detection day in the tiles. */
export function stageCells(tiles: GridTile[], meta: Pick<Meta, 'grid'>, geometry: GeoJSON.Geometry, fromDay: number, max: number) {
  const seen = new Set<number>(), cells: { lat: number; lon: number }[] = []
  let lastDay = -1, total = 0
  for (const t of tiles) for (const [cell, day] of t.rows) {
    lastDay = Math.max(lastDay, day)
    if (day < fromDay || seen.has(cell)) continue
    seen.add(cell)
    const c = cellCenter(meta, cell)
    if (!inGeometry(geometry, c.lat, c.lon)) continue
    total++
    if (cells.length < max) cells.push(c)
  }
  return { cells, total, lastDay }
}

/** Resolve a question and fill it from whatever data is passed (none: names and map extent only). */
export function parseUserQuery(query: string, data: Partial<StageData> = {}): AgentResolution {
  return buildResolution(resolveQuery(query), { ...EMPTY_STAGE_DATA, ...data })
}
