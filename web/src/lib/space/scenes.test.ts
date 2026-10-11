import { describe, expect, it } from 'vitest'
import { orbitsFor, passColumns, passesFor, seasonColumns } from './scenes'
import type { DayPass, SeasonFires } from './fires'

const RAMP = ['#1', '#2', '#3', '#4', '#5']
const bin = (lat: number, lon: number, key = 1) => ({ key, lat, lon })

describe('scene builders', () => {
  it('a pass lights its fires only once the satellite has gone over, then they fade', () => {
    const day = Date.UTC(2024, 0, 15), orbits = orbitsFor(day, 23.6, 90.4), passes = passesFor(orbits, day, 23.6, 90.4)
    const aquaDay = passes.find((p) => p.sat === 'A' && p.pass === 'D')!
    const groups: DayPass[] = [{ sensor: 'A', pass: 'D', total: 2, bins: [{ bin: bin(23.65, 90.45), n: 2 }] }]
    expect(passColumns(groups, passes, aquaDay.t_utc - 1, RAMP)).toHaveLength(0)
    const now = passColumns(groups, passes, aquaDay.t_utc, RAMP)
    expect(now).toHaveLength(1); expect(now[0].glow).toBe(1)
    expect(passColumns(groups, passes, aquaDay.t_utc + 3 * 3_600_000, RAMP)[0].glow).toBe(0)
  })

  it('every satellite has one day and one night pass, in time order', () => {
    const day = Date.UTC(2024, 0, 15), p = passesFor(orbitsFor(day, 23.6, 90.4), day, 23.6, 90.4)
    expect(p).toHaveLength(10)
    for (let i = 1; i < p.length; i++) expect(p[i].t_utc).toBeGreaterThanOrEqual(p[i - 1].t_utc)
  })

  it('season columns: the biggest square reaches the full height and the top of the ramp', () => {
    const sf: SeasonFires = { season: '2019-20', day0: 0, n_days: 3, total: 5, bins: [bin(23, 90, 1), bin(24, 91, 2)],
      daily: [{ bin: [0], n: [1] }, { bin: [0, 1], n: [3, 1] }, { bin: [], n: [] }] }
    const cols = seasonColumns(sf, 2, RAMP, 4, 100)
    expect(cols[0].height_km).toBeCloseTo(100, 9); expect(cols[0].color).toBe('#5')
    expect(cols[1].height_km).toBeCloseTo(50, 9)  // √(1/4) of the height
    expect(cols[1].color).toBe('#3')              // and √(1/4) of the way up the ramp
    expect(seasonColumns(sf, -1, RAMP, 4)).toHaveLength(0)
  })
})
