import { lazy, Suspense, useId, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { inGeometry, unitAt } from '../lib/geo'
import { seasonMean } from '../lib/calendar'
import { outlookFor } from '../lib/outlook'
import { busyMonths, MONTHS, SEASON_MONTHS, typicalSeason, whenText, monthOfSeasonDay } from '../lib/plain'
import { Skeleton, useKilnActivity, useTitle } from '../components/ui'
import { PageHead, TryLink, useQ } from '../components/plain'
import type { Pick } from '../components/WorldMap'
import { useJson } from '../lib/data'
import { useLang, useT } from '../lib/i18n'
import type { Box } from '../lib/box'
import { parseCities, searchPlaces, type City, type Hit } from '../lib/world'
import type { Calendar, FC, NrtSeason, Outlook, UnitProps } from '../lib/types'

const WorldMap = lazy(() => import('../components/WorldMap'))
const SOUTH_ASIA = ['AFG', 'BGD', 'BTN', 'IND', 'LKA', 'MDV', 'NPL', 'PAK']
const TRANSFER: Record<string, string> = { PAK: 'PK', IND: 'IN', AFG: 'AF' } // ISO3 → the codes used by the kiln tests abroad
const REVERSE_TRANSFER: Record<string, string> = { PK: 'PAK', IN: 'IND', AF: 'AFG' }
type StateProps = UnitProps & { type_en?: string | null; adm0?: string }
type CityFile = { fields: string[]; rows: (string | number | null)[][] }
const cityId = (c: City) => `${c.name}|${c.adm0}|${c.lat}`

function bboxOf(g: GeoJSON.Geometry): Box {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  const ring = (r: GeoJSON.Position[]) => r.forEach(([x, y]) => { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y) })
  if (g.type === 'Polygon') g.coordinates.forEach(ring)
  else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => p.forEach(ring))
  return [w, s, e, n]
}

/** The world map: find any country, state or city, and see what Kiln Watch covers there. */
export default function RegionPage() {
  useTitle('World map')
  const t = useT()
  const lang = useLang()
  const countries = useJson<FC>('aoi/world_countries.geojson')
  const states = useJson<FC>('aoi/world_states.geojson')
  const region = useJson<FC>('aoi/south_asia.geojson')
  const cityFile = useJson<CityFile>('aoi/world_cities.json')
  const cities = useMemo(() => (cityFile.data ? parseCities(cityFile.data) : []), [cityFile.data])
  const [sel, setSel] = useState<Pick | undefined>()
  const [focus, setFocus] = useState<{ box: Box; key: number } | undefined>()
  const countryName = useMemo(() => new Map((countries.data?.features ?? []).map((f) => [f.properties.unit_id, f.properties.name_en])), [countries.data])
  const ka = useKilnActivity().data
  const testedIso3 = useMemo(() => (ka?.transfer?.countries ?? []).filter((c) => c.evaluable !== false).map((c) => REVERSE_TRANSFER[c.code]).filter(Boolean), [ka])

  const zoomTo = (box: Box) => setFocus((f) => ({ box, key: (f?.key ?? 0) + 1 }))
  const featureOf = (p?: Pick) => p && (p.kind === 'state' ? states.data : p.kind === 'country' ? countries.data : undefined)?.features.find((f) => f.properties.unit_id === p.id)
  const cityOf = (p?: Pick) => (p?.kind === 'city' ? cities.find((c) => cityId(c) === p.id) : undefined)
  const pick = (p: Pick, zoom: boolean) => {
    setSel(p)
    if (!zoom) return
    const c = cityOf(p), f = featureOf(p)
    if (c) zoomTo([c.lon - 1.2, c.lat - 1.2, c.lon + 1.2, c.lat + 1.2])
    else if (f) zoomTo(bboxOf(f.geometry))
  }

  const entries = useMemo<Hit[]>(() => [
    ...(countries.data?.features ?? []).map((f) => ({ kind: 'country' as const, id: f.properties.unit_id, name: f.properties.name_en, nameBn: f.properties.name_bn, sub: 'Country', weight: 0 })),
    ...cities.map((c) => ({ kind: 'city' as const, id: cityId(c), name: c.name, nameBn: c.nameBn, sub: [c.adm1, countryName.get(c.adm0) ?? c.adm0].filter(Boolean).join(', '), weight: 2 + c.rank / 20 })),
    ...(states.data?.features ?? []).map((f) => {
      const p = f.properties as StateProps
      return { kind: 'state' as const, id: p.unit_id, name: p.name_en, nameBn: p.name_bn, sub: p.division, weight: 1 }
    }),
  ], [countries.data, states.data, cities, countryName])

  return (
    <div className="space-y-6">
      {lang === 'bn' && <p className="text-sm text-muted" lang="bn">{t('englishOnly')}</p>}
      <PageHead title="South Asia and the world">
        Every country, state and city on Earth. Search for a place or tap the map to see what Kiln Watch covers there: Bangladesh in depth, the rest of South Asia next.
      </PageHead>
      <PlaceSearch entries={entries} onPick={(h) => pick({ kind: h.kind, id: h.id }, true)} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {countries.data && cityFile.data ? (
          <Suspense fallback={<Skeleton className="h-[560px] w-full rounded-[10px]" />}>
            <WorldMap countries={countries.data} states={states.data} region={region.data} cities={cities} selected={sel} focus={focus}
              transferCountries={testedIso3} onPick={(p) => pick(p, p.kind === 'country')} />
          </Suspense>) : <Skeleton className="h-[560px] w-full rounded-[10px]" />}
        <aside className="panel space-y-3 self-start" aria-live="polite">
          <Details sel={sel} feature={featureOf(sel)?.properties as StateProps | undefined} geometry={featureOf(sel)?.geometry} city={cityOf(sel)} cities={cities}
            countryName={countryName} onCity={(c) => pick({ kind: 'city', id: cityId(c) }, true)} onZoom={() => { const f = featureOf(sel); if (f) zoomTo(bboxOf(f.geometry)) }} />
        </aside>
      </div>
      <p className="text-xs text-muted">Outlines and place names: Natural Earth (public domain), simplified; boundaries are shown as drawn there and imply no position on any claim.
        Populations are Natural Earth estimates. Backgrounds: NASA Blue Marble Next Generation and Black Marble 2016, via NASA GIBS.</p>
    </div>
  )
}

const KIND = { country: 'Country', state: 'State', city: 'City' } as const

/** Type a place name; the best matches float under the field (Tab or click to open, Enter takes the first, Escape closes). */
function PlaceSearch({ entries, onPick }: { entries: Hit[]; onPick: (h: Hit) => void }) {
  const id = useId()
  const [q, setQ] = useState('')
  const hits = useMemo(() => searchPlaces(entries, q), [entries, q])
  const take = (h: Hit) => { onPick(h); setQ('') }
  const none = q.trim().length >= 2 && hits.length === 0 && entries.length > 0
  return (
    <div className="relative z-30 max-w-xl">
      <label htmlFor={id} className="block text-sm font-semibold">Find a city, state or country</label>
      <input id={id} className="field mt-1 w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Lahore, Punjab, Nepal, ঢাকা" autoComplete="off"
        aria-controls={`${id}-list`} aria-expanded={hits.length > 0}
        onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) take(hits[0]); if (e.key === 'Escape') setQ('') }} />
      {(hits.length > 0 || none) && <div id={`${id}-list`} className="panel absolute inset-x-0 top-full mt-1 p-1 shadow-lg">
        {none ? <p className="px-2 py-1.5 text-sm text-muted">No place by that name. Try another spelling, or the Bangla name.</p>
          : <ul aria-label="Matching places">{hits.map((h) => <li key={`${h.kind}:${h.id}`}>
            <button type="button" className="flex w-full items-baseline gap-2 rounded-[4px] px-2 py-1.5 text-left hover:bg-surface-2 focus-visible:bg-surface-2" onClick={() => take(h)}
              aria-label={`${h.name} (${KIND[h.kind].toLowerCase()}${h.sub && h.kind !== 'country' ? `, ${h.sub}` : ''})`}>
              <span className="tag w-16 shrink-0">{KIND[h.kind]}</span><b className="truncate">{h.name}</b>
              {h.sub && h.kind !== 'country' && <span className="truncate text-sm text-muted">{h.sub}</span>}</button></li>)}</ul>}
      </div>}
    </div>
  )
}

function Details({ sel, feature, geometry, city, cities, countryName, onCity, onZoom }: {
  sel?: Pick; feature?: StateProps; geometry?: GeoJSON.Geometry; city?: City; cities: City[]; countryName: Map<string, string>; onCity: (c: City) => void; onZoom: () => void
}) {
  if (!sel || (!feature && !city)) return <p className="text-muted">Search for a place, or tap a country. Zoom in for states, provinces and more cities.</p>
  const adm0 = city?.adm0 ?? feature?.adm0 ?? feature?.unit_id ?? ''
  const country = countryName.get(adm0) ?? feature?.division ?? adm0
  const big = feature && sel.kind === 'state' ? cities.filter((c) => c.adm0 === adm0 && c.adm1 === feature.name_en).sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0)).slice(0, 5) : []
  return (
    <>
      <h2 className="h-section">{city?.name ?? feature!.name_en} {(city?.nameBn ?? feature!.name_bn) !== (city?.name ?? feature!.name_en) && <span className="text-muted" lang="bn">({city?.nameBn ?? feature!.name_bn})</span>}</h2>
      <p className="text-sm text-muted">{city ? <>{city.capital ? 'Capital city' : 'City'}{city.adm1 ? ` in ${city.adm1}` : ''}, {country}</>
        : sel.kind === 'state' ? <>{feature!.type_en ?? 'State'} of {country}</> : 'Country'}</p>
      {city?.pop != null && <p>About <b>{city.pop.toLocaleString('en-US')}</b> people (Natural Earth estimate).</p>}
      <Coverage adm0={adm0} kind={sel.kind} city={city} geometry={geometry} />
      {sel.kind === 'country' && <button type="button" className="btn" onClick={onZoom}>Zoom to {country}</button>}
      {big.length > 0 && <div className="space-y-1"><p className="text-sm font-semibold">Largest cities here</p>
        <ul className="flex flex-wrap gap-1">{big.map((c) => <li key={cityId(c)}><button type="button" className="btn text-sm" onClick={() => onCity(c)}>{c.name}</button></li>)}</ul></div>}
    </>
  )
}

/** What Kiln Watch has for the picked place: Bangladesh's own numbers, the kiln tests abroad, or nothing yet. */
function Coverage({ adm0, kind, city, geometry }: { adm0: string; kind: Pick['kind']; city?: City; geometry?: GeoJSON.Geometry }) {
  if (adm0 === 'BGD') return <div className="space-y-3 border-t border-line pt-3"><BangladeshFacts kind={kind} city={city} geometry={geometry} /></div>
  if (SOUTH_ASIA.includes(adm0)) return <div className="space-y-3 border-t border-line pt-3">
    <p>Fire calendar coming. Kiln method already tested:</p>
    <KilnAbroad adm0={adm0} />
    <p className="text-sm text-muted">The Bangladesh method has been tested in Pakistan and India with mixed results — all published.</p></div>
  return <p className="border-t border-line pt-3 text-sm text-muted">Outside the study area. Kiln Watch analyses Bangladesh in depth, and South Asia next.</p>
}

/** Bangladesh: a city opens its district's facts; a division lists its districts; the country gives the national picture. */
function BangladeshFacts({ kind, city, geometry }: { kind: Pick['kind']; city?: City; geometry?: GeoJSON.Geometry }) {
  const q = useQ()
  const dists = useJson<FC>('aoi/districts.geojson').data
  const nrt = useJson<NrtSeason>('nrt/current_season.json').data
  const ka = useKilnActivity().data
  if (!dists) return null
  if (kind === 'city' && city) {
    const d = unitAt(dists, city.lat, city.lon)
    return d ? <DistrictFacts id={d.unit_id} name={d.name_en} nrt={nrt} /> : <p className="text-sm text-muted">This place lies outside Bangladesh’s district outlines.</p>
  }
  // districts whose centre lies in the picked division (Natural Earth's divisions do not match the official names exactly)
  const inside = kind === 'state' && geometry ? dists.features.filter((f) => { const [w, s, e, n] = bboxOf(f.geometry); return inGeometry(geometry, (s + n) / 2, (w + e) / 2) }) : dists.features
  const rows = inside.map((f) => ({ id: f.properties.unit_id, name: f.properties.name_en, unusual: nrt?.districts[f.properties.unit_id]?.above_p90_days ?? null }))
    .sort((a, b) => (b.unusual ?? -1) - (a.unusual ?? -1))
  const hot = rows.filter((r) => (r.unusual ?? 0) > 0)
  const kiln = kind === 'country' && ka?.national ? typicalSeason(ka.national.seasons) : null
  const extra = kind === 'state' ? [...new Set(inside.map((f) => f.properties.division))] : [] // official divisions inside this outline
  return <>
    <p><b>{rows.length}</b> districts{kind === 'state' ? ' here' : ''}. {nrt && <>This season ({nrt.season}), <b>{hot.length}</b> {hot.length === 1 ? 'has' : 'have'} had an unusual day.</>}</p>
    {extra.length > 1 && <p className="text-xs text-muted">This outline is older than today’s divisions, so it includes districts of {extra.join(' and ')} divisions.</p>}
    {kiln && <p className="text-sm">Brick kilns across Bangladesh usually work <b>{whenText(kiln.onset)}</b> to <b>{whenText(kiln.end)}</b>{kiln.peak != null && <>, busiest in <b>{monthOfSeasonDay(kiln.peak)}</b></>}.</p>}
    <div className="space-y-1"><p className="text-sm font-semibold">{hot.length ? 'Most unusual days this season' : 'Districts'}</p>
      <ul className="divide-y divide-line text-sm">{(hot.length ? hot : rows).slice(0, 6).map((r) => <li key={r.id}>
        <Link to={`/area/${r.id}${q}`} className="flex justify-between gap-2 rounded-[4px] px-1 py-1.5 hover:bg-surface-2"><span>{r.name}</span>
          {r.unusual != null && <span className="num text-muted">{r.unusual} {r.unusual === 1 ? 'day' : 'days'}</span>}</Link></li>)}</ul></div>
    <TryLink to="/area" primary>Check my area</TryLink>
  </>
}

/** One district's answers, the same facts as My area: usual fire months, this season, the next two weeks, kilns. */
function DistrictFacts({ id, name, nrt }: { id: string; name: string; nrt?: NrtSeason }) {
  const cal = useJson<Calendar>(`calendar/${id}.json`).data
  const ol = useJson<Outlook>('outlook.json').data
  const ka = useKilnActivity().data
  const bm = useMemo(() => (cal ? busyMonths(seasonMean(cal)) : null), [cal])
  const now = nrt?.districts[id]
  const next = ol?.ships && nrt && cal ? outlookFor(ol, id, nrt, cal.normal.p90) : null
  const kiln = ka?.areas?.[id] ? typicalSeason(ka.areas[id].seasons) : null
  return <>
    <p className="text-sm text-muted">In {name} district</p>
    <dl className="space-y-2 text-sm">
      <div><dt className="font-semibold">Fire season</dt><dd>{bm ? <>Usually {SEASON_MONTHS[bm.first]} to {SEASON_MONTHS[bm.last]}, busiest in {SEASON_MONTHS[bm.peak]}.</> : 'Very little fire recorded since 2003.'}</dd></div>
      {now && <div><dt className="font-semibold">This season</dt><dd>{now.above_p90_days ? `${now.above_p90_days} unusual ${now.above_p90_days === 1 ? 'day' : 'days'} since 1 July.` : 'Normal so far: no unusual days since 1 July.'} Provisional.</dd></div>}
      {next?.state === 'on' && <div><dt className="font-semibold">Next two weeks</dt><dd>{Math.round(next.p * 100)}% chance of an unusual day (usual for this time of year: {Math.round(next.clim * 100)}%).</dd></div>}
      {next && next.state === 'before' && <div><dt className="font-semibold">Next two weeks</dt><dd>The outlook starts on {next.opens}.</dd></div>}
      {kiln && <div><dt className="font-semibold">Brick kilns</dt><dd>Usually work {whenText(kiln.onset)} to {whenText(kiln.end)}{kiln.peak != null && <>, busiest in {monthOfSeasonDay(kiln.peak)}</>}.</dd></div>}
    </dl>
    <TryLink to={`/area/${id}`} primary>Open {name} in My area</TryLink>
  </>
}

/** The kiln method abroad (Amendments 2–4): what the night lights found in this country. */
function KilnAbroad({ adm0 }: { adm0: string }) {
  const q = useQ()
  const ka = useKilnActivity().data
  const c = TRANSFER[adm0] ? ka?.transfer?.countries.find((x) => x.code === TRANSFER[adm0]) : undefined
  if (!c) return null
  const run = c.retest ?? c, ntl = run.channels.ntl, s1 = c.channels.s1
  const months = ntl?.learned.core ?? []
  const ok = ntl?.pass.LL
  return <div className="space-y-1.5 rounded-[6px] bg-surface-2 p-3 text-sm">
    <p className="font-semibold">Kiln extension: tested here</p>
    <p>NASA night lights at <b>{run.n_clusters.toLocaleString('en-US')}</b> kiln clusters{c.retest ? ' (retest)' : ''}: the kiln-season test {ok ? <b className="text-ok">passed</b> : <b className="text-err">did not pass</b>}.</p>
    {ok && months.length > 0 && <p>Kilns here are busiest from <b>{MONTHS[months[0] - 1]}</b> to <b>{MONTHS[months.at(-1)! - 1]}</b>, learned from the night lights.</p>}
    {!ok && <p>No reliable kiln season found in the night lights, so none is claimed.</p>}
    {s1?.pass.LS != null && <p className="text-muted">Radar check (Sentinel-1): {s1.pass.LS ? 'passed' : 'did not pass'}.</p>}
    <Link className="text-orbit underline" to={'/trust' + q}>See every test abroad</Link>
  </div>
}
