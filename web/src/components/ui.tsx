import { Component, type ReactNode, useEffect, useRef } from 'react'
import { NavLink, useSearchParams } from 'react-router'
import { echarts, type EOption } from '../lib/echarts'
import { useJson } from '../lib/data'
import { useLang, useT } from '../lib/i18n'
import type { CI, Meta } from '../lib/types'

export function useMeta() { return useJson<Meta>('meta.json') }

export function AppShell({ children }: { children: ReactNode }) {
  const t = useT()
  const meta = useMeta().data
  const [sp] = useSearchParams()
  const q = sp.get('lang') === 'bn' ? '?lang=bn' : ''
  const hideKilns = meta && (meta.gate_branch === 'partial' || meta.gate_branch === 'nokiln')
  const tabs: [string, Parameters<typeof t>[0]][] = [['/', 'story'], ['/explore', 'explore'], ...(hideKilns ? [] : [['/kilns', 'kilns'] as [string, 'kilns']]),
    ['/season', 'season'], ['/evidence', 'evidence'], ['/method', 'method']]
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-[1000] border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <NavLink to={'/' + q} className="mr-2 font-bold text-orange-700">🔥 Kiln Watch</NavLink>
          <nav aria-label="Main" className="flex flex-wrap gap-1">
            {tabs.map(([to, k]) => (
              <NavLink key={to} to={to + q} end={to === '/'}
                className={({ isActive }) => `rounded-md px-2.5 py-1 text-sm ${isActive ? 'bg-orange-100 font-semibold text-orange-800' : 'text-stone-700 hover:bg-stone-100'}`}>
                {t(k)}
              </NavLink>
            ))}
          </nav>
          <LangToggle />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-stone-500">
        NASA Space Apps 2026 · Harmonization of MODIS and VIIRS Hot Spots · data build <code>{meta?.git_sha ?? '…'}</code>
        {meta && <> · generated {meta.generated_at.slice(0, 10)}</>} · Outputs are inspection leads, not findings of illegality.
      </footer>
    </div>
  )
}

function LangToggle() {
  const lang = useLang()
  const [sp, setSp] = useSearchParams()
  return (
    <button className="btn ml-auto" aria-label="Switch language"
      onClick={() => { const n = new URLSearchParams(sp); if (lang === 'bn') n.delete('lang'); else n.set('lang', 'bn'); setSp(n) }}>
      {lang === 'bn' ? 'English' : 'বাংলা'}
    </button>
  )
}

export function ChartCard({ title, summary, children, actions }: { title: string; summary?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card" aria-label={title}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{title}</h3>
        <div className="ml-auto flex flex-wrap gap-2">{actions}</div>
      </div>
      {children}
      {summary && <p className="note">{summary}</p>}
    </section>
  )
}

export function SegmentedToggle<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-md border border-stone-300 text-sm">
      {options.map(([v, l]) => (
        <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`px-2.5 py-1 ${value === v ? 'bg-orange-600 text-white' : 'bg-white hover:bg-stone-100'}`}>{l}</button>
      ))}
    </div>
  )
}

export const fmt = (v: number | null | undefined, d = 2) =>
  v == null || !Number.isFinite(v) ? '–' : v !== 0 && Math.abs(v) < 1e-3 ? v.toExponential(1) : Number(v.toFixed(d)).toLocaleString(undefined, { maximumFractionDigits: d })
export const CIText = ({ ci, d = 2 }: { ci: CI; d?: number }) => (
  <span>{fmt(ci.p50, d)} <span className="text-stone-500">[{fmt(ci.lo, d)}–{fmt(ci.hi, d)}]</span></span>
)

export function StatusMessage({ kind = 'info', children }: { kind?: 'info' | 'error' | 'loading'; children: ReactNode }) {
  const c = kind === 'error' ? 'border-red-300 bg-red-50 text-red-800' : kind === 'loading' ? 'border-stone-200 bg-stone-50 text-stone-600' : 'border-amber-300 bg-amber-50 text-amber-900'
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${c}`}>{children}</div>
}

export const ProvisionalBadge = () => <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">PROVISIONAL</span>

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

export class ErrorBoundary extends Component<{ children: ReactNode }, { err?: string }> {
  state: { err?: string } = {}
  static getDerivedStateFromError(e: Error) { return { err: e.message } }
  render() { return this.state.err ? <StatusMessage kind="error">Something went wrong: {this.state.err}</StatusMessage> : this.props.children }
}

/** ECharts host: ARIA on, resizes with its container. */
export function EChart({ option, height = 320, label }: { option: EOption; height?: number; label: string }) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<ReturnType<typeof echarts.init>>(null)
  useEffect(() => {
    if (!el.current) return
    const c = echarts.init(el.current)
    chart.current = c
    const ro = new ResizeObserver(() => c.resize())
    ro.observe(el.current)
    return () => { ro.disconnect(); c.dispose() }
  }, [])
  useEffect(() => { chart.current?.setOption({ aria: { enabled: true, decal: { show: true } }, ...option }, true) }, [option])
  return <div ref={el} role="img" aria-label={label} style={{ height }} className="w-full" />
}

export function Loading<T>({ state, children }: { state: { data?: T; error?: string; loading: boolean }; children: (d: T) => ReactNode }) {
  if (state.error) return <StatusMessage kind="error">Could not load data: {state.error}</StatusMessage>
  if (!state.data) return <StatusMessage kind="loading">Loading…</StatusMessage>
  return <>{children(state.data)}</>
}
