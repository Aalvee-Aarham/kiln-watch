import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Link, useLocation, useSearchParams } from 'react-router'
import { echarts, ensureChartTheme, type EOption } from '../lib/echarts'
import { useJson } from '../lib/data'
import { useLang, useT } from '../lib/i18n'
import { toggleTheme, useTheme } from '../lib/theme'
import type { CI, KilnActivity, Meta } from '../lib/types'

export function useMeta() { return useJson<Meta>('meta.json') }
/** Optional kiln-activity layer (Amendment 1); a missing file means "no layer". */
export function useKilnActivity() { return useJson<KilnActivity>('kiln_activity.json') }
/** Kiln pages show when the FIRMS gates unlocked kiln layers, or when the night-light/radar layer shipped. */
export function useKilnsVisible() {
  const meta = useMeta().data
  const ka = useKilnActivity().data
  return !!ka?.layer || (!!meta && meta.gate_branch !== 'partial' && meta.gate_branch !== 'nokiln')
}

/** Burning-calendar strip: the identity mark. 12 cells, fire ramp, one ember "today". */
export function CalStrip({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 10" aria-hidden className={className}>
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={i * 5} y={0} width={4.4} height={10} rx={0.8}
          fill={`var(--color-fire-${Math.min(5, 1 + Math.floor(i / 2.5))})`} />
      ))}
    </svg>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const t = useT()
  const theme = useTheme()
  const meta = useMeta().data
  const loc = useLocation()
  const [sp] = useSearchParams()
  const q = sp.get('lang') === 'bn' ? '?lang=bn' : ''
  const showKilns = useKilnsVisible()
  const tabs: [string, Parameters<typeof t>[0]][] = [['/', 'story'], ['/explore', 'explore'], ['/season', 'season'],
    ...(showKilns ? [['/kilns', 'kilns'] as [string, 'kilns']] : []), ['/evidence', 'evidence'], ['/method', 'method']]
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
          <NavLink to={'/' + q} className="mr-1 flex shrink-0 items-center gap-2 font-bold text-ember">
            <CalStrip className="h-3 w-6 rounded-[2px]" />
            <span className="h-display text-[15px] leading-none">Kiln Watch</span>
          </NavLink>
          <nav aria-label="Main" className="-mx-1 flex min-w-0 flex-1 basis-full gap-1 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:basis-auto">
            {tabs.map(([to, k]) => (
              <NavLink key={to} to={to + q} end={to === '/'} title={t(k)}
                className={({ isActive }) => `shrink-0 rounded-full px-2.5 py-1 text-sm transition-colors duration-120 ${isActive ? 'bg-ember/10 font-semibold text-ember' : 'text-muted hover:bg-surface-2 hover:text-ink'}`}>
                {t(k)}
              </NavLink>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <LangToggle />
            <button className="btn px-2!" aria-label={theme === 'day' ? 'Switch to night theme' : 'Switch to day theme'} onClick={toggleTheme}>
              {theme === 'day' ? '☾' : '☀'}
            </button>
          </div>
        </div>
      </header>
      <main key={loc.pathname} className="route-in mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted">
        NASA Space Apps 2026 · Harmonization of MODIS and VIIRS Hot Spots · data build <code className="num">{meta?.git_sha ?? '…'}</code>
        {meta && <> · generated <span className="num">{meta.generated_at.slice(0, 10)}</span></>} · Outputs are inspection leads, not findings of illegality.
      </footer>
    </div>
  )
}

function LangToggle() {
  const lang = useLang()
  const [sp, setSp] = useSearchParams()
  return (
    <button className="btn" aria-label="Switch language"
      onClick={() => { const n = new URLSearchParams(sp); if (lang === 'bn') n.delete('lang'); else n.set('lang', 'bn'); setSp(n) }}>
      {lang === 'bn' ? 'English' : 'বাংলা'}
    </button>
  )
}

export function ChartCard({ title, summary, children, actions }: { title: string; summary?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card" aria-label={title}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="h-display text-base">{title}</h3>
        <div className="ml-auto flex flex-wrap gap-2">{actions}</div>
      </div>
      {children}
      {summary && <p className="note">{summary}</p>}
    </section>
  )
}

export function SegmentedToggle<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-md border border-line text-sm">
      {options.map(([v, l]) => (
        <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`px-2.5 py-1 transition-colors duration-120 ${value === v ? 'bg-ember text-white' : 'bg-surface hover:bg-surface-2'}`}>{l}</button>
      ))}
    </div>
  )
}

export const fmt = (v: number | null | undefined, d = 2) =>
  v == null || !Number.isFinite(v) ? '–' : v !== 0 && Math.abs(v) < 1e-3 ? v.toExponential(1) : Number(v.toFixed(d)).toLocaleString(undefined, { maximumFractionDigits: d })
export const CIText = ({ ci, d = 2 }: { ci: CI; d?: number }) => (
  <span className="num">{fmt(ci.p50, d)} <span className="text-muted">[{fmt(ci.lo, d)}–{fmt(ci.hi, d)}]</span></span>
)

export function StatusMessage({ kind = 'info', children }: { kind?: 'info' | 'error' | 'loading' | 'ok'; children: ReactNode }) {
  const c = kind === 'error' ? 'border-err/40 bg-err-soft text-err' : kind === 'ok' ? 'border-ok/40 bg-ok-soft text-ok'
    : kind === 'loading' ? 'border-line bg-surface-2 text-muted' : 'border-warn/40 bg-warn-soft text-ink'
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${c}`}>{children}</div>
}

export const ProvisionalBadge = () => <span className="rounded-full border border-warn/50 bg-warn-soft px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-ink">Provisional</span>

export function DownloadButtons({ name, csv, json }: { name: string; csv?: () => string; json?: unknown }) {
  const save = (text: string, ext: string, type: string) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type }))
    a.download = `${name}.${ext}`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <div className="flex gap-2">
      {csv && <button className="btn" onClick={() => save(csv(), 'csv', 'text/csv')}>⬇ CSV</button>}
      {json !== undefined && <button className="btn" onClick={() => save(JSON.stringify(json), 'json', 'application/json')}>⬇ JSON</button>}
    </div>
  )
}

export function Breadcrumbs({ items }: { items: [label: string, to?: string][] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted">
      {items.map(([label, to], i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="text-line">›</span>}
          {to ? <Link to={to} className="hover:text-ink hover:underline">{label}</Link> : <span className="text-ink">{label}</span>}
        </span>
      ))}
    </nav>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

export function SkeletonCard({ label }: { label: string }) {
  return (
    <div className="card" role="status" aria-label={label}>
      <Skeleton className="mb-3 h-4 w-48" />
      <Skeleton className="h-[280px] w-full" />
      <Skeleton className="mt-3 h-3 w-full max-w-lg" />
    </div>
  )
}

/** Inline SVG sparkline — no chart lib for 24px-tall series. */
export function Sparkline({ values, width = 96, height = 24, stroke = 'var(--color-ember)' }: { values: number[]; width?: number; height?: number; stroke?: string }) {
  if (!values.length) return null
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 2 - ((v - min) / span) * (height - 4)}`).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/** Count up once (600ms, mono tabular). Instant under reduced motion. */
export function CountUp({ target, format }: { target: number; format: (v: number) => string }) {
  const reduced = useRef(typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [v, setV] = useState(() => (reduced.current ? target : 0))
  useEffect(() => {
    if (reduced.current) return
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 600)
      setV(target * (1 - Math.pow(1 - k, 4)))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return <span className="num">{format(v)}</span>
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { err?: string }> {
  state: { err?: string } = {}
  static getDerivedStateFromError(e: Error) { return { err: e.message } }
  render() {
    return this.state.err
      ? <StatusMessage kind="error">Something went wrong: {this.state.err}
        <button className="btn ml-3" onClick={() => location.reload()}>Reload data</button></StatusMessage>
      : this.props.children
  }
}

/** ECharts host: ARIA on, resizes with its container, re-themes on toggle, PNG export. */
export function EChart({ option, height = 320, label, exportName }: { option: EOption; height?: number; label: string; exportName?: string }) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<ReturnType<typeof echarts.init>>(null)
  const theme = useTheme()
  const themeId = ensureChartTheme(theme)
  const reduced = useRef(typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    if (!el.current) return
    const c = echarts.init(el.current, themeId)
    chart.current = c
    const ro = new ResizeObserver(() => c.resize())
    ro.observe(el.current)
    return () => { ro.disconnect(); c.dispose() }
  }, [themeId])
  useEffect(() => { chart.current?.setOption({ aria: { enabled: true, decal: { show: true } }, animation: !reduced.current, ...option }, true) }, [option])
  const png = () => {
    const url = chart.current?.getDataURL({ pixelRatio: 2, backgroundColor: getComputedStyle(el.current!).backgroundColor })
    if (!url || !exportName) return
    const a = document.createElement('a')
    a.href = url; a.download = `${exportName}.png`; a.click()
  }
  return (
    <div className="relative">
      <div ref={el} role="img" aria-label={label} style={{ height }} className="w-full" />
      {exportName && <button className="btn absolute top-0 right-0 px-1.5! py-0.5! text-xs" onClick={png} aria-label={`Download ${exportName} as PNG`}>⬇ PNG</button>}
    </div>
  )
}

export function Loading<T>({ state, children, skeleton }: { state: { data?: T; error?: string; loading: boolean }; children: (d: T) => ReactNode; skeleton?: ReactNode }) {
  if (state.error) return <StatusMessage kind="error">Could not load data: {state.error}</StatusMessage>
  if (!state.data) return <>{skeleton ?? <StatusMessage kind="loading">Loading…</StatusMessage>}</>
  return <>{children(state.data)}</>
}
