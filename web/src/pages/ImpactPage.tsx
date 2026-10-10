import { useMemo, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Icon, Skeleton, useKilnActivity, useTitle } from '../components/ui'
import { Caution, Flow, Gloss, MonthStrip, Other, PageHead, TryLink, useQ, windowLevels } from '../components/plain'
import { seasonMean } from '../lib/calendar'
import { useJson } from '../lib/data'
import { useLang, useT } from '../lib/i18n'
import { busyMonths, daysText, meanDuration, MONTHS, monthOfSeasonDay, SEASON_MONTHS, typicalSeason, whenText } from '../lib/plain'
import type { Calendar, Events, FC, Harmonization, NrtSeason } from '../lib/types'

const SRC = {
  doe: ['Prothom Alo, reporting a Department of Environment notice (2019)', 'https://en.prothomalo.com/environment/Brick-kilns-blamed-for-58pc-air-pollution-in'],
  wb: ['World Bank, Breathing Heavy (2022)', 'https://www.worldbank.org/en/news/press-release/2022/12/03/high-air-pollution-level-is-creating-physical-and-mental-health-hazards-in-bangladesh-world-bank'],
  block: ['Dhaka Tribune, green bricks policy', 'https://www.dhakatribune.com/bangladesh/328956'],
  workers: ['Prothom Alo op-ed on brick kilns', 'https://en.prothomalo.com/opinion/op-ed/dgv7rqo0mh'],
  modis: ['NASA Earthdata, transition from MODIS to VIIRS', 'https://www.earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs'],
  belt: ['University of Nottingham Rights Lab', 'https://www.nottingham.ac.uk/news/pressreleases/2018/march/using-satellite-images-to-tackle-modern-slavery-across-south-asia\'s-\'brick-belt\'.aspx'],
} as const
const DEFAULT_AREA = 'BD3026' // Dhaka

/** Everything a playbook says about one district, from the real export. */
interface Facts {
  id: string; name: string
  fire: ReturnType<typeof busyMonths>
  kiln: ReturnType<typeof typicalSeason>
  early: number | null; late: number | null
  unusual: number | null; season?: string
  harvest: string[]
  seamPct: number | null; repl: string | null; agree: string | null
  passedAbroad: string[]; failedAbroad: string[]   // Amendment 2: night-light kiln test, local calendar (LL)
}

interface Persona {
  id: string; who: string; benefit: string; area: boolean
  question: (f: Facts) => ReactNode
  tool: (f: Facts) => [to: string, label: string]
  shows: (f: Facts) => ReactNode
  actions: (f: Facts) => ReactNode[]
  outcome: string
  other?: [text: ReactNode, src: string, href: string]
  limit: ReactNode | ((f: Facts) => ReactNode)
}

const m = (i: number) => SEASON_MONTHS[(i + 12) % 12]
/** "A", "A and B", "A, B and C". */
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
const span = (a: string, b: string) => (a === b ? `in ${a}` : `${a} to ${b}`)
const kilnMonths = (f: Facts) => f.kiln && span(monthOfSeasonDay(f.kiln.onset), monthOfSeasonDay(f.kiln.end))
const fireMonths = (f: Facts) => f.fire && span(m(f.fire.first), m(f.fire.last))
const noKiln = (f: Facts) => <>{f.name} has fewer than five mapped <Gloss k="cluster">kiln clusters</Gloss>, too few to measure a kiln season. Try a neighbouring district.</>
const trend = (f: Facts) => f.early != null && f.late != null
  ? <> The kiln season here lasted {daysText(f.early)} in 2012–15 and {daysText(f.late)} in 2022–25.</> : null
const unusualText = (f: Facts) => f.unusual == null ? 'No live data for this district today.'
  : f.unusual ? `${f.unusual} unusual ${f.unusual === 1 ? 'day' : 'days'} so far this season (${f.season}).` : `Normal so far this season (${f.season}): no unusual days.`

const PERSONAS: Persona[] = [
  {
    id: 'farm', who: 'Farmers and agriculture officers', benefit: 'Offer alternatives to burning before it starts', area: true,
    question: (f) => `When do people burn crop leftovers in ${f.name}, so we can offer alternatives in time?`,
    tool: (f) => [`/area/${f.id}`, 'My area'],
    shows: (f) => <>
      {f.fire ? <p>Fire season here is usually <b>{fireMonths(f)}</b>, busiest in <b>{m(f.fire.peak)}</b>.</p> : <p>Very little fire has been recorded here since 2003.</p>}
      {f.harvest.length > 0 && <p className="text-sm text-muted">Rice harvests: {f.harvest.join('; ')}.</p>}
    </>,
    actions: (f) => f.fire ? [
      <>Start the straw and stubble campaign in <b>{m(f.fire.first - 1)}</b>, one month before burning usually begins.</>,
      <>Line up straw buyers, composting or mushroom-growing groups before <b>{m(f.fire.peak)}</b>, the busiest burning month.</>,
      <>From 1 November, check the <b>two-week outlook</b> on My area each week, and send field staff first where it is above the usual chance.</>,
      <>After the season, check whether burning fell below this area’s <Gloss k="normal">normal range</Gloss>.</>,
    ] : [<>Burning is rare here: focus campaigns on the busier districts shown on the My area map.</>],
    outcome: 'Advice arrives before the fields are burned, not after.',
    limit: <>Fire counts include all open burning seen from space, not only crop leftovers.</>,
  },
  {
    id: 'families', who: 'Families, schools and health workers', benefit: 'Prepare for burning season, not be surprised by it', area: true,
    question: (f) => `Which months bring burning season to ${f.name}, and is this year worse than usual?`,
    tool: (f) => [`/area/${f.id}`, 'My area'],
    shows: (f) => <>
      {f.fire && <p>Fires usually burn <b>{fireMonths(f)}</b>.{f.kiln && <> Brick kilns usually work <b>{kilnMonths(f)}</b>.</>}</p>}
      <p><b>{unusualText(f)}</b></p>
    </>,
    actions: (f) => [
      <>Mark burning season on the school or clinic calendar{f.fire && <>: fires <b>{fireMonths(f)}</b></>}{f.kiln && <>, kilns <b>{kilnMonths(f)}</b></>}.</>,
      <>In those months, check an official air-quality reading before sports days and outdoor events, and keep inhalers ready for children with asthma.</>,
      <>If this season shows unusual days, or the two-week outlook on My area is above the usual chance, share this page’s link in the parents’ or community group.</>,
    ],
    outcome: 'Families and clinics plan around burning season with dates, not rumours.',
    other: [<>Air pollution caused an estimated <b>78,000 to 88,000 deaths</b> in Bangladesh in 2019 and cost about <b>4% of GDP</b>.</>, ...SRC.wb],
    limit: <>This is not an air-quality forecast. In our test, burning did not predict Dhaka’s daily PM2.5 readings.</>,
  },
  {
    id: 'science', who: 'Scientists and other countries', benefit: 'Keep fire records alive after MODIS retires', area: false,
    question: () => 'How do we keep 20-year fire records going after MODIS retires, and find kilns that fire satellites can’t see?',
    tool: () => ['/sensors', 'Sensor switch'],
    shows: (f) => <p>{f.seamPct != null && <>Our correction removed <b>{f.seamPct}%</b> of the false 2012 jump. </>}{f.agree && <>In later years it was never fitted on, corrected VIIRS read <b>{f.agree}</b> Aqua MODIS. </>}{f.repl && <>The night-light kiln test passed in <b>{f.repl}</b> seasons, and found nothing on ordinary farmland, as it should.</>}{f.passedAbroad.length > 0 && <> Repeated with the same rules, it also passed in <b>{list(f.passedAbroad)}</b>.</>}{f.failedAbroad.length > 0 && <> It did not pass in <b>{list(f.failedAbroad)}</b>.</>}</p>,
    actions: () => [
      <>Download the research data (CSV + Parquet, CC BY 4.0) from the For experts page and extend the record with your own analysis.</>,
      <>Reuse the open code to bridge MODIS to VIIRS for your own country before MODIS stops in 2027, and to carry the record on NOAA-20 when Suomi NPP stops on 2 November 2026.</>,
      <>Run the night-light kiln calendar with free NASA Black Marble data in another brick-belt country: learn its kiln calendar from one in five of its kiln clusters first, then test on the rest.</>,
      <>Copy the pre-registration: write the tests down before you look at the data.</>,
    ],
    outcome: 'Long fire records stay comparable across the camera change, with an open method any team can rerun for its own region.',
    other: [<>NASA plans to end data collection from Terra MODIS in <b>January 2027</b> and from Aqua MODIS around <b>September 2027</b>.</>, ...SRC.modis],
    limit: (f) => <>The night-light kiln method is tested in {list(['Bangladesh', ...f.passedAbroad, ...f.failedAbroad])} only; we make no claim for other countries. The older fire-satellite kiln test in Faisalabad, Pakistan, failed, as it did in Bangladesh.</>,
  },
  {
    id: 'journalist', who: 'Journalists and students', benefit: 'Check a claim in minutes, with a source', area: true,
    question: (f) => `Is burning in ${f.name} really worse this year? Do kilns run longer than they used to?`,
    tool: (f) => [`/area/${f.id}`, 'My area'],
    shows: (f) => <><p><b>{unusualText(f)}</b></p>{trend(f) && <p>{trend(f)}</p>}</>,
    actions: () => [
      <>Quote the number in plain words and link to the exact page: every area has its own address.</>,
      <>Download the area’s data file and check it yourself, or hand it to a data desk.</>,
      <>Read <b>Can you trust it?</b> before publishing: it lists the tests that failed, too.</>,
      <>Never write that a named kiln broke the law. The data cannot show that.</>,
    ],
    outcome: 'Stories about smog and kilns rest on 23 years of checked NASA data, not on one bad week.',
    limit: <>Things happening at the same time doesn’t mean one caused the other.</>,
  },
  {
    id: 'inspector', who: 'Environment inspectors', benefit: 'Visit kilns when they are actually working', area: true,
    question: (f) => `When should our team visit brick kilns in ${f.name} to find them working?`,
    tool: (f) => [`/kilns/${f.id}`, 'Kiln planner'],
    shows: (f) => f.kiln ? <>
      <p>Kilns in {f.name} usually work from <b>{whenText(f.kiln.onset)}</b> to <b>{whenText(f.kiln.end)}</b>{f.kiln.peak != null && <>, busiest in <b>{monthOfSeasonDay(f.kiln.peak)}</b></>}.{trend(f)}</p>
      <MonthStrip level={windowLevels(f.kiln.onset, f.kiln.end, f.kiln.peak)} label={`Months when kilns in ${f.name} usually work`} />
    </> : <p>{noKiln(f)}</p>,
    actions: (f) => f.kiln ? [
      <>Put the main inspection round in <b>{f.kiln.peak != null ? monthOfSeasonDay(f.kiln.peak) : monthOfSeasonDay(f.kiln.onset)}</b>, when the most kilns are firing, so each trip is more likely to find one working.</>,
      <>Do a first sweep in <b>{monthOfSeasonDay(f.kiln.onset)}</b> to see which kilns start early.</>,
      <>Send a follow-up in <b>{monthOfSeasonDay(f.kiln.end)}</b>: kilns still working as the season ends are worth a look.</>,
      <>Next year, compare the season length here with this year’s. A shorter season after an enforcement drive is a sign it worked.</>,
    ] : [<>Open the kiln planner and pick the nearest district with a measured season.</>, <>Use the national season as a fallback for planning.</>],
    outcome: 'Fewer wasted trips. Inspectors arrive when kilns are running, instead of guessing.',
    other: [<>The Department of Environment has said brick kilns produce about <b>58%</b> of the particle pollution in Dhaka’s winter smog.</>, ...SRC.doe],
    limit: <>It tells you <i>when</i> to look, for a whole district. It never points at a single kiln or says one broke the law.</>,
  },
  {
    id: 'policy', who: 'Policy makers and planners', benefit: 'A yearly, independent check on kiln policy', area: true,
    question: (f) => `Is kiln policy changing what happens on the ground in ${f.name}?`,
    tool: () => ['/timeline', 'Timeline'],
    shows: (f) => f.kiln ? <p>{trend(f) ?? <>Kilns here usually work {kilnMonths(f)}.</>}</p> : <p>{noKiln(f)}</p>,
    actions: () => [
      <>Use kiln-season length as a yearly progress number for the plan to replace fired bricks with concrete blocks.</>,
      <>Rank districts by fastest-growing kiln season in the Kiln planner, and send enforcement money there first.</>,
      <>Line laws and deadlines up against the season record on the Timeline before saying a policy worked.</>,
    ],
    outcome: 'A free progress check every year, from satellite data that already exists.',
    other: [<>In 2019 the government set a target of concrete blocks instead of fired bricks in <b>100%</b> of government works by 2024-25. The deadline has since moved to <b>2028-29</b>.</>, ...SRC.block],
    limit: <>The record shows what happened, not why. Before-and-after comparisons are descriptive.</>,
  }
]

/** Who benefits: pick a person and a district, get their real question, what Kiln Watch shows, and what they do next. */
export default function ImpactPage() {
  const { who, unitId } = useParams()
  const nav = useNavigate()
  const q = useQ()
  const t = useT()
  const lang = useLang()
  const persona = PERSONAS.find((p) => p.id === who) ?? PERSONAS[0]
  const id = unitId ?? DEFAULT_AREA
  useTitle(`Who benefits · ${persona.who}`)
  const dists = useJson<FC>('aoi/districts.geojson')
  const options = useMemo(() => (dists.data?.features ?? []).map((f) => f.properties).sort((a, b) => a.name_en.localeCompare(b.name_en)), [dists.data])
  const go = (p: string, a: string) => nav(`/impact/${p}/${a}${q}`, { replace: true })
  const facts = useFacts(id, options.find((o) => o.unit_id === id)?.name_en ?? id)

  return (
    <div className="space-y-10">
      {lang === 'bn' && <p className="text-sm text-muted" lang="bn">{t('englishOnly')}</p>}
      <PageHead title="Who benefits, and exactly how">
        Pick a person and a district. You’ll see the question they really have, what NASA’s data answers for that place, and the steps they can take this season.
      </PageHead>
      <Flow items={[['NASA satellites', 'see fire and night lights'], ['Kiln Watch', 'puts every camera on one scale'], ['An answer', 'for one district'], ['A decision', 'with dates'], ['A benefit', 'for people there']]} />

      <section aria-label="Choose a person" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PERSONAS.map((p) => (
          <button key={p.id} type="button" aria-pressed={p.id === persona.id} onClick={() => go(p.id, id)}
            className="panel text-left transition-colors hover:bg-surface-2 aria-pressed:border-ink aria-pressed:bg-surface-2">
            <b className="block">{p.who}</b><span className="text-sm text-muted">{p.benefit}</span>
          </button>))}
      </section>

      <article className="panel space-y-6 print:border-0" aria-label={`Plan for ${persona.who}`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="h-display text-[clamp(1.5rem,3vw,2rem)]">{persona.who}{persona.area && <> in {facts?.name ?? '…'}</>}</h2>
          {persona.area && <label className="text-sm font-semibold print:hidden">District
            <select className="field ml-2 font-normal" value={id} onChange={(e) => go(persona.id, e.target.value)}>
              {options.map((o) => <option key={o.unit_id} value={o.unit_id}>{o.name_en}</option>)}
            </select></label>}
        </div>
        {!facts ? <Skeleton className="h-64 w-full" /> : <Playbook p={persona} f={facts} />}
      </article>

      <p className="text-sm text-muted">Facts marked “From other studies” come from the linked sources, not from our data. Everything else is computed live from the real NASA data on this site.</p>
    </div>
  )
}

function Playbook({ p, f }: { p: Persona; f: Facts }) {
  const [to, label] = p.tool(f)
  return (
    <>
      <ol className="grid gap-4 lg:grid-cols-[1fr_1fr_1.4fr]">
        <li className="space-y-2"><span className="tag">1 · Their question</span><p className="text-lg font-semibold leading-snug">“{p.question(f)}”</p></li>
        <li className="space-y-2"><span className="tag">2 · What Kiln Watch shows</span><div className="ours space-y-2">{p.shows(f)}</div>
          <TryLink to={to} primary>Open {label}</TryLink></li>
        <li className="space-y-2"><span className="tag">3 · What they do next</span>
          <ul className="space-y-2">{p.actions(f).map((a, i) => (
            <li key={i} className="flex gap-2"><Icon name="check" className="mt-1 h-4 w-4 text-ok" /><span>{a}</span></li>))}</ul></li>
      </ol>
      <div className="grid gap-4 border-t border-line pt-4 md:grid-cols-2">
        <div className="space-y-2"><span className="tag">The benefit</span><p className="text-lg">{p.outcome}</p><Caution>{typeof p.limit === 'function' ? p.limit(f) : p.limit}</Caution></div>
        {p.other && <Other src={p.other[1]} href={p.other[2]}>{p.other[0]}</Other>}
      </div>
      <div className="flex flex-wrap gap-2 print:hidden">
        <button className="btn" onClick={() => print()}><Icon name="download" />Print or save this plan</button>
        <button className="btn" onClick={() => navigator.clipboard?.writeText(location.href)}><Icon name="chevron" />Copy link to this plan</button>
      </div>
    </>
  )
}

function useFacts(id: string, name: string): Facts | null {
  const cal = useJson<Calendar>(`calendar/${id}.json`)
  const nrt = useJson<NrtSeason>('nrt/current_season.json').data
  const events = useJson<Events>('events.json').data
  const harm = useJson<Harmonization>('harmonization.json').data
  const ka = useKilnActivity().data
  const fire = useMemo(() => (cal.data ? busyMonths(seasonMean(cal.data)) : null), [cal.data])
  if (!cal.data && !cal.error) return null
  const area = ka?.areas?.[id]
  const rep = ka?.tests.find((r) => r.test === 'GL' && r.criterion.startsWith('Replication'))
  const abroad = (ka?.transfer?.countries ?? []).filter((c) => c.code !== 'BD' && c.evaluable !== false)
  const repN = Number(rep?.criterion.match(/\((\d+) evaluable\)/)?.[1] ?? NaN)
  const mon = (doy: number) => MONTHS[new Date(Date.UTC(2001, 0, doy)).getUTCMonth()]
  return {
    id, name, fire,
    kiln: area ? typicalSeason(area.seasons) : null,
    early: area ? meanDuration(area.seasons, '2012-13', '2014-15') : null,
    late: area ? meanDuration(area.seasons, '2022-23', '2024-25') : null,
    unusual: nrt?.districts[id]?.above_p90_days ?? null, season: nrt?.season,
    harvest: (events?.harvest ?? []).map((h) => `${h.crop === 'aman' ? 'Aman' : h.crop === 'boro' ? 'Boro' : h.crop} in ${mon(h.start_doy)}–${mon(h.end_doy)}`),
    seamPct: harm ? Math.round((1 - harm.seam.ratio) * 100) : null,
    agree: ((o) => (o ? `${o.ratio_harm.p50.toFixed(2)}×` : null))(harm?.overlap?.find((x) => x.period === 'held_out')),
    passedAbroad: abroad.filter((c) => c.channels.ntl?.pass.LL).map((c) => c.name),
    failedAbroad: abroad.filter((c) => c.channels.ntl?.pass.LL === false).map((c) => c.name),
    repl: rep?.value != null && Number.isFinite(repN) ? `${Math.round(rep.value * repN)} of ${repN}` : null,
  }
}

