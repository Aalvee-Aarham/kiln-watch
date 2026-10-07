// Numbers and dates in words, for the plain-language pages. Pure functions; tested in plain.test.ts.
import type { CI, KilnSeasonRow } from './types'

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** Season months in order: index 0 = July (seasons run 1 July – 30 June). */
export const SEASON_MONTHS = [...MONTHS.slice(6), ...MONTHS.slice(0, 6)]

/** Day of season (0 = 1 July) → "early December" / "mid-December" / "late December". Non-leap season year. */
export function whenText(dayOfSeason: number): string {
  const d = new Date(Date.UTC(2001, 6, 1 + Math.round(dayOfSeason)))
  const day = d.getUTCDate(), m = MONTHS[d.getUTCMonth()]
  return day <= 10 ? `early ${m}` : day <= 20 ? `mid-${m}` : `late ${m}`
}

/** Day of season → its month name ("February"). */
export const monthOfSeasonDay = (dayOfSeason: number) => MONTHS[new Date(Date.UTC(2001, 6, 1 + Math.round(dayOfSeason))).getUTCMonth()]

/** "about 150 days (about 5 months)". */
export const daysText = (days: number) => `about ${Math.round(days / 5) * 5} days (about ${Math.round(days / 30.44)} months)`

const median = (xs: number[]) => {
  const s = xs.slice().sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

/** Typical kiln season: median onset, end, peak and length over the last `n` seasons with a measured start and end. */
export function typicalSeason(rows: KilnSeasonRow[], n = 3): { onset: number; end: number; peak: number | null; duration: number; seasons: string[] } | null {
  const ok = rows.filter((r) => r.onset && r.end).slice(-n)
  if (!ok.length) return null
  const peaks = ok.flatMap((r) => (r.peak ? [r.peak.p50] : []))
  return {
    onset: median(ok.map((r) => r.onset!.p50)), end: median(ok.map((r) => r.end!.p50)),
    peak: peaks.length ? median(peaks) : null,
    duration: median(ok.map((r) => (r.duration ? r.duration.p50 : r.end!.p50 - r.onset!.p50))),
    seasons: ok.map((r) => r.season),
  }
}

/** Mean season length over the seasons in [from, to] (inclusive labels like "2012-13"); null if none measured. */
export function meanDuration(rows: KilnSeasonRow[], from: string, to: string): number | null {
  const xs = rows.filter((r) => r.season >= from && r.season <= to && r.duration).map((r) => (r.duration as CI).p50)
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

/**
 * The main burning months from a per-day-of-season mean (366 values from 1 July): the peak month, widened month by
 * month while a neighbour has at least `share` of the peak month's activity. Returns season-month indices (0 = July).
 */
export function busyMonths(perDay: number[], share = 0.25): { first: number; last: number; peak: number } | null {
  const starts = [0, 31, 62, 92, 123, 153, 184, 215, 243, 274, 304, 335, 366]
  const m = starts.slice(0, 12).map((a, i) => {
    const xs = perDay.slice(a, starts[i + 1])
    return xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length)
  })
  const max = Math.max(...m)
  if (!(max > 0)) return null
  const peak = m.indexOf(max)
  let first = peak, last = peak
  while (first > 0 && m[first - 1] >= share * max) first--
  while (last < 11 && m[last + 1] >= share * max) last++
  return { first, last, peak }
}
