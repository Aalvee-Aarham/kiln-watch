import type { Calendar, GridTile, Meta, Sensor } from './types'
import { dayIso, dayToDate, seasonOf, seasonStart } from './days'
import { rituOf, type Ritu } from './ritu'
import { AQUA, cellCenter, cellId, sensorOf } from './box'
import { inGeometry } from './geo'
import { MONTH_STARTS } from './plain'

export type Mode = 'raw' | 'harm'

/** Sparse aligned arrays → dense day array; not-observed days become NaN. */
export function dense(cal: Calendar, values: number[], nDays?: number): Float64Array {
  const n = nDays ?? lastDay(cal) + 1
  const out = new Float64Array(n)
  cal.days.forEach((d, i) => { if (d < n) out[d] = values[i] })
  for (const [a, b] of cal.nodata) for (let d = a; d <= Math.min(b, n - 1); d++) out[d] = NaN
  return out
}

export const lastDay = (cal: Calendar) => Math.max(cal.days.at(-1) ?? 0, cal.nodata.at(-1)?.[1] ?? 0)

/** The series a view shows: harmonized h, a split component, or raw (sum of sensors in their era). */
export function seriesFor(cal: Calendar, mode: Mode, split: string): number[] {
  if (mode === 'raw') {
    const s = (Object.keys(cal.raw) as Sensor[])
    return cal.days.map((_, i) => s.reduce((m, k) => Math.max(m, cal.raw[k]?.[i] ?? 0), 0))
  }
  if (split !== 'all') return cal.split.find((x) => x.key === split)?.values ?? cal.h
  return cal.h
}

/** Mean activity per day of season (0 = 1 July, 366 slots) over all seasons; not-observed days are skipped.
 * `before` (a season label) stops the mean before that season, e.g. to leave the live season out. */
export function seasonMean(cal: Calendar, values: number[] = cal.h, before?: string): number[] {
  const dz = dense(cal, values)
  const sum = new Float64Array(366), n = new Float64Array(366)
  const end = before ? Math.min(dz.length, seasonStart(before)) : dz.length
  for (let d = 0; d < end; d++) {
    if (Number.isNaN(dz[d])) continue
    const date = dayToDate(d)
    const y = Number(seasonOf(date).slice(0, 4))
    const x = Math.min(365, Math.round((date.getTime() - Date.UTC(y, 6, 1)) / 86_400_000))
    sum[x] += dz[d]; n[x] += 1
  }
  return Array.from(sum, (s, i) => (n[i] ? s / n[i] : 0))
}

/** Share (0–1) of harmonized burning in each split window over the whole record, in split order. Empty if the total is 0. */
export function splitShares(cal: Calendar): { key: string; share_frac: number }[] {
  const tot = cal.split.map((x) => ({ key: x.key, v: x.values.reduce((a, b) => a + (b ?? 0), 0) }))
  const all = tot.reduce((a, b) => a + b.v, 0)
  return all ? tot.map((x) => ({ key: x.key, share_frac: x.v / all })) : []
}

/** Share (0–1) of the typical year's harmonized burning that falls in these calendar months (1–12); null if the year is empty. */
export function monthsShare(cal: Calendar, months: number[]): number | null {
  const m = seasonMean(cal)
  let inside = 0, all = 0
  m.forEach((v, i) => {
    all += v
    const k = MONTH_STARTS.findIndex((a, j) => i >= a && i < MONTH_STARTS[j + 1]) // season month, July = 0 (as monthlyMeans)
    if (months.includes(((k + 6) % 12) + 1)) inside += v
  })
  return all ? inside / all : null
}

/** This season so far against the same days of season averaged over the seasons before it: sum(live) / sum(typical).
 * null when the typical sum is 0. Descriptive only, not a pre-registered test. */
export function seasonToDateRatio(cal: Calendar, live: number[], season: string): number | null {
  const typical = seasonMean(cal, cal.h, season).slice(0, live.length).reduce((a, b) => a + b, 0)
  return typical ? live.reduce((a, b) => a + b, 0) / typical : null
}

/** Seasons fully inside the calendar's record and before the live season, oldest first. */
export function completeSeasons(cal: Calendar, liveSeason: string): string[] {
  const last = lastDay(cal), out: string[] = []
  for (let y = Number(seasonOf(dayToDate(0)).slice(0, 4)); y < Number(liveSeason.slice(0, 4)); y++) {
    const s = `${y}-${String((y + 1) % 100).padStart(2, '0')}`
    if (seasonStart(s) >= 0 && seasonStart(s) + 365 <= last) out.push(s)
  }
  return out
}

/** Share (0–1) of Aqua MODIS fire detections, as distinct cell-days up to `lastDay`, inside `hill` out of all inside
 * `bd`. Aqua only, so sensors are not mixed. Each cell is tested against the polygons once. */
export function hillShare(tiles: GridTile[], meta: Meta, hill: GeoJSON.Geometry[], bd: GeoJSON.Geometry[], lastDay: number): number | null {
  const where = new Map<number, 0 | 1 | 2>() // 0 outside Bangladesh, 1 Bangladesh, 2 hill
  const seen = new Set<string>()
  let nHill = 0, nAll = 0
  for (const t of tiles) for (const [cell, day, sp] of t.rows) {
    if (day > lastDay || sensorOf(sp) !== AQUA) continue
    let w = where.get(cell)
    if (w === undefined) {
      const { lat, lon } = cellCenter(meta, cell)
      w = hill.some((g) => inGeometry(g, lat, lon)) ? 2 : bd.some((g) => inGeometry(g, lat, lon)) ? 1 : 0
      where.set(cell, w)
    }
    if (!w || seen.has(`${cell}:${day}`)) continue
    seen.add(`${cell}:${day}`)
    nAll++
    if (w === 2) nHill++
  }
  return nAll ? nHill / nAll : null
}

/** Unknown split key → 'all' (links survive a rebuild under another branch). */
export const resolveSplit = (meta: Meta, split: string) =>
  split === 'all' || meta.split_labels.some((s) => s.key === split) ? split : 'all'

/** Year × day-of-year matrix for the heatmap: [dayOfYear, yearIdx, value]. */
export function heatmapCells(cal: Calendar, values: number[], layout: 'cal' | 'season') {
  const dz = dense(cal, values)
  const years = new Set<number>()
  const cells: [number, number, number][] = []
  for (let d = 0; d < dz.length; d++) {
    const date = dayToDate(d)
    const y = layout === 'season' ? Number(seasonOf(date).slice(0, 4)) : date.getUTCFullYear()
    const x = layout === 'season'
      ? Math.round((date.getTime() - Date.UTC(y, 6, 1)) / 86_400_000)
      : Math.round((date.getTime() - Date.UTC(y, 0, 1)) / 86_400_000)
    years.add(y)
    const v = dz[d]
    if (v !== 0) cells.push([x, y, Number.isNaN(v) ? -1 : v])
  }
  const ys = [...years].sort((a, b) => a - b)
  return { cells: cells.map(([x, y, v]) => [x, y - ys[0], v] as [number, number, number]), years: ys }
}

export function calendarToCsv(cal: Calendar, splitKeys: string[]): string {
  const sensors = Object.keys(cal.raw) as Sensor[]
  const head = ['date', 'harmonized_myd_eq', ...splitKeys.map((k) => `split_${k}`), ...sensors.map((s) => `raw_${s}`), ...(cal.index ? ['activity_index'] : [])]
  const rows = cal.days.map((d, i) => [dayIso(d), cal.h[i], ...cal.split.map((s) => s.values[i]), ...sensors.map((s) => cal.raw[s]?.[i] ?? ''), ...(cal.index ? [cal.index[i]] : [])].join(','))
  return [head.join(','), ...rows].join('\n')
}

/** Drawn box: sum tile cell-days inside the box ÷ containing district's clear cells ×1000, converted by β. Approximate. */
export function aggregateBox(tiles: GridTile[], meta: Meta, box: [number, number, number, number],
  clearFrac: number[] | undefined, totalCells: number, beta: number): Map<number, number> {
  const [w, s, e, n] = box
  const lo = cellId(meta, s + 1e-9, w + 1e-9), hi = cellId(meta, n - 1e-9, e - 1e-9)
  const cols = meta.grid.cols
  const r0 = Math.floor(lo / cols), c0 = lo % cols, r1 = Math.floor(hi / cols), c1 = hi % cols
  const perDay = new Map<number, number>()
  for (const t of tiles) for (const [cell, day, sp] of t.rows) {
    const r = Math.floor(cell / cols), c = cell % cols
    if (r < r0 || r > r1 || c < c0 || c > c1) continue
    const k = sensorOf(sp)
    const w8 = k === 2 ? beta : k === AQUA ? 1 : 0
    if (w8) perDay.set(day, (perDay.get(day) ?? 0) + w8)
  }
  const out = new Map<number, number>()
  const boxCells = (r1 - r0 + 1) * (c1 - c0 + 1)
  for (const [d, v] of perDay) {
    const cf = (clearFrac?.[d] ?? 100) / 100
    if (cf < 0.2) continue
    out.set(d, (1000 * v) / Math.max(1, cf * Math.min(boxCells, totalCells)))
  }
  return out
}

/** Plain-language verdict for one season: unusual days, the ritu most of them fell in, and days not observed. */
export function seasonVerdict(cal: Calendar, season: string, lang: 'en' | 'bn' = 'en'): { unusual: number; ritu?: Ritu; notObserved: number; text: string } {
  const d0 = seasonStart(season), d1 = d0 + 365
  const days = cal.unusual.filter((d) => d >= d0 && d <= d1)
  let notObserved = 0
  for (const [a, b] of cal.nodata) notObserved += Math.max(0, Math.min(b, d1) - Math.max(a, d0) + 1)
  const tally = new Map<Ritu, number>()
  for (const d of days) { const r = rituOf(dayToDate(d)); tally.set(r, (tally.get(r) ?? 0) + 1) }
  const ritu = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0]
  const n = (x: number) => x.toLocaleString('bn-BD')
  const cloud = !notObserved ? '' : lang === 'bn' ? ` ${n(notObserved)} দিন মেঘের কারণে দেখা যায়নি।` : ` ${notObserved} days were not observed (cloud).`
  const text = lang === 'bn'
    ? days.length
      ? `${season} মৌসুমে ${n(days.length)} দিন ৯০তম শতাংশের স্বাভাবিক মাত্রার উপরে ছিল; বেশিরভাগই ${ritu!.bn} ঋতুতে।${cloud}`
      : `${season} মৌসুমে প্রতিটি পর্যবেক্ষিত দিন স্বাভাবিক পরিসরের মধ্যে ছিল।${cloud}`
    : days.length
      ? `${season} had ${days.length} day${days.length === 1 ? '' : 's'} above the 90th-percentile normal; most fell in ${ritu!.en} (${ritu!.span}).${cloud}`
      : `${season} stayed within the normal range on every observed day.${cloud}`
  return { unusual: days.length, ritu, notObserved, text }
}
