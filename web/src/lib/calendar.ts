import type { Calendar, GridTile, Meta, Sensor } from './types'
import { dayIso, dayToDate, seasonOf, seasonStart } from './days'
import { rituOf, type Ritu } from './ritu'
import { cellId } from './box'

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

/** Mean activity per day of season (0 = 1 July, 366 slots) over all seasons; not-observed days are skipped. */
export function seasonMean(cal: Calendar, values: number[] = cal.h): number[] {
  const dz = dense(cal, values)
  const sum = new Float64Array(366), n = new Float64Array(366)
  for (let d = 0; d < dz.length; d++) {
    if (Number.isNaN(dz[d])) continue
    const date = dayToDate(d)
    const y = Number(seasonOf(date).slice(0, 4))
    const x = Math.min(365, Math.round((date.getTime() - Date.UTC(y, 6, 1)) / 86_400_000))
    sum[x] += dz[d]; n[x] += 1
  }
  return Array.from(sum, (s, i) => (n[i] ? s / n[i] : 0))
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
    const k = Math.floor(sp / 2) // sensor index: 0 T, 1 A, 2 N …
    const w8 = k === 2 ? beta : k === 1 ? 1 : 0
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
export function seasonVerdict(cal: Calendar, season: string): { unusual: number; ritu?: Ritu; notObserved: number; text: string } {
  const d0 = seasonStart(season), d1 = d0 + 365
  const days = cal.unusual.filter((d) => d >= d0 && d <= d1)
  let notObserved = 0
  for (const [a, b] of cal.nodata) notObserved += Math.max(0, Math.min(b, d1) - Math.max(a, d0) + 1)
  const tally = new Map<Ritu, number>()
  for (const d of days) { const r = rituOf(dayToDate(d)); tally.set(r, (tally.get(r) ?? 0) + 1) }
  const ritu = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0]
  const cloud = notObserved ? ` ${notObserved} days were not observed (cloud).` : ''
  const text = days.length
    ? `${season} had ${days.length} day${days.length === 1 ? '' : 's'} above the 90th-percentile normal; most fell in ${ritu!.en} (${ritu!.span}).${cloud}`
    : `${season} stayed within the normal range on every observed day.${cloud}`
  return { unusual: days.length, ritu, notObserved, text }
}
