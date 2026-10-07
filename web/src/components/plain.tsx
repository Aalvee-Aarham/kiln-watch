// Building blocks for the plain-language pages (redesign_plan.md §2): glossary pop-ups, our-finding vs
// outside-fact boxes, the caution line and a 12-month strip. Experts pages keep the original kit in ui.tsx.
import { useId, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Icon } from './ui'
import { SEASON_MONTHS } from '../lib/plain'

const GLOSS = {
  satellite: ['Satellite', 'A machine circling Earth. The ones used here pass over Bangladesh at least twice a day and photograph it in visible and infrared light.'],
  MODIS: ['MODIS', 'A NASA camera on the Terra and Aqua satellites that has watched for fires since 2000. Each picture square (pixel) covers about 1 km by 1 km.'],
  VIIRS: ['VIIRS', 'A newer, sharper fire camera on NASA/NOAA satellites since 2012. Each pixel covers about 375 m by 375 m, so it notices smaller fires.'],
  nightLights: ['Night lights', 'NASA’s Black Marble product: how brightly the ground glows at night, measured by VIIRS. A working kiln, with lamps and workers on site all night, glows.'],
  radar: ['Radar', 'The European Sentinel-1 satellite bounces radio waves off the ground, day or night and through clouds. Stacks of fresh bricks in a kiln yard change the echo.'],
  harmonize: ['Harmonize', 'Convert every satellite’s fire counts into one shared unit, like converting taka, dollars and euros into one currency, so that years can be compared fairly.'],
  normal: ['Normal range', 'What a usual day looks like here at this time of year, worked out from every season since 2003.'],
  unusual: ['Unusual day', 'A day with more fire than 9 out of 10 past seasons had on the same date.'],
  upazila: ['Upazila', 'A sub-district. Bangladesh has 64 districts and about 500 upazilas.'],
  cluster: ['Kiln cluster', 'A group of brick kilns close together. Each cluster is compared with three patches of similar farmland nearby that have no kilns.'],
  season: ['Season', 'Our year runs from 1 July to 30 June, so one winter burning season is never split in two. “2024-25” means July 2024 to June 2025.'],
} as const

/** A word with a tap-to-explain definition (native popover: keyboard, Esc and outside-click for free). */
export function Gloss({ k, children }: { k: keyof typeof GLOSS; children?: ReactNode }) {
  const id = useId()
  const [title, text] = GLOSS[k]
  return (
    <>
      <button type="button" className="gloss" popoverTarget={id} aria-label={`${typeof children === 'string' ? children : title}: what does this mean?`}>{children ?? title}</button>
      <span id={id} popover="auto" className="gloss-pop" role="note"><b className="mb-1 block">{title}</b>{text}</span>
    </>
  )
}

/** Our own result, from Kiln Watch's real data. */
export const Ours = ({ children }: { children: ReactNode }) => (
  <div className="ours text-sm"><span className="tag">Our finding</span><div>{children}</div></div>
)

/** A fact from someone else's study: always labelled, always linked, never mixed with our results. */
export const Other = ({ children, src, href }: { children: ReactNode; src: string; href: string }) => (
  <div className="other text-sm"><span className="tag">From other studies</span><div>{children}</div>
    <a className="mt-1 inline-flex items-center gap-1 text-xs text-orbit underline" href={href} target="_blank" rel="noreferrer">Source: {src}</a></div>
)

export const Caution = ({ children }: { children: ReactNode }) => (
  <p className="flex items-start gap-2 text-sm text-muted"><Icon name="info" className="mt-0.5 h-4 w-4" /><span>{children}</span></p>
)

/** Keeps ?lang= on internal links. */
export function useQ() {
  const [sp] = useSearchParams()
  return sp.toString() ? `?${sp}` : ''
}

export function TryLink({ to, children, primary }: { to: string; children: ReactNode; primary?: boolean }) {
  const q = useQ()
  return <Link to={to + q} className={`btn ${primary ? 'btn-primary' : ''} min-h-11 px-4`}>{children}<Icon name="chevron" className="h-3.5 w-3.5" /></Link>
}

export function PageHead({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <header className="space-y-3">
      <h1 className="h-display max-w-[22ch] text-[clamp(2.25rem,6vw,3.75rem)]">{title}</h1>
      {children && <div className="prose-measure text-lg text-muted">{children}</div>}
    </header>
  )
}

/** Step heading for guided pages: a numbered circle and a question. */
export const Step = ({ n, title, children }: { n: number; title: ReactNode; children: ReactNode }) => (
  <section className="space-y-4" aria-label={typeof title === 'string' ? title : undefined}>
    <h2 className="flex items-baseline gap-3 text-[clamp(1.4rem,3vw,1.9rem)] font-semibold leading-tight">
      <span className="num grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-base text-on-ink">{n}</span>{title}</h2>
    {children}
  </section>
)

/**
 * Twelve months, July first (our season year): `level` per month 0 = off, 1 = on, 2 = peak.
 * Colour plus a text label per state, so it reads without colour too.
 */
export function MonthStrip({ level, color = 'var(--color-brick)', label }: { level: number[]; color?: string; label: string }) {
  return (
    <figure className="m-0" aria-label={label}>
      <ol className="grid grid-cols-12 gap-[3px]">
        {SEASON_MONTHS.map((m, i) => (
          <li key={m} className="text-center" title={`${m}: ${['quiet', 'active', 'busiest'][level[i]]}`}>
            <span className="block h-7 rounded-[3px] border border-line"
              style={{ background: level[i] ? `color-mix(in srgb, ${color} ${level[i] === 2 ? 100 : 45}%, var(--color-surface))` : 'var(--color-surface-2)' }} />
            <span className="mt-1 block text-[11px] text-muted">{m.slice(0, 3)}</span>
          </li>
        ))}
      </ol>
      <figcaption className="sr-only">{SEASON_MONTHS.filter((_, i) => level[i]).join(', ') || 'none'}</figcaption>
    </figure>
  )
}

/** Season-month index (0 = July) of a day of season. */
export const seasonMonthOf = (dayOfSeason: number) => {
  const starts = [0, 31, 62, 92, 123, 153, 184, 215, 243, 274, 304, 335]
  let i = 0
  while (i < 11 && dayOfSeason >= starts[i + 1]) i++
  return i
}

/** Month levels for a window [onset, end] with a peak day, all days of season. */
export function windowLevels(onset: number, end: number, peak: number | null): number[] {
  const a = seasonMonthOf(onset), b = seasonMonthOf(end), p = peak == null ? -1 : seasonMonthOf(peak)
  return Array.from({ length: 12 }, (_, i) => (i === p ? 2 : i >= a && i <= b ? 1 : 0))
}

/** The approach as a chain: satellite → … → benefit. Wraps on phones; arrows are decoration only. */
export function Flow({ items, active, onPick }: { items: [title: string, text?: string][]; active?: number; onPick?: (i: number) => void }) {
  return (
    <ol className="flex flex-wrap items-stretch gap-x-1 gap-y-2" aria-label="How it works, step by step">
      {items.map(([title, text], i) => {
        const body = <><span className="num text-xs text-muted">{i + 1}</span><b className="block leading-tight">{title}</b>{text && <span className="block text-xs text-muted">{text}</span>}</>
        return (
          <li key={title} className="flex min-w-0 flex-1 basis-[9rem] items-center gap-1">
            {onPick
              ? <button type="button" aria-pressed={active === i} onClick={() => onPick(i)} className="panel h-full w-full text-left transition-colors hover:bg-surface-2 aria-pressed:border-ink aria-pressed:bg-surface-2">{body}</button>
              : <div className="panel h-full w-full">{body}</div>}
            {i < items.length - 1 && <Icon name="chevron" className="hidden h-4 w-4 text-muted sm:block" />}
          </li>)
      })}
    </ol>
  )
}
