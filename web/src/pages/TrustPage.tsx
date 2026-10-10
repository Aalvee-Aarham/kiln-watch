import { useMemo, useState, type ReactNode } from 'react'
import { Icon, SegmentedToggle, useKilnActivity, useMeta, useTitle } from '../components/ui'
import { Gloss, PageHead, Provenance, TryLink } from '../components/plain'
import { EChart } from '../components/EChart'
import { useJson } from '../lib/data'
import { useLang, useT } from '../lib/i18n'
import { MONTHS } from '../lib/plain'
import { palette, useTheme } from '../lib/theme'
import type { Harmonization, TransferChannel, TransferCountry, TransferTest, Validation } from '../lib/types'

const REPO = 'https://github.com/Aalvee-Aarham/kiln-watch'
type Result = 'pass' | 'fail' | 'none'
type Check = { claim: ReactNode; result: Result; got: ReactNode; meaning: ReactNode }
const pct = (v: number) => `${Math.round(v * 100)}%`

/** Validity in plain words: every pre-registered test, the ones that failed included, and what we never claim. */
export default function TrustPage() {
  useTitle('Can you trust it?')
  const t = useT()
  const lang = useLang()
  const meta = useMeta().data
  const harm = useJson<Harmonization>('harmonization.json').data
  const val = useJson<Validation>('validation.json').data
  const ka = useKilnActivity().data
  const gl = (s: string) => ka?.tests.find((r) => r.test === 'GL' && r.criterion.startsWith(s))
  const rep = gl('Replication'), repN = Number(rep?.criterion.match(/\((\d+) evaluable\)/)?.[1] ?? NaN)
  const fireGate = val?.gates.find((g) => g.gate === 'G1' && g.pass !== undefined)
  const rs = (val?.pm25 ?? []).flatMap((x) => [x.r_kiln.p50, x.r_veg.p50])
  const cov = harm?.loso_pooled.covered.p50
  const abroad = (ka?.transfer?.countries ?? []).filter((c) => c.code !== 'BD' && c.evaluable !== false)

  const checks: Check[] = [
    ...(harm ? [{
      claim: 'The 2012 jump came from the camera change, and our correction removes it.',
      result: (harm.seam.ratio <= 0.25 && harm.seam.chow_p_raw < 0.01 && harm.seam.chow_p_harm > 0.05 ? 'pass' : 'fail') as Result,
      got: <>{pct(1 - harm.seam.ratio)} of the jump removed (needed 75% or more)</>,
      meaning: 'Fire records from before and after 2012 can now be compared fairly.',
    }] : []),
    ...(cov != null ? [{
      claim: 'Our uncertainty ranges are the right width.',
      result: (cov >= 0.9 && cov <= 0.97 ? 'pass' : 'fail') as Result,
      got: <>On years held back from the model, the true value fell inside our range {pct(cov)} of the time (target 90–97%)</>,
      meaning: cov > 0.97 ? 'Failed on the safe side: our ranges are a little wider than they need to be, never too narrow.' : 'Our stated uncertainty matches reality.',
    }] : []),
    ...(fireGate ? [{
      claim: 'Fire satellites can tell brick kilns apart from farm fires.',
      result: (fireGate.pass ? 'pass' : 'fail') as Result,
      got: fireGate.pass ? <>Kilns stood out from nearby farmland in the fire data</> : <>Kilns looked no different from nearby farmland in the fire data</>,
      meaning: fireGate.pass ? 'Fire data can separate kiln heat from crop fires.'
        : 'So we did not publish any fire-based kiln map, and tested other instruments instead (see How it works, step 4).',
    }] : []),
    ...(gl('Contrast') ? [{
      claim: <>Kiln areas glow brighter at night in kiln season than nearby farmland (<Gloss k="nightLights">night lights</Gloss>).</>,
      result: (gl('Contrast')!.pass ? 'pass' : 'fail') as Result,
      got: <>Yes, in {gl('Prevalence')?.value != null ? pct(gl('Prevalence')!.value!) : 'most'} of kiln clusters (needed 60%)</>,
      meaning: 'Night lights can show when kilns in an area are working.',
    }] : []),
    ...(rep ? [{
      claim: 'It holds every season, not just one lucky year.',
      result: (rep.pass ? 'pass' : 'fail') as Result,
      got: <>{rep.value != null && Number.isFinite(repN) ? `${Math.round(rep.value * repN)} of ${repN} seasons` : 'Most seasons'} (needed 75%)</>,
      meaning: 'The kiln calendar is stable enough to plan with.',
    }] : []),
    ...(gl('Placebo') ? [{
      claim: 'Plain farmland, pretending to be a kiln, shows nothing.',
      result: (gl('Placebo')!.pass ? 'pass' : 'fail') as Result,
      got: <>No signal on farmland, as expected</>,
      meaning: 'The glow comes from kilns, not from the season or the method.',
    }] : []),
    ...(ka?.pass.GS != null ? [{
      claim: <>A second, independent satellite (<Gloss k="radar">radar</Gloss>) agrees.</>,
      result: (ka.pass.GS ? 'pass' : 'fail') as Result,
      got: <>Radar sees fresh brick stacks in kiln yards in the same months</>,
      meaning: 'Two different kinds of sensor point to the same kiln season.',
    }] : []),
    ...(rs.length ? [{
      claim: 'Burning predicts Dhaka’s daily air pollution (PM2.5).',
      result: 'none' as Result,
      got: <>Correlation between {Math.min(...rs).toFixed(2)} and {Math.max(...rs).toFixed(2)}, about zero</>,
      meaning: 'So Kiln Watch is not an air-quality forecast, and never says it is.',
    }] : []),
    ...(val?.transfer ? [{
      claim: `Fire satellites can spot kilns in another country (${val.transfer.district}, Pakistan).`,
      result: (val.transfer.gate_pass ? 'pass' : 'fail') as Result,
      got: val.transfer.gate_pass ? <>Yes, the fire-data kiln model worked there</> : <>No: kilns looked like farmland to fire satellites there too</>,
      meaning: val.transfer.gate_pass ? 'The fire-data kiln model carries over to Pakistan.'
        : 'The same failure as in Bangladesh: fire satellites cannot see enclosed kilns, so kilns are tracked with night lights instead.',
    }] : []),
    ...abroad.flatMap((c) => {
      const first = c.channels.ntl, re = headline(c) !== c ? headline(c).channels.ntl : undefined
      if (first?.pass.LL == null) return []
      const fails = failed(first, 'LL')
      const row = (ch: TransferChannel, claim: ReactNode, meaning: string) => ({
        claim, result: (ch.pass.LL ? 'pass' : 'fail') as Result, meaning,
        got: ch.pass.LL ? <>Busiest {span(ch.learned.core)}; Bangladesh’s months unchanged: {ch.pass.TL ? 'also passed' : 'failed'}</>
          : <>Failed: {failed(ch, 'LL').join('; ').toLowerCase()}</>,
      })
      const verdict = (ch: TransferChannel) => (ch.pass.LL ? `The night-light kiln method works in ${c.name}.` : `We do not claim the method works in ${c.name}.`)
      return [
        row(first, <>Night lights see kilns in {c.name} too, once the method learns {c.name}’s own kiln calendar{re ? ' (first test)' : ''}.</>,
          re && !first.pass.LL ? (fails.length === 1 && fails[0] === CHECKS[3][1] ? `${SPILL} Retested below.` : 'Retested below.') : verdict(first)),
        ...(re ? [row(re, <>Retest in {c.name} on fresh kiln clusters, with farmland at least 6 km from any kiln.</>, verdict(re))] : []),
        ...(c.channels.s1?.pass.LS != null ? [{
          claim: <>Radar sees kiln yards in {c.name} too, on {c.name}’s own calendar.</>,
          result: (c.channels.s1.pass.LS ? 'pass' : 'fail') as Result,
          got: c.channels.s1.pass.LS ? <>Busiest {span(c.channels.s1.learned.core)}</> : <>Failed: {failed(c.channels.s1, 'LS').join('; ').toLowerCase()}</>,
          meaning: c.channels.s1.pass.LS ? 'A second, independent sensor agrees.' : 'Radar does not confirm it there.',
        }] : []),
      ]
    }),
  ]
  const n = (r: Result) => checks.filter((c) => c.result === r).length

  return (
    <div className="space-y-12">
      {lang === 'bn' && <p className="text-sm text-muted" lang="bn">{t('englishOnly')}</p>}
      <PageHead title="Can you trust it?">
        We wrote our tests down <i>before</i> looking at the results, and we publish every outcome, including the ones that went against us.
      </PageHead>

      <section className="space-y-4" aria-label="Test results">
        <p className="text-lg"><b className="text-ok">{n('pass')} passed</b> · <b className="text-err">{n('fail')} failed</b>{n('none') > 0 && <> · <b>{n('none')} found no link</b></>}. All shown below.</p>
        <ul className="space-y-2">
          {checks.map((c, i) => (
            <li key={i} className="panel grid gap-2 md:grid-cols-[minmax(0,1.3fr)_8rem_minmax(0,1.5fr)] md:items-start">
              <b className="leading-snug">{c.claim}</b>
              <Badge r={c.result} />
              <span className="text-sm"><span className="block">{c.got}</span><span className="block text-muted">{c.meaning}</span></span>
            </li>))}
        </ul>
      </section>

      {harm?.overlap && harm.overlap.length > 0 && <Agreement rows={harm.overlap} />}

      {ka?.transfer && ka.transfer.countries.length > 1 && <Abroad countries={ka.transfer.countries} />}

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-label="How we kept ourselves honest">
        {[['Tests written first', 'Every pass mark was committed to a public file before the analysis it governs. Later changes go in dated amendments, never edits.'],
          ['Fair comparisons', 'Each kiln cluster is compared with three patches of similar farmland nearby, so seasons and weather cancel out.'],
          ['Tested on unseen years', 'The camera correction was checked on each year after leaving that year out of the training.'],
          ['Everything open', 'Code, data and reports are public, so anyone can rerun every number on this site.']].map(([a, b]) => (
          <div key={a} className="panel"><b className="block">{a}</b><span className="text-sm text-muted">{b}</span></div>))}
      </section>

      {meta && <section className="space-y-3" aria-label="What we never claim">
        <h2 className="h-display text-[clamp(1.6rem,3.5vw,2.2rem)]">What we never claim</h2>
        <ul className="prose-measure list-disc space-y-1 pl-5 text-muted">{meta.non_claims.map((c) => <li key={c.en}>{c.en}</li>)}</ul>
      </section>}

      <div className="flex flex-wrap gap-2">
        <a className="btn btn-primary min-h-11 px-4" href={`${REPO}/blob/main/docs/PREREGISTRATION.md`} target="_blank" rel="noreferrer">Read the pre-registration<Icon name="chevron" className="h-3.5 w-3.5" /></a>
        <TryLink to="/evidence">Full evidence (for experts)</TryLink>
      </div>
    </div>
  )
}

function Badge({ r }: { r: Result }) {
  const [label, cls, icon] = r === 'pass' ? ['Passed', 'bg-ok-soft text-ok', 'check'] as const : r === 'fail' ? ['Failed', 'bg-err-soft text-err', 'cross'] as const : ['No link found', 'bg-surface-2 text-muted', 'half'] as const
  return <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${cls}`}><Icon name={icon} className="h-3.5 w-3.5" />{label}</span>
}

const mon = (m: number) => MONTHS[m - 1]
/** "A", "A and B", "A, B and C". */
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
const span = (ms: number[]) => (ms.length ? `${mon(ms[0])} to ${mon(ms[ms.length - 1])}` : '')
const CHECKS: [string, string][] = [
  ['Contrast', 'Kilns glow more in their busy months than nearby farmland'], ['Prevalence', 'In most kiln clusters, not just a few'],
  ['Replication', 'Year after year'], ['Placebo', 'Farmland pretending to be a kiln shows nothing'],
]

/** Amendment 2: the night-light kiln method in other countries, one country at a time, on its real monthly profile. */
export function Abroad({ countries }: { countries: TransferCountry[] }) {
  const [code, setCode] = useState(countries.find((c) => c.code !== 'BD')?.code ?? countries[0].code)
  const c = countries.find((x) => x.code === code) ?? countries[0]
  const ntl = headline(c).channels.ntl
  return (
    <section className="space-y-4" aria-label="Does it work outside Bangladesh?">
      <h2 className="h-display text-[clamp(1.6rem,3.5vw,2.2rem)]">Does it work outside Bangladesh?</h2>
      <p className="prose-measure text-muted">We repeated the night-light kiln test in {list(countries.filter((x) => x.code !== 'BD').map((x) => x.name))}, with the rules
        written down before any of their data was pulled. Kilns keep different calendars in each country, so the method first learns each country’s busy
        months from one in five of its kiln clusters, then is tested on the rest.</p>
      <SegmentedToggle label="Country" value={code} options={countries.map((x) => [x.code, x.name] as [string, string])} onChange={setCode} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <figure className="panel m-0 space-y-2">
          <figcaption className="font-semibold">Extra night glow at kiln sites, month by month: {c.name}</figcaption>
          {ntl ? <ProfileChart ch={ntl} name={c.name} /> : <p className="text-sm text-muted">No night-light data for this country.</p>}
          {ntl && <p className="text-xs text-muted">Line: median over {ntl.profile.n_clusters.toLocaleString('en-US')} kiln clusters of their glow minus three patches of similar
            farmland nearby. Band: 95% range. Dark shading: the 5 busiest months the method learned; light shading: the 4 quietest.</p>}
        </figure>
        <Verdict c={c} />
      </div>
    </section>
  )
}

function ProfileChart({ ch, name }: { ch: TransferChannel; name: string }) {
  const theme = useTheme()
  const p = useMemo(() => palette(), [theme]) // eslint-disable-line react-hooks/exhaustive-deps
  const x = ch.profile.months.map((m) => mon(m).slice(0, 3))
  const lo = ch.profile.lo
  const band = ch.profile.hi.map((h, i) => (h == null || lo[i] == null ? null : Math.round((h - (lo[i] as number)) * 1e4) / 1e4))
  const area = (ms: number[], color: string, label: string) => ({
    silent: true, itemStyle: { color, opacity: 0.12 }, label: { show: true, position: 'insideTop', color, fontSize: 11, formatter: label },
    data: [[{ xAxis: mon(ms[0]).slice(0, 3) }, { xAxis: mon(ms[ms.length - 1]).slice(0, 3) }]],
  })
  const opt = {
    grid: { left: 44, right: 12, top: 28, bottom: 28 }, tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: x, boundaryGap: false },
    yAxis: { type: 'value', name: 'nW/cm²/sr' },
    series: [
      { name: 'lo', type: 'line', data: lo, stack: 'ci', stackStrategy: 'all', symbol: 'none', lineStyle: { opacity: 0 }, tooltip: { show: false } },
      { name: '95% range', type: 'line', data: band, stack: 'ci', stackStrategy: 'all', symbol: 'none', lineStyle: { opacity: 0 },
        areaStyle: { color: p.brick, opacity: 0.18 }, tooltip: { show: false } },
      { name: 'Kiln glow above farmland', type: 'line', data: ch.profile.p50, color: p.brick, lineStyle: { width: 3 }, symbolSize: 6,
        markArea: area(ch.learned.core, p.brick, 'busiest'),
        markLine: { silent: true, symbol: 'none', lineStyle: { color: p.muted, type: 'dotted' }, data: [{ yAxis: 0 }], label: { show: false } } },
      { name: 'quiet', type: 'line', data: [], markArea: area(ch.learned.off, p.muted, 'quietest') },
    ],
  }
  return <EChart option={opt} height={280} label={`Median extra night glow at kiln sites in ${name}, July to June, with the learned busiest and quietest months shaded`}
    exportName={`kilnwatch_kilns_${name.toLowerCase()}`} />
}

/** Plain labels of the checks a test failed. */
const failed = (ch: TransferChannel | undefined, t: TransferTest) =>
  CHECKS.filter(([k]) => ch?.tests.some((r) => r.test === t && r.criterion.startsWith(k) && !r.pass)).map(([, label]) => label)
/** The retest (Amendment 4) when it ran, else the first test. */
const headline = (c: TransferCountry) => (c.retest && c.retest.evaluable !== false && c.retest.channels.ntl ? c.retest : c)
const SPILL = 'Farmland close to kilns also brightened in the kiln season (kiln light reaches it), so the farmland-versus-farmland check failed.'

function Verdict({ c }: { c: TransferCountry }) {
  const head = headline(c)
  const ntl = head.channels.ntl, s1 = c.channels.s1, first = c.channels.ntl
  if (c.code === 'BD') return (
    <div className="panel space-y-3 self-start">
      <b className="block text-lg">Home test: passed</b>
      <p className="text-sm">The night-light method was first tested here (see the checks above).</p>
      {ntl && <p className="text-sm text-muted">Self-check: given only Bangladesh’s 400 pilot clusters, the learner picks <b>{span(ntl.learned.core)}</b> as the
        busiest months. The fixed Bangladesh test uses December to April.</p>}
    </div>
  )
  if (head.evaluable === false) return <div className="panel self-start text-sm">Not tested: too few kiln clusters had fair farmland controls nearby.</div>
  const local = ntl?.pass.LL, strict = ntl?.pass.TL
  const firstFails = failed(first, 'LL')
  return (
    <div className="panel space-y-3 self-start">
      {ntl && <>
        <b className={`block text-lg ${local ? 'text-ok' : 'text-err'}`}>{local ? `Passed in ${c.name}` : `Did not pass in ${c.name}`}</b>
        {!local && failed(ntl, 'LL').includes(CHECKS[0][1]) && <p className="text-sm">Night lights show no kiln season here, so this method cannot time kilns
          in {c.name}.</p>}
        {head !== c && <p className="text-sm">Retest on {head.n_sampled?.toLocaleString('en-US')} fresh kiln clusters, with farmland at least 6 km from any kiln.</p>}
        <p className="text-sm">Learned from {c.name}’s own kilns: busiest <b>{span(ntl.learned.core)}</b>, quietest <b>{span(ntl.learned.off)}</b>.</p>
        <Rows tests={ntl.tests.filter((r) => r.test === 'LL')} />
        <p className="text-sm text-muted">Using Bangladesh’s months unchanged (December to April): <b>{strict ? 'passed' : 'failed'}</b>.
          {!strict && local && ' Kilns there keep a different calendar, which is why the method learns it first.'}</p>
      </>}
      {head !== c && first && <p className="text-sm text-muted">First test, on {c.n_sampled?.toLocaleString('en-US')} other clusters with farmland 3–15 km
        from kilns: <b>{first.pass.LL ? 'passed' : 'did not pass'}</b>.{firstFails.length === 1 && firstFails[0] === CHECKS[3][1] ? ` ${SPILL}` : firstFails.length ? ` Failed: ${firstFails.join('; ').toLowerCase()}.` : ''}</p>}
      {s1 && <p className="text-sm text-muted">Radar, as an independent check ({s1.n_confirmation} clusters): own calendar <b>{s1.pass.LS ? 'passed' : 'failed'}</b>,
        Bangladesh’s months <b>{s1.pass.TS ? 'passed' : 'failed'}</b>.</p>}
      <p className="text-xs text-muted">{c.n_kilns?.toLocaleString('en-US')} mapped kilns in {c.n_clusters.toLocaleString('en-US')} clusters ({c.source ?? 'APAD'});
        {c.n_sampled === c.n_clusters ? ' all were used.' : ` a random ${c.n_sampled?.toLocaleString('en-US')} were used.`}</p>
    </div>
  )
}

function Rows({ tests }: { tests: TransferChannel['tests'] }) {
  return (
    <ul className="space-y-1 text-sm">
      {CHECKS.map(([k, label]) => {
        const r = tests.find((t) => t.criterion.startsWith(k))
        if (!r) return null
        const val = k === 'Prevalence' && r.value != null ? ` (${Math.round(r.value * 100)}%)` : ''
        return <li key={k} className="flex gap-2"><Icon name={r.pass ? 'check' : 'cross'} className={`mt-0.5 h-4 w-4 ${r.pass ? 'text-ok' : 'text-err'}`} /><span>{label}{val}</span></li>
      })}
    </ul>
  )
}

/** The overlap check: on months both cameras flew, does corrected VIIRS read on Aqua's scale? */
function Agreement({ rows }: { rows: NonNullable<Harmonization['overlap']> }) {
  const f = (v: number, d = 2) => v.toFixed(d)
  const label = { calibration: 'Years used to fit the correction', held_out: 'Later years it never saw' } as const
  return (
    <section className="space-y-4" aria-label="Do the cameras agree after correction?">
      <h2 className="h-display text-[clamp(1.6rem,3.5vw,2.2rem)]">Do the cameras agree after correction?</h2>
      <p className="prose-measure text-muted">From 2012 the old <Gloss k="MODIS" /> camera on Aqua and the new <Gloss k="VIIRS" /> camera flew together, so both measured the same districts in the same months.
        If the correction works, VIIRS should read on Aqua’s scale, and the two should agree month by month, including in years the correction was never fitted on.</p>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">VIIRS against Aqua MODIS on district-months both saw, before and after correction</caption>
          <thead className="text-left text-muted"><tr><th className="py-1.5 pr-3 font-normal">Seasons</th><th className="py-1.5 pr-3 font-normal">VIIRS reads … × Aqua<br />raw → corrected</th>
            <th className="py-1.5 font-normal">Agreement (1 = identical)<br />raw → corrected</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.period} className="border-t border-line">
              <td className="py-2 pr-3"><b className="block">{label[r.period]}</b><span className="text-muted">{r.seasons} · {r.n_districts} districts · {r.n_months.toLocaleString('en-US')} district-months</span></td>
              <td className="num py-2 pr-3">{f(r.ratio_raw.p50, 1)}× → <b>{f(r.ratio_harm.p50)}×</b><span className="block text-xs text-muted">95%: {f(r.ratio_harm.lo)}–{f(r.ratio_harm.hi)}</span></td>
              <td className="num py-2">{f(r.ccc_raw.p50)} → <b>{f(r.ccc_harm.p50)}</b><span className="block text-xs text-muted">95%: {f(r.ccc_harm.lo)}–{f(r.ccc_harm.hi)}</span></td>
            </tr>))}</tbody>
        </table>
      </div>
      <p className="prose-measure text-sm text-muted">Agreement is Lin’s concordance coefficient, which, unlike a plain correlation, drops when one camera reads on a different scale. Intervals come from resampling whole districts.
        Only months in which both cameras saw at least 20% of the district through cloud on 5 or more days count.</p>
      <Provenance file="harmonization.json" data="NASA FIRMS Aqua MODIS C6.1 and Suomi NPP VIIRS 375 m, Earth Engine MYD14A1 and VNP14A1 cloud-free fractions" />
    </section>
  )
}
