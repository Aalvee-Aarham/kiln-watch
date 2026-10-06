import { describe, expect, it } from 'vitest'
import { palette } from './theme'

describe('theme', () => {
  it('returns valid colours when CSS variables are empty', () => {
    const p = palette()
    for (const c of [p.raw, p.harm, p.band, ...p.split, p.kiln, p.ctrl, p.veg, p.unknown, p.cloud, p.ember, ...p.fire]) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
