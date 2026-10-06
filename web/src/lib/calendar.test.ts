import { describe, expect, it } from 'vitest'
import { aggregateBox, dense, resolveSplit, seasonMean, seriesFor } from './calendar'
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
      const cid = Math.floor((lat - 20) / 0.01 + 1e-9) * 3000 + Math.floor((lon - 68) / 0.01 + 1e-9)
      rows.push([cid, 100, 2 * 2]) // sensor N, day pass
      expected += 0.25
    }
    const out = aggregateBox([{ tile: '90_23', day0: '2003-01-01', rows }], meta, box, undefined, total, 0.25)
    const districtRate = (1000 * expected) / total
    expect(Math.abs(out.get(100)! - districtRate) / districtRate).toBeLessThan(0.05)
  })
})
