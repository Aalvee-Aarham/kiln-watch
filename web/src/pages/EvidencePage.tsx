import type { ReactNode } from 'react'
import { CIText, Loading, Term, useKilnActivity, Section, SkeletonCard, StatusMessage, Verdict, VerdictStrip, fmt, useMeta } from '../components/ui'
import { Pm25LagChart, PRCurveChart, RadiusSweepChart, TropomiChart } from '../components/charts'
import { useJson } from '../lib/data'
import type { Harmonization, KilnActivity, Validation } from '../lib/types'

const AMENDMENT_URL = 'https://github.com/Aalvee-Aarham/kiln-watch/blob/main/PREREGISTRATION_AMENDMENTS.md'

const pct = (v: number) => `${(v * 100).toFixed(1)}%`

/** A ledger row's detail, folded away until asked for. */
const More = ({ label, children }: { label: string; children: ReactNode }) => (
  <details className="pb-3 text-sm">
    <summary className="text-muted hover:text-ink">{label}</summary>
    <div className="mt-2 overflow-x-auto">{children}</div>
  </details>
)

// A pre-registered threshold that bounds the value itself ("≥ 3, perm p < 0.01", "> 0, Wilcoxon …") → passing range.
// Thresholds about something else ("Wilcoxon p > 0.05", "all hold") return null and render as a plain verdict row.
function passRange(threshold: string): [number, number] | null {
  const m = threshold.match(/^\s*([≥>≤<])\s*(-?[\d.]+)/)
  if (!m) return null
  return m[1] === '≥' || m[1] === '>' ? [Number(m[2]), Infinity] : [-Infinity, Number(m[2])]
}

/** One test as a verdict strip when its threshold bounds the value, otherwise as a plain verdict row. */
function TestRow({ label, value, threshold, p, pass, log }: { label: ReactNode; value: number | null; threshold: string; p?: number | null; pass?: boolean; log?: boolean }) {
  const r = passRange(threshold)
  const pNote = p != null ? <>p {p < 0.001 ? '< 0.001' : `= ${fmt(p, 3)}`}</> : undefined
  if (r && value != null && Number.isFinite(value) && pass != null) return (
    <VerdictStrip label={<>{label} <span className="text-muted">({threshold})</span></>} value={value} log={log} verdict={pass}
      domain={log ? [0.1, 10] : [Math.min(0, value * 1.2), Math.max(1, Number.isFinite(r[0]) ? r[0] * 2 : 0, Number.isFinite(r[1]) ? r[1] * 2 : 0, value * 1.2)]}
      pass={[Math.max(r[0], log ? 0.1 : -Infinity), Math.min(r[1], log ? 10 : Infinity)]}
      format={(x) => (log ? `${x.toFixed(2)}×` : fmt(x, 3))} note={pNote} />)
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
      <span>{label}</span>
      <span className="text-sm text-muted">{threshold === 'informational' ? `${fmt(value, 3)} (informational)` : <>{value != null && threshold !== 'all hold' && <span className="num">{fmt(value, 3)} · </span>}{threshold}{pNote && <> · {pNote}</>}</>}</span>
      <span className="ml-auto"><Verdict pass={pass} /></span>
    </div>
  )
}

/** Amendment 1: every channel tried for kilns (failures included), then the held-out confirmatory tests. */
function KilnChannels({ ka }: { ka: KilnActivity }) {
  return (
    <Section title="Which satellites can see brick kilns? (pre-registration amendment 1)" plate={false}
      summary={<>After the fire gates failed we tried six channels on one pilot sample of 400 Dhaka kiln clusters. The two that showed a signal were then tested
        on every other cluster and an unseen season (2022-23), under rules <a className="text-orbit underline" href={AMENDMENT_URL}>written down before that test</a>.
        The placebo row swaps each kiln for one of its own controls, and it must show nothing.</>}>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr><th>Channel</th><th>Measure</th><th>Kiln sites</th><th>Matched controls</th><th>Reading</th></tr></thead>
        <tbody>{ka.pilots.map((r) => <tr key={r.channel} className="border-t border-line"><td className="font-medium">{r.channel}</td><td>{r.measure}</td><td className="num">{r.kiln}</td><td className="num">{r.control}</td><td>{r.reading}</td></tr>)}</tbody>
      </table></div>
      <h3 className="mt-6 mb-1 font-semibold">Confirmatory tests on held-out clusters</h3>
      <div className="divide-y divide-line">
        {ka.tests.map((g, i) => <TestRow key={i} label={<><span className="mr-2 font-semibold">{g.test === 'GL' ? 'GL · night lights' : 'GS · radar'}</span>{g.criterion}</>}
          value={g.value} threshold={g.threshold} p={g.p} pass={g.pass} />)}
      </div>
    </Section>
  )
}

export default function EvidencePage() {
  const val = useJson<Validation>('validation.json')
  const harm = useJson<Harmonization>('harmonization.json')
  const ka = useKilnActivity()
  const nokiln = useMeta().data?.gate_branch === 'nokiln'
  return (
    <div className="space-y-14">
      <header>
        <h1 className="h-display text-[clamp(2.5rem,6vw,4rem)]">Evidence</h1>
        <p className="mt-3 prose-measure text-lg text-muted">Every number here was tested against a rule written down before the data were analysed. Each test is drawn as a line with its passing range shaded, so you can see how far a result is from passing. Failures are shown, not hidden.</p>
      </header>

      <Loading state={harm} skeleton={<SkeletonCard label="Loading harmonization tests" shape="table" />}>{(h) => (
        <Section title="Harmonization" plate={false}>
          <div className="divide-y divide-line">
            <div>
              <VerdictStrip label="Seam: harmonized 2012 jump as a share of the raw jump (pass ≤ 25%, plus a raw break p < 0.01 and none after p > 0.05)"
                value={h.seam.ratio} pass={[0, 0.25]} domain={[0, 1]} format={(v) => `${(v * 100).toFixed(1)}%`}
                verdict={h.seam.ratio <= 0.25 && h.seam.chow_p_raw < 0.01 && h.seam.chow_p_harm > 0.05}
                note={<>Raw jump <span className="num">{fmt(h.seam.d_raw)}</span>, harmonized <span className="num">{fmt(h.seam.d_harm)}</span>. <Term k="Chow">Chow</Term> break test p = {h.seam.chow_p_raw.toExponential(1)} raw, {fmt(h.seam.chow_p_harm, 3)} harmonized.{h.sp_nrt_ratio && <> NOAA-20 standard/near-real-time ratio <CIText ci={h.sp_nrt_ratio} />.</>}</>} />
            </div>
            <div>
              <VerdictStrip label={<><Term k="LOSO">Leave-one-season-out</Term>: pooled 95%-interval coverage, model {h.selected_model} (pass 90–97%)</>}
                value={h.loso_pooled.covered.p50} ci={[h.loso_pooled.covered.lo, h.loso_pooled.covered.hi]} pass={[0.9, 0.97]} domain={[0.8, 1]}
                format={(v) => `${(v * 100).toFixed(1)}%`} verdict={h.loso_pooled.covered.p50 >= 0.9 && h.loso_pooled.covered.p50 <= 0.97}
                note={<>n = <span className="num">{h.loso_pooled.n.toLocaleString('en-US')}</span> held-out observations. The pooled figure is the gated one; per-season rows are diagnostic.</>} />
              <More label="Show every held-out season">
                <table className="w-full text-sm"><thead><tr><th>Held-out season</th><th className="n">MAE</th><th className="n">Bias</th><th className="n">Coverage</th></tr></thead>
                  <tbody>{h.loso_by_season.filter((r) => r.model === h.selected_model).map((r) => <tr key={r.season} className="border-t border-line"><td className="num">{r.season}</td><td className="n">{fmt(r.mae, 3)}</td><td className="n">{fmt(r.bias, 3)}</td><td className="n">{pct(r.covered)}</td></tr>)}</tbody></table>
              </More>
            </div>
          </div>
        </Section>)}
      </Loading>

      <Loading state={val} skeleton={<SkeletonCard label="Loading feasibility gates" shape="table" />}>{(v) => (
        <>
          <Section title="Feasibility gates" plate={false}
            summary="G0 is an informational prior screen. G1 (VIIRS) and G2 (MODIS) must meet all three criteria (shape, contrast and seasonality) to unlock kiln layers for their eras.">
            <div className="divide-y divide-line">
              {v.gates.map((g, i) => <TestRow key={i} label={<><span className="mr-2 font-semibold">{g.gate}</span>{g.criterion}</>}
                value={g.value} threshold={g.threshold} p={g.p} pass={g.pass} log={g.criterion.startsWith('Contrast')} />)}
            </div>
          </Section>

          {ka.data && <KilnChannels ka={ka.data} />}

          <div className="grid gap-10 md:grid-cols-2">
            <Section title="Radius sweep" download={{ name: 'kilnwatch_radius', png: true }}
              table={() => <table className="w-full"><thead><tr><th>Radius</th><th className="n">Kilns</th><th className="n">Controls</th></tr></thead><tbody>{v.radius_sweep.map((r) => <tr key={r.radius_m}><td>{r.radius_m} m</td><td className="n">{fmt(r.kiln, 3)}</td><td className="n">{fmt(r.ctrl, 3)}</td></tr>)}</tbody></table>}
              summary="A kiln signal should appear at the pixel scale and not need wide radii; signal that only appears far out is landscape burning."><RadiusSweepChart v={v} /></Section>
            <Section title="Classifier precision–recall" download={{ name: 'kilnwatch_pr', png: true }}
              summary={<><Term k="PR-AUC" /> <CIText ci={v.classifier.pr_auc} d={3} /> vs a rule baseline of {fmt(v.classifier.baseline_pr_auc, 3)} and chance (prevalence) of {fmt(v.classifier.prevalence, 3)}.</>}><PRCurveChart v={v} /></Section>
          </div>

          <Section title="Classifier robustness" plate={false}>
            <div className="grid gap-x-10 gap-y-4 sm:grid-cols-3">
              <div><h3 className="mb-1 font-semibold">Four holdouts</h3><p className="mb-2 text-sm text-muted">Unseen districts, later years, and satellites the model never trained on.</p>
                <dl className="space-y-1 text-sm">{v.classifier.holdouts.map((h) => <div key={h.kind} className="flex justify-between gap-3"><dt>{h.kind.replaceAll('_', ' ')}</dt><dd><CIText ci={h.pr_auc} d={3} /></dd></div>)}</dl></div>
              <div><h3 className="mb-1 font-semibold">Label sets and persistence</h3><p className="mb-2 text-sm text-muted">FIRMS type=2 labels share construction with persistence features, so both label sets and a no-persistence model are reported.</p>
                <dl className="space-y-1 text-sm">{v.classifier.labelset.map((l) => <div key={l.kind} className="flex justify-between gap-3"><dt>{l.kind.replace('_', ' ')}</dt><dd><CIText ci={l.pr_auc} d={3} /></dd></div>)}
                  {v.classifier.ablation_no_persistence && <div className="flex justify-between gap-3"><dt>without p5/p30</dt><dd><CIText ci={v.classifier.ablation_no_persistence} d={3} /></dd></div>}</dl></div>
              <div><h3 className="mb-1 font-semibold">Matched controls</h3><p className="mb-2 text-sm text-muted">Clusters without three valid controls are dropped; the stage fails above 20% nationally or 40% in any division.</p>
                <p className="text-sm">Dropped: <span className="num">{pct(v.controls.dropped_frac)}</span></p>
                <p className="text-sm">Rungs used: {Object.entries(v.controls.rung_counts).map(([k, n]) => `${k}: ${n}`).join(', ')}</p></div>
            </div>
          </Section>

          <div className="grid gap-10 md:grid-cols-2">
            {v.tropomi && v.tropomi.monthly.length > 0 && <Section title="Air-quality cross-check (TROPOMI NO₂)" download={{ name: 'kilnwatch_tropomi', png: true }}
              summary={<>Difference-in-differences, kiln belts minus nearby rings, firing minus monsoon: <CIText ci={v.tropomi.did_no2} d={8} /> mol/m². Two panels share the month axis; they are never drawn on two scales of one plot.</>}><TropomiChart v={v} /></Section>}
            {v.pm25 && <Section title="Dhaka PM2.5 (OpenAQ)" download={{ name: 'kilnwatch_pm25', png: true }} summary="Correlational, and confounded by weather and seasonality."><Pm25LagChart v={v} nokiln={nokiln} /></Section>}
            {v.transfer && <Section title={`Transfer test: ${v.transfer.district}`} plate={false} summary="The frozen model on a district it never saw, with its own boundary and clouds.">
              <p className="flex items-center gap-3 text-sm">PR-AUC <CIText ci={v.transfer.pr_auc} d={3} /> <Verdict pass={v.transfer.gate_pass} /></p></Section>}
            <Section title="Candidate unmapped kilns" plate={false} summary="Persistent kiln-like heat more than 1 km from any mapped kiln. Locations go only to the regulator; the public sees district counts.">
              <p className="text-sm"><span className="num text-2xl font-semibold">{v.candidates.n}</span> candidates. Most in: {Object.entries(v.candidates.by_district).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([d, n]) => `${d} (${n})`).join(', ') || 'none'}.</p></Section>
          </div>
          {v.skipped?.length ? <StatusMessage>Skipped layers: {v.skipped.map((s) => `${s.stage} (${s.reason})`).join('; ')}</StatusMessage> : null}
        </>)}
      </Loading>
    </div>
  )
}
