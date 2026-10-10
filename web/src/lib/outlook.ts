import type { NrtSeason, Outlook } from './types'

export type OutlookNow =
  | { state: 'before' | 'after'; opens: string }
  | { state: 'on'; p: number; clim: number; recent: boolean; asOf: string }

const DAY = 86_400_000

/** Today's two-week outlook for one district, from the published table (validate.outlook) and the live season.
 * "Today" is the last day in the live file, not the clock, so the answer matches the data shown. A day is unusual
 * when it is above that day-of-season's 90th-percentile normal and above zero, as in the pipeline. */
export function outlookFor(o: Outlook, distId: string, nrt: NrtSeason, p90: number[]): OutlookNow | null {
  const t = o.districts[distId]
  const h = nrt.districts[distId]?.h
  if (!t || !h?.length) return null
  const last = h.length - 1
  const asOfMs = Date.parse(nrt.day0 + 'T00:00:00Z') + last * DAY
  const [mm, dd] = o.start.split('-').map(Number)
  const opens = Date.UTC(Number(nrt.season.slice(0, 4)), mm - 1, dd)
  const k = Math.floor((asOfMs - opens) / (o.step_days * DAY))
  const opensText = new Date(opens).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })
  if (k < 0) return { state: 'before', opens: opensText }
  if (k >= o.weeks) return { state: 'after', opens: opensText }
  let recent = false
  for (let i = Math.max(0, last - o.window_days + 1); i <= last; i++) if (h[i] > 0 && h[i] > p90[i % p90.length]) recent = true
  return { state: 'on', p: recent ? t.if_recent[k] : t.if_quiet[k], clim: t.clim[k], recent, asOf: new Date(asOfMs).toISOString().slice(0, 10) }
}
