import { lazy, Suspense, useEffect, useId, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Icon, Loading, Skeleton, StatusMessage, useKilnActivity, useTitle } from '../components/ui'
import { Caution, Gloss, MonthStrip, PageHead, useQ, windowLevels } from '../components/plain'
import { EChart } from '../components/EChart'
import { dataUrl, useJson } from '../lib/data'
import { useLang, useT } from '../lib/i18n'
import { seasonMean } from '../lib/calendar'
import { districtOf, unitAt } from '../lib/geo'
import { busyMonths, monthOfSeasonDay, MONTHS, SEASON_MONTHS, typicalSeason, whenText } from '../lib/plain'
import { palette, useTheme } from '../lib/theme'
import type { Calendar, Events, FC, NrtSeason, Outlook, UnitProps } from '../lib/types'
import { outlookFor } from '../lib/outlook'

const BdMap = lazy(() => import('../components/BdMap'))

/** "My area": pick a place three ways, then plain answers about its burning and kiln seasons. */
export default function AreaPage() {
  const { unitId } = useParams()
  const [sp, setSp] = useSearchParams()
  const vs = sp.get('vs') ?? undefined
  const nav = useNavigate()
  const q = useQ()
  const t = useT()
  const lang = useLang()
  const dists = useJson<FC>('aoi/districts.geojson')
  const ups = useJson<FC>('aoi/upazilas.geojson')
  const nrt = useJson<NrtSeason>('nrt/current_season.json')
  const units = useMemo(() => [...(dists.data?.features ?? []), ...(ups.data?.features ?? [])].map((f) => f.properties), [dists.data, ups.data])
  const unit = units.find((u) => u.unit_id === unitId)
  useTitle(unit ? `${unit.name_en} · My area` : 'My area')
  const go = (id: string) => nav(`/area/${id}${q}`)
  // Time slider: one stop per week of this season, then "season so far" (the default and the last stop).
  const nWeeks = Math.ceil((nrt.data?.national.h.length ?? 0) / 7)
  const [wk, setWk] = useState<number | null>(null)
  const weekLabel = (w: number) => {
    const d0 = Date.parse(`${nrt.data!.day0}T00:00:00Z`) + w * 7 * 86_400_000
    const f = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    return `${f(d0)} – ${f(d0 + 6 * 86_400_000)}`
  }
  const values = !nrt.data ? undefined : Object.fromEntries(Object.entries(nrt.data.districts).map(([id, d]) =>
    [id, wk == null ? d.above_p90_days : Math.round(d.h.slice(wk * 7, wk * 7 + 7).reduce((a, b) => a + b, 0) * 100) / 100]))

  return (
    <div className="space-y-10">
      {lang === 'bn' && <p className="text-sm text-muted" lang="bn">{t('englishOnly')}</p>}
      <PageHead title={unit ? unit.name_en : 'When is burning season where you live?'}>
        {unit ? <>{unit.level === 'upazila' ? <><Gloss k="upazila">Upazila</Gloss> in {units.find((u) => u.unit_id === districtOf(unit.unit_id))?.name_en ?? unit.division} district</> : 'District'}, {unit.division} division.</>
          : <>Pick your district or <Gloss k="upazila">upazila</Gloss>. We’ll tell you when fires and brick kilns are usually active there, and whether this year looks normal so far.</>}
      </PageHead>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="panel space-y-3">
            <AreaPicker units={units} onPick={go} label="Search by name" />
            <LocateButton dists={dists.data} ups={ups.data} onFound={go} />
          </div>
          <Loading state={dists} skeleton={<Skeleton className="h-[440px] w-full rounded-[10px]" />}>{(f) => (
            <Suspense fallback={<Skeleton className="h-[440px] w-full rounded-[10px]" />}>
              <BdMap fc={f} selected={unitId ? districtOf(unitId) : undefined} onSelect={go} drawing={false} onBox={() => {}} values={values} labels />
            </Suspense>)}</Loading>
          {nWeeks > 0 && <label className="block text-sm font-semibold">{wk == null ? `Season so far (${nrt.data!.season})` : `Week of ${weekLabel(wk)}`}
            <input type="range" className="mt-1 w-full accent-[var(--color-heat)]" min={0} max={nWeeks} step={1} value={wk ?? nWeeks}
              aria-valuetext={wk == null ? 'Season so far' : `Week of ${weekLabel(wk)}`}
              onChange={(e) => { const v = Number(e.target.value); setWk(v === nWeeks ? null : v) }} /></label>}
          <p className="text-xs text-muted">Tap a district on the map. Colour: {wk == null
            ? <>number of <Gloss k="unusual">unusual days</Gloss> so far this season</>
            : <>fire activity in that week, live NASA data (provisional)</>} (darker = more). Slide back through the season week by week.</p>
        </aside>

        <section className="min-w-0 space-y-8">
          {!unitId && <StatusMessage kind="info">Choose an area to see its answers here.</StatusMessage>}
          {unitId && units.length > 0 && !unit && <StatusMessage kind="error">No area has the code <span className="code">{unitId}</span>. Search for it by name instead.</StatusMessage>}
          {unit && (
            <div className={vs ? 'grid gap-6 xl:grid-cols-2' : ''}>
              <AreaAnswers key={unit.unit_id} unit={unit} nrt={nrt.data} />
              {vs && units.find((u) => u.unit_id === vs) && <AreaAnswers key={vs} unit={units.find((u) => u.unit_id === vs)!} nrt={nrt.data} onClose={() => { const n = new URLSearchParams(sp); n.delete('vs'); setSp(n) }} />}
            </div>)}
          {unit && !vs && <div className="panel space-y-2">
            <b>Compare with another area</b>
            <AreaPicker units={units.filter((u) => u.unit_id !== unit.unit_id)} onPick={(id) => { const n = new URLSearchParams(sp); n.set('vs', id); setSp(n) }} label="Area to compare" />
          </div>}
          {unit && <div className="flex flex-wrap gap-2">
            <ShareButton />
            <a className="btn" href={dataUrl(`calendar/${unit.unit_id}.json`)} download={`kilnwatch_${unit.unit_id}.json`}><Icon name="download" />Download this area’s data</a>
            <Link className="btn" to={`/explore/${unit.level}/${unit.unit_id}${q}`}>Full charts (for experts)<Icon name="chevron" className="h-3.5 w-3.5" /></Link>
          </div>}
        </section>
      </div>
    </div>
  )
}

/** Native type-ahead (input + datalist): the browser filters; an exact pick navigates. */
function AreaPicker({ units, onPick, label }: { units: UnitProps[]; onPick: (id: string) => void; label: string }) {
  const id = useId()
  const [v, setV] = useState('')
  const opt = (u: UnitProps) => `${u.name_en} (${u.level}, ${u.division})`
  const byLabel = useMemo(() => new Map(units.map((u) => [opt(u), u.unit_id])), [units])
  // A name typed or pasted before the area lists arrive still opens once they do.
  useEffect(() => { const hit = byLabel.get(v); if (hit) { setV(''); onPick(hit) } }, [byLabel]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <label className="block text-sm font-semibold">{label}
      <input className="field mt-1 w-full font-normal" list={id} value={v} placeholder="e.g. Dhaka, Savar, Rajshahi" autoComplete="off"
        onChange={(e) => { const hit = byLabel.get(e.target.value); if (hit) { setV(''); onPick(hit) } else setV(e.target.value) }} />
      <datalist id={id}>{units.map((u) => <option key={u.unit_id} value={opt(u)} />)}</datalist>
    </label>
  )
}

/** Browser geolocation → the containing upazila (else district). Computed on the device; nothing is sent. */
function LocateButton({ dists, ups, onFound }: { dists?: FC; ups?: FC; onFound: (id: string) => void }) {
  const [state, setState] = useState<'idle' | 'busy' | 'denied' | 'outside' | 'unsupported'>('idle')
  const locate = () => {
    if (!('geolocation' in navigator)) { setState('unsupported'); return }
    setState('busy')
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude, lon = pos.coords.longitude
      const hit = (ups && unitAt(ups, lat, lon)) ?? (dists && unitAt(dists, lat, lon))
      if (hit) { setState('idle'); onFound(hit.unit_id) } else setState('outside')
    }, () => setState('denied'), { timeout: 10000, maximumAge: 600000 })
  }
  return (
    <div className="space-y-1.5">
      <button className="btn w-full" onClick={locate} disabled={state === 'busy' || !dists}><Icon name="pin" />{state === 'busy' ? 'Finding you…' : 'Use my location'}</button>
      <p className="text-xs text-muted">Your location is matched to an area on this device and never sent anywhere.</p>
      {state === 'denied' && <StatusMessage kind="info">Location is off or was refused. Search by name or tap the map instead.</StatusMessage>}
      {state === 'outside' && <StatusMessage kind="info">You seem to be outside Bangladesh. Search by name or tap the map instead.</StatusMessage>}
      {state === 'unsupported' && <StatusMessage kind="info">This browser can’t share a location. Search by name or tap the map instead.</StatusMessage>}
    </div>
  )
}

function ShareButton() {
  const [done, setDone] = useState(false)
  return <button className="btn" onClick={() => { navigator.clipboard?.writeText(location.href).then(() => setDone(true), () => {}) }}>
    <Icon name={done ? 'check' : 'chevron'} />{done ? 'Link copied' : 'Copy link to this page'}</button>
}

/** The plain answers for one area: burning months, this season so far, kiln season, and a typical-year chart. */
function AreaAnswers({ unit, nrt, onClose }: { unit: UnitProps; nrt?: NrtSeason; onClose?: () => void }) {
  const cal = useJson<Calendar>(`calendar/${unit.unit_id}.json`)
  const events = useJson<Events>('events.json')
  const ka = useKilnActivity().data
  const dist = districtOf(unit.unit_id)
  const now = nrt?.districts[dist]
  const kilnArea = ka?.areas?.[unit.unit_id] ?? ka?.areas?.[dist]
  const kilnFromDistrict = !ka?.areas?.[unit.unit_id] && !!ka?.areas?.[dist] && unit.level === 'upazila'
  const kiln = kilnArea ? typicalSeason(kilnArea.seasons) : null
  const ol = useJson<Outlook>('outlook.json').data // optional: absent when its backtest is not estimable
  const distCal = useJson<Calendar>(nrt && ol?.ships ? `calendar/${dist}.json` : null).data // live data are by district
  const next = ol?.ships && nrt && distCal ? outlookFor(ol, dist, nrt, distCal.normal.p90) : null
  return (
    <article className="space-y-5">
      {onClose && <div className="flex items-center justify-between"><h2 className="h-section">{unit.name_en}</h2><button className="btn btn-quiet" onClick={onClose}><Icon name="cross" />Remove</button></div>}
      {cal.error?.endsWith('was not found') ? <StatusMessage kind="info">There is no separate fire calendar for this upazila in our data build.{' '}
        <Link className="text-orbit underline" to={`/area/${dist}`}>See its district instead</Link>.</StatusMessage> : <Loading state={cal} skeleton={<Skeleton className="h-[320px] w-full" />}>{(c) => {
        const perDay = seasonMean(c)
        const bm = busyMonths(perDay)
        return (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="panel space-y-1">
                <span className="tag">Fire season here</span>
                {bm ? <p className="text-lg">Usually <b>{SEASON_MONTHS[bm.first]}</b> to <b>{SEASON_MONTHS[bm.last]}</b>, busiest in <b>{SEASON_MONTHS[bm.peak]}</b>.</p>
                  : <p className="text-lg">Very little fire has been recorded here since 2003.</p>}
                <p className="text-xs text-muted">Average of every season since 2003, all satellites on one scale.</p>
              </div>
              <div className="panel space-y-1">
                <span className="tag">This season so far</span>
                {now ? <p className="text-lg">{now.above_p90_days
                  ? <><b className="text-heat">{now.above_p90_days} <Gloss k="unusual">unusual {now.above_p90_days === 1 ? 'day' : 'days'}</Gloss></b> since 1 July.</>
                  : <><b className="text-ok">Normal so far</b>: no <Gloss k="unusual">unusual days</Gloss> since 1 July.</>}</p>
                  : <p className="text-lg text-muted">No live data for this district today.</p>}
                <p className="text-xs text-muted">{unit.level === 'upazila' ? 'Live data are by district: this is the whole district’s figure. ' : ''}Updated daily from NASA; provisional.</p>
              </div>
              {next && <div className="panel space-y-1 sm:col-span-2">
                <span className="tag">Next two weeks</span>
                {next.state === 'on' ? <>
                  <p className="text-lg">Chance of at least one <Gloss k="unusual">unusual day</Gloss>: <b className={next.p > next.clim ? 'text-heat' : ''}>{Math.round(next.p * 100)}%</b>
                    {' '}(usual for this time of year: {Math.round(next.clim * 100)}%).</p>
                  <p className="text-xs text-muted">{next.recent ? 'The last two weeks had an unusual day' : 'The last two weeks had no unusual day'} (data to {next.asOf}{unit.level === 'upazila' ? ', whole district' : ''}).
                    Tested on past seasons: a modest gain over the usual chance. Provisional. <Link className="text-orbit underline" to="/trust">How we tested it</Link></p>
                </> : <p className="text-lg text-muted">{next.state === 'before' ? `The two-week outlook starts on ${next.opens}, when the burning season begins.` : 'The two-week outlook runs from 1 November to mid-May; it returns next season.'}</p>}
              </div>}
              <div className="panel space-y-1 sm:col-span-2">
                <span className="tag">Brick kilns</span>
                {kiln ? <>
                  <p className="text-lg">Kilns {kilnFromDistrict ? 'in this district' : 'here'} usually work from <b>{whenText(kiln.onset)}</b> to <b>{whenText(kiln.end)}</b>{kiln.peak != null && <>, busiest in <b>{monthOfSeasonDay(kiln.peak)}</b></>}.</p>
                  <MonthStrip level={windowLevels(kiln.onset, kiln.end, kiln.peak)} label="Months when kilns usually work" />
                  <p className="text-xs text-muted">Seen in NASA <Gloss k="nightLights">night lights</Gloss>; typical of {kiln.seasons.join(', ')}. <Link className="text-orbit underline" to={`/kilns/${kilnFromDistrict ? dist : unit.unit_id}`}>Open in the kiln planner</Link></p>
                </> : <p className="text-lg text-muted">No kiln calendar for this area: it has fewer than five mapped <Gloss k="cluster">kiln clusters</Gloss>.</p>}
              </div>
            </div>
            <TypicalYear perDay={perDay} nrt={nrt} distId={dist} kiln={kiln} events={events.data} name={unit.name_en} />
          </div>)
      }}</Loading>}
    </article>
  )
}

/** A typical year by month (bars), this season so far (dots, districts only), kiln months shaded, harvests marked. */
function TypicalYear({ perDay, nrt, distId, kiln, events, name }: {
  perDay: number[]; nrt?: NrtSeason; distId: string; kiln: ReturnType<typeof typicalSeason>; events?: Events; name: string
}) {
  const theme = useTheme()
  const p = useMemo(() => palette(), [theme]) // eslint-disable-line react-hooks/exhaustive-deps
  const starts = [0, 31, 62, 92, 123, 153, 184, 215, 243, 274, 304, 335, 366]
  const monthly = (xs: number[]) => starts.slice(0, 12).map((a, i) => {
    const s = xs.slice(a, starts[i + 1])
    return s.length ? Number((s.reduce((t, v) => t + v, 0) / s.length).toPrecision(3)) : null
  })
  const typical = monthly(perDay)
  const live = nrt?.districts[distId]?.h
  const nowMonths = live ? monthly(live) : null // months not reached yet have no days: null, not zero
  const kilnLv = kiln ? windowLevels(kiln.onset, kiln.end, kiln.peak) : null
  const kFirst = kilnLv ? kilnLv.findIndex((v) => v > 0) : -1, kLast = kilnLv ? 11 - [...kilnLv].reverse().findIndex((v) => v > 0) : -1
  const mon = (doy: number) => MONTHS[new Date(Date.UTC(2001, 0, doy)).getUTCMonth()].slice(0, 3)
  const harvest = (events?.harvest ?? []).map((h) => `${h.crop === 'aman' ? 'Aman' : h.crop === 'boro' ? 'Boro' : h.crop} rice harvest: ${mon(h.start_doy)}–${mon(h.end_doy)}`)
  const opt = {
    grid: { left: 44, right: 12, top: 28, bottom: 28 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: SEASON_MONTHS.map((m) => m.slice(0, 3)) },
    yAxis: { type: 'value', name: 'Fire activity' },
    series: [
      { name: 'Typical year', type: 'bar', data: typical, color: p.heat, barWidth: '55%',
        markArea: kFirst >= 0 ? { silent: true, itemStyle: { color: p.brick, opacity: 0.1 }, label: { show: true, position: 'insideTop', color: p.brick, fontSize: 11, formatter: 'kiln season' },
          data: [[{ xAxis: SEASON_MONTHS[kFirst].slice(0, 3) }, { xAxis: SEASON_MONTHS[kLast].slice(0, 3) }]] } : undefined },
      ...(nowMonths ? [{ name: `This season (${nrt!.season})`, type: 'line', data: nowMonths, color: p.ink, symbol: 'circle', symbolSize: 7, lineStyle: { width: 0 } }] : []),
    ],
  }
  return (
    <figure className="panel m-0 space-y-2">
      <figcaption className="font-semibold">A typical year in {name}, month by month</figcaption>
      <p className="text-sm text-muted">Bars: average fire activity in each month since 2003 (July to June).{nowMonths ? ' Dots: this season so far, for the whole district.' : ''}{kilnLv ? ' Shaded: the usual kiln season.' : ''}
        {harvest.length ? ` ${harvest.join('; ')}.` : ''}</p>
      <EChart option={opt} height={280} label={`Average fire activity by month in ${name}`} />
      <Caution>Fire activity is a count of satellite fire detections per cloud-free area, on one scale for all satellites. It is not a measure of smoke or air quality.</Caution>
    </figure>
  )
}
