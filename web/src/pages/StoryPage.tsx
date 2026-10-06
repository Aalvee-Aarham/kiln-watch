import { lazy, Suspense } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CountUp, Icon, Loading, Section, Skeleton, VerdictStrip, fmt, useKilnActivity, useMeta, useTitle } from '../components/ui'
import Ledger from '../components/Ledger'
import { useJson } from '../lib/data'
import { useLang, useT } from '../lib/i18n'
import { seasonDayLabel } from '../lib/days'
import type { Calendar, Events, FC, Harmonization, KilnActivity, NrtSeason, Validation } from '../lib/types'
import moneyJump from '../assets/money_jump.png'
import moneyPlateau from '../assets/money_plateau.png'

// ECharts loads after first paint; the Ledger above the fold is plain canvas.
const JumpChart = lazy(() => import('../components/charts').then((m) => ({ default: m.JumpChart })))
const PlateauSpikeChart = lazy(() => import('../components/charts').then((m) => ({ default: m.PlateauSpikeChart })))
const KilnSeasonShapeChart = lazy(() => import('../components/charts').then((m) => ({ default: m.KilnSeasonShapeChart })))
const chartFallback = <Skeleton className="h-[330px] w-full" />

export default function StoryPage() {
  useTitle()
  const t = useT()
  const lang = useLang()
  const meta = useMeta()
  const harm = useJson<Harmonization>('harmonization.json')
  const val = useJson<Validation>('validation.json')
  const nrt = useJson<NrtSeason>('nrt/current_season.json')
  const dists = useJson<FC>('aoi/districts.geojson')
  const events = useJson<Events>('events.json')
  const ka = useKilnActivity()
  const [sp] = useSearchParams()
  const q = sp.toString() ? `?${sp}` : ''
  const nokiln = meta.data?.gate_branch === 'nokiln'
  // The Ledger shows the most active district this season (no national calendar is exported) — labelled as such.
  const top = Object.entries(nrt.data?.districts ?? {}).sort((a, b) => b[1].h.reduce((s, v) => s + v, 0) - a[1].h.reduce((s, v) => s + v, 0))[0]?.[0]
  const cal = useJson<Calendar>(top ? `calendar/${top}.json` : null)
  const name = (id?: string) => dists.data?.features.find((f) => f.properties.unit_id === id)?.properties.name_en ?? id
  const hot = Object.entries(nrt.data?.districts ?? {}).filter(([, d]) => d.above_p90_days > 0).sort((a, b) => b[1].above_p90_days - a[1].above_p90_days).slice(0, 5)

  return (
    <div className="space-y-20">
      {lang === 'bn' && <p className="text-sm text-muted" lang="bn">{t('englishOnly')}</p>}
      <header className="space-y-6">
        <div className="hero-ground space-y-6">
          <h1 className="h-display max-w-[19ch] text-[clamp(2.75rem,8vw,5.25rem)]">Twenty-three years of fire, on one honest scale.</h1>
          <p className="prose-measure text-lg text-muted">When NASA’s sharper VIIRS sensor arrived in 2012, recorded fire over Bangladesh appeared to jump overnight. It didn’t. Kiln Watch puts every satellite on one scale, so a district’s burning calendar can be read across two decades.</p>
        </div>
        <Loading state={cal} skeleton={<Skeleton className="h-[290px] w-full" />}>{(c) => <Ledger cal={c} events={events.data} caption={`${name(top)} district, the most active this season`} />}</Loading>
        <div className="flex flex-wrap gap-2">
          <Link to={'/explore' + q} className="btn btn-primary min-h-11 px-5 text-base">{t('openDistrict')}</Link>
          <Link to={'/season' + q} className="btn min-h-11 px-5 text-base">{t('seeSeason')}</Link>
        </div>
      </header>

      <Loading state={harm}>{(h) => (
        <Section title="Spliced naïvely, the record lies"
          actions={<a className="btn" href={moneyJump} download="kilnwatch_money_jump.png"><Icon name="download" />Figure</a>}
          download={{ name: 'kilnwatch_jump', png: true }}
          summary={<>The dashed line splices sensors as they come: when VIIRS arrives, season totals jump by <span className="num">{fmt(h.seam.d_raw, 1)}</span> units. Harmonized (solid), the jump is <span className="num">{fmt(h.seam.d_harm, 1)}</span>. The Aqua line, the same instrument throughout, lands inside the band: fires did not multiply; the new sensor sees smaller ones.</>}>
          <Suspense fallback={chartFallback}><JumpChart h={h} /></Suspense>
        </Section>)}
      </Loading>

      <Loading state={harm}>{(h) => (
        <section className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            <h2 className="h-display text-[clamp(2rem,4vw,2.75rem)]">One honest scale</h2>
            <p className="mt-4 prose-measure">On days when Aqua-MODIS and VIIRS saw the same clear ground, we learn how many MODIS detections one VIIRS detection is worth, by division, month, day or night. Uncertainty comes from resampling whole seasons, and the method is tested by leaving each season out in turn.</p>
            <p className="mt-3 prose-measure text-muted">Both tests were written down before any data were analysed. One passed; one missed, on the cautious side.</p>
          </div>
          <div className="panel divide-y divide-line py-1">
            <VerdictStrip label="Harmonized 2012 jump, as a share of the raw jump (pass ≤ 25%)" value={h.seam.ratio} pass={[0, 0.25]} domain={[0, 1]}
              verdict={h.seam.ratio <= 0.25 && h.seam.chow_p_raw < 0.01 && h.seam.chow_p_harm > 0.05} format={(v) => `${(v * 100).toFixed(1)}%`}
              note={<>Break test: p = {h.seam.chow_p_raw.toExponential(1)} raw, {fmt(h.seam.chow_p_harm, 2)} harmonized.</>} />
            <VerdictStrip label="Held-out seasons inside our 95% intervals (pass 90–97%)" value={h.loso_pooled.covered.p50} ci={[h.loso_pooled.covered.lo, h.loso_pooled.covered.hi]}
              pass={[0.9, 0.97]} domain={[0.8, 1]} verdict={h.loso_pooled.covered.p50 >= 0.9 && h.loso_pooled.covered.p50 <= 0.97} format={(v) => `${(v * 100).toFixed(1)}%`}
              note={h.loso_pooled.covered.p50 > 0.97 ? 'Above the target: the bands are too wide, not too narrow. We report it as a miss.' : undefined} />
          </div>
        </section>)}
      </Loading>

      <Loading state={val}>{(v) => nokiln
        ? (ka.data?.layer && ka.data.national?.e ? <KilnTwist v={v} ka={ka.data} q={q} /> : <NegativeResult v={v} />)
        : (
          <Section title="Kilns burn for months; crop fires burn for days"
            summary="Weekly share of cloud-free days with a fire detection at brick-kiln clusters (brick) versus matched control sites with the same land cover (indigo), through the pre-registered gate season. A steady plateau at kilns, short spikes at controls: the signature the classifier learns.">
            <Suspense fallback={chartFallback}><PlateauSpikeChart v={v} /></Suspense>
          </Section>)}
      </Loading>

      <section className="grid gap-8 border-t border-line pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <h2 className="h-display text-[clamp(2rem,4vw,2.75rem)]">Your district</h2>
          <p className="mt-3 prose-measure text-muted">A calendar for each of Bangladesh’s 64 districts and 500+ upazilas: the normal range, unusual days, critical periods and this season so far. Draw any area on the map. Download everything.</p>
          <Link to={'/explore' + q} className="btn btn-primary mt-5 min-h-11 px-5 text-base">{t('openDistrict')}</Link>
        </div>
        {hot.length > 0 && (
          <div className="panel">
            <h3 className="h-section mb-1">{t('aboveNow')}</h3>
            <p className="mb-2 text-sm text-muted">Days this season above the district’s 90th-percentile normal.</p>
            <ol className="divide-y divide-line">
              {hot.map(([id, d]) => (
                <li key={id}><Link to={`/explore/district/${id}${q}`} className="grid grid-cols-[minmax(0,8rem)_1fr_3rem_1rem] items-center gap-3 rounded-[4px] px-1 py-2.5 hover:bg-surface-2">
                  <span className="truncate font-medium">{name(id)}</span>
                  <span className="h-1.5 rounded-full bg-surface-2"><span className="block h-1.5 rounded-full bg-heat" style={{ width: `${(d.above_p90_days / hot[0][1].above_p90_days) * 100}%` }} /></span>
                  <span className="num text-right text-sm">{d.above_p90_days} d</span>
                  <Icon name="chevron" className="text-muted" />
                </Link></li>))}
            </ol>
          </div>)}
      </section>
    </div>
  )
}

function NegativeResult({ v }: { v: Validation }) {
  const c = v.gates.find((g) => g.gate === 'G1' && g.criterion.startsWith('Contrast'))
  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div>
        <h2 className="h-display text-[clamp(2rem,4vw,2.75rem)]">What satellites can’t see</h2>
        <p className="mt-4 prose-measure">We wanted to separate kiln heat from crop fires, so before touching the data we pre-registered a test: are mapped brick-kiln clusters hotter, in the satellites’ eyes, than matched control sites? They are not. Bangladesh’s brick kilns are essentially invisible to NASA’s fire products.</p>
        <p className="mt-3 prose-measure text-muted">We publish that instead of a map built on a false assumption. The harmonized calendar does not depend on it and ships in full; burning is split by the Aman and Boro rice-harvest windows instead.</p>
        <a className="btn mt-4" href={moneyPlateau} download="kilnwatch_money_plateau.png"><Icon name="download" />Figure</a>
      </div>
      <div className="panel divide-y divide-line py-1">
        {c && <VerdictStrip label="Fire-detection rate at kiln clusters vs matched controls (pass ≥ 3×)" value={c.value} pass={[3, 10]} domain={[0.1, 10]} log
          verdict={c.pass ?? c.value >= 3} format={(x) => `${x.toFixed(2)}×`} note="Across 3,600+ mapped kiln clusters, each with three land-cover-matched controls." />}
        {c?.p != null && <VerdictStrip label="Permutation test, 10,000 shuffles within districts (pass p < 0.01)" value={c.p} pass={[0, 0.01]} domain={[0, 1]}
          verdict={c.p < 0.01} format={(x) => `p ${x.toFixed(2)}`} />}
        <div className="flex items-baseline gap-4 py-4">
          <span className="h-display text-5xl"><CountUp target={0} format={(x) => x.toFixed(0)} /></span>
          <span className="text-sm text-muted">kiln clusters bright enough for a site-level calendar, at VIIRS 375 m or MODIS 1 km.</span>
        </div>
      </div>
    </section>
  )
}

/** The twist: the pre-registered fire test fails, and a different NASA product sees the kiln season. */
function KilnTwist({ v, ka, q }: { v: Validation; ka: KilnActivity; q: string }) {
  const c = v.gates.find((g) => g.gate === 'G1' && g.criterion.startsWith('Contrast'))
  const prev = ka.tests.find((r) => r.test === (ka.layer === 'ntl' ? 'GL' : 'GS') && r.criterion.startsWith('Prevalence'))
  const prevMin = prev ? Number(prev.threshold.match(/[\d.]+/)?.[0] ?? NaN) : NaN
  const seasons = (ka.national?.seasons ?? []).filter((s) => s.onset && s.end)
  const med = (xs: number[]) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]
  const on = seasons.length ? med(seasons.map((s) => s.onset!.p50)) : null
  const end = seasons.length ? med(seasons.map((s) => s.end!.p50)) : null
  const src = ka.layer === 'ntl' ? 'NASA Black Marble night lights' : 'Sentinel-1 radar'
  return (
    <section className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <h2 className="h-display text-[clamp(2rem,4vw,2.75rem)]">Fire satellites can’t see the kilns. Night lights can.</h2>
          <p className="mt-4 prose-measure">We wrote the fire test down before looking at the data, and it failed: kiln sites have no more fire detections than matched farmland.
            {ka.contamination && <> Of {ka.contamination.detections.toLocaleString('en-US')} dry-season fire detections, {(ka.contamination.kiln_share * 100).toFixed(2)}% fall on kiln sites, against {(ka.contamination.control_share * 100).toFixed(2)}% on matched farmland.</>} So kiln heat is not hiding in the fire calendar.</p>
          <p className="mt-3 prose-measure text-muted">Kilns do run day and night from late autumn to spring with workers on site, and {src} picks that up. The test was confirmed on kiln clusters and a season the pilot never touched (pre-registration amendment 1).</p>
          <Link to={'/kilns' + q} className="btn mt-4">Kiln seasons by district</Link>
        </div>
        <div className="panel divide-y divide-line py-1">
          {c && <VerdictStrip label="Fire-detection rate at kiln clusters vs matched farmland (pass ≥ 3×)" value={c.value} pass={[3, 10]} domain={[0.1, 10]} log
            verdict={c.pass ?? c.value >= 3} format={(x) => `${x.toFixed(2)}×`} note="Kilns are invisible to fire satellites." />}
          {prev?.value != null && Number.isFinite(prevMin) && <VerdictStrip label={`Held-out kiln clusters brighter than their controls in the working season (${src}, pass ≥ ${Math.round(prevMin * 100)}%)`}
            value={prev.value} pass={[prevMin, 1]} domain={[0, 1]} verdict={prev.pass} format={(x) => `${Math.round(x * 100)}%`} />}
          {on != null && end != null && <div className="flex items-baseline gap-4 py-4">
            <span className="h-display text-4xl whitespace-nowrap">{seasonDayLabel(on)} → {seasonDayLabel(end)}</span>
            <span className="text-sm text-muted">the typical kiln season (median onset and end, 50% of peak). It is a different calendar from the crop fires.</span>
          </div>}
        </div>
      </div>
      <Section title="The kiln season, nationally" download={{ name: 'kilnwatch_kiln_shape', png: true }}
        summary="Brick line: the extra night light at mapped kilns over matched control sites in a typical season; band: the middle half of seasons; dashed: the latest season.">
        <Suspense fallback={chartFallback}><KilnSeasonShapeChart ka={ka} area={ka.national!} season={seasons.at(-1)?.season} /></Suspense>
      </Section>
    </section>
  )
}
