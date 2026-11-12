import { Link } from 'react-router'
import { fmtDate, Icon, Loading, ProvisionalBadge, SkeletonCard, useTitle } from '../components/ui'
import { Gloss, PageHead, useQ } from '../components/plain'
import { useJson } from '../lib/data'
import { useLang } from '../lib/i18n'
import type { FC, NrtSeason, Outlook } from '../lib/types'
import { warningsFor, WINDOW_DAYS, type DistrictWarning, type Level } from '../lib/warnings'

const GROUPS: { level: Level; en: string; bn: string; tone: string }[] = [
  { level: 'unusual', en: 'Unusual fire in the last two weeks', bn: 'গত দুই সপ্তাহে অস্বাভাবিক আগুন', tone: 'text-heat' },
  { level: 'critical', en: 'In their critical burning period now', bn: 'এখন আগুনের সংকটকাল চলছে', tone: 'text-warn' },
  { level: 'soon', en: 'Critical period starts within two weeks', bn: 'দুই সপ্তাহের মধ্যে সংকটকাল শুরু', tone: 'text-warn' },
]

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

/** Early warning: every district ranked by what needs attention now, from the live season, each district's critical
 * periods and (when it ships) the tested two-week outlook. Nothing here is a new forecast. */
export default function WarningsPage() {
  useTitle('Fire warnings')
  const nrt = useJson<NrtSeason>('nrt/current_season.json')
  const ol = useJson<Outlook>('outlook.json').data // optional: absent when its backtest is not estimable
  const dists = useJson<FC>('aoi/districts.geojson')
  const lang = useLang()
  const q = useQ()
  const name = (id: string) => dists.data?.features.find((f) => f.properties.unit_id === id)?.properties
  return (
    <Loading state={nrt} skeleton={<div className="space-y-8"><SkeletonCard label="Loading warnings" /><SkeletonCard label="Loading districts" shape="table" /></div>}>{(n) => {
      const all = warningsFor(n, ol)
      const asOf = fmtDate(new Date(Date.parse(`${n.day0}T00:00:00Z`) + (n.national.h.length - 1) * 86_400_000).toISOString())
      const hasCritical = Object.values(n.districts).some((d) => d.critical)
      const row = (w: DistrictWarning) => {
        const u = name(w.id)
        return (
          <li key={w.id}>
            <Link to={`/area/${w.id}${q}`} className="grid grid-cols-[minmax(0,1fr)_1rem] items-center gap-x-3 gap-y-1 rounded-[4px] px-1 py-3 hover:bg-surface-2">
              <span className="min-w-0 font-medium">{lang === 'bn' && u?.name_bn ? <span lang="bn">{u.name_bn}</span> : u?.name_en ?? w.id}
                {lang !== 'bn' && u?.name_bn && <span className="ml-2 font-normal text-muted" lang="bn">{u.name_bn}</span>}</span>
              <Icon name="chevron" className="row-span-2 h-3.5 w-3.5 text-muted" />
              <span className="text-sm text-muted">{reason(w)}</span>
            </Link>
          </li>
        )
      }
      return (
        <div className="space-y-10">
          <PageHead title={lang === 'bn' ? 'আগুনের আগাম সতর্কতা' : 'Fire warnings'}>
            Where to look first: districts with an <Gloss k="unusual">unusual day</Gloss> in the last two weeks, then districts in, or about to
            enter, their <b>critical period</b> (the time of year when this district usually burns most).
          </PageHead>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <ProvisionalBadge />
            <span>Data to {asOf}, refreshed daily from NASA FIRMS. Season {n.season}.</span>
            <Link className="text-orbit underline" to={`/season${q}`}>Full season table and alert feed</Link>
          </div>
          {!hasCritical && <p className="text-sm text-muted">Critical periods appear after the next daily update.</p>}
          {GROUPS.map((g) => {
            const rows = all.filter((w) => w.level === g.level)
            return (
              <section key={g.level} className="space-y-2" aria-labelledby={`warn-${g.level}`}>
                <h2 id={`warn-${g.level}`} className="h-section flex flex-wrap items-baseline gap-x-2">
                  <span className={g.tone}>{lang === 'bn' ? g.bn : g.en}</span><span className="num text-base text-muted">{rows.length}</span>
                </h2>
                {rows.length ? <ol className="divide-y divide-line">{rows.map(row)}</ol> : <p className="text-muted">No district right now.</p>}
              </section>
            )
          })}
          <details className="space-y-2">
            <summary className="h-section cursor-pointer">{lang === 'bn' ? 'অন্যান্য জেলা' : 'All other districts'} <span className="num text-base text-muted">{all.filter((w) => w.level === 'clear').length}</span></summary>
            <ol className="divide-y divide-line">{all.filter((w) => w.level === 'clear').map(row)}</ol>
          </details>
          <p className="prose-measure text-xs text-muted">How this works: an unusual day has more fire than 9 in 10 past seasons on that date. A critical period is a stretch of at
            least a week when this district’s typical day is among the busiest quarter of its year, from every season since 2003. “Starting soon” means within
            {' '}{WINDOW_DAYS} days. {ol?.ships ? 'The two-week chance comes from the outlook tested on past seasons. ' : ''}These are patterns from past seasons and this season’s
            satellite data, not a forecast of where fires will start.</p>
        </div>
      )
    }}</Loading>
  )
}

function reason(w: DistrictWarning): string {
  const parts: string[] = []
  if (w.daysSince != null && w.level === 'unusual') parts.push(w.daysSince === 0 ? 'Unusual fire on the latest day of data' : `Last unusual day ${days(w.daysSince)} ago`)
  if (w.unusualDays) parts.push(`${days(w.unusualDays)} unusual this season`)
  const c = w.critical
  if (c) parts.push(c.daysUntil === 0 ? `critical period until ${fmtDate(c.end)}` : `critical period starts ${fmtDate(c.start)}, in ${days(c.daysUntil)}`)
  if (w.outlook?.state === 'on') parts.push(`${Math.round(w.outlook.p * 100)}% chance of an unusual day in the next two weeks (usual: ${Math.round(w.outlook.clim * 100)}%)`)
  const s = parts.join(' · ') || 'Nothing unusual this season'
  return s[0].toUpperCase() + s.slice(1)
}
