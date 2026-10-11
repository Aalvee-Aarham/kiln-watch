import { describe, expect, it } from 'vitest'
import { centreOf, clockOffsetH, fmtLatLon, nearestCity } from './places'

describe('places', () => {
  it('the centre of a rectangle is its midpoint, in either winding', () => {
    const ring = [[89, 25], [90, 25], [90, 26], [89, 26], [89, 25]]
    expect(centreOf({ type: 'Polygon', coordinates: [ring] })).toEqual({ lat: 25.5, lon: 89.5 })
    expect(centreOf({ type: 'Polygon', coordinates: [[...ring].reverse()] })).toEqual({ lat: 25.5, lon: 89.5 })
  })
  it('a multipolygon takes the centre of its largest part', () => {
    const big = [[89, 25], [91, 25], [91, 27], [89, 27], [89, 25]], small = [[80, 10], [80.1, 10], [80.1, 10.1], [80, 10]]
    expect(centreOf({ type: 'MultiPolygon', coordinates: [[small], [big]] })).toEqual({ lat: 26, lon: 90 })
  })
})

describe('naming and clocks', () => {
  const cities = [{ name: 'Dhaka', lat: 23.78, lon: 90.41 }, { name: 'Chattogram', lat: 22.34, lon: 91.83 }, { name: 'Suva', lat: -18.14, lon: 178.44 }]
  it('names the nearest city within reach, and nothing beyond it', () => {
    expect(nearestCity(cities, 23.7, 90.3, 50)?.name).toBe('Dhaka')
    expect(nearestCity(cities, 22.4, 91.9, 50)?.name).toBe('Chattogram')
    expect(nearestCity(cities, 10, 60, 50)).toBeUndefined()
    expect(nearestCity(cities, -18.1, -179.9, 300)?.name).toBe('Suva')   // across the date line
  })
  it('uses Bangladesh time in Bangladesh and local solar time elsewhere, to the quarter hour', () => {
    expect(clockOffsetH(90.4, true)).toBe(6)
    expect(clockOffsetH(90.4, false)).toBe(6)
    expect(clockOffsetH(-74.0, false)).toBe(-5)
    expect(clockOffsetH(2.35, false)).toBe(0.25)
  })
  it('formats coordinates with hemispheres', () => {
    expect(fmtLatLon(23.61, 90.44)).toBe('23.6° N, 90.4° E')
    expect(fmtLatLon(-33.87, -70.65)).toBe('33.9° S, 70.7° W')
  })
})
