import { describe, expect, it } from 'vitest'
import { nextCritical, warningsFor } from './warnings'
import type { NrtSeason, Outlook } from './types'

describe('nextCritical', () => {
  const w: [number, number][] = [[270, 300], [123, 200]] // unsorted on purpose
  it('is 0 days away inside a window, including both ends', () => {
    expect(nextCritical(w, 123, 365)).toEqual({ start: 123, end: 200, daysUntil: 0 })
    expect(nextCritical(w, 200, 365)).toEqual({ start: 123, end: 200, daysUntil: 0 })
  })
  it('counts the days to the next window', () => {
    expect(nextCritical(w, 96, 365)?.daysUntil).toBe(27)
    expect(nextCritical(w, 201, 365)).toEqual({ start: 270, end: 300, daysUntil: 69 })
  })
  it('wraps to next season after the last window', () => {
    expect(nextCritical(w, 301, 365)).toEqual({ start: 488, end: 565, daysUntil: 187 })
  })
  it('has no answer without windows', () => {
    expect(nextCritical([], 10, 365)).toBeNull()
  })
})

// 100 days of data from 1 July 2026: the last day is day 99, 8 October 2026
const dist = (last_unusual: string | null, critical: [number, number][] | null, above = last_unusual ? 1 : 0) =>
  ({ h: Array(100).fill(0), above_p90_days: above, last_unusual, critical })
const nrt = (districts: NrtSeason['districts']): NrtSeason =>
  ({ updated_at: '', provisional: true, season: '2026-27', day0: '2026-07-01', national: { h: [], split: [] }, districts })

describe('warningsFor', () => {
  it('ranks unusual, then critical now, then starting soon, then clear', () => {
    const r = warningsFor(nrt({
      clear: dist(null, [[200, 220]]),
      soon: dist(null, [[113, 130]]),            // 14 days away
      now: dist(null, [[90, 130]]),
      old: dist('2026-09-24', null, 3),          // 14 days before the last day: no longer recent
      recent: dist('2026-09-25', null, 1),       // 13 days before
      today: dist('2026-10-08', null, 1),
    }), null)
    expect(r.map((w) => [w.id, w.level])).toEqual([
      ['today', 'unusual'], ['recent', 'unusual'], ['now', 'critical'], ['soon', 'soon'], ['old', 'clear'], ['clear', 'clear']])
    expect(r.find((w) => w.id === 'recent')?.daysSince).toBe(13)
    expect(r.find((w) => w.id === 'soon')?.critical).toEqual({ start: '2026-10-22', end: '2026-11-08', daysUntil: 14 })
  })
  it('reads the outlook only when it ships, with recent from last_unusual', () => {
    const o: Outlook = {
      rule: '', start: '07-01', step_days: 7, window_days: 14, weeks: 20,
      backtest: { seasons: '', n: 0, n_districts: 0, baseline: '', base_rate: 0, brier_skill: { p50: 0.1, lo: 0.05, hi: 0.2 } }, ships: true,
      districts: { a: { clim: Array(20).fill(0.2), if_recent: Array(20).fill(0.6), if_quiet: Array(20).fill(0.1) } },
    }
    const n = nrt({ a: dist('2026-10-01', null) })
    expect(warningsFor(n, o)[0].outlook).toMatchObject({ state: 'on', p: 0.6, recent: true })
    expect(warningsFor(n, { ...o, ships: false })[0].outlook).toBeNull()
  })
  it('works on older live files without the warning fields', () => {
    const r = warningsFor(nrt({ a: { h: [0, 1], above_p90_days: 2 } }), null)
    expect(r[0]).toMatchObject({ level: 'clear', daysSince: null, critical: null, unusualDays: 2 })
  })
})
