import { Link } from 'react-router'
import { Icon, Loading, Skeleton, Sparkline, useKilnActivity, useTitle } from '../components/ui'
import { Flow, Gloss, Ours, TryLink, useQ } from '../components/plain'
import Ledger from '../components/Ledger'
import { useMemo } from 'react'
import { useJson } from '../lib/data'
import { useLang, useT } from '../lib/i18n'
import { busyMonths, meanDuration, SEASON_MONTHS, typicalSeason, whenText, monthOfSeasonDay } from '../lib/plain'
import { seasonMean } from '../lib/calendar'
import type { Calendar, Events, FC, Harmonization, NrtSeason } from '../lib/types'

export default function HomePage() {
  useTitle()
  const t = useT()
  const lang = useLang()
  const q = useQ()
  const harm = useJson<Harmonization>('harmonization.json')
  const nrt = useJson<NrtSeason>('nrt/current_season.json')
  const dists = useJson<FC>('aoi/districts.geojson')
  const events = useJson<Events>('events.json')
  const ka = useKilnActivity().data
  const top = Object.entries(nrt.data?.districts ?? {}).sort((a, b) => b[1].h.reduce((s, v) => s + v, 0) - a[1].h.reduce((s, v) => s + v, 0))[0]?.[0]
  const cal = useJson<Calendar>(top ? `calendar/${top}.json` : null)
  const name = (id?: string) => dists.data?.features.find((f) => f.properties.unit_id === id)?.properties.name_en ?? id
  const unusual = Object.entries(nrt.data?.districts ?? {}).filter(([, d]) => d.above_p90_days > 0).sort((a, b) => b[1].above_p90_days - a[1].above_p90_days)
  const rows = ka?.national?.seasons ?? []
  const typ = typicalSeason(rows)
  const early = meanDuration(rows, '2012-13', '2014-15'), late = meanDuration(rows, '2022-23', '2024-25')
  const prev = ka?.tests.find((r) => r.test === 'GL' && r.criterion.startsWith('Prevalence'))?.value
  const fire = useMemo(() => (cal.data ? busyMonths(seasonMean(cal.data)) : null), [cal.data])

  return (
    <div className="space-y-20">
      {lang === 'bn' && <p className="text-sm text-muted" lang="bn">{t('englishOnly')}</p>}
      <header className="space-y-6">
        <div className="hero-ground space-y-5">
          <h1 className="h-display max-w-[20ch] text-[clamp(2.5rem,7vw,4.75rem)]">NASA satellites have watched Bangladesh burn for 23 years. We made their records agree.</h1>
          <p className="prose-measure text-lg text-muted">Every winter, farmers burn crop leftovers and thousands of brick kilns fire up. Satellites have photographed it
            since 2003, but their cameras changed over the years, so their records don’t line up. Kiln Watch fixes that, and shows what it means for <b className="text-ink">your area</b>.</p>
          <div className="flex flex-wrap gap-2">
            <TryLink to="/area" primary>Check my area</TryLink>
            <TryLink to="/how">See how it works</TryLink>
          </div>
        </div>
        <Loading state={cal} skeleton={<Skeleton className="h-[290px] w-full" />}>{(c) =>
          <Ledger cal={c} events={events.data} caption={`Every day since 2003 in ${name(top)}, the district with the most fire this season. Each row is a year; darker means more fire.`} />}</Loading>
      </header>

      <section aria-label="How it works" className="space-y-5">
        <h2 className="h-display text-[clamp(1.9rem,4vw,2.6rem)]">From space to your district, in six steps</h2>
        <Flow items={[['Satellites watch', 'five NASA/NOAA cameras'], ['They spot heat', 'hot pixels, day and night'], ['One scale', 'old and new cameras agree'],
          ['Find the kilns', 'night lights, not fire'], ['A calendar', 'for every area'], ['People act', 'with dates, not guesses']]} />
        <TryLink to="/how">Walk through the six steps with real data</TryLink>
      </section>

      <section aria-label="Three findings" className="space-y-6">
        <h2 className="h-display text-[clamp(1.9rem,4vw,2.6rem)]">Three things we found</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <Loading state={harm}>{(h) => (
            <article className="panel flex flex-col gap-3">
              <span className="big-num text-heat">{Math.round((1 - h.seam.ratio) * 100)}%</span>
              <h3 className="text-lg font-semibold leading-snug">of the 2012 “fire explosion” was a camera change, not more fire.</h3>
              <p className="text-sm text-muted">When the sharper <Gloss k="VIIRS" /> camera arrived, fire counts jumped. We <Gloss k="harmonize">converted</Gloss> every camera to one scale and the jump disappeared.</p>
              <div className="flex items-end gap-4 text-xs text-muted">
                <span>Raw<Sparkline values={h.yearly.map((y) => y.raw_sum)} stroke="var(--color-raw)" /></span>
                <span>Corrected<Sparkline values={h.yearly.map((y) => y.h.p50)} /></span>
              </div>
              <div className="mt-auto"><TryLink to="/sensors">Try the sensor switch</TryLink></div>
            </article>)}</Loading>
          <article className="panel flex flex-col gap-3">
            <span className="big-num text-brick">{prev != null ? `${Math.round(prev * 100)}%` : '–'}</span>
            <h3 className="text-lg font-semibold leading-snug">of brick-kiln clusters glow brighter at night in kiln season than nearby farmland, though fire satellites can’t see them.</h3>
            <p className="text-sm text-muted">Kilns burn inside closed brick chambers, so fire cameras miss them. But they work all night with lamps on, and NASA’s <Gloss k="nightLights" /> pick that up.</p>
            {typ && <p className="text-sm">Kiln season: <b>{whenText(typ.onset)}</b> to <b>{whenText(typ.end)}</b>{typ.peak != null && <>, busiest in <b>{monthOfSeasonDay(typ.peak)}</b></>}.</p>}
            <div className="mt-auto"><TryLink to="/kilns">Open the kiln planner</TryLink></div>
          </article>
          <article className="panel flex flex-col gap-3">
            <span className="big-num text-ink">{early != null && late != null ? `${Math.round(early / 30.44)} → ${Math.round(late / 30.44)}` : '–'}<span className="ml-2 text-2xl">months</span></span>
            <h3 className="text-lg font-semibold leading-snug">The kiln season has grown longer, not shorter.</h3>
            {early != null && late != null && <div className="space-y-1.5 text-sm" aria-label={`About ${Math.round(early)} days in 2012 to 2015, about ${Math.round(late)} days in 2022 to 2025`}>
              {[['2012–15', early], ['2022–25', late]].map(([l, v]) => (
                <div key={l as string} className="flex items-center gap-2"><span className="num w-16 text-muted">{l}</span>
                  <span className="h-3 rounded-full bg-brick" style={{ width: `${((v as number) / 200) * 60}%` }} /><span className="num">{Math.round(v as number)} days</span></div>))}
            </div>}
            <p className="text-sm text-muted">Even after a 2019 plan to switch government building to concrete blocks.</p>
            <div className="mt-auto"><TryLink to="/timeline">See the timeline</TryLink></div>
          </article>
        </div>
      </section>

      <section className="grid gap-8 border-t border-line pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-3">
          <h2 className="h-display text-[clamp(1.9rem,4vw,2.6rem)]">Right now</h2>
          <p className="prose-measure text-muted">Updated every day from NASA’s near-real-time fire data. This season started on 1 July.</p>
          <Loading state={nrt}>{(n) => (
            <Ours>{unusual.length
              ? <><b>{unusual.length}</b> of {Object.keys(n.districts).length} districts have had at least one <Gloss k="unusual">unusual day</Gloss> this season.</>
              : <>No district has had an <Gloss k="unusual">unusual day</Gloss> yet this season.</>}</Ours>)}</Loading>
          <TryLink to="/area" primary>Check my area</TryLink>
        </div>
        {unusual.length > 0 && <div className="panel">
          <h3 className="h-section mb-2">Most unusual days this season</h3>
          <ol className="divide-y divide-line">
            {unusual.slice(0, 5).map(([id, d]) => (
              <li key={id}><Link to={`/area/${id}${q}`} className="grid grid-cols-[minmax(0,8rem)_1fr_4.5rem_1rem] items-center gap-3 rounded-[4px] px-1 py-2.5 hover:bg-surface-2">
                <span className="truncate font-medium">{name(id)}</span>
                <span className="h-1.5 rounded-full bg-surface-2"><span className="block h-1.5 rounded-full bg-heat" style={{ width: `${(d.above_p90_days / unusual[0][1].above_p90_days) * 100}%` }} /></span>
                <span className="num text-right text-sm">{d.above_p90_days} days</span>
                <Icon name="chevron" className="h-4 w-4 text-muted" />
              </Link></li>))}
          </ol>
        </div>}
      </section>

      <section className="space-y-5 border-t border-line pt-10" aria-label="What people do with it">
        <h2 className="h-display text-[clamp(1.9rem,4vw,2.6rem)]">What people do with it</h2>
        <p className="prose-measure text-muted">Real questions, answered with real NASA data, turned into a step someone can take this season.</p>
        <ul className="grid gap-4 md:grid-cols-2">
          {([
            ['inspector', 'Environment inspector', 'When should we inspect kilns?',
              typ ? <>Kilns work {whenText(typ.onset)} to {whenText(typ.end)}{typ.peak != null && <>, busiest in {monthOfSeasonDay(typ.peak)}</>}.</> : null,
              typ?.peak != null ? <>Put the main inspection round in {monthOfSeasonDay(typ.peak)}.</> : <>Time visits to the kiln season.</>],
            ['farm', 'Agriculture officer', `When do fields burn in ${name(top) ?? 'my district'}?`,
              fire ? <>Usually {SEASON_MONTHS[fire.first]} to {SEASON_MONTHS[fire.last]}, busiest in {SEASON_MONTHS[fire.peak]}.</> : null,
              fire ? <>Start the straw campaign in {SEASON_MONTHS[(fire.first + 11) % 12]}, a month before burning begins.</> : <>Start campaigns before burning begins.</>],
            ['families', 'Parent or school', 'Is this a bad burning year here?',
              nrt.data ? <>{unusual.length} of {Object.keys(nrt.data.districts).length} districts have had unusual days this season.</> : null,
              <>Look up your district and mark its burning months on the school calendar.</>],
            ['policy', 'Policy maker', 'Is kiln policy working?',
              early != null && late != null ? <>The kiln season grew from about {Math.round(early / 30.44)} to about {Math.round(late / 30.44)} months.</> : null,
              <>Track kiln-season length every year as a progress number.</>],
          ] as const).map(([id, who, qn, ans, act]) => (
            <li key={id}><Link to={`/impact/${id}${top ? `/${top}` : ''}${q}`} className="panel group grid h-full gap-2 hover:bg-surface-2">
              <span className="flex items-center justify-between"><span className="tag">{who}</span><Icon name="chevron" className="h-4 w-4 text-muted group-hover:text-ink" /></span>
              <b className="text-lg leading-snug">“{qn}”</b>
              {ans && <span className="ours text-sm"><span className="tag">Kiln Watch shows</span><span className="block">{ans}</span></span>}
              <span className="flex gap-2 text-sm"><Icon name="check" className="mt-0.5 h-4 w-4 text-ok" /><span><b>Action:</b> {act}</span></span>
            </Link></li>))}
        </ul>
        <TryLink to="/impact" primary>Build a plan for your role and district</TryLink>
      </section>

      <section className="space-y-5 border-t border-line pt-10" aria-label="For judges">
        <h2 className="h-display text-[clamp(1.9rem,4vw,2.6rem)]">Four questions judges ask</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ['Impact', 'Does it help many people?', 'Air pollution killed an estimated 78,000 to 88,000 people in Bangladesh in 2019 (World Bank). Kiln Watch gives inspectors, farm officers, families and planners in all 64 districts dates to act on.', '/impact', 'Who benefits'],
            ['Creativity', 'Is the approach new?', `Fire satellites can’t see brick kilns, so we found them with NASA night lights instead, after testing ${ka?.pilots.length ?? 'several'} space instruments.`, '/how', 'How it works'],
            ['Validity', 'Is the science sound?', 'Tests written before the analysis, every result published, including the failures. The kiln method was retested in Pakistan, India and Afghanistan. Open code and data.', '/trust', 'Can you trust it?'],
            ['Relevance', 'Does it answer the challenge?', 'A harmonized MODIS + VIIRS burning calendar for any area, with history, unusual days and early warning.', '/how', 'Challenge checklist'],
          ] as const).map(([k, qn, a, to, l]) => (
            <li key={k} className="panel flex flex-col gap-2"><span className="tag">{k}</span><b className="leading-snug">{qn}</b><span className="text-sm text-muted">{a}</span>
              <div className="mt-auto pt-1"><TryLink to={to}>{l}</TryLink></div></li>))}
        </ul>
      </section>

      <p className="border-t border-line pt-6 text-sm text-muted">Everything on this site comes from real NASA and European satellite data, processed by our open-source pipeline.
        The full science, including the tests that failed, is in <Link className="text-orbit underline" to={'/experts' + q}>For experts</Link>.</p>
    </div>
  )
}
