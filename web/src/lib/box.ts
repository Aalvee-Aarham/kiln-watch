import type { Meta } from './types'

// NO grid literals here: every constant comes from meta.grid (published by the pipeline).
type Grid = Pick<Meta, 'grid'>

export function cellId(meta: Grid, lat: number, lon: number): number {
  const g = meta.grid
  const row = Math.floor((lat - g.origin_lat) / g.step + 1e-9)
  const col = Math.floor((lon - g.origin_lon) / g.step + 1e-9)
  if (row < 0 || row >= g.rows || col < 0 || col >= g.cols) throw new RangeError('coordinate outside grid')
  return row * g.cols + col
}

/** 1° × 1° tile names ("lon_lat" of the SW corner) intersecting a box. */
export function tilesForBox([w, s, e, n]: [number, number, number, number]): string[] {
  const out: string[] = []
  for (let x = Math.floor(w); x < Math.ceil(e); x++) for (let y = Math.floor(s); y < Math.ceil(n); y++) out.push(`${x}_${y}`)
  return out
}

export type Box = [number, number, number, number]
export const BBOX: Box = [88.0, 20.5, 92.8, 26.7] // analysis extent (implementation_plan §6), not a grid constant
export const SOUTH_ASIA_BOX: Box = [60.0, 3.0, 98.0, 39.0] // extent of the regional NASA images (#/region), not a grid constant

/** Canonical box: four values with exactly 4 decimals, W,S,E,N, w<e, s<n, inside BBOX, area ≥ 100 km². */
export function parseBox(text: string): Box | string {
  const parts = text.split(',')
  if (parts.length !== 4) return 'A box needs four numbers: west,south,east,north.'
  if (!parts.every((p) => /^-?\d+\.\d{4}$/.test(p))) return 'Each box value must have exactly 4 decimal places.'
  const [w, s, e, n] = parts.map(Number)
  if (!(w < e && s < n)) return 'West must be less than east and south less than north.'
  if (w < BBOX[0] || e > BBOX[2] || s < BBOX[1] || n > BBOX[3]) return 'The box must lie inside Bangladesh’s analysis extent.'
  if (boxAreaKm2([w, s, e, n]) < 100) return 'The box must cover at least 100 km².'
  return [w, s, e, n]
}

export const boxAreaKm2 = ([w, s, e, n]: Box) => (e - w) * 111.32 * Math.cos(((s + n) / 2) * Math.PI / 180) * (n - s) * 110.57
export const formatBox = (b: Box) => b.map((v) => v.toFixed(4)).join(',')
