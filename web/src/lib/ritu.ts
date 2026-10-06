// The six Bengali seasons (ঋতু), Bangladesh's revised calendar (Pohela Boishakh = 14 April). Fixed Gregorian starts.
import type { Events } from './types'

export interface Ritu { key: string; en: string; bn: string; start: [month: number, day: number]; span: string }
export const RITUS: Ritu[] = [
  { key: 'grishma', en: 'Grishma', bn: 'গ্রীষ্ম', start: [4, 14], span: 'mid-Apr to mid-Jun' },
  { key: 'barsha', en: 'Barsha', bn: 'বর্ষা', start: [6, 15], span: 'mid-Jun to mid-Aug' },
  { key: 'sharat', en: 'Sharat', bn: 'শরৎ', start: [8, 16], span: 'mid-Aug to mid-Oct' },
  { key: 'hemanta', en: 'Hemanta', bn: 'হেমন্ত', start: [10, 16], span: 'mid-Oct to mid-Dec' },
  { key: 'sheet', en: 'Sheet', bn: 'শীত', start: [12, 15], span: 'mid-Dec to mid-Feb' },
  { key: 'basanta', en: 'Basanta', bn: 'বসন্ত', start: [2, 14], span: 'mid-Feb to mid-Apr' },
]

/** The ritu a UTC date falls in. */
export function rituOf(d: Date): Ritu {
  const md = (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
  const sorted = [...RITUS].sort((a, b) => a.start[0] * 100 + a.start[1] - (b.start[0] * 100 + b.start[1]))
  return [...sorted].reverse().find((r) => r.start[0] * 100 + r.start[1] <= md) ?? sorted.at(-1)!
}

export type Layout = 'cal' | 'season'
const MS = 86_400_000
// Reference years with 366 days so positions match the heatmap's 0..365 axis.
const origin = (layout: Layout) => (layout === 'season' ? Date.UTC(2003, 6, 1) : Date.UTC(2004, 0, 1))
const xOf = (layout: Layout, month: number, day: number) => {
  const y = layout === 'season' && month < 7 ? 2004 : layout === 'season' ? 2003 : 2004
  return Math.round((Date.UTC(y, month - 1, day) - origin(layout)) / MS)
}

/** Ritu bands as [x0, x1) on a 366-day axis; a ritu that wraps the axis end is split in two. */
export function rituSpans(layout: Layout): { ritu: Ritu; x0: number; x1: number }[] {
  const starts = RITUS.map((r) => ({ ritu: r, x: xOf(layout, ...r.start) })).sort((a, b) => a.x - b.x)
  const out: { ritu: Ritu; x0: number; x1: number }[] = []
  if (starts[0].x > 0) out.push({ ritu: starts.at(-1)!.ritu, x0: 0, x1: starts[0].x })
  starts.forEach((s, i) => out.push({ ritu: s.ritu, x0: s.x, x1: starts[i + 1]?.x ?? 366 }))
  return out
}

/** Harvest windows from events.json (1-based day of calendar year) mapped onto the layout's axis. */
export function harvestSpans(events: Events | undefined, layout: Layout): { crop: string; x0: number; x1: number }[] {
  return (events?.harvest ?? []).flatMap((h) => {
    if (layout === 'cal') return [{ crop: h.crop, x0: h.start_doy - 1, x1: h.end_doy }]
    const shift = (doy: number) => (doy - 1 + 366 - 182) % 366 // 1 Jul is day 182 of a leap year
    const a = shift(h.start_doy), b = shift(h.end_doy) + 1
    return a < b ? [{ crop: h.crop, x0: a, x1: b }] : [{ crop: h.crop, x0: a, x1: 366 }, { crop: h.crop, x0: 0, x1: b }]
  })
}
