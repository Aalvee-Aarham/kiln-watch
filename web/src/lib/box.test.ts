import { describe, expect, it } from 'vitest'
import cases from '../../../tests/fixtures/grid_cases.json'
import { cellId, parseBox } from './box'

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
