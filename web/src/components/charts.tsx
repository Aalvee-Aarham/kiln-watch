import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { RituBand } from './ui'
import { EChart } from './EChart'
import { needsPattern, palette, splitColor, useTheme, type Palette } from '../lib/theme'
import { dense, heatmapCells, seriesFor, type Mode } from '../lib/calendar'
import { dateToDay, dayIso, dayToDate, seasonDay, seasonDayLabel, seasonOf, seasonStart } from '../lib/days'
import { rituOf } from '../lib/ritu'
import { monthNames, useLang, useT } from '../lib/i18n'
import type { Lang } from '../lib/url'
import type { Calendar, Events, Harmonization, KilnActivity, KilnArea, KilnSeasonRow, Meta, NrtSeason, Validation } from '../lib/types'

const MONTHS_SEASON = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
const seasonAxisLabel = (d: number) => MONTHS_SEASON[Math.min(11, Math.floor(d / 30.5))]

// Day index of each month's first day (non-leap), calendar-year and season-year (1 Jul) layouts.
const MONTH_STARTS = { cal: [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334], season: [0, 31, 62, 92, 123, 153, 184, 215, 243, 274, 304, 335] }
/** Day-of-year x axis labelled at real month starts (every other month on a phone), in the reader's language. */
function monthAxis(layout: 'cal' | 'season', lang: Lang, every = 1) {
  const names = monthNames(lang)
  const at = new Map(MONTH_STARTS[layout].map((d, k) => [d, k]))
  return {
    interval: (i: number) => at.has(i) && at.get(i)! % every === 0,
    formatter: (d: string) => names[layout === 'season' ? (at.get(+d)! + 6) % 12 : at.get(+d)!] ?? '',
  }
}
const r2 = (v: number) => Math.round(v * 100) / 100
const vf = (v: unknown) => (typeof v === 'number' ? r2(v).toLocaleString('en-US') : '–')

/** Narrow viewport: drop end labels (the HTML legend carries identity), thin the axis. */
function useNarrow() {
  return useSyncExternalStore(
    (l) => { const m = matchMedia('(max-width: 640px)'); m.addEventListener('change', l); return () => m.removeEventListener('change', l) },
    () => matchMedia('(max-width: 640px)').matches, () => false)
}

/** Palette that re-reads tokens when the theme flips (charts' useMemo deps change with it). */
function usePalette(): Palette {
  const theme = useTheme()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => palette(), [theme])
}

type Swatch = { label: string; color: string; kind?: 'line' | 'dash' | 'dot' | 'band' | 'bar' }
/** HTML legend in one row above the plot: it can't collide with canvas labels and wraps on phones. */
export function Legend({ items }: { items: Swatch[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {items.map((s) => (
        <li key={s.label} className="flex items-center gap-1.5">
          <svg width="18" height="10" aria-hidden>
            {s.kind === 'band' || s.kind === 'bar' ? <rect x="1" y="1" width="16" height="8" rx="2" fill={s.color} opacity={s.kind === 'band' ? 0.45 : 1} />
              : s.kind === 'dot' ? <circle cx="9" cy="5" r="3.5" fill={s.color} />
              : <line x1="1" y1="5" x2="17" y2="5" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.kind === 'dash' ? '4 3' : undefined} />}
          </svg>
          {s.label}
        </li>
      ))}
    </ul>
  )
}

const plumDecal = { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 4], rotation: -Math.PI / 4, color: 'rgba(255,255,255,0.35)' }

/** Raw vs harmonized season totals: the 2012 jump disappears after harmonization. */
export function JumpChart({ h }: { h: Harmonization }) {
  const p = usePalette()
  const narrow = useNarrow()
  const opt = useMemo(() => {
    const s = h.yearly.map((y) => y.season)
    // The Aqua check is meant to land on the harmonized line, so their end labels can collide (labelLayout skips end labels):
    // within ~one label height of plot space, push the higher one up and the lower one down.
    const lastH = h.yearly.at(-1)?.h.p50 ?? 0, lastA = h.yearly.findLast((y) => y.aqua_obs != null)?.aqua_obs ?? lastH
    const yMax = Math.max(...h.yearly.flatMap((y) => [y.raw_sum, y.h.hi, y.aqua_obs ?? 0]), 1)
    const gapPx = (Math.abs(lastH - lastA) / yMax) * 260 // ≈ plot height of the 330px chart
    const nudge = gapPx < 14 ? (14 - gapPx) / 2 + 1 : 0
    const end = (text: string, color: string, dy = 0) => (narrow ? undefined : { show: true, formatter: text, color, fontSize: 12, fontWeight: 600, offset: [0, dy] })
    return {
      grid: { left: 44, right: narrow ? 12 : 104, top: 28, bottom: 28 },
      tooltip: { trigger: 'axis', valueFormatter: vf },
      xAxis: { type: 'category', data: s, boundaryGap: false, axisLabel: { hideOverlap: true } },
      yAxis: { type: 'value', name: 'Season activity (MYD-eq)' },
      series: [
        { name: 'Raw (spliced sensors)', type: 'line', data: h.yearly.map((y) => r2(y.raw_sum)), color: p.raw, lineStyle: { type: 'dashed', width: 1.5 }, endLabel: end('Raw', p.muted),
          markLine: { silent: true, symbol: 'none', lineStyle: { color: p.muted, type: 'dotted' }, label: { formatter: 'VIIRS 375 m arrives', position: 'insideEndTop', color: p.muted, fontSize: 11 },
            data: [{ xAxis: '2012-13' }] } },
        { name: 'CI low', type: 'line', data: h.yearly.map((y) => r2(y.h.lo)), stack: 'ci', lineStyle: { opacity: 0 }, tooltip: { show: false } },
        { name: '95% interval', type: 'line', data: h.yearly.map((y) => r2(y.h.hi - y.h.lo)), stack: 'ci', lineStyle: { opacity: 0 }, areaStyle: { color: p.heat, opacity: 0.18 }, tooltip: { show: false } },
        { name: 'Harmonized (MYD-eq)', type: 'line', data: h.yearly.map((y) => r2(y.h.p50)), color: p.heat, lineStyle: { width: 2.5 }, endLabel: end('Harmonized', p.heat, lastH >= lastA ? -nudge : nudge) },
        { name: 'Aqua as observed (check)', type: 'line', data: h.yearly.map((y) => (y.aqua_obs == null ? null : r2(y.aqua_obs))), color: p.orbit, symbol: 'circle', symbolSize: 6,
          itemStyle: { borderColor: p.surface, borderWidth: 1.5 }, lineStyle: { width: 1.5 }, endLabel: end('Aqua check', p.orbit, lastH >= lastA ? nudge : -nudge) },
      ],
    }
  }, [h, p, narrow])
  return (
    <>
      <Legend items={[{ label: 'Raw, sensors spliced', color: p.raw, kind: 'dash' }, { label: 'Harmonized (MYD-eq)', color: p.heat }, { label: '95% interval', color: p.heat, kind: 'band' }, { label: 'Aqua as observed (same sensor throughout)', color: p.orbit, kind: 'dot' }]} />
      <EChart option={opt} height={330} label={`Season totals: the raw series jumps from ${r2(h.seam.d_raw)} units in 2012 while the harmonized series moves ${r2(h.seam.d_harm)}`} exportName="kilnwatch_jump" />
    </>
  )
}

/** Kiln clusters vs matched controls through the gate season: plateau vs spikes, day and night. */
export function PlateauSpikeChart({ v }: { v: Validation }) {
  const p = usePalette()
  const pr = v.profiles
  const opt = useMemo(() => ({
    grid: { left: 44, right: 16, top: 28, bottom: 28 }, tooltip: { trigger: 'axis', valueFormatter: vf },
    xAxis: { type: 'category', data: pr.week, axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value', name: 'Share of clear days with a detection' },
    series: [
      { name: 'Kiln clusters · day', type: 'line', data: pr.kiln_day, color: p.brick, lineStyle: { width: 2.5 } },
      { name: 'Kiln clusters · night', type: 'line', data: pr.kiln_night, color: p.brick, lineStyle: { type: 'dashed', width: 1.5 } },
      { name: 'Matched controls · day', type: 'line', data: pr.ctrl_day, color: p.orbit, lineStyle: { width: 2.5 } },
      { name: 'Matched controls · night', type: 'line', data: pr.ctrl_night, color: p.orbit, lineStyle: { type: 'dashed', width: 1.5 } },
    ],
  }), [pr, p])
  return (
    <>
      <Legend items={[{ label: 'Kiln clusters, day', color: p.brick }, { label: 'night', color: p.brick, kind: 'dash' }, { label: 'Matched controls, day', color: p.orbit }, { label: 'night', color: p.orbit, kind: 'dash' }]} />
      <EChart option={opt} height={300} label="Weekly detection rate at kiln clusters versus matched control sites" exportName="kilnwatch_plateau" />
    </>
  )
}

const HEAT_GRID = { left: 56, right: 12, top: 4, bottom: 52 }

/** Year × day heatmap of daily activity. Cloud = cool neutral; zero-activity observed days = the plate itself. Click a day to open its season. */
export function CalendarHeatmap({ cal, mode, split, layout, events, onPickDay }: {
  cal: Calendar; mode: Mode; split: string; layout: 'cal' | 'season'; events?: Events; onPickDay?: (day: number) => void
}) {
  const p = usePalette()
  const lang = useLang()
  const t = useT()
  const narrow = useNarrow()
  // Row cascade on the first draw only; later mode/split/layout changes just recolour.
  const drawn = useRef(false)
  useEffect(() => { drawn.current = true }, [])
  const { opt, years } = useMemo(() => {
    const { cells, years } = heatmapCells(cal, seriesFor(cal, mode, split), layout)
    const vals = cells.map((c) => c[2]).filter((v) => v > 0).sort((a, b) => a - b)
    const vmax = vals[Math.floor(vals.length * 0.98)] ?? 1
    const ylab = years.map((y) => (layout === 'season' ? `${y}-${String((y + 1) % 100).padStart(2, '0')}` : String(y)))
    const dateOf = (x: number, yi: number) => new Date(layout === 'season' ? Date.UTC(years[0] + yi, 6, 1 + x) : Date.UTC(years[0] + yi, 0, 1 + x))
    const animate = !drawn.current
    const opt = {
      grid: { ...HEAT_GRID, show: true, backgroundColor: p.surface2, borderWidth: 0 },
      tooltip: { formatter: (q: { value: [number, number, number] }) => {
        const [x, yi, v] = q.value
        const d = dateOf(x, yi)
        const r = rituOf(d)
        return `<b>${d.toISOString().slice(0, 10)}</b> · ${lang === 'bn' ? r.bn : r.en}<br/>${v < 0 ? t('notObserved') : `<b>${r2(v)}</b> ${t('perClear')}`}<br/><span style="opacity:.7">${t('clickSeason')}</span>`
      } },
      // Crosshair (day rule + year-row shade): a 1–2px cell's own highlight is too small to see.
      xAxis: { type: 'category', data: Array.from({ length: 366 }, (_, i) => i),
        axisLabel: { hideOverlap: true, ...monthAxis(layout, lang, narrow ? 2 : 1) }, axisLine: { show: false },
        axisPointer: { show: true, type: 'line', triggerTooltip: false, triggerEmphasis: false, label: { show: false }, lineStyle: { color: p.ink, opacity: 0.55, type: 'solid' } } },
      yAxis: { type: 'category', data: ylab, inverse: true, axisLine: { show: false }, axisLabel: { interval: years.length > 16 ? 1 : 0 },
        axisPointer: { show: true, type: 'line', triggerTooltip: false, triggerEmphasis: false, label: { show: false }, lineStyle: { color: p.ink, opacity: 0.55, type: 'solid' } } },
      visualMap: { type: 'piecewise', orient: 'horizontal', left: narrow ? 8 : HEAT_GRID.left, bottom: 0, itemWidth: 14, itemHeight: 10, itemGap: narrow ? 4 : 6, textStyle: { color: p.muted },
        pieces: [{ lt: 0, color: p.cloud, label: narrow ? t('cloud') : t('notObserved') },
          { gte: 0, lt: vmax * 0.1, color: p.fire[0], label: t('low') }, { gte: vmax * 0.1, lt: vmax * 0.3, color: p.fire[1], label: ' ' },
          { gte: vmax * 0.3, lt: vmax * 0.55, color: p.fire[2], label: ' ' }, { gte: vmax * 0.55, lt: vmax * 0.8, color: p.fire[3], label: ' ' },
          { gte: vmax * 0.8, color: p.fire[4], label: t('high') }] },
      series: [{ type: 'heatmap', data: cells, progressive: 5000, cursor: 'inherit', emphasis: { itemStyle: { borderColor: p.ink, borderWidth: 2 } },
        animationDuration: animate ? 400 : 200, animationDelay: animate ? (i: number) => (cells[i]?.[1] ?? 0) * 25 : 0 }],
    }
    return { opt, years }
  }, [cal, mode, split, layout, p, lang, t, narrow])
  const click = (q: { value?: unknown }) => {
    if (!onPickDay || !Array.isArray(q.value)) return
    const [x, yi] = q.value as number[]
    const d = layout === 'season' ? Date.UTC(years[0] + yi, 6, 1 + x) : Date.UTC(years[0] + yi, 0, 1 + x)
    onPickDay(dateToDay(new Date(d)))
  }
  return (
    <>
      <RituBand layout={layout} events={events} left={HEAT_GRID.left} right={HEAT_GRID.right} />
      <EChart option={opt} height={years.length * 18 + 64} measure onClick={click}
        label={`Calendar heatmap of daily burning activity, ${years[0]} to ${years.at(-1)}. Each row is a year, each cell a day.`} exportName="kilnwatch_calendar" />
    </>
  )
}

const BAND_GRID = { left: 48, right: 16, top: 16, bottom: 28 }

/** One season against the normal range (p10–p90), unusual days marked, critical periods labelled. */
export function NormalBandChart({ cal, season, mode, split, events, markDay }: { cal: Calendar; season: string; mode: Mode; split: string; events?: Events; markDay?: number }) {
  const p = usePalette()
  const lang = useLang()
  const t = useT()
  const narrow = useNarrow()
  const opt = useMemo(() => {
    const d0 = seasonStart(season)
    const dz = dense(cal, seriesFor(cal, mode, split))
    const x = Array.from({ length: 366 }, (_, i) => i)
    const sm = (a: ArrayLike<number>, i: number) => { let s = 0, n = 0; for (let k = i - 3; k <= i + 3; k++) { const v = a[d0 + k]; if (Number.isFinite(v)) { s += v; n++ } } return n ? r2(s / n) : null }
    const cur = x.map((i) => (d0 + i < dz.length ? sm(dz, i) : null))
    const unusualSet = new Set(cal.unusual)
    const unusual = x.filter((i) => unusualSet.has(d0 + i)).map((i) => [i, cur[i]])
    const today = seasonOf(new Date()) === season ? seasonDay(new Date()) : null
    const rules = [
      ...(today != null ? [{ xAxis: today, lineStyle: { color: p.muted, type: 'dashed' }, label: { formatter: t('today'), color: p.muted } }] : []),
      ...(markDay != null && markDay >= 0 && markDay < 366 ? [{ xAxis: markDay, lineStyle: { color: p.orbit, width: 1.5, type: 'solid' }, label: { formatter: dayIso(d0 + markDay), color: p.orbit } }] : []),
    ]
    return {
      grid: BAND_GRID, tooltip: { trigger: 'axis', valueFormatter: vf },
      xAxis: { type: 'category', data: x, boundaryGap: false, axisLabel: { hideOverlap: true, ...monthAxis('season', lang, narrow ? 2 : 1) } },
      yAxis: { type: 'value', name: t('perClear') },
      series: [
        { name: 'p10', type: 'line', data: cal.normal.p10, stack: 'n', lineStyle: { opacity: 0 }, tooltip: { show: false } },
        { name: t('normalRange'), type: 'line', data: cal.normal.p90.map((v, i) => r2(v - cal.normal.p10[i])), stack: 'n', lineStyle: { opacity: 0 }, areaStyle: { color: p.band, opacity: 0.7 }, tooltip: { show: false },
          markArea: { silent: true, itemStyle: { color: p.heat, opacity: 0.07 }, label: { show: true, position: 'insideTop', formatter: t('critical'), color: p.muted, fontSize: 11 },
            data: cal.critical.map(([a, b]) => [{ xAxis: a }, { xAxis: b }]) } },
        { name: t('median'), type: 'line', data: cal.normal.p50, color: p.muted, lineStyle: { type: 'dotted', width: 1.5 } },
        { name: `${season}, ${t('mean7')}`, type: 'line', data: cur, color: p.heat, lineStyle: { width: 2.5 },
          markLine: rules.length ? { silent: true, symbol: 'none', label: { position: 'insideEndTop', fontSize: 11 }, data: rules } : undefined },
        { name: t('unusualDay'), type: 'scatter', data: unusual, color: p.fire[4], symbolSize: 8, itemStyle: { borderColor: p.surface, borderWidth: 2 } },
      ],
    }
  }, [cal, season, mode, split, p, markDay, lang, t, narrow])
  return (
    <>
      <Legend items={[{ label: t('normalRange'), color: p.band, kind: 'band' }, { label: t('median'), color: p.muted, kind: 'dash' }, { label: `${season}, ${t('mean7')}`, color: p.heat }, { label: t('unusualDay'), color: p.fire[4], kind: 'dot' }]} />
      <RituBand layout="season" events={events} left={BAND_GRID.left} right={BAND_GRID.right} />
      <EChart option={opt} height={300} label={`Season ${season} compared with the normal range`} exportName="kilnwatch_normal" />
    </>
  )
}

const splitLabel = (meta: Meta, key: string, lang: 'en' | 'bn') => {
  const l = meta.split_labels.find((x) => x.key === key)
  return l ? (lang === 'bn' ? l.label_bn : l.label_en) : key
}

/** Season totals by source. Colour follows the split key (theme.SPLIT_SLOT); 1px surface seams between segments. */
export function SourceStackChart({ cal, meta, lang }: { cal: Calendar; meta: Meta; lang: 'en' | 'bn' }) {
  const p = usePalette()
  const t = useT()
  const opt = useMemo(() => {
    const bySeason = new Map<string, number[]>()
    cal.days.forEach((d, i) => {
      const s = seasonOf(dayToDate(d))
      const row = bySeason.get(s) ?? cal.split.map(() => 0)
      cal.split.forEach((sp, k) => { row[k] += sp.values[i] })
      bySeason.set(s, row)
    })
    // Whole seasons only: a season the record covers in part (2002-03 starts in January) would read as a quiet year.
    const first = cal.days[0], last = cal.days.at(-1) ?? first
    const seasons = [...bySeason.keys()].sort().filter((s) => seasonStart(s) >= first && seasonStart(s) + 364 <= last)
    return {
      grid: { left: 48, right: 16, top: 16, bottom: 28 }, tooltip: { trigger: 'axis', valueFormatter: vf },
      xAxis: { type: 'category', data: seasons, axisLabel: { hideOverlap: true } }, yAxis: { type: 'value', name: t('seasonSum') },
      series: cal.split.map((sp, k) => ({
        name: splitLabel(meta, sp.key, lang), type: 'bar', stack: 's', barMaxWidth: 28, color: splitColor(sp.key, p, k),
        itemStyle: { borderColor: p.surface, borderWidth: 1, borderRadius: k === cal.split.length - 1 ? [3, 3, 0, 0] : 0, decal: needsPattern(sp.key) ? plumDecal : undefined },
        data: seasons.map((s) => r2(bySeason.get(s)![k])),
      })),
    }
  }, [cal, meta, lang, p, t])
  return (
    <>
      <Legend items={cal.split.map((sp, k) => ({ label: splitLabel(meta, sp.key, lang), color: splitColor(sp.key, p, k), kind: 'bar' as const }))} />
      <EChart option={opt} height={280} label="Season totals split by heat source" exportName="kilnwatch_sources" />
    </>
  )
}

export function SeasonDurationChart({ cal, events }: { cal: Calendar; events?: Events }) {
  const p = usePalette()
  const opt = useMemo(() => ({
    grid: { left: 48, right: 16, top: 28, bottom: 28 }, tooltip: { trigger: 'axis', valueFormatter: vf },
    xAxis: { type: 'category', data: cal.seasons.map((s) => s.season), axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value', name: 'Firing-season length (days)' },
    series: [
      { name: 'lo', type: 'line', data: cal.seasons.map((s) => s.duration.lo), stack: 'ci', lineStyle: { opacity: 0 }, tooltip: { show: false } },
      { name: '95% CI', type: 'line', data: cal.seasons.map((s) => r2(s.duration.hi - s.duration.lo)), stack: 'ci', lineStyle: { opacity: 0 }, areaStyle: { color: p.brick, opacity: 0.15 }, tooltip: { show: false } },
      { name: 'Duration', type: 'line', data: cal.seasons.map((s) => s.duration.p50), color: p.brick, lineStyle: { width: 2.5 },
        markLine: { symbol: 'none', lineStyle: { color: p.muted, type: 'dotted' },
          data: (events?.policy ?? []).map((e, i) => ({ xAxis: seasonOf(new Date(e.date + 'T00:00:00Z')), label: { formatter: e.label_en, color: p.muted, fontSize: 11, position: i % 2 ? 'insideEndBottom' : 'insideEndTop' } })) } },
    ],
  }), [cal, events, p])
  return <EChart option={opt} height={300} label="Length of the burning season by year with confidence interval" exportName="kilnwatch_duration" />
}

/** Current season, weekly: the stack is the total, so there is no separate total line. */
export function SeasonToDateChart({ nrt, meta, lang }: { nrt: NrtSeason; meta: Meta; lang: 'en' | 'bn' }) {
  const p = usePalette()
  const opt = useMemo(() => {
    const d0 = dateToDay(nrt.day0)
    const weeks = Math.ceil(nrt.national.h.length / 7)
    const label = Array.from({ length: weeks }, (_, w) => new Date(dayIso(d0 + w * 7) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('Sept', 'Sep'))
    const sumWeek = (a: number[], w: number) => r2(a.slice(w * 7, w * 7 + 7).reduce((s, v) => s + v, 0))
    return {
      grid: { left: 44, right: 16, top: 16, bottom: 28 },
      tooltip: { trigger: 'axis', valueFormatter: vf },
      xAxis: { type: 'category', data: label, axisLabel: { hideOverlap: true } }, yAxis: { type: 'value', name: 'Week sum, MYD-eq (provisional)' },
      series: nrt.national.split.map((s, k) => ({
        name: splitLabel(meta, s.key, lang), type: 'bar', stack: 's', barMaxWidth: 26, color: splitColor(s.key, p, k),
        itemStyle: { borderColor: p.surface, borderWidth: 1, decal: needsPattern(s.key) ? plumDecal : undefined },
        data: Array.from({ length: weeks }, (_, w) => sumWeek(s.values, w)),
      })),
    }
  }, [nrt, meta, lang, p])
  return (
    <>
      <Legend items={nrt.national.split.map((s, k) => ({ label: splitLabel(meta, s.key, lang), color: splitColor(s.key, p, k), kind: 'bar' as const }))} />
      <EChart option={opt} height={280} label="Current season to date, national, weekly totals by source" exportName="kilnwatch_nrt" />
    </>
  )
}

export function RadiusSweepChart({ v }: { v: Validation }) {
  const p = usePalette()
  const opt = useMemo(() => ({
    grid: { left: 44, right: 12, top: 16, bottom: 28 }, tooltip: { trigger: 'axis', valueFormatter: vf },
    xAxis: { type: 'category', data: v.radius_sweep.map((r) => `${r.radius_m} m`) }, yAxis: { type: 'value', name: 'Mean detection rate' },
    series: [{ name: 'Kiln clusters', type: 'bar', data: v.radius_sweep.map((r) => r.kiln), color: p.brick, barGap: '15%', barMaxWidth: 22 },
      { name: 'Controls', type: 'bar', data: v.radius_sweep.map((r) => r.ctrl), color: p.orbit, barMaxWidth: 22 }],
  }), [v, p])
  return (
    <>
      <Legend items={[{ label: 'Kiln clusters', color: p.brick, kind: 'bar' }, { label: 'Matched controls', color: p.orbit, kind: 'bar' }]} />
      <EChart label="Detection rate by linking radius at kilns and controls" exportName="kilnwatch_radius" height={240} option={opt} />
    </>
  )
}

export function PRCurveChart({ v }: { v: Validation }) {
  const p = usePalette()
  const opt = useMemo(() => ({
    grid: { left: 44, right: 16, top: 16, bottom: 36 }, tooltip: { trigger: 'axis', valueFormatter: vf },
    xAxis: { type: 'value', name: 'Recall', nameLocation: 'middle', nameGap: 24, min: 0, max: 1 }, yAxis: { type: 'value', name: 'Precision', min: 0, max: 1 },
    series: [{ type: 'line', data: v.classifier.pr_curve, color: p.heat, name: 'Classifier', areaStyle: { color: p.heat, opacity: 0.1 },
      markLine: { symbol: 'none', silent: true, lineStyle: { color: p.muted, type: 'dashed' }, data: [{ yAxis: v.classifier.prevalence, label: { formatter: 'prevalence (chance)', position: 'insideEndTop', color: p.muted, fontSize: 11 } }] } }],
  }), [v, p])
  return <EChart label="Precision-recall curve of the kiln classifier" exportName="kilnwatch_pr" height={240} option={opt} />
}

/** Two small multiples sharing the month axis — never two y-scales on one plot. */
export function TropomiChart({ v }: { v: Validation }) {
  const p = usePalette()
  const t = v.tropomi
  const opt = useMemo(() => {
    if (!t) return {}
    const months = t.monthly.map((m) => m.month)
    return {
      grid: [{ left: 56, right: 12, top: 22, height: '32%' }, { left: 56, right: 12, bottom: 28, height: '32%' }],
      tooltip: { trigger: 'axis', valueFormatter: vf }, axisPointer: { link: [{ xAxisIndex: 'all' }] },
      title: [{ text: 'NO₂, kiln belt minus ring', left: 56, top: 0, textStyle: { fontSize: 12, fontWeight: 500, color: p.muted } },
        { text: `Activity index (${t.treatment})`, left: 56, top: '50%', textStyle: { fontSize: 12, fontWeight: 500, color: p.muted } }],
      xAxis: [{ type: 'category', data: months, gridIndex: 0, axisLabel: { show: false } }, { type: 'category', data: months, gridIndex: 1, axisLabel: { hideOverlap: true } }],
      yAxis: [{ type: 'value', gridIndex: 0, axisLabel: { formatter: (x: number) => x.toExponential(0) } }, { type: 'value', gridIndex: 1 }],
      series: [{ name: 'NO₂ belt − ring', type: 'bar', data: t.monthly.map((m) => m.belt_minus_ring), color: p.muted, xAxisIndex: 0, yAxisIndex: 0, barMaxWidth: 18 },
        { name: t.treatment, type: 'line', data: t.monthly.map((m) => m.index), color: p.heat, xAxisIndex: 1, yAxisIndex: 1 }],
    }
  }, [t, p])
  if (!t || !t.monthly.length) return null
  return <EChart label="TROPOMI NO2 belt-minus-ring and the activity index by month, as two stacked panels" exportName="kilnwatch_tropomi" height={300} option={opt} />
}

export function Pm25LagChart({ v, nokiln }: { v: Validation; nokiln?: boolean }) {
  const p = usePalette()
  const [a, b] = nokiln ? ['Non-harvest burning', 'Harvest-window burning'] : ['Kiln index', 'Vegetation index']
  const [ca, cb] = nokiln ? [p.plum, p.paddy] : [p.brick, p.jute]
  const opt = useMemo(() => !v.pm25 ? {} : ({
    grid: { left: 44, right: 12, top: 16, bottom: 28 }, tooltip: { trigger: 'axis', valueFormatter: vf },
    xAxis: { type: 'category', data: v.pm25.map((x) => `lag ${x.lag} d`) }, yAxis: { type: 'value', name: 'partial r' },
    series: [{ name: a, type: 'bar', data: v.pm25.map((x) => x.r_kiln.p50), color: ca, barMaxWidth: 20,
      markLine: { symbol: 'none', silent: true, lineStyle: { color: p.ink, type: 'solid', width: 1 }, label: { show: false }, data: [{ yAxis: 0 }] } },
    { name: b, type: 'bar', data: v.pm25.map((x) => x.r_veg.p50), color: cb, barMaxWidth: 20 }],
  }), [v, p, a, b, ca, cb])
  if (!v.pm25?.length) return null
  return (
    <>
      <Legend items={[{ label: a, color: ca, kind: 'bar' }, { label: b, color: cb, kind: 'bar' }]} />
      <EChart label="Partial correlation of Dhaka PM2.5 with burning indices by lag" exportName="kilnwatch_pm25" height={220} option={opt} />
    </>
  )
}

// --- kiln activity (Amendment 1: night lights / radar) -------------------------------------------
const quant = (xs: number[], q: number) => {
  const s = xs.slice().sort((a, b) => a - b)
  if (!s.length) return null
  const i = (s.length - 1) * q, lo = Math.floor(i)
  return r2(s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo))
}

/** Position of each period in its season (half-month bins 0–23, or month bins 0–11) and its season label. */
export function kilnBins(ka: KilnActivity, periods = ka.periods ?? []) {
  const nb = ka.cadence === 'month' ? 12 : 24
  const at = periods.map((s) => {
    const d = new Date(s + 'T00:00:00Z')
    const m = (d.getUTCMonth() + 6) % 12
    return { season: seasonOf(d), bin: nb === 12 ? m : m * 2 + (d.getUTCDate() >= 16 ? 1 : 0) }
  })
  const label = (b: number) => (nb === 12 ? MONTHS_SEASON[b] : b % 2 ? '' : MONTHS_SEASON[b / 2])
  return { nb, at, label, seasons: [...new Set(at.map((a) => a.season))] }
}

/**
 * The kiln season shape: median kiln excess by time of season (band = middle half of seasons), one highlighted season,
 * and optionally the area's average fire season underneath — two burning seasons, two sensors, two panels on one time axis.
 */
export function KilnSeasonShapeChart({ ka, area, season, burning }: { ka: KilnActivity; area: KilnArea; season?: string; burning?: number[] }) {
  const p = usePalette()
  const t = useT()
  const lang = useLang()
  const unit = ka.layer === 's1' ? 'dB' : 'nW/cm²/sr'
  const opt = useMemo(() => {
    const { nb, at } = kilnBins(ka)
    const ms = monthNames(lang)
    const label = (b: number) => (nb === 12 ? ms[(b + 6) % 12] : b % 2 ? '' : ms[(b / 2 + 6) % 12])
    const byBin: number[][] = Array.from({ length: nb }, () => [])
    const sel: (number | null)[] = Array(nb).fill(null)
    at.forEach((a, i) => { const v = area.e?.[i]; if (v != null) { byBin[a.bin].push(v); if (a.season === season) sel[a.bin] = v } })
    const p25 = byBin.map((xs) => quant(xs, 0.25)), p50 = byBin.map((xs) => quant(xs, 0.5)), p75 = byBin.map((xs) => quant(xs, 0.75))
    const burnBins = burning ? Array.from({ length: nb }, (_, b) => {
      const xs = burning.slice(Math.round((b * 366) / nb), Math.round(((b + 1) * 366) / nb))
      return Number((xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length)).toPrecision(3)) // small rates: keep significant digits
    }) : null
    const bins = Array.from({ length: nb }, (_, b) => b)
    const xAxis = (gridIndex: number, show: boolean) => ({ type: 'category', data: bins, gridIndex, boundaryGap: false, axisLabel: { show, interval: 0, formatter: (b: string) => label(+b) } })
    const grids = burnBins ? [{ left: 52, right: 12, top: 24, height: '46%' }, { left: 52, right: 12, bottom: 28, height: '24%' }] : [{ left: 52, right: 12, top: 24, bottom: 28 }]
    return {
      // One readout for both panels, headed by the time of season (not the bin index).
      grid: grids, axisPointer: { link: [{ xAxisIndex: 'all' }] },
      tooltip: { trigger: 'axis', formatter: (ps: { axisValue: string; marker: string; seriesName: string; value: unknown }[]) => `<b>${kilnWhen(nb, +ps[0].axisValue, lang)}</b>`
        + ps.filter((x) => typeof x.value === 'number').map((x) => `<br/>${x.marker}${x.seriesName}<b style="float:right;margin-left:20px">${vf(x.value)}</b>`).join('') },
      xAxis: burnBins ? [xAxis(0, false), xAxis(1, true)] : [xAxis(0, true)],
      yAxis: [{ type: 'value', gridIndex: 0, name: `${t('kilnExcess')} (${unit})` }, ...(burnBins ? [{ type: 'value', gridIndex: 1, name: t('fireActivity') }] : [])],
      series: [
        { name: 'p25', type: 'line', data: p25, stack: 'iqr', lineStyle: { opacity: 0 }, tooltip: { show: false } },
        { name: t('middleHalf'), type: 'line', data: p75.map((v, i) => (v == null || p25[i] == null ? null : r2(v - p25[i]!))), stack: 'iqr', lineStyle: { opacity: 0 }, areaStyle: { color: p.brick, opacity: 0.18 }, tooltip: { show: false } },
        { name: t('kilnTypical'), type: 'line', data: p50, color: p.brick, lineStyle: { width: 2.5 } },
        ...(season ? [{ name: season, type: 'line', data: sel, color: p.ink, lineStyle: { type: 'dashed', width: 1.5 } }] : []),
        ...(burnBins ? [{ name: t('firesAvg'), type: 'line', xAxisIndex: 1, yAxisIndex: 1, data: burnBins, color: p.heat, lineStyle: { width: 2 }, areaStyle: { color: p.heat, opacity: 0.12 } }] : []),
      ],
    }
  }, [ka, area, season, burning, p, unit, t, lang])
  return (
    <>
      <Legend items={[{ label: t('kilnTypical'), color: p.brick }, { label: t('middleHalf'), color: p.brick, kind: 'band' },
        ...(season ? [{ label: season, color: p.ink, kind: 'dash' as const }] : []), ...(burning ? [{ label: `${t('firesAvg')} (${t('lowerPanel')})`, color: p.heat }] : [])]} />
      <EChart option={opt} height={burning ? 380 : 300} label="Kiln night-light excess through the season, with the area's fire season in a separate panel below" exportName="kilnwatch_kiln_shape" />
    </>
  )
}

/** A kiln bin as a time of season: "Jan" (monthly) or "Jan 1–15" / "Jan 16–end" (half-monthly). */
function kilnWhen(nb: number, b: number, lang: Lang) {
  const m = monthNames(lang)[(Math.floor(nb === 12 ? b : b / 2) + 6) % 12]
  return nb === 12 ? m : `${m} ${b % 2 ? (lang === 'bn' ? '১৬–শেষ' : '16–end') : (lang === 'bn' ? '১–১৫' : '1–15')}`
}

/** Kiln calendar: one row per season, one cell per half-month; colour = kiln excess over the monsoon baseline. */
export function KilnCalendarHeatmap({ ka, area }: { ka: KilnActivity; area: KilnArea }) {
  const p = usePalette()
  const opt = useMemo(() => {
    const k = kilnBins(ka)
    const { nb, at, label } = k
    const seasons = k.seasons.filter((s) => at.filter((a) => a.season === s).length >= nb / 2) // drop part-seasons at the record's start
    const cells: [number, number, number][] = []
    at.forEach((a, i) => { const v = area.e?.[i]; const y = seasons.indexOf(a.season); if (v != null && y >= 0) cells.push([a.bin, y, r2(v)]) })
    const vals = cells.map((c) => c[2]).sort((a, b) => a - b)
    const vmax = Math.max(0.05, vals[Math.floor(vals.length * 0.97)] ?? 1)
    const when = (b: number) => kilnWhen(nb, b, 'en')
    return {
      grid: { left: 64, right: 12, top: 8, bottom: 52, show: true, backgroundColor: p.surface2, borderWidth: 0 },
      tooltip: { formatter: (x: { value: [number, number, number] }) => `<b>${seasons[x.value[1]]}</b> · ${when(x.value[0])}<br/>kiln excess ${x.value[2]}` },
      xAxis: { type: 'category', data: Array.from({ length: nb }, (_, b) => b), axisLine: { show: false }, axisLabel: { interval: 0, hideOverlap: true, formatter: (b: string) => label(+b) } },
      yAxis: { type: 'category', data: seasons, inverse: true, axisLine: { show: false } },
      visualMap: { type: 'piecewise', orient: 'horizontal', left: 64, bottom: 0, itemWidth: 14, itemHeight: 10, textStyle: { color: p.muted },
        pieces: [{ lt: vmax * 0.15, color: p.surface2, label: 'Quiet' }, { gte: vmax * 0.15, lt: vmax * 0.4, color: p.fire[0], label: ' ' },
          { gte: vmax * 0.4, lt: vmax * 0.7, color: p.fire[2], label: ' ' }, { gte: vmax * 0.7, color: p.fire[4], label: 'Kilns busy' }] },
      series: [{ type: 'heatmap', data: cells, cursor: 'inherit', itemStyle: { borderColor: p.surface, borderWidth: 1 } }],
    }
  }, [ka, area, p])
  return <EChart option={opt} height={Math.max(240, 22 * 16)} measure label="Kiln calendar: kiln activity by season and half-month" exportName="kilnwatch_kiln_calendar" />
}

/** Kiln season window per season (onset to end, days from 1 July), with policy events marked. */
export function KilnTimingChart({ rows, events }: { rows: KilnSeasonRow[]; events?: Events }) {
  const p = usePalette()
  const opt = useMemo(() => {
    const ok = rows.filter((r) => r.onset && r.end)
    const s = ok.map((r) => r.season)
    const f = (c: KilnSeasonRow['onset'], season: string) => (c ? `${seasonDayLabel(c.p50, season)} (95% ${seasonDayLabel(c.lo, season)}–${seasonDayLabel(c.hi, season)})` : '–')
    return {
      grid: { left: 52, right: 16, top: 16, bottom: 28 },
      tooltip: { trigger: 'axis', formatter: (xs: { dataIndex: number }[]) => {
        const r = ok[xs[0].dataIndex]
        return `<b>${r.season}</b><br/>Onset ${f(r.onset, r.season)}<br/>End ${f(r.end, r.season)}<br/>Length ${r.duration ? `${r.duration.p50} days [${r.duration.lo}–${r.duration.hi}]` : '–'}`
      } },
      xAxis: { type: 'category', data: s, axisLabel: { hideOverlap: true } },
      yAxis: { type: 'value', min: 61, max: 366, inverse: true, interval: 30.5, axisLabel: { formatter: (d: number) => (d > 350 ? '' : seasonAxisLabel(d)) } },
      series: [
        { name: 'base', type: 'line', data: ok.map((r) => r.onset!.p50), stack: 'w', lineStyle: { opacity: 0 }, tooltip: { show: false } },
        { name: 'window', type: 'line', data: ok.map((r) => r.end!.p50 - r.onset!.p50), stack: 'w', lineStyle: { opacity: 0 }, areaStyle: { color: p.brick, opacity: 0.2 } },
        { name: 'Onset', type: 'line', data: ok.map((r) => r.onset!.p50), color: p.brick, lineStyle: { width: 2 },
          markLine: { symbol: 'none', silent: true, lineStyle: { color: p.muted, type: 'dotted' }, label: { fontSize: 10, color: p.muted, position: 'insideEndTop' },
            data: (events?.policy ?? []).filter((e) => s.includes(seasonOf(new Date(e.date + 'T00:00:00Z'))))
              .map((e) => ({ xAxis: seasonOf(new Date(e.date + 'T00:00:00Z')), label: { formatter: e.label_en.split(' (')[0] } })) } },
        { name: 'End', type: 'line', data: ok.map((r) => r.end!.p50), color: p.ink, lineStyle: { width: 2, type: 'dashed' } },
      ],
    }
  }, [rows, events, p])
  return (
    <>
      <Legend items={[{ label: 'Onset', color: p.brick }, { label: 'End', color: p.ink, kind: 'dash' }, { label: 'Working season', color: p.brick, kind: 'band' }]} />
      <EChart option={opt} height={300} label="Kiln season onset and end by season" exportName="kilnwatch_kiln_timing" />
    </>
  )
}

/** Night lights and radar are physically independent (lights = activity, radar = brick stacks): two panels, one month axis. */
export function RadarCheckChart({ ka }: { ka: KilnActivity }) {
  const p = usePalette()
  const opt = useMemo(() => {
    const c = ka.national_check!
    const nl = new Map((ka.periods ?? []).map((d, i) => [d.slice(0, 7), ka.national?.e?.[i] ?? null]))
    const x = c.periods.map((d) => d.slice(0, 7))
    return {
      grid: [{ left: 56, right: 12, top: 22, height: '34%' }, { left: 56, right: 12, bottom: 48, height: '34%' }],
      tooltip: { trigger: 'axis', valueFormatter: vf }, axisPointer: { link: [{ xAxisIndex: 'all' }] },
      dataZoom: [{ type: 'inside', xAxisIndex: [0, 1] }],
      title: [{ text: 'Night lights, kiln excess (nW/cm²/sr)', left: 56, top: 0, textStyle: { fontSize: 12, fontWeight: 500, color: p.muted } },
        { text: 'Radar, yard minus ring (dB)', left: 56, top: '48%', textStyle: { fontSize: 12, fontWeight: 500, color: p.muted } }],
      xAxis: [{ type: 'category', data: x, gridIndex: 0, axisLabel: { show: false } }, { type: 'category', data: x, gridIndex: 1, axisLabel: { hideOverlap: true } }],
      yAxis: [{ type: 'value', gridIndex: 0 }, { type: 'value', gridIndex: 1 }],
      series: [{ name: 'Night lights', type: 'line', data: x.map((m) => nl.get(m) ?? null), color: p.brick, xAxisIndex: 0, yAxisIndex: 0 },
        { name: 'Radar (yard − ring)', type: 'line', data: c.e, color: p.orbit, xAxisIndex: 1, yAxisIndex: 1 }],
    }
  }, [ka, p])
  return <EChart label="Kiln excess in night lights and in radar by month, as two stacked panels" height={300} option={opt} exportName="kilnwatch_radar_check" />
}
