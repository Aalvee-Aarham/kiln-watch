import { describe, it, expect } from 'vitest'
import { parseUserQuery, stageCells } from './agentEngine'
import { seasonToDateRatio } from './calendar'
import { unsupportedNumbers } from './geminiPrompt'
import { EVENTS, NRT, stageData } from './testdata/stage'

// Expected values are properties of the inline synthetic data (testdata/stage.ts), never typed-in sample figures.
describe('agentEngine', () => {
  it('resolves the flagship Punjab, India query with steps; outside Bangladesh nothing is measured yet', () => {
    const res = parseUserQuery('Is this fire season in Punjab, India unusual?', { events: EVENTS })
    expect(res.locationName).toBe('Punjab, India')
    expect(res.measured).toBe(false)
    expect(res.multiplier).toBeNull()
    expect(res.chartData).toEqual([])
    expect(res.headline).toContain('Amendment 5')
    expect(res.steps).toHaveLength(4)
    expect(res.steps.map((s) => s.title)).toEqual(['Draw area', 'Fetch NASA FIRMS', 'Harmonize', 'Compare with 23 years'])
    expect(res.steps[0].detail).toContain('Punjab, India')
    expect(res.steps.slice(1).every((s) => s.status === 'pending')).toBe(true)
    expect(res.news.length).toBeGreaterThan(0) // dated events, each with its source
  })

  it('resolves the Chittagong Hill Tracts jhum query to Bandarban and names the other hill districts', () => {
    const res = parseUserQuery('What is the fire situation with jhum in Chittagong Hill Tracts?', stageData('BD2003', 'Bandarban', ['Rangamati', 'Khagrachhari']))
    expect(res.locationName).toContain('Bandarban')
    expect(res.detailsText).toContain('Rangamati')
    expect(res.criticalWeeks).toContain('BUSIEST MONTHS')
  })

  it('detects history intent when asked about previous news', () => {
    const res = parseUserQuery('Was there any fire news in Punjab previously?', { events: EVENTS })
    expect(res.queryType).toBe('history')
    expect(res.news.length).toBeGreaterThan(0)
  })

  it('resolves Dhaka district correctly with distinct mapFocus coordinates', () => {
    const res = parseUserQuery('Tell me about fire in Dhaka', stageData('BD3026', 'Dhaka'))
    expect(res.locationName).toContain('Dhaka')
    expect(res.sources).toContain('calendar/BD3026.json')
    expect(res.mapFocus!.targetX).toBeGreaterThan(700) // Eastern side of South Asia
    expect(res.mapFocus!.targetY).toBeGreaterThan(200)
  })

  it('calculates distinct mapFocus for Punjab vs Dhaka', () => {
    const punjab = parseUserQuery('Is Punjab burning?')
    const dhaka = parseUserQuery('Is Dhaka burning?')
    expect(punjab.mapFocus!.targetX).not.toEqual(dhaka.mapFocus!.targetX)
    expect(punjab.mapFocus!.targetY).not.toEqual(dhaka.mapFocus!.targetY)
  })

  it('resolves any of the 64 Bangladesh districts properly (e.g. Bogura, Dinajpur, Cumilla, Barishal, Sylhet)', () => {
    const bogura = parseUserQuery('Tell me about agricultural fires in Bogura', stageData('BD5010', 'Bogura'))
    expect(bogura.locationName).toContain('Bogura, Bangladesh')
    expect(bogura.chartData.length).toBe(12) // July to June
    expect(bogura.coordinates![0]).toBeCloseTo(89.37, 1)
    expect(parseUserQuery('Is burning high in Dinajpur right now?').locationName).toContain('Dinajpur, Bangladesh')
    expect(parseUserQuery('Show brick kiln fires in Cumilla').locationName).toContain('Cumilla, Bangladesh')
    expect(parseUserQuery('Check fires in Barishal').locationName).toContain('Barishal, Bangladesh')
    expect(parseUserQuery('Is Sylhet experiencing haor fires?').locationName).toContain('Sylhet, Bangladesh')
  })

  it('resolves Southeast Asian (SEA) countries properly (e.g. Myanmar, Thailand, Vietnam, Indonesia)', () => {
    const myanmar = parseUserQuery('Show forest and crop burning in Myanmar')
    expect(myanmar.locationName).toContain('Myanmar')
    expect(myanmar.criticalWeeks).toBe('NOT MEASURED YET')
    expect(myanmar.multiplier).toBeNull()
    expect(parseUserQuery('What is the sugarcane fire season in Thailand?').locationName).toContain('Thailand')
    expect(parseUserQuery('Check Mekong delta rice stubble fires in Vietnam').locationName).toContain('Vietnam')
    const indonesia = parseUserQuery('Show peatland burning in Indonesia')
    expect(indonesia.locationName).toContain('Indonesia')
    expect(indonesia.multiplier).toBeNull()
  })

  it('resolves Indian states across the continent (e.g. Uttar Pradesh, Maharashtra, Rajasthan)', () => {
    expect(parseUserQuery('Show crop burning in Uttar Pradesh').locationName).toContain('Uttar Pradesh, India')
    expect(parseUserQuery('Check sugarcane burning in Maharashtra').locationName).toContain('Maharashtra, India')
    expect(parseUserQuery('Tell me about farm fires in Rajasthan').locationName).toContain('Rajasthan, India')
  })

  it('resolves Shundarbans spelling and distinguishes Beijing from China country profile', () => {
    const sundar = parseUserQuery('Shundarbans')
    expect(sundar.locationName).toContain('Sundarbans')
    expect(sundar.coordinates![0]).toBeCloseTo(89.5, 1)
    expect(sundar.coordinates![1]).toBeCloseTo(21.9, 1)
    expect(sundar.bbox![2] - sundar.bbox![0]).toBeLessThan(3) // tight mangrove bbox, not all of India!
    const beijing = parseUserQuery('Beijing')
    expect(beijing.locationName).toContain('Beijing')
    expect(beijing.coordinates![0]).toBeCloseTo(116.4, 1)
    expect(beijing.coordinates![1]).toBeCloseTo(39.9, 1)
    expect(beijing.bbox![2] - beijing.bbox![0]).toBeLessThan(4) // tight city bbox, NOT whole China!
    const china = parseUserQuery('China')
    expect(china.locationName).toContain('China')
    expect(china.bbox![2] - china.bbox![0]).toBeGreaterThan(30) // entire nation
  })
})

describe('agentEngine on real data (synthetic inputs)', () => {
  const data = stageData('BD3026', 'Dhaka')
  const res = parseUserQuery('Is fire in Dhaka above normal this season?', data)
  const live = NRT.districts.BD0000.h

  it('calls a season unusual only by the pre-registered rule (days above the 90th-percentile normal)', () => {
    expect(res.isUnusual).toBe(true) // above_p90_days = 3
    expect(parseUserQuery('Dhaka', { ...data, nrt: { ...data.nrt, districts: { BD3026: { h: live, above_p90_days: 0 } } } }).isUnusual).toBe(false)
  })
  it('the multiplier is the season-to-date ratio, rounded to 1 decimal', () => {
    const r = seasonToDateRatio(data.cal, live, '2006-07')!
    expect(res.multiplier).toBe(Math.round(r * 10) / 10)
    expect(res.multiplier).toBe(2) // 4 this season against 2 in each earlier season on the same day
  })
  it('chartData has 12 months, July first, and no values for months the live season has not reached', () => {
    expect(res.chartData.map((p) => p.label)).toEqual(['JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN'])
    expect(res.chartData[4].season).not.toBeNull()
    expect(res.chartData.slice(5).every((p) => p.season === null)).toBe(true)
    expect(res.chartData.every((p) => p.normalP90 === 3)).toBe(true)
  })
  it('the headline states no number the data did not produce', () => {
    const context = JSON.stringify({ unusual: 3, ratio: res.multiplier, season: '2006-07', seasons: ['2003-04', '2005-06'] })
    expect(unsupportedNumbers(res.headline, context)).toEqual([])
    expect(res.headline).not.toMatch(/1\.7|1\.4×/)
  })
  it('records: the area own complete seasons first, every record with a link', () => {
    expect(res.news.slice(0, 3).map((n) => n.title)).toEqual(['2005-06: 1 unusual day', '2004-05: 0 unusual days', '2003-04: 0 unusual days'])
    expect(res.news.every((n) => n.url.length > 0)).toBe(true)
  })
  it('all four steps are complete once the files are loaded', () => {
    expect(res.steps.every((s) => s.status === 'completed')).toBe(true)
    expect(res.steps[2].detail).toContain('97%') // 1 − seam ratio 0.03
  })
})

describe('stage map cells (real grid detections)', () => {
  const meta = { grid: { origin_lat: 0, origin_lon: 0, step: 1, rows: 10, cols: 10 } } as unknown as Parameters<typeof stageCells>[1]
  const sq: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]]] }
  const tile = { tile: 't', day0: '2003-01-01', rows: [[11, 100, 2], [11, 101, 4], [22, 100, 2], [22, 50, 2], [88, 100, 2]] as [number, number, number][] }
  it('one dot per distinct cell inside the area from the given day; reports the last grid day', () => {
    const r = stageCells([tile], meta, sq, 60, 3000)
    expect(r.cells).toEqual([{ lat: 1.5, lon: 1.5 }, { lat: 2.5, lon: 2.5 }]) // cell 88 is outside; day 50 is too early
    expect(r.total).toBe(2)
    expect(r.lastDay).toBe(101)
  })
  it('caps the dots at the given maximum and still counts them all', () => {
    const r = stageCells([tile], meta, sq, 0, 1)
    expect(r.cells).toHaveLength(1)
    expect(r.total).toBe(2)
  })
})

describe('stage status and honest headlines (final review fixes)', () => {
  it('a Bangladesh place still loading is "loading", not "not measured"; a failed file is an error', () => {
    const loading = parseUserQuery('Is fire in Dhaka above normal right now?', { events: EVENTS })
    expect(loading.status).toBe('loading')
    const failed = parseUserQuery('Is fire in Dhaka above normal right now?', { events: EVENTS, failed: ['calendar/BD3026.json'] })
    expect(failed.status).toBe('error')
    expect(failed.headline).toContain('Could not load calendar/BD3026.json')
    expect(parseUserQuery('Punjab').status).toBe('outside')
    expect(parseUserQuery('Dhaka', stageData('BD3026', 'Dhaka')).status).toBe('measured')
  })
  it('a place shown through one of its districts says so in the headline', () => {
    const res = parseUserQuery('Shundarbans', stageData('BD4001', 'Bagerhat', ['Khulna', 'Satkhira']))
    expect(res.headline.startsWith('Figures for Bagerhat district: ')).toBe(true)
    expect(parseUserQuery('Dhaka', stageData('BD3026', 'Dhaka')).headline.startsWith('Figures for')).toBe(false)
  })
})
