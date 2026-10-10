import { Component, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { NavLink, Link, useLocation } from 'react-router'
import { chartPng } from '../lib/chartRegistry'
import { useJson } from '../lib/data'
import { fmtNumber, useLang, useT, type Key } from '../lib/i18n'
import { toggleTheme, useTheme } from '../lib/theme'
import { harvestSpans, rituSpans, type Layout } from '../lib/ritu'
import type { CI, Events, KilnActivity, Meta, NrtSeason } from '../lib/types'

export function useMeta() { return useJson<Meta>('meta.json') }

/** Always-visible honesty strip: says which kind of data this build serves (real / offline real copy / synthetic). */
export function DemoBanner() {
  const meta = useMeta().data
  const t = useT()
  if (meta?.demo?.mode === 'real-offline-copy')
    return <div role="note" className="border-b border-line bg-surface-2 text-center text-[13px] text-muted">
      <p className="mx-auto max-w-[1200px] px-4 py-1.5">{t('demoReal')}{meta.demo.source_sha && <> · <span className="code">{meta.demo.source_sha}</span></>}</p>
    </div>
  if (meta?.git_sha === 'fixture')
    return <div role="note" className="border-b border-warn/40 bg-warn-soft text-center text-[13px]">
      <p className="mx-auto max-w-[1200px] px-4 py-1.5">{t('demoSynthetic')}</p>
    </div>
  return null
}

export function SeasonBanner() {
  const nrtState = useJson<NrtSeason>('nrt/current_season.json')
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem('banner-dismissed') === '1' } catch { return false }
  })

  // Only render if not dismissed and data is loaded.
  if (dismissed || !nrtState.data) return null
  const nrt = nrtState.data

  const dayNumber = Math.floor((Date.now() - Date.parse(nrt.day0 + 'T00:00:00Z')) / 86_400_000) + 1
  const unusualCount = Object.values(nrt.districts).filter(d => d.above_p90_days > 0).length

  return (
    <div role="note" className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2 text-sm text-ink sm:justify-center">
      {unusualCount > 0 && (
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-err opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-err" />
        </span>
      )}
      <p>Today is Day <span className="font-semibold">{dayNumber}</span> of the {nrt.season} burning season. <span className="font-semibold">{unusualCount}</span> districts have had unusual fire activity.</p>
      <button className="ml-auto p-1 opacity-60 hover:opacity-100 sm:ml-4" aria-label="Dismiss banner" onClick={() => { setDismissed(true); try { sessionStorage.setItem('banner-dismissed', '1') } catch { /* ignore */ } }}>
        <Icon name="cross" />
      </button>
    </div>
  )
}

/** Per-page browser title, so tabs, history and bookmarks say where they lead. */
export function useTitle(title?: string) {
  useEffect(() => { document.title = title ? `${title} · Kiln Watch` : 'Kiln Watch · One fire record from MODIS and VIIRS' }, [title])
}
/** Optional kiln-activity layer (Amendment 1); a missing file means "no layer". */
export function useKilnActivity() { return useJson<KilnActivity>('kiln_activity.json') }
/** Kiln pages show when the FIRMS gates unlocked kiln layers, or when the night-light/radar layer shipped. */
export function useKilnsVisible() {
  const meta = useMeta().data
  const ka = useKilnActivity().data
  return !!ka?.layer || (!!meta && meta.gate_branch !== 'partial' && meta.gate_branch !== 'nokiln')
}

/** prefers-reduced-motion, live. */
export function useReducedMotion() {
  return useSyncExternalStore(
    (l) => { const m = matchMedia('(prefers-reduced-motion: reduce)'); m.addEventListener('change', l); return () => m.removeEventListener('change', l) },
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}

// Chart patterns (decals): user toggle, stored per browser; forced-colors and print turn them on regardless.
const patternListeners = new Set<() => void>()
const readPatterns = () => { try { return localStorage.getItem('kwPatterns') === '1' } catch { return false } }
let patterns = typeof window === 'undefined' ? false : readPatterns()
export function togglePatterns() {
  patterns = !patterns
  try { localStorage.setItem('kwPatterns', patterns ? '1' : '0') } catch { /* per-page only */ }
  patternListeners.forEach((l) => l())
}
export function usePatterns() {
  const user = useSyncExternalStore((l) => { patternListeners.add(l); return () => patternListeners.delete(l) }, () => patterns, () => false)
  return user || (typeof matchMedia !== 'undefined' && matchMedia('(forced-colors: active)').matches)
}

/** Burning-calendar strip: the identity mark. 12 cells on the fire ramp. Stretches to its box. */
export function CalStrip({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 10" preserveAspectRatio="none" aria-hidden className={className}>
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={i * 5} y={0} width={4.4} height={10} rx={0.8}
          fill={`var(--color-fire-${Math.min(5, 1 + Math.floor(i / 2.5))})`} />
      ))}
    </svg>
  )
}

const ICONS = {
  download: 'M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10',
  sun: 'M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M13 3l-1 1M4 12l-1 1',
  moon: 'M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z',
  area: 'M2.5 2.5h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3M2.5 5.5v0M7 2.5h2M13.5 7v2M7 13.5h2M2.5 7v2',
  chevron: 'M6 3.5 10.5 8 6 12.5',
  check: 'M3 8.5 6.5 12 13 4.5',
  texture: 'M2.5 2.5h11v11h-11zM2.5 8 8 2.5M2.5 13.5 13.5 2.5M8 13.5 13.5 8',
  cross: 'M4 4l8 8M12 4l-8 8',
  info: 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM8 7v4.5M8 4.75v.5',
  half: 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM8 1.5v13',
  search: 'M7 2a5 5 0 1 0 0 10A5 5 0 0 0 7 2zM10.7 10.7 14 14',
  replay: 'M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2v3h3',
  table: 'M2 3h12v10H2zM2 6.5h12M2 10h12M6.5 3v10',
  pin: 'M8 14.5s4.5-4 4.5-8a4.5 4.5 0 0 0-9 0c0 4 4.5 8 4.5 8zM8 5v.01',
  plus: 'M8 3v10M3 8h10',
  minus: 'M3 8h10',
} as const
export type IconName = keyof typeof ICONS
export const Icon = ({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`shrink-0 ${className}`}>
    <path d={ICONS[name]} />
  </svg>
)

export function AppShell({ children }: { children: ReactNode }) {
  const t = useT()
  const lang = useLang()
  const theme = useTheme()
  const meta = useMeta().data
  const loc = useLocation()
  const q = lang === 'bn' ? '?lang=bn' : ''
  const navRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const showKilns = useKilnsVisible()
  // Plain-language pages first; the original expert pages sit behind "For experts" (redesign_plan.md §3).
  // v2 (redesign_plan.md §9): approach → the two apps → benefits → proof. Sensor switch and Timeline are linked from the pages.
  // The fire calendar leads, then the AI agent; the kiln extension sits after the proof (docs/roadmap.md F1). Order matches README "The website".
  const tabs: [string, Key, Key?][] = [['/how', 'how', 'howShort'], ['/area', 'area', 'areaShort'], ['/ask', 'ask', 'askShort'], ['/region', 'region', 'regionShort'], ['/impact', 'impact', 'impactShort'], ['/trust', 'trust', 'trustShort'],
  ...(showKilns ? [['/kilns', 'planner', 'kilnsShort'] as [string, Key, Key]] : []), ['/experts', 'experts', 'expertsShort']]
  const expertPage = /^\/(experts|story|explore|season|evidence|method)(\/|$)/.test(loc.pathname)
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  // Publish the header's real height: the Explore compact bar, the sticky sidebar and section jump offsets sit below it.
  useLayoutEffect(() => {
    const h = headerRef.current
    if (!h) return
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--header-h', `${h.offsetHeight}px`))
    ro.observe(h)
    return () => ro.disconnect()
  }, [])
  // keep the active tab visible in the scrolling pill row (no animation: it follows a navigation)
  useEffect(() => { navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }, [loc.pathname])
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">{t('skip')}</a>
      <DemoBanner />
      <SeasonBanner />
      <header ref={headerRef} className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:flex-nowrap min-[900px]:gap-x-5">
          <NavLink to={'/' + q} className="flex shrink-0 items-center gap-2 py-1">
            <CalStrip className="h-3.5 w-7 rounded-[2px]" />
            <span className="h-display text-[19px]">Kiln Watch</span>
          </NavLink>
          <nav ref={navRef} aria-label="Main" className="nav-scroll order-3 -mx-4 flex min-w-0 basis-[calc(100%+2rem)] gap-0 overflow-x-auto px-4 pb-1 sm:order-none sm:mx-0 sm:flex-1 sm:basis-auto sm:px-0 sm:pb-0">
            {tabs.map(([to, k, short]) => {
              const on = (isActive: boolean) => isActive || (to === '/experts' && expertPage)
              return (
                <NavLink key={to} to={to + q} aria-current={to === '/experts' && expertPage ? 'page' : undefined}
                  className={({ isActive }) => `relative shrink-0 rounded-[4px] px-1 py-1.5 text-[14px] min-[900px]:px-2 min-[900px]:text-[15px] transition-colors duration-150 ${on(isActive) ? 'font-semibold text-ink after:absolute after:inset-x-1 min-[900px]:after:inset-x-2 after:-bottom-[9px] after:h-[2px] after:bg-orbit max-sm:after:-bottom-[3px]' : 'text-muted hover:text-ink'}`}>
                  {short ? <><span className="min-[1200px]:hidden">{t(short)}</span><span className="max-[1200px]:hidden">{t(k)}</span></> : t(k)}
                </NavLink>)
            })}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:ml-0">
            <PatternsToggle />
            <button className="btn btn-icon" aria-label={theme === 'day' ? t('themeNight') : t('themeDay')} title={theme === 'day' ? t('themeNight') : t('themeDay')}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); toggleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) }}>
              <Icon name={theme === 'day' ? 'moon' : 'sun'} />
            </button>
          </div>
        </div>
      </header>
      <main id="main" key={loc.pathname} className="route-in mx-auto max-w-[1200px] px-4 pt-6 pb-16">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-end gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted">
          <div className="space-y-0.5">
            <p>NASA Space Apps 2026: one fire record from MODIS and VIIRS. Bangladesh is the first region.</p>
            <p>Data build <span className="code">{meta?.git_sha ?? '…'}</span>{meta && <>, generated {fmtDate(meta.generated_at)}</>}. Outputs are inspection leads, not findings of illegality.</p>
            <p>Real NASA and ESA satellite data. <a className="underline" href="https://github.com/Aalvee-Aarham/kiln-watch">Open source code</a> · <NavLink className="underline" to={'/experts' + q}>For experts</NavLink></p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export const fmtDate = (iso: string) => new Date(iso.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace('Sept', 'Sep')

function PatternsToggle() {
  const t = useT()
  const on = usePatterns()
  const label = `${t('patterns')}: ${on ? 'on' : 'off'}. Draws chart series with textures as well as colour, for colour-blind reading and print.`
  return <button className="btn btn-icon aria-pressed:bg-surface-2 aria-pressed:text-orbit" aria-pressed={on} onClick={togglePatterns} aria-label={label} title={label}><Icon name="texture" /></button>
}

/** A page section: title row with a hairline, actions on the right, optional Download menu and table view. */
export function Section({ id, title, summary, actions, download, table, children, plate = true }: {
  id?: string; title: ReactNode; summary?: ReactNode; actions?: ReactNode; children: ReactNode; plate?: boolean
  download?: { name: string; csv?: () => string; json?: unknown; png?: boolean | string }; table?: () => ReactNode
}) {
  const [showTable, setShowTable] = useState(false)
  return (
    <section id={id} className="scroll-mt-[calc(var(--header-h,96px)+0.75rem)] sm:scroll-mt-[calc(var(--header-h,53px)+3.5rem)]" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="section-head">
        <h2 className="h-section">{title}</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {actions}
          {(download || table) && <DownloadMenu {...download} onTable={table ? () => setShowTable((v) => !v) : undefined} tableOn={showTable} />}
        </div>
      </div>
      <div className={plate ? 'panel p-3 sm:p-4' : ''}>{children}</div>
      {showTable && table && <div className="mt-3 max-h-96 overflow-auto rounded-[4px] border border-line p-3 text-sm">{table()}</div>}
      {summary && <div className="note">{summary}</div>}
    </section>
  )
}

export function DownloadMenu({ name, csv, json, png, onTable, tableOn }: { name?: string; csv?: () => string; json?: unknown; png?: boolean | string; onTable?: () => void; tableOn?: boolean }) {
  const t = useT()
  const ref = useRef<HTMLDetailsElement>(null)
  const save = (href: string, ext: string) => {
    const a = document.createElement('a')
    a.href = href; a.download = `${name}.${ext}`; a.click()
    ref.current?.removeAttribute('open')
  }
  const blob = (text: string, ext: string, type: string) => { const u = URL.createObjectURL(new Blob([text], { type })); save(u, ext); setTimeout(() => URL.revokeObjectURL(u), 1000) }
  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      const d = ref.current
      if (!d?.open) return
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !d.contains(e.target as Node)) { d.removeAttribute('open'); if (e instanceof KeyboardEvent) d.querySelector('summary')?.focus() }
    }
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [])
  return (
    <details ref={ref} className="menu">
      <summary className="btn" aria-haspopup="menu"><Icon name="download" />{t('download')}</summary>
      <div className="menu-list" role="menu">
        {csv && <button role="menuitem" onClick={() => blob(csv(), 'csv', 'text/csv')}>CSV <span className="ml-auto text-xs text-muted">{t('dlCsv')}</span></button>}
        {json !== undefined && <button role="menuitem" onClick={() => blob(JSON.stringify(json), 'json', 'application/json')}>JSON <span className="ml-auto text-xs text-muted">{t('dlJson')}</span></button>}
        {png && name && <button role="menuitem" onClick={() => { const u = chartPng(typeof png === 'string' ? png : name); if (u) save(u, 'png') }}>PNG <span className="ml-auto text-xs text-muted">{t('dlPng')}</span></button>}
        {onTable && <button role="menuitemcheckbox" aria-checked={!!tableOn} onClick={() => { onTable(); ref.current?.removeAttribute('open') }}><Icon name="table" />{t('viewTable')}</button>}
      </div>
    </details>
  )
}

export function SegmentedToggle<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  const box = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLSpanElement>(null)
  // Thumb follows the checked button: transform + width, set directly on the element.
  useLayoutEffect(() => {
    const b = box.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
    if (!b || !thumb.current) return
    thumb.current.style.width = `${b.offsetWidth}px`
    thumb.current.style.transform = `translateX(${b.offsetLeft}px)`
  })
  const i = options.findIndex(([v]) => v === value)
  const move = (d: number) => { const n = options[(i + d + options.length) % options.length]; onChange(n[0]); requestAnimationFrame(() => box.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()) }
  return (
    <div ref={box} role="radiogroup" aria-label={label} className="seg"
      onKeyDown={(e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(1) } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(-1) } }}>
      <span ref={thumb} className="seg-thumb" aria-hidden />
      {options.map(([v, l]) => (
        <button key={v} role="radio" aria-checked={value === v} tabIndex={value === v ? 0 : -1} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  )
}

export const fmt = (v: number | null | undefined, d = 2) =>
  v == null || !Number.isFinite(v) ? '–' : v !== 0 && Math.abs(v) < 1e-3 ? v.toExponential(1) : Number(v.toFixed(d)).toLocaleString('en-US', { maximumFractionDigits: d })
export const CIText = ({ ci, d = 2 }: { ci: CI; d?: number }) => (
  <span className="num">{fmt(ci.p50, d)} <span className="text-muted">[{fmt(ci.lo, d)}–{fmt(ci.hi, d)}]</span></span>
)

export function StatusMessage({ kind = 'info', children }: { kind?: 'info' | 'error' | 'loading' | 'ok'; children: ReactNode }) {
  const c = kind === 'error' ? 'border-err/40 bg-err-soft' : kind === 'ok' ? 'border-ok/40 bg-ok-soft'
    : kind === 'loading' ? 'border-line bg-surface-2 text-muted' : 'border-warn/40 bg-warn-soft'
  const icon: IconName = kind === 'error' ? 'cross' : kind === 'ok' ? 'check' : 'info'
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-[4px] border px-3 py-2 text-sm ${c}`}>
      {kind !== 'loading' && <span className={kind === 'error' ? 'text-err' : kind === 'ok' ? 'text-ok' : 'text-warn'}><Icon name={icon} className="mt-0.5 h-4 w-4" /></span>}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Status stamp: icon + word, never colour alone. */
export function Verdict({ pass, label }: { pass?: boolean; label?: string }) {
  const t = useT()
  if (pass == null) return null
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${pass ? 'bg-ok-soft text-ok' : 'bg-err-soft text-err'}`}>
      <Icon name={pass ? 'check' : 'cross'} className="h-3 w-3" />{label ?? (pass ? t('pass') : t('fail'))}
    </span>
  )
}

export const ProvisionalBadge = () => {
  const t = useT()
  return <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-ink"><span className="text-warn"><Icon name="half" className="h-3 w-3" /></span>{t('provisional')}</span>
}

export function Breadcrumbs({ items }: { items: [label: string, to?: string][] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted">
      {items.map(([label, to], i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <Icon name="chevron" className="h-3 w-3 opacity-60" />}
          {to ? <Link to={to} className="hover:text-ink hover:underline">{label}</Link> : <span className={i === items.length - 1 ? 'text-ink' : ''}>{label}</span>}
        </span>
      ))}
    </nav>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

/** Shape-matched skeleton: a heatmap grid, or a faint line chart. */
export function SkeletonCard({ label, shape = 'line' }: { label: string; shape?: 'line' | 'grid' | 'table' }) {
  return (
    <div role="status" aria-label={label}>
      <div className="section-head"><Skeleton className="h-5 w-48" /></div>
      <div className="panel">
        {shape === 'grid' ? (
          <div className="grid gap-[3px] opacity-70" style={{ gridTemplateColumns: 'repeat(52, 1fr)' }}>
            {Array.from({ length: 52 * 14 }, (_, i) => <div key={i} className="aspect-square rounded-[1px] bg-surface-2" />)}
          </div>
        ) : shape === 'table' ? (
          <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
        ) : (
          <svg viewBox="0 0 400 120" className="h-[260px] w-full text-surface-2" preserveAspectRatio="none" aria-hidden>
            <polyline points="0,90 40,85 80,88 120,70 160,74 200,52 240,60 280,40 320,46 360,30 400,34" fill="none" stroke="currentColor" strokeWidth="6" />
          </svg>
        )}
        <Skeleton className="mt-3 h-3 w-full max-w-lg" />
      </div>
    </div>
  )
}

/** Inline SVG sparkline — no chart lib for 24px-tall series. Last value marked. */
export function Sparkline({ values, width = 96, height = 24, stroke = 'var(--color-heat)' }: { values: number[]; width?: number; height?: number; stroke?: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  const xy = values.map((v, i) => [(i / (values.length - 1)) * (width - 3), height - 3 - ((v - min) / span) * (height - 6)])
  const [lx, ly] = xy.at(-1)!
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`last ${values.length} days: min ${fmt(min, 1)}, max ${fmt(max, 1)}, latest ${fmt(values.at(-1), 1)}`}>
      <polyline points={xy.map((p) => p.join(',')).join(' ')} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2.5} fill={stroke} stroke="var(--color-surface)" strokeWidth={1} />
    </svg>
  )
}

/** Count up once (600ms, tabular figures). Instant under reduced motion. */
export function CountUp({ target, format }: { target: number; format: (v: number) => string }) {
  const reduced = useReducedMotion()
  const [v, setV] = useState(() => (reduced ? target : 0))
  useEffect(() => {
    if (reduced) { setV(target); return }
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 600)
      setV(target * (1 - Math.pow(1 - k, 4)))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced])
  return <span className="num">{format(v)}</span>
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { err?: string }> {
  state: { err?: string } = {}
  static getDerivedStateFromError(e: Error) { return { err: e.message } }
  render() {
    return this.state.err
      ? <StatusMessage kind="error">This view failed to draw: {this.state.err}. Reload to fetch the data again.
        <button className="btn mt-2 block" onClick={() => location.reload()}>Reload data</button></StatusMessage>
      : this.props.children
  }
}

export function Loading<T>({ state, children, skeleton }: { state: { data?: T; error?: string; loading: boolean }; children: (d: T) => ReactNode; skeleton?: ReactNode }) {
  if (state.error)
    return state.error.endsWith('was not found')
      ? <StatusMessage kind="info">This area isn’t in the demo dataset — the offline demo ships every district and a few upazilas. On the live site, all of Bangladesh is covered.</StatusMessage>
      : <StatusMessage kind="error">Couldn’t load this data ({state.error}). Check the link, or reload to try again.</StatusMessage>
  if (!state.data) return <>{skeleton ?? <StatusMessage kind="loading">Loading…</StatusMessage>}</>
  return <>{children(state.data)}</>
}

/**
 * Verdict strip: one pre-registered test on a number line — pass zone shaded, observed value (with CI) marked,
 * so a reader sees how far from passing a result is, not just a chip.
 */
export function VerdictStrip({ label, value, ci, pass, domain, log, verdict, format = (v) => fmt(v, 3), note }: {
  label: ReactNode; value: number; ci?: [number, number]; pass: [number, number]; domain: [number, number]; log?: boolean
  verdict?: boolean; format?: (v: number) => string; note?: ReactNode
}) {
  const [a, b] = log ? domain.map(Math.log10) : domain
  const pos = (v: number) => `${Math.max(0, Math.min(100, (((log ? Math.log10(Math.max(v, domain[0])) : v) - a) / (b - a)) * 100))}%`
  const lo = pos(pass[0]), hi = pos(pass[1])
  return (
    <div className="py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium">{label}</span>
        <span className="ml-auto"><Verdict pass={verdict} /></span>
      </div>
      <div className="relative mt-8 mb-6 h-2 rounded-full bg-surface-2" role="img"
        aria-label={`observed ${format(value)}; passing range ${format(pass[0])} to ${format(pass[1])}; ${verdict ? 'pass' : 'fail'}`}>
        <div className="absolute inset-y-0 rounded-full bg-ok/25 ring-1 ring-ok/50" style={{ left: lo, width: `calc(${hi} - ${lo})` }} />
        {ci && <div className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-ink/60" style={{ left: pos(ci[0]), width: `calc(${pos(ci[1])} - ${pos(ci[0])})` }} />}
        <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink" style={{ left: pos(value) }} />
        <span className="num absolute bottom-3.5 -translate-x-1/2 text-sm font-semibold whitespace-nowrap" style={{ left: `clamp(1.5rem, ${pos(value)}, calc(100% - 1.5rem))` }}>{format(value)}</span>
        <span className="num absolute top-3.5 left-0 text-xs text-muted">{format(domain[0])}</span>
        <span className="num absolute top-3.5 right-0 text-xs text-muted">{format(domain[1])}</span>
      </div>
      {note && <p className="text-sm text-muted">{note}</p>}
    </div>
  )
}

/** Bengali seasons + harvest windows aligned to a chart's 366-day x-axis. `left`/`right` = the chart grid's insets in px. */
export function RituBand({ layout, events, left, right }: { layout: Layout; events?: Events; left: number; right: number }) {
  const lang = useLang()
  const t = useT()
  const spans = rituSpans(layout)
  const harvest = harvestSpans(events, layout)
  const pct = (x: number) => `${(x / 366) * 100}%`
  const crop = (c: string) => (c === 'aman' ? t('aman') : c === 'boro' ? t('boro') : c[0].toUpperCase() + c.slice(1))
  return (
    // Narrow (container query): ritu row hidden with its ticks, harvest windows move up.
    <div className="@container mb-1 text-[11px]" style={{ marginLeft: left, marginRight: right }} aria-hidden><div className="relative h-9 @max-[460px]:h-4">
      {spans.map((s, i) => (
        <div key={i} className="absolute top-0 flex h-4 @max-[460px]:hidden items-center overflow-hidden border-l border-line pl-1 whitespace-nowrap text-muted"
          style={{ left: pct(s.x0), width: pct(s.x1 - s.x0) }} title={`${s.ritu.en} (${s.ritu.bn}), ${s.ritu.span}`}>
          {s.x1 - s.x0 > 25 && <span>{lang === 'bn' ? s.ritu.bn : s.ritu.en}</span>}
        </div>
      ))}
      {harvest.map((h, i) => (
        <div key={i} className="absolute top-5 flex h-3.5 @max-[460px]:top-0 items-center overflow-hidden rounded-[2px] px-1 font-medium whitespace-nowrap text-[10px]"
          style={{ left: pct(h.x0), width: pct(h.x1 - h.x0), background: `color-mix(in oklch, var(--color-${h.crop === 'aman' ? 'paddy' : 'jute'}) 22%, transparent)`, color: 'var(--color-ink)' }}
          title={`${h.crop === 'aman' ? 'Aman' : h.crop === 'boro' ? 'Boro' : h.crop} rice harvest window`}>
          {h.x1 - h.x0 > 20 && <>{crop(h.crop)}<span className="@max-[460px]:hidden">{'\u00a0'}{t('harvest')}</span></>}
        </div>
      ))}
    </div></div>
  )
}

/** Glossary term: dotted underline, help cursor, definition on hover/long-press (native <abbr title>). */
const GLOSSARY = {
  'MYD-eq': 'Aqua-MODIS-equivalent fire cell-days per 1,000 cloud-free cells: every sensor converted to what Aqua-MODIS would have seen.',
  p90: '90th percentile: on a normal day, activity is below this level 9 times out of 10.',
  LOSO: 'Leave-one-season-out: fit on all seasons but one, predict the held-out season, repeat for each.',
  Chow: 'Chow test: checks whether a series has a structural break at a given point (here, 2012).',
  'PR-AUC': 'Area under the precision–recall curve: 1 is perfect, the prevalence is chance.',
} as const
export const Term = ({ k, children }: { k: keyof typeof GLOSSARY; children?: ReactNode }) => <abbr className="term" title={GLOSSARY[k]}>{children ?? k}</abbr>

export const useFmtNumber = () => { const lang = useLang(); return (v: number, d = 2) => fmtNumber(v, lang, d) }
