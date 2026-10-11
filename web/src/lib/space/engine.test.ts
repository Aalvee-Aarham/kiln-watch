import { describe, expect, it } from 'vitest'
import { chooseEngine, type EnginePref } from './engine'

describe('engine choice', () => {
  it('online uses Cesium unless the light globe is asked for', () => {
    expect(chooseEngine({ pref: 'auto', online: true, webgl2: true })).toBe('cesium')
    expect(chooseEngine({ pref: 'detailed', online: true, webgl2: true })).toBe('cesium')
    expect(chooseEngine({ pref: 'light', online: true, webgl2: true })).toBe('globe')
  })
  it('offline always uses the bundled globe', () => {
    for (const pref of ['auto', 'detailed', 'light'] as EnginePref[]) expect(chooseEngine({ pref, online: false, webgl2: true })).toBe('globe')
  })
  it('no WebGL 2 means no globe at all', () => {
    for (const pref of ['auto', 'detailed', 'light'] as EnginePref[])
      for (const online of [true, false]) expect(chooseEngine({ pref, online, webgl2: false })).toBe('none')
  })
})
