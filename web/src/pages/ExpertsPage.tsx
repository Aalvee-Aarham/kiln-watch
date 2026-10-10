import { Link } from 'react-router'
import { Icon, useMeta, useTitle } from '../components/ui'
import { PageHead, useQ } from '../components/plain'

const REPO = 'https://github.com/Aalvee-Aarham/kiln-watch'

/** Entry to everything behind the plain-language pages. The pages it links to are unchanged. */
export default function ExpertsPage() {
  useTitle('For experts')
  const q = useQ()
  const meta = useMeta().data
  const inside: [string, string, string][] = [
    ['/story', 'The science story', 'The original walkthrough: the 2012 seam, the one-scale method, and the kiln twist, with every pre-registered verdict.'],
    ['/evidence', 'Evidence', 'Every pre-registered test, passes and failures, on a number line with its threshold. Feasibility gates, validation, kiln channels.'],
    ['/method', 'Method', 'The pipeline step by step, what we do not claim, release policy, credits, licences and parameters.'],
    ['/explore', 'Full explorer', 'Every district and upazila, raw vs harmonized, source split, normals, unusual days, season metrics with 95% intervals, drawn boxes.'],
    ['/season', 'This season by district', 'Near-real-time season-to-date activity, ranked by days above each district’s 90th-percentile normal.'],
    ['/experts/kilns', 'Kiln season charts', 'Night-light kiln excess by half-month, kiln calendars, onset and end with 95% intervals, and the radar check.'],
  ]
  const outside: [string, string, string][] = [
    [REPO, 'Source code', 'The full pipeline (Python) and site (React + TypeScript), MIT licence.'],
    [`${REPO}/blob/main/docs/PREREGISTRATION.md`, 'Pre-registration', 'Committed before any analysis; thresholds never edited.'],
    [`${REPO}/blob/main/docs/PREREGISTRATION_AMENDMENTS.md`, 'Amendment 1', 'The night-light and radar kiln tests, written before the confirmatory run.'],
    [`${REPO}/releases/tag/data-current`, 'Public data release', 'The whole public export as one archive (area-level only).'],
    [`${REPO}/tree/main/reports`, 'Reports', 'Machine-written reports for every stage: gates, harmonization, kiln activity.'],
  ]
  return (
    <div className="space-y-10">
      <PageHead title="For experts">Everything behind the plain-language pages: the tests, the method, the full charts and the data. Nothing here was simplified.</PageHead>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {inside.map(([to, title, text]) => (
          <Link key={to} to={to + q} className="panel group flex flex-col gap-1 hover:bg-surface-2">
            <span className="flex items-center justify-between font-semibold">{title}<Icon name="chevron" className="h-4 w-4 text-muted group-hover:text-ink" /></span>
            <span className="text-sm text-muted">{text}</span>
          </Link>))}
      </section>
      <section className="space-y-3">
        <h2 className="h-section">Code, pre-registration and data</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {outside.map(([href, title, text]) => (
            <li key={href}><a href={href} target="_blank" rel="noreferrer" className="panel flex h-full flex-col gap-1 hover:bg-surface-2">
              <span className="font-semibold text-orbit underline">{title}</span><span className="text-sm text-muted">{text}</span></a></li>))}
        </ul>
        {meta && <p className="text-sm text-muted">This data build: <span className="code">{meta.git_sha}</span>, pre-registration <span className="code">{meta.prereg_sha}</span>, gate branch <span className="code">{meta.gate_branch}</span>.</p>}
      </section>
    </div>
  )
}
