import { describe, expect, it } from 'vitest'
import cases from '../../../tests/fixtures/grid_cases.json'
import { AQUA, cellCenter, cellId, parseBox, sensorOf } from './box'

const meta = { grid: cases.grid }

describe('box', () => {
  it('cellId equals the Python ids', () => {
    for (const c of cases.cases) expect(cellId(meta, c.lat, c.lon)).toBe(c.id)
  })
  it('out-of-grid raises', () => {
    for (const c of cases.out_of_grid) expect(() => cellId(meta, c.lat, c.lon)).toThrow()
  })
  it('altering meta.grid changes the computed id', () => {
    const shifted = { grid: { ...cases.grid, origin_lon: cases.grid.origin_lon - 1 } }
    expect(cellId(shifted, 23.781, 90.4125)).not.toBe(1136241)
  })
  it('parses one valid and rejects three invalid URL forms', () => {
    expect(parseBox('90.2500,23.6000,90.6000,23.9000')).toEqual([90.25, 23.6, 90.6, 23.9])
    expect(typeof parseBox('90.2500,23.6000,90.6000')).toBe('string')               // wrong count
    expect(typeof parseBox('90.6000,23.6000,90.2500,23.9000')).toBe('string')       // E < W
    expect(typeof parseBox('99.2500,23.6000,99.6000,23.9000')).toBe('string')       // lon out of range
    expect(typeof parseBox('90.25,23.6,90.6,23.9')).toBe('string')                  // not 4 decimals
  })
})

describe('grid cell centres and sensor codes', () => {
  it('cellCenter is the inverse of cellId: first, last and a middle cell', () => {
    const g = cases.grid
    for (const c of [0, g.rows * g.cols - 1, Math.floor(g.rows / 2) * g.cols + Math.floor(g.cols / 3)]) {
      const { lat, lon } = cellCenter(meta, c)
      expect(cellId(meta, lat, lon)).toBe(c)
    }
  })
  it('sensorOf drops the pass bit: 2 and 3 are Aqua, 4 is Suomi NPP', () => {
    expect(sensorOf(2)).toBe(AQUA); expect(sensorOf(3)).toBe(AQUA); expect(sensorOf(4)).toBe(2)
  })
})
