import { useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { Pass } from '../../lib/space/orbit'
import type { SatColors } from '../../lib/space/scenes'
import type { Sensor } from '../../lib/types'
import type { Director } from './director'
import { useStore, type Playback, type Store } from './store'

// Video-style time bars at the bottom of the globe: the day of passes (chapter 1) and the season (chapter 2).

const HOUR = 3_600_000
const fmtClock = (t: number, offset_h: number) => new Date(t + offset_h * HOUR).toISOString().slice(11, 16)
const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']

function PlayButton({ playing, onClick, label }: { playing: boolean; onClick: () => void; label: string }) {
  return (
    <button className="space-play" onClick={onClick} aria-label={playing ? `Pause ${label}` : `Play ${label}`} title={playing ? 'Pause (space)' : 'Play (space)'}>
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden fill="currentColor">
        {playing ? <path d="M4 3h3v10H4zM9 3h3v10H9z" /> : <path d="M4.5 2.8v10.4L13 8z" />}
      </svg>
    </button>
  )
}

/** A horizontal scrubber: drag or click anywhere; arrow keys step; the playhead sits at `value` (0–1). */
function Track({ value, onSeek, step, label, valueText, tall, children }: {
  value: number; onSeek: (f: number) => void; step: number; label: string; valueText: string; tall?: boolean; children?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const at = (x: number) => { const r = ref.current!.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)) }
  const key = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : 0
    if (d) { e.preventDefault(); onSeek(Math.max(0, Math.min(1, value + d))) }
    else if (e.key === 'Home') { e.preventDefault(); onSeek(0) } else if (e.key === 'End') { e.preventDefault(); onSeek(1) }
  }
  return (
    <div ref={ref} className={`space-track ${tall ? 'is-tall' : ''}`} role="slider" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-valuetext={valueText}
      onKeyDown={key}
      onPointerDown={(e) => { ref.current!.setPointerCapture(e.pointerId); onSeek(at(e.clientX)) }}
      onPointerMove={(e) => { if (e.buttons) onSeek(at(e.clientX)) }}>
      {children}
      <span className="space-track-fill" style={{ width: `${value * 100}%` }} />
      <span className="space-playhead" style={{ left: `${value * 100}%` }} />
    </div>
  )
}

/** Chapter 1: one local day, 00:00–24:00 at the chosen place, with a marker at every pass. */
export function DayBar({ director, store, dayStartUtc, offsetH, clockLabel, passes, colors, names, lit }: {
  director: Director; store: Store<Playback>; dayStartUtc: number; offsetH: number; clockLabel: string
  passes: Pass[]; colors: SatColors; names: Record<Sensor, string>; lit?: Set<Sensor>
}) {
  const fmtLocal = (x: number) => fmtClock(x, offsetH)
  const t = useStore(store, (s) => s.t), playing = useStore(store, (s) => s.playing), slow = useStore(store, (s) => s.slow)
  const f = Math.max(0, Math.min(1, (t - dayStartUtc) / (24 * HOUR)))
  const seek = (x: number) => director.seek(dayStartUtc + x * 24 * HOUR)
  return (
    <div className="space-bar">
      <PlayButton playing={playing} onClick={() => (playing ? director.pause() : director.play())} label="the day" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
          <span className="whitespace-nowrap"><b className="num text-[15px] text-ink">{fmtLocal(t)}</b> <span className="text-muted">{clockLabel}</span></span>
          <span className={`truncate text-muted transition-opacity ${slow && playing ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
            {slow && playing ? <><span className="sm:hidden">Slowed for a pass</span><span className="max-sm:hidden">Slowed down: a satellite is passing</span></> : ''}</span>
        </div>
        <Track value={f} onSeek={seek} step={10 / (24 * 60)} label="Time of day" valueText={`${fmtLocal(t)} ${clockLabel}`}>
          {[0, 6, 12, 18, 24].map((h) => <span key={h} className="space-tick" style={{ left: `${(h / 24) * 100}%` }}><span>{String(h).padStart(2, '0')}:00</span></span>)}
          {passes.map((p) => {
            const x = (p.t_utc - dayStartUtc) / (24 * HOUR)
            if (x < 0 || x > 1) return null
            const on = !lit || lit.has(p.sat)
            return <button key={p.sat + p.pass} className={`space-pass ${p.pass === 'N' ? 'is-night' : ''} ${on ? '' : 'is-dim'}`} style={{ left: `${x * 100}%`, ['--c' as string]: colors[p.sat] }}
              title={`${names[p.sat]} · ${p.pass === 'D' ? 'day' : 'night'} pass · ${fmtLocal(p.t_utc)}`} aria-label={`Jump to ${names[p.sat]}'s ${p.pass === 'D' ? 'day' : 'night'} pass at ${fmtLocal(p.t_utc)}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => { director.seek(p.t_utc - 8 * 60_000); director.play() }} />
          })}
        </Track>
      </div>
    </div>
  )
}

/** Chapter 2: one season, 1 July – 30 June, over a small graph of fire-days per day. */
export function SeasonBar({ director, store, nDays, day0Utc, totals, season }: {
  director: Director; store: Store<Playback>; nDays: number; day0Utc: number; totals: number[]; season: string
}) {
  const day = useStore(store, (s) => s.day), playing = useStore(store, (s) => s.seasonPlaying)
  const f = nDays > 1 ? day / (nDays - 1) : 0
  const graph = useMemo(() => {
    const max = Math.max(1, ...totals), w = totals.length
    return { w, d: totals.map((v, i) => (v ? `M${i + 0.5} 24V${24 - Math.max(1.5, (22 * Math.sqrt(v)) / Math.sqrt(max))}` : '')).join('') }
  }, [totals])
  const y = +season.slice(0, 4)
  const months = MONTHS.map((m, i) => ({ m, x: Math.round((Date.UTC(y, 6 + i, 1) - Date.UTC(y, 6, 1)) / 86_400_000) / Math.max(1, nDays - 1) }))
  const date = new Date(day0Utc + day * 86_400_000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace('Sept', 'Sep')
  return (
    <div className="space-bar">
      <PlayButton playing={playing} onClick={() => (playing ? director.pauseSeason() : director.playSeason())} label="the season" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
          <span className="whitespace-nowrap"><b className="num text-[15px] text-ink">{date}</b> <span className="text-muted">season {season}</span></span>
          <span className="truncate text-muted max-sm:hidden">bars: fire-days each day</span>
        </div>
        <Track value={f} onSeek={(x) => { director.pauseSeason(); director.seekDay(Math.round(x * (nDays - 1))) }} step={1 / Math.max(1, nDays - 1)}
          label="Day of the season" valueText={date} tall>
          <svg className="space-graph" viewBox={`0 0 ${graph.w} 24`} preserveAspectRatio="none" aria-hidden>
            <path d={graph.d} />
          </svg>
          {months.map(({ m, x }) => <span key={m} className="space-tick" style={{ left: `${x * 100}%` }}><span>{m}</span></span>)}
        </Track>
      </div>
    </div>
  )
}
