import { useMemo } from 'react'
import { EChart } from './ui'
import { palette } from '../lib/theme'
import { dense, heatmapCells, seriesFor, type Mode } from '../lib/calendar'
import { dateToDay, dayIso, dayToDate, seasonDayLabel, seasonOf, seasonStart } from '../lib/days'
import type { Calendar, Events, Harmonization, KilnActivity, KilnArea, KilnSeasonRow, Meta, NrtSeason, Validation } from '../lib/types'

const MONTHS_SEASON = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
const MONTHS_CAL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const seasonAxisLabel = (d: number) => MONTHS_SEASON[Math.min(11, Math.floor(d / 30.5))]
const grid = { left: 56, right: 16, top: 36, bottom: 40 }
const r2 = (v: number) => Math.round(v * 100) / 100

/** Raw vs harmonized season totals: the 2012 jump disappears after harmonization. */
export function JumpChart({ h }: { h: Harmonization }) {
  const p = palette()
  const opt = useMemo(() => {
    const s = h.yearly.map((y) => y.season)
    return {
      grid, tooltip: { trigger: 'axis' }, legend: { top: 0, data: ['Raw (spliced sensors)', '95% interval', 'Harmonized (MYD-eq)', 'Aqua as observed (check)'] },
      xAxis: { type: 'category', data: s, axisLabel: { rotate: 45 } },
      yAxis: { type: 'value', name: 'Season activity', nameTextStyle: { align: 'left' } },
      series: [
        { name: 'Raw (spliced sensors)', type: 'line', data: h.yearly.map((y) => r2(y.raw_sum)), color: p.raw, lineStyle: { type: 'dashed' } },
        { name: 'CI low', type: 'line', data: h.yearly.map((y) => r2(y.h.lo)), stack: 'ci', lineStyle: { opacity: 0 }, symbol: 'none', tooltip: { show: false } },
        { name: '95% interval', type: 'line', data: h.yearly.map((y) => r2(y.h.hi - y.h.lo)), stack: 'ci', lineStyle: { opacity: 0 }, symbol: 'none', areaStyle: { color: p.band, opacity: 0.5 } },
        { name: 'Harmonized (MYD-eq)', type: 'line', data: h.yearly.map((y) => r2(y.h.p50)), color: p.harm, lineStyle: { width: 3 },
          markLine: { silent: true, symbol: 'none', data: [{ xAxis: '2012-13', label: { formatter: 'VIIRS 375 m arrives' } }] } },
        { name: 'Aqua as observed (check)', type: 'line', data: h.yearly.map((y) => (y.aqua_obs == null ? null : r2(y.aqua_obs))), color: p.ctrl, symbol: 'circle', symbolSize: 4, lineStyle: { width: 1 } },
      ],
    }
  }, [h, p.raw, p.harm, p.band, p.ctrl])
  return <EChart option={opt} height={340} label="Season totals of fire activity, raw versus harmonized" exportName="kilnwatch_jump" />
}

/** Kiln clusters vs matched controls through the gate season: plateau vs spikes, day and night. */
export function PlateauSpikeChart({ v }: { v: Validation }) {
  const p = palette()
  const pr = v.profiles
  const opt = useMemo(() => ({
    grid, tooltip: { trigger: 'axis' }, legend: { top: 0 },
    xAxis: { type: 'category', data: pr.week },
    yAxis: { type: 'value', name: 'Share of clear days with a detection' },
    series: [
      { name: 'Kiln clusters · day', type: 'line', data: pr.kiln_day, color: p.kiln, lineStyle: { width: 3 } },
      { name: 'Kiln clusters · night', type: 'line', data: pr.kiln_night, color: p.kiln, lineStyle: { type: 'dashed' } },
      { name: 'Matched controls · day', type: 'line', data: pr.ctrl_day, color: p.ctrl, lineStyle: { width: 3 } },
      { name: 'Matched controls · night', type: 'line', data: pr.ctrl_night, color: p.ctrl, lineStyle: { type: 'dashed' } },
    ],
  }), [pr, p.kiln, p.ctrl])
  return <EChart option={opt} height={320} label="Weekly detection rate at kiln clusters versus matched control sites" exportName="kilnwatch_plateau" />
}

/** Year × day heatmap of daily activity. Blue-slate = not observed (monsoon cloud). */
export function CalendarHeatmap({ cal, mode, split, layout }: { cal: Calendar; mode: Mode; split: string; layout: 'cal' | 'season' }) {
  const p = palette()
  const opt = useMemo(() => {
    const { cells, years } = heatmapCells(cal, seriesFor(cal, mode, split), layout)
    const vals = cells.map((c) => c[2]).filter((v) => v > 0).sort((a, b) => a - b)
    const vmax = vals[Math.floor(vals.length * 0.98)] ?? 1
    const ylab = years.map((y) => (layout === 'season' ? `${y}-${String((y + 1) % 100).padStart(2, '0')}` : String(y)))
    return {
      grid: { left: 64, right: 16, top: 8, bottom: 56 },
      tooltip: { formatter: (q: { value: [number, number, number] }) => {
        const [x, yi, v] = q.value
        const y0 = years[0] + yi
        const d = new Date(layout === 'season' ? Date.UTC(y0, 6, 1 + x) : Date.UTC(y0, 0, 1 + x))
        return `${d.toISOString().slice(0, 10)}<br/>${v < 0 ? 'not observed (cloud)' : r2(v)}`
      } },
      xAxis: { type: 'category', data: Array.from({ length: 366 }, (_, i) => i),
        axisLabel: { interval: 30, formatter: (d: string) => (layout === 'season' ? seasonAxisLabel(+d) : MONTHS_CAL[Math.min(11, Math.floor(+d / 30.5))]) },
        splitLine: { show: true, interval: 30, lineStyle: { color: p.line, opacity: 0.7 } }, splitArea: { show: false } },
      yAxis: { type: 'category', data: ylab, inverse: true, splitLine: { show: false } },
      visualMap: { type: 'piecewise', orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 12,
        pieces: [{ lt: 0, color: p.cloud, label: 'Cloud (not observed)' }, { gte: 0, lt: vmax * 0.1, color: p.fire[0], label: 'Low' }, { gte: vmax * 0.1, lt: vmax * 0.35, color: p.fire[1], label: ' ' },
          { gte: vmax * 0.35, lt: vmax * 0.7, color: p.fire[2], label: ' ' }, { gte: vmax * 0.7, color: p.fire[4], label: 'High' }] },
      series: [{ type: 'heatmap', data: cells, progressive: 5000, animationDelay: (i: number) => Math.floor(i / 366) * 40 }],
    }
  }, [cal, mode, split, layout, p.cloud, p.line, p.fire])
  return <EChart option={opt} height={Math.max(260, 26 * 18)} label="Calendar heatmap of daily burning activity by year" exportName="kilnwatch_calendar" />
}

/** One season against the normal range (p10–p90), unusual days marked, critical periods shaded. */
export function NormalBandChart({ cal, season, mode, split }: { cal: Calendar; season: string; mode: Mode; split: string }) {
  const p = palette()
  const opt = useMemo(() => {
    const d0 = seasonStart(season)
    const dz = dense(cal, seriesFor(cal, mode, split))
    const x = Array.from({ length: 366 }, (_, i) => i)
    const sm = (a: ArrayLike<number>, i: number) => { let s = 0, n = 0; for (let k = i - 3; k <= i + 3; k++) { const v = a[d0 + k]; if (Number.isFinite(v)) { s += v; n++ } } return n ? r2(s / n) : null }
    const cur = x.map((i) => (d0 + i < dz.length ? sm(dz, i) : null))
    const unusualSet = new Set(cal.unusual)
    const unusual = x.filter((i) => unusualSet.has(d0 + i)).map((i) => [i, cur[i]])
    return {
      grid: { ...grid, top: 56 }, tooltip: { trigger: 'axis' }, legend: { top: 0, data: ['Normal range (p10–p90)', 'Median', season + ' (7-day mean)', 'Unusual (above p90)'] },
      xAxis: { type: 'category', data: x, axisLabel: { interval: 30, formatter: (d: string) => seasonAxisLabel(+d) } },
      yAxis: { type: 'value', name: 'MYD-eq per 1,000 clear cells' },
      series: [
        { name: 'p10', type: 'line', data: cal.normal.p10, stack: 'n', symbol: 'none', lineStyle: { opacity: 0 }, tooltip: { show: false } },
        { name: 'Normal range (p10–p90)', type: 'line', data: cal.normal.p90.map((v, i) => r2(v - cal.normal.p10[i])), stack: 'n', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: p.band, opacity: 0.45 },
          markArea: { silent: true, label: { show: false }, itemStyle: { color: p.ember, opacity: 0.06 }, data: cal.critical.map(([a, b]) => [{ xAxis: a }, { xAxis: b }]) } },
        { name: 'Median', type: 'line', data: cal.normal.p50, symbol: 'none', color: p.muted, lineStyle: { type: 'dotted' } },
        { name: season + ' (7-day mean)', type: 'line', data: cur, symbol: 'none', color: p.harm, lineStyle: { width: 2.5 } },
        { name: 'Unusual (above p90)', type: 'scatter', data: unusual, color: p.fire[4], symbolSize: 7 },
      ],
    }
  }, [cal, season, mode, split, p.band, p.harm, p.muted, p.ember, p.fire])
  return <EChart option={opt} height={320} label={`Season ${season} compared with the normal range`} exportName="kilnwatch_normal" />
}

/** Season totals by source (split[] with meta labels; no branch special-casing). */
export function SourceStackChart({ cal, meta, lang }: { cal: Calendar; meta: Meta; lang: 'en' | 'bn' }) {
  const p = palette()
  const opt = useMemo(() => {
    const bySeason = new Map<string, number[]>()
    cal.days.forEach((d, i) => {
      const s = seasonOf(dayToDate(d))
      const row = bySeason.get(s) ?? cal.split.map(() => 0)
      cal.split.forEach((sp, k) => { row[k] += sp.values[i] })
      bySeason.set(s, row)
    })
    const seasons = [...bySeason.keys()].sort()
    return {
      grid, tooltip: { trigger: 'axis' }, legend: { top: 0 },
      xAxis: { type: 'category', data: seasons, axisLabel: { rotate: 45 } }, yAxis: { type: 'value', name: 'Season sum' },
      series: cal.split.map((sp, k) => {
        const lab = meta.split_labels.find((l) => l.key === sp.key)
        return { name: lab ? (lang === 'bn' ? lab.label_bn : lab.label_en) : sp.key, type: 'bar', stack: 's', color: p.split[k % 3],
          data: seasons.map((s) => r2(bySeason.get(s)![k])) }
      }),
    }
  }, [cal, meta, lang, p.split])
  return <EChart option={opt} height={300} label="Season totals split by heat source" exportName="kilnwatch_sources" />
}

export function SeasonDurationChart({ cal, events }: { cal: Calendar; events?: Events }) {
  const p = palette()
  const opt = useMemo(() => ({
    grid, tooltip: { trigger: 'axis' }, legend: { show: false },
    xAxis: { type: 'category', data: cal.seasons.map((s) => s.season), axisLabel: { rotate: 45 } },
    yAxis: { type: 'value', name: 'Firing-season length (days)' },
    series: [
      { name: 'lo', type: 'line', data: cal.seasons.map((s) => s.duration.lo), stack: 'ci', symbol: 'none', lineStyle: { opacity: 0 }, tooltip: { show: false } },
      { name: '95% CI', type: 'line', data: cal.seasons.map((s) => r2(s.duration.hi - s.duration.lo)), stack: 'ci', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: p.band, opacity: 0.5 } },
      { name: 'Duration', type: 'line', data: cal.seasons.map((s) => s.duration.p50), color: p.kiln, lineStyle: { width: 3 },
        markLine: { symbol: 'none', data: (events?.policy ?? []).map((e) => ({ xAxis: seasonOf(new Date(e.date + 'T00:00:00Z')), label: { formatter: e.label_en } })) } },
    ],
  }), [cal, events, p.band, p.kiln])
  return <EChart option={opt} height={300} label="Length of the burning season by year with confidence interval" exportName="kilnwatch_duration" />
}

export function SeasonToDateChart({ nrt, meta }: { nrt: NrtSeason; meta: Meta }) {
  const p = palette()
  const opt = useMemo(() => {
    const d0 = dateToDay(nrt.day0)
    const x = nrt.national.h.map((_, i) => dayIso(d0 + i))
    return {
      grid, tooltip: { trigger: 'axis' }, legend: { top: 0 }, xAxis: { type: 'category', data: x }, yAxis: { type: 'value', name: 'MYD-eq (provisional)' },
      series: [
        ...nrt.national.split.map((s, k) => ({ name: meta.split_labels.find((l) => l.key === s.key)?.label_en ?? s.key, type: 'bar', stack: 's', color: p.split[k % 3], data: s.values })),
        { name: 'Total', type: 'line', data: nrt.national.h, color: p.harm, symbol: 'none' },
      ],
    }
  }, [nrt, meta, p.split, p.harm])
  return <EChart option={opt} height={300} label="Current season to date, national" exportName="kilnwatch_nrt" />
}

export function RadiusSweepChart({ v }: { v: Validation }) {
  const p = palette()
  return <EChart label="Detection rate by linking radius at kilns and controls" exportName="kilnwatch_radius" height={260} option={{
    grid, tooltip: { trigger: 'axis' }, legend: { top: 0 },
    xAxis: { type: 'category', data: v.radius_sweep.map((r) => `${r.radius_m} m`) }, yAxis: { type: 'value', name: 'Mean DR' },
    series: [{ name: 'Kiln clusters', type: 'bar', data: v.radius_sweep.map((r) => r.kiln), color: p.kiln },
      { name: 'Controls', type: 'bar', data: v.radius_sweep.map((r) => r.ctrl), color: p.ctrl }],
  }} />
}

export function PRCurveChart({ v }: { v: Validation }) {
  const p = palette()
  return <EChart label="Precision-recall curve of the kiln classifier" exportName="kilnwatch_pr" height={260} option={{
    grid, tooltip: { trigger: 'axis' },
    xAxis: { type: 'value', name: 'Recall', min: 0, max: 1 }, yAxis: { type: 'value', name: 'Precision', min: 0, max: 1 },
    series: [{ type: 'line', data: v.classifier.pr_curve, color: p.harm, symbol: 'none', name: 'Classifier',
      markLine: { symbol: 'none', data: [{ yAxis: v.classifier.prevalence, name: 'prevalence', label: { formatter: 'prevalence' } }] } }],
  }} />
}

export function TropomiChart({ v }: { v: Validation }) {
  const t = v.tropomi
  if (!t || !t.monthly.length) return null
  const p = palette()
  return <EChart label="TROPOMI NO2 belt-minus-ring versus activity index by month" exportName="kilnwatch_tropomi" height={260} option={{
    grid: { ...grid, right: 56 }, tooltip: { trigger: 'axis' }, legend: { top: 0 },
    xAxis: { type: 'category', data: t.monthly.map((m) => m.month) },
    yAxis: [{ type: 'value', name: 'NO₂ belt − ring' }, { type: 'value', name: t.treatment }],
    series: [{ name: 'NO₂ belt − ring', type: 'bar', data: t.monthly.map((m) => m.belt_minus_ring), color: p.muted },
      { name: t.treatment, type: 'line', yAxisIndex: 1, data: t.monthly.map((m) => m.index), color: p.harm }],
  }} />
}

export function Pm25LagChart({ v, nokiln }: { v: Validation; nokiln?: boolean }) {
  if (!v.pm25?.length) return null
  const p = palette()
  const [a, b] = nokiln ? ['Non-harvest burning', 'Harvest-window burning'] : ['Kiln index', 'Vegetation index']
  return <EChart label="Partial correlation of Dhaka PM2.5 with kiln and vegetation indices by lag" exportName="kilnwatch_pm25" height={240} option={{
    grid, tooltip: { trigger: 'axis' }, legend: { top: 0 },
    xAxis: { type: 'category', data: v.pm25.map((x) => `lag ${x.lag} d`) }, yAxis: { type: 'value', name: 'partial r' },
    series: [{ name: a, type: 'bar', data: v.pm25.map((x) => x.r_kiln.p50), color: p.kiln },
      { name: b, type: 'bar', data: v.pm25.map((x) => x.r_veg.p50), color: p.split[1] }],
  }} />
}

// --- kiln activity (Amendment 1: night lights / radar) -------------------------------------------
const doyLabel = (d: number) => MONTHS_SEASON[Math.max(0, Math.min(11, Math.floor(d / 30.5)))]
const quant = (xs: number[], p: number) => {
  const s = xs.slice().sort((a, b) => a - b)
  if (!s.length) return null
  const i = (s.length - 1) * p, lo = Math.floor(i)
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

/** The kiln season shape: median kiln excess by time of season (band = middle half of seasons), one highlighted
 *  season, and optionally the area's normal fire calendar on a second axis — two burning seasons, two sensors. */
export function KilnSeasonShapeChart({ ka, area, season, burning }: { ka: KilnActivity; area: KilnArea; season?: string; burning?: number[] }) {
  const p = palette()
  const opt = useMemo(() => {
    const { nb, at, label } = kilnBins(ka)
    const byBin: number[][] = Array.from({ length: nb }, () => [])
    const sel: (number | null)[] = Array(nb).fill(null)
    at.forEach((a, i) => { const v = area.e?.[i]; if (v != null) { byBin[a.bin].push(v); if (a.season === season) sel[a.bin] = v } })
    const p25 = byBin.map((xs) => quant(xs, 0.25)), p50 = byBin.map((xs) => quant(xs, 0.5)), p75 = byBin.map((xs) => quant(xs, 0.75))
    const burnBins = burning ? Array.from({ length: nb }, (_, b) => {
      const xs = burning.slice(Math.round((b * 366) / nb), Math.round(((b + 1) * 366) / nb))
      return Number((xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length)).toPrecision(3))  // small rates: keep significant digits
    }) : null
    const unit = ka.layer === 's1' ? 'dB' : 'nW/cm²/sr'
    return {
      grid: { ...grid, top: 56, right: burnBins ? 64 : 16 }, tooltip: { trigger: 'axis' },
      legend: { top: 0, data: ['Kilns: typical season', 'Middle half of seasons', ...(season ? [season] : []), ...(burnBins ? ['Fires: average season'] : [])] },
      xAxis: { type: 'category', data: Array.from({ length: nb }, (_, b) => b), axisLabel: { interval: 0, formatter: (b: string) => label(+b) } },
      yAxis: [{ type: 'value', name: `Kiln excess (${unit})`, nameTextStyle: { align: 'left' } },
        ...(burnBins ? [{ type: 'value', name: 'Fire activity', splitLine: { show: false } }] : [])],
      series: [
        { name: 'p25', type: 'line', data: p25, stack: 'iqr', symbol: 'none', lineStyle: { opacity: 0 }, tooltip: { show: false } },
        { name: 'Middle half of seasons', type: 'line', data: p75.map((v, i) => (v == null || p25[i] == null ? null : r2(v - p25[i]!))), stack: 'iqr', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: p.kiln, opacity: 0.18 } },
        { name: 'Kilns: typical season', type: 'line', data: p50, color: p.kiln, lineStyle: { width: 3 }, symbol: 'none' },
        ...(season ? [{ name: season, type: 'line', data: sel, color: p.ink, lineStyle: { type: 'dashed' }, symbol: 'circle', symbolSize: 4 }] : []),
        ...(burnBins ? [{ name: 'Fires: average season', type: 'line', yAxisIndex: 1, data: burnBins, color: p.split[1], symbol: 'none', lineStyle: { width: 2 }, areaStyle: { color: p.split[1], opacity: 0.08 } }] : []),
      ],
    }
  }, [ka, area, season, burning, p.kiln, p.ink, p.split])
  return <EChart option={opt} height={320} label="Kiln night-light excess through the season compared with the fire calendar" />
}

/** Kiln calendar: one row per season, one cell per half-month; colour = kiln excess over the monsoon baseline. */
export function KilnCalendarHeatmap({ ka, area }: { ka: KilnActivity; area: KilnArea }) {
  const opt = useMemo(() => {
    const k = kilnBins(ka)
    const { nb, at, label } = k
    const seasons = k.seasons.filter((s) => at.filter((a) => a.season === s).length >= nb / 2)  // drop part-seasons at the record's start
    const cells: [number, number, number][] = []
    at.forEach((a, i) => { const v = area.e?.[i]; const y = seasons.indexOf(a.season); if (v != null && y >= 0) cells.push([a.bin, y, r2(v)]) })
    const vals = cells.map((c) => c[2]).sort((a, b) => a - b)
    const vmax = Math.max(0.05, vals[Math.floor(vals.length * 0.97)] ?? 1)
    const when = (b: number) => (nb === 12 ? MONTHS_SEASON[b] : `${MONTHS_SEASON[Math.floor(b / 2)]} ${b % 2 ? '16–end' : '1–15'}`)
    return {
      grid: { left: 64, right: 16, top: 8, bottom: 56 },
      tooltip: { formatter: (x: { value: [number, number, number] }) => `${seasons[x.value[1]]} · ${when(x.value[0])}<br/>kiln excess ${x.value[2]}` },
      xAxis: { type: 'category', data: Array.from({ length: nb }, (_, b) => b), axisLabel: { interval: 0, formatter: (b: string) => label(+b) } },
      yAxis: { type: 'category', data: seasons, inverse: true },
      visualMap: { type: 'piecewise', orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 12,
        pieces: [{ lt: vmax * 0.15, color: '#f5f5f4', label: 'Quiet' }, { gte: vmax * 0.15, lt: vmax * 0.4, color: '#fde68a', label: ' ' },
          { gte: vmax * 0.4, lt: vmax * 0.7, color: '#f59e0b', label: ' ' }, { gte: vmax * 0.7, color: '#92400e', label: 'Kilns busy' }] },
      series: [{ type: 'heatmap', data: cells }],
    }
  }, [ka, area])
  return <EChart option={opt} height={Math.max(240, 22 * 16)} label="Kiln calendar: kiln activity by season and half-month" />
}

/** Kiln season window per season (onset to end, days from 1 July), with policy events marked. */
export function KilnTimingChart({ rows, events }: { rows: KilnSeasonRow[]; events?: Events }) {
  const p = palette()
  const opt = useMemo(() => {
    const ok = rows.filter((r) => r.onset && r.end)
    const s = ok.map((r) => r.season)
    const f = (c: KilnSeasonRow['onset'], season: string) => (c ? `${seasonDayLabel(c.p50, season)} (95% ${seasonDayLabel(c.lo, season)}–${seasonDayLabel(c.hi, season)})` : '–')
    return {
      grid: { ...grid, top: 40 }, legend: { top: 0, data: ['Onset', 'End'] },
      tooltip: { trigger: 'axis', formatter: (xs: { dataIndex: number }[]) => {
        const r = ok[xs[0].dataIndex]
        return `<b>${r.season}</b><br/>Onset ${f(r.onset, r.season)}<br/>End ${f(r.end, r.season)}<br/>Length ${r.duration ? `${r.duration.p50} days [${r.duration.lo}–${r.duration.hi}]` : '–'}`
      } },
      xAxis: { type: 'category', data: s, axisLabel: { rotate: 45 } },
      yAxis: { type: 'value', min: 61, max: 366, inverse: true, interval: 30.5, axisLabel: { formatter: (d: number) => (d > 350 ? '' : doyLabel(d)) } },
      series: [
        { name: 'base', type: 'line', data: ok.map((r) => r.onset!.p50), stack: 'w', symbol: 'none', lineStyle: { opacity: 0 }, tooltip: { show: false } },
        { name: 'window', type: 'line', data: ok.map((r) => r.end!.p50 - r.onset!.p50), stack: 'w', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: p.kiln, opacity: 0.22 } },
        { name: 'Onset', type: 'line', data: ok.map((r) => r.onset!.p50), color: p.kiln, lineStyle: { width: 2 },
          markLine: { symbol: 'none', label: { fontSize: 10, position: 'insideEndTop' }, data: (events?.policy ?? []).filter((e) => s.includes(seasonOf(new Date(e.date + 'T00:00:00Z'))))
            .map((e) => ({ xAxis: seasonOf(new Date(e.date + 'T00:00:00Z')), label: { formatter: e.label_en.split(' (')[0] } })) } },
        { name: 'End', type: 'line', data: ok.map((r) => r.end!.p50), color: p.ink, lineStyle: { width: 2, type: 'dashed' } },
      ],
    }
  }, [rows, events, p.kiln, p.ink])
  return <EChart option={opt} height={320} label="Kiln season onset and end by season" />
}
