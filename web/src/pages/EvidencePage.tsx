import { ChartCard, CIText, fmt, Loading, StatusMessage, useMeta } from '../components/ui'
import { Pm25LagChart, PRCurveChart, RadiusSweepChart, TropomiChart } from '../components/charts'
import { useJson } from '../lib/data'
import type { Harmonization, Validation } from '../lib/types'

const Pass = ({ ok }: { ok?: boolean }) => ok == null ? null
  : <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{ok ? 'PASS' : 'FAIL'}</span>
const pct = (v: number) => `${(v * 100).toFixed(1)}%`

export default function EvidencePage() {
  const val = useJson<Validation>('validation.json')
  const harm = useJson<Harmonization>('harmonization.json')
  const nokiln = useMeta().data?.gate_branch === 'nokiln'
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Evidence</h1>
      <p className="max-w-3xl text-stone-700">Every number here was tested against a rule written down before the data were analysed. Failures are shown, not hidden.</p>
      <Loading state={harm}>{(h) => (
        <div className="grid gap-4 md:grid-cols-2">
          <ChartCard title="Seam test: is the 2012 jump real?" summary={`Pre-registered pass: harmonized jump ≤ 25% of raw, a break in the raw series (p < 0.01) and none after harmonizing (p > 0.05).`}>
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt>Raw jump</dt><dd>{fmt(h.seam.d_raw)}</dd><dt>Harmonized jump</dt><dd>{fmt(h.seam.d_harm)}</dd>
              <dt>Ratio</dt><dd>{fmt(h.seam.ratio, 3)} <Pass ok={h.seam.ratio <= 0.25 && h.seam.chow_p_raw < 0.01 && h.seam.chow_p_harm > 0.05} /></dd>
              <dt>Chow p (raw / harm)</dt><dd>{h.seam.chow_p_raw.toExponential(1)} / {fmt(h.seam.chow_p_harm, 3)}</dd>
              {h.sp_nrt_ratio && <><dt>NOAA-20 SP/NRT ratio</dt><dd><CIText ci={h.sp_nrt_ratio} /></dd></>}
            </dl>
          </ChartCard>
          <ChartCard title="Leave-one-season-out validation" summary={`Model ${h.selected_model} selected. The gated figure is pooled coverage across all held-out observations (target 90–97%); per-season rows are diagnostic.`}>
            <p className="mb-2 text-sm">Pooled 95%-interval coverage (n = {h.loso_pooled.n}): <b><CIText ci={{ p50: h.loso_pooled.covered.p50 * 100, lo: h.loso_pooled.covered.lo * 100, hi: h.loso_pooled.covered.hi * 100 }} d={1} />%</b>{' '}
              <Pass ok={h.loso_pooled.covered.p50 >= 0.9 && h.loso_pooled.covered.p50 <= 0.97} /></p>
            <table className="w-full text-xs"><thead><tr className="text-left text-stone-500"><th>Held-out season</th><th>Model</th><th>MAE</th><th>Bias</th><th>Coverage</th></tr></thead>
              <tbody>{h.loso_by_season.filter((r) => r.model === h.selected_model).map((r) => <tr key={r.season + r.model} className="border-t border-stone-100"><td>{r.season}</td><td>{r.model}</td><td>{fmt(r.mae, 3)}</td><td>{fmt(r.bias, 3)}</td><td>{pct(r.covered)}</td></tr>)}</tbody></table>
          </ChartCard>
        </div>)}
      </Loading>
      <Loading state={val}>{(v) => (
        <>
          <ChartCard title="Feasibility gates (pre-registered)" summary="G0 is an informational prior screen. G1 (VIIRS) and G2 (MODIS) must meet all three criteria — shape, contrast and seasonality — to unlock kiln layers for their eras.">
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-stone-500"><th>Gate</th><th>Criterion</th><th>Value</th><th>Threshold</th><th>p</th><th></th></tr></thead>
              <tbody>{v.gates.map((g, i) => <tr key={i} className="border-t border-stone-100"><td className="font-semibold">{g.gate}</td><td>{g.criterion}</td><td>{fmt(g.value, 3)}</td><td>{g.threshold}</td><td>{g.p == null ? '' : g.p < 0.001 ? '<0.001' : fmt(g.p, 3)}</td><td><Pass ok={g.pass} /></td></tr>)}</tbody></table></div>
          </ChartCard>
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Radius sweep" summary="A kiln signal should appear at the pixel scale and not need wide radii; signal that only appears far out is landscape burning."><RadiusSweepChart v={v} /></ChartCard>
            <ChartCard title="Classifier precision–recall" summary={<>PR-AUC <CIText ci={v.classifier.pr_auc} d={3} /> vs rule baseline {fmt(v.classifier.baseline_pr_auc, 3)} and prevalence {fmt(v.classifier.prevalence, 3)}.</>}><PRCurveChart v={v} /></ChartCard>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <ChartCard title="Four holdouts" summary="Unseen districts, later years, and satellites the model was never trained on.">
              <ul className="space-y-1 text-sm">{v.classifier.holdouts.map((h) => <li key={h.kind}>{h.kind.replaceAll('_', ' ')}: <CIText ci={h.pr_auc} d={3} /></li>)}</ul></ChartCard>
            <ChartCard title="Label sets & persistence" summary="FIRMS type=2 labels share construction with persistence features, so we report both label sets and a model without persistence.">
              <ul className="space-y-1 text-sm">{v.classifier.labelset.map((l) => <li key={l.kind}>{l.kind.replace('_', ' ')}: <CIText ci={l.pr_auc} d={3} /></li>)}
                {v.classifier.ablation_no_persistence && <li>without p5/p30: <CIText ci={v.classifier.ablation_no_persistence} d={3} /></li>}</ul></ChartCard>
            <ChartCard title="Matched controls" summary="Clusters without three valid controls are dropped; the stage fails above 20% nationally or 40% in any division.">
              <p className="text-sm">Dropped: {pct(v.controls.dropped_frac)}</p>
              <p className="text-sm">Rungs used: {Object.entries(v.controls.rung_counts).map(([k, n]) => `${k}: ${n}`).join(' · ')}</p></ChartCard>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {v.tropomi && <ChartCard title="Air-quality cross-check (TROPOMI NO₂)" summary={<>Difference-in-differences, kiln belts minus nearby rings, firing minus monsoon: <CIText ci={v.tropomi.did_no2} d={8} /> mol/m². Treatment: {v.tropomi.treatment}.</>}><TropomiChart v={v} /></ChartCard>}
            {v.pm25 && <ChartCard title="Dhaka PM2.5 (OpenAQ)" summary="Correlational and caveated: weather and seasonality confound it."><Pm25LagChart v={v} nokiln={nokiln} /></ChartCard>}
            {v.transfer && <ChartCard title={`Transfer test: ${v.transfer.district}`} summary="The frozen model on a district it never saw, with its own boundary and clouds.">
              <p className="text-sm">PR-AUC <CIText ci={v.transfer.pr_auc} d={3} /> <Pass ok={v.transfer.gate_pass} /></p></ChartCard>}
            <ChartCard title="Candidate unmapped kilns" summary="Persistent kiln-like heat more than 1 km from any mapped kiln. Locations go only to the regulator; the public sees district counts.">
              <p className="text-sm">{v.candidates.n} candidates · top districts: {Object.entries(v.candidates.by_district).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([d, n]) => `${d} ${n}`).join(', ')}</p></ChartCard>
          </div>
          {v.skipped?.length ? <StatusMessage>Skipped layers: {v.skipped.map((s) => `${s.stage} (${s.reason})`).join('; ')}</StatusMessage> : null}
        </>)}
      </Loading>
    </div>
  )
}
