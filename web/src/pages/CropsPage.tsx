import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Icon, StatusMessage, useTitle } from '../components/ui'
import { PageHead, Step, useQ } from '../components/plain'
import { useJson } from '../lib/data'
import { seasonMean } from '../lib/calendar'
import { unitAt } from '../lib/geo'
import { busyMonths, MONTHS } from '../lib/plain'
import { outlookFor } from '../lib/outlook'
import { farmYear, fromMonth, windowMonths, type FarmMonth } from '../lib/farm'
import { source } from '../lib/cropSources'
import type { Calendar, Events, FC, NrtSeason, Outlook, UnitProps } from '../lib/types'

/**
 * For farmers: one district, then what is happening now, the coming months (harvests, when fields are usually burned,
 * when to get ready), what to do with straw, what burning costs, and who to call. Plain words, big targets, one
 * column. Fire months come from the district's calendar in the public export; every outside fact is cited
 * (lib/cropSources.ts). No typed-in figures.
 */
const HILL = ['Bandarban', 'Rangamati', 'Khagrachhari']
const KEY = 'kilnwatch.farmDistrict'
const remembered = () => { try { return localStorage.getItem(KEY) } catch { return null } }
const remember = (id: string) => { try { localStorage.setItem(KEY, id) } catch { /* private window: the link still holds it */ } }
// The plant food a farmer buys for each nutrient in soil-nutrients.
const FERTILISER: Record<string, string> = { nitrogen: 'urea', phosphorus: 'TSP', potassium: 'MoP (potash)', sulphur: 'gypsum' }

/** "Source: Banglapedia", linked: every outside fact on this page carries one. */
function Src({ id }: { id: string }) {
  const s = source(id)
  return <a className="text-sm text-muted underline" href={s.url} target="_blank" rel="noreferrer" title={s.title}>Source: {s.publisher.split(',')[0]}</a>
}

const CHIP = { harvest: 'var(--color-paddy)', fire: 'var(--color-heat)', ready: 'var(--color-orbit)' }
function Chip({ kind, strong, children }: { kind: keyof typeof CHIP; strong?: boolean; children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-base"
    style={{ borderColor: `color-mix(in srgb, ${CHIP[kind]} 55%, transparent)`, background: `color-mix(in srgb, ${CHIP[kind]} ${strong ? 30 : 14}%, var(--color-surface))` }}>{children}</span>
}

/** A traffic-light answer: the colour is never the only signal, the words say it too. */
function Light({ tone, title, children }: { tone: 'ok' | 'warn' | 'none'; title: ReactNode; children?: ReactNode }) {
  const c = tone === 'ok' ? 'var(--color-ok)' : tone === 'warn' ? 'var(--color-heat)' : 'var(--color-line)'
  return (
    <div className="panel space-y-1 border-l-[6px]" style={{ borderLeftColor: c }}>
      <p className="text-xl font-semibold">{title}</p>
      {children && <p className="text-base text-muted">{children}</p>}
    </div>
  )
}

export default function CropsPage() {
  const { unitId } = useParams()
  const nav = useNavigate()
  const q = useQ()
  const dists = useJson<FC>('aoi/districts.geojson').data
  const events = useJson<Events>('events.json').data
  const districts = useMemo(() => (dists?.features ?? []).map((f) => f.properties).sort((a, b) => a.name_en.localeCompare(b.name_en)), [dists])
  const unit = districts.find((u) => u.unit_id === unitId)
  useTitle(unit ? `${unit.name_en} · For farmers` : 'For farmers')
  const pick = (id: string) => { remember(id); nav(`/crops/${id}${q}`) }
  // Back on this device: open the district chosen last time.
  useEffect(() => { const r = remembered(); if (!unitId && r) nav(`/crops/${r}${q}`, { replace: true }) }, [unitId]) // eslint-disable-line react-hooks/exhaustive-deps

  const cal = useJson<Calendar>(unit ? `calendar/${unit.unit_id}.json` : null).data
  const busy = cal ? busyMonths(seasonMean(cal)) : null
  const harvests = [
    ...(events?.harvest ?? []).map((h) => ({ name: h.crop === 'aman' ? 'Aman rice' : h.crop === 'boro' ? 'Boro rice' : h.crop, months: windowMonths(h.start_doy, h.end_doy) })),
    { name: 'Wheat', months: source('wheat-window').months! },
    { name: 'Sugarcane', months: source('sugarcane-window').months! },
  ]
  const thisMonth = new Date().getMonth() + 1
  const coming = fromMonth(farmYear(harvests, busy), thisMonth)
  const lost = [...source('soil-nutrients').text.matchAll(/([\d.]+) kg of (\w+)/g)].map((m) => ({ kg: m[1], what: m[2] }))
  const hill = unit && HILL.includes(unit.name_en)
  let n = 0

  return (
    <div className="space-y-10 text-lg">
      <PageHead title="For farmers">
        Choose your district. See what is coming on your farm month by month, what to do with your straw instead of burning it,
        and who to call for help.
      </PageHead>

      {/* Phone: one column. Laptop: your district and "right now" stay in view on the left while the rest scrolls on the right. */}
      <div className="space-y-12 lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start lg:gap-x-14 lg:space-y-0">
      <div className="space-y-12 lg:sticky lg:top-[calc(var(--header-h,4rem)+1.5rem)]">
      <Step n={++n} title="Where is your farm?">
        <DistrictPicker districts={districts} dists={dists} value={unit?.unit_id ?? ''} onPick={pick} />
        {unitId && districts.length > 0 && !unit && <StatusMessage kind="info">Please choose your district from the list.</StatusMessage>}
      </Step>

      {unit && <Step n={++n} title={`Right now in ${unit.name_en}`}>
        <RightNow distId={unit.unit_id} cal={cal} now={coming[0]} />
      </Step>}
      </div>

      <div className="mt-12 space-y-12 lg:mt-0">
      <Step n={++n} title={unit ? `Your coming months in ${unit.name_en}` : 'Harvest months in Bangladesh'}>
        <p className="flex flex-wrap gap-2 text-base" aria-label="What the signs mean">
          <Chip kind="harvest"><span aria-hidden>🌾</span>Harvest</Chip>
          {unit && <><Chip kind="fire"><span aria-hidden>🔥</span>Fields often burned</Chip><Chip kind="ready"><span aria-hidden>📋</span>Get ready</Chip></>}
        </p>
        {!unit && <p className="text-muted">Choose your district above to add when fields near you are usually burned.</p>}
        <ol aria-label="Your coming months" className="m-0 list-none divide-y divide-line overflow-hidden rounded-[10px] border border-line bg-surface p-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:divide-y-0 sm:overflow-visible sm:border-0 sm:bg-transparent lg:grid-cols-3">
          {coming.map((m, i) => <MonthRow key={m.month} m={m} now={i === 0} withFire={!!unit} />)}
        </ol>
        <p className="text-sm text-muted">
          Rice harvest months: {events?.harvest[0] ? <a className="underline" href={events.harvest[0].url} target="_blank" rel="noreferrer">Source: FAO</a> : '…'}.
          Wheat: <Src id="wheat-window" />. Sugarcane: <Src id="sugarcane-window" />.
          {unit && <> Fire months: NASA satellites, the average of every season since 2003 in {unit.name_en}.</>}
        </p>
      </Step>

      {hill && <Step n={++n} title="Jhum farming in the hills">
        <ul className="m-0 grid list-none gap-4 p-0 lg:grid-cols-3">
          {['jhum-sowing', 'jhum-fallow', 'jhum-harm'].map((id) => <li key={id} className="panel space-y-1"><p>{source(id).text}</p><Src id={id} /></li>)}
        </ul>
      </Step>}

      <Step n={++n} title="Don’t burn your straw. Use it.">
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
          {([['🐄', 'Feed your animals', 'straw-feed'], ['🌱', 'Spread it on the field', 'straw-mulch'], ['🪱', 'Let it rot into the soil', 'straw-soil-life'],
            ['🚜', 'Sow straight into the stubble', 'happy-seeder']] as const).map(([icon, title, id]) => (
            <li key={id} className="panel space-y-2">
              <p className="flex items-center gap-3 text-xl font-semibold"><span aria-hidden className="text-3xl">{icon}</span>{title}</p>
              <p>{source(id).text}</p>
              <Src id={id} />
            </li>))}
        </ul>
      </Step>

      <Step n={++n} title="What burning costs you">
        <div className="panel space-y-4">
          <p className="text-xl font-semibold">Burning one tonne of straw throws away the plant food you pay for as fertiliser:</p>
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
            {lost.map((x) => <li key={x.what} className="rounded-[8px] bg-surface-2 p-3 text-center">
              <b className="block text-3xl">{x.kg} kg</b>
              <span className="block capitalize">{x.what}</span>
              {FERTILISER[x.what] && <span className="block text-sm text-muted">as in {FERTILISER[x.what]}</span>}
            </li>)}
          </ul>
          <Src id="soil-nutrients" />
        </div>
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
          {([['🪲', 'soil-microflora'], ['🫁', 'pm25-body']] as const).map(([icon, id]) => (
            <li key={id} className="panel space-y-2"><p className="flex items-start gap-3"><span aria-hidden className="text-3xl">{icon}</span>{source(id).text}</p><Src id={id} /></li>))}
        </ul>
      </Step>

      <Step n={n + 1} title="Need help?">
        <div className="panel space-y-3">
          <p>{source('krishi-call').text}</p>
          <a className="btn btn-primary min-h-14 px-6 text-xl" href="tel:16123"><span aria-hidden>📞</span>Call 16123</a>
          <p><Src id="krishi-call" /></p>
        </div>
        <div className="flex flex-wrap gap-3 print:hidden">
          <button className="btn min-h-12 px-4" onClick={() => window.print()}><Icon name="download" />Print this page</button>
          {unit && <Link className="btn min-h-12 px-4" to={`/area/${unit.unit_id}${q}`}>Fire map for {unit.name_en}<Icon name="chevron" className="h-3.5 w-3.5" /></Link>}
        </div>
      </Step>
      </div>
      </div>
    </div>
  )
}

/** A big district list plus "Use my location" (matched on this device, never sent). */
function DistrictPicker({ districts, dists, value, onPick }: { districts: UnitProps[]; dists?: FC; value: string; onPick: (id: string) => void }) {
  const [state, setState] = useState<'idle' | 'busy' | 'no'>('idle')
  const locate = () => {
    if (!('geolocation' in navigator) || !dists) { setState('no'); return }
    setState('busy')
    navigator.geolocation.getCurrentPosition((pos) => {
      const hit = unitAt(dists, pos.coords.latitude, pos.coords.longitude)
      if (hit) { setState('idle'); onPick(hit.unit_id) } else setState('no')
    }, () => setState('no'), { timeout: 10000, maximumAge: 600000 })
  }
  return (
    <div className="panel space-y-4">
      <button className="btn btn-primary min-h-14 w-full text-xl" onClick={locate} disabled={state === 'busy' || !dists}>
        <Icon name="pin" />{state === 'busy' ? 'Finding your district…' : 'Use my location'}</button>
      {state === 'no' && <StatusMessage kind="info">We could not find your district. Please choose it from the list below.</StatusMessage>}
      <label className="block font-semibold">Your district
        <select className="field mt-2 min-h-14 w-full text-xl font-normal" value={value} onChange={(e) => e.target.value && onPick(e.target.value)}>
          <option value="">Choose your district…</option>
          {districts.map((u) => <option key={u.unit_id} value={u.unit_id}>{u.name_en}</option>)}
        </select>
      </label>
      <p className="text-sm text-muted">Your location stays on this phone. It is never sent anywhere.</p>
    </div>
  )
}

/** This season so far, the next two weeks, and what this month means for the farm. */
function RightNow({ distId, cal, now }: { distId: string; cal?: Calendar; now: FarmMonth }) {
  const nrt = useJson<NrtSeason>('nrt/current_season.json').data
  const ol = useJson<Outlook>('outlook.json').data // optional: absent when its backtest is not estimable
  const live = nrt?.districts[distId]
  const next = ol?.ships && nrt && cal ? outlookFor(ol, distId, nrt, cal.normal.p90) : null
  const month = MONTHS[now.month - 1]
  const todo = now.prepare ? 'Fields near you are usually burned from next month. Decide now what you will do with your straw.'
    : now.fire ? 'Fields near you are often burned this month. Use your straw instead (see below).'
      : now.harvests.length ? 'Plan where your straw will go after the harvest.' : 'A quiet month for burning near you.'
  return (
    <div className="space-y-3">
      <Light tone="none" title={<>{month}{now.harvests.length ? `: ${now.harvests.join(', ')} harvest` : ''}</>}>{todo}</Light>
      {live ? live.above_p90_days
        ? <Light tone="warn" title="More fire than usual this season">{live.above_p90_days} {live.above_p90_days === 1 ? 'day' : 'days'} with more fire than usual since 1 July. From NASA satellites, updated every day.</Light>
        : <Light tone="ok" title="Normal so far this season">No days with more fire than usual since 1 July. From NASA satellites, updated every day.</Light>
        : <Light tone="none" title="No satellite news for your district today" />}
      {next && (next.state === 'on'
        ? next.p > next.clim
          ? <Light tone="warn" title="Next two weeks: more fire than usual is likely">Chance {Math.round(next.p * 100)} in 100. Usual for this time of year: {Math.round(next.clim * 100)} in 100.</Light>
          : <Light tone="ok" title="Next two weeks: about usual">Chance of more fire than usual: {Math.round(next.p * 100)} in 100, the same as or less than most years.</Light>
        : <Light tone="none" title={next.state === 'before' ? `The two-week forecast starts on ${next.opens}` : 'The two-week forecast returns next season'} />)}
    </div>
  )
}

function MonthRow({ m, now, withFire }: { m: FarmMonth; now: boolean; withFire: boolean }) {
  const quiet = !m.harvests.length && !(withFire && (m.fire || m.prepare))
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-col sm:items-start sm:gap-y-3 sm:rounded-[10px] sm:border sm:bg-surface sm:p-4 ${now ? 'bg-surface-2 sm:border-2 sm:border-ink' : 'sm:border-line'}`} aria-current={now ? 'date' : undefined}>
      <span className="w-32 shrink-0 text-xl font-semibold sm:w-auto">{MONTHS[m.month - 1]}{now && <span className="tag ml-2 align-middle">Now</span>}</span>
      <span className="flex flex-wrap gap-2">
        {m.harvests.map((h) => <Chip key={h} kind="harvest"><span aria-hidden>🌾</span>{h} harvest</Chip>)}
        {withFire && m.fire > 0 && <Chip kind="fire" strong={m.fire === 2}><span aria-hidden>🔥</span>{m.fire === 2 ? 'Most burning of the year' : 'Fields often burned'}</Chip>}
        {withFire && m.prepare && <Chip kind="ready"><span aria-hidden>📋</span>Get ready: plan for your straw</Chip>}
        {quiet && <span className="text-muted">Nothing special</span>}
      </span>
    </li>
  )
}
