import { describe, expect, it } from 'vitest'
import { outlookFor } from './outlook'
import type { NrtSeason, Outlook } from './types'

const o: Outlook = {
  rule: '', start: '11-01', step_days: 7, window_days: 14, weeks: 3,
  backtest: { seasons: '', n: 0, n_districts: 0, baseline: '', base_rate: 0, brier_skill: { p50: 0.08, lo: 0.06, hi: 0.1 } }, ships: true,
  districts: { D1: { clim: [0.2, 0.3, 0.4], if_recent: [0.5, 0.6, 0.7], if_quiet: [0.1, 0.2, 0.3] } },
}
const p90 = Array(366).fill(1)
// season 2026-27 starts 1 July; 1 Nov 2026 is day 123 of the season
const nrt = (days: number, unusualAt: number[] = []): NrtSeason => ({
  updated_at: '', provisional: true, season: '2026-27', day0: '2026-07-01',
  national: { h: [], split: [] }, districts: { D1: { h: Array.from({ length: days }, (_, i) => (unusualAt.includes(i) ? 2 : 0.5)), above_p90_days: 0 } },
})

describe('outlookFor', () => {
  it('is closed before the window opens on 1 November', () => {
    expect(outlookFor(o, 'D1', nrt(122), p90)).toEqual({ state: 'before', opens: '1 November' })
  })
  it('reads week 0 on 1 November, quiet and recent', () => {
    expect(outlookFor(o, 'D1', nrt(124), p90)).toMatchObject({ state: 'on', p: 0.1, clim: 0.2, recent: false, asOf: '2026-11-01' })
    expect(outlookFor(o, 'D1', nrt(124, [110]), p90)).toMatchObject({ p: 0.5, recent: true }) // day 110 is within the last 14 days
    expect(outlookFor(o, 'D1', nrt(124, [109]), p90)).toMatchObject({ p: 0.1, recent: false }) // day 109 is 15 days back
  })
  it('moves one row per week and closes after the last week', () => {
    expect(outlookFor(o, 'D1', nrt(124 + 7), p90)).toMatchObject({ clim: 0.3 })
    expect(outlookFor(o, 'D1', nrt(124 + 21), p90)?.state).toBe('after')
  })
  it('has no answer for a district without a row or live data', () => {
    expect(outlookFor(o, 'D2', nrt(124), p90)).toBeNull()
  })
})
