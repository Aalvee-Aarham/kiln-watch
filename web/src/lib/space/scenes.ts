import type { Sensor } from '../types'
import type { Column, Label, Line, SatMark, Area } from '../../components/space/types'
import { anchorOrbit, groundTrack, passesOver, SATS, subPoint, swathGrid, type Orbit, type Pass } from './orbit'
import { replayAt, type DayPass, type SeasonFires } from './fires'

// Pure builders: model state in, layer data for an engine out. No drawing, no DOM.

export const BD_UTC_OFFSET_H = 6
export type SatColors = Record<Sensor, string>

/** Orbits for one local date, each anchored so its daytime pass crosses (lat, lon). */
export const orbitsFor = (day_utc: number, lat: number, lon: number): Orbit[] => SATS.map((s) => anchorOrbit(s, day_utc, lat, lon))

export const satMarks = (orbits: Orbit[], t: number, colors: SatColors, lit?: Set<Sensor>): SatMark[] =>
  orbits.map((o) => ({ id: o.sat.id, color: colors[o.sat.id], ...subPoint(o, t), alt_km: o.sat.alt_km, dim: !!lit && !lit.has(o.sat.id) }))

export const satLabels = (orbits: Orbit[], t: number, colors: SatColors): Label[] =>
  orbits.map((o) => ({ id: `sat-${o.sat.id}`, ...subPoint(o, t), alt_km: o.sat.alt_km, text: o.sat.name, color: colors[o.sat.id], kind: 'sat' }))

/** The path each satellite traces over Earth at its own height, one period centred on now. */
export const orbitPaths = (orbits: Orbit[], t: number, colors: SatColors): Line[] =>
  orbits.map((o) => ({ id: `orbit-${o.sat.id}`, color: colors[o.sat.id], width_px: 1.5, opacity: 0.55, alt_km: o.sat.alt_km,
    points: groundTrack(o, t - o.period_ms / 2, t + o.period_ms / 2, 180) }))

/** Ground track behind each satellite (the last `trail_ms`). */
export const trackTrails = (orbits: Orbit[], t: number, colors: SatColors, trail_ms = 40 * 60_000): Line[] =>
  orbits.map((o) => ({ id: `track-${o.sat.id}`, color: colors[o.sat.id], width_px: 1.5, opacity: 0.7, dashed: true, points: groundTrack(o, t - trail_ms, t, 120) }))

const SWATH_FADE = [0.24, 0.15, 0.09, 0.045]
/** The strip each camera has just imaged, fading behind it: four segments of `segment_ms`, newest brightest. */
export const swathAreas = (orbits: Orbit[], t: number, colors: SatColors, segment_ms = 5 * 60_000): Area[] =>
  orbits.flatMap((o) => SWATH_FADE.map((opacity, k) => ({ id: `swath-${o.sat.id}-${k}`, color: colors[o.sat.id], opacity, grid: swathGrid(o, t - k * segment_ms, segment_ms, 14, 13) })))

/** Every pass of every satellite over (lat, lon) on one local date (`day_utc` = its UTC midnight; local = UTC + `utc_offset_h`). */
export const passesFor = (orbits: Orbit[], day_utc: number, lat: number, lon: number, utc_offset_h = BD_UTC_OFFSET_H): Pass[] =>
  orbits.flatMap((o) => passesOver(o, day_utc, lat, lon, utc_offset_h)).sort((a, b) => a.t_utc - b.t_utc)

/** Colour on the same square-root scale as height, so mid-sized squares don't all share the bottom colour. */
const rampAt = (ramp: string[], f: number) => ramp[Math.min(ramp.length - 1, Math.floor(Math.sqrt(f) * ramp.length))]

/**
 * Fire squares of one date, each appearing when the satellite and pass that recorded it goes over, then fading.
 * `ramp` is the fire colour scale, low → high.
 */
export function passColumns(groups: DayPass[], passes: Pass[], t: number, ramp: string[], fade_ms = 3 * 3_600_000): Column[] {
  const max = Math.max(1, ...groups.flatMap((g) => g.bins.map((b) => b.n)))
  const out: Column[] = []
  for (const g of groups) {
    const p = passes.find((x) => x.sat === g.sensor && x.pass === g.pass)
    if (!p || t < p.t_utc) continue
    const age = (t - p.t_utc) / fade_ms
    for (const b of g.bins) {
      const f = b.n / max
      out.push({ lat: b.bin.lat, lon: b.bin.lon, height_km: 12 + 110 * Math.sqrt(f), color: rampAt(ramp, f), glow: Math.max(0, 1 - age) })
    }
  }
  return out
}

/** Season replay: height = fire-days so far (square root, so small squares stay visible), glow = the last week. */
export function seasonColumns(sf: SeasonFires, d: number, ramp: string[], max_cum: number, max_height_km = 140): Column[] {
  const { cum, recent } = replayAt(sf, d, 7)
  return seasonColumnsFrom(sf, cum, recent, ramp, max_cum, max_height_km)
}

/** The same, from running totals (a `SeasonReplay`) instead of recomputing the season. */
export function seasonColumnsFrom(sf: SeasonFires, cum: Float32Array, recent: Float32Array, ramp: string[], max_cum: number, max_height_km = 140): Column[] {
  const out: Column[] = []
  const top = Math.max(1, max_cum)
  for (let i = 0; i < sf.bins.length; i++) {
    if (!cum[i]) continue
    const f = Math.min(1, cum[i] / top)
    out.push({ lat: sf.bins[i].lat, lon: sf.bins[i].lon, height_km: Math.max(2, max_height_km * Math.sqrt(f)),
      color: rampAt(ramp, f), glow: Math.min(1, recent[i] / 4) })
  }
  return out
}
