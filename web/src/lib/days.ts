// Day index <-> date helpers. Day 0 = 2003-01-01 (UTC dates throughout).
export const DAY0 = Date.UTC(2003, 0, 1)
const MS = 86_400_000

export const dayToDate = (i: number, day0 = DAY0) => new Date(day0 + i * MS)
export const dateToDay = (d: Date | string, day0 = DAY0) =>
  Math.round(((typeof d === 'string' ? Date.parse(d + 'T00:00:00Z') : d.getTime()) - day0) / MS)
export const iso = (d: Date) => d.toISOString().slice(0, 10)
export const dayIso = (i: number) => iso(dayToDate(i))

/** Season year label: 1 Jul – 30 Jun, e.g. 2018-07-01 → "2018-19". */
export function seasonOf(d: Date): string {
  const y = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`
}

/** Days since 1 July of the date's season year (0..365). */
export function seasonDay(d: Date): number {
  const y = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1
  return Math.round((d.getTime() - Date.UTC(y, 6, 1)) / MS)
}

export const seasonStart = (season: string) => dateToDay(`${season.slice(0, 4)}-07-01`)
/** Day of season (days since 1 July) as a short date, e.g. 153 → "1 Dec". Pass the season so leap years land right. */
export const seasonDayLabel = (d: number, season?: string) =>
  new Date(Date.UTC(season ? +season.slice(0, 4) : 2001, 6, 1 + Math.round(d))).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
export const doy = (d: Date) => Math.round((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / MS) + 1
