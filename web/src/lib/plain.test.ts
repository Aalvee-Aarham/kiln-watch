import { describe, expect, it } from 'vitest'
import { busyMonths, daysText, meanDuration, monthOfSeasonDay, typicalSeason, whenText } from './plain'
import { districtOf, inGeometry } from './geo'
import type { KilnSeasonRow } from './types'

const ci = (p50: number) => ({ p50, lo: p50, hi: p50 })
const row = (season: string, onset: number, end: number, peak = 215): KilnSeasonRow =>
  ({ season, onset: ci(onset), end: ci(end), duration: ci(end - onset), peak: ci(peak), peak_value: null })

describe('plain-language dates', () => {
  it('names the third of the month (day 0 = 1 July, non-leap)', () => {
    expect(whenText(0)).toBe('early July')        // 1 Jul
    expect(whenText(153)).toBe('early December')  // 1 Dec
    expect(whenText(168)).toBe('mid-December')    // 16 Dec
    expect(whenText(183)).toBe('late December')   // 31 Dec
    expect(monthOfSeasonDay(215)).toBe('February') // 1 Feb
  })
  it('rounds lengths to 5 days and whole months', () => {
    expect(daysText(152)).toBe('about 150 days (about 5 months)')
    expect(daysText(90)).toBe('about 90 days (about 3 months)')
  })
})

describe('typical kiln season', () => {
  it('is the median of the last three measured seasons', () => {
    const rows = [row('2019-20', 100, 300), row('2020-21', 140, 280), { ...row('2021-22', 0, 0), onset: null }, row('2022-23', 150, 290), row('2023-24', 138, 304)]
    const t = typicalSeason(rows)!
    expect(t.seasons).toEqual(['2020-21', '2022-23', '2023-24'])
    expect(t.onset).toBe(140); expect(t.end).toBe(290); expect(t.duration).toBe(140)
  })
  it('is null without any measured season', () => expect(typicalSeason([])).toBeNull())
  it('averages lengths inside a season range', () => {
    expect(meanDuration([row('2012-13', 199, 289), row('2013-14', 199, 289), row('2022-23', 138, 289)], '2012-13', '2014-15')).toBe(90)
  })
})

describe('busy months', () => {
  it('widens from the peak month while neighbours carry a quarter of its activity', () => {
    // season months: Jul..Jun; activity Nov(4)=1, Dec(5)=2, Jan(6)=4, Feb(7)=1, rest 0
    const perDay = Array(366).fill(0)
    const starts = [0, 31, 62, 92, 123, 153, 184, 215, 243, 274, 304, 335, 366]
    for (const [m, v] of [[4, 1], [5, 2], [6, 4], [7, 1]]) for (let d = starts[m]; d < starts[m + 1]; d++) perDay[d] = v
    expect(busyMonths(perDay)).toEqual({ first: 4, last: 7, peak: 6 })
    expect(busyMonths(Array(366).fill(0))).toBeNull()
  })
})

describe('point in polygon', () => {
  const square: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[90, 23], [91, 23], [91, 24], [90, 24], [90, 23]], [[90.4, 23.4], [90.6, 23.4], [90.6, 23.6], [90.4, 23.6], [90.4, 23.4]]] }
  it('finds points inside the ring and outside its hole', () => {
    expect(inGeometry(square, 23.2, 90.2)).toBe(true)
    expect(inGeometry(square, 23.5, 90.5)).toBe(false) // in the hole
    expect(inGeometry(square, 24.5, 90.5)).toBe(false)
  })
  it('handles multipolygons and triangles', () => {
    const tri: GeoJSON.MultiPolygon = { type: 'MultiPolygon', coordinates: [[[[88, 20], [89, 20], [88, 21], [88, 20]]], square.coordinates] }
    expect(inGeometry(tri, 20.2, 88.2)).toBe(true)  // below the hypotenuse lon + lat = 109
    expect(inGeometry(tri, 20.8, 88.8)).toBe(false) // above it
    expect(inGeometry(tri, 23.2, 90.2)).toBe(true)
  })
  it('maps an upazila id to its district id', () => expect(districtOf('BD20030004')).toBe('BD2003'))
})
