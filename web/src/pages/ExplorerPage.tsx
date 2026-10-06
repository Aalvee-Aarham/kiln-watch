import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate } from 'react-router'
import { Breadcrumbs, CIText, Icon, Term, Loading, Section, SegmentedToggle, Skeleton, SkeletonCard, StatusMessage, useKilnActivity, useMeta } from '../components/ui'
import { CalendarHeatmap, KilnSeasonShapeChart, NormalBandChart, SourceStackChart } from '../components/charts'
import { EChart } from '../components/EChart'
import { fetchJson, useJson } from '../lib/data'
import { useUrlState } from '../lib/url'
import { useT } from '../lib/i18n'
import { palette, rampColor, useTheme } from '../lib/theme'
import { aggregateBox, calendarToCsv, resolveSplit, seasonMean, seasonVerdict } from '../lib/calendar'
import { formatBox, parseBox, tilesForBox, type Box } from '../lib/box'
import { dayIso, seasonOf, seasonStart } from '../lib/days'
import type { Calendar, Events, FC, GridTile, Harmonization, Meta, NrtSeason, UnitProps } from '../lib/types'

const FireMap = lazy(() => import('../components/FireMap'))

const useMedia = (q: string) => useSyncExternalStore(
  (l) => { const m = matchMedia(q); m.addEventListener('change', l); return () => m.removeEventListener('change', l) },
  () => matchMedia(q).matches, () => false)

// Recently viewed areas: a per-browser convenience only (storage may be unavailable).
type Recent = { id: string; level: string; name: string }
const readRecent = (): Recent[] => { try { return JSON.parse(localStorage.getItem('kwRecent') ?? '[]') } catch { return [] } }
const pushRecent = (r: Recent) => { try { localStorage.setItem('kwRecent', JSON.stringify([r, ...readRecent().filter((x) => x.id !== r.id)].slice(0, 6))) } catch { /* ignore */ } }

export default function ExplorerPage() {
  const [u, setQ] = useUrlState()
  const nav = useNavigate()
  const t = useT()
  const meta = useMeta()
  const level = u.level === 'upazila' ? 'upazila' : 'district'
  const fc = useJson<FC>(`aoi/${level}s.geojson`)
  const districts = useJson<FC>('aoi/districts.geojson')
  const nrt = useJson<NrtSeason>('nrt/current_season.json')
  const [drawing, setDrawing] = useState(false)
  const wide = useMedia('(min-width: 1024px)')
  const [mapOpen, setMapOpen] = useState(false)
  const qs = new URLSearchParams(window.location.hash.split('?')[1] ?? '').toString()
  const go = (path: string) => nav(path + (qs ? `?${qs}` : ''))
  const units = useMemo(() => fc.data?.features.map((f) => f.properties) ?? [], [fc.data])
  const sel = units.find((x) => x.unit_id === u.unitId)
  const selected = !!(u.unitId || u.box)

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawing) setDrawing(false)
      const tag = (e.target as HTMLElement).tagName
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) { e.preventDefault(); document.getElementById('unit-search')?.focus() }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [drawing])

  // Map fill: a metric that exists under every gate branch (ui_ux_plan.md §12.2).
  const shares = units.filter((x) => x.kiln_share != null)
  const metric = level === 'district' && nrt.data
    ? { label: t('daysAbove'), values: Object.fromEntries(Object.entries(nrt.data.districts).map(([id, d]) => [id, d.above_p90_days])) }
    : shares.length ? { label: 'kiln-like share of heat, %', values: Object.fromEntries(shares.map((x) => [x.unit_id, Math.round(x.kiln_share! * 100)])) } : undefined
  const showMap = wide || !selected || mapOpen || drawing

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <div className="panel space-y-3">
          <label className="flex items-baseline justify-between text-sm font-semibold" htmlFor="unit-search">{t('pick')}
            <kbd className="rounded-[3px] border border-line px-1.5 text-xs font-normal text-muted" title="Press / to search">/</kbd></label>
          <UnitSearch units={units} onPick={(id) => go(`/explore/${level}/${id}`)} />
          <SegmentedToggle label={t('level')} value={level} options={[['district', t('district')], ['upazila', t('upazila')]]} onChange={(v) => go(`/explore/${v}`)} />
          <div className="flex gap-2">
            <button className="btn flex-1" onClick={() => { setDrawing(!drawing); setMapOpen(true) }} aria-pressed={drawing}>
              <Icon name="area" />{drawing ? t('drawing') : t('draw')}
            </button>
          </div>
          <CoordsForm onBox={(b) => go(`/explore/box/${formatBox(b)}`)} />
        </div>
        {!wide && selected && !drawing && (
          <button className="btn w-full" aria-expanded={mapOpen} onClick={() => setMapOpen(!mapOpen)}><Icon name="pin" />{t('showMap')} {mapOpen ? '▴' : '▾'}</button>
        )}
        {showMap && <>
          <Loading state={fc} skeleton={<Skeleton className="h-[440px] w-full rounded-[10px]" />}>{(f) => (
            <Suspense fallback={<Skeleton className="h-[440px] w-full rounded-[10px]" />}>
              <FireMap fc={f} selected={u.unitId} onSelect={(id) => go(`/explore/${level}/${id}`)} drawing={drawing} box={u.box}
                values={metric?.values} labels={level === 'district'}
                onBox={(b) => { setDrawing(false); go(`/explore/box/${formatBox(b)}`) }} />
            </Suspense>)}
          </Loading>
          {metric ? <MapLegend label={metric.label} max={Math.max(0, ...Object.values(metric.values))} />
            : <p className="text-xs text-muted">Upazila colours need a data build with season totals; outlines only.</p>}
          <p className="text-xs text-muted">{t('mapNote')} Hold Ctrl and scroll to zoom.</p>
        </>}
      </aside>

      <section className="min-w-0 space-y-8">
        {u.boxError && <StatusMessage kind="error">{u.boxError} Draw a new area on the map, or enter coordinates.</StatusMessage>}
        {u.box && meta.data && districts.data && <BoxView box={u.box} meta={meta.data} districts={districts.data} />}
        {!u.box && !u.unitId && !u.boxError && <Landing nrt={nrt.data} districts={districts.data} onPick={(id, lvl = 'district') => go(`/explore/${lvl}/${id}`)} onDraw={() => { setDrawing(true); setMapOpen(true) }} />}
        {u.unitId && !u.box && meta.data && (
          <UnitView key={u.unitId} unitId={u.unitId} unit={sel} level={level} meta={meta.data} u={u} setQ={setQ} />
        )}
      </section>
    </div>
  )
}

/** Filtered combobox over units: type-ahead on English or Bangla name, matched text marked. */
function UnitSearch({ units, onPick }: { units: UnitProps[]; onPick: (id: string) => void }) {
  const t = useT()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const s = q.trim().toLowerCase()
  const matches = useMemo(() => (s ? units.filter((x) => x.name_en.toLowerCase().includes(s) || x.name_bn.includes(q.trim())) : units).slice(0, 8), [s, q, units])
  useEffect(() => {
    const out = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [])
  const pick = (x: UnitProps) => { setOpen(false); setQ(''); onPick(x.unit_id) }
  const mark = (name: string) => {
    const i = s ? name.toLowerCase().indexOf(s) : -1
    return i < 0 ? name : <>{name.slice(0, i)}<mark className="rounded-[2px] bg-orbit/15 text-ink">{name.slice(i, i + s.length)}</mark>{name.slice(i + s.length)}</>
  }
  return (
    <div ref={box} className="relative">
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
      <input id="unit-search" className="field pl-9" autoComplete="off"
        placeholder="Dhaka, রাজশাহী…" value={q} role="combobox" aria-expanded={open} aria-controls="unit-list" aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `opt-${matches[active].unit_id}` : undefined}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)); setOpen(true) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          else if (e.key === 'Enter' && matches[active]) { e.preventDefault(); pick(matches[active]) }
          else if (e.key === 'Escape') setOpen(false)
        }} />
      {open && (
        <ul id="unit-list" role="listbox" className="menu-list right-auto left-0 max-h-72 w-full overflow-auto" style={{ transformOrigin: 'top left' }}>
          {matches.length === 0 && <li className="text-muted" role="option" aria-disabled="true" aria-selected="false">{t('noMatch')}</li>}
          {matches.map((x, i) => (
            <li key={x.unit_id} id={`opt-${x.unit_id}`} role="option" aria-selected={i === active}
              className={i === active ? 'bg-surface-2' : ''}
              onMouseDown={(e) => { e.preventDefault(); pick(x) }}
              onMouseEnter={() => setActive(i)}>
              <span>{mark(x.name_en)}</span><span className="text-muted" lang="bn">{x.name_bn}</span>
              {x.kiln_count != null && x.kiln_count > 0 && <span className="num ml-auto text-xs text-muted">{x.kiln_count} kilns</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Keyboard alternative to drawing: four numbers, same canonical URL and validation as a drawn box. */
function CoordsForm({ onBox }: { onBox: (b: Box) => void }) {
  const t = useT()
  const [err, setErr] = useState<string>()
  return (
    <details className="text-sm">
      <summary className="text-muted hover:text-ink">{t('coords')}</summary>
      <form className="mt-2 grid grid-cols-2 gap-2" onSubmit={(e) => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        const vals = ['w', 's', 'e', 'n'].map((k) => Number(f.get(k)))
        if (vals.some((v) => !Number.isFinite(v))) return setErr('Enter all four numbers.')
        const r = parseBox(vals.map((v) => v.toFixed(4)).join(','))
        if (typeof r === 'string') return setErr(r)
        setErr(undefined); onBox(r)
      }}>
        {[['w', 'West (lon)', '90.25'], ['s', 'South (lat)', '23.60'], ['e', 'East (lon)', '90.60'], ['n', 'North (lat)', '23.90']].map(([k, l, ph]) => (
          <label key={k} className="text-xs text-muted">{l}<input name={k} inputMode="decimal" className="field mt-0.5 py-1" placeholder={ph} /></label>
        ))}
        {err && <p className="col-span-2 text-xs text-err" role="alert">{err}</p>}
        <button className="btn btn-primary col-span-2">{t('apply')}</button>
      </form>
    </details>
  )
}

function MapLegend({ label, max }: { label: string; max: number }) {
  const theme = useTheme()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const p = useMemo(() => palette(), [theme])
  const steps = max > 0 ? [0, ...[1, 2, 3, 4, 5].map((k) => (k / 5) * max)] : [0]
  return (
    <div className="text-xs text-muted">
      <div className="mb-1">{label}</div>
      <div className="flex items-center gap-1" aria-hidden>
        {steps.map((v, i) => <span key={i} className="h-2.5 flex-1 rounded-[2px] ring-1 ring-line" style={{ background: rampColor(v, max, p) }} />)}
      </div>
      <div className="mt-0.5 flex justify-between num"><span>0</span><span>{Math.round(max)}</span></div>
    </div>
  )
}

function Landing({ nrt, districts, onPick, onDraw }: { nrt?: NrtSeason; districts?: FC; onPick: (id: string, level?: string) => void; onDraw: () => void }) {
  const t = useT()
  const name = (id: string) => districts?.features.find((f) => f.properties.unit_id === id)?.properties.name_en ?? id
  const hot = Object.entries(nrt?.districts ?? {}).filter(([, d]) => d.above_p90_days > 0).sort((a, b) => b[1].above_p90_days - a[1].above_p90_days).slice(0, 5)
  const [recent] = useState(readRecent)
  return (
    <div className="max-w-[68ch] space-y-8">
      <div>
        <h1 className="h-display text-[clamp(2.25rem,5vw,3.5rem)]">{t('startWith')}</h1>
        <p className="mt-3 text-muted">Every day since 2003 on one harmonized scale, how a season compares with its normal range, which burning falls in the harvest windows, and, where there are brick kilns, when the kiln season runs compared with the fires. Search above, click the map, or draw your own area.</p>
      </div>
      {hot.length > 0 && (
        <div>
          <h2 className="h-section mb-2">{t('aboveNow')}</h2>
          <div className="flex flex-wrap gap-2">
            {hot.map(([id, d]) => <button key={id} className="btn" onClick={() => onPick(id)}>{name(id)}<span className="num text-muted">{d.above_p90_days} d</span></button>)}
          </div>
        </div>
      )}
      {recent.length > 0 && (
        <div>
          <h2 className="h-section mb-2">{t('recent')}</h2>
          <div className="flex flex-wrap gap-2">{recent.map((r) => <button key={r.id} className="btn btn-quiet" onClick={() => onPick(r.id, r.level)}>{r.name}</button>)}</div>
        </div>
      )}
      <button className="btn" onClick={onDraw}><Icon name="area" />{t('draw')}</button>
    </div>
  )
}

const SECTIONS = [['calendar', 'calendar'], ['season', 'vsNormal'], ['kiln', 'kilns'], ['sources', 'sources'], ['metrics', 'data']] as const

function UnitView({ unitId, unit, level, meta, u, setQ }: { unitId: string; unit?: UnitProps; level: string; meta: Meta; u: ReturnType<typeof useUrlState>[0]; setQ: ReturnType<typeof useUrlState>[1] }) {
  const cal = useJson<Calendar>(`calendar/${unitId}.json`)
  const events = useJson<Events>('events.json')
  const ka = useKilnActivity().data
  const kilnArea = ka?.layer ? ka.areas?.[unitId] : undefined
  const t = useT()
  const split = resolveSplit(meta, u.split)
  const [markDay, setMarkDay] = useState<number>()
  const [active, setActive] = useState('calendar')
  const [scrolled, setScrolled] = useState(false)
  const sm = useMedia('(min-width: 640px)')
  const stuck = scrolled && sm // the header is only sticky from sm up
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => { if (unit) pushRecent({ id: unit.unit_id, level, name: unit.name_en }) }, [unit, level])
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { rootMargin: '-80px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [cal.data])
  useEffect(() => {
    if (!cal.data) return
    const io = new IntersectionObserver((es) => { const v = es.filter((e) => e.isIntersecting)[0]; if (v) setActive(v.target.id) }, { rootMargin: '-40% 0px -55% 0px' })
    SECTIONS.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el) })
    return () => io.disconnect()
  }, [cal.data])
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  const name = unit ? unit.name_en : unitId
  return (
    <Loading state={cal} skeleton={<div className="space-y-8"><Skeleton className="h-24 w-full" /><SkeletonCard label="Loading burning calendar" shape="grid" /><SkeletonCard label="Loading seasonal range" /></div>}>{(c) => {
      const seasons = c.seasons.map((s) => s.season)
      const complete = seasons.filter((s) => s !== seasonOf(new Date()))
      const season = u.season && seasons.includes(u.season) ? u.season : complete.at(-1) ?? seasons.at(-1) ?? seasonOf(new Date())
      const label = (k: string) => meta.split_labels.find((s) => s.key === k)?.[u.lang === 'bn' ? 'label_bn' : 'label_en'] ?? k
      const verdict = seasonVerdict(c, season)
      const pickDay = (d: number) => {
        const s = seasonOf(new Date(dayIso(d) + 'T00:00:00Z'))
        if (!seasons.includes(s)) return
        setQ({ season: s }); setMarkDay(d - seasonStart(s)); jump('season')
      }
      return (
        <div className="space-y-8">
          <div ref={sentinel} className="space-y-3">
            <Breadcrumbs items={[['Bangladesh', '/explore'], ...(unit ? [[`${unit.division} division`] as [string]] : []), [unit ? name : level === 'district' ? t('district') : t('upazila')]]} />
          </div>
          <div className="z-30 -mx-4 border-b border-line bg-bg px-4 pb-3 sm:sticky sm:top-[48px] lg:mx-0 lg:px-0">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2 pt-2">
              <div className="min-w-0">
                <h1 className={`h-display ${stuck ? 'text-2xl' : 'text-[clamp(2.25rem,5vw,3.25rem)]'}`}>{name}{unit && <span className="ml-3 font-sans text-[0.55em] font-normal tracking-normal text-muted" lang="bn">{unit.name_bn}</span>}</h1>
                {!stuck && unit?.kiln_count != null && unit.kiln_count > 0 && <p className="mt-1 text-sm text-muted"><span className="num">{unit.kiln_count.toLocaleString('en-US')}</span> mapped kilns (APAD inventory)</p>}
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <SegmentedToggle label="Raw or harmonized" value={u.mode} options={[['harm', t('harm')], ['raw', t('raw')]]} onChange={(v) => setQ({ mode: v === 'harm' ? undefined : v })} />
                <SegmentedToggle label="Year layout" value={u.layout} options={[['cal', t('cal')], ['season', t('seasonLayout')]]} onChange={(v) => setQ({ layout: v === 'cal' ? undefined : v })} />
                <select aria-label="Source" className="btn" value={split} onChange={(e) => setQ({ split: e.target.value === 'all' ? undefined : e.target.value })}>
                  <option value="all">{t('all')}</option>
                  {meta.split_labels.map((s) => <option key={s.key} value={s.key}>{label(s.key)}</option>)}
                </select>
              </div>
            </div>
            <p aria-live="polite" className={`prose-measure mt-2 text-[15px] ${stuck ? 'sr-only' : ''}`}>{verdict.text}</p>
            <nav aria-label="Sections" className="nav-scroll mt-2 flex gap-1 overflow-x-auto">
              {SECTIONS.filter(([id]) => id !== 'kiln' || kilnArea?.e).map(([id, k]) => (
                <button key={id} onClick={() => jump(id)} aria-current={active === id ? 'true' : undefined}
                  className={`shrink-0 rounded-[4px] px-2 py-1 text-sm transition-colors duration-150 ${active === id ? 'bg-surface-2 font-semibold text-ink' : 'text-muted hover:text-ink'}`}>{t(k)}</button>
              ))}
            </nav>
          </div>

          {u.split !== split && <StatusMessage>Source “{u.split}” does not exist in this data build, so all sources are shown.</StatusMessage>}
          <Section id="calendar" title={t('everyDay')} download={{ name: `kilnwatch_${unitId}`, csv: () => calendarToCsv(c, meta.split_labels.map((s) => s.key)), json: c, png: true }}
            summary={<>Each row is a year, each cell a day; darker means more fire (<Term k="MYD-eq">{t('unit')}</Term>). Blue-grey cells were <b>not observed</b> (cloud), which is not the same as no fire. {u.mode === 'raw' ? 'Raw view: each sensor in its own units, so the 2012 jump shows.' : 'Harmonized view: every year on the Aqua-MODIS scale.'} Click a day to open its season below.</>}>
            <CalendarHeatmap cal={c} mode={u.mode} split={split} layout={u.layout} events={events.data} onPickDay={pickDay} />
          </Section>
          <Section id="season" title={`${t('vsNormal')}: ${season}`} download={{ name: `kilnwatch_${unitId}_normal`, png: true }}
            actions={<select aria-label="Season" className="btn" value={season} onChange={(e) => { setMarkDay(undefined); setQ({ season: e.target.value }) }}>{seasons.map((s) => <option key={s}>{s}</option>)}</select>}
            summary={<>Shaded band: the middle 80% of all seasons for each day. Dots: unusual days above the <Term k="p90">90th percentile</Term>. Labelled shading: critical periods, when activity is normally at its yearly high.</>}>
            <NormalBandChart cal={c} season={season} mode={u.mode} split={split} events={events.data} markDay={markDay} />
          </Section>
          {kilnArea?.e && ka && <Section id="kiln" title="Two burning seasons: fires and kilns" download={{ name: `kilnwatch_${unitId}_kiln`, png: true }}
            actions={<Link className="btn" to={`/kilns${u.lang === 'bn' ? '?lang=bn' : ''}`}>Kiln seasons</Link>}
            summary={<>Top: the kiln season, from {ka.layer === 'ntl' ? 'night lights' : 'radar'} at {kilnArea.n_clusters} mapped kiln clusters against matched control sites (band = middle half of seasons). Bottom: this area’s average fire activity through the season (FIRMS, harmonized, 2003 to today).
              Kiln heat does not show up in fire detections, so the two are measured with different satellites, and they follow different calendars.</>}>
            <KilnSeasonShapeChart ka={ka} area={kilnArea} burning={seasonMean(c)} />
          </Section>}
          <Section id="sources" title={t('whereHeat')} download={{ name: `kilnwatch_${unitId}_sources`, png: true }}
            summary={`Season totals split into ${meta.split_labels.map((s) => label(s.key).toLowerCase()).join(', ')}.`}>
            <SourceStackChart cal={c} meta={meta} lang={u.lang} />
          </Section>
          <Section id="metrics" title={t('metrics')} plate={false}
            summary="Midpoint and duration are counted in days from 1 July. First and last detection dates depend on the sensor’s sensitivity, so compare them with care.">
            <dl className="divide-y divide-line sm:hidden">
              {c.seasons.slice().reverse().map((s) => (
                <div key={s.season} className={`grid grid-cols-2 gap-x-4 gap-y-0.5 py-2 text-sm ${s.season === season ? 'bg-surface-2' : ''}`}>
                  <dt className="num col-span-2 font-semibold">{s.season}</dt>
                  <dd className="text-muted">Duration</dd><dd><CIText ci={s.duration} d={0} /> d</dd>
                  <dd className="text-muted">Midpoint</dd><dd><CIText ci={s.midpoint} d={0} /></dd>
                  <dd className="text-muted">Peak</dd><dd><CIText ci={s.peak} /></dd>
                  <dd className="text-muted">First–last*</dd><dd className="num">{s.first ?? '–'} → {s.last ?? '–'}</dd>
                </div>))}
            </dl>
            <div className="hidden overflow-x-auto sm:block"><table className="w-full text-sm">
              <thead><tr><th>Season</th><th className="n">Midpoint (day)</th><th className="n">Duration (days)</th><th className="n">Peak</th><th>First*</th><th>Last*</th></tr></thead>
              <tbody>{c.seasons.slice().reverse().map((s) => <tr key={s.season} className={`border-t border-line ${s.season === season ? 'bg-surface-2' : ''}`}><td className="num">{s.season}</td><td className="n"><CIText ci={s.midpoint} d={0} /></td><td className="n"><CIText ci={s.duration} d={0} /></td><td className="n"><CIText ci={s.peak} /></td><td className="num">{s.first}</td><td className="num">{s.last}</td></tr>)}</tbody>
            </table></div>
          </Section>
        </div>
      )
    }}</Loading>
  )
}

function inPoly(lon: number, lat: number, g: GeoJSON.Geometry): boolean {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
  return polys.some((rings) => {
    let inside = false
    const r = rings[0]
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j]
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  })
}

function BoxView({ box, meta, districts }: { box: Box; meta: Meta; districts: FC }) {
  const theme = useTheme()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const p = useMemo(() => palette(), [theme])
  const [cx, cy] = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2]
  const host = districts.features.find((f) => inPoly(cx, cy, f.geometry))?.properties
  const cal = useJson<Calendar>(host ? `calendar/${host.unit_id}.json` : null)
  const harm = useJson<Harmonization>('harmonization.json')
  const [tiles, setTiles] = useState<GridTile[] | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    let live = true
    Promise.all(tilesForBox(box).map((t) => fetchJson<GridTile>(`grid/${t}.json`).catch(() => null))).then((x) => { if (live) setTiles(x.filter(Boolean) as GridTile[]) })
    return () => { live = false }
  }, [box])
  if (!host) return <StatusMessage kind="error">The centre of this area is outside every Bangladesh district. Draw it again over land.</StatusMessage>
  if (!tiles || !cal.data || !harm.data) return <SkeletonCard label="Summing fire cells inside your area" />
  const div = host.division
  const bs = harm.data.betas.filter((b) => b.step === 'A<-N' && b.division === div)
  const beta = bs.length ? bs.reduce((s, b) => s + b.beta.p50, 0) / bs.length : 0.25
  const total = Math.round(((box[2] - box[0]) / meta.grid.step) * ((box[3] - box[1]) / meta.grid.step))
  const per = aggregateBox(tiles, meta, box, cal.data.clear_frac?.N, total, beta)
  const byYear = new Map<string, number>()
  for (const [d, v] of per) { const y = seasonOf(new Date(dayIso(d) + 'T00:00:00Z')); byYear.set(y, (byYear.get(y) ?? 0) + v) }
  const ys = [...byYear.keys()].sort()
  const copy = () => navigator.clipboard?.writeText(location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) })
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[['Bangladesh', '/explore'], [`${host.division} division`], ['Your area']]} />
      <div>
        <h1 className="h-display text-[clamp(2rem,4.5vw,3rem)]">Your area</h1>
        <p className="code mt-2 text-muted">{formatBox(box)}</p>
      </div>
      <Section title="Season totals inside your area" download={{ name: `kilnwatch_box_${formatBox(box)}`, png: true }}
        actions={<button className="btn" onClick={copy}><Icon name={copied ? 'check' : 'pin'} />{copied ? 'Link copied' : 'Copy link'}</button>}
        summary={<>Approximate, and total burning only (no source split). Cloud cover is taken from {host.name_en} district and converted with the {div} division’s calibration (β ≈ <span className="num">{beta.toFixed(2)}</span>).</>}>
        {per.size === 0 ? <StatusMessage>No fire was detected inside this area. Try a larger area, or one over farmland.</StatusMessage> :
          <EChart label="Season totals of harmonized activity inside the drawn area" exportName={`kilnwatch_box_${formatBox(box)}`} height={280} option={{
            grid: { left: 48, right: 16, top: 24, bottom: 28 }, tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: ys, axisLabel: { hideOverlap: true } }, yAxis: { type: 'value', name: 'Season sum (MYD-eq)' },
            series: [{ type: 'bar', data: ys.map((y) => Math.round(byYear.get(y)! * 100) / 100), color: p.heat, barMaxWidth: 24 }] }} />}
      </Section>
    </div>
  )
}
