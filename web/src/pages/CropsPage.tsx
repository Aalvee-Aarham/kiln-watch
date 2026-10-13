import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CIText, useMeta, useTitle } from '../components/ui'
import { PageHead } from '../components/plain'
import { TypicalYear } from '../components/TypicalYear'
import { completeSeasons, hillShare, monthsShare, seasonMean, splitShares } from '../lib/calendar'
import { BBOX, tilesForBox } from '../lib/box'
import { CROP_SOURCES, source, type CropSource } from '../lib/cropSources'
import { fetchJson, useJson } from '../lib/data'
import { dayIso, seasonStart } from '../lib/days'
import { busyMonths, SEASON_MONTHS, windowsText } from '../lib/plain'
import type { Calendar, Events, FC, GridTile, NrtSeason, Validation } from '../lib/types'

/**
 * Crops & harvest: burning around the harvests, from Kiln Watch's harmonized NASA FIRMS record (computed here from the
 * public export), and what the satellites cannot see (soil, smoke, health), each statement linked to its source
 * (lib/cropSources.ts). No typed-in figures.
 */
const HILL = ['Bandarban', 'Rangamati', 'Khagrachhari']
const pct = (x: number | null | undefined) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)}%`)
/** Calendar months a day-of-year window covers, in order (a window may run past 31 December). */
function windowMonths(startDoy: number, endDoy: number): number[] {
  const m = (doy: number) => new Date(Date.UTC(2001, 0, doy)).getUTCMonth() + 1
  const out: number[] = []
  for (let k = m(startDoy), i = 0; i < 12; i++, k = (k % 12) + 1) { out.push(k); if (k === m(endDoy)) break }
  return out
}

/** One outside statement with its source link. */
function Cited({ id, className = '' }: { id: string; className?: string }) {
  const s = source(id)
  return (
    <span className={className}>
      {s.text} <a className="text-orbit underline" href={s.url} target="_blank" rel="noreferrer" title={s.title}>[{s.publisher.split(',')[0]}]</a>
    </span>
  )
}

type Crop = 'rice' | 'wheat' | 'jhum' | 'sugarcane'

export default function CropsPage() {
  useTitle('Crops & Harvest · Earth Observation')
  const [selectedCrop, setSelectedCrop] = useState<Crop>('rice')
  const [unitId, setUnitId] = useState('BD3026') // Dhaka
  const meta = useMeta().data
  const events = useJson<Events>('events.json').data
  const nrt = useJson<NrtSeason>('nrt/current_season.json').data
  const dists = useJson<FC>('aoi/districts.geojson').data
  const validation = useJson<Validation>('validation.json').data
  const cal = useJson<Calendar>(`calendar/${unitId}.json`).data
  const sorted = useMemo(() => (dists?.features ?? []).map((f) => f.properties).sort((a, b) => a.name_en.localeCompare(b.name_en)), [dists])
  const name = sorted.find((u) => u.unit_id === unitId)?.name_en ?? unitId
  const hillIds = useMemo(() => HILL.map((n) => dists?.features.find((f) => f.properties.name_en === n)?.properties.unit_id), [dists])
  const hill0 = useJson<Calendar>(hillIds[0] ? `calendar/${hillIds[0]}.json` : null).data
  const hill1 = useJson<Calendar>(hillIds[1] ? `calendar/${hillIds[1]}.json` : null).data
  const hill2 = useJson<Calendar>(hillIds[2] ? `calendar/${hillIds[2]}.json` : null).data
  const hills = [hill0, hill1, hill2]

  const label = (k: string) => meta?.split_labels.find((l) => l.key === k)?.label_en ?? k
  const shares = cal ? splitShares(cal) : []
  const seasons = cal && nrt ? completeSeasons(cal, nrt.season) : []
  const harvest = events?.harvest ?? []
  const rice = harvest.map((h) => ({ crop: h.crop, months: windowMonths(h.start_doy, h.end_doy), url: h.url }))
  const busy = (c?: Calendar) => (c ? busyMonths(seasonMean(c)) : null)

  // The hill-district share of Bangladesh's Aqua MODIS detections needs every grid tile (about 2.5 MB): on request only.
  const [tiles, setTiles] = useState<GridTile[] | null>(null)
  const [wantShare, setWantShare] = useState(false)
  useEffect(() => {
    if (!wantShare || tiles) return
    let live = true
    Promise.all(tilesForBox(BBOX).map((t) => fetchJson<GridTile>(`grid/${t}.json`).catch(() => null)))
      .then((x) => { if (live) setTiles(x.filter(Boolean) as GridTile[]) })
    return () => { live = false }
  }, [wantShare, tiles])
  const shareEnd = nrt ? seasonStart(nrt.season) - 1 : null
  const hillPct = useMemo(() => {
    if (!tiles || !meta || !dists || shareEnd === null) return null
    const hillGeoms = dists.features.filter((f) => HILL.includes(f.properties.name_en)).map((f) => f.geometry)
    return hillShare(tiles, meta, hillGeoms, dists.features.map((f) => f.geometry), shareEnd)
  }, [tiles, meta, dists, shareEnd])

  // Same-day row (lag 0), not the strongest: no picking. Series names as Pm25LagChart labels them per gate outcome.
  const pm = validation?.pm25?.find((x) => x.lag === 0) ?? null
  const [pmA, pmB] = meta?.gate_branch === 'nokiln' ? ['non-harvest burning', 'harvest-window burning'] : ['the kiln index', 'the vegetation index']

  // `windows`: calendar-month windows, each named on its own (rice has two: Aman and Boro).
  const crops: Record<Crop, { name: string; season: React.ReactNode; timing: string; windows: number[][]; soil: string; risk: string }> = {
    rice: { name: 'Aman & Boro rice', season: rice.map((r) => `${r.crop === 'aman' ? 'Aman' : r.crop === 'boro' ? 'Boro' : r.crop} harvest: ${windowsText([r.months])}`).join(' · ') || 'Harvest windows loading…',
      timing: 'burning-season', windows: rice.map((r) => r.months), soil: 'soil-nutrients', risk: 'smoke-pollutants' },
    wheat: { name: 'Rabi wheat', season: source('wheat-window').text, timing: 'wheat-window', windows: [source('wheat-window').months!], soil: 'soil-residue-content', risk: 'residue-shares' },
    jhum: { name: 'Shifting cultivation (jhum)', season: <Cited id="jhum-sowing" />, timing: 'jhum-sowing', windows: [], soil: 'jhum-harm', risk: 'jhum-fallow' },
    sugarcane: { name: 'Sugarcane', season: source('sugarcane-window').text, timing: 'sugarcane-window', windows: [source('sugarcane-window').months!], soil: 'soil-microflora', risk: 'residue-shares' },
  }
  const active = crops[selectedCrop]
  const signature = selectedCrop === 'jhum'
    ? hills.map((c, i) => { const b = busy(c); return b ? `${HILL[i]}: busiest ${SEASON_MONTHS[b.first]} to ${SEASON_MONTHS[b.last]}` : null }).filter(Boolean).join(' · ') || 'Loading the hill districts…'
    : cal ? `${pct(monthsShare(cal, active.windows.flat()))} of ${name}'s typical-year harmonized burning falls in ${windowsText(active.windows) || 'these months'}.` : 'Loading…'
  // Sources cited on this page (the FIRMS detection limit is cited on the Sensors page).
  const nSources = new Set(CROP_SOURCES.filter((s: CropSource) => s.id !== 'firms-min-fire').map((s) => s.url)).size

  return (
    <div className="space-y-8 max-w-none">
      <PageHead title="Crops, Harvest Timing & Soil Health">
        When fields burn around the harvests, measured from Kiln Watch&rsquo;s harmonized NASA fire record for every district of Bangladesh
        {seasons.length ? <> ({seasons.length} complete seasons for {name})</> : null}, and what the satellites cannot see, from cited studies.
      </PageHead>
      <p className="text-xs text-muted">Sources: calendar/{unitId}.json, events.json, nrt/current_season.json and grid/ tiles from the Kiln Watch public export
        {meta ? <>, build <span className="code">{meta.git_sha}</span></> : null}; {nSources} published sources, linked beside each statement.</p>

      <label className="flex flex-wrap items-center gap-2 text-sm text-muted">District:
        <select className="field py-1 px-2" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          {sorted.map((u) => <option key={u.unit_id} value={u.unit_id}>{u.name_en}</option>)}
        </select>
      </label>

      {/* Hero Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-[10px] border border-line bg-surface p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-orbit font-bold">1. Harvest Timing</span>
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          </div>
          <h3 className="font-semibold text-sm text-ink">Derived From Thermal Waves</h3>
          <p className="text-xs text-muted leading-relaxed">
            {shares.length ? <>In {name}, {shares.map((s) => `${pct(s.share_frac)} ${label(s.key).toLowerCase()}`).join(', ')} (share of harmonized burning since 2003). A window is a date range: fire inside it counts whatever is burning.</> : 'Loading…'}
            {' '}Upazila calendars are on <Link className="underline" to="/area">My area</Link>.
          </p>
        </div>

        <div className="rounded-[10px] border border-line bg-surface p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-orange-400 font-bold">2. Soil & Carbon Damage</span>
            <span className="h-2 w-2 rounded-full bg-orange-400" />
          </div>
          <h3 className="font-semibold text-sm text-ink">Nutrients Lost to Burning</h3>
          <p className="text-xs text-muted leading-relaxed"><Cited id="soil-nutrients" /></p>
        </div>

        <div className="rounded-[10px] border border-line bg-surface p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-rose-400 font-bold">3. Worker Health & Smoke</span>
            <span className="h-2 w-2 rounded-full bg-rose-400" />
          </div>
          <h3 className="font-semibold text-sm text-ink">PM2.5 & Health</h3>
          <p className="text-xs text-muted leading-relaxed"><Cited id="pm25-body" /> <Cited id="haryana-survey" /></p>
        </div>
      </div>

      {/* SECTION 1: Crop Selection & Deep Analysis */}
      <div className="rounded-[12px] border border-line bg-surface p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <h2 className="text-lg font-bold text-ink">Agricultural Systems & Crop Cycles</h2>
            <p className="text-xs text-muted">Select a crop: its season, how much of {name}&rsquo;s burning falls in it, and what studies report about soil and smoke</p>
          </div>

          <div className="flex flex-wrap gap-1.5 bg-surface-2 p-1 rounded-[8px] border border-line">
            {(['rice', 'wheat', 'jhum', 'sugarcane'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSelectedCrop(k)}
                className={`px-3 py-1 text-xs font-mono rounded-[6px] transition-all cursor-pointer ${
                  selectedCrop === k
                    ? 'bg-orbit text-black font-semibold shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {k === 'jhum' ? 'Jhum (Hill Tracts)' : k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Detailed Breakdown Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div className="rounded-[8px] border border-line bg-surface-2 p-4 space-y-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-orbit font-semibold">
                Active Cycle & Windows
              </span>
              <h3 className="text-base font-bold text-ink">{active.name}</h3>
              <p className="text-xs font-mono text-muted">{active.season}</p>
              {selectedCrop === 'rice' && rice[0] && <a className="text-xs text-orbit underline" href={rice[0].url} target="_blank" rel="noreferrer">[FAO GIEWS]</a>}
            </div>

            <div className="rounded-[8px] border border-line bg-surface-2 p-4 space-y-2">
              <h4 className="text-xs font-bold font-mono text-ink uppercase tracking-wider">
                Harvest Timing from Fire Timing
              </h4>
              <p className="text-xs text-muted leading-relaxed"><Cited id={active.timing} /></p>
              <div className="mt-2 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded">
                Satellite Signature (Kiln Watch): {signature}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[8px] border border-line bg-surface-2 p-4 space-y-2">
              <h4 className="text-xs font-bold font-mono text-orange-400 uppercase tracking-wider">
                Soil Degradation & Repeat-Burn Impact
              </h4>
              <p className="text-xs text-muted leading-relaxed"><Cited id={active.soil} /></p>
              <ul className="text-xs space-y-1 text-muted list-disc pl-4">
                <li><Cited id="soil-heat" /></li>
                <li><Cited id="soil-microflora" /></li>
                <li><Cited id="soil-residue-content" /></li>
              </ul>
            </div>

            <div className="rounded-[8px] border border-line bg-surface-2 p-4 space-y-2">
              <h4 className="text-xs font-bold font-mono text-rose-400 uppercase tracking-wider">
                Wider Risks
              </h4>
              <p className="text-xs text-muted leading-relaxed"><Cited id={active.risk} /></p>
            </div>
          </div>
        </div>

        {cal && <TypicalYear perDay={seasonMean(cal)} nrt={nrt} distId={unitId} kiln={null} events={events} name={name} />}
      </div>

      {/* SECTION 2: Shifting Cultivation (Jhum) in the Chittagong Hill Tracts */}
      <div className="rounded-[12px] border border-line bg-surface p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-orange-500" />
            <h3 className="text-base font-bold text-ink uppercase tracking-wider font-mono">
              Deep Dive: Shifting Cultivation (Jhum) in the Chittagong Hill Tracts
            </h3>
          </div>
          <span className="font-mono text-xs text-muted">Kiln Watch, from NASA FIRMS</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-[8px] bg-surface-2 border border-line space-y-1.5">
            <span className="font-mono text-[11px] text-orange-400 font-semibold">
              {hillPct !== null ? `${pct(hillPct)} of Bangladesh's Aqua MODIS fire detections` : 'Share of Bangladesh’s fire detections'}
            </span>
            <p className="text-muted leading-relaxed">
              {hillPct !== null
                ? <>The three hill districts ({HILL.join(', ')}) held this share of Aqua MODIS fire detections in Bangladesh from 2003 to {shareEnd !== null ? dayIso(shareEnd) : ''}, counted as 1 km grid cell-days, all fire types, from the grid/ tiles.</>
                : <>Computed from every grid tile of the Kiln Watch export (about 2.5 MB). <button type="button" className="underline text-orbit" onClick={() => setWantShare(true)}>{wantShare ? 'Computing…' : 'Compute it'}</button></>}
            </p>
          </div>

          <div className="p-4 rounded-[8px] bg-surface-2 border border-line space-y-1.5">
            <span className="font-mono text-[11px] text-orange-400 font-semibold">Busiest fire months (Kiln Watch)</span>
            <ul className="text-muted leading-relaxed">
              {HILL.map((n, i) => { const b = busy(hills[i]); return <li key={n}>{n}: {b ? `${SEASON_MONTHS[b.first]} to ${SEASON_MONTHS[b.last]}, peak ${SEASON_MONTHS[b.peak]}` : 'loading…'}</li> })}
            </ul>
            <p className="text-muted"><Cited id="jhum-sowing" /></p>
          </div>

          <div className="p-4 rounded-[8px] bg-surface-2 border border-line space-y-1.5">
            <span className="font-mono text-[11px] text-orange-400 font-semibold">Fallow Cycle Compression</span>
            <p className="text-muted leading-relaxed"><Cited id="jhum-fallow" /> <Cited id="jhum-rotation" /></p>
          </div>
        </div>
      </div>

      {/* SECTION 3: Farm Worker Smoke Exposure & Protection Protocols */}
      <div className="rounded-[12px] border border-line bg-surface p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-500" />
            <h3 className="text-base font-bold text-ink uppercase tracking-wider font-mono">
              Farm Worker Health & Smoke Exposure Protocols
            </h3>
          </div>
          <span className="font-mono text-xs text-rose-400 border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 rounded">
            Occupational Health Hazard
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-muted leading-relaxed">
          <div className="space-y-2">
            <h4 className="font-semibold text-ink text-sm">Particulate & Toxic Gas Exposure</h4>
            <p><Cited id="smoke-pollutants" /></p>
            <p><Cited id="smoke-hazard" /> <Cited id="pm25-body" /></p>
            {pm && <p>Kiln Watch: partial correlation of Dhaka PM2.5 on the same day with {pmB}: <CIText ci={pm.r_veg} />; with {pmA}: <CIText ci={pm.r_kiln} /> (median, interval in brackets), from validation.json. A correlation only: weather drives both smoke and burning, and near zero means no clear link at this scale.</p>}
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-ink text-sm">Recommended Interventions</h4>
            <ul className="space-y-1.5 list-disc pl-4">
              <li><b>No-burn sowing:</b> <Cited id="happy-seeder" /></li>
              <li><b>Keep residue in the field:</b> <Cited id="in-situ" /></li>
              <li><b>Monitor from space:</b> <Cited id="satellite-monitoring" /></li>
            </ul>
          </div>
        </div>
      </div>

      {/* SECTION 4: The satellite record behind these numbers */}
      <div className="rounded-[12px] border border-line bg-surface p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <div>
            <h3 className="text-base font-bold text-ink font-mono uppercase tracking-wider">
              NASA Fire Record Since 2003 & Satellite Harmonization
            </h3>
            <p className="text-xs text-muted">Kiln Watch puts Aqua MODIS, Suomi NPP VIIRS and NOAA-20 VIIRS on one Aqua-equivalent scale, so a camera change does not read as a change in burning</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/ask"
              className="btn btn-sm bg-orbit text-black font-semibold font-mono text-xs hover:brightness-110 transition-all"
            >
              Ask AI Agent →
            </Link>
            <Link
              to="/region"
              className="btn btn-sm border border-line text-xs font-mono text-muted hover:text-ink"
            >
              World Map →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted">
          <ul className="space-y-1.5">
            {(events?.satellite ?? []).map((e) => (
              <li key={e.date + e.label_en}><b className="text-ink">{e.date}</b>: {e.label_en} <a className="text-orbit underline" href={e.url} target="_blank" rel="noreferrer">[source]</a></li>
            ))}
          </ul>
          <ul className="space-y-1.5">
            <li><Cited id="terra" /></li>
            <li><Cited id="aqua" /></li>
            <li>Kiln Watch&rsquo;s harmonized record uses Aqua as its anchor; Terra is not part of it. See <Link className="underline" to="/how">How it works</Link>.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
