import { describe, expect, it } from 'vitest'
import { palette, rampColor, splitColor } from './theme'

describe('theme', () => {
  it('returns valid colours when CSS variables are empty', () => {
    const p = palette()
    for (const c of [p.heat, p.orbit, p.paddy, p.jute, p.brick, p.plum, p.raw, p.band, p.cloud, p.ink, p.muted, p.line, p.surface, p.surface2, p.bg, ...p.fire]) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
  it('colours a split by its key, not its position', () => {
    const p = palette()
    expect(splitColor('aman', p, 0)).toBe(p.paddy)
    expect(splitColor('aman', p, 2)).toBe(p.paddy)
    expect(splitColor('kiln', p, 1)).toBe(p.brick)
    expect(splitColor('boro', p, 0)).toBe(splitColor('veg', p, 2))
    expect(splitColor('other', p)).toBe(p.plum)
  })
})

describe('rampColor', () => {
  it('keeps zero and missing values off the fire ramp and maps the max to the top step', () => {
    const p = palette()
    expect(rampColor(0, 10, p)).toBe(p.surface2)
    expect(rampColor(null, 10, p)).toBe(p.surface2)
    expect(rampColor(10, 10, p)).toBe(p.fire[4])
    expect(rampColor(1, 10, p)).toBe(p.fire[0])
    expect(rampColor(5, 10, p)).toBe(p.fire[2])
  })
})
