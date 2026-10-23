import { outlookWith, type OutlookNow } from './outlook'
import type { NrtSeason, Outlook } from './types'

const DAY = 86_400_000
/** "Recent" and "starting soon" both look two weeks out, the outlook's window, when no outlook is published. */
export const WINDOW_DAYS = 14

/** unusual: an unusual day in the last two weeks · critical: inside its critical period · soon: one starts within two
 * weeks · clear: none of these. Every level comes from published, already-tested data: no new forecast. */
export type Level = 'unusual' | 'critical' | 'soon' | 'clear'
export interface DistrictWarning {
  id: string
  level: Level
  unusualDays: number                     // this season so far
  daysSince: number | null                // from the latest unusual day to the last day of data
  critical: { start: string; end: string; daysUntil: number } | null  // the current (daysUntil 0) or next critical period
  outlook: OutlookNow | null              // only when outlook.json ships
}

/** The current or next critical window, from the calendar's inclusive day-of-season windows (0 = 1 July). After the
 * season's last window the next one is the first window of next season, `seasonDays` later. */
export function nextCritical(windows: [number, number][], day: number, seasonDays: number) {
  if (!windows.length) return null
  const sorted = [...windows].sort((a, b) => a[0] - b[0])
  const w = sorted.find(([, end]) => end >= day)
  if (w) return { start: w[0], end: w[1], daysUntil: Math.max(0, w[0] - day) }
  const [start, end] = sorted[0]
  return { start: start + seasonDays, end: end + seasonDays, daysUntil: start + seasonDays - day }
}

const RANK: Record<Level, number> = { unusual: 0, critical: 1, soon: 2, clear: 3 }

/** Every district's warning, most urgent first. "Today" is the last day in the live file, as in the outlook. */
export function warningsFor(nrt: NrtSeason, o: Outlook | null | undefined): DistrictWarning[] {
  const day0 = Date.parse(`${nrt.day0}T00:00:00Z`)
  const y = Number(nrt.season.slice(0, 4))
  const seasonDays = (Date.UTC(y + 1, 6, 1) - Date.UTC(y, 6, 1)) / DAY
  const iso = (day: number) => new Date(day0 + day * DAY).toISOString().slice(0, 10)
  const window = o?.window_days ?? WINDOW_DAYS
  const out: DistrictWarning[] = []
  for (const [id, d] of Object.entries(nrt.districts)) {
    const day = d.h.length - 1
    if (day < 0) continue
    const daysSince = d.last_unusual ? Math.round((day0 + day * DAY - Date.parse(`${d.last_unusual}T00:00:00Z`)) / DAY) : null
    const c = d.critical ? nextCritical(d.critical, day, seasonDays) : null
    const critical = c && { start: iso(c.start), end: iso(c.end), daysUntil: c.daysUntil }
    const recent = daysSince != null && daysSince < window
    const level: Level = recent ? 'unusual' : critical?.daysUntil === 0 ? 'critical' : critical && critical.daysUntil <= WINDOW_DAYS ? 'soon' : 'clear'
    out.push({ id, level, unusualDays: d.above_p90_days, daysSince, critical, outlook: o?.ships ? outlookWith(o, id, nrt, recent) : null })
  }
  const until = (w: DistrictWarning) => w.critical?.daysUntil ?? Infinity
  return out.sort((a, b) => RANK[a.level] - RANK[b.level] || (a.daysSince ?? Infinity) - (b.daysSince ?? Infinity)
    || b.unusualDays - a.unusualDays || until(a) - until(b) || a.id.localeCompare(b.id))
}
