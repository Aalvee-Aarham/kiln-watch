import { useState } from 'react'
import { ChartCard, Loading } from '../components/ui'
import { SeasonDurationChart } from '../components/charts'
import { useJson } from '../lib/data'
import type { Calendar, Events, FC } from '../lib/types'

export default function KilnSeasonsPage() {
  const ups = useJson<FC>('aoi/upazilas.geojson')
  const dists = useJson<FC>('aoi/districts.geojson')
  const events = useJson<Events>('events.json')
  const all = [...(dists.data?.features ?? []), ...(ups.data?.features ?? [])].map((f) => f.properties).filter((p) => (p.kiln_count ?? 0) > 0)
    .sort((a, b) => (b.kiln_count ?? 0) - (a.kiln_count ?? 0))
  const [id, setId] = useState<string>()
  const pick = id ?? all[0]?.unit_id
  const cal = useJson<Calendar>(pick ? `calendar/${pick}.json` : null)
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">How long do kilns fire each season?</h1>
      <p className="max-w-3xl text-stone-700">Pooled over every mapped kiln in an area — never per kiln (site-level data is restricted to regulators). Vertical lines mark policy events; before-and-after comparisons are descriptive, not causal.</p>
      <select aria-label="Area" className="btn" value={pick} onChange={(e) => setId(e.target.value)}>
        {all.map((p) => <option key={p.unit_id} value={p.unit_id}>{p.name_en} ({p.level}, {p.kiln_count} kilns)</option>)}
      </select>
      <Loading state={cal}>{(c) => (
        <ChartCard title="Firing-season length" summary="Days between the 10th and 90th percentile of the season’s cumulative harmonized activity, with a week-block bootstrap 95% interval.">
          <SeasonDurationChart cal={c} events={events.data} />
        </ChartCard>)}</Loading>
    </div>
  )
}
