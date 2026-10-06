import { Link, useSearchParams } from 'react-router'
import { ChartCard, Loading, useKilnActivity, useMeta } from '../components/ui'
import { JumpChart, KilnSeasonShapeChart, PlateauSpikeChart } from '../components/charts'
import { useJson } from '../lib/data'
import { seasonDayLabel } from '../lib/days'
import type { Harmonization, KilnActivity, Validation } from '../lib/types'
import moneyJump from '../assets/money_jump.png'
import moneyPlateau from '../assets/money_plateau.png'

export default function StoryPage() {
  const meta = useMeta()
  const harm = useJson<Harmonization>('harmonization.json')
  const val = useJson<Validation>('validation.json')
  const ka = useKilnActivity()
  const [sp] = useSearchParams()
  const q = sp.toString() ? `?${sp}` : ''
  const nokiln = meta.data?.gate_branch === 'nokiln'
  const separate = !nokiln ? 'Each detection is labelled kiln-like, vegetation-like or unknown, using heat signature and persistence, tested on held-out places, years and satellites.'
    : ka.data?.layer ? 'Brick kilns turned out to be invisible to fire satellites, so the fire calendar is crop and forest burning. We track the kiln season separately, with NASA night lights.'
      : 'Brick kilns turned out to be invisible to fire satellites (a pre-registered test), so the fire calendar is crop and forest burning, split by rice-harvest windows.'
  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-br from-orange-700 to-amber-600 p-6 text-white shadow">
        <p className="text-sm uppercase tracking-wide opacity-80">Bangladesh · 2003 → today · MODIS + VIIRS</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Two decades of fire, on one honest scale.</h1>
        <Loading state={harm}>{(h) => <Headline h={h} />}</Loading>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to={'/explore' + q} className="rounded-md bg-white px-4 py-2 font-semibold text-orange-800 shadow hover:bg-orange-50">Explore your district →</Link>
          <Link to={'/season' + q} className="rounded-md border border-white/60 px-4 py-2 font-semibold hover:bg-white/10">What’s burning this season</Link>
        </div>
      </section>

      <ol className="grid gap-3 sm:grid-cols-3">
        {[['1', 'Harmonize', 'MODIS (1 km, 2003–) and VIIRS (375 m, 2012–) see fire differently. We convert every sensor to one unit — Aqua-MODIS-equivalent — with uncertainty.'],
          ['2', 'Separate', separate],
          ['3', 'Show', 'For any district, upazila or drawn box: history, the normal range, unusual days, critical periods and the current season.']].map(([n, t, d]) => (
          <li key={n} className="card"><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-600 text-sm font-bold text-white">{n}</span>
            <b>{t}</b><p className="note">{d}</p></li>
        ))}
      </ol>

      <Loading state={harm}>{(h) => (
        <ChartCard title="The 2012 “jump” is a sensor artefact" actions={<a className="btn" href={moneyJump} download>⬇ Figure</a>}
          summary={<>The grey dashed line splices the raw records: when VIIRS arrives in 2012 detections appear to quadruple. Fires did not quadruple — the new sensor sees smaller fires.
            After harmonization (orange, with 95% interval) the jump shrinks to {(h.seam.ratio * 100).toFixed(0)}% of its raw size, and the blue Aqua line (the same instrument throughout) confirms the level.</>}>
          <JumpChart h={h} />
        </ChartCard>)}
      </Loading>

      <Loading state={val}>{(v) => nokiln
        ? (ka.data?.layer && ka.data.national?.e ? <KilnTwist v={v} ka={ka.data} q={q} /> : <NegativeResult v={v} />)
        : (
          <ChartCard title="Kilns burn for months; crop fires burn for days"
            summary="Weekly share of cloud-free days with a fire detection at brick-kiln clusters (brown) versus matched control sites with the same land cover (blue), through the pre-registered gate season. A steady plateau at kilns, short spikes at controls: the signature the classifier learns.">
            <PlateauSpikeChart v={v} />
          </ChartCard>)}
      </Loading>
    </div>
  )
}

function NegativeResult({ v }: { v: Validation }) {
  const c = v.gates.find((g) => g.gate === 'G1' && g.criterion.startsWith('Contrast'))
  return (
    <ChartCard title="A pre-registered surprise: satellites cannot see Bangladesh’s brick kilns" actions={<a className="btn" href={moneyPlateau} download>⬇ Figure</a>}
      summary="We wrote the test down before looking at the data. It failed, so we publish that — and the harmonized calendar, which does not depend on it, ships in full. Source separation uses the Aman and Boro rice-harvest windows instead.">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-stone-100 p-3"><div className="text-3xl font-bold text-orange-700">{c ? `${c.value.toFixed(2)}×` : '–'}</div>
          <div className="text-sm text-stone-600">fire-detection rate at 3,600+ mapped kiln clusters vs matched control sites (pre-registered pass: ≥ 3×)</div></div>
        <div className="rounded-lg bg-stone-100 p-3"><div className="text-3xl font-bold text-orange-700">{c?.p != null ? `p = ${c.p.toFixed(2)}` : '–'}</div>
          <div className="text-sm text-stone-600">permutation test, 10,000 shuffles within districts — no kiln signal</div></div>
        <div className="rounded-lg bg-stone-100 p-3"><div className="text-3xl font-bold text-orange-700">0</div>
          <div className="text-sm text-stone-600">kiln clusters bright enough for a site-level calendar, VIIRS 375 m or MODIS 1 km</div></div>
      </div>
    </ChartCard>
  )
}

/** The twist: the pre-registered fire test fails, and a different NASA product sees the kiln season. */
function KilnTwist({ v, ka, q }: { v: Validation; ka: KilnActivity; q: string }) {
  const c = v.gates.find((g) => g.gate === 'G1' && g.criterion.startsWith('Contrast'))
  const t = ka.layer === 'ntl' ? 'GL' : 'GS'
  const prev = ka.tests.find((r) => r.test === t && r.criterion.startsWith('Prevalence'))
  const seasons = (ka.national?.seasons ?? []).filter((s) => s.onset && s.end)
  const med = (xs: number[]) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]
  const on = seasons.length ? med(seasons.map((s) => s.onset!.p50)) : null
  const end = seasons.length ? med(seasons.map((s) => s.end!.p50)) : null
  const latest = seasons.at(-1)?.season
  const src = ka.layer === 'ntl' ? 'NASA Black Marble night lights' : 'Sentinel-1 radar'
  const tile = (big: string, small: string) => (
    <div className="rounded-lg bg-stone-100 p-3"><div className="text-2xl font-bold text-orange-700 sm:text-3xl">{big}</div><div className="text-sm text-stone-600">{small}</div></div>)
  return (
    <ChartCard title="Fire satellites can’t see Bangladesh’s brick kilns. Night lights can."
      actions={<Link className="btn" to={'/kilns' + q}>Kiln seasons by district →</Link>}
      summary={<>We wrote the fire test down before looking at the data, and it failed: kiln sites have no more fire detections than matched farmland.
        {ka.contamination && <> Of {ka.contamination.detections.toLocaleString('en')} dry-season fire detections in Bangladesh, {(ka.contamination.kiln_share * 100).toFixed(2)}% fall on kiln sites, against {(ka.contamination.control_share * 100).toFixed(2)}% on matched farmland.</>} So kiln heat is not hiding in the fire calendar.
        Kilns do run day and night from late autumn to spring with workers on site, and {src} picks that up. The brown curve is the extra light at mapped kilns over matched control sites in a typical season.
        The test was confirmed on kiln clusters and a season the pilot never touched (pre-registration amendment 1).</>}>
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        {tile(c ? `${c.value.toFixed(2)}×` : '–', 'fire-detection rate at 3,600+ mapped kiln clusters vs matched farmland (pre-registered pass: ≥ 3×). Kilns are invisible to fire satellites.')}
        {tile(prev?.value != null ? `${Math.round(prev.value * 100)}%` : '–', `of held-out kiln clusters are brighter in the working season than their matched controls (${src}).`)}
        {tile(on != null && end != null ? `${seasonDayLabel(on)} → ${seasonDayLabel(end)}` : '–', 'the typical kiln season (median onset and end, 50% of peak). It is a different calendar from the crop fires.')}
      </div>
      <KilnSeasonShapeChart ka={ka} area={ka.national!} season={latest} />
    </ChartCard>
  )
}

function Headline({ h }: { h: Harmonization }) {
  const s = h.seam
  const cov = h.loso_pooled.covered
  return (
    <p className="mt-2 max-w-3xl text-base opacity-95 sm:text-lg">
      Spliced naïvely, satellite records show a {s.d_raw > 0 ? `${Math.round(s.d_raw)}-unit` : ''} jump in burning when VIIRS arrives in 2012.
      Harmonized, the jump falls to <b>{(s.ratio * 100).toFixed(0)}%</b> of that (Chow test p = {s.chow_p_harm.toFixed(2)} for a break, vs {s.chow_p_raw.toExponential(1)} raw),
      and held-out seasons fall inside our 95% intervals <b>{(cov.p50 * 100).toFixed(1)}%</b> of the time{cov.p50 > 0.97 ? ' — above our pre-registered 90–97% target, so the bands are conservative (too wide), and we report that as a miss' : ''}.
    </p>
  )
}
