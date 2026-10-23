import { describe, expect, it } from 'vitest'
import { aggregateBox, completeSeasons, dense, hillShare, monthsShare, resolveSplit, seasonMean, seasonToDateRatio, seriesFor, splitShares } from './calendar'
import { dateToDay, seasonDay } from './days'
import { cellId } from './box'
import type { Calendar, GridTile, Meta } from './types'
import cases from '../../../tests/fixtures/grid_cases.json'

const cal = { unit_id: 'X', day0: '2003-01-01', days: [1, 5, 9], raw: { A: [1, 2, 3], N: [4, 8, 12] }, h: [1, 2, 3],
  split: [{ key: 'kiln', values: [0.5, 1, 1.5] }, { key: 'vegetation', values: [0.5, 1, 1.5] }], nodata: [[3, 4]],
  week0: '2003-01-01', h_lo: [], h_hi: [], normal: { p10: [], p50: [], p90: [] }, unusual: [], critical: [], seasons: [] } as unknown as Calendar
const meta = { grid: cases.grid, split_labels: [{ key: 'kiln', label_en: '', label_bn: '' }] } as unknown as Meta

describe('calendar', () => {
  it('densifies sparse arrays and marks nodata as NaN', () => {
    const d = dense(cal, cal.h)
    expect(d[5]).toBe(2); expect(d[2]).toBe(0); expect(Number.isNaN(d[3])).toBe(true)
  })
  it('seasonMean places each day at its day of season and skips not-observed days', () => {
    // day 1 = 2003-01-02, which is day 185 of season 2002-03 (from 1 July 2002); days 3–4 are not observed
    const m = seasonMean(cal)
    expect(m).toHaveLength(366)
    expect(m[185]).toBe(1); expect(m[189]).toBe(2); expect(m[193]).toBe(3)
    expect(m[187]).toBe(0); expect(m[184]).toBe(0)
  })
  it('unknown split key falls back to all', () => {
    expect(resolveSplit(meta, 'aman')).toBe('all')
    expect(resolveSplit(meta, 'kiln')).toBe('kiln')
    expect(seriesFor(cal, 'harm', 'all')).toEqual(cal.h)
  })
  it('whole-district aggregateBox is within ±5% of the district calendar', () => {
    // a synthetic 0.5° × 0.5° "district": 50 × 50 cells, fully clear; S-NPP cells convert with beta 0.25
    const box: [number, number, number, number] = [90.0, 23.5, 90.5, 24.0]
    const rows: GridTile['rows'] = []
    const total = 2500
    let expected = 0
    for (let k = 0; k < 400; k++) {
      const lat = 23.5 + 0.005 + 0.01 * (k % 50), lon = 90.0 + 0.005 + 0.01 * Math.floor(k / 8)
      rows.push([cellId(meta, lat, lon), 100, 2 * 2]) // sensor N, day pass — id from meta.grid, never a literal
      expected += 0.25
    }
    const out = aggregateBox([{ tile: '90_23', day0: '2003-01-01', rows }], meta, box, undefined, total, 0.25)
    const districtRate = (1000 * expected) / total
    expect(Math.abs(out.get(100)! - districtRate) / districtRate).toBeLessThan(0.05)
  })
})

// Real-data helpers (docs/real_data_plan.md, Phase A). Inline synthetic calendars: every expected value follows
// from the input by arithmetic.
describe('real-data helpers', () => {
  // A calendar whose only burning is on one November day per season, 2003-04 … 2005-06, plus one live-season day.
  const nov = (y: number) => dateToDay(`${y}-11-15`)
  const mk = (days: number[], h: number[], split: { key: string; values: number[] }[] = []) =>
    ({ ...cal, days, h, split, nodata: [] } as unknown as Calendar)
  const yearly = mk([nov(2003), nov(2004), nov(2005), nov(2006)], [2, 2, 2, 8])

  it('splitShares gives each window its share of the total, in split order', () => {
    const c = mk([1, 2], [4, 0], [{ key: 'a', values: [1, 0] }, { key: 'b', values: [3, 0] }, { key: 'c', values: [0, 0] }])
    expect(splitShares(c)).toEqual([{ key: 'a', share_frac: 0.25 }, { key: 'b', share_frac: 0.75 }, { key: 'c', share_frac: 0 }])
    expect(splitShares(mk([1], [0], [{ key: 'a', values: [0] }]))).toEqual([])
  })
  it('monthsShare: all burning in November is 1 for [11] and 0 for [4, 5]; a zero year is null', () => {
    expect(monthsShare(yearly, [11])).toBe(1)
    expect(monthsShare(yearly, [4, 5])).toBe(0)
    expect(monthsShare(mk([1], [0]), [11])).toBeNull()
  })
  it('seasonMean can stop before a season, so the live season is not compared with itself', () => {
    const x = seasonDay(new Date(Date.UTC(2003, 10, 15)))
    expect(seasonMean(yearly, yearly.h, '2006-07')[x]).toBe(2)  // 2003-04 … 2005-06 only
    expect(seasonMean(yearly, yearly.h)[x]).toBeGreaterThan(2)   // the 8 of 2006-07 pulls the mean up
  })
  it('seasonToDateRatio compares this season so far with the same days before it', () => {
    const n = seasonDay(new Date(Date.UTC(2006, 10, 15))) + 1
    const live = Array.from({ length: n }, (_, i) => (i === n - 1 ? 2 : 0))
    expect(seasonToDateRatio(yearly, live, '2006-07')).toBe(1)
    expect(seasonToDateRatio(yearly, live.map((v) => v * 2), '2006-07')).toBe(2)
    expect(seasonToDateRatio(yearly, [0, 0, 0], '2006-07')).toBeNull() // nothing typical in the first 3 days of July
  })
  it('completeSeasons runs from the first full season to the one before the live season', () => {
    const c = mk([0, dateToDay('2007-03-01')], [0, 0])
    expect(completeSeasons(c, '2006-07')).toEqual(['2003-04', '2004-05', '2005-06'])
  })
  it('hillShare counts distinct Aqua cell-days inside the hill polygon out of all inside Bangladesh', () => {
    const grid = { origin_lat: 0, origin_lon: 0, step: 1, rows: 10, cols: 10 }
    const sq = (w: number, s: number, e: number, n: number): GeoJSON.Polygon => ({ type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] })
    const hill = sq(0, 0, 5, 10), bd = sq(0, 0, 8, 10)  // cells with col < 5 are hill; col 8–9 are outside Bangladesh
    const c = (row: number, col: number) => row * 10 + col
    const tile = { tile: 't', day0: '2003-01-01', rows: [
      [c(1, 1), 10, 2], [c(1, 1), 10, 3],   // Aqua day + night, same cell-day: counted once
      [c(2, 2), 11, 2], [c(3, 3), 12, 2],   // two more hill cell-days
      [c(4, 6), 12, 2],                     // Bangladesh, not hill
      [c(5, 9), 12, 2],                     // outside Bangladesh: ignored
      [c(6, 1), 12, 4],                     // Suomi NPP: ignored
      [c(7, 1), 99, 2],                     // after lastDay: ignored
    ] as [number, number, number][] }
    expect(hillShare([tile], { grid } as unknown as Meta, [hill], [bd], 50)).toBe(0.75)
  })
})

describe('monthsShare month boundaries', () => {
  it('the last slot of a leap season (30 June 2004) belongs to June, as in monthlyMeans', () => {
    const c = { ...cal, days: [dateToDay('2004-06-30')], h: [5], split: [], nodata: [] } as unknown as Calendar
    expect(monthsShare(c, [6])).toBe(1)
  })
})
