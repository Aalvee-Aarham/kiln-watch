import { describe, expect, it } from 'vitest'
import { farmYear, fromMonth, windowMonths } from './farm'

describe('farm year', () => {
  it('windowMonths lists the calendar months a day-of-year window covers, across New Year too', () => {
    expect(windowMonths(305, 365)).toEqual([11, 12])
    expect(windowMonths(91, 151)).toEqual([4, 5])
    expect(windowMonths(335, 31)).toEqual([12, 1])
  })
  it('maps busy season months (0 = July) to calendar months, marks the peak and the month before', () => {
    const y = farmYear([], { first: 4, last: 7, peak: 5 }) // November to February, peak December
    expect(y.filter((m) => m.fire).map((m) => m.month)).toEqual([1, 2, 11, 12])
    expect(y.find((m) => m.fire === 2)?.month).toBe(12)
    expect(y.filter((m) => m.prepare).map((m) => m.month)).toEqual([10])
  })
  it('puts each harvest in its months and nowhere else', () => {
    const y = farmYear([{ name: 'Boro rice', months: [4, 5] }, { name: 'Wheat', months: [4] }], null)
    expect(y[3].harvests).toEqual(['Boro rice', 'Wheat'])
    expect(y[4].harvests).toEqual(['Boro rice'])
    expect(y.flatMap((m) => m.harvests)).toHaveLength(3)
  })
  it('has no fire or get-ready month without fire data, and no get-ready month when fire fills the year', () => {
    expect(farmYear([], null).some((m) => m.fire || m.prepare)).toBe(false)
    expect(farmYear([], { first: 0, last: 11, peak: 3 }).some((m) => m.prepare)).toBe(false)
  })
  it('fromMonth starts the year at the given month and keeps all twelve', () => {
    const y = farmYear([], null)
    expect(fromMonth(y, 11).map((m) => m.month)).toEqual([11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(fromMonth(y, 1)).toEqual(y)
  })
})
