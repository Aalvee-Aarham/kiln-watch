import { lazy, Suspense } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Icon, Loading, ProvisionalBadge, Section, Skeleton, SkeletonCard, Sparkline, fmt, useKilnActivity, useMeta } from '../components/ui'
import { useJson } from '../lib/data'
import { useLang, useT } from '../lib/i18n'
import type { FC, NrtSeason } from '../lib/types'

const SeasonToDateChart = lazy(() => import('../components/charts').then((m) => ({ default: m.SeasonToDateChart })))

export function ThisSeasonPage() {
  const nrt = useJson<NrtSeason>('nrt/current_season.json')
  const meta = useMeta()
  const lang = useLang()
  const t = useT()
  const [sp] = useSearchParams()
  const q = sp.toString() ? `?${sp}` : ''
  const dists = useJson<FC>('aoi/districts.geojson')
  const name = (id: string) => dists.data?.features.find((f) => f.properties.unit_id === id)?.properties
  return (
    <Loading state={nrt} skeleton={<div className="space-y-8"><SkeletonCard label="Loading current season" /><SkeletonCard label="Loading district table" shape="table" /></div>}>{(n) => {
      const rows = Object.entries(n.districts).sort((a, b) => b[1].above_p90_days - a[1].above_p90_days).slice(0, 20)
      const maxDays = Math.max(1, ...rows.map(([, d]) => d.above_p90_days))
      const above = rows.filter(([, d]) => d.above_p90_days > 0).length
      const updated = new Date(n.updated_at)
      return (
        <div className="space-y-12">
          <header>
            <h1 className="h-display text-[clamp(2.5rem,6vw,4rem)]">Season {n.season} so far</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <ProvisionalBadge />
              <span>Updated {updated.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC, refreshed daily from FIRMS near-real-time data.</span>
              <details className="w-full sm:w-auto"><summary className="text-ink underline decoration-dotted underline-offset-4">Why provisional?</summary>
                <p className="mt-1 prose-measure">Until archive-quality data arrive, the cloud-free share of each area uses its typical (median) value for that day of the year, and the source labels come from the frozen classifier.</p></details>
            </div>
            <p className="mt-5 prose-measure text-lg">{above > 0
              ? <><b>{above}</b> of the {rows.length} most active districts have had days above their 90th-percentile normal this season. They are ranked below.</>
              : <>No district has gone above its 90th-percentile normal yet this season.</>}</p>
          </header>
          {meta.data && <Section title="National activity by week, by source" download={{ name: 'kilnwatch_nrt', png: true, json: n.national }}
            summary="Harmonized MYD-eq cell-days per 1,000 clear cells, summed by week. Each bar is the total; its segments are the source split.">
            <Suspense fallback={<Skeleton className="h-[300px] w-full" />}><SeasonToDateChart nrt={n} meta={meta.data} lang={lang} /></Suspense></Section>}
          <Section title="Districts running above normal" plate={false}
            summary="Days this season above the district’s 90th-percentile normal for that day of the year. The sparkline shows the last 90 days of harmonized activity. Open a row for the district’s full calendar.">
            <ol className="divide-y divide-line">
              {rows.map(([id, d], i) => {
                const u = name(id)
                return (
                  <li key={id}>
                    <Link to={`/explore/district/${id}${q ? q + '&' : '?'}season=${n.season}`}
                      className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-[4px] px-1 py-2.5 hover:bg-surface-2 sm:grid-cols-[2rem_minmax(0,1.3fr)_minmax(0,1fr)_96px_7rem_1rem]">
                      <span className="num text-sm text-muted">{i + 1}</span>
                      <span className="min-w-0 truncate font-medium">{u?.name_en ?? id} <span className="font-normal text-muted" lang="bn">{u?.name_bn}</span></span>
                      <span className="col-start-2 flex items-center gap-2 sm:col-start-auto">
                        <span className="h-1.5 flex-1 rounded-full bg-surface-2"><span className="block h-1.5 rounded-full bg-heat" style={{ width: `${(d.above_p90_days / maxDays) * 100}%` }} /></span>
                        <span className="num w-14 text-right text-sm">{d.above_p90_days} d</span>
                      </span>
                      <span className="row-span-2 sm:row-span-1"><Sparkline values={d.h.slice(-90)} /></span>
                      <span className="num hidden text-right text-sm text-muted sm:block">{fmt(d.h.reduce((s, v) => s + v, 0), 1)} total</span>
                      <span className="hidden text-muted sm:block"><Icon name="chevron" /></span>
                    </Link>
                  </li>)
              })}
            </ol>
          </Section>
          <p className="text-sm text-muted">{t('provisional')}: these figures will change when archive-quality data replace near-real-time data.</p>
        </div>)
    }}
    </Loading>
  )
}

const PIPELINE: [string, string][] = [
  ['FIRMS detections', 'MODIS + VIIRS, 2003–today'],
  ['0.01° grid', 'fire cell-days'],
  ['Clear-land fraction', 'Earth Engine fire masks'],
  ['Calibration chain', 'Aqua ← S-NPP ← NOAA-20 ← NOAA-21'],
  ['Source split', 'classifier or harvest windows'],
  ['Calendars', '560 areas, normals, flags'],
]

export function MethodPage() {
  const meta = useMeta()
  const ka = useKilnActivity()
  const lang = useLang()
  const t = useT()
  return (
    <Loading state={meta} skeleton={<SkeletonCard label="Loading method" shape="table" />}>{(m) => (
      <article className="max-w-[72ch] space-y-10">
        {lang === 'bn' && <p className="text-sm text-muted" lang="bn">{t('englishOnly')}</p>}
        <header>
          <h1 className="h-display text-[clamp(2.5rem,6vw,4rem)]">How Kiln Watch works</h1>
          <p className="mt-3 text-lg text-muted">Six steps, from a satellite pixel to a district’s burning calendar. Each runs as one stage of the pipeline.</p>
        </header>
        <figure className="m-0 overflow-x-auto" aria-label="Pipeline: six stages from detections to calendars">
          <ol className="flex min-w-[640px] items-stretch gap-0 text-sm">
            {PIPELINE.map(([a, b], i) => (
              <li key={a} className="flex flex-1 items-center">
                <div className="flex-1 rounded-[4px] border border-line bg-surface px-2.5 py-2">
                  <div className="num text-xs text-muted">{String(i + 1).padStart(2, '0')}</div>
                  <div className="font-semibold leading-tight">{a}</div>
                  <div className="text-xs text-muted">{b}</div>
                </div>
                {i < PIPELINE.length - 1 && <Icon name="chevron" className="h-4 w-4 text-muted" />}
              </li>
            ))}
          </ol>
        </figure>
        <ol className="space-y-4">
          {[
            ['Detections', <>Every MODIS (Terra, Aqua) and VIIRS (S-NPP, NOAA-20, NOAA-21) active-fire detection over Bangladesh from NASA FIRMS, 2003 to today, nominal and high confidence.</>],
            ['One grid', <>Detections become “fire cell-days” on a 0.01° grid (about 1 km), so a 375 m sensor and a 1 km sensor count the same way.</>],
            ['Honest denominators', <>Google Earth Engine daily fire masks give the share of each area the satellite actually saw as clear land. Cloudy days are “not observed”, never zero.</>],
            ['Harmonization', <>On days both satellites saw the same area, we estimate how many Aqua-MODIS detections one VIIRS detection is worth, by division, month, day/night and kiln vs other land, pooling only when data are thin and never across day and night. Uncertainty comes from resampling whole seasons; the method is validated by leaving each season out in turn.</>],
            m.gate_branch === 'nokiln'
              ? ['Kilns vs fires', <>A pre-registered test asked whether 3,600+ mapped brick-kiln clusters produce more fire detections than matched farmland. They do not, so kiln heat is not inside the fire calendar, which is split instead by the Aman and Boro rice-harvest windows.</>]
              : ['Source separation', <>A classifier trained on detections at mapped kilns versus matched control sites, using heat and persistence but never location or date, labels each VIIRS detection kiln-like, vegetation-like or unknown.</>],
            ...(ka.data?.layer ? [['Kiln season', <>Kilns are tracked with a different satellite product: {ka.data.layer === 'ntl' ? 'NASA Black Marble night lights (VNP46A2), every half-month since 2012' : 'Sentinel-1 radar, monthly since 2015'}.
              Each kiln is compared with its three matched control sites and with its own monsoon level. The rules were written down before the confirmatory test, which ran on kiln clusters and a season the pilot never used (pre-registration amendment 1).</>] as const] : []),
            ['Pre-registration', <>The kiln-detectability test and every threshold were committed before any data were analysed (prereg <span className="code">{m.prereg_sha}</span>). This build’s branch: <span className="code">{m.gate_branch}</span>. Later additions are dated amendments, never edits.</>],
          ].map(([b, d], i) => (
            <li key={i} className="grid grid-cols-[2.25rem_1fr] gap-x-3">
              <span className="num pt-0.5 text-right text-muted" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
              <p><b className="font-semibold">{b}.</b> {d}</p>
            </li>
          ))}
        </ol>
        <section><h2 className="h-section mb-3">What we do not claim</h2>
          <ol className="list-decimal space-y-1.5 pl-5 marker:text-muted">{[...m.non_claims, ...(ka.data?.layer ? ka.data.non_claims ?? [] : [])].map((c, i) => <li key={i} lang={lang}>{lang === 'bn' ? c.bn : c.en}</li>)}</ol></section>
        <section><h2 className="h-section mb-3">Release policy</h2>
          <p>Public: area-level calendars and statistics only. Kiln locations, cluster identifiers and candidate unmapped kilns are never published; they exist only in an offline export for the Department of Environment. Two automated checks (field names and values) block any leak before publication.</p></section>
        <section><h2 className="h-section mb-3">Credits and licences</h2>
          <ul className="space-y-1">{m.credits.map((c) => <li key={c.name}><a className="text-orbit underline" href={c.url}>{c.name}</a> <span className="text-muted">({c.licence})</span></li>)}</ul></section>
        <section><h2 className="h-section mb-3">Parameters</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">{Object.entries(m.params).flatMap(([k, v]) => [<dt key={k} className="code text-muted">{k}</dt>, <dd key={k + 'v'} className="num">{String(v)}</dd>])}</dl></section>
      </article>)}
    </Loading>
  )
}
