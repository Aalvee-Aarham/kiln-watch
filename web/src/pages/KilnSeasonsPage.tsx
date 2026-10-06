import { useState } from 'react'
import { CIText, Loading, Section, SkeletonCard, useKilnActivity, useTitle } from '../components/ui'
import { KilnCalendarHeatmap, KilnSeasonShapeChart, KilnTimingChart, RadarCheckChart, SeasonDurationChart } from '../components/charts'
import { useJson } from '../lib/data'
import { seasonDayLabel } from '../lib/days'
import type { Calendar, CI, Events, FC, KilnActivity, KilnArea } from '../lib/types'

export default function KilnSeasonsPage() {
  useTitle('Kiln seasons')
  const ka = useKilnActivity()
  if (ka.loading) return <SkeletonCard label="Loading kiln seasons" />
  return ka.data?.layer ? <ActivityView ka={ka.data} /> : <FirmsView />
}

const ciDate = (c: CI | null, s: string) => (c ? <span className="num">{seasonDayLabel(c.p50, s)} <span className="text-muted">[{seasonDayLabel(c.lo, s)}–{seasonDayLabel(c.hi, s)}]</span></span> : '–')

function ActivityView({ ka }: { ka: KilnActivity }) {
  const ups = useJson<FC>('aoi/upazilas.geojson')
  const dists = useJson<FC>('aoi/districts.geojson')
  const events = useJson<Events>('events.json')
  const name = new Map([...(dists.data?.features ?? []), ...(ups.data?.features ?? [])].map((f) => [f.properties.unit_id, f.properties]))
  const areas = Object.entries(ka.areas ?? {}).map(([id, a]) => ({ id, a, p: name.get(id) })).sort((x, y) => y.a.n_clusters - x.a.n_clusters)
  const [id, setId] = useState('national')
  const area: KilnArea | undefined = id === 'national' ? ka.national : ka.areas?.[id]
  const label = id === 'national' ? 'Bangladesh' : name.get(id)?.name_en ?? id
  const seasons = area?.seasons ?? []
  const latest = seasons.filter((s) => s.onset && s.end).at(-1)?.season
  const [season, setSeason] = useState<string>()
  const src = ka.layer === 'ntl' ? 'NASA Black Marble night lights (VIIRS Day/Night Band)' : 'Sentinel-1 radar'
  const csv = () => ['season,onset,onset_lo,onset_hi,end,end_lo,end_hi,duration_days,duration_lo,duration_hi',
    ...seasons.map((s) => [s.season, ...[s.onset, s.end].flatMap((c) => (c ? [c.p50, c.lo, c.hi].map((d) => seasonDayLabel(d, s.season)) : ['', '', ''])), ...(s.duration ? [s.duration.p50, s.duration.lo, s.duration.hi] : ['', '', ''])].join(','))].join('\n')
  return (
    <div className="space-y-12">
      <header>
        <h1 className="h-display text-[clamp(2.5rem,6vw,4rem)]">When do the brick kilns work?</h1>
        <p className="mt-3 prose-measure text-lg text-muted">Fire satellites cannot see Bangladesh’s kilns: that was our pre-registered test, and it failed. But kilns run day and night through the
          dry season with workers living on site, and that shows up in {src}. Each curve is the extra light at mapped kilns compared with matched sites
          with the same land cover nearby, measured against the monsoon, when kilns stand idle. Areas are pooled over at least five kiln clusters, never shown per kiln.</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <select aria-label="Area" className="btn" value={id} onChange={(e) => { setId(e.target.value); setSeason(undefined) }}>
            <option value="national">Bangladesh ({ka.national?.n_clusters ?? 0} kiln clusters)</option>
            <optgroup label="Districts">{areas.filter((x) => x.p?.level === 'district').map((x) => <option key={x.id} value={x.id}>{x.p?.name_en} ({x.a.n_clusters})</option>)}</optgroup>
            <optgroup label="Upazilas (season dates only)">{areas.filter((x) => x.p?.level === 'upazila').map((x) => <option key={x.id} value={x.id}>{x.p?.name_en} ({x.a.n_clusters})</option>)}</optgroup>
          </select>
        </div>
      </header>
      {area?.e && <>
        <Section title={`${label}: the kiln season`} download={{ name: `kilnwatch_kiln_shape_${id}`, json: area, png: true }}
          actions={<select aria-label="Season to compare" className="btn" value={season ?? latest} onChange={(e) => setSeason(e.target.value)}>
            {seasons.map((s) => <option key={s.season}>{s.season}</option>)}</select>}
          summary={<>Brick line: kiln excess in a typical season (median of all seasons; band = middle half). Dashed: {season ?? latest}. Kilns light up from late autumn and go dark before the monsoon.</>}>
          <KilnSeasonShapeChart ka={ka} area={area} season={season ?? latest} />
        </Section>
        <Section title="Kiln calendar" download={{ name: `kilnwatch_kiln_calendar_${id}`, png: true }}
          summary="One row per season, one cell per half-month. Darker means kilns busier than in that season’s monsoon. Compare it with the fire calendar on the Explore page: the two seasons are not the same.">
          <KilnCalendarHeatmap ka={ka} area={area} />
        </Section>
      </>}
      {area && <Section title="Season start and end" download={{ name: `kilnwatch_kiln_seasons_${id}`, csv, png: true }}
        summary="Onset and end: when the smoothed kiln excess first rises above, and last falls below, half of that season’s peak. The shaded band is the working season. Dotted lines mark policy events and the 2020 COVID-19 shutdown; before-and-after comparisons are descriptive, not causal.">
        <KilnTimingChart rows={seasons} events={events.data} />
        <div className="mt-4 overflow-x-auto border-t border-line pt-3"><table className="w-full text-sm">
          <thead><tr><th>Season</th><th>Onset [95% CI]</th><th>End [95% CI]</th><th className="n">Length (days)</th></tr></thead>
          <tbody>{seasons.slice().reverse().map((s) => <tr key={s.season} className="border-t border-line"><td className="num">{s.season}</td><td>{ciDate(s.onset, s.season)}</td><td>{ciDate(s.end, s.season)}</td>
            <td className="n">{s.duration ? <CIText ci={s.duration} d={0} /> : '–'}</td></tr>)}</tbody></table></div>
      </Section>}
      {id === 'national' && ka.national_check && ka.national?.e && (
        <Section title="Independent check: Sentinel-1 radar sees the brick stacks" download={{ name: 'kilnwatch_radar_check', png: true }}
          summary="Radar backscatter from the kiln yard relative to its surroundings, against the same matched controls. Stacks of drying bricks build up during the season and are cleared before the monsoon, so the two signals should rise and fall together.">
          <RadarCheckChart ka={ka} />
        </Section>)}
    </div>
  )
}

function FirmsView() {
  const ups = useJson<FC>('aoi/upazilas.geojson')
  const dists = useJson<FC>('aoi/districts.geojson')
  const events = useJson<Events>('events.json')
  const all = [...(dists.data?.features ?? []), ...(ups.data?.features ?? [])].map((f) => f.properties).filter((p) => (p.kiln_count ?? 0) > 0)
    .sort((a, b) => (b.kiln_count ?? 0) - (a.kiln_count ?? 0))
  const [id, setId] = useState<string>()
  const pick = id ?? all[0]?.unit_id
  const cal = useJson<Calendar>(pick ? `calendar/${pick}.json` : null)
  return (
    <div className="space-y-8">
      <h1 className="h-display text-[clamp(2.5rem,6vw,4rem)]">How long do kilns fire each season?</h1>
      <p className="prose-measure text-lg text-muted">Pooled over every mapped kiln in an area — never per kiln (site-level data is restricted to regulators). Vertical lines mark policy events; before-and-after comparisons are descriptive, not causal.</p>
      <select aria-label="Area" className="btn" value={pick} onChange={(e) => setId(e.target.value)}>
        {all.map((p) => <option key={p.unit_id} value={p.unit_id}>{p.name_en} ({p.level}, {p.kiln_count} kilns)</option>)}
      </select>
      <Loading state={cal} skeleton={<SkeletonCard label="Loading firing seasons" />}>{(c) => (
        <Section title="Firing-season length" download={{ name: `kilnwatch_duration_${pick}`, png: true }} summary="Days between the 10th and 90th percentile of the season’s cumulative harmonized activity, with a week-block bootstrap 95% interval.">
          <SeasonDurationChart cal={c} events={events.data} />
        </Section>)}</Loading>
    </div>
  )
}
