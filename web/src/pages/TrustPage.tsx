import type { ReactNode } from 'react'
import { Icon, useKilnActivity, useMeta, useTitle } from '../components/ui'
import { Gloss, PageHead, TryLink } from '../components/plain'
import { useJson } from '../lib/data'
import { useLang, useT } from '../lib/i18n'
import type { Harmonization, Validation } from '../lib/types'

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
      got: <>Kilns looked no different from nearby farmland in the fire data</>,
      meaning: 'So we did not publish any fire-based kiln map, and tested other instruments instead (see How it works, step 4).',
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
      claim: `The fire-satellite kiln method works in another country (${val.transfer.district}, Pakistan).`,
      result: (val.transfer.gate_pass ? 'pass' : 'fail') as Result,
      got: <>It did not pass there</>,
      meaning: 'We only claim results for Bangladesh.',
    }] : []),
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
        <a className="btn btn-primary min-h-11 px-4" href={`${REPO}/blob/main/PREREGISTRATION.md`} target="_blank" rel="noreferrer">Read the pre-registration<Icon name="chevron" className="h-3.5 w-3.5" /></a>
        <TryLink to="/evidence">Full evidence (for experts)</TryLink>
      </div>
    </div>
  )
}

function Badge({ r }: { r: Result }) {
  const [label, cls, icon] = r === 'pass' ? ['Passed', 'bg-ok-soft text-ok', 'check'] as const : r === 'fail' ? ['Failed', 'bg-err-soft text-err', 'cross'] as const : ['No link found', 'bg-surface-2 text-muted', 'half'] as const
  return <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${cls}`}><Icon name={icon} className="h-3.5 w-3.5" />{label}</span>
}
