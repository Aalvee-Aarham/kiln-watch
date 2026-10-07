import { useMemo, useState } from 'react'
import { Loading, SegmentedToggle, SkeletonCard, useTitle } from '../components/ui'
import { Caution, Gloss, Ours, PageHead, Step, TryLink } from '../components/plain'
import { EChart } from '../components/EChart'
import { Legend } from '../components/charts'
import { useJson } from '../lib/data'
import { useLang, useT } from '../lib/i18n'
import { palette, useTheme } from '../lib/theme'
import type { Harmonization, Sensor } from '../lib/types'

const SENSORS: [Sensor, string, string][] = [
  ['T', 'Terra (MODIS, 1 km)', 'jute'], ['A', 'Aqua (MODIS, 1 km)', 'orbit'], ['N', 'Suomi NPP (VIIRS, 375 m)', 'plum'],
  ['J1', 'NOAA-20 (VIIRS, 375 m)', 'paddy'], ['J2', 'NOAA-21 (VIIRS, 375 m)', 'brick'],
]
const r2 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 100) / 100)

/** Guided playground for problem 1: the 2012 jump is a camera change, and harmonization removes it. Real series only. */
export default function SensorsPage() {
  useTitle('Sensor switch')
  const t = useT()
  const lang = useLang()
  const harm = useJson<Harmonization>('harmonization.json')
  return (
    <div className="space-y-14">
      {lang === 'bn' && <p className="text-sm text-muted" lang="bn">{t('englishOnly')}</p>}
      <PageHead title="Did fires in Bangladesh really explode in 2012?">
        A puzzle in five steps, using the real satellite record for the whole country, 2003 to today.
      </PageHead>
      <Loading state={harm} skeleton={<SkeletonCard label="Loading the satellite record" />}>{(h) => <Guide h={h} />}</Loading>
    </div>
  )
}

function usePal() {
  const theme = useTheme()
  return useMemo(() => palette(), [theme]) // eslint-disable-line react-hooks/exhaustive-deps
}

function Guide({ h }: { h: Harmonization }) {
  const p = usePal()
  const [answer, setAnswer] = useState<'yes' | 'no'>()
  const [aqua, setAqua] = useState(false)
  const [on, setOn] = useState<Set<Sensor>>(new Set(['A', 'N', 'J1']))
  const [corrected, setCorrected] = useState(false)
  const seasons = h.yearly.map((y) => y.season)
  const i12 = seasons.indexOf('2012-13'), i11 = seasons.indexOf('2011-12')
  const before = i11 > 0 ? h.yearly[i11 - 1] : undefined, after = h.yearly[i12]
  const jump = before && after ? after.raw_sum / before.raw_sum : null
  const check = h.yearly[i12]
  const colorOf = (k: string) => (p as unknown as Record<string, string>)[k]

  const puzzle = {
    grid: { left: 44, right: 16, top: 28, bottom: 28 }, tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: seasons, boundaryGap: false, axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value', name: 'Fire activity (whole country, per season)' },
    series: [
      { name: 'Satellite record, as recorded', type: 'line', data: h.yearly.map((y) => r2(y.raw_sum)), color: p.raw, lineStyle: { width: 2.5 },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: p.muted, type: 'dotted' }, label: { formatter: 'New camera (VIIRS)', position: 'insideEndTop', color: p.muted }, data: [{ xAxis: '2012-13' }] } },
      ...(aqua ? [{ name: 'Aqua only (the same camera every year)', type: 'line', data: h.yearly.map((y) => r2(y.aqua_obs)), color: p.orbit, symbol: 'circle', symbolSize: 6, lineStyle: { width: 2 } }] : []),
    ],
  }
  const fix = {
    grid: { left: 44, right: 16, top: 28, bottom: 28 }, tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: seasons, boundaryGap: false, axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value', name: 'Fire activity' },
    series: [
      ...SENSORS.filter(([k]) => on.has(k)).map(([k, name, c]) => ({ name, type: 'line', data: h.yearly.map((y) => r2(y.raw_by_sensor[k])), color: colorOf(c), lineStyle: { width: 1.5, type: 'dashed' } })),
      ...(corrected ? [
        { name: 'lo', type: 'line', data: h.yearly.map((y) => r2(y.h.lo)), stack: 'ci', lineStyle: { opacity: 0 }, tooltip: { show: false } },
        { name: 'Uncertainty (95%)', type: 'line', data: h.yearly.map((y) => r2(y.h.hi - y.h.lo)), stack: 'ci', lineStyle: { opacity: 0 }, areaStyle: { color: p.heat, opacity: 0.18 }, tooltip: { show: false } },
        { name: 'Corrected: all cameras on one scale', type: 'line', data: h.yearly.map((y) => r2(y.h.p50)), color: p.heat, lineStyle: { width: 3 } },
      ] : []),
    ],
  }
  return (
    <>
      <Step n={1} title="Look at the record. What happened in 2012?">
        <div className="panel">
          <EChart option={puzzle} height={320} label="Fire activity over Bangladesh by season as the satellites recorded it, with a sharp rise in 2012" exportName="kilnwatch_puzzle" />
        </div>
        {jump != null && <p className="prose-measure">As recorded, fire activity in {after!.season} was about <b>{Math.round(jump)} times</b> what it was in {before!.season}. Did Bangladesh suddenly burn {Math.round(jump)} times more?</p>}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Your answer">
          <button className="btn" aria-pressed={answer === 'yes'} onClick={() => setAnswer('yes')}>Yes, fires really jumped</button>
          <button className="btn" aria-pressed={answer === 'no'} onClick={() => setAnswer('no')}>No, something else changed</button>
        </div>
      </Step>

      {answer && <Step n={2} title={answer === 'no' ? 'Right: the camera changed, not the fires.' : 'It looks that way, but no.'}>
        <p className="prose-measure">In 2012 a sharper camera, <Gloss k="VIIRS" />, joined the older <Gloss k="MODIS" /> cameras. The Aqua satellite carried the same MODIS camera
          the whole time, so it is a fair witness. Switch it on:</p>
        <button className="btn" aria-pressed={aqua} onClick={() => setAqua(!aqua)}>{aqua ? 'Hide' : 'Show'} the same camera all along (Aqua)</button>
        {aqua && <Ours>The Aqua line has no jump in 2012. The fires didn’t change; the camera did.</Ours>}
      </Step>}

      {answer && <Step n={3} title="Why does a sharper camera see more fire?">
        <PixelIllustration />
      </Step>}

      {answer && <Step n={4} title="The fix: put every camera on one scale">
        <p className="prose-measure">Five satellites have watched Bangladesh. Switch each one on or off to see its own record. Then switch on the correction:
          on days when two satellites saw the same place, we learned how many old-camera detections one new-camera detection is worth, and <Gloss k="harmonize">converted</Gloss> everything.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Satellites">
          {SENSORS.map(([k, name, c]) => (
            <button key={k} className="btn" aria-pressed={on.has(k)} onClick={() => { const n = new Set(on); if (n.has(k)) n.delete(k); else n.add(k); setOn(n) }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(c) }} />{name}</button>))}
        </div>
        <button className="btn btn-primary" aria-pressed={corrected} onClick={() => setCorrected(!corrected)}>{corrected ? 'Hide the correction' : 'Apply the correction'}</button>
        <div className="panel">
          <Legend items={[...SENSORS.filter(([k]) => on.has(k)).map(([, name, c]) => ({ label: name, color: colorOf(c), kind: 'dash' as const })),
            ...(corrected ? [{ label: 'Corrected', color: p.heat }, { label: 'Uncertainty (95%)', color: p.heat, kind: 'band' as const }] : [])]} />
          <EChart option={fix} height={340} label="Each satellite's own fire record by season, and the corrected record on one scale" exportName="kilnwatch_fix" />
        </div>
        {corrected && <Ours>After correction, the 2012 jump shrinks from <b>{r2(h.seam.d_raw)}</b> to <b>{r2(h.seam.d_harm)}</b> units: <b>{Math.round((1 - h.seam.ratio) * 100)}%</b> of it was the camera change.</Ours>}
      </Step>}

      {answer && check?.aqua_obs != null && <Step n={5} title="Check it against a real reading">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="panel text-center"><span className="tag">Our corrected value, {check.season}</span><p className="big-num text-heat">{r2(check.h.p50)}</p>
            <p className="text-sm text-muted">likely between {r2(check.h.lo)} and {r2(check.h.hi)}</p></div>
          <div className="panel text-center"><span className="tag">What Aqua actually saw</span><p className="big-num text-orbit">{r2(check.aqua_obs)}</p>
            <p className="text-sm text-muted">the same old camera, same season</p></div>
        </div>
        <p className="prose-measure">The real reading lands inside our range. We repeated this kind of check for every season in which both cameras flew, hiding one season at a time from the method (details in For experts).</p>
      </Step>}

      {answer && <section className="space-y-3 border-t border-line pt-8">
        <h2 className="h-section">Why this matters now</h2>
        <p className="prose-measure">NASA plans to stop collecting data from the Terra and Aqua MODIS cameras in 2027. After that, only VIIRS will be left. Without a bridge like this one,
          every 20-year fire record would break in two. Our method, code and data are open for anyone to reuse.</p>
        <div className="flex flex-wrap gap-2"><TryLink to="/impact">Who benefits</TryLink><TryLink to="/evidence">The full tests (for experts)</TryLink></div>
      </section>}
    </>
  )
}

// Illustration only (labelled): fire sizes in m², positions in km on a 3 km × 3 km patch.
const FIRES: [number, number, number][] = [[0.6, 2.3, 2000], [2.4, 0.7, 2000], [1.3, 1.4, 300], [0.4, 0.9, 300], [2.1, 2.6, 300], [1.8, 0.3, 300], [2.7, 1.8, 300], [1.1, 2.7, 300], [0.2, 2.0, 300]]
/** A pixel "sees" fire when burning area is at least 0.1% of it (an illustrative threshold). */
const lit = (px: number) => {
  const n = Math.round(3 / px), out: [number, number][] = []
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const area = FIRES.filter(([x, y]) => x >= i * px && x < (i + 1) * px && y >= j * px && y < (j + 1) * px).reduce((s, f) => s + f[2], 0)
    if (area / (px * 1000) ** 2 >= 0.001) out.push([i, j])
  }
  return out
}

function PixelIllustration() {
  const p = usePal()
  const [cam, setCam] = useState<'modis' | 'viirs'>('modis')
  const px = cam === 'modis' ? 1 : 0.375
  const n = Math.round(3 / px)
  const hits = lit(px)
  const s = 100 // viewBox units per km
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr] md:items-center">
      <figure className="m-0 space-y-2">
        <SegmentedToggle label="Camera" value={cam} options={[['modis', 'Old camera (1 km pixels)'], ['viirs', 'New camera (375 m pixels)']]} onChange={setCam} />
        <svg viewBox="0 0 300 300" className="w-full rounded-[8px] border border-line" role="img"
          aria-label={`Illustration: a 3 km field with 9 fires. The ${cam === 'modis' ? 'old' : 'new'} camera detects fire in ${hits.length} squares.`}>
          <rect width="300" height="300" fill="color-mix(in oklch, var(--color-paddy) 18%, var(--color-surface))" />
          {hits.map(([i, j]) => <rect key={`${i}-${j}`} x={i * px * s} y={j * px * s} width={px * s} height={px * s} fill={p.heat} opacity={0.35} />)}
          {Array.from({ length: n + 1 }, (_, k) => <g key={k} stroke={p.line} strokeWidth={1}><line x1={k * px * s} y1={0} x2={k * px * s} y2={300} /><line x1={0} y1={k * px * s} x2={300} y2={k * px * s} /></g>)}
          {FIRES.map(([x, y, a], k) => <circle key={k} cx={x * s} cy={y * s} r={a > 1000 ? 7 : 3.5} fill={p.heat} stroke={p.surface} strokeWidth={1} />)}
        </svg>
        <figcaption className="text-xs text-muted">Illustration, not real data: one 3 km field with 2 big and 7 small fires.</figcaption>
      </figure>
      <div className="space-y-2">
        <p className="big-num">{hits.length} <span className="text-xl font-normal">squares with fire</span></p>
        <p className="prose-measure">A satellite only reports a fire if it fills enough of a picture square. A small fire is a tiny speck in a big 1 km square, so the old camera misses it.
          In a 375 m square the same fire fills seven times more of the picture, so the new camera notices it.</p>
        <Caution>That is why counts jumped in 2012: the new camera sees more of the same fires.</Caution>
      </div>
    </div>
  )
}
