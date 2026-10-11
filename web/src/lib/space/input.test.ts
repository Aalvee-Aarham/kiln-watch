import { describe, expect, it } from 'vitest'
import { wheelIntent, type WheelLike } from './input'

const w = (deltaX: number, deltaY: number, more: Partial<WheelLike> = {}): WheelLike => ({ deltaX, deltaY, deltaMode: 0, ctrlKey: false, metaKey: false, ...more })

describe('wheel input', () => {
  it('a mouse wheel notch zooms (whole steps of 100 or more, or line/page mode)', () => {
    expect(wheelIntent(w(0, 100, { wheelDeltaY: -120 }))).toBe('zoom')
    expect(wheelIntent(w(0, -120))).toBe('zoom')
    expect(wheelIntent(w(0, 3, { deltaMode: 1 }))).toBe('zoom')
  })
  it('a two-finger swipe moves the globe, up/down as well as sideways', () => {
    expect(wheelIntent(w(0, 7.5))).toBe('pan')                         // fractional
    expect(wheelIntent(w(0, -12))).toBe('pan')                         // small
    expect(wheelIntent(w(15, 0))).toBe('pan')                          // sideways
    expect(wheelIntent(w(0, 60, { wheelDeltaY: -180 }))).toBe('pan')   // Chromium touchpad signature
  })
  it('a pinch zooms, whatever its direction', () => {
    expect(wheelIntent(w(0, 4, { ctrlKey: true }))).toBe('pinch')
    expect(wheelIntent(w(9, 0, { metaKey: true }))).toBe('pinch')
  })
  it('one swipe keeps meaning "move" even if one step is large, but only for a moment', () => {
    const prev = { intent: 'pan' as const, t: 1000 }
    expect(wheelIntent(w(0, 120), prev, 1200)).toBe('pan')
    expect(wheelIntent(w(0, 120), prev, 1500)).toBe('zoom')
  })
})
