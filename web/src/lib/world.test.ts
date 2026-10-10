import { describe, expect, it } from 'vitest'
import { boxView, clampView, MAX_W, maxRankFor, MIN_W, parseCities, placeLabels, searchPlaces, visibleCities, zoomView, type City, type Hit } from './world'

const city = (name: string, lat: number, lon: number, rank: number): City => ({ name, nameBn: name, lat, lon, rank, pop: null, adm0: 'X', adm1: null, capital: false })

describe('world map view', () => {
  it('fits a box whole, centred, in the frame shape', () => {
    const v = boxView([60, 3, 98, 39], 0.5, 1) // 38° wide, 36° tall, frame twice as wide as tall
    expect(v.w).toBe(72) // height-limited: 36 / 0.5
    expect(v.h).toBe(36)
    expect(v.x + v.w / 2).toBe(79) // centre longitude
    expect(-(v.y + v.h / 2)).toBe(21) // centre latitude
  })
  it('limits zoom and keeps the centre on the globe', () => {
    expect(clampView({ x: 0, y: 0, w: 0.01, h: 0.01 }, 1).w).toBe(MIN_W)
    expect(clampView({ x: 0, y: 0, w: 1e4, h: 1e4 }, 1).w).toBe(MAX_W)
    const far = clampView({ x: 500, y: 0, w: 10, h: 10 }, 1)
    expect(far.x + far.w / 2).toBe(190)
  })
  it('zooms about a point that stays put', () => {
    const v = { x: 0, y: 0, w: 40, h: 20 }
    const z = zoomView(v, 2, 30, 10, 0.5)
    expect(z.w).toBe(20)
    expect((30 - z.x) / z.w).toBeCloseTo((30 - v.x) / v.w) // same fraction across the frame
  })
})

describe('cities', () => {
  it('names more cities as the view narrows', () => {
    expect([maxRankFor(360), maxRankFor(100), maxRankFor(40), maxRankFor(20), maxRankFor(5)]).toEqual([1, 3, 5, 7, 10])
  })
  it('draws only cities in view, important enough, and at most the cap', () => {
    const cs = [city('A', 23, 90, 0), city('B', 23, 91, 6), city('C', 50, 10, 0), ...Array.from({ length: 10 }, (_, i) => city(`D${i}`, 22, 89, 1))]
    const v = { x: 80, y: -30, w: 20, h: 20 } // 80–100°E, 10–30°N; width 20 → rank ≤ 7
    expect(visibleCities(cs, v).map((c) => c.name)).toEqual(['A', 'B', ...Array.from({ length: 10 }, (_, i) => `D${i}`)])
    expect(visibleCities(cs, { ...v, w: 40, h: 40 }).map((c) => c.name)).not.toContain('B') // width 40 → rank ≤ 5
    expect(visibleCities(cs, v, 3)).toHaveLength(3)
  })
  it('names a city only where its label does not collide with a more important one', () => {
    const big = city('Delhi', 28.6, 77.2, 1), near = city('Ghaziabad', 28.65, 77.3, 5), far = city('Agra', 27.2, 78.0, 5)
    const deg = 0.01 // a degree is 100 px: Ghaziabad's label would sit on Delhi's, Agra's is well clear
    expect(placeLabels([big, near, far], deg).map((c) => c.name)).toEqual(['Delhi', 'Agra'])
    expect(placeLabels([big, near, far], deg, near).map((c) => c.name)).toEqual(['Ghaziabad', 'Agra']) // the picked city wins its spot
    expect(placeLabels([big, near, far], 0.0001).map((c) => c.name)).toEqual(['Delhi', 'Ghaziabad', 'Agra']) // zoomed in, all fit
  })
  it('reads the published record format', () => {
    const [c] = parseCities({ fields: ['name_en', 'name_bn', 'lat', 'lon', 'rank', 'pop', 'adm0', 'adm1', 'capital'], rows: [['Dhaka', 'ঢাকা', 23.725, 90.407, 2, 12797394, 'BGD', 'Dhaka', 1]] })
    expect(c).toMatchObject({ name: 'Dhaka', nameBn: 'ঢাকা', lat: 23.725, lon: 90.407, capital: true, pop: 12797394 })
  })
})

describe('search', () => {
  const hit = (name: string, nameBn = name): Hit => ({ kind: 'city', id: name, name, nameBn, sub: '' })
  it('puts names that start with the text first, and finds Bangla names', () => {
    const es = [hit('New Delhi'), hit('Delhi'), hit('Dhaka', 'ঢাকা')]
    expect(searchPlaces(es, 'del').map((h) => h.name)).toEqual(['Delhi', 'New Delhi'])
    expect(searchPlaces(es, 'ঢাকা').map((h) => h.name)).toEqual(['Dhaka'])
    expect(searchPlaces(es, 'd')).toEqual([]) // one letter is too little to search on
  })
  it('ranks exact names first, then the more important kind of place', () => {
    const es: Hit[] = [
      { kind: 'city', id: 'pune', name: 'Pune', nameBn: 'পুনে', sub: '', weight: 2.3 },
      { kind: 'city', id: 'punta', name: 'Punta Arenas', nameBn: 'পুন্তা', sub: '', weight: 2.5 },
      { kind: 'state', id: 'pb-in', name: 'Punjab', nameBn: 'পাঞ্জাব', sub: '', weight: 1 },
      { kind: 'city', id: 'dhaka', name: 'Dhaka', nameBn: 'ঢাকা', sub: '', weight: 2.2 },
      { kind: 'state', id: 'dhaka-div', name: 'Dhaka', nameBn: 'ঢাকা বিভাগ', sub: '', weight: 1 },
    ]
    expect(searchPlaces(es, 'pun').map((h) => h.id)).toEqual(['pb-in', 'pune', 'punta'])
    expect(searchPlaces(es, 'pune').map((h) => h.id)).toEqual(['pune']) // exact beats everything
    expect(searchPlaces(es, 'dhaka').map((h) => h.id)).toEqual(['dhaka-div', 'dhaka']) // both exact: the state first
  })
})
