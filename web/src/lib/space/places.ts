import type { FC } from '../types'

/** Area-weighted centre of a feature's largest outer ring (planar in lon/lat: fine at district scale). */
export function centreOf(g: GeoJSON.Geometry): { lat: number; lon: number } {
  const rings = g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p) => p[0]) : []
  let best = { a: 0, lat: 0, lon: 0 }
  for (const r of rings) {
    let a = 0, x = 0, y = 0
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const f = r[j][0] * r[i][1] - r[i][0] * r[j][1]
      a += f; x += (r[j][0] + r[i][0]) * f; y += (r[j][1] + r[i][1]) * f
    }
    if (Math.abs(a) > Math.abs(best.a)) best = { a, lon: x / (3 * a), lat: y / (3 * a) }
  }
  return { lat: best.lat, lon: best.lon }
}

/** District outlines as [lat, lon] rings, for drawing. */
export function outlines(fc: FC): { lat: number; lon: number }[][] {
  const out: { lat: number; lon: number }[][] = []
  for (const f of fc.features) {
    const g = f.geometry
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
    for (const p of polys) out.push(p[0].map(([lon, lat]) => ({ lat, lon })))
  }
  return out
}

export interface Place { name: string; lat: number; lon: number }

/** The closest named city within `max_km`, if any (for naming a clicked point). */
export function nearestCity<T extends { lat: number; lon: number }>(cities: T[], lat: number, lon: number, max_km: number): T | undefined {
  let best: T | undefined, bestD = max_km
  const k = Math.cos((lat * Math.PI) / 180)
  for (const c of cities) {
    const d = 111.19 * Math.hypot(c.lat - lat, (((c.lon - lon + 540) % 360) - 180) * k)  // equirectangular: fine at these distances
    if (d <= bestD) { best = c; bestD = d }
  }
  return best
}

/** Hours to add to UTC for the clock at a place: Bangladesh time (UTC+6) inside Bangladesh, local solar time (to the quarter hour) elsewhere. */
export const clockOffsetH = (lon: number, inBangladesh: boolean) => (inBangladesh ? 6 : Math.round((lon / 15) * 4) / 4)

/** "23.6° N, 90.4° E" */
export const fmtLatLon = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? 'E' : 'W'}`
