import { describe, expect, it } from 'vitest'
import cases from '../../../../tests/fixtures/grid_cases.json'
import { cellId } from '../box'
import { dateToDay } from '../days'
import type { GridTile } from '../types'
import { BIN_DEG, binOf, busiestDay, dailyTotals, dayPasses, decodeSensorPass, monthlyCentres, rankDays, replayAt, SeasonReplay, seasonFires, seasonsIn, seasonTotals } from './fires'

const meta = { grid: cases.grid }
const A_DAY = 2, A_NIGHT = 3, N_DAY = 4, N_NIGHT = 5   // sensor index × 2 + night
const c = (lat: number, lon: number) => cellId(meta, lat, lon)
const d = (iso: string) => dateToDay(iso)
const tile = (rows: [number, number, number][]): GridTile => ({ tile: 'test', day0: '2003-01-01', rows })

// Two cells in one 0.1° square (23.71–23.72 N), one cell in the square to the north, across three dates.
const a1 = c(23.715, 90.405), a2 = c(23.755, 90.455), b1 = c(23.815, 90.405)
const TILES = [tile([
  [a1, d('2019-11-01'), A_DAY], [a1, d('2019-11-01'), N_DAY], [a1, d('2019-11-01'), N_NIGHT], // one cell-day seen three times
  [a2, d('2019-11-01'), A_NIGHT],
  [b1, d('2019-12-10'), N_DAY], [b1, d('2019-12-11'), N_DAY],
  [a1, d('2019-06-30'), A_DAY],                                                         // previous season
  [a1, d('2020-07-01'), A_DAY],                                                         // next season
])]

describe('fire bins', () => {
  it('decodes sensor and pass as the pipeline encodes them', () => {
    expect(decodeSensorPass(A_DAY)).toEqual({ sensor: 'A', pass: 'D' })
    expect(decodeSensorPass(N_NIGHT)).toEqual({ sensor: 'N', pass: 'N' })
  })

  it('cells in one 0.1° square share a bin; the bin centre is within half a bin of each cell', () => {
    expect(binOf(meta, a1).key).toBe(binOf(meta, a2).key)
    expect(binOf(meta, b1).key).not.toBe(binOf(meta, a1).key)
    const b = binOf(meta, a1)
    expect(Math.abs(b.lat - 23.715)).toBeLessThanOrEqual(BIN_DEG / 2)
    expect(Math.abs(b.lon - 90.405)).toBeLessThanOrEqual(BIN_DEG / 2)
    expect(b.lat).toBeCloseTo(23.75, 9); expect(b.lon).toBeCloseTo(90.45, 9)
  })

  it('seasons run 1 July – 30 June', () => {
    expect(seasonsIn(TILES)).toEqual(['2018-19', '2019-20', '2020-21'])
  })

  it('counts each cell-day once, keeps the season, and splits day and night passes', () => {
    const all = seasonFires(TILES, meta, '2019-20')
    expect(all.total).toBe(4)                     // a1·1 Nov, a2·1 Nov, b1·10 Dec, b1·11 Dec
    expect(all.n_days).toBe(366)                  // July 2019 – June 2020 includes 29 Feb
    expect(seasonFires(TILES, meta, '2019-20', 'D').total).toBe(3)
    expect(seasonFires(TILES, meta, '2019-20', 'N').total).toBe(2)
    expect(Array.from(seasonTotals(all)).reduce((s, x) => s + x, 0)).toBe(all.total)
  })

  it('replay accumulates by day and keeps a trailing window', () => {
    const sf = seasonFires(TILES, meta, '2019-20')
    const dec10 = d('2019-12-10') - sf.day0
    const sum = (a: Float32Array) => Array.from(a).reduce((s, x) => s + x, 0)
    expect(sum(replayAt(sf, dec10 - 1).cum)).toBe(2)
    expect(sum(replayAt(sf, dec10).cum)).toBe(3)
    expect(sum(replayAt(sf, dec10 + 1, 1).recent)).toBe(1)
    expect(sum(replayAt(sf, dec10 + 1, 7).recent)).toBe(2)
    expect(sum(replayAt(sf, sf.n_days + 50).cum)).toBe(4)
  })

  it('monthly centres are fire-weighted means of bin centres', () => {
    const m = monthlyCentres(seasonFires(TILES, meta, '2019-20'))
    expect(m[0]).toBeNull()                       // July
    expect(m[4]!.n).toBe(2)                        // November: two fire-days in one bin
    expect(m[4]!.lat).toBeCloseTo(binOf(meta, a1).lat, 9)
    expect(m[5]!.lat).toBeCloseTo(binOf(meta, b1).lat, 9)
  })

  it('splits one date by satellite and pass', () => {
    const p = dayPasses(TILES, meta, d('2019-11-01'))
    expect(p.map((x) => `${x.sensor}${x.pass}:${x.total}`)).toEqual(['AD:1', 'AN:1', 'ND:1', 'NN:1'])
  })

  it('the busiest day prefers a date seen by both a day and a night pass', () => {
    expect(busiestDay(TILES)).toBe(d('2019-11-01'))
    const dayOnly = [tile([[a1, 10, A_DAY], [a2, 10, A_DAY], [b1, 10, A_DAY], [a1, 11, A_NIGHT], [a1, 11, A_DAY]])]
    expect(busiestDay(dayOnly)).toBe(11)
    expect(rankDays(dayOnly).map((x) => [x.day, x.cells, x.both])).toEqual([[11, 1, true], [10, 3, false]])
    expect(rankDays(dayOnly, 1)).toHaveLength(1)
  })

  it('the stepping replay gives exactly the same numbers as recomputing, forwards, backwards and in jumps', () => {
    const sf = seasonFires(TILES, meta, '2019-20')
    const r = new SeasonReplay(sf, 7)
    const seq = [0, 1, 2, 120, 121, 122, 160, 162, 163, 170, 100, 365, 3, 4]
    for (const d of seq) {
      r.at(d)
      const want = replayAt(sf, d, 7)
      expect(Array.from(r.cum)).toEqual(Array.from(want.cum))
      expect(Array.from(r.recent)).toEqual(Array.from(want.recent))
    }
  })

  it('daily totals add up to the season total', () => {
    const sf = seasonFires(TILES, meta, '2019-20')
    expect(dailyTotals(sf).reduce((s, x) => s + x, 0)).toBe(sf.total)
  })
})
