import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChartCard, CIText, DownloadButtons, EChart, Loading, SegmentedToggle, StatusMessage, useKilnActivity, useMeta } from '../components/ui'
import { CalendarHeatmap, KilnSeasonShapeChart, NormalBandChart, SourceStackChart } from '../components/charts'
import { fetchJson, useJson } from '../lib/data'
import { useUrlState } from '../lib/url'
import { useT } from '../lib/i18n'
import { aggregateBox, calendarToCsv, resolveSplit, seasonMean } from '../lib/calendar'
import { formatBox, tilesForBox, type Box } from '../lib/box'
import { dayIso, seasonOf } from '../lib/days'
import type { Calendar, FC, GridTile, Harmonization, Meta } from '../lib/types'

const FireMap = lazy(() => import('../components/FireMap'))

export default function ExplorerPage() {
  const [u, setQ] = useUrlState()
  const nav = useNavigate()
  const t = useT()
  const meta = useMeta()
  const level = u.level === 'upazila' ? 'upazila' : 'district'
  const fc = useJson<FC>(`aoi/${level}s.geojson`)
  const districts = useJson<FC>('aoi/districts.geojson')
  const [drawing, setDrawing] = useState(false)
  const qs = new URLSearchParams(window.location.hash.split('?')[1] ?? '').toString()
  const go = (path: string) => nav(path + (qs ? `?${qs}` : ''))
  const units = fc.data?.features.map((f) => f.properties) ?? []
  const sel = units.find((x) => x.unit_id === u.unitId)

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <aside className="space-y-3">
        <div className="card space-y-3">
          <label className="block text-sm font-semibold" htmlFor="unit-search">{t('pick')}</label>
          <input id="unit-search" list="units" className="w-full rounded-md border border-stone-300 px-3 py-2" placeholder="e.g. Dhaka, Rajshahi…"
            onChange={(e) => { const m = units.find((x) => x.name_en.toLowerCase() === e.target.value.toLowerCase() || x.name_bn === e.target.value); if (m) go(`/explore/${level}/${m.unit_id}`) }} />
          <datalist id="units">{units.map((x) => <option key={x.unit_id} value={x.name_en}>{x.name_bn}</option>)}</datalist>
          <SegmentedToggle label="Area level" value={level} options={[['district', 'District'], ['upazila', 'Upazila']]}
            onChange={(v) => go(`/explore/${v}`)} />
          <button className={`btn w-full ${drawing ? 'bg-orange-100' : ''}`} onClick={() => setDrawing(!drawing)} aria-pressed={drawing}>
            {drawing ? 'Drag on the map to draw a box (click to cancel)' : '▭ Draw your own area'}
          </button>
        </div>
        <Loading state={fc}>{(f) => (
          <Suspense fallback={<StatusMessage kind="loading">Loading map…</StatusMessage>}>
            <FireMap fc={f} selected={u.unitId} onSelect={(id) => go(`/explore/${level}/${id}`)} drawing={drawing} box={u.box}
              onBox={(b) => { setDrawing(false); go(`/explore/box/${formatBox(b)}`) }} />
          </Suspense>)}
        </Loading>
        <p className="text-xs text-stone-500">{meta.data?.gate_branch === 'nokiln' ? 'Click an area, search by name, or draw your own box.' : 'Map colour = share of heat that is kiln-like. Click an area, search by name, or draw a box.'}</p>
      </aside>

      <section className="min-w-0 space-y-4">
        {u.boxError && <StatusMessage kind="error">{u.boxError}</StatusMessage>}
        {u.box && meta.data && districts.data && <BoxView box={u.box} meta={meta.data} districts={districts.data} />}
        {!u.box && !u.unitId && !u.boxError && <Welcome units={units.slice(0, 6)} onPick={(id) => go(`/explore/${level}/${id}`)} nokiln={meta.data?.gate_branch === 'nokiln'} />}
        {u.unitId && !u.box && meta.data && <UnitView unitId={u.unitId} name={sel ? `${sel.name_en} · ${sel.name_bn}` : u.unitId} meta={meta.data} u={u} setQ={setQ} kilnCount={sel?.kiln_count} />}
      </section>
    </div>
  )
}

function Welcome({ units, onPick, nokiln }: { units: { unit_id: string; name_en: string }[]; onPick: (id: string) => void; nokiln?: boolean }) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold">Pick an area to see its burning calendar</h2>
      <p className="note">You will see every day since 2003 on one harmonized scale, how this season compares with normal, {nokiln
        ? 'unusual days and critical periods, and, where there are brick kilns, when the kiln season runs compared with the fires.'
        : 'and how much of the heat looks like brick kilns versus crop fires.'}</p>
      <div className="mt-3 flex flex-wrap gap-2">{units.map((x) => <button key={x.unit_id} className="btn" onClick={() => onPick(x.unit_id)}>{x.name_en}</button>)}</div>
    </div>
  )
}

function UnitView({ unitId, name, meta, u, setQ, kilnCount }: { unitId: string; name: string; meta: Meta; u: ReturnType<typeof useUrlState>[0]; setQ: ReturnType<typeof useUrlState>[1]; kilnCount?: number | null }) {
  const cal = useJson<Calendar>(`calendar/${unitId}.json`)
  const ka = useKilnActivity().data
  const kilnArea = ka?.layer ? ka.areas?.[unitId] : undefined
  const t = useT()
  const split = resolveSplit(meta, u.split)
  return (
    <Loading state={cal}>{(c) => {
      const seasons = c.seasons.map((s) => s.season)
      const complete = seasons.filter((s) => s !== seasonOf(new Date()))
      const season = u.season && seasons.includes(u.season) ? u.season : complete.at(-1) ?? seasons.at(-1) ?? seasonOf(new Date())
      const label = (k: string) => meta.split_labels.find((s) => s.key === k)?.[u.lang === 'bn' ? 'label_bn' : 'label_en'] ?? k
      return (
        <>
          <div className="card flex flex-wrap items-center gap-3">
            <div><h2 className="text-xl font-bold">{name}</h2>
              {kilnCount != null && <p className="text-sm text-stone-600">{kilnCount} mapped kilns (APAD inventory)</p>}</div>
            <div className="ml-auto flex flex-wrap gap-2">
              <SegmentedToggle label="Raw or harmonized" value={u.mode} options={[['harm', t('harm')], ['raw', t('raw')]]} onChange={(v) => setQ({ mode: v === 'harm' ? undefined : v })} />
              <SegmentedToggle label="Year layout" value={u.layout} options={[['cal', t('cal')], ['season', t('seasonLayout')]]} onChange={(v) => setQ({ layout: v === 'cal' ? undefined : v })} />
              <select aria-label="Source" className="btn" value={split} onChange={(e) => setQ({ split: e.target.value === 'all' ? undefined : e.target.value })}>
                <option value="all">{t('all')}</option>
                {meta.split_labels.map((s) => <option key={s.key} value={s.key}>{label(s.key)}</option>)}
              </select>
            </div>
          </div>
          {u.split !== split && <StatusMessage>Source “{u.split}” does not exist in this data build; showing all sources.</StatusMessage>}
          <ChartCard title="Every day since 2003" actions={<DownloadButtons name={`kilnwatch_${unitId}`} csv={() => calendarToCsv(c, meta.split_labels.map((s) => s.key))} json={c} />}
            summary={<>Each row is a year, each square a day. Darker = more fire activity ({t('unit')}). Grey = the satellite could not see the ground (cloud) — that is “not observed”, not “no fire”. {u.mode === 'raw' ? 'Raw view: each sensor in its own units — notice the jump in 2012.' : 'Harmonized view: all years on the Aqua-MODIS scale.'}</>}>
            <CalendarHeatmap cal={c} mode={u.mode} split={split} layout={u.layout} />
          </ChartCard>
          <ChartCard title={`Season ${season} against the normal range`}
            actions={<select aria-label="Season" className="btn" value={season} onChange={(e) => setQ({ season: e.target.value })}>{seasons.map((s) => <option key={s}>{s}</option>)}</select>}
            summary="Shaded band: the middle 80% of all seasons 2003–2025 for each day. Dots: unusual days above the 90th percentile. Light-red shading: critical periods when activity is normally at its yearly high.">
            <NormalBandChart cal={c} season={season} mode={u.mode} split={split} />
          </ChartCard>
          {kilnArea?.e && ka && <ChartCard title="Two burning seasons: fires and kilns"
            actions={<Link className="btn" to={`/kilns?${new URLSearchParams(window.location.hash.split('?')[1] ?? '')}`}>Kiln seasons →</Link>}
            summary={<>Green: this area’s average fire activity through the season (FIRMS, harmonized, 2003 to today). Brown: the kiln season, from {ka.layer === 'ntl' ? 'night lights' : 'radar'} at {kilnArea.n_clusters} mapped kiln clusters against matched control sites (band = middle half of seasons).
              Kiln heat does not show up in fire detections, so the two are measured with different satellites, and they follow different calendars.</>}>
            <KilnSeasonShapeChart ka={ka} area={kilnArea} burning={seasonMean(c)} />
          </ChartCard>}
          <ChartCard title="Where the heat comes from" summary={`Season totals split into ${meta.split_labels.map((s) => label(s.key).toLowerCase()).join(', ')}.`}>
            <SourceStackChart cal={c} meta={meta} lang={u.lang} />
          </ChartCard>
          <ChartCard title="Season metrics (with 95% intervals)" summary="Midpoint and duration are counted in days from 1 July. First/last detection dates depend on the sensor’s sensitivity, so compare them with care.">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left text-stone-500"><th>Season</th><th>Midpoint (day)</th><th>Duration (days)</th><th>Peak</th><th>First*</th><th>Last*</th></tr></thead>
              <tbody>{c.seasons.slice().reverse().map((s) => <tr key={s.season} className="border-t border-stone-100"><td>{s.season}</td><td><CIText ci={s.midpoint} d={0} /></td><td><CIText ci={s.duration} d={0} /></td><td><CIText ci={s.peak} /></td><td>{s.first}</td><td>{s.last}</td></tr>)}</tbody>
            </table></div>
          </ChartCard>
        </>
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
  const [cx, cy] = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2]
  const host = districts.features.find((f) => inPoly(cx, cy, f.geometry))?.properties
  const cal = useJson<Calendar>(host ? `calendar/${host.unit_id}.json` : null)
  const harm = useJson<Harmonization>('harmonization.json')
  const [tiles, setTiles] = useState<GridTile[] | null>(null)
  useMemo(() => { Promise.all(tilesForBox(box).map((t) => fetchJson<GridTile>(`grid/${t}.json`).catch(() => null))).then((x) => setTiles(x.filter(Boolean) as GridTile[])) }, [box])
  if (!host) return <StatusMessage kind="error">The box centre is not inside a Bangladesh district.</StatusMessage>
  if (!tiles || !cal.data || !harm.data) return <StatusMessage kind="loading">Summing fire cells inside your box…</StatusMessage>
  const div = host.division
  const bs = harm.data.betas.filter((b) => b.step === 'A<-N' && b.division === div)
  const beta = bs.length ? bs.reduce((s, b) => s + b.beta.p50, 0) / bs.length : 0.25
  const total = Math.round(((box[2] - box[0]) / meta.grid.step) * ((box[3] - box[1]) / meta.grid.step))
  const per = aggregateBox(tiles, meta, box, cal.data.clear_frac?.N, total, beta)
  const byYear = new Map<string, number>()
  for (const [d, v] of per) { const y = seasonOf(new Date(dayIso(d) + 'T00:00:00Z')); byYear.set(y, (byYear.get(y) ?? 0) + v) }
  const ys = [...byYear.keys()].sort()
  return (
    <ChartCard title={`Your box: ${formatBox(box)}`} summary={<>Approximate; total burning only (no source split). Cloud cover is taken from {host.name_en} district and converted with the {div} division’s calibration (β ≈ {beta.toFixed(2)}). Share this view by copying the address bar.</>}>
      {per.size === 0 ? <StatusMessage>No fire cell-days found inside this box.</StatusMessage> :
        <EChart label="Season totals of harmonized activity inside the drawn box" height={280} option={{
          grid: { left: 56, right: 16, top: 24, bottom: 40 }, tooltip: { trigger: 'axis' },
          xAxis: { type: 'category', data: ys, axisLabel: { rotate: 45 } }, yAxis: { type: 'value', name: 'Season sum (MYD-eq)' },
          series: [{ type: 'bar', data: ys.map((y) => Math.round(byYear.get(y)! * 100) / 100), color: '#c2410c' }] }} />}
    </ChartCard>
  )
}
