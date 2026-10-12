// TypeScript port of the tools in kilnwatch/ask.py. Same inputs, same outputs (pinned by test/parity.test.ts
// against the goldens make_goldens.py writes from the Python tools). Tools read only the public export.
import spec from './spec.json'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Obj = Record<string, any>
export type Result = Obj

export const SITE: string = spec.site
export const FIRE: string = spec.fire
const MONTHS = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_MS = 86_400_000
const DAY0 = Date.UTC(2003, 0, 1) // research.DAY0: calendars count days from 1 Jan 2003

/** Read-only access to one public export (the website's data/ folder), cached per request. */
export class Data {
  private cache = new Map<string, Promise<Obj | null>>()
  constructor(private origin: string, private fetchFn: typeof fetch = fetch) {}

  json(rel: string): Promise<Obj | null> {
    if (!this.cache.has(rel)) {
      this.cache.set(rel, this.fetchFn(`${this.origin}/${rel}`, { signal: AbortSignal.timeout(10_000) }).then(async (r) => {
        if (r.status === 404) return null
        if (!r.ok) throw new Error(`HTTP ${r.status} for ${rel}`)
        return (await r.json()) as Obj
      }))
    }
    return this.cache.get(rel)!
  }

  async prov(rel: string, dataset: string): Promise<Obj> {
    const meta = (await this.json('meta.json')) ?? {}
    return { dataset_id: dataset, source_url: `${SITE}/data/${rel}`, data_build: meta.git_sha ?? null }
  }
}

/** Python's round(): nearest value at `n` decimals of the exact binary number, exact ties to even. */
export function pyRound(x: number, n = 0): number {
  if (!Number.isFinite(x)) return x
  const [ip, fp] = Math.abs(x).toFixed(100).split('.') // exact for the magnitudes in the export
  const tail = fp.slice(n)
  if (!(tail[0] === '5' && /^0*$/.test(tail.slice(1)))) return Number(x.toFixed(n))
  const down = Number(`${x < 0 ? '-' : ''}${ip}${n ? `.${fp.slice(0, n)}` : ''}`)
  const last = Number((n ? fp.slice(0, n) : ip).slice(-1))
  return last % 2 === 0 ? down : Number((down + Math.sign(x) * 10 ** -n).toFixed(n))
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const parseDay = (s: string) => Date.parse(`${s}T00:00:00Z`)
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0) // code-point order, as Python sorts str

/** Python repr of a tool argument, for the validation message (strings in single quotes, None, numbers). */
function pyRepr(v: unknown): string {
  if (v === null || v === undefined) return 'None'
  if (typeof v === 'string') return v.includes("'") && !v.includes('"') ? `"${v}"` : `'${v.replace(/'/g, "\\'")}'`
  if (typeof v === 'boolean') return v ? 'True' : 'False'
  return String(v)
}

export async function findArea(d: Data, name: string): Promise<Result> {
  const units: Obj[] = []
  for (const lvl of ['district', 'upazila']) units.push(...((await d.json(`aoi/${lvl}s.geojson`))?.features ?? []).map((f: Obj) => f.properties))
  const q = name.trim().toLowerCase()
  const hits = units.filter((u) => q && (u.name_en.toLowerCase().includes(q) || (u.name_bn ?? '').includes(q)))
  hits.sort((a, b) => Number(a.name_en.toLowerCase() !== q) - Number(b.name_en.toLowerCase() !== q)
    || Number(a.level !== 'district') - Number(b.level !== 'district') || cmp(a.name_en, b.name_en))
  return {
    matches: hits.slice(0, 5).map((u) => Object.fromEntries(['unit_id', 'name_en', 'name_bn', 'level', 'division'].map((k) => [k, u[k] ?? null]))),
    provenance: await d.prov('aoi/districts.geojson', 'OCHA HDX COD-AB Bangladesh boundaries'),
  }
}

/** research.calendar_len: days covered by a sparse calendar, through its last active day or not-observed run. */
const calendarLen = (cal: Obj) => Math.max(cal.days.length ? cal.days[cal.days.length - 1] : 0, ...cal.nodata.map((r: number[]) => r[1]), 0) + 1

/** ask._season_profile: mean harmonized activity per day of season (0 = 1 July) over observed days. */
function seasonProfile(cal: Obj): number[] {
  const n = calendarLen(cal)
  const observed = new Array(n).fill(true)
  for (const [a, b] of cal.nodata) for (let i = a; i <= b; i++) observed[i] = false
  const h = new Array(n).fill(0)
  cal.days.forEach((day: number, k: number) => { h[day] = cal.h[k] })
  const sum = new Array(366).fill(0), cnt = new Array(366).fill(0)
  for (let i = 0; i < n; i++) {
    if (!observed[i]) continue
    const t = DAY0 + i * DAY_MS, dt = new Date(t)
    const y = dt.getUTCFullYear() - (dt.getUTCMonth() < 6 ? 1 : 0)
    const sd = Math.min(365, Math.round((t - Date.UTC(y, 6, 1)) / DAY_MS))
    sum[sd] += h[i]
    cnt[sd] += 1
  }
  return sum.map((s, i) => (cnt[i] ? s / cnt[i] : 0))
}

/** ask._busy_months (web plain.ts busyMonths): the peak month, widened while neighbours reach 25% of it. */
function busyMonths(perDay: number[], share = 0.25): Obj | null {
  const starts = [0, 31, 62, 92, 123, 153, 184, 215, 243, 274, 304, 335, 366]
  const m = starts.slice(0, -1).map((a, i) => mean(perDay.slice(a, starts[i + 1])))
  const top = Math.max(...m)
  if (!(top > 0)) return null
  const peak = m.indexOf(top)
  let first = peak, last = peak
  while (first > 0 && m[first - 1] >= share * top) first--
  while (last < 11 && m[last + 1] >= share * top) last++
  return { usual_first_month: MONTHS[first], busiest_month: MONTHS[peak], usual_last_month: MONTHS[last] }
}

/** ask._when_text (web plain.ts whenText): day 0 = 1 July, non-leap season year. */
export function whenText(dayOfSeason: number): string {
  const d = new Date(Date.UTC(2001, 6, 1) + Math.floor(dayOfSeason + 0.5) * DAY_MS)
  const day = d.getUTCDate(), m = MONTH_NAMES[d.getUTCMonth()]
  return day <= 10 ? `early ${m}` : day <= 20 ? `mid-${m}` : `late ${m}`
}

export async function areaFireCalendar(d: Data, unitId: string): Promise<Result> {
  const rel = `calendar/${unitId}.json`
  const cal = await d.json(rel)
  if (cal === null) return { error: `no calendar for ${unitId}` }
  const seasons = cal.seasons.filter((s: Obj) => s.duration)
  const last = seasons.length ? seasons[seasons.length - 1] : null
  return {
    unit_id: unitId, record_starts: cal.day0, years_of_record: pyRound(calendarLen(cal) / 365.25),
    typical_year: busyMonths(seasonProfile(cal)), seasons_measured: seasons.length,
    latest_full_season: last && { season: last.season, duration_days: last.duration.p50, duration_days_95ci: [last.duration.lo, last.duration.hi] },
    provenance: await d.prov(rel, FIRE),
  }
}

export async function thisSeason(d: Data, unitId: string): Promise<Result> {
  const nrt = await d.json('nrt/current_season.json')
  const dist = unitId.slice(0, 6) // live data are by district
  if (!nrt || !(dist in nrt.districts)) return { error: 'no live data for this district' }
  const h = nrt.districts[dist].h
  return {
    district: dist, season: nrt.season, data_to: isoDay(parseDay(nrt.day0) + (h.length - 1) * DAY_MS),
    unusual_days_so_far: nrt.districts[dist].above_p90_days, provisional: true,
    provenance: await d.prov('nrt/current_season.json', 'NASA FIRMS near-real-time VIIRS (NOAA-20, Suomi NPP), harmonized'),
  }
}

export async function twoWeekOutlook(d: Data, unitId: string): Promise<Result> {
  const [o, nrt] = [await d.json('outlook.json'), await d.json('nrt/current_season.json')]
  const dist = unitId.slice(0, 6)
  const cal = await d.json(`calendar/${dist}.json`)
  if (!o || !o.ships || !nrt || !cal || !(dist in o.districts) || !(dist in nrt.districts)) return { error: 'no tested outlook for this district' }
  const h: number[] = nrt.districts[dist].h
  const last = h.length - 1
  const asOf = parseDay(nrt.day0) + last * DAY_MS
  const [mm, dd] = o.start.split('-').map(Number)
  const opens = Date.UTC(Number(nrt.season.slice(0, 4)), mm - 1, dd)
  const k = Math.floor(Math.round((asOf + DAY_MS - opens) / DAY_MS) / o.step_days) // row k forecasts from day (opens + 7k)
  const base = {
    district: dist, data_to: isoDay(asOf), provenance: await d.prov('outlook.json', `Kiln Watch outlook, backtested on ${FIRE}`),
    backtest_brier_skill: o.backtest.brier_skill,
  }
  if (k < 0 || k >= o.weeks) return { ...base, state: 'outside the outlook window (1 November to mid-May)', window_opens: isoDay(opens) }
  const p90: number[] = cal.normal.p90
  let recent = false
  for (let i = Math.max(0, last - o.window_days + 1); i <= last; i++) if (h[i] > 0 && h[i] > p90[i % p90.length]) recent = true
  const t = o.districts[dist]
  if (t.if_recent[k] == null || t.if_quiet[k] == null || t.clim[k] == null) return { ...base, state: 'no estimate for this week' }
  return {
    ...base, state: 'on', window_days: o.window_days, unusual_day_in_last_14_days: recent,
    chance_of_unusual_day_next_14_days_pct: pyRound(100 * (recent ? t.if_recent : t.if_quiet)[k]),
    usual_chance_for_time_of_year_pct: pyRound(100 * t.clim[k]),
  }
}

export async function harmonizationEvidence(d: Data): Promise<Result> {
  const h = await d.json('harmonization.json')
  if (!h) throw new TypeError("'NoneType' object is not subscriptable")
  const out: Obj = {
    sensor_change_season: '2012-13', share_of_2012_jump_removed_pct: pyRound(100 * (1 - h.seam.ratio)),
    chow_p_raw: h.seam.chow_p_raw, chow_p_harmonized: h.seam.chow_p_harm,
    loso_95pct_interval_coverage: pyRound(h.loso_pooled.covered.p50, 3), loso_target: '0.90 to 0.97 (failed on the conservative side)',
    provenance: await d.prov('harmonization.json', FIRE),
  }
  for (const r of h.overlap ?? []) {
    out[`viirs_to_aqua_ratio_${r.period}`] = { raw: pyRound(r.ratio_raw.p50, 2), harmonized: pyRound(r.ratio_harm.p50, 2), seasons: r.seasons }
  }
  return out
}

/** ask._typical_season (web plain.ts typicalSeason): medians over the last n seasons with a measured start and end. */
function typicalSeason(rows: Obj[], n = 3): Obj | null {
  const ok = rows.filter((r) => r.onset && r.end).slice(-n)
  if (!ok.length) return null
  const peaks = ok.filter((r) => r.peak).map((r) => r.peak.p50)
  return {
    onset: median(ok.map((r) => r.onset.p50)), end: median(ok.map((r) => r.end.p50)), peak: peaks.length ? median(peaks) : null,
    duration: median(ok.map((r) => (r.duration ? r.duration.p50 : r.end.p50 - r.onset.p50))), seasons: ok.map((r) => r.season),
  }
}

export async function kilnSeasons(d: Data, unitId?: string): Promise<Result> {
  const ka = await d.json('kiln_activity.json')
  if (ka === null) return { error: 'no kiln analysis in this data build' }
  const block = unitId === undefined ? ka.national : ka.areas?.[unitId]
  if (block == null) return { error: `no kiln season for ${unitId}` }
  const t = typicalSeason(block.seasons ?? [])
  if (t === null) return { error: 'no measured kiln season' }
  return {
    area: unitId ?? 'Bangladesh (national)', kiln_clusters: block.n_clusters,
    typical_season: {
      starts: whenText(t.onset), busiest: t.peak !== null ? whenText(t.peak) : null, ends: whenText(t.end),
      length_days: Math.floor(t.duration + 0.5), seasons_used: t.seasons,
    },
    provenance: await d.prov('kiln_activity.json', 'Kiln Watch kiln activity from NASA Black Marble night lights, area-level'),
  }
}

export async function nationalTrend(d: Data): Promise<Result> {
  const y: Obj[] = (await d.json('harmonization.json'))?.yearly ?? []
  if (!y.length) return { error: 'no national series in this data build' }
  const p = y.reduce((best, r) => (r.h.p50 > best.h.p50 ? r : best)) // first wins ties, like Python max()
  const lastY = y[y.length - 1]
  return {
    n_seasons: y.length, first_season: { season: y[0].season, harmonized: y[0].h.p50 },
    latest_season: { season: lastY.season, harmonized: lastY.h.p50, range_95: [lastY.h.lo, lastY.h.hi] },
    peak_season: { season: p.season, harmonized: p.h.p50 },
    units: 'Aqua-MODIS-equivalent fire detections per season (harmonized)', provenance: await d.prov('harmonization.json', FIRE),
  }
}

type Tool = { run: (d: Data, a: Obj) => Promise<Result>; params: string[]; required: string[] }
export const FUNCS: Record<string, Tool> = {
  find_area: { run: (d, a) => findArea(d, a.name), params: ['name'], required: ['name'] },
  area_fire_calendar: { run: (d, a) => areaFireCalendar(d, a.unit_id), params: ['unit_id'], required: ['unit_id'] },
  this_season: { run: (d, a) => thisSeason(d, a.unit_id), params: ['unit_id'], required: ['unit_id'] },
  two_week_outlook: { run: (d, a) => twoWeekOutlook(d, a.unit_id), params: ['unit_id'], required: ['unit_id'] },
  harmonization_evidence: { run: (d) => harmonizationEvidence(d), params: [], required: [] },
  kiln_seasons: { run: (d, a) => kilnSeasons(d, a.unit_id), params: ['unit_id'], required: [] },
  national_trend: { run: (d) => nationalTrend(d), params: [], required: [] },
}

const UNIT = /^BD[0-9]{2,10}$/ // HDX COD-AB p-codes: anything else never reaches a file path

/** ask._run: run one tool on model-supplied arguments; a bad argument or a failure becomes an error the model sees. */
export async function runTool(name: string, d: Data, args: Obj): Promise<Result> {
  const tool = FUNCS[name]
  if (!tool) return { error: `unknown tool ${name}` }
  if ('unit_id' in args && !(typeof args.unit_id === 'string' && UNIT.test(args.unit_id))) {
    return { error: `unit_id must be an area code such as BD3026 (from find_area), got ${pyRepr(args.unit_id)}` }
  }
  const extra = Object.keys(args).find((k) => !tool.params.includes(k))
  if (extra) return { error: `TypeError: ${name}() got an unexpected keyword argument '${extra}'` }
  const missing = tool.required.find((k) => !(k in args))
  if (missing) return { error: `TypeError: ${name}() missing 1 required positional argument: '${missing}'` }
  try {
    return await tool.run(d, args)
  } catch (e) {
    const err = e as Error
    return { error: `${err.name}: ${err.message}` }
  }
}
