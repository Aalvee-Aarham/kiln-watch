import type { GridTile, Meta, Sensor } from '../types'
import { dayToDate, seasonOf, seasonStart } from '../days'

// Fire detections from the published grid tiles, grouped into BIN_DEG squares: area-level only, never single cells.
// A "fire-day" is one grid cell with at least one detection on one local date (sensors and passes de-duplicated).

type Grid = Pick<Meta, 'grid'>
export const BIN_DEG = 0.1
/** sensorPass = sensor index × 2 + (night ? 1 : 0); the index order is the pipeline's (pipeline._write_grid_tiles). */
export const SENSOR_BY_INDEX: Sensor[] = ['T', 'A', 'N', 'J1', 'J2']
export const decodeSensorPass = (sp: number): { sensor: Sensor; pass: 'D' | 'N' } => ({ sensor: SENSOR_BY_INDEX[Math.floor(sp / 2)], pass: sp % 2 ? 'N' : 'D' })

export type PassFilter = 'all' | 'D' | 'N'
export interface Bin { key: number; lat: number; lon: number }

/** The bin holding a grid cell: its key and centre. Cell size and origin come from meta.grid. */
export function binOf(meta: Grid, cell: number): Bin {
  const g = meta.grid
  const k = Math.max(1, Math.round(BIN_DEG / g.step))
  const r = Math.floor(cell / g.cols), c = cell % g.cols
  const br = Math.floor(r / k), bc = Math.floor(c / k)
  return { key: br * Math.ceil(g.cols / k) + bc, lat: g.origin_lat + (br + 0.5) * k * g.step, lon: g.origin_lon + (bc + 0.5) * k * g.step }
}

const keep = (sp: number, f: PassFilter) => f === 'all' || (f === 'N') === (sp % 2 === 1)

/** Seasons ("2018-19") with any detection, oldest first. */
export function seasonsIn(tiles: GridTile[]): string[] {
  const s = new Set<string>()
  for (const t of tiles) for (const [, day] of t.rows) s.add(seasonOf(dayToDate(day)))
  return [...s].sort()
}

export interface SeasonFires {
  season: string; day0: number; n_days: number; bins: Bin[]
  /** Per day of season: bin indices and fire-day counts, aligned. */
  daily: { bin: number[]; n: number[] }[]
  total: number
}

/** All fire-days of one season, grouped by bin and by day of season (0 = 1 July). */
export function seasonFires(tiles: GridTile[], meta: Grid, season: string, filter: PassFilter = 'all'): SeasonFires {
  const day0 = seasonStart(season), n_days = seasonStart(`${+season.slice(0, 4) + 1}`) - day0
  const seen = new Set<number>()
  const binIndex = new Map<number, number>(), bins: Bin[] = []
  const perDay = Array.from({ length: n_days }, () => new Map<number, number>())
  let total = 0
  for (const t of tiles) for (const [cell, day, sp] of t.rows) {
    const d = day - day0
    if (d < 0 || d >= n_days || !keep(sp, filter)) continue
    const id = cell * 100_000 + day                                                 // cell < 4.5e6, day < 1e5: exact in a double
    if (seen.has(id)) continue
    seen.add(id)
    const b = binOf(meta, cell)
    let i = binIndex.get(b.key)
    if (i === undefined) { i = bins.length; binIndex.set(b.key, i); bins.push(b) }
    perDay[d].set(i, (perDay[d].get(i) ?? 0) + 1)
    total++
  }
  return { season, day0, n_days, bins, total, daily: perDay.map((m) => ({ bin: [...m.keys()], n: [...m.values()] })) }
}

/** Fire-days per bin up to and including day `d` of the season, and over the `recent_days` ending on `d`. */
export function replayAt(sf: SeasonFires, d: number, recent_days = 7): { cum: Float32Array; recent: Float32Array } {
  const cum = new Float32Array(sf.bins.length), recent = new Float32Array(sf.bins.length)
  const last = Math.min(d, sf.n_days - 1)
  for (let k = 0; k <= last; k++) {
    const { bin, n } = sf.daily[k]
    for (let j = 0; j < bin.length; j++) {
      cum[bin[j]] += n[j]
      if (k > last - recent_days) recent[bin[j]] += n[j]
    }
  }
  return { cum, recent }
}

/**
 * The same numbers as `replayAt`, for a replay that mostly moves forward one day at a time: stepping ahead adds one
 * day and drops the one leaving the window (O(fires that day)); a jump back or far ahead recomputes.
 */
export class SeasonReplay {
  readonly cum: Float32Array; readonly recent: Float32Array
  private d = -1
  constructor(readonly sf: SeasonFires, readonly recent_days = 7) {
    this.cum = new Float32Array(sf.bins.length); this.recent = new Float32Array(sf.bins.length)
  }
  get day() { return this.d }
  at(d: number): this {
    const target = Math.max(-1, Math.min(d, this.sf.n_days - 1))
    if (target < this.d || target - this.d > 30) {
      const r = replayAt(this.sf, target, this.recent_days)
      this.cum.set(r.cum); this.recent.set(r.recent); this.d = target
      return this
    }
    while (this.d < target) {
      this.d++
      const add = this.sf.daily[this.d], drop = this.sf.daily[this.d - this.recent_days]
      for (let j = 0; j < add.bin.length; j++) { this.cum[add.bin[j]] += add.n[j]; this.recent[add.bin[j]] += add.n[j] }
      if (drop) for (let j = 0; j < drop.bin.length; j++) this.recent[drop.bin[j]] -= drop.n[j]
    }
    return this
  }
}

/** Fire-days per day of the season (all squares), for the season bar's activity graph. */
export const dailyTotals = (sf: SeasonFires): number[] => sf.daily.map((x) => x.n.reduce((s, v) => s + v, 0))

/** Fire-days per bin over the whole season. */
export const seasonTotals = (sf: SeasonFires) => replayAt(sf, sf.n_days - 1, 0).cum

/** Fire-weighted centre of each calendar month of the season (Jul → Jun); null for a month without fires. */
export function monthlyCentres(sf: SeasonFires): ({ lat: number; lon: number; n: number } | null)[] {
  const y = +sf.season.slice(0, 4)
  return Array.from({ length: 12 }, (_, m) => {
    const a = Math.round((Date.UTC(y, 6 + m, 1) - Date.UTC(y, 6, 1)) / 86_400_000)
    const b = Math.round((Date.UTC(y, 7 + m, 1) - Date.UTC(y, 6, 1)) / 86_400_000)
    let n = 0, lat = 0, lon = 0
    for (let d = a; d < Math.min(b, sf.n_days); d++) {
      const { bin, n: c } = sf.daily[d]
      for (let j = 0; j < bin.length; j++) { n += c[j]; lat += sf.bins[bin[j]].lat * c[j]; lon += sf.bins[bin[j]].lon * c[j] }
    }
    return n ? { lat: lat / n, lon: lon / n, n } : null
  })
}

export interface DayPass { sensor: Sensor; pass: 'D' | 'N'; bins: { bin: Bin; n: number }[]; total: number }

/** One date's fire-days by satellite and pass (each satellite and pass de-duplicated on its own). */
export function dayPasses(tiles: GridTile[], meta: Grid, day: number): DayPass[] {
  const groups = new Map<number, Map<number, { bin: Bin; n: number }>>()
  const seen = new Set<string>()
  for (const t of tiles) for (const [cell, d, sp] of t.rows) {
    if (d !== day || seen.has(`${cell}:${sp}`)) continue
    seen.add(`${cell}:${sp}`)
    const b = binOf(meta, cell)
    const g = groups.get(sp) ?? new Map<number, { bin: Bin; n: number }>()
    groups.set(sp, g)
    const e = g.get(b.key)
    if (e) e.n++
    else g.set(b.key, { bin: b, n: 1 })
  }
  return [...groups].sort((a, b) => a[0] - b[0]).map(([sp, g]) => {
    const bins = [...g.values()]
    return { ...decodeSensorPass(sp), bins, total: bins.reduce((s, x) => s + x.n, 0) }
  })
}

/** Dates ranked for the pass replay: those seen by both a day and a night pass first, then by fire-days, then latest first. */
export function rankDays(tiles: GridTile[], n = 12): { day: number; cells: number; both: boolean }[] {
  const cells = new Map<number, Set<number>>(), passes = new Map<number, number>()
  for (const t of tiles) for (const [cell, day, sp] of t.rows) {
    const s = cells.get(day) ?? new Set<number>()
    cells.set(day, s); s.add(cell)
    passes.set(day, (passes.get(day) ?? 0) | (sp % 2 ? 2 : 1))
  }
  return [...cells].map(([day, s]) => ({ day, cells: s.size, both: passes.get(day) === 3 }))
    .sort((a, b) => Number(b.both) - Number(a.both) || b.cells - a.cells || b.day - a.day)
    .slice(0, Math.max(0, n))
}

/** The date with the most fire-days seen by both a day and a night pass; falls back to the most fire-days overall. */
export const busiestDay = (tiles: GridTile[]): number | undefined => rankDays(tiles, 1)[0]?.day
