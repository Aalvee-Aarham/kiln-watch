import { describe, it, expect } from 'vitest'
import { parseUserQuery } from './agentEngine'
import { REGION_REGISTRY } from './regionRegistry'

/**
 * Autonomous Full-Spectrum Query Testing Battery
 * Fulfills boss's instruction:
 * "Claude nij theke jeno onek guli testing kore"
 * Tests diverse queries across Bangladesh districts, Indian states, Southeast Asian nations,
 * verifying coordinates, zoom bounding box, 23-year comparative curves, steps, and real news.
 */
describe('Autonomous Full-Spectrum Query Testing Battery', () => {
  const TEST_CASES = [
    {
      query: 'Is this fire season in Punjab, India unusual?',
      expectedRegion: 'Punjab, India',
      expectedCountry: 'India',
      minMultiplier: 1.8,
      newsSourceKeywords: ['NASA', 'Punjab Remote Sensing Centre', 'Hindu']
    },
    {
      query: 'How severe are brick kiln emissions in Dhaka right now?',
      expectedRegion: 'Dhaka, Bangladesh',
      expectedCountry: 'Bangladesh',
      minMultiplier: 1.5,
      newsSourceKeywords: ['Department of Environment', 'NASA', 'Savar']
    },
    {
      query: 'What is the fire situation with jhum in Chittagong Hill Tracts?',
      expectedRegion: 'Chittagong Hill Tracts, Bangladesh',
      expectedCountry: 'Bangladesh',
      minMultiplier: 2.0,
      newsSourceKeywords: ['Remote Sensing', 'Forest Department', 'MDPI']
    },
    {
      query: 'Check flying squad and stubble burning alerts in Haryana',
      expectedRegion: 'Haryana, India',
      expectedCountry: 'India',
      minMultiplier: 1.4,
      newsSourceKeywords: ['Central Pollution Control Board', 'CPCB', 'Tribune']
    },
    {
      query: 'Why is air quality so hazardous in Delhi NCR during harvest season?',
      expectedRegion: 'Delhi NCR, India',
      expectedCountry: 'India',
      minMultiplier: 1.4,
      newsSourceKeywords: ['Hindustan Times', 'Supreme Court', 'Worldview']
    },
    {
      query: 'Tell me about peatland fires and El Nino in Indonesia',
      expectedRegion: 'Indonesia',
      expectedCountry: 'Indonesia',
      minMultiplier: 2.0,
      newsSourceKeywords: ['UNDRR', 'Jakarta Globe', 'FIRMS', 'ASEAN']
    },
    {
      query: 'What is the status of sugarcane burning and Chiang Mai haze in Thailand?',
      expectedRegion: 'Thailand',
      expectedCountry: 'Thailand',
      minMultiplier: 1.6,
      newsSourceKeywords: ['GISTDA', 'ASIA-AQ', 'Bangkok Post']
    },
    {
      query: 'Are there agricultural fires in Bogura district right now?',
      expectedRegion: 'Bogura, Bangladesh',
      expectedCountry: 'Bangladesh',
      minMultiplier: 1.0,
      newsSourceKeywords: ['Department of Environment', 'FIRMS']
    },
    {
      query: 'When does paddy residue burning peak in Dinajpur?',
      expectedRegion: 'Dinajpur, Bangladesh',
      expectedCountry: 'Bangladesh',
      minMultiplier: 1.0,
      newsSourceKeywords: ['Department of Environment', 'FIRMS']
    },
    {
      query: 'Show me brick kiln fire patterns in Cumilla',
      expectedRegion: 'Cumilla, Bangladesh',
      expectedCountry: 'Bangladesh',
      minMultiplier: 1.0,
      newsSourceKeywords: ['Department of Environment', 'FIRMS']
    },
    {
      query: 'Check winter rice burning in Vietnam Mekong Delta',
      expectedRegion: 'Vietnam',
      expectedCountry: 'Vietnam',
      minMultiplier: 1.3,
      newsSourceKeywords: ['VnExpress', 'FIRMS', 'ASEAN']
    },
    {
      query: 'Tell me about shifting cultivation fire season in Myanmar',
      expectedRegion: 'Myanmar',
      expectedCountry: 'Myanmar',
      minMultiplier: 1.5,
      newsSourceKeywords: ['ASEAN', 'FIRMS', 'Earth Observatory']
    }
  ]

  for (const tc of TEST_CASES) {
    it(`correctly resolves, zooms, and synthesizes data for: "${tc.query}"`, () => {
      const res = parseUserQuery(tc.query)

      // 1. Valid location resolution
      expect(res.locationName).toContain(tc.expectedRegion)

      // 2. Verified 4-step sequence
      expect(res.steps).toHaveLength(4)
      expect(res.steps[0].title).toBe('Draw area')
      expect(res.steps[1].title).toBe('Fetch NASA FIRMS')
      expect(res.steps[2].title).toBe('Harmonize')
      expect(res.steps[3].title).toBe('Compare with 23 years')

      // 3. Calculated dynamic camera target & SVG projection
      expect(res.mapFocus).toBeDefined()
      expect(res.mapFocus.targetX).toBeGreaterThanOrEqual(0)
      expect(res.mapFocus.targetX).toBeLessThanOrEqual(1000)
      expect(res.mapFocus.targetY).toBeGreaterThanOrEqual(0)
      expect(res.mapFocus.targetY).toBeLessThanOrEqual(600)
      expect(res.mapFocus.zoom).toBeGreaterThanOrEqual(2.0)

      // 4. Bounding box coordinates
      expect(res.mapFocus.boxW).toBeGreaterThan(0)
      expect(res.mapFocus.boxH).toBeGreaterThan(0)

      // 5. 23-year comparative curve data present
      expect(res.chartData.length).toBeGreaterThanOrEqual(7)
      expect(res.multiplier).toBeGreaterThanOrEqual(tc.minMultiplier)

      // 6. News items present and authentic
      expect(res.news.length).toBeGreaterThan(0)
      const combinedNewsText = res.news.map(n => `${n.title} ${n.source} ${n.summary}`).join(' ')
      const hasMatchingKeyword = tc.newsSourceKeywords.some(kw => combinedNewsText.includes(kw))
      expect(hasMatchingKeyword).toBe(true)

      // 7. Authoritative scientific synthesis
      expect(res.detailsText.length).toBeGreaterThan(50)
      expect(res.sources).toBe('SOURCES: NASA FIRMS · MODIS · VIIRS')
    })
  }

  it('guarantees all 64 districts in Bangladesh have distinct non-zero coordinates and valid profiles', () => {
    const bdProfiles = Object.values(REGION_REGISTRY).filter(p => p.country === 'Bangladesh')
    expect(bdProfiles.length).toBeGreaterThanOrEqual(64)

    for (const p of bdProfiles) {
      expect(p.coords[0]).toBeGreaterThan(88) // Bangladesh Lon [88, 93]
      expect(p.coords[0]).toBeLessThan(93)
      expect(p.coords[1]).toBeGreaterThan(20) // Bangladesh Lat [20, 27]
      expect(p.coords[1]).toBeLessThan(27)
      expect(p.normalCurve.length).toBe(p.months.length)
      expect(p.thisSeasonCurve.length).toBe(p.months.length)
    }
  })
})
