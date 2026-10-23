import type { Sensor } from '../types'

// A schematic orbit model for the "Seen from space" page: circular, sun-synchronous orbits on a spherical Earth.
// Each satellite keeps its design local time (its orbit plane follows the mean Sun), and its phase is anchored so the
// daytime pass on the chosen date crosses a chosen point. Shape, period and local pass times are right; the exact
// ground track on a past date is not (that needs archived orbit elements).

export const EARTH_R_KM = 6371.0088          // IUGG mean Earth radius
const MU_KM3_S2 = 398600.4418                // Earth's gravitational parameter
const DAY_MS = 86_400_000
const RAD = Math.PI / 180

export type Instrument = 'MODIS' | 'VIIRS'
export interface Sat {
  id: Sensor; name: string; instrument: Instrument
  alt_km: number; incl_deg: number
  /** Mean local time (hours) of the daytime equator crossing, and its direction. */
  day_node: 'asc' | 'desc'; day_ltan_h: number
  /** Orbit-fraction offset from the satellite it shares a plane with (positive = ahead). */
  phase_frac: number
  max_scan_deg: number
  /** Native sample size at nadir before any on-board aggregation, metres. */
  native_scan_m: number; native_track_m: number
  /** Along-scan aggregation factor by scan-angle zone: [upper bound deg, factor]. */
  aggregation: [number, number][]
}

// Design orbits. Terra (since 2020) and Aqua (since 2022) have drifted from these; the page says so.
export const SATS: Sat[] = [
  { id: 'T', name: 'Terra', instrument: 'MODIS', alt_km: 705, incl_deg: 98.2, day_node: 'desc', day_ltan_h: 10.5, phase_frac: 0,
    max_scan_deg: 55, native_scan_m: 1000, native_track_m: 1000, aggregation: [[90, 1]] },
  { id: 'A', name: 'Aqua', instrument: 'MODIS', alt_km: 705, incl_deg: 98.2, day_node: 'asc', day_ltan_h: 13.5, phase_frac: 0,
    max_scan_deg: 55, native_scan_m: 1000, native_track_m: 1000, aggregation: [[90, 1]] },
  { id: 'N', name: 'Suomi NPP', instrument: 'VIIRS', alt_km: 824, incl_deg: 98.7, day_node: 'asc', day_ltan_h: 13 + 25 / 60, phase_frac: 0,
    max_scan_deg: 56.28, native_scan_m: 125, native_track_m: 375, aggregation: [[31.59, 3], [44.68, 2], [90, 1]] },
  { id: 'J1', name: 'NOAA-20', instrument: 'VIIRS', alt_km: 824, incl_deg: 98.7, day_node: 'asc', day_ltan_h: 13 + 25 / 60, phase_frac: -0.25,
    max_scan_deg: 56.28, native_scan_m: 125, native_track_m: 375, aggregation: [[31.59, 3], [44.68, 2], [90, 1]] },
  { id: 'J2', name: 'NOAA-21', instrument: 'VIIRS', alt_km: 824, incl_deg: 98.7, day_node: 'asc', day_ltan_h: 13 + 25 / 60, phase_frac: 0.25,
    max_scan_deg: 56.28, native_scan_m: 125, native_track_m: 375, aggregation: [[31.59, 3], [44.68, 2], [90, 1]] },
]
export const satById = (id: Sensor) => SATS.find((s) => s.id === id)!

const wrap360 = (d: number) => ((d % 360) + 360) % 360
const wrap180 = (d: number) => wrap360(d + 180) - 180
const daysJ2000 = (t_utc: number) => t_utc / DAY_MS + 2440587.5 - 2451545.0

/** Greenwich mean sidereal time, degrees. */
export const gmstDeg = (t_utc: number) => wrap360(280.46061837 + 360.98564736629 * daysJ2000(t_utc))
/** Mean longitude of the Sun, degrees: the right ascension of the "mean sun" that sun-synchronous orbits follow. */
const meanSunDeg = (t_utc: number) => wrap360(280.46 + 0.9856474 * daysJ2000(t_utc))

/** Orbital period from Kepler's third law, minutes. */
export const periodMin = (alt_km: number) => (2 * Math.PI * Math.sqrt((EARTH_R_KM + alt_km) ** 3 / MU_KM3_S2)) / 60

/** The point on Earth with the Sun overhead (low-precision solar position, good to ~0.01°). */
export function sunPoint(t_utc: number): { lat: number; lon: number } {
  const n = daysJ2000(t_utc)
  const g = (357.528 + 0.9856003 * n) * RAD
  const lam = (280.46 + 0.9856474 * n + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD
  const eps = (23.439 - 0.0000004 * n) * RAD
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) / RAD
  return { lat: Math.asin(Math.sin(eps) * Math.sin(lam)) / RAD, lon: wrap180(ra - gmstDeg(t_utc)) }
}

export interface Orbit { sat: Sat; t_anchor: number; u_anchor: number; period_ms: number }

/** Ascending-node local time, hours. */
const ltanAsc = (s: Sat) => (s.day_node === 'asc' ? s.day_ltan_h : (s.day_ltan_h + 12) % 24)
const raan = (s: Sat, t_utc: number) => meanSunDeg(t_utc) + (ltanAsc(s) - 12) * 15

/**
 * Place a satellite so its daytime pass on the UTC day starting at day_utc crosses (lat, lon).
 * The crossing time is solved, not chosen: it is when Earth's turning brings the point under the orbit plane.
 */
export function anchorOrbit(sat: Sat, day_utc: number, lat: number, lon: number): Orbit {
  const i = sat.incl_deg * RAD
  const s = Math.max(-1, Math.min(1, Math.sin(lat * RAD) / Math.sin(i)))
  const u = sat.day_node === 'asc' ? Math.asin(s) : Math.PI - Math.asin(s)
  const dRa = Math.atan2(Math.cos(i) * Math.sin(u), Math.cos(u)) / RAD
  const lonAt = (t: number) => raan(sat, t) + dRa - gmstDeg(t)
  // Newton steps on a function that falls 360° per solar day: converges in two; four is the bound.
  let t = day_utc + (sat.day_ltan_h - lon / 15) * 3_600_000
  for (let k = 0; k < 4; k++) t += (wrap180(lonAt(t) - lon) / 360) * DAY_MS
  return { sat, t_anchor: t, u_anchor: u + sat.phase_frac * 2 * Math.PI, period_ms: periodMin(sat.alt_km) * 60_000 }
}

/** Sub-satellite point at a time. */
export function subPoint(o: Orbit, t_utc: number): { lat: number; lon: number } {
  const i = o.sat.incl_deg * RAD
  const u = o.u_anchor + (2 * Math.PI * (t_utc - o.t_anchor)) / o.period_ms
  const om = raan(o.sat, t_utc) * RAD
  const x = Math.cos(om) * Math.cos(u) - Math.sin(om) * Math.sin(u) * Math.cos(i)
  const y = Math.sin(om) * Math.cos(u) + Math.cos(om) * Math.sin(u) * Math.cos(i)
  const z = Math.sin(u) * Math.sin(i)
  return { lat: Math.asin(Math.max(-1, Math.min(1, z))) / RAD, lon: wrap180(Math.atan2(y, x) / RAD - gmstDeg(t_utc)) }
}

/** Great-circle distance, km. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a = Math.sin(((lat2 - lat1) * RAD) / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(((lon2 - lon1) * RAD) / 2) ** 2
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Initial bearing from point 1 to point 2, degrees clockwise from north. */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * RAD, p2 = lat2 * RAD, dl = (lon2 - lon1) * RAD
  return wrap360(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) / RAD)
}

/** The point a distance along a bearing from a start point. */
export function destination(lat: number, lon: number, bearing_deg: number, dist_km: number): { lat: number; lon: number } {
  const d = dist_km / EARTH_R_KM, b = bearing_deg * RAD, p = lat * RAD
  const p2 = Math.asin(Math.sin(p) * Math.cos(d) + Math.cos(p) * Math.sin(d) * Math.cos(b))
  const l2 = lon * RAD + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p), Math.cos(d) - Math.sin(p) * Math.sin(p2))
  return { lat: p2 / RAD, lon: wrap180(l2 / RAD) }
}

/** Ground-track heading at a time, degrees clockwise from north (includes Earth's rotation). */
export function headingDeg(o: Orbit, t_utc: number): number {
  const a = subPoint(o, t_utc - 5000), b = subPoint(o, t_utc + 5000)
  return bearingDeg(a.lat, a.lon, b.lat, b.lon)
}

/** Points along the ground track from t0 to t1. At most max_points (bounded). */
export function groundTrack(o: Orbit, t0: number, t1: number, max_points = 240): { lat: number; lon: number }[] {
  const n = Math.max(2, Math.min(max_points, Math.ceil((t1 - t0) / 20_000)))
  return Array.from({ length: n }, (_, k) => subPoint(o, t0 + ((t1 - t0) * k) / (n - 1)))
}

// Viewing geometry on a sphere: a camera at height h looking θ off nadir hits the ground at Earth-central angle β,
// where the zenith angle z there satisfies sin z = (r/R) sin θ and β = z − θ.
const zenith = (alt_km: number, scan_deg: number) => Math.asin(Math.min(1, ((EARTH_R_KM + alt_km) / EARTH_R_KM) * Math.sin(scan_deg * RAD)))

/** Half the swath width, km, measured along the ground. */
export const swathHalfKm = (s: Sat) => EARTH_R_KM * (zenith(s.alt_km, s.max_scan_deg) - s.max_scan_deg * RAD)

/** Pixel footprint at a scan angle, metres: along-scan grows fastest; VIIRS aggregates fewer samples off-nadir to compensate. */
export function pixelSize(s: Sat, scan_deg: number): { scan_m: number; track_m: number } {
  const th = Math.min(Math.abs(scan_deg), s.max_scan_deg) * RAD
  const R = EARTH_R_KM, r = R + s.alt_km, z = zenith(s.alt_km, th / RAD), beta = z - th
  const growScan = (r / R) * Math.cos(th) / Math.cos(z) - 1                       // dβ/dθ; equals h/R at nadir
  const slant = Math.sqrt(R * R + r * r - 2 * R * r * Math.cos(beta))              // equals h at nadir
  const agg = s.aggregation.find(([edge]) => th / RAD <= edge)?.[1] ?? 1
  return {
    scan_m: (s.native_scan_m * agg * R * growScan) / s.alt_km,
    track_m: (s.native_track_m * slant) / s.alt_km,
  }
}

/**
 * The swath swept over the last `window_ms` as a grid: `rows` steps along the track, each a row of `cols` points
 * from the left edge to the right edge. A grid (not one flat polygon) so a 3,000 km strip can follow Earth's curve.
 */
export function swathGrid(o: Orbit, t_utc: number, window_ms: number, rows = 30, cols = 9): { lat: number; lon: number }[][] {
  const half = swathHalfKm(o.sat)
  const nr = Math.max(2, Math.min(rows, 400)), nc = Math.max(2, Math.min(cols, 64))
  return Array.from({ length: nr }, (_, k) => {
    const t = t_utc - window_ms + (window_ms * k) / (nr - 1)
    const p = subPoint(o, t), h = headingDeg(o, t)
    return Array.from({ length: nc }, (_, j) => {
      const x = -half + (2 * half * j) / (nc - 1)
      return destination(p.lat, p.lon, h + 90, x)
    })
  })
}

/** The same swath as one closed ring: left edge forward, right edge back. */
export function swathRing(o: Orbit, t_utc: number, window_ms: number, max_points = 60): { lat: number; lon: number }[] {
  const g = swathGrid(o, t_utc, window_ms, max_points, 2)
  return [...g.map((r) => r[0]), ...g.map((r) => r[1]).reverse()]
}

export interface Pass { sat: Sensor; pass: 'D' | 'N'; t_utc: number; miss_km: number; covered: boolean }

/** Closest approach to (lat, lon) in the day (06–18 local) and night windows of a local day; local time = UTC + utc_offset_h. */
export function passesOver(o: Orbit, day_utc: number, lat: number, lon: number, utc_offset_h: number): Pass[] {
  const half = swathHalfKm(o.sat)
  const at = (h: number) => day_utc + (h - utc_offset_h) * 3_600_000
  const best = (t0: number, t1: number) => {
    let bt = t0, bd = Infinity
    for (let t = t0; t <= t1; t += 30_000) {                                       // 30 s steps: ≤ 1,441 per window
      const p = subPoint(o, t), d = distanceKm(lat, lon, p.lat, p.lon)
      if (d < bd) { bd = d; bt = t }
    }
    return { t: bt, d: bd }
  }
  const day = best(at(6), at(18))
  const night = [best(at(0), at(6)), best(at(18), at(24))].sort((a, b) => a.d - b.d)[0]
  return [
    { sat: o.sat.id, pass: 'D', t_utc: day.t, miss_km: day.d, covered: day.d <= half },
    { sat: o.sat.id, pass: 'N', t_utc: night.t, miss_km: night.d, covered: night.d <= half },
  ]
}

/** A rectangle on the ground as a closed ring: `along_m` in the heading direction, `across_m` at right angles. */
export function footprintRing(lat: number, lon: number, along_m: number, across_m: number, heading_deg = 0): { lat: number; lon: number }[] {
  const corner = (sa: number, sc: number) => {
    const p = destination(lat, lon, heading_deg, (sa * along_m) / 2000)
    return destination(p.lat, p.lon, heading_deg + 90, (sc * across_m) / 2000)
  }
  return [corner(1, -1), corner(1, 1), corner(-1, 1), corner(-1, -1)]
}
