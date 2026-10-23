import { describe, expect, it } from 'vitest'
import { anchorOrbit, bearingDeg, destination, distanceKm, footprintRing, groundTrack, headingDeg, passesOver, periodMin, pixelSize, satById, SATS, subPoint, sunPoint, swathGrid, swathHalfKm, swathRing } from './orbit'

const DHAKA = { lat: 23.78, lon: 90.41 }
const DAY = Date.UTC(2024, 0, 15)

describe('orbit model', () => {
  it('periods match the published values (Aqua 98.8 min, Suomi NPP 101 min)', () => {
    expect(periodMin(satById('A').alt_km)).toBeCloseTo(98.8, 0)
    expect(Math.abs(periodMin(satById('N').alt_km) - 101.4)).toBeLessThan(0.5)
  })

  it('swath widths match the published values (MODIS 2,330 km, VIIRS 3,040 km)', () => {
    expect(Math.abs(2 * swathHalfKm(satById('A')) - 2330) / 2330).toBeLessThan(0.01)
    expect(Math.abs(2 * swathHalfKm(satById('N')) - 3040) / 3040).toBeLessThan(0.01)
  })

  it('pixels: 1 km and 375 m at nadir, about 2.0 × 4.8 km (MODIS) and 0.8 km (VIIRS) at the swath edge', () => {
    const m0 = pixelSize(satById('A'), 0), v0 = pixelSize(satById('N'), 0)
    expect(m0.scan_m).toBeCloseTo(1000, 6); expect(m0.track_m).toBeCloseTo(1000, 6)
    expect(v0.scan_m).toBeCloseTo(375, 6); expect(v0.track_m).toBeCloseTo(375, 6)
    const m1 = pixelSize(satById('A'), 55), v1 = pixelSize(satById('N'), 56.28)
    expect(Math.abs(m1.scan_m - 4800) / 4800).toBeLessThan(0.03)
    expect(Math.abs(m1.track_m - 2000) / 2000).toBeLessThan(0.03)
    expect(Math.abs(v1.scan_m - 800) / 800).toBeLessThan(0.05)
    expect(Math.abs(v1.track_m - 800) / 800).toBeLessThan(0.05)
  })

  it('pixels never shrink with scan angle within one aggregation zone', () => {
    const s = satById('A')
    for (let a = 0; a < 55; a += 5) expect(pixelSize(s, a + 5).scan_m).toBeGreaterThan(pixelSize(s, a).scan_m)
  })

  it('every anchored orbit crosses the anchor point at its anchor time', () => {
    for (const s of SATS.filter((x) => x.phase_frac === 0)) {
      const o = anchorOrbit(s, DAY, DHAKA.lat, DHAKA.lon)
      const p = subPoint(o, o.t_anchor)
      expect(distanceKm(p.lat, p.lon, DHAKA.lat, DHAKA.lon)).toBeLessThan(1)
    }
  })

  it('the daytime pass falls near the design local time (within 30 min) on the chosen day', () => {
    for (const s of SATS.filter((x) => x.phase_frac === 0)) {
      const o = anchorOrbit(s, DAY, DHAKA.lat, DHAKA.lon)
      const localSolarH = (((o.t_anchor - DAY) / 3_600_000 + DHAKA.lon / 15) % 24 + 24) % 24
      expect(Math.abs(localSolarH - s.day_ltan_h)).toBeLessThan(0.5)
      expect(o.t_anchor).toBeGreaterThanOrEqual(DAY - 3_600_000 * 12)
      expect(o.t_anchor).toBeLessThan(DAY + 3_600_000 * 36)
    }
  })

  it('a ground track never goes past latitude 180° − inclination', () => {
    const o = anchorOrbit(satById('N'), DAY, DHAKA.lat, DHAKA.lon)
    const pts = groundTrack(o, DAY, DAY + 86_400_000, 2000)
    const maxLat = Math.max(...pts.map((p) => Math.abs(p.lat)))
    expect(maxLat).toBeLessThanOrEqual(180 - 98.7 + 1e-6)
    expect(maxLat).toBeGreaterThan(180 - 98.7 - 0.5)
  })

  it('an afternoon ascending pass heads north-north-west; the night pass heads south', () => {
    const o = anchorOrbit(satById('A'), DAY, DHAKA.lat, DHAKA.lon)
    const h = headingDeg(o, o.t_anchor)
    expect(h).toBeGreaterThan(330); expect(h).toBeLessThan(360)
    const night = passesOver(o, DAY, DHAKA.lat, DHAKA.lon, 6).find((p) => p.pass === 'N')!
    const hn = headingDeg(o, night.t_utc)
    expect(hn).toBeGreaterThan(180); expect(hn).toBeLessThan(200)
  })

  it('satellites sharing a plane pass a quarter orbit apart', () => {
    const n = anchorOrbit(satById('N'), DAY, DHAKA.lat, DHAKA.lon), j1 = anchorOrbit(satById('J1'), DAY, DHAKA.lat, DHAKA.lon)
    const quarter = n.period_ms / 4
    const a = subPoint(n, n.t_anchor), b = subPoint(j1, n.t_anchor + quarter)
    expect(Math.abs(a.lat - b.lat)).toBeLessThan(1e-6)
  })

  it('the daytime pass is always covered: the anchor sits on the ground track', () => {
    for (const s of SATS.filter((x) => x.phase_frac === 0)) {
      const o = anchorOrbit(s, DAY, DHAKA.lat, DHAKA.lon)
      const d = passesOver(o, DAY, DHAKA.lat, DHAKA.lon, 6).find((p) => p.pass === 'D')!
      expect(d.covered).toBe(true)
      expect(d.miss_km).toBeLessThan(250) // 30 s steps at ~7 km/s: within one step of the track
    }
  })

  it('the swath ring is closed around the track and its width matches the swath', () => {
    const o = anchorOrbit(satById('A'), DAY, DHAKA.lat, DHAKA.lon)
    const ring = swathRing(o, o.t_anchor, 120_000, 5)
    expect(ring).toHaveLength(10)
    const w = distanceKm(ring[4].lat, ring[4].lon, ring[5].lat, ring[5].lon)
    expect(Math.abs(w - 2 * swathHalfKm(o.sat)) / w).toBeLessThan(0.01)
  })

  it('the swath grid runs edge to edge through the ground track', () => {
    const o = anchorOrbit(satById('N'), DAY, DHAKA.lat, DHAKA.lon)
    const g = swathGrid(o, o.t_anchor, 300_000, 6, 9)
    expect(g).toHaveLength(6); expect(g[0]).toHaveLength(9)
    const last = g[5], mid = last[4], p = subPoint(o, o.t_anchor)
    expect(distanceKm(mid.lat, mid.lon, p.lat, p.lon)).toBeLessThan(0.01)
    expect(distanceKm(last[0].lat, last[0].lon, last[8].lat, last[8].lon)).toBeCloseTo(2 * swathHalfKm(o.sat), 0)
  })
})

describe('sphere helpers', () => {
  it('destination and distance/bearing are inverse', () => {
    const p = destination(23.7, 90.4, 37, 1234)
    expect(distanceKm(23.7, 90.4, p.lat, p.lon)).toBeCloseTo(1234, 3)
    expect(bearingDeg(23.7, 90.4, p.lat, p.lon)).toBeCloseTo(37, 6)
  })
  it('one degree of latitude is about 111.2 km', () => {
    expect(distanceKm(0, 0, 1, 0)).toBeCloseTo(111.19, 1)
  })
})

describe('sun position', () => {
  it('is over the equator at the March 2024 equinox (20 Mar 03:06 UTC)', () => {
    expect(Math.abs(sunPoint(Date.UTC(2024, 2, 20, 3, 6)).lat)).toBeLessThan(0.05)
  })
  it('is over the Tropic of Cancer at the June 2024 solstice (20 Jun 20:51 UTC)', () => {
    expect(sunPoint(Date.UTC(2024, 5, 20, 20, 51)).lat).toBeCloseTo(23.44, 1)
  })
  it('is near the Greenwich meridian at 12:00 UTC (within the equation of time, ≤ 16.5 min = 4.2°)', () => {
    for (const m of [0, 3, 6, 9]) expect(Math.abs(sunPoint(Date.UTC(2024, m, 15, 12)).lon)).toBeLessThan(4.2)
  })
})

describe('footprints', () => {
  it('a footprint ring has the requested side lengths and diagonal', () => {
    const r = footprintRing(25.7, 89.25, 2000, 4800, 347)
    expect(distanceKm(r[0].lat, r[0].lon, r[1].lat, r[1].lon)).toBeCloseTo(4.8, 2)
    expect(distanceKm(r[1].lat, r[1].lon, r[2].lat, r[2].lon)).toBeCloseTo(2.0, 2)
    expect(distanceKm(r[0].lat, r[0].lon, r[2].lat, r[2].lon)).toBeCloseTo(Math.hypot(2, 4.8), 2)
  })
})
