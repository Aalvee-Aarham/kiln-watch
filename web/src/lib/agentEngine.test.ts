import { describe, it, expect } from 'vitest'
import { parseUserQuery } from './agentEngine'

describe('agentEngine', () => {
  it('resolves the flagship Punjab, India query with 2.1x multiplier and steps', () => {
    const res = parseUserQuery('Is this fire season in Punjab, India unusual?')
    expect(res.locationName).toBe('Punjab, India')
    expect(res.multiplier).toBe(2.1)
    expect(res.isUnusual).toBe(true)
    expect(res.headline).toContain('Yes, 2.1× the normal')
    expect(res.steps).toHaveLength(4)
    expect(res.steps[0].title).toBe('Draw area')
    expect(res.steps[0].detail).toBe('Punjab, India')
    expect(res.steps[1].title).toBe('Fetch NASA FIRMS')
    expect(res.steps[2].title).toBe('Harmonize')
    expect(res.steps[3].title).toBe('Compare with 23 years')
    expect(res.chartData.length).toBeGreaterThan(0)
    expect(res.news.length).toBeGreaterThan(0)
  })

  it('resolves Chittagong Hill Tracts jhum query', () => {
    const res = parseUserQuery('What is the fire situation with jhum in Chittagong Hill Tracts?')
    expect(res.locationName).toContain('Chittagong Hill Tracts')
    expect(res.criticalWeeks).toContain('JHUM BURNING')
    expect(res.news[0].title).toContain('Chittagong Hill Tracts Account for 88%')
  })

  it('detects history intent when asked about previous news', () => {
    const res = parseUserQuery('Was there any fire news in Punjab previously?')
    expect(res.queryType).toBe('history')
    expect(res.news.length).toBeGreaterThan(0)
  })

  it('resolves Dhaka district correctly with distinct mapFocus coordinates', () => {
    const res = parseUserQuery('Tell me about fire in Dhaka')
    expect(res.locationName).toContain('Dhaka')
    expect(res.sources).toBe('SOURCES: NASA FIRMS · MODIS · VIIRS')
    expect(res.mapFocus.targetX).toBeGreaterThan(700) // Eastern side of South Asia
    expect(res.mapFocus.targetY).toBeGreaterThan(200)
  })

  it('calculates distinct mapFocus for Punjab vs Dhaka', () => {
    const punjab = parseUserQuery('Is Punjab burning?')
    const dhaka = parseUserQuery('Is Dhaka burning?')
    expect(punjab.mapFocus.targetX).not.toEqual(dhaka.mapFocus.targetX)
    expect(punjab.mapFocus.targetY).not.toEqual(dhaka.mapFocus.targetY)
  })

  it('resolves any of the 64 Bangladesh districts properly (e.g. Bogura, Dinajpur, Cumilla, Barishal, Sylhet)', () => {
    const bogura = parseUserQuery('Tell me about agricultural fires in Bogura')
    expect(bogura.locationName).toContain('Bogura, Bangladesh')
    expect(bogura.chartData.length).toBe(8)
    expect(bogura.coordinates[0]).toBeCloseTo(89.37, 1)

    const dinajpur = parseUserQuery('Is burning high in Dinajpur right now?')
    expect(dinajpur.locationName).toContain('Dinajpur, Bangladesh')

    const cumilla = parseUserQuery('Show brick kiln fires in Cumilla')
    expect(cumilla.locationName).toContain('Cumilla, Bangladesh')

    const barishal = parseUserQuery('Check fires in Barishal')
    expect(barishal.locationName).toContain('Barishal, Bangladesh')

    const sylhet = parseUserQuery('Is Sylhet experiencing haor fires?')
    expect(sylhet.locationName).toContain('Sylhet, Bangladesh')
  })

  it('resolves Southeast Asian (SEA) countries properly (e.g. Myanmar, Thailand, Vietnam, Indonesia)', () => {
    const myanmar = parseUserQuery('Show forest and crop burning in Myanmar')
    expect(myanmar.locationName).toContain('Myanmar')
    expect(myanmar.criticalWeeks).toContain('DRY SEASON CLEARING')
    expect(myanmar.multiplier).toBeGreaterThanOrEqual(1.5)

    const thailand = parseUserQuery('What is the sugarcane fire season in Thailand?')
    expect(thailand.locationName).toContain('Thailand')

    const vietnam = parseUserQuery('Check Mekong delta rice stubble fires in Vietnam')
    expect(vietnam.locationName).toContain('Vietnam')

    const indonesia = parseUserQuery('Show peatland burning in Indonesia')
    expect(indonesia.locationName).toContain('Indonesia')
    expect(indonesia.multiplier).toBe(2.3)
  })

  it('resolves Indian states across the continent (e.g. Uttar Pradesh, Maharashtra, Rajasthan)', () => {
    const up = parseUserQuery('Show crop burning in Uttar Pradesh')
    expect(up.locationName).toContain('Uttar Pradesh, India')

    const maha = parseUserQuery('Check sugarcane burning in Maharashtra')
    expect(maha.locationName).toContain('Maharashtra, India')

    const raj = parseUserQuery('Tell me about farm fires in Rajasthan')
    expect(raj.locationName).toContain('Rajasthan, India')
  })
})
