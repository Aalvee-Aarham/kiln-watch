// Camera maths shared by both globes: zoom toward a point, gentle tilt limits, smoothing. Pure and tested.

export interface View { lat: number; lon: number; range_km: number; tilt_deg: number; heading_deg: number }

export const MIN_RANGE_KM = 0.3
export const MAX_RANGE_KM = 60_000

/** Into -180..180; values already there come back unchanged (no rounding drift). */
const wrap180 = (d: number) => (d >= -180 && d <= 180 ? d : ((((d + 180) % 360) + 360) % 360) - 180)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** How far the camera may tilt at a range: freely close in, easing to straight down from far away (no sudden snaps). */
export function maxTilt(range_km: number): number {
  if (range_km <= 1500) return 72
  if (range_km >= 7000) return 0
  return 72 * (1 - (range_km - 1500) / 5500)
}

/**
 * Zoom by `factor` (< 1 closer, > 1 further) toward a point on the ground, so that point stays where it was on screen,
 * the way Google Earth zooms to the cursor. Without a point it zooms toward the centre. The range stays within limits.
 */
export function zoomToward(v: View, factor: number, at?: { lat: number; lon: number }): View {
  const range_km = clamp(v.range_km * factor, MIN_RANGE_KM, MAX_RANGE_KM)
  const f = range_km / v.range_km                       // the factor actually applied, after the limits
  const out: View = { ...v, range_km, tilt_deg: Math.min(v.tilt_deg, maxTilt(range_km)) }
  if (!at || v.range_km > 9000) return out             // far out the globe turns, it does not slide: keep the centre
  const dLon = wrap180(at.lon - v.lon)
  return { ...out, lat: clamp(v.lat + (at.lat - v.lat) * (1 - f), -85, 85), lon: wrap180(v.lon + dLon * (1 - f)) }
}

/** One step of smoothing toward a goal (range in log space, so a big zoom feels even); `k` is the fraction covered. */
export function approach(v: View, goal: View, k: number): View {
  const dLon = wrap180(goal.lon - v.lon)
  return {
    lat: v.lat + (goal.lat - v.lat) * k,
    lon: wrap180(v.lon + dLon * k),
    range_km: Math.exp(Math.log(v.range_km) + (Math.log(goal.range_km) - Math.log(v.range_km)) * k),
    tilt_deg: v.tilt_deg + (goal.tilt_deg - v.tilt_deg) * k,
    heading_deg: v.heading_deg + wrap180(goal.heading_deg - v.heading_deg) * k,
  }
}

/** Close enough to stop smoothing: under a hundredth of the range, and under a tenth of a degree of tilt. */
export const settled = (a: View, b: View) =>
  Math.abs(Math.log(a.range_km / b.range_km)) < 0.003 && Math.abs(a.lat - b.lat) * 111.19 < a.range_km * 0.002 &&
  Math.abs(wrap180(a.lon - b.lon)) * 111.19 < a.range_km * 0.002 && Math.abs(a.tilt_deg - b.tilt_deg) < 0.1

/** Wheel events in pixels (some mice report lines or pages). */
export const wheelPixels = (e: { deltaY: number; deltaMode: number }) => e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 600 : 1)
