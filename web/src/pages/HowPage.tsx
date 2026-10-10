import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Icon, Loading, SkeletonCard, useKilnActivity, useTitle } from '../components/ui'
import { Caution, Flow, Gloss, MonthStrip, Other, Ours, PageHead, TryLink, useQ } from '../components/plain'
import { EChart } from '../components/EChart'
import { seasonMean } from '../lib/calendar'
import { useJson } from '../lib/data'
import { useLang, useT } from '../lib/i18n'
import { busyMonths } from '../lib/plain'
import { palette, useTheme } from '../lib/theme'
import type { Calendar, Harmonization, KilnActivity, Sensor } from '../lib/types'

const STEPS: [string, string][] = [
  ['Satellites watch', 'five NASA/NOAA cameras'], ['They spot heat', 'hot pixels, day and night'], ['One scale', 'old and new cameras agree'],
  ['A calendar', 'for every area'], ['People act', 'with dates, not guesses'], ['Extension: kilns', 'night lights, not fire'],
]
const SENSORS: [Sensor, string, string][] = [
  ['T', 'Terra', 'MODIS · 1 km'], ['A', 'Aqua', 'MODIS · 1 km'], ['N', 'Suomi NPP', 'VIIRS · 375 m'], ['J1', 'NOAA-20', 'VIIRS · 375 m'], ['J2', 'NOAA-21', 'VIIRS · 375 m'],
]
const DHAKA = 'BD3026'

/** The whole approach, step by step, each step on real data: from a satellite pass to a decision someone can take. */
export default function HowPage() {
  useTitle('How it works')
  const t = useT()
  const lang = useLang()
  const [step, setStep] = useState(0)
  const harm = useJson<Harmonization>('harmonization.json')
  const ka = useKilnActivity().data
  return (
    <div className="space-y-12">
      {lang === 'bn' && <p className="text-sm text-muted" lang="bn">{t('englishOnly')}</p>}
      <PageHead title="From a NASA satellite to a decision on the ground">
        Six steps turn raw satellite pictures into a calendar anyone can use. Tap a step, or use Next. Every chart here is real data.
      </PageHead>
      <Flow items={STEPS} active={step} onPick={setStep} />
      <section className="panel min-h-[22rem] space-y-4" aria-live="polite" aria-label={`Step ${step + 1}: ${STEPS[step][0]}`}>
        <h2 className="h-display text-[clamp(1.5rem,3vw,2rem)]"><span className="num mr-2 text-muted">{step + 1}</span>{STEPS[step][0]}</h2>
        <Loading state={harm} skeleton={<SkeletonCard label="Loading the satellite record" />}>{(h) => <StepBody step={step} h={h} ka={ka} />}</Loading>
        <div className="flex justify-between gap-2 border-t border-line pt-4">
          <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
          <button className="btn btn-primary" disabled={step === STEPS.length - 1} onClick={() => setStep(step + 1)}>Next: {STEPS[Math.min(step + 1, STEPS.length - 1)][0]}<Icon name="chevron" className="h-3.5 w-3.5" /></button>
        </div>
      </section>
      <Challenge />
    </div>
  )
}

function StepBody({ step, h, ka }: { step: number; h: Harmonization; ka?: KilnActivity }) {
  if (step === 0) return <Satellites h={h} />
  if (step === 1) return <Pixels />
  if (step === 2) return <OneScale h={h} />
  if (step === 3) return <Calendars />
  if (step === 4) return <Act />
  return <Kilns ka={ka} />
}

function Satellites({ h }: { h: Harmonization }) {
  const seasons = h.yearly.map((y) => y.season)
  const span = (k: Sensor) => {
    const on = h.yearly.map((y) => (y.raw_by_sensor[k] ?? 0) > 0)
    const a = on.indexOf(true), b = on.lastIndexOf(true)
    return a < 0 ? null : [a, b] as const
  }
  return (
    <div className="space-y-4">
      <p className="prose-measure">Five satellites pass over Bangladesh every day and night with heat-sensing cameras. The older <Gloss k="MODIS" /> cameras started in 2000;
        the sharper <Gloss k="VIIRS" /> cameras took over from 2012. Each bar is the years that camera’s yearly fire records are in our data.
        NOAA-20 (2018) and NOAA-21 (2023) carry the same VIIRS camera: we use them to carry the scale forward and for this season’s daily updates.</p>
      <figure className="m-0 space-y-1.5" aria-label="Years each satellite camera is in the record">
        {SENSORS.filter(([k]) => span(k)).map(([k, name, cam]) => {
          const s = span(k)
          return (
            <div key={k} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3 text-sm">
              <span><b>{name}</b><span className="block text-xs text-muted">{cam}</span></span>
              <span className="relative h-4 rounded-full bg-surface-2">{s && <span className={`absolute inset-y-0 rounded-full ${k === 'T' || k === 'A' ? 'bg-raw' : 'bg-heat'}`}
                style={{ left: `${(s[0] / seasons.length) * 100}%`, width: `${((s[1] - s[0] + 1) / seasons.length) * 100}%` }} title={`${seasons[s[0]]} to ${seasons[s[1]]}`} />}</span>
            </div>)
        })}
        <figcaption className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 text-xs text-muted"><span /><span className="flex justify-between"><span>{seasons[0]}</span><span>{seasons.at(-1)}</span></span></figcaption>
      </figure>
      <Other src="NASA Earthdata, transition from MODIS to VIIRS" href="https://www.earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs">
        NASA plans to end data collection from Terra MODIS in <b>January 2027</b> and from Aqua MODIS around <b>September 2027</b>. After that, only VIIRS is left.</Other>
    </div>
  )
}

function Pixels() {
  return (
    <div className="grid items-center gap-6 md:grid-cols-[minmax(0,14rem)_1fr]">
      <figure className="m-0">
        <svg viewBox="0 0 160 160" className="w-full max-w-[14rem]" role="img" aria-label="Illustration: one 1 km MODIS pixel holds about seven 375 m VIIRS pixels; a small fire fills one VIIRS pixel">
          <rect x="1" y="1" width="158" height="158" fill="var(--color-surface-2)" stroke="var(--color-raw)" strokeWidth="2" />
          {[60, 120].map((v) => <g key={v} stroke="var(--color-heat)" strokeDasharray="3 3"><line x1={v} y1="1" x2={v} y2="159" /><line x1="1" y1={v} x2="159" y2={v} /></g>)}
          <rect x="62" y="62" width="56" height="56" fill="var(--color-heat)" opacity="0.25" />
          <circle cx="88" cy="92" r="7" fill="var(--color-heat)" />
        </svg>
        <figcaption className="text-xs text-muted">Illustration, to scale: grey = one MODIS pixel (1 km), dashed = VIIRS pixels (375 m).</figcaption>
      </figure>
      <div className="space-y-3">
        <p className="prose-measure">A satellite camera sees the ground as a grid of squares called pixels. When a square is much hotter than its neighbours, NASA marks it as a fire.</p>
        <p className="prose-measure">A MODIS square is 1 km wide. A VIIRS square is 375 m wide, so about <b>7</b> of them fit in one MODIS square (1000² ÷ 375² ≈ 7.1).
          A small fire fills a bigger share of a small square, so <b>VIIRS notices fires MODIS misses</b>, and one fire can light up several VIIRS squares.</p>
        <Caution>That is why simply adding the two records together gives the wrong answer: the count jumps because the camera changed, not the fires.</Caution>
      </div>
    </div>
  )
}

function OneScale({ h }: { h: Harmonization }) {
  const theme = useTheme()
  const p = useMemo(() => palette(), [theme]) // eslint-disable-line react-hooks/exhaustive-deps
  const r2 = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100)
  const opt = {
    grid: { left: 44, right: 16, top: 32, bottom: 28 }, tooltip: { trigger: 'axis' }, legend: { top: 0, left: 0 },
    xAxis: { type: 'category', data: h.yearly.map((y) => y.season), boundaryGap: false, axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value' },
    series: [
      { name: 'As recorded (cameras mixed)', type: 'line', data: h.yearly.map((y) => r2(y.raw_sum)), color: p.raw, lineStyle: { width: 2, type: 'dashed' } },
      { name: 'Kiln Watch: one scale', type: 'line', data: h.yearly.map((y) => r2(y.h.p50)), color: p.heat, lineStyle: { width: 3 } },
    ],
  }
  return (
    <div className="space-y-3">
      <p className="prose-measure">We measured, month by month and region by region, how much more each newer camera sees than the one before it, on days both were watching.
        Then we <Gloss k="harmonize">converted</Gloss> every camera to Aqua MODIS units, like converting currencies.</p>
      <EChart option={opt} height={280} label="Fire activity over Bangladesh by season, as recorded and on one scale" exportName="kilnwatch_one_scale" />
      <Ours>The false jump in 2012 shrank by <b>{Math.round((1 - h.seam.ratio) * 100)}%</b>. A pre-registered test said we needed at least 75%.</Ours>
      <TryLink to="/sensors">Do it yourself in the sensor switch</TryLink>
    </div>
  )
}

const PLAIN_CHANNEL: [RegExp, string][] = [
  [/FIRMS/, 'Fire satellites (VIIRS hot spots)'], [/ECOSTRESS/, 'Space-station heat camera (ECOSTRESS)'], [/Landsat/, 'Landsat daytime heat'],
  [/TROPOMI/, 'Pollution-gas sensor (Sentinel-5P)'], [/Black Marble/, 'NASA night lights (Black Marble)'], [/Sentinel-1/, 'Radar (Sentinel-1)'],
]

function Kilns({ ka }: { ka?: KilnActivity }) {
  const pct = ka?.contamination && (ka.contamination.kiln_share * 100).toFixed(2)
  return (
    <div className="space-y-4">
      <p className="prose-measure">Bangladesh has thousands of brick kilns. They burn coal inside closed chambers, so fire satellites barely see them.
        We tested {ka?.pilots?.length ?? 'several'} space instruments on {ka?.national?.n_clusters.toLocaleString('en-US') ?? 'thousands of'} mapped kiln clusters, each against nearby farmland with no kilns, and kept only what worked.</p>
      {ka?.pilots && <ul className="grid gap-2 sm:grid-cols-2">
        {ka.pilots.map((r) => {
          const ok = r.reading.startsWith('signal'), part = !ok && r.reading.includes('structure')
          return (
            <li key={r.channel} className="flex items-start gap-2 rounded-[6px] border border-line p-2.5">
              <Icon name={ok ? 'check' : part ? 'half' : 'cross'} className={`mt-0.5 h-4 w-4 ${ok ? 'text-ok' : 'text-muted'}`} />
              <span><b className="block text-sm">{PLAIN_CHANNEL.find(([re]) => re.test(r.channel))?.[1] ?? r.channel}</b>
                <span className="text-xs text-muted">{ok ? 'Sees kilns working' : part ? 'Sees the kiln building, not the firing' : 'Can’t tell kilns from farmland'} · kilns {r.kiln}, farmland {r.control}</span></span>
            </li>)
        })}
      </ul>}
      <Ours>Winner: <Gloss k="nightLights">night lights</Gloss>. Kilns work all night with lamps on, so the ground around them glows brighter in kiln season.
        {pct && <> Fire satellites, by contrast, put only {pct}% of dry-season detections on kiln sites, the same as on farmland.</>}</Ours>
      <div className="flex flex-wrap gap-2"><TryLink to="/kilns">See kiln seasons by area</TryLink><TryLink to="/trust">Does it work in other countries?</TryLink></div>
    </div>
  )
}

function Calendars() {
  const cal = useJson<Calendar>(`calendar/${DHAKA}.json`)
  const bm = useMemo(() => (cal.data ? busyMonths(seasonMean(cal.data)) : null), [cal.data])
  return (
    <div className="space-y-4">
      <p className="prose-measure">For every district and <Gloss k="upazila" />, every day since 2003 goes into one calendar: when it usually burns, its <Gloss k="normal">normal range</Gloss>,
        and whether this season is running above it. Here is a real example.</p>
      {bm && <div><p className="mb-1 text-sm font-semibold">Fires in Dhaka district, a typical year</p>
        <MonthStrip color="var(--color-heat)" level={Array.from({ length: 12 }, (_, i) => (i === bm.peak ? 2 : i >= bm.first && i <= bm.last ? 1 : 0))} label="Months when fires usually burn in Dhaka district" /></div>}
      <p className="text-xs text-muted">Darkest month: the busiest. The year runs July to June, so one winter is never split in two.</p>
      <TryLink to="/area" primary>Find your own area</TryLink>
    </div>
  )
}

function Act() {
  const q = useQ()
  const who: [string, string, string][] = [
    ['farm', 'Agriculture officers', 'start straw campaigns before burning starts'], ['families', 'Families and schools', 'mark burning season on the calendar'],
    ['science', 'Scientists', 'keep fire records alive after MODIS'], ['journalist', 'Journalists', 'check a claim with a source link'],
    ['inspector', 'Environment inspectors', 'time kiln visits to the busiest month'], ['policy', 'Policy makers', 'track kiln-season length every year'],
  ]
  return (
    <div className="space-y-3">
      <p className="prose-measure">The calendar only matters if someone uses it. Pick a person to see their exact question, the answer for their district, and the steps they take.</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {who.map(([id, a, b]) => <li key={id}><Link to={`/impact/${id}${q}`} className="panel flex h-full items-center justify-between gap-2 hover:bg-surface-2">
          <span><b className="block">{a}</b><span className="text-sm text-muted">{b}</span></span><Icon name="chevron" className="h-4 w-4 text-muted" /></Link></li>)}
      </ul>
    </div>
  )
}

/** Relevance: each thing the challenge asks for, and where on this site it is answered. */
function Challenge() {
  const q = useQ()
  const rows: [string, string, string, string][] = [
    ['Harmonize MODIS and VIIRS', 'Every camera converted to one scale, with uncertainty, tested on years it never saw', '/sensors', 'Sensor switch'],
    ['A burning-activity calendar', 'Every day since 2003 for each of the 64 districts and their upazilas', '/area', 'My area'],
    ['Historical fire patterns', 'When each season started, how long it lasted and when it peaked, every year', '/timeline', 'Timeline'],
    ['Unusual conditions', 'Days above what 9 out of 10 past seasons had on the same date', '/area', 'My area'],
    ['Critical periods', 'The busiest weeks of each area’s normal year', '/explore', 'Full explorer'],
    ['Early warning', 'This season against the normal range, refreshed daily from NASA near-real-time data', '/season', 'This season'],
    ['A selected area of interest', 'Search, tap the map, use your location, or draw a box', '/area', 'My area'],
    ['Our addition', 'Brick-kiln seasons from NASA night lights, because fire satellites can’t see kilns', '/kilns', 'Kiln planner'],
  ]
  return (
    <section className="space-y-4" aria-label="Does it answer the challenge?">
      <h2 className="h-display text-[clamp(1.6rem,3.5vw,2.2rem)]">Does it answer the challenge?</h2>
      <p className="prose-measure text-muted">NASA Space Apps 2026: <i>Harmonization of MODIS and VIIRS Hot Spots</i>. Each thing the challenge asks for, and where to see it working.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted"><tr className="border-b border-line"><th className="py-2 pr-3 font-semibold">The challenge asks for</th><th className="py-2 pr-3 font-semibold">Kiln Watch does</th><th className="py-2 font-semibold">See it</th></tr></thead>
          <tbody>{rows.map(([a, b, to, l]) => (
            <tr key={a} className="border-b border-line align-top"><td className="py-2.5 pr-3 font-semibold">{a}</td><td className="py-2.5 pr-3">{b}</td>
              <td className="py-2.5"><Link className="whitespace-nowrap text-orbit underline" to={to + q}>{l}</Link></td></tr>))}</tbody>
        </table>
      </div>
    </section>
  )
}
