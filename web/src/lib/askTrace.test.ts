import { describe, expect, it } from 'vitest'
import { areaNames, fieldLabel, resultFields, traceAnswer, type ToolCall } from './askTrace'

const kiln: ToolCall = { name: 'kiln_seasons', input: { unit_id: 'BD3026' }, result: {
  area: 'BD3026', kiln_clusters: 188, typical_season: { starts: 'mid-November', ends: 'early June', length_days: 197 },
  provenance: { dataset_id: 'x', source_url: 'https://example.org/data/kiln_activity.json', data_build: 'f2bf67d' } } }
const find: ToolCall = { name: 'find_area', input: { name: 'Dhaka' }, result: { matches: [{ unit_id: 'BD3026', name_en: 'Dhaka' }] } }

describe('askTrace', () => {
  it('labels fields in plain words, with units', () => {
    expect(fieldLabel('share_of_2012_jump_removed_pct')).toBe('Share of 2012 jump removed (%)')
    expect(fieldLabel('duration_days_95ci')).toBe('Duration days (95% range)')
    expect(fieldLabel('kiln_clusters')).toBe('Kiln clusters')
  })
  it('turns a result into rows, nested objects labelled by their parent, provenance left out', () => {
    expect(resultFields(kiln.result).map((f) => [f.label, f.display])).toEqual([
      ['Area', 'BD3026'], ['Kiln clusters', '188'], ['Typical season: starts', 'mid-November'],
      ['Typical season: ends', 'early June'], ['Typical season: length (days)', '197'],
    ])
  })
  it('reads a 95% range as "a to b" and any other list with commas', () => {
    const rows = resultFields({ duration_days_95ci: [155, 179], range_95: [1, 2], seasons_used: ['2023-24', '2024-25'] })
    expect(rows.map((f) => f.display)).toEqual(['155 to 179', '1 to 2', '2023-24, 2024-25'])
  })
  it('points every number in the answer at the call and field that returned it', () => {
    const segs = traceAnswer('The season is 197 days long across 188 kiln clusters.', [find, kiln])
    expect(segs.filter((s) => 'value' in s)).toEqual([
      { text: '197', value: 197, call: 1, path: 'typical_season.length_days' },
      { text: '188', value: 188, call: 1, path: 'kiln_clusters' },
    ])
    expect(segs.map((s) => s.text).join('')).toBe('The season is 197 days long across 188 kiln clusters.') // nothing lost
  })
  it('keeps a season label like 2026-27 as one traced figure', () => {
    const facts: ToolCall = { name: 'district_facts', input: { district: 'Dhaka' }, result: { current_season: '2026-27', unusual_days_this_season: 2 } }
    const figs = traceAnswer('In 2026-27 Dhaka had 2 unusual days.', [facts]).filter((s) => 'value' in s).map((s) => s.text)
    expect(figs).toEqual(['2026-27', '2'])
  })
  it('traces Bangla digits by value and leaves untraceable numbers as plain text', () => {
    const segs = traceAnswer('মৌসুম ১৯৭ দিন, 42 বার', [kiln])
    expect(segs.filter((s) => 'value' in s).map((s) => s.text)).toEqual(['১৯৭'])
  })
  it('resolves area codes to the names find_area returned', () => {
    expect(areaNames([find, kiln])).toEqual({ BD3026: 'Dhaka' })
  })
})
