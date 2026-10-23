import { describe, expect, it } from 'vitest'
import { CROP_SOURCES } from './cropSources'
import { NEWS_RECORDS } from './newsRecords'
import { REGION_REGISTRY } from './regionRegistry'
import { numbers } from './geminiPrompt'

// Every outside statement is tied to the sentence that states it: a figure in the text that is not in the quote fails.
const iso = /^\d{4}-\d{2}-\d{2}$/
describe('cited sources (docs/real_data_plan.md, section 6)', () => {
  it('every crop-page statement has an https link, a quote, an ISO check date and a unique id', () => {
    expect(CROP_SOURCES.length).toBeGreaterThan(0)
    expect(new Set(CROP_SOURCES.map((s) => s.id)).size).toBe(CROP_SOURCES.length)
    for (const s of CROP_SOURCES) {
      expect(s.url, s.id).toMatch(/^https:\/\//)
      expect(s.quote.length, s.id).toBeGreaterThan(20)
      expect(s.checked, s.id).toMatch(iso)
    }
  })
  it('every number in a statement appears in its quoted source sentence', () => {
    for (const s of CROP_SOURCES) {
      const q = numbers(s.quote)
      expect([...numbers(s.text)].filter((n) => !q.has(n)), s.id).toEqual([])
    }
  })
  it('window entries give calendar months 1–12', () => {
    for (const s of CROP_SOURCES.filter((x) => x.kind === 'window')) {
      expect(s.months?.length, s.id).toBeGreaterThan(0)
      expect(s.months!.every((m) => Number.isInteger(m) && m >= 1 && m <= 12), s.id).toBe(true)
    }
  })
  it('news records follow the same rules and name a registry place', () => {
    expect(new Set(NEWS_RECORDS.map((r) => r.id)).size).toBe(NEWS_RECORDS.length)
    for (const r of NEWS_RECORDS) {
      expect(r.url).toMatch(/^https:\/\//)
      expect(r.date).toMatch(iso); expect(r.checked).toMatch(iso)
      expect(REGION_REGISTRY[r.place_key], r.id).toBeDefined()
      const q = numbers(r.quote)
      expect([...numbers(`${r.title} ${r.summary}`)].filter((n) => !q.has(n)), r.id).toEqual([])
    }
  })
})
