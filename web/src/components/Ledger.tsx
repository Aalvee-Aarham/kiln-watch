import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { heatmapCells, seriesFor } from '../lib/calendar'
import { palette, useTheme } from '../lib/theme'
import { rituOf } from '../lib/ritu'
import { useLang, useT } from '../lib/i18n'
import { Icon, RituBand, SegmentedToggle, useReducedMotion } from './ui'
import type { Calendar, Events } from '../lib/types'

const LABEL_W = 44

/**
 * The Ledger: every day since 2003 for one area, as one image. Raw sits underneath; the harmonized view is one canvas
 * per year row whose opacity transitions in with a 30 ms row stagger (CSS, interruptible, --ease-in-out).
 * Both layers share one colour scale (harmonized p98), so under Raw the post-2012 rows visibly over-glow.
 */
export default function Ledger({ cal, events, caption }: { cal: Calendar; events?: Events; caption: string }) {
  const t = useT()
  const lang = useLang()
  const theme = useTheme()
  const reduced = useReducedMotion()
  const [mode, setMode] = useState<'raw' | 'harm'>(reduced ? 'harm' : 'raw')
  const [width, setWidth] = useState(0)
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const rawCv = useRef<HTMLCanvasElement>(null)
  const rowCv = useRef<(HTMLCanvasElement | null)[]>([])
  const played = useRef(false)

  const data = useMemo(() => {
    const harm = heatmapCells(cal, seriesFor(cal, 'harm', 'all'), 'cal')
    const raw = heatmapCells(cal, seriesFor(cal, 'raw', 'all'), 'cal')
    const pos = harm.cells.map((c) => c[2]).filter((v) => v > 0).sort((a, b) => a - b)
    const vmax = pos[Math.floor(pos.length * 0.98)] ?? 1
    const grid = (cells: [number, number, number][]) => { const m = new Map<number, number>(); for (const [x, y, v] of cells) m.set(y * 366 + x, v); return m }
    return { years: harm.years, harm: grid(harm.cells), raw: grid(raw.cells), vmax }
  }, [cal])
  const rows = data.years.length
  const cellH = width < 640 ? 7 : 10

  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth - LABEL_W))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Paint both layers whenever size, data or theme changes.
  useEffect(() => {
    if (width <= 0) return
    const p = palette()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const cw = width / 366
    const colour = (v: number) => v < 0 ? p.cloud : p.fire[Math.min(4, Math.max(0, Math.floor((v / data.vmax) * 5)))]
    const paint = (cv: HTMLCanvasElement | null, m: Map<number, number>, y0: number, y1: number) => {
      if (!cv) return
      cv.width = Math.round(width * dpr); cv.height = Math.round((y1 - y0) * cellH * dpr)
      const g = cv.getContext('2d')
      if (!g) return
      g.scale(dpr, dpr)
      g.fillStyle = p.surface2
      g.fillRect(0, 0, width, (y1 - y0) * cellH)
      for (let y = y0; y < y1; y++) for (let x = 0; x < 366; x++) {
        const v = m.get(y * 366 + x)
        if (v === undefined) continue
        g.fillStyle = colour(v)
        g.fillRect(x * cw, (y - y0) * cellH, Math.max(cw - 0.25, 0.75), cellH - 1)
      }
    }
    paint(rawCv.current, data.raw, 0, rows)
    for (let y = 0; y < rows; y++) paint(rowCv.current[y], data.harm, y, y + 1)
  }, [width, data, theme, rows, cellH])

  // Explanation, once: when the Ledger is first seen, settle raw → harmonized.
  useEffect(() => {
    if (reduced || played.current || !host.current) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || played.current) return
      played.current = true
      setTimeout(() => setMode('harm'), 500)
    }, { threshold: 0.5 })
    io.observe(host.current)
    return () => io.disconnect()
  }, [reduced])

  const replay = () => { setMode('raw'); setTimeout(() => setMode('harm'), 700) }
  const hover = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * 366), y = Math.floor((e.clientY - r.top) / cellH)
    if (x < 0 || x > 365 || y < 0 || y >= rows) return setTip(null)
    const date = new Date(Date.UTC(data.years[y], 0, 1 + x))
    const v = (mode === 'harm' ? data.harm : data.raw).get(y * 366 + x)
    const ritu = rituOf(date)
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, text: `${date.toISOString().slice(0, 10)} · ${lang === 'bn' ? ritu.bn : ritu.en} · ${v == null ? 'no fire detected' : v < 0 ? 'not observed (cloud)' : v.toFixed(2)}` })
  }
  const seam = data.years.indexOf(2012)

  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SegmentedToggle label="Raw or harmonized" value={mode} options={[['raw', t('raw')], ['harm', t('harm')]]} onChange={setMode} />
        {!reduced && <button className="btn btn-quiet" onClick={replay}><Icon name="replay" />{t('replay')}</button>}
        <span className="ml-auto text-sm text-muted">{mode === 'raw' ? 'Raw: each satellite in its own units' : 'Harmonized: one Aqua-MODIS scale'}</span>
      </div>
      <div ref={host} className="relative">
        <div className="flex">
          <div className="num shrink-0 text-right text-[11px] leading-none text-muted" style={{ width: LABEL_W - 8, marginRight: 8 }} aria-hidden>
            {data.years.map((y, i) => <div key={y} style={{ height: cellH }} className={`flex items-center justify-end ${i === seam || (i % (cellH < 10 ? 4 : 2) === 0 && (seam < 0 || Math.abs(i - seam) >= 2)) ? '' : 'invisible'} ${i === seam ? 'font-semibold text-ink' : ''}`}>{y}</div>)}
          </div>
          <div className="measure relative min-w-0 flex-1" onMouseMove={hover} onMouseLeave={() => setTip(null)}
            role="img" aria-label={`${caption}. ${mode === 'raw' ? 'Raw view: rows from 2012 glow brighter because the VIIRS sensor sees smaller fires.' : 'Harmonized view: rows before and after 2012 share one scale.'}`}>
            <canvas ref={rawCv} className="block w-full" style={{ height: rows * cellH }} />
            {data.years.map((y, i) => (
              <canvas key={y} ref={(el) => { rowCv.current[i] = el }} className="absolute left-0 block w-full"
                style={{ top: i * cellH, height: cellH, opacity: mode === 'harm' ? 1 : 0,
                  transition: reduced ? 'none' : `opacity 260ms var(--ease-in-out) ${(mode === 'harm' ? i : rows - 1 - i) * 30}ms` }} />
            ))}
            {seam >= 0 && <div aria-hidden className="pointer-events-none absolute -left-1 h-px w-[calc(100%+4px)] bg-ink/50" style={{ top: seam * cellH - 0.5 }} />}
            {tip && <div className="pointer-events-none absolute z-10 rounded-[4px] border border-line bg-surface px-2 py-1 text-xs whitespace-nowrap shadow"
              style={{ left: Math.min(tip.x + 12, width - 220), top: tip.y + 14 }}>{tip.text}</div>}
          </div>
        </div>
        <div className="mt-1"><RituBand layout="cal" events={events} left={LABEL_W} right={0} /></div>
      </div>
      <figcaption className="mt-1 text-xs text-muted">{caption}. Each row is a year, each cell a day. Blue-grey: not observed (cloud). The rule marks 2012, when VIIRS arrived.</figcaption>
    </figure>
  )
}
