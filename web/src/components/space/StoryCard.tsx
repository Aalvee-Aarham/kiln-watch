import { useId, type ReactNode } from 'react'
import { Icon } from '../ui'

export interface StepMeta { id: string; chapter: number; title: string }
export interface ChapterMeta { n: number; title: string }

/**
 * The tour card floating over the globe: chapter tabs, progress, a short step, optional detail, Back / Next.
 * On a phone it docks to the bottom as a sheet. It can fold away so the globe has the whole screen.
 */
export function StoryCard({ chapters, steps, index, onGo, open, onOpen, children, controls, more, about }: {
  chapters: ChapterMeta[]; steps: StepMeta[]; index: number; onGo: (i: number) => void
  open: boolean; onOpen: (o: boolean) => void
  children: ReactNode; controls?: ReactNode; more?: ReactNode; about: ReactNode
}) {
  const aboutId = useId()
  const step = steps[index], next = steps[index + 1], prev = steps[index - 1]
  if (!open) return (
    <button className="space-card-pill" onClick={() => onOpen(true)} aria-label="Show the story card">
      <span className="text-muted">{index + 1}/{steps.length}</span><b>{step.title}</b><Icon name="chevron" className="h-3.5 w-3.5 rotate-90" />
    </button>
  )
  return (
    <section className="space-card" aria-label="Story" aria-live="polite">
      <header className="flex items-center gap-2">
        <span className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Seen from space</span>
        <button type="button" className="space-icon-btn ml-auto" popoverTarget={aboutId} aria-label="About this page"><Icon name="info" /></button>
        <button type="button" className="space-icon-btn" onClick={() => onOpen(false)} aria-label="Hide the story card" title="Hide"><Icon name="minus" /></button>
        <div id={aboutId} popover="auto" className="space-about">{about}</div>
      </header>

      <nav className="space-chapters" aria-label="Chapters">
        {chapters.map((c) => {
          const first = steps.findIndex((s) => s.chapter === c.n), here = step.chapter === c.n
          const mine = steps.map((s, i) => [s, i] as const).filter(([s]) => s.chapter === c.n)
          return (
            <button key={c.n} className={`space-chapter ${here ? 'is-on' : ''}`} aria-current={here ? 'step' : undefined} onClick={() => onGo(first)}>
              <span className="space-chapter-title"><span className="num">{c.n}</span>{c.title}</span>
              <span className="space-chapter-bar" aria-hidden>{mine.map(([s, i]) => <span key={s.id} className={i <= index ? 'is-done' : ''} />)}</span>
            </button>
          )
        })}
      </nav>

      <div className="space-card-body">
        <h2 className="space-card-title">{step.title}</h2>
        <div className="space-card-text">{children}</div>
        {controls && <div className="space-card-controls">{controls}</div>}
        {more && (
          <details className="space-more">
            <summary><Icon name="chevron" className="h-3.5 w-3.5" />More about this</summary>
            <div className="space-more-body">{more}</div>
          </details>
        )}
      </div>

      <footer className="space-card-nav">
        <button className="space-nav-btn" disabled={!prev} onClick={() => onGo(index - 1)} aria-label={prev ? `Back: ${prev.title}` : 'Back'}>
          <Icon name="chevron" className="h-3.5 w-3.5 rotate-180" />Back
        </button>
        <span className="num text-xs text-muted">{index + 1} / {steps.length}</span>
        {next
          ? <button className="space-nav-btn is-primary" onClick={() => onGo(index + 1)} aria-label={`Next: ${next.title}`}>Next<Icon name="chevron" className="h-3.5 w-3.5" /></button>
          : <button className="space-nav-btn is-primary" onClick={() => onGo(0)}>Start again<Icon name="replay" className="h-3.5 w-3.5" /></button>}
      </footer>
    </section>
  )
}
