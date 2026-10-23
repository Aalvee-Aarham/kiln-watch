// Turns an agent answer and its tool calls into readable, traceable parts for the Ask page: which function each figure
// in the answer came from, and the calls' results as labelled rows instead of raw JSON. Pure; tested in askTrace.test.ts.
import { numberSpans, numbers } from './geminiPrompt'
import type { AskCache } from './types'

export type ToolCall = AskCache['answers'][number]['tools'][number]
export type Field = { path: string; label: string; display: string; values: Set<number> }
export type Segment = { text: string } | { text: string; value: number; call: number; path: string }

const TITLES: Record<string, string> = {
  find_area: 'Found the area', area_fire_calendar: 'Fire calendar', this_season: 'This season so far',
  two_week_outlook: 'Two-week outlook', harmonization_evidence: 'Harmonization evidence',
  kiln_seasons: 'Kiln season', national_trend: 'National trend', district_facts: 'District facts the model was given',
}
export const toolTitle = (name: string) => TITLES[name] ?? name.replace(/_/g, ' ')

const UNITS: [RegExp, string][] = [[/_pct$/, ' (%)'], [/_days$/, ' (days)'], [/_95ci$/, ' (95% range)']]
/** "share_of_2012_jump_removed_pct" → "Share of 2012 jump removed (%)". */
export function fieldLabel(key: string): string {
  let unit = ''
  for (const [re, u] of UNITS) if (re.test(key)) { unit = u; key = key.replace(re, ''); break }
  const words = key.replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1) + unit
}

/** A 95% range or "range" reads "a to b"; any other list is comma-separated. */
const show = (v: unknown, key = ''): string => Array.isArray(v) ? v.map((x) => show(x)).join(/95ci|range/.test(key) ? ' to ' : ', ')
  : typeof v === 'boolean' ? (v ? 'yes' : 'no') : v === null || v === undefined ? 'none' : String(v)

/** A result's leaves as rows (provenance and nested match lists excluded), nested objects labelled "Parent: child". */
export function resultFields(result: Record<string, unknown>, prefix = '', label = ''): Field[] {
  const out: Field[] = []
  for (const [k, v] of Object.entries(result)) {
    if (k === 'provenance' || k === 'matches') continue
    const path = prefix ? `${prefix}.${k}` : k
    const name = label ? `${label}: ${fieldLabel(k).charAt(0).toLowerCase()}${fieldLabel(k).slice(1)}` : fieldLabel(k)
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...resultFields(v as Record<string, unknown>, path, name))
    else out.push({ path, label: name, display: show(v, k), values: numbers(JSON.stringify(v)) })
  }
  return out
}

/** The answer split around its numbers; each number points at the first call and field that returned that value. */
export function traceAnswer(text: string, tools: ToolCall[]): Segment[] {
  const fields = tools.map((t) => resultFields(t.result))
  const out: Segment[] = []
  let at = 0
  for (const s of numberSpans(text)) {
    const call = fields.findIndex((fs) => fs.some((f) => f.values.has(s.value)))
    if (call < 0) continue // not traceable to a row (e.g. a number only inside a source line): leave it as plain text
    if (s.start > at) out.push({ text: text.slice(at, s.start) })
    out.push({ text: text.slice(s.start, s.end), value: s.value, call, path: fields[call].find((f) => f.values.has(s.value))!.path })
    at = s.end
  }
  if (at < text.length) out.push({ text: text.slice(at) })
  // a season label like "2026-27" is one figure: join number, hyphen, number when both trace to the same field
  for (let i = 0; i + 2 < out.length; i++) {
    const [a, mid, b] = [out[i], out[i + 1], out[i + 2]]
    if ('value' in a && 'value' in b && !('value' in mid) && /^[-–]$/.test(mid.text) && a.call === b.call && a.path === b.path) {
      out.splice(i, 3, { ...a, text: a.text + mid.text + b.text })
    }
  }
  return out
}

/** The area names find_area resolved, so later calls can say "Dhaka" instead of "BD3026". */
export function areaNames(tools: ToolCall[]): Record<string, string> {
  const names: Record<string, string> = {}
  for (const t of tools) {
    for (const m of ((t.result.matches as { unit_id?: string; name_en?: string }[] | undefined) ?? [])) if (m.unit_id && m.name_en) names[m.unit_id] = m.name_en
  }
  return names
}
