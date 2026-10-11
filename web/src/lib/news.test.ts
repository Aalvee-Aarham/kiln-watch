import { describe, expect, it } from 'vitest'
import {
  byMonth, dateRange, daysIn, digits, districtCount, earlierStories, filterItems, groupStories, monthSpan, monthsText, outletCounts,
  placeStoryList, recordHeading, seasonItems, seasonLine, seasonStart, satLines, sourceText, summaryLines, verdictText, windowText,
} from './news'
import type { NewsIndex, NewsItem, NewsPlace, NewsPlaceStories, NewsSat } from './types'

// Small synthetic objects; every expectation is worked out by hand from them.
const rules: NewsIndex['rules'] = { burn_window_days: 7, enforce_window_days: 14, cloudy_min_days: 4, rare_season_frac: 0.5, earlier_shown: 3 }

let seq = 0
const item = (p: Partial<NewsItem> = {}): NewsItem => ({
  news_id: `n${String(seq++).padStart(11, '0')}`, url: 'https://example.org/a', outlet: 'Example Daily', lang: 'en', title: 'Synthetic headline',
  published_date_local: '2026-01-14', event_date_local: '2026-01-14', event_date_stated: false, kind: 'burning', unit_ids: ['BD5585'],
  claim_en: 'Synthetic claim.', claim_bn: 'কৃত্রিম দাবি।', quote: 'Synthetic quote.',
  sat: { type: 'window', level: 'district', provisional: false, before: { from: '2026-01-08', to: '2026-01-14', unusual_days: 5, not_observed_days: 0 } },
  season_so_far: { unusual_days: 14, not_observed_days: 9, provisional: false, to: '2026-01-14' },
  how_common: 'common_now', earlier_news: 0, ...p,
})
const place = (p: Partial<NewsPlace> = {}): NewsPlace => ({
  unit_id: 'BD5585', name_en: 'Rangpur', name_bn: 'রংপুর', record_from: '2003-04', seasons_in_record: 23, seasons_with_burning: 21,
  typical_duration_days: 96, typical: { first_month: 11, busiest_month: 12, last_month: 2 }, news_total: 12, news_from: '2013-01-05', ...p,
})

describe('dates and months', () => {
  it('writes the shortest unambiguous inclusive range', () => {
    expect(dateRange('2026-01-08', '2026-01-14', 'en')).toBe('8–14 Jan')
    expect(dateRange('2025-11-28', '2025-12-04', 'en')).toBe('28 Nov – 4 Dec')
    expect(dateRange('2025-12-29', '2026-01-04', 'en')).toBe('29 Dec 2025 – 4 Jan 2026')
    expect(dateRange('2026-01-14', '2026-01-14', 'en')).toBe('14 Jan')
    expect(daysIn('2026-01-08', '2026-01-14')).toBe(7)
    expect(daysIn('2025-12-29', '2026-01-04')).toBe(7)
  })
  it('uses Bangla digits under Bangla', () => {
    expect(digits(2026, 'bn')).toBe('২০২৬')
    expect(digits(14, 'en')).toBe('14')
    expect(dateRange('2026-01-08', '2026-01-14', 'bn')).toMatch(/^৮–১৪ /)
  })
  it('opens each season on 1 July', () => {
    expect(seasonStart('2026-01-14')).toBe('2025-07-01')
    expect(seasonStart('2025-07-01')).toBe('2025-07-01')
    expect(seasonStart('2025-06-30')).toBe('2024-07-01')
  })
  it('a Nov–Feb span wraps the year, in July–June order', () => {
    expect(monthsText([11, 12, 1, 2], 'en')).toBe('Nov–Feb')
    expect(monthsText([1, 2, 11, 12], 'en')).toBe('Nov–Feb')
    expect(monthsText([3], 'en')).toBe('Mar')
    expect(monthsText([11, 12, 3, 4], 'en')).toBe('Nov–Dec, Mar–Apr')
    expect(monthsText([7, 6], 'en')).toBe('Jul, Jun') // the season edges are not neighbours
    expect(monthSpan(11, 2, 'en')).toBe('Nov–Feb')
    expect(monthSpan(1, 1, 'en')).toBe('Jan')
  })
})

describe('what satellites saw', () => {
  const win = (p: Partial<Extract<NewsSat, { type: 'window' }>['before']> = {}) => ({ from: '2026-01-08', to: '2026-01-14', unusual_days: 5, not_observed_days: 0, ...p })
  it('district window: count, cloud days and provisional', () => {
    expect(windowText(win(), 'district', false, 64, 'en')).toBe('8–14 Jan: 5 unusual burning days')
    expect(windowText(win({ unusual_days: 1 }), 'district', false, 64, 'en')).toBe('8–14 Jan: 1 unusual burning day')
    expect(windowText(win({ unusual_days: 0, not_observed_days: 2 }), 'district', false, 64, 'en')).toBe('8–14 Jan: no unusual burning days; 2 days not observed (cloud)')
    expect(windowText(win({ not_observed_days: null }), 'district', true, 64, 'en')).toBe('8–14 Jan: 5 unusual burning days (provisional; cloud cover not checked)')
  })
  it('district window: null unusual days means the satellites could not see the ground', () => {
    expect(windowText(win({ unusual_days: null, not_observed_days: 5 }), 'district', false, 64, 'en'))
      .toBe('8–14 Jan: satellites couldn’t see the ground on 5 of 7 days (cloud), so we can’t tell')
    expect(windowText(win({ unusual_days: null, not_observed_days: null }), 'district', false, 64, 'en'))
      .toBe('8–14 Jan: satellites couldn’t see the ground, so we can’t tell')
  })
  it('national window: districts with an unusual day, out of the districts in places.json', () => {
    expect(windowText(win({ unusual_days: null, districts_unusual: 12 }), 'national', false, 64, 'en'))
      .toBe('8–14 Jan: 12 of 64 districts had at least one unusual burning day')
    expect(districtCount({ BGD: place({ unit_id: 'BGD' }), A: place(), B: place() })).toBe(2)
  })
  it('enforcement: a before and an after window; after null = not complete yet; labels from rules', () => {
    const sat: NewsSat = { type: 'window', level: 'district', provisional: false, before: win({ from: '2025-12-01', to: '2025-12-14', unusual_days: 3 }), after: null }
    expect(satLines(sat, rules, 64, 'en')).toEqual(['14 days before: 1–14 Dec: 3 unusual burning days', '14 days after: not complete yet'])
    const done: NewsSat = { ...sat, after: win({ from: '2025-12-15', to: '2025-12-28', unusual_days: 0 }) }
    expect(satLines(done, { ...rules, enforce_window_days: 10 }, 64, 'en')[1]).toBe('10 days after: 15–28 Dec: no unusual burning days')
    expect(satLines({ ...sat, after: undefined }, rules, 64, 'en')).toEqual(['1–14 Dec: 3 unusual burning days'])
  })
  it('kiln months: inside, outside, no estimate', () => {
    expect(satLines({ type: 'kiln_months', usual_months: [11, 12, 1, 2, 3, 4], inside: true }, rules, 64, 'en'))
      .toEqual(['The story date falls in the months kilns here usually work (Nov–Apr).'])
    expect(satLines({ type: 'kiln_months', usual_months: [11, 12, 1], inside: false }, rules, 64, 'en'))
      .toEqual(['The story date falls outside the months kilns here usually work (Nov–Jan).'])
    expect(satLines({ type: 'kiln_months', usual_months: null, inside: null }, rules, 64, 'en'))
      .toEqual(['We have no estimate of when kilns work here, so we can’t tell.'])
  })
  it('burning season: inside, outside, no estimate, and the two-week outlook', () => {
    expect(satLines({ type: 'burning_season', usual_months: [12, 1, 2], inside: true }, rules, 64, 'en'))
      .toEqual(['The story date falls inside the usual burning months here (Dec–Feb).'])
    expect(satLines({ type: 'burning_season', usual_months: [12, 1, 2], inside: false, outlook_frac: 0.234 }, rules, 64, 'en'))
      .toEqual(['The story date falls outside the usual burning months here (Dec–Feb).', 'Two-week outlook: 23% chance of at least one unusual day.'])
    expect(satLines({ type: 'burning_season', usual_months: null, inside: null, outlook_frac: null }, rules, 64, 'en'))
      .toEqual(['We have no estimate of the usual burning months here.'])
  })
})

describe('how common is fire here', () => {
  it('season so far: district, provisional, national, can’t tell', () => {
    expect(seasonLine({ unusual_days: 14, not_observed_days: 9, provisional: false, to: '2026-01-14' }, 64, 'en'))
      .toBe('14 unusual days from 1 Jul to 14 Jan; 9 days not observed (cloud)')
    expect(seasonLine({ unusual_days: 1, not_observed_days: null, provisional: true, to: '2026-10-05' }, 64, 'en'))
      .toBe('1 unusual day from 1 Jul to 5 Oct (provisional; cloud cover not checked)')
    expect(seasonLine({ unusual_days: null, not_observed_days: null, districts_unusual: 30, provisional: false, to: '2026-01-14' }, 64, 'en'))
      .toBe('30 of 64 districts had at least one unusual day from 1 Jul to 14 Jan')
    expect(seasonLine({ unusual_days: null, not_observed_days: 100, provisional: false, to: '2026-01-14' }, 64, 'en'))
      .toBe('From 1 Jul to 14 Jan: satellites couldn’t see the ground often enough to tell')
  })
  it('summary of the typical year and the record', () => {
    expect(recordHeading(place(), 'en')).toBe('Kiln Watch satellite record since 2003-04')
    expect(summaryLines(place(), 'en')).toEqual(['Burning here usually runs Nov–Feb, busiest in December.', 'A burning season was recorded in 21 of 23 seasons; it usually lasts about 96 days.'])
    expect(summaryLines(place({ typical: null, seasons_with_burning: 0, typical_duration_days: null }), 'en'))
      .toEqual(['Satellites have recorded very little burning here.', 'A burning season was recorded in 0 of 23 seasons.'])
    expect(summaryLines(place({ seasons_in_record: 0 }), 'en')).toHaveLength(1)
  })
  it('each verdict reads as plan §5.3 words it; national stories get none', () => {
    expect(verdictText('common_now', place(), 'en')).toBe('Common. Burning at this time of year is normal for Rangpur.')
    expect(verdictText('outside_season', place(), 'en')).toBe('Less common. Burning here usually runs Nov–Feb; this story falls outside that.')
    expect(verdictText('rare', place({ seasons_with_burning: 3, seasons_in_record: 10 }), 'en')).toBe('Rare. Satellites recorded a burning season here in only 3 of 10 seasons.')
    expect(verdictText(null, place({ unit_id: 'BGD' }), 'en')).toBeNull()
    expect(verdictText('common_now', place(), 'bn')).toContain('রংপুর')
  })
})

describe('grouping and filters', () => {
  it('merges same kind and districts with event dates 1 day apart, not 2; first published leads', () => {
    const a = item({ published_date_local: '2026-01-10', event_date_local: '2026-01-10', outlet: 'A' })
    const b = item({ published_date_local: '2026-01-11', event_date_local: '2026-01-11', outlet: 'B' })
    const c = item({ published_date_local: '2026-01-12', event_date_local: '2026-01-12', outlet: 'C' }) // 2 days after a's event
    const g = groupStories([c, b, a])
    expect(g.map((x) => x.lead.outlet)).toEqual(['C', 'A']) // newest first
    expect(g[1].others.map((x) => x.outlet)).toEqual(['B'])
  })
  it('does not merge a different kind or different districts; district order does not matter', () => {
    const a = item({ unit_ids: ['X', 'Y'] })
    const b = item({ unit_ids: ['Y', 'X'] })
    const c = item({ kind: 'enforcement' })
    const d = item({ unit_ids: ['X'] })
    const g = groupStories([a, b, c, d])
    expect(g).toHaveLength(3)
    expect(g.find((x) => x.lead === a)!.others).toEqual([b])
  })
  it('buckets cards by the lead’s publication month, newest first', () => {
    const g = groupStories([item({ published_date_local: '2025-12-30', event_date_local: '2025-12-30' }), item({ published_date_local: '2026-01-02', event_date_local: '2026-01-02', kind: 'air_health' })])
    expect(byMonth(g).map(([k, gs]) => [k, gs.length])).toEqual([['2026-01', 1], ['2025-12', 1]])
  })
  it('filters return exactly the matching items', () => {
    const a = item({ unit_ids: ['X'], kind: 'burning' })
    const b = item({ unit_ids: ['Y', 'X'], kind: 'enforcement' })
    const c = item({ unit_ids: ['BGD'], kind: 'burning' })
    const all = [a, b, c]
    expect(filterItems(all, {})).toEqual(all)
    expect(filterItems(all, { district: 'X' })).toEqual([a, b])
    expect(filterItems(all, { kind: 'burning' })).toEqual([a, c])
    expect(filterItems(all, { district: 'X', kind: 'enforcement' })).toEqual([b])
    expect(filterItems(all, { district: 'Z' })).toEqual([])
    expect(seasonItems({ season: '2025-26', months: { '2026-01': [a, b], '2025-12': [c] } })).toHaveLength(3)
  })
})

describe('earlier news and coverage', () => {
  const ref = (news_id: string, date_local: string) => ({ news_id, date_local, season: '2025-26', kind: 'burning' as const, outlet: 'Example Daily', lang: 'en' as const, title: news_id, url: 'https://example.org/' + news_id })
  const ps: NewsPlaceStories = { unit_id: 'X', months: { '2026-01': [ref('e', '2026-01-14'), ref('d', '2026-01-10')], '2025-12': [ref('c', '2025-12-03'), ref('b', '2025-12-02')], '2025-11': [ref('a', '2025-11-20')] } }
  it('lists stories published before this one, newest first, capped by rules.earlier_shown', () => {
    const it0 = item({ news_id: 'e', published_date_local: '2026-01-14' })
    expect(earlierStories(ps, it0, rules.earlier_shown).map((s) => s.news_id)).toEqual(['d', 'c', 'b'])
    expect(earlierStories(ps, it0, 10).map((s) => s.news_id)).toEqual(['d', 'c', 'b', 'a'])
    expect(earlierStories(ps, item({ news_id: 'a', published_date_local: '2025-11-20' }), 3)).toEqual([])
    expect(placeStoryList(ps).map((s) => s.news_id)).toEqual(['e', 'd', 'c', 'b', 'a'])
  })
  it('keeps “not scanned” and “no stories” apart', () => {
    const src = { key: 'ex', outlet: 'Example Daily', lang: 'en' as const, status: 'active' as const, read_back_to: '2013-04-01', last_scanned: '2026-01-15T03:00:00Z' }
    expect(sourceText(src, 0, 'en')).toBe('last scanned 15 Jan 2026 · read back to 1 Apr 2013 · no stories this season')
    expect(sourceText(src, 2, 'en')).toBe('last scanned 15 Jan 2026 · read back to 1 Apr 2013 · 2 stories this season')
    expect(sourceText({ ...src, read_back_to: null }, undefined, 'en')).toBe('last scanned 15 Jan 2026 · history not read yet')
    expect(sourceText({ ...src, last_scanned: null }, 0, 'en')).toBe('not scanned yet')
    expect(sourceText({ key: 'kk', outlet: 'Blocked Daily', lang: 'bn', status: 'excluded', reason: 'sitemap returns 403' }, undefined, 'en')).toBe('Excluded: sitemap returns 403')
    expect(outletCounts([item({ outlet: 'A' }), item({ outlet: 'A' }), item({ outlet: 'B' })])).toEqual(new Map([['A', 2], ['B', 1]]))
  })
})
