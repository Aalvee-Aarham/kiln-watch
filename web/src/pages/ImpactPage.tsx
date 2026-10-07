import type { ReactNode } from 'react'
import { useKilnActivity, useTitle } from '../components/ui'
import { Caution, Gloss, Other, Ours, PageHead, TryLink } from '../components/plain'
import { useJson } from '../lib/data'
import { useLang, useT } from '../lib/i18n'
import { daysText, meanDuration, monthOfSeasonDay, typicalSeason, whenText } from '../lib/plain'
import type { Harmonization, Validation } from '../lib/types'

const SRC = {
  doe: ['Prothom Alo, reporting a Department of Environment notice (2019)', 'https://en.prothomalo.com/environment/Brick-kilns-blamed-for-58pc-air-pollution-in'],
  wb: ['World Bank, Breathing Heavy (2022)', 'https://www.worldbank.org/en/news/press-release/2022/12/03/high-air-pollution-level-is-creating-physical-and-mental-health-hazards-in-bangladesh-world-bank'],
  block: ['Dhaka Tribune, green bricks policy', 'https://www.dhakatribune.com/bangladesh/328956'],
  mongabay: ['Mongabay (Jan 2026)', 'https://news.mongabay.com/2026/01/brickmaking-keeps-eating-farmland-as-bangladesh-misses-clean-build-goal/'],
  workers: ['Prothom Alo op-ed on brick kilns', 'https://en.prothomalo.com/opinion/op-ed/dgv7rqo0mh'],
  modis: ['NASA Earthdata, transition from MODIS to VIIRS', 'https://www.earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs'],
  belt: ['University of Nottingham Rights Lab', 'https://www.nottingham.ac.uk/news/pressreleases/2018/march/using-satellite-images-to-tackle-modern-slavery-across-south-asia\'s-\'brick-belt\'.aspx'],
} as const

function Card({ who, does, ours, other, cta }: { who: string; does: ReactNode; ours: ReactNode; other?: ReactNode; cta: ReactNode }) {
  return (
    <article className="panel flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{who}</h2>
      <p>{does}</p>
      <Ours>{ours}</Ours>
      {other}
      <div className="mt-auto pt-1">{cta}</div>
    </article>
  )
}

/** Who benefits: each use pairs our real finding with a labelled, linked fact from other studies. */
export default function ImpactPage() {
  useTitle('Who benefits')
  const t = useT()
  const lang = useLang()
  const ka = useKilnActivity().data
  const harm = useJson<Harmonization>('harmonization.json').data
  const val = useJson<Validation>('validation.json').data
  const nat = ka?.national?.seasons ?? []
  const typ = typicalSeason(nat)
  const early = meanDuration(nat, '2012-13', '2014-15'), late = meanDuration(nat, '2022-23', '2024-25')
  const nAreas = Object.keys(ka?.areas ?? {}).length
  const rep = ka?.tests.find((r) => r.test === 'GL' && r.criterion.startsWith('Replication'))
  const repN = Number(rep?.criterion.match(/\((\d+) evaluable\)/)?.[1] ?? NaN)
  const rs = (val?.pm25 ?? []).flatMap((x) => [x.r_kiln.p50, x.r_veg.p50])
  const sv = ka?.contamination

  return (
    <div className="space-y-12">
      {lang === 'bn' && <p className="text-sm text-muted" lang="bn">{t('englishOnly')}</p>}
      <PageHead title="Who can use this, and how it helps">
        Kiln Watch turns 23 years of satellite records into answers people can act on. Each card pairs <b className="text-ink">our own finding</b> with a <b className="text-ink">fact from other studies</b> that shows why it matters.
      </PageHead>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card who="Environment inspectors" does="Plan inspection rounds for the weeks when kilns in each district are actually working, instead of guessing."
          ours={<>Kiln seasons are mapped for {nAreas} districts and upazilas from NASA <Gloss k="nightLights">night lights</Gloss>.{typ && <> Nationally, kilns work from {whenText(typ.onset)} to {whenText(typ.end)}, busiest in {typ.peak != null ? monthOfSeasonDay(typ.peak) : '–'}.</>}</>}
          other={<Other src={SRC.doe[0]} href={SRC.doe[1]}>The Department of Environment has said brick kilns produce about <b>58%</b> of the particle pollution in Dhaka’s winter smog.</Other>}
          cta={<TryLink to="/kilns" primary>Open the kiln planner</TryLink>} />

        <Card who="Families, schools and health workers" does="Know which months bring burning season to your own district or upazila, and whether this year is unusual so far."
          ours={<>Fire calendars for all 64 districts and about 500 upazilas, every day since 2003, updated daily.</>}
          other={<Other src={SRC.wb[0]} href={SRC.wb[1]}>Air pollution caused an estimated <b>78,000 to 88,000 deaths</b> in Bangladesh in 2019 and cost about <b>4% of GDP</b>.</Other>}
          cta={<TryLink to="/area" primary>Check my area</TryLink>} />

        <Card who="Agriculture officers" does="Time advice on crop-residue burning to each area’s real burning weeks, around the Aman and Boro rice harvests."
          ours={<>Each area’s calendar shows its usual fire months and its busiest month, from every season since 2003.</>}
          cta={<TryLink to="/area">See an area’s fire months</TryLink>} />

        <Card who="Policy makers" does="Check whether kiln policy is changing what happens on the ground, season by season and area by area."
          ours={early != null && late != null ? <>The national kiln season lasted {daysText(early)} in 2012–15 and {daysText(late)} in 2022–25. It got longer, not shorter.</> : <>Kiln-season length for every season since 2012.</>}
          other={<div className="space-y-2">
            <Other src={SRC.block[0]} href={SRC.block[1]}>In 2019 the government set a target of using concrete blocks instead of fired bricks in <b>100%</b> of government works by 2024-25. The deadline has since moved to <b>2028-29</b>.</Other>
            <Other src={SRC.workers[0]} href={SRC.workers[1]}>Bangladesh has about <b>7,000 to 8,000</b> brick kilns employing <b>1 to 1.5 million</b> seasonal workers.</Other>
          </div>}
          cta={<TryLink to="/timeline">See the timeline</TryLink>} />

        <Card who="Scientists everywhere" does="Keep long fire records going after NASA’s MODIS cameras retire, by bridging them to VIIRS the way we did."
          ours={harm ? <>Our correction removed <b>{Math.round((1 - harm.seam.ratio) * 100)}%</b> of the false 2012 jump, and a real Aqua reading lands inside our range. Method, code and data are open.</> : <>An open, tested bridge from MODIS to VIIRS.</>}
          other={<Other src={SRC.modis[0]} href={SRC.modis[1]}>NASA plans to end data collection from Terra MODIS in <b>January 2027</b> and from Aqua MODIS around <b>September 2027</b>.</Other>}
          cta={<TryLink to="/sensors">Try the sensor switch</TryLink>} />

        <Card who="Other brick-belt countries" does="Repeat the night-light kiln calendar with free NASA data, wherever kilns are too enclosed for fire satellites to see."
          ours={<>The night-light test passed in {rep && Number.isFinite(repN) ? <><b>{Math.round(rep.value! * repN)} of {repN}</b> seasons</> : 'every season tested'} in Bangladesh, and found nothing on ordinary farmland, as it should.</>}
          other={<Other src={SRC.belt[0]} href={SRC.belt[1]}>Satellite surveys count roughly <b>55,000 to 66,000</b> brick kilns across Pakistan, northern India, Nepal and Bangladesh.</Other>}
          cta={<TryLink to="/evidence">See how it was tested</TryLink>} />
      </div>

      <section className="panel space-y-2" aria-label="What Kiln Watch cannot do">
        <h2 className="h-section">What Kiln Watch cannot do</h2>
        <Caution>It is not an air-quality forecast. We tested whether burning predicts Dhaka’s daily PM2.5 readings and it didn’t{rs.length ? <> (correlations between {Math.min(...rs).toFixed(2)} and {Math.max(...rs).toFixed(2)}, about zero)</> : null}.</Caution>
        <Caution>It shows <i>when</i> kilns work, not how much smoke they make, and it never points at a single kiln.{sv && <> Fire satellites don’t see kilns at all: only {(sv.kiln_share * 100).toFixed(2)}% of dry-season fire detections fall on kiln sites, about the same as on farmland.</>}</Caution>
        <Caution>The night-light kiln method has been tested in Bangladesh only.</Caution>
      </section>
      <p className="text-sm text-muted">Facts marked “From other studies” come from the linked sources, not from our data. Our own numbers update with each data build.</p>
    </div>
  )
}
