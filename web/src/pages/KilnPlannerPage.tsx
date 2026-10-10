import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Icon, Loading, SegmentedToggle, Skeleton, SkeletonCard, StatusMessage, useKilnActivity, useReducedMotion, useTitle } from '../components/ui'
import { Caution, Gloss, MonthStrip, Ours, PageHead, TryLink, useQ, windowLevels } from '../components/plain'
import { useJson } from '../lib/data'
import { useLang, useT } from '../lib/i18n'
import { daysText, meanDuration, monthOfSeasonDay, typicalSeason, whenText } from '../lib/plain'
import type { FC, KilnActivity, KilnArea, UnitProps } from '../lib/types'

const BdMap = lazy(() => import('../components/BdMap'))

/** Kiln inspection planner: when kilns work in each area, how the season changed, where it runs longest. Area level only. */
export default function KilnPlannerPage() {
  useTitle('Kiln planner')
  const ka = useKilnActivity()
  if (ka.loading) return <SkeletonCard label="Loading kiln seasons" />
  if (!ka.data?.layer || !ka.data.national) return <StatusMessage>Kiln seasons are not published in this data build.</StatusMessage>
  return <Planner ka={ka.data} />
}

const rowsOf = (a?: KilnArea) => a?.seasons ?? []

function Planner({ ka }: { ka: KilnActivity }) {
  const { unitId } = useParams()
  const nav = useNavigate()
  const q = useQ()
  const t = useT()
  const lang = useLang()
  const reduced = useReducedMotion()
  const [level, setLevel] = useState<'district' | 'upazila'>(unitId && unitId.length > 6 ? 'upazila' : 'district')
  const fc = useJson<FC>(`aoi/${level}s.geojson`)
  const dists = useJson<FC>('aoi/districts.geojson')
  const ups = useJson<FC>('aoi/upazilas.geojson')
  const props = useMemo(() => new Map([...(dists.data?.features ?? []), ...(ups.data?.features ?? [])].map((f) => [f.properties.unit_id, f.properties])), [dists.data, ups.data])
  const seasons = rowsOf(ka.national).filter((r) => r.duration).map((r) => r.season)
  const [season, setSeason] = useState(seasons.at(-1) ?? '') // the latest measured season
  const [playing, setPlaying] = useState(false)
  const areas = Object.entries(ka.areas ?? {}).filter(([id]) => (level === 'district' ? id.length === 6 : id.length > 6))
  const values = Object.fromEntries(areas.flatMap(([id, a]) => {
    const r = a.seasons.find((s) => s.season === season)
    return r?.duration ? [[id, Math.round(r.duration.p50)]] : []
  }))
  const nat = ka.national!.seasons.find((s) => s.season === season)

  // Play through the seasons once (bounded: one step per season), then stop.
  useEffect(() => {
    if (!playing) return
    const i = seasons.indexOf(season)
    if (i >= seasons.length - 1) { setPlaying(false); return }
    const h = setTimeout(() => setSeason(seasons[i + 1]), reduced ? 0 : 900)
    return () => clearTimeout(h)
  }, [playing, season, seasons, reduced])

  const sel = unitId ? ka.areas?.[unitId] : undefined
  const selName = unitId ? props.get(unitId)?.name_en ?? unitId : 'Bangladesh'
  return (
    <div className="space-y-12">
      {lang === 'bn' && <p className="text-sm text-muted" lang="bn">{t('englishOnly')}</p>}
      <PageHead title="When are the brick kilns working?">
        Fire satellites can’t see Bangladesh’s brick kilns, but NASA <Gloss k="nightLights">night lights</Gloss> can: kilns run all night through the dry season.
        Use this to see when kilns in each area usually work, and how the kiln season has changed since 2012.
      </PageHead>
      <p className="prose-measure text-sm text-muted"><span className="tag mr-2">Extension</span>The core of Kiln Watch is the harmonized fire calendar. This page adds what fire satellites
        cannot show. The same method was also tested in Pakistan, India and Afghanistan, with mixed results: <Link className="text-orbit underline" to={`/trust${q}`}>see every test abroad</Link>.</p>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedToggle label="Map level" value={level} options={[['district', 'Districts'], ['upazila', 'Upazilas']]} onChange={setLevel} />
            <button className="btn" onClick={() => { if (!playing && seasons.indexOf(season) >= seasons.length - 1) setSeason(seasons[0]); setPlaying(!playing) }} aria-pressed={playing}>
              <Icon name={playing ? 'cross' : 'replay'} />{playing ? 'Stop' : 'Play 2012 → today'}</button>
          </div>
          <label className="block">
            <span className="flex items-baseline justify-between text-sm font-semibold"><span>Kiln <Gloss k="season">season</Gloss></span><span className="num text-lg">{season}</span></span>
            <input type="range" className="w-full accent-[var(--color-brick)]" min={0} max={seasons.length - 1} step={1} value={Math.max(0, seasons.indexOf(season))}
              onChange={(e) => { setPlaying(false); setSeason(seasons[+e.target.value]) }} aria-valuetext={season} />
            <span className="flex justify-between text-xs text-muted"><span>{seasons[0]}</span><span>{seasons.at(-1)}</span></span>
          </label>
          <Loading state={fc} skeleton={<Skeleton className="h-[440px] w-full rounded-[10px]" />}>{(f) => (
            <Suspense fallback={<Skeleton className="h-[440px] w-full rounded-[10px]" />}>
              <BdMap fc={f} selected={unitId} onSelect={(id) => nav(`/kilns/${id}${q}`)} drawing={false} onBox={() => {}} values={values} labels={level === 'district'} />
            </Suspense>)}</Loading>
          <p className="text-xs text-muted">Colour: length of the kiln season in {season}, in days (darker = longer). Uncoloured areas have fewer than five mapped <Gloss k="cluster">kiln clusters</Gloss>, too few to measure.</p>
          {nat?.duration && <Ours>In {season}, the kiln season across Bangladesh lasted {daysText(nat.duration.p50)}{nat.onset && nat.end && <>, from {whenText(nat.onset.p50)} to {whenText(nat.end.p50)}</>}.</Ours>}
        </div>
        <PlanCard name={selName} area={sel ?? ka.national!} isNational={!sel} unitId={unitId} />
      </section>

      <Rankings ka={ka} props={props} level={level} />

      <section className="space-y-3 border-t border-line pt-8">
        <Caution>A long kiln season is not proof that any kiln is breaking the law. This is a planning aid for <i>when</i> to look, worked out for whole areas, never for single kilns.</Caution>
        <Caution>Night lights show when kilns are working, not how much smoke they make.</Caution>
        <div className="flex flex-wrap gap-2"><TryLink to="/experts/kilns">Full kiln charts (for experts)</TryLink><TryLink to="/evidence">How we tested this</TryLink></div>
      </section>
    </div>
  )
}

function PlanCard({ name, area, isNational, unitId }: { name: string; area: KilnArea; isNational: boolean; unitId?: string }) {
  const q = useQ()
  const typ = typicalSeason(area.seasons)
  const early = meanDuration(area.seasons, '2012-13', '2014-15'), late = meanDuration(area.seasons, '2022-23', '2024-25')
  return (
    <aside className="panel space-y-4 self-start">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">{name}</h2>
        {!isNational && <Link className="text-sm text-orbit underline" to={'/kilns' + q}>Back to Bangladesh</Link>}
      </div>
      {isNational && <p className="text-sm text-muted">Tap an area on the map, or pick one from the lists below.</p>}
      {typ ? <>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[['Usually starts', whenText(typ.onset)], ['Busiest', typ.peak != null ? monthOfSeasonDay(typ.peak) : '–'], ['Usually ends', whenText(typ.end)]].map(([a, b]) => (
            <div key={a} className="rounded-[6px] bg-surface-2 p-2"><dt className="text-xs text-muted">{a}</dt><dd className="font-semibold">{b}</dd></div>))}
        </dl>
        <div>
          <p className="mb-1 text-sm font-semibold">Kilns likely working</p>
          <MonthStrip level={windowLevels(typ.onset, typ.end, typ.peak)} label={`Months when kilns in ${name} usually work`} />
          <p className="mt-1 text-xs text-muted">Darkest: the busiest month, when a visit is most likely to find kilns operating. Typical of {typ.seasons.join(', ')}.</p>
        </div>
        {early != null && late != null
          ? <Ours>The kiln season here lasted {daysText(early)} in 2012–15 and {daysText(late)} in 2022–25.</Ours>
          : late != null ? <Ours>The kiln season here lasted {daysText(late)} in 2022–25.</Ours> : null}
      </> : <p className="text-sm text-muted">Not enough measured seasons here to describe a typical kiln season.</p>}
      {!isNational && unitId && <TryLink to={`/area/${unitId}`}>Fires and kilns in {name}</TryLink>}
    </aside>
  )
}

function Rankings({ ka, props, level }: { ka: KilnActivity; props: Map<string, UnitProps>; level: 'district' | 'upazila' }) {
  const q = useQ()
  const rows = Object.entries(ka.areas ?? {}).filter(([id]) => (level === 'district' ? id.length === 6 : id.length > 6)).map(([id, a]) => {
    const typ = typicalSeason(a.seasons)
    const ok = a.seasons.filter((r) => r.duration)
    const first3 = ok.slice(0, 3), last3 = ok.slice(-3)
    const mean = (xs: typeof ok) => xs.reduce((s, r) => s + r.duration!.p50, 0) / xs.length
    return { id, name: props.get(id)?.name_en ?? id, typ: typ?.duration ?? null, growth: ok.length >= 6 ? mean(last3) - mean(first3) : null, span: ok.length >= 6 ? `${first3[0].season}→${last3.at(-1)!.season}` : '' }
  })
  const longest = rows.filter((r) => r.typ != null).sort((a, b) => b.typ! - a.typ!).slice(0, 10)
  const growing = rows.filter((r) => r.growth != null).sort((a, b) => b.growth! - a.growth!).slice(0, 10)
  const List = ({ items, val }: { items: typeof rows; val: (r: (typeof rows)[number]) => string }) => (
    <ol className="divide-y divide-line">{items.map((r, i) => (
      <li key={r.id}><Link to={`/kilns/${r.id}${q}`} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto_1rem] items-center gap-2 rounded-[4px] px-1 py-2 hover:bg-surface-2">
        <span className="num text-sm text-muted">{i + 1}</span><span className="truncate font-medium">{r.name}</span><span className="num text-sm">{val(r)}</span><Icon name="chevron" className="h-4 w-4 text-muted" /></Link></li>))}</ol>
  )
  return (
    <section className="grid gap-6 md:grid-cols-2">
      <div className="panel">
        <h2 className="h-section">Longest kiln seasons ({level === 'district' ? 'districts' : 'upazilas'})</h2>
        <p className="mb-2 text-sm text-muted">Typical length over the last three measured seasons.</p>
        <List items={longest} val={(r) => `${Math.round(r.typ!)} days`} />
      </div>
      <div className="panel">
        <h2 className="h-section">Fastest-growing kiln seasons</h2>
        <p className="mb-2 text-sm text-muted">Change in length: average of the last three measured seasons minus the first three (areas with at least six seasons).</p>
        {growing.length ? <List items={growing} val={(r) => `${r.growth! >= 0 ? '+' : ''}${Math.round(r.growth!)} days`} />
          : <p className="text-sm text-muted">Upazilas have too few measured seasons for a fair comparison. Switch the map to districts.</p>}
      </div>
    </section>
  )
}
