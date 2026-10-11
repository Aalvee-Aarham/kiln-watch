// News page logic (docs/news_plan.md §5.2–5.4, §7): plain-language sentences from the satellite parts, story
// grouping, filters and earlier news. Pure functions; tested in news.test.ts. Every window size and threshold
// arrives in news/index.json `rules` or is already applied by kilnwatch news-pair; none is written here.
import { monthNames, tr, type Key } from './i18n'
import type { Lang } from './url'
import type { NewsIndex, NewsItem, NewsKind, NewsPlace, NewsPlaces, NewsPlaceStories, NewsPlaceStory, NewsSat, NewsSeason, NewsWindow } from './types'

export const NEWS_KINDS: NewsKind[] = ['burning', 'enforcement', 'kilns_operating', 'air_health']
export const NATIONAL = 'BGD'
export const kindKey = (k: NewsKind) => `kind_${k}` as Key

const BN_DIGITS = '০১২৩৪৫৬৭৮৯'
/** Digits in the UI language: 14 → "১৪" under Bangla. No grouping (years stay "2026"). */
export const digits = (v: number | string, lang: Lang) => (lang === 'bn' ? String(v).replace(/[0-9]/g, (d) => BN_DIGITS[+d]) : String(v))

const ymd = (iso: string) => ({ y: +iso.slice(0, 4), m: +iso.slice(5, 7), d: +iso.slice(8, 10) })
const dayNum = (iso: string) => Date.parse(iso.slice(0, 10) + 'T00:00:00Z') / 86_400_000
/** Short month name, 1 = January ("Jan", never "Sept"). */
export const monthShort = (m: number, lang: Lang) => monthNames(lang)[m - 1]
export const monthLong = (m: number, lang: Lang) =>
  new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2001, m - 1, 1))

/** "14 Jan". */
export const dayMonth = (iso: string, lang: Lang) => { const { m, d } = ymd(iso); return `${digits(d, lang)} ${monthShort(m, lang)}` }
/** "14 Jan 2026". */
export const fullDate = (iso: string, lang: Lang) => `${dayMonth(iso, lang)} ${digits(ymd(iso).y, lang)}`
/** "2025-12" → "December 2025". */
export const monthYear = (key: string, lang: Lang) => `${monthLong(+key.slice(5, 7), lang)} ${digits(key.slice(0, 4), lang)}`
/** "2013-01-15" → "Jan 2013". */
export const shortMonthYear = (iso: string, lang: Lang) => `${monthShort(+iso.slice(5, 7), lang)} ${digits(iso.slice(0, 4), lang)}`

/** "8–14 Jan", "28 Dec – 3 Jan 2026" style: the shortest unambiguous range. Both ends inclusive. */
export function dateRange(from: string, to: string, lang: Lang): string {
  const a = ymd(from), b = ymd(to)
  if (from === to) return dayMonth(from, lang)
  if (a.y === b.y && a.m === b.m) return `${digits(a.d, lang)}–${dayMonth(to, lang)}`
  if (a.y === b.y) return `${dayMonth(from, lang)} – ${dayMonth(to, lang)}`
  return `${fullDate(from, lang)} – ${fullDate(to, lang)}`
}
/** Days in an inclusive range. */
export const daysIn = (from: string, to: string) => dayNum(to) - dayNum(from) + 1
/** 1 July that opens the season containing `iso` (seasons run 1 Jul – 30 Jun). */
export const seasonStart = (iso: string) => { const { y, m } = ymd(iso); return `${m >= 7 ? y : y - 1}-07-01` }

/** Season-month position, July = 0 … June = 11. */
const seasonPos = (m: number) => (m + 5) % 12
/** Calendar months (1–12) as runs in July–June order: [11, 12, 1, 2] → "Nov–Feb"; gaps give "Nov–Dec, Mar". */
export function monthsText(months: number[], lang: Lang): string {
  const pos = [...new Set(months.filter((m) => m >= 1 && m <= 12).map(seasonPos))].sort((a, b) => a - b)
  const runs: [number, number][] = []
  for (const p of pos) {
    const last = runs.at(-1)
    if (last && p === last[1] + 1) last[1] = p
    else runs.push([p, p])
  }
  const name = (p: number) => monthShort(((p + 6) % 12) + 1, lang)
  return runs.map(([a, b]) => (a === b ? name(a) : `${name(a)}–${name(b)}`)).join(', ')
}
/** A typical-months span from first to last (calendar months, may wrap the year): (11, 2) → "Nov–Feb". */
export const monthSpan = (first: number, last: number, lang: Lang) =>
  first === last ? monthShort(first, lang) : `${monthShort(first, lang)}–${monthShort(last, lang)}`

export const placeName = (places: NewsPlaces | undefined, id: string, lang: Lang) => {
  const p = places?.[id]
  return p ? (lang === 'bn' ? p.name_bn : p.name_en) : id
}
/** Districts in places.json (the national entry excluded): the denominator of the national counts. */
export const districtCount = (places: NewsPlaces) => Object.keys(places).filter((k) => k !== NATIONAL).length

const plural = (n: number, lang: Lang) => tr(n === 1 ? 'day' : 'days', lang)
const provisional = (lang: Lang) => ` (${tr('provisionalNote', lang)})`

/** One satellite window in words. */
export function windowText(w: NewsWindow, level: 'district' | 'national', isProvisional: boolean, nDistricts: number, lang: Lang): string {
  const range = dateRange(w.from, w.to, lang)
  const tail = isProvisional ? provisional(lang) : ''
  if (level === 'national')
    return w.districts_unusual == null ? tr('cantTell', lang, { range })
      : tr('winNational', lang, { range, n: digits(w.districts_unusual, lang), total: digits(nDistricts, lang) }) + tail
  if (w.unusual_days == null)
    return w.not_observed_days == null ? tr('cantTell', lang, { range })
      : tr('cantTellOf', lang, { range, k: digits(w.not_observed_days, lang), n: digits(daysIn(w.from, w.to), lang) })
  const base = w.unusual_days === 0 ? tr('winNone', lang, { range })
    : tr('winDays', lang, { range, n: digits(w.unusual_days, lang), days: plural(w.unusual_days, lang) })
  const cloud = w.not_observed_days ? `; ${tr('notObs', lang, { n: digits(w.not_observed_days, lang), days: plural(w.not_observed_days, lang) })}` : ''
  return base + cloud + tail
}

/** "What satellites saw": one line per window or fact, from `sat`. */
export function satLines(sat: NewsSat, rules: NewsIndex['rules'], nDistricts: number, lang: Lang): string[] {
  if (sat.type === 'window') {
    const one = (w: NewsWindow) => windowText(w, sat.level, sat.provisional, nDistricts, lang)
    if (sat.after === undefined) return [one(sat.before)]
    const n = digits(rules.enforce_window_days, lang)
    return [`${tr('winBefore', lang, { n })}: ${one(sat.before)}`, `${tr('winAfter', lang, { n })}: ${sat.after ? one(sat.after) : tr('afterPending', lang)}`]
  }
  const known = sat.inside != null && !!sat.usual_months?.length
  const months = known ? monthsText(sat.usual_months!, lang) : ''
  if (sat.type === 'kiln_months')
    return [known ? tr(sat.inside ? 'kilnInside' : 'kilnOutside', lang, { months }) : tr('kilnNone', lang)]
  const lines = [known ? tr(sat.inside ? 'burnInside' : 'burnOutside', lang, { months }) : tr('burnNone', lang)]
  if (sat.outlook_frac != null) lines.push(tr('outlookLine', lang, { pct: digits(Math.round(sat.outlook_frac * 100), lang) }))
  return lines
}

/** "This season so far": unusual days from 1 July to `to` (district) or districts with one (national). */
export function seasonLine(s: NewsItem['season_so_far'], nDistricts: number, lang: Lang): string {
  const from = dayMonth(seasonStart(s.to), lang), to = dayMonth(s.to, lang)
  const tail = s.provisional ? provisional(lang) : ''
  if (s.districts_unusual != null)
    return tr('soFarNational', lang, { n: digits(s.districts_unusual, lang), total: digits(nDistricts, lang), from, to }) + tail
  if (s.unusual_days == null) return tr('soFarCantTell', lang, { from, to })
  const cloud = s.not_observed_days ? `; ${tr('notObs', lang, { n: digits(s.not_observed_days, lang), days: plural(s.not_observed_days, lang) })}` : ''
  return tr('soFarDays', lang, { n: digits(s.unusual_days, lang), days: plural(s.unusual_days, lang), from, to }) + cloud + tail
}

/** The record's heading: "Kiln Watch satellite record since 2003-04". */
export const recordHeading = (p: NewsPlace, lang: Lang) =>
  p.record_from ? tr('recordSince', lang, { from: digits(p.record_from, lang) }) : tr('recordAll', lang)

/** Summary of the typical year and the record (the busyMonths rule and measured season durations). */
export function summaryLines(p: NewsPlace, lang: Lang): string[] {
  const lines = [p.typical
    ? tr('typicalRuns', lang, { months: monthSpan(p.typical.first_month, p.typical.last_month, lang), busiest: monthLong(p.typical.busiest_month, lang) })
    : tr('typicalNone', lang)]
  if (p.seasons_in_record > 0) {
    const lasts = p.typical_duration_days != null && p.seasons_with_burning > 0
      ? tr('recordLasts', lang, { d: digits(Math.round(p.typical_duration_days), lang) }) : ''
    lines.push(`${tr('recordLine', lang, { n: digits(p.seasons_with_burning, lang), total: digits(p.seasons_in_record, lang) })}${lasts}.`)
  }
  return lines
}

/** The one verdict: how common fire is in this place at this time of year. null for national stories. */
export function verdictText(how: NewsItem['how_common'], p: NewsPlace | undefined, lang: Lang): string | null {
  if (how == null || !p) return null
  const name = lang === 'bn' ? p.name_bn : p.name_en
  if (how === 'common_now') return tr('verdict_common_now', lang, { name })
  if (how === 'rare') return tr('verdict_rare', lang, { n: digits(p.seasons_with_burning, lang), total: digits(p.seasons_in_record, lang) })
  return p.typical
    ? tr('verdict_outside_season', lang, { first: monthShort(p.typical.first_month, lang), last: monthShort(p.typical.last_month, lang) })
    : tr('verdictOutsideNoMonths', lang)
}

// --- lists ---

/** Every story in a season file, in file order. */
export const seasonItems = (s: NewsSeason): NewsItem[] => Object.values(s.months).flat()

/** Stories naming `district` (anywhere in unit_ids) and of `kind`; an unset filter matches everything. */
export const filterItems = (items: NewsItem[], f: { district?: string; kind?: NewsKind }) =>
  items.filter((it) => (!f.district || it.unit_ids.includes(f.district)) && (!f.kind || it.kind === f.kind))

const byPublished = (a: NewsItem, b: NewsItem) => a.published_date_local.localeCompare(b.published_date_local) || a.news_id.localeCompare(b.news_id)
const placesKey = (it: NewsItem) => `${it.kind}|${[...it.unit_ids].sort().join(',')}`

export interface NewsGroup { lead: NewsItem; others: NewsItem[] }
/**
 * Display grouping: same kind, same districts, event date within 1 day of the group's lead → one card.
 * The first-published story leads; the rest show under "Also reported by". Groups come newest first.
 */
export function groupStories(items: NewsItem[]): NewsGroup[] {
  const groups: NewsGroup[] = []
  const byKey = new Map<string, NewsGroup[]>()
  for (const it of [...items].sort(byPublished)) {
    const k = placesKey(it)
    const same = byKey.get(k) ?? []
    const g = same.find((g) => Math.abs(dayNum(g.lead.event_date_local) - dayNum(it.event_date_local)) <= 1)
    if (g) g.others.push(it)
    else { const ng = { lead: it, others: [] }; groups.push(ng); same.push(ng); byKey.set(k, same) }
  }
  return groups.reverse()
}

/** Groups bucketed by the lead's publication month ("2025-12"), keeping their order. */
export function byMonth(groups: NewsGroup[]): [string, NewsGroup[]][] {
  const out = new Map<string, NewsGroup[]>()
  for (const g of groups) {
    const k = g.lead.published_date_local.slice(0, 7)
    out.set(k, [...(out.get(k) ?? []), g])
  }
  return [...out]
}

const placeSort = (a: NewsPlaceStory, b: NewsPlaceStory) => b.date_local.localeCompare(a.date_local) || b.news_id.localeCompare(a.news_id)
/** Every story in a place file, newest first, optionally of one kind. */
export const placeStoryList = (p: NewsPlaceStories, kind?: NewsKind) =>
  Object.values(p.months).flat().filter((s) => !kind || s.kind === kind).sort(placeSort)

/** Up to `n` stories about the place published before this one (strictly earlier dates), newest first. */
export const earlierStories = (p: NewsPlaceStories, item: NewsItem, n: number) =>
  placeStoryList(p).filter((s) => s.news_id !== item.news_id && s.date_local < item.published_date_local).slice(0, Math.max(0, n))

// --- sources and coverage ---

/** Stories per outlet in a list. */
export const outletCounts = (items: NewsItem[]) => items.reduce((m, it) => m.set(it.outlet, (m.get(it.outlet) ?? 0) + 1), new Map<string, number>())

/**
 * One outlet's coverage in words. "Not scanned" and "no stories" stay different facts: a story count is only
 * given for an outlet that has been scanned.
 */
export function sourceText(src: NewsIndex['sources'][number], stories: number | undefined, lang: Lang): string {
  if (src.status === 'excluded') return `${tr('srcExcluded', lang)}${src.reason ? `: ${src.reason}` : ''}`
  if (!src.last_scanned) return tr('srcNotScanned', lang)
  const parts = [
    tr('srcScanned', lang, { date: fullDate(src.last_scanned, lang) }),
    src.read_back_to ? tr('srcReadBack', lang, { date: fullDate(src.read_back_to, lang) }) : tr('srcNoHistory', lang),
  ]
  if (stories !== undefined) parts.push(stories ? tr('srcStories', lang, { n: digits(stories, lang) }) : tr('srcNoStories', lang))
  return parts.join(' · ')
}

/** "12 stories" / "1 story". */
export const storyCount = (n: number, lang: Lang) => (n === 1 ? tr('newsCountOne', lang) : tr('newsCount', lang, { n: digits(n, lang) }))
