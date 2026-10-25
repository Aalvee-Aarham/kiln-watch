// The farm year on the farmers' page (#/crops): harvests, the usual fire months and when to get ready, by calendar
// month. Pure functions; tested in farm.test.ts.

/** Calendar months (1–12) a day-of-year window covers, in order (a window may run past 31 December). */
export function windowMonths(startDoy: number, endDoy: number): number[] {
  const m = (doy: number) => new Date(Date.UTC(2001, 0, doy)).getUTCMonth() + 1
  const out: number[] = []
  for (let k = m(startDoy), i = 0; i < 12; i++, k = (k % 12) + 1) { out.push(k); if (k === m(endDoy)) break }
  return out
}

export type FarmMonth = { month: number; harvests: string[]; fire: 0 | 1 | 2; prepare: boolean }

/**
 * Twelve calendar months, January first. `busy` is busyMonths() output, in season months (0 = July): fire 1 = fields
 * are often burned, 2 = the busiest month. `prepare` marks the quiet month before burning usually begins.
 */
export function farmYear(harvests: { name: string; months: number[] }[], busy: { first: number; last: number; peak: number } | null): FarmMonth[] {
  const cal = (s: number) => ((s + 6) % 12) + 1
  const fire = new Map<number, 1 | 2>()
  if (busy) for (let s = busy.first; s <= busy.last; s++) fire.set(cal(s), s === busy.peak ? 2 : 1)
  const prep = busy ? cal((busy.first + 11) % 12) : 0
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    harvests: harvests.filter((h) => h.months.includes(i + 1)).map((h) => h.name),
    fire: fire.get(i + 1) ?? 0,
    prepare: i + 1 === prep && !fire.has(i + 1),
  }))
}

/** The same twelve months starting from `month` (1–12): what is coming next. */
export const fromMonth = <T,>(year: T[], month: number): T[] => [...year.slice(month - 1), ...year.slice(0, month - 1)]
