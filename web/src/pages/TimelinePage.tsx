import { useState } from 'react'
import { Loading, SegmentedToggle, SkeletonCard, useKilnActivity, useTitle } from '../components/ui'
import { Caution, Gloss, PageHead, TryLink } from '../components/plain'
import { useJson } from '../lib/data'
import { useLang, useT } from '../lib/i18n'
import { seasonOf } from '../lib/days'
import type { Events, Harmonization, KilnSeasonRow } from '../lib/types'

type Ev = { date: string; label_en: string; url: string; kind: 'policy' | 'satellite' }
const fmtDate = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace('Sept', 'Sep')
const nextSeason = (s: string, k: number) => { const y = +s.slice(0, 4) + k; return `${y}-${String((y + 1) % 100).padStart(2, '0')}` }

/** 2003 → 2027, one row per season: corrected fire activity, kiln-season length, and dated events with sources. */
export default function TimelinePage() {
  useTitle('Timeline')
  const t = useT()
  const lang = useLang()
  const harm = useJson<Harmonization>('harmonization.json')
  const events = useJson<Events>('events.json')
  const ka = useKilnActivity().data
  const [show, setShow] = useState<'all' | 'policy' | 'satellite'>('all')
  return (
    <div className="space-y-10">
      {lang === 'bn' && <p className="text-sm text-muted" lang="bn">{t('englishOnly')}</p>}
      <PageHead title="23 years of burning, laws and satellites">
        Each row is one <Gloss k="season">season</Gloss>. The orange bar is how much fire satellites recorded across Bangladesh, all cameras on one scale.
        The brown bar is how long the brick-kiln season lasted (measured from 2012). Tap an event to see what it was and where it comes from.
      </PageHead>
      <Caution>Things happening at the same time doesn’t mean one caused the other. The timeline shows what happened, not why.</Caution>
      <SegmentedToggle label="Events to show" value={show} options={[['all', 'All events'], ['policy', 'Laws and policy'], ['satellite', 'Satellites']]} onChange={setShow} />
      <Loading state={harm} skeleton={<SkeletonCard label="Loading timeline" shape="table" />}>{(h) => {
        const evs: Ev[] = [...(events.data?.policy ?? []).map((e) => ({ ...e, kind: 'policy' as const })), ...(events.data?.satellite ?? []).map((e) => ({ ...e, kind: 'satellite' as const }))]
          .filter((e) => show === 'all' || e.kind === show)
        const fire = new Map(h.yearly.map((y) => [y.season, y.h.p50]))
        const kiln = new Map((ka?.national?.seasons ?? []).filter((r: KilnSeasonRow) => r.duration).map((r) => [r.season, r.duration!.p50]))
        const evSeasons = evs.map((e) => seasonOf(new Date(e.date + 'T00:00:00Z')))
        const first = [h.yearly[0].season, ...evSeasons].sort()[0]
        const lastSeason = [h.yearly.at(-1)!.season, ...evSeasons].sort().at(-1)!
        const rows: string[] = []
        for (let s = first, k = 0; s <= lastSeason && k < 60; s = nextSeason(s, 1), k++) rows.push(s)
        const fmax = Math.max(...fire.values())
        const val = (m: Map<string, number>, s: string, d = 0) => (m.has(s) ? m.get(s)!.toFixed(d) : '–')
        return (
          <ol className="divide-y divide-line border-y border-line">
            {rows.map((s) => {
              const here = evs.filter((e) => seasonOf(new Date(e.date + 'T00:00:00Z')) === s)
              const f = fire.get(s), kd = kiln.get(s)
              return (
                <li key={s} className="grid gap-x-4 gap-y-2 py-2.5 sm:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1.2fr)] sm:items-start">
                  <span className="num font-semibold">{s}</span>
                  <div className="space-y-1" aria-label={`${s}: fire activity ${f != null ? f.toFixed(1) : 'not available'}; kiln season ${kd != null ? `${Math.round(kd)} days` : 'not measured'}`}>
                    <div className="flex items-center gap-2 text-xs"><span className="h-2.5 rounded-full bg-heat" style={{ width: f != null ? `${(f / fmax) * 80}%` : 0 }} />
                      <span className="num text-muted">{f != null ? `fire ${f.toFixed(1)}` : s > h.yearly.at(-1)!.season ? 'future' : ''}</span></div>
                    <div className="flex items-center gap-2 text-xs"><span className="h-2.5 rounded-full bg-brick" style={{ width: kd != null ? `${(kd / 200) * 80}%` : 0 }} />
                      <span className="num text-muted">{kd != null ? `kilns ${Math.round(kd)} days` : ''}</span></div>
                  </div>
                  <div className="space-y-1.5">
                    {here.map((e) => (
                      <details key={e.date + e.label_en} className="rounded-[6px] border border-line bg-surface open:shadow-sm">
                        <summary className="flex cursor-pointer items-start gap-2 px-2.5 py-1.5 text-sm">
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.kind === 'policy' ? 'bg-brick' : 'bg-orbit'}`} aria-hidden />
                          <span><span className="num text-muted">{fmtDate(e.date)}</span> · {e.label_en}</span>
                        </summary>
                        <div className="space-y-1.5 border-t border-line px-2.5 py-2 text-sm">
                          <p className="text-muted">{e.kind === 'policy' ? 'Law or policy' : 'Satellite milestone'}.
                            {' '}Season before ({nextSeason(s, -1)}) → season after ({nextSeason(s, 1)}): fire {val(fire, nextSeason(s, -1), 1)} → {val(fire, nextSeason(s, 1), 1)}
                            {kiln.size ? <>; kiln season {val(kiln, nextSeason(s, -1))} → {val(kiln, nextSeason(s, 1))} days</> : null}.</p>
                          <a className="text-orbit underline" href={e.url} target="_blank" rel="noreferrer">Source</a>
                        </div>
                      </details>))}
                  </div>
                </li>)
            })}
          </ol>)
      }}</Loading>
      <Caution>Fire figures are season totals of satellite fire activity per cloud-free area, on one scale for all cameras; kiln season lengths come from NASA night lights. Both are for the whole country.</Caution>
      <div className="flex flex-wrap gap-2"><TryLink to="/kilns">Kiln seasons by area</TryLink><TryLink to="/sensors">Why the satellites needed correcting</TryLink></div>
    </div>
  )
}
