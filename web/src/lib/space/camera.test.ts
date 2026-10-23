import { describe, expect, it } from 'vitest'
import { approach, MAX_RANGE_KM, maxTilt, MIN_RANGE_KM, settled, wheelPixels, zoomToward, type View } from './camera'

const V: View = { lat: 23.6, lon: 90.4, range_km: 800, tilt_deg: 40, heading_deg: 0 }
const P = { lat: 24.5, lon: 89.0 }

describe('camera', () => {
  it('zooming in and back out around the same point returns to the start', () => {
    const back = zoomToward(zoomToward(V, 0.5, P), 2, P)
    expect(back.range_km).toBeCloseTo(V.range_km, 9)
    expect(back.lat).toBeCloseTo(V.lat, 9)
    expect(back.lon).toBeCloseTo(V.lon, 9)
  })

  it('zooming in moves toward the pointed place in proportion; a factor of 1 changes nothing', () => {
    const z = zoomToward(V, 0.25, P)
    expect(z.range_km).toBeCloseTo(200, 9)
    expect(z.lat).toBeCloseTo(V.lat + (P.lat - V.lat) * 0.75, 9)
    expect(z.lon).toBeCloseTo(V.lon + (P.lon - V.lon) * 0.75, 9)
    expect(zoomToward(V, 1, P)).toEqual(V)
  })

  it('the range stays within its limits, and the move uses the factor actually applied', () => {
    expect(zoomToward({ ...V, range_km: 0.4 }, 0.1, P).range_km).toBe(MIN_RANGE_KM)
    expect(zoomToward({ ...V, range_km: 50_000 }, 10).range_km).toBe(MAX_RANGE_KM)
    const near = zoomToward({ ...V, range_km: MIN_RANGE_KM }, 0.5, P)
    expect(near.lat).toBe(V.lat)                                  // could not get closer, so it does not slide either
  })

  it('zooming across the date line takes the short way round', () => {
    const z = zoomToward({ ...V, lon: 179.5 }, 0.5, { lat: V.lat, lon: -179.5 })
    expect(Math.abs(z.lon)).toBeCloseTo(180, 9)                 // the date line (±180°), half-way there: not across the globe at 0°
  })

  it('tilt eases off with range (never a jump) and zooming out lowers it to fit', () => {
    expect(maxTilt(1000)).toBe(72); expect(maxTilt(8000)).toBe(0)
    for (let r = 1500; r < 7000; r += 100) expect(maxTilt(r) - maxTilt(r + 100)).toBeLessThan(1.4)
    expect(zoomToward({ ...V, tilt_deg: 60 }, 6, P).tilt_deg).toBeCloseTo(maxTilt(4800), 9)
  })

  it('smoothing reaches the goal, covers the range in log space, and knows when it has settled', () => {
    const goal = { ...V, range_km: 8000 }
    expect(approach(V, goal, 0.5).range_km).toBeCloseTo(Math.sqrt(800 * 8000), 6)
    let v = V
    for (let i = 0; i < 60; i++) v = approach(v, goal, 0.25)
    expect(settled(v, goal)).toBe(true)
    expect(settled(V, goal)).toBe(false)
  })

  it('wheel deltas in lines and pages become pixels', () => {
    expect(wheelPixels({ deltaY: 100, deltaMode: 0 })).toBe(100)
    expect(wheelPixels({ deltaY: 3, deltaMode: 1 })).toBe(99)
    expect(wheelPixels({ deltaY: 1, deltaMode: 2 })).toBe(600)
  })
})
