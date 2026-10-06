import { describe, expect, it } from 'vitest'
import { harvestSpans, rituOf, rituSpans } from './ritu'
import { seasonVerdict } from './calendar'
import { dateToDay } from './days'
import type { Calendar } from './types'

const d = (s: string) => new Date(s + 'T00:00:00Z')

describe('ritu', () => {
  it('maps dates to the revised Bangladesh calendar seasons', () => {
    expect(rituOf(d('2020-04-14')).key).toBe('grishma') // Pohela Boishakh
    expect(rituOf(d('2020-04-13')).key).toBe('basanta')
    expect(rituOf(d('2020-11-20')).key).toBe('hemanta')
    expect(rituOf(d('2021-01-10')).key).toBe('sheet')
    expect(rituOf(d('2021-12-31')).key).toBe('sheet')
  })
  it('tiles the 366-day axis without gaps in both layouts', () => {
    for (const layout of ['cal', 'season'] as const) {
      const s = rituSpans(layout)
      expect(s[0].x0).toBe(0); expect(s.at(-1)!.x1).toBe(366)
      for (let i = 1; i < s.length; i++) expect(s[i].x0).toBe(s[i - 1].x1)
    }
    // season axis starts 1 July, inside Barsha
    expect(rituSpans('season')[0].ritu.key).toBe('barsha')
  })
  it('shifts harvest windows onto the season axis (1 July = 0)', () => {
    const ev = { policy: [], harvest: [{ crop: 'boro', start_doy: 183, end_doy: 183, url: '' }] }
    expect(harvestSpans(ev, 'season')).toEqual([{ crop: 'boro', x0: 0, x1: 1 }])
    expect(harvestSpans(ev, 'cal')).toEqual([{ crop: 'boro', x0: 182, x1: 183 }])
  })
})

describe('seasonVerdict', () => {
  const base = { days: [], h: [], raw: {}, split: [], nodata: [], normal: { p10: [], p50: [], p90: [] }, critical: [], seasons: [] }
  it('counts unusual days in the season and names the dominant ritu', () => {
    const unusual = ['2020-11-01', '2020-11-20', '2021-01-05', '2021-08-01'].map((s) => dateToDay(s))
    const cal = { ...base, unusual, nodata: [[dateToDay('2020-07-10'), dateToDay('2020-07-14')]] } as unknown as Calendar
    const v = seasonVerdict(cal, '2020-21')
    expect(v.unusual).toBe(3) // 2021-08-01 belongs to 2021-22
    expect(v.ritu?.key).toBe('hemanta')
    expect(v.notObserved).toBe(5)
  })
  it('says so plainly when nothing was unusual', () => {
    const v = seasonVerdict({ ...base, unusual: [] } as unknown as Calendar, '2019-20')
    expect(v.unusual).toBe(0)
    expect(v.text).toMatch(/within the normal range/)
  })
})
