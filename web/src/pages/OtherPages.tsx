import { ChartCard, fmt, Loading, ProvisionalBadge, StatusMessage, useKilnActivity, useMeta } from '../components/ui'
import { SeasonToDateChart } from '../components/charts'
import { useJson } from '../lib/data'
import { useLang } from '../lib/i18n'
import type { FC, NrtSeason } from '../lib/types'

export function ThisSeasonPage() {
  const nrt = useJson<NrtSeason>('nrt/current_season.json')
  const meta = useMeta()
  const dists = useJson<FC>('aoi/districts.geojson')
  const name = (id: string) => dists.data?.features.find((f) => f.properties.unit_id === id)?.properties.name_en ?? id
  return (
    <Loading state={nrt}>{(n) => (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">Season {n.season} so far</h1><ProvisionalBadge />
          <span className="text-sm text-stone-500">updated {n.updated_at.replace('T', ' ').slice(0, 16)} UTC · refreshed daily from FIRMS near-real-time</span></div>
        <StatusMessage>Provisional: cloud-free denominators use each area’s climatological median for the day of year until archive-quality data arrive.</StatusMessage>
        {meta.data && <ChartCard title="National daily activity, by source" summary="Harmonized MYD-eq cell-days per 1,000 clear cells; bars split by source label from the frozen classifier.">
          <SeasonToDateChart nrt={n} meta={meta.data} /></ChartCard>}
        <ChartCard title="Districts running above normal" summary="Days this season above the district’s 90th-percentile normal for that day of year.">
          <table className="w-full text-sm"><thead><tr className="text-left text-stone-500"><th>District</th><th>Days above p90</th><th>Season total</th></tr></thead>
            <tbody>{Object.entries(n.districts).sort((a, b) => b[1].above_p90_days - a[1].above_p90_days).slice(0, 20).map(([id, d]) => (
              <tr key={id} className="border-t border-stone-100"><td>{name(id)}</td><td>{d.above_p90_days}</td><td>{fmt(d.h.reduce((s, v) => s + v, 0), 1)}</td></tr>))}</tbody></table>
        </ChartCard>
      </div>)}
    </Loading>
  )
}

export function MethodPage() {
  const meta = useMeta()
  const ka = useKilnActivity()
  const lang = useLang()
  return (
    <Loading state={meta}>{(m) => (
      <div className="prose-sm max-w-3xl space-y-5">
        <h1 className="text-2xl font-bold">How Kiln Watch works</h1>
        <ol className="list-decimal space-y-2 pl-5">
          <li><b>Detections.</b> Every MODIS (Terra, Aqua) and VIIRS (S-NPP, NOAA-20, NOAA-21) active-fire detection over Bangladesh from NASA FIRMS, 2003 to today, nominal and high confidence.</li>
          <li><b>One grid.</b> Detections become “fire cell-days” on a 0.01° grid (≈1 km), so a 375 m sensor and a 1 km sensor count the same way.</li>
          <li><b>Honest denominators.</b> Google Earth Engine daily fire masks give the share of each area the satellite actually saw as clear land. Cloudy days are “not observed”, never zero.</li>
          <li><b>Harmonization.</b> On days both satellites saw the same area, we estimate how many Aqua-MODIS detections one VIIRS detection is worth — by division, month, day/night and kiln vs other land — pooling only when data are thin, and never across day and night. Uncertainty comes from resampling whole seasons; the method is validated by leaving each season out in turn.</li>
          {m.gate_branch === 'nokiln'
            ? <li><b>Kilns vs fires.</b> A pre-registered test asked whether 3,600+ mapped brick-kiln clusters produce more fire detections than matched farmland. They do not, so kiln heat is not inside the fire calendar, which is split instead by the Aman and Boro rice-harvest windows.</li>
            : <li><b>Source separation.</b> A classifier trained on detections at mapped kilns versus matched control sites, using heat and persistence but never location or date, labels each VIIRS detection kiln-like, vegetation-like or unknown.</li>}
          {ka.data?.layer && <li><b>Kiln season.</b> Kilns are tracked with a different satellite product: {ka.data.layer === 'ntl' ? 'NASA Black Marble night lights (VNP46A2), every half-month since 2012' : 'Sentinel-1 radar, monthly since 2015'}.
            Each kiln is compared with its three matched control sites and with its own monsoon level. The rules were written down before the confirmatory test, which ran on kiln clusters and a season the pilot never used (pre-registration amendment 1).</li>}
          <li><b>Pre-registration.</b> The kiln-detectability test and every threshold were committed before any data were analysed (prereg {m.prereg_sha}). This build’s branch: <code>{m.gate_branch}</code>. Later additions are dated amendments, never edits.</li>
        </ol>
        <section><h2 className="text-lg font-semibold">What we do not claim</h2>
          <ol className="list-decimal space-y-1 pl-5">{[...m.non_claims, ...(ka.data?.layer ? ka.data.non_claims ?? [] : [])].map((c, i) => <li key={i}>{lang === 'bn' ? c.bn : c.en}</li>)}</ol></section>
        <section><h2 className="text-lg font-semibold">Release policy</h2>
          <p>Public: area-level calendars and statistics only. Kiln locations, cluster identifiers and candidate unmapped kilns are never published; they exist only in an offline export for the Department of Environment. Two automated checks (field names and values) block any leak before publication.</p></section>
        <section><h2 className="text-lg font-semibold">Credits and licences</h2>
          <ul className="list-disc pl-5">{m.credits.map((c) => <li key={c.name}><a className="text-orange-700 underline" href={c.url}>{c.name}</a> — {c.licence}</li>)}</ul></section>
        <section><h2 className="text-lg font-semibold">Parameters</h2>
          <dl className="grid grid-cols-2 gap-x-4 text-sm">{Object.entries(m.params).flatMap(([k, v]) => [<dt key={k} className="font-mono text-stone-500">{k}</dt>, <dd key={k + "v"}>{String(v)}</dd>])}</dl></section>
      </div>)}
    </Loading>
  )
}
