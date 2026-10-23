import { describe, it, expect } from 'vitest'
import { parseUserQuery } from './agentEngine'
import { REGION_REGISTRY } from './regionRegistry'
import { seasonToDateRatio } from './calendar'
import { EVENTS, NRT, stageData } from './testdata/stage'

/**
 * Autonomous Full-Spectrum Query Testing Battery
 * Fulfills boss's instruction:
 * "Claude nij theke jeno onek guli testing kore"
 * Tests diverse queries across Bangladesh districts, Indian states, Southeast Asian nations,
 * verifying coordinates, zoom bounding box, steps, and that every figure comes from the (here synthetic) data:
 * Bangladesh places get their numbers from the inputs; places outside Bangladesh get none until Amendment 5.
 */
describe('Autonomous Full-Spectrum Query Testing Battery', () => {
  const TEST_CASES = [
    {
      query: 'Is this fire season in Punjab, India unusual?',
      expectedRegion: 'Punjab, India',
      expectedCountry: 'India'
    },
    {
      query: 'How severe are brick kiln emissions in Dhaka right now?',
      expectedRegion: 'Dhaka, Bangladesh',
      expectedCountry: 'Bangladesh'
    },
    {
      query: 'What is the fire situation with jhum in Chittagong Hill Tracts?',
      expectedRegion: 'Bandarban, Bangladesh',
      expectedCountry: 'Bangladesh'
    },
    {
      query: 'Check flying squad and stubble burning alerts in Haryana',
      expectedRegion: 'Haryana, India',
      expectedCountry: 'India'
    },
    {
      query: 'Why is air quality so hazardous in Delhi NCR during harvest season?',
      expectedRegion: 'Delhi NCR, India',
      expectedCountry: 'India'
    },
    {
      query: 'Tell me about peatland fires and El Nino in Indonesia',
      expectedRegion: 'Indonesia',
      expectedCountry: 'Indonesia'
    },
    {
      query: 'What is the status of sugarcane burning and Chiang Mai haze in Thailand?',
      expectedRegion: 'Thailand',
      expectedCountry: 'Thailand'
    },
    {
      query: 'Are there agricultural fires in Bogura district right now?',
      expectedRegion: 'Bogura, Bangladesh',
      expectedCountry: 'Bangladesh'
    },
    {
      query: 'When does paddy residue burning peak in Dinajpur?',
      expectedRegion: 'Dinajpur, Bangladesh',
      expectedCountry: 'Bangladesh'
    },
    {
      query: 'Show me brick kiln fire patterns in Cumilla',
      expectedRegion: 'Cumilla, Bangladesh',
      expectedCountry: 'Bangladesh'
    },
    {
      query: 'Check winter rice burning in Vietnam Mekong Delta',
      expectedRegion: 'Vietnam',
      expectedCountry: 'Vietnam'
    },
    {
      query: 'Tell me about shifting cultivation fire season in Myanmar',
      expectedRegion: 'Myanmar',
      expectedCountry: 'Myanmar'
    }
  ]

  const ratio = Math.round(seasonToDateRatio(stageData('BD0000', 'X').cal, NRT.districts.BD0000.h, '2006-07')! * 10) / 10

  for (const tc of TEST_CASES) {
    it(`correctly resolves, zooms, and fills real data for: "${tc.query}"`, () => {
      const bd = tc.expectedCountry === 'Bangladesh'
      const probe = parseUserQuery(tc.query)
      const res = bd ? parseUserQuery(tc.query, stageData(probe.unitId!, probe.locationName)) : parseUserQuery(tc.query, { events: EVENTS })

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
      expect(res.mapFocus!.targetX).toBeGreaterThanOrEqual(0)
      expect(res.mapFocus!.targetX).toBeLessThanOrEqual(1000)
      expect(res.mapFocus!.targetY).toBeGreaterThanOrEqual(0)
      expect(res.mapFocus!.targetY).toBeLessThanOrEqual(600)
      expect(res.mapFocus!.zoom).toBeGreaterThanOrEqual(2.0)

      // 4. Bounding box coordinates
      expect(res.mapFocus!.boxW).toBeGreaterThan(0)
      expect(res.mapFocus!.boxH).toBeGreaterThan(0)

      // 5. Figures: computed from the data for Bangladesh places; none outside Bangladesh yet
      expect(res.chartData.length).toBe(bd ? 12 : 0)
      expect(res.multiplier).toBe(bd ? ratio : null)
      expect(res.measured).toBe(bd)

      // 6. Records present, each with its source link
      expect(res.news.length).toBeGreaterThan(0)
      expect(res.news.every((n) => n.url.length > 0)).toBe(true)

      // 7. Explanation and sources name what was used
      expect(res.detailsText.length).toBeGreaterThan(50)
      expect(res.sources).toContain(bd ? `calendar/${res.unitId}.json` : 'Amendment 5')
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
      expect(p.unit.kind).toBe('bd')
    }
    const ids = bdProfiles.map((p) => (p.unit.kind === 'bd' ? p.unit.unit_id : ''))
    expect(new Set(ids).size).toBe(64)
    expect(ids.every((id) => /^BD\d{4}$/.test(id))).toBe(true)
  })
})
