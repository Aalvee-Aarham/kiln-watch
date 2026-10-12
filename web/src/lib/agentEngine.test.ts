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
    expect(res.news[0].title).toContain('Shifting Cultivation')
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
})
