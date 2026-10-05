import { describe, expect, it } from 'vitest'
import cases from '../../../tests/fixtures/grid_cases.json'
import { dateToDay, dayIso, seasonDay, seasonOf } from './days'

describe('days', () => {
  it('round-trips day index and date', () => {
    for (const d of [0, 1, 365, 3469, 8000]) expect(dateToDay(dayIso(d))).toBe(d)
    expect(dayIso(0)).toBe('2003-01-01')
  })
  it('season labels match Python season_of', () => {
    expect(seasonOf(new Date('2018-06-30T00:00:00Z'))).toBe('2017-18')
    expect(seasonOf(new Date('2018-07-01T00:00:00Z'))).toBe('2018-19')
    expect(seasonDay(new Date('2018-07-01T00:00:00Z'))).toBe(0)
  })
  it('reads the shared Python fixture', () => expect(cases.cases.length).toBeGreaterThan(1))
})
