import { useEffect, useMemo, useRef, useState } from 'react'
import { palette, rampColor, useTheme } from '../lib/theme'
import type { FC } from '../lib/types'
import { boxAreaKm2, type Box } from '../lib/box'

const MIN_KM2 = 100 // same floor as parseBox: reject at draw time, not after navigation
const REDUCED = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

type View = { x: number; y: number; w: number; h: number }
type Feat = { id: string; nameEn: string; nameBn: string; d: string; cx: number; cy: number; x0: number; y0: number; x1: number; y1: number }
type Proj = {
  feats: Feat[]
  fit: View
  toXY: (lon: number, lat: number) => [number, number]
  fromXY: (x: number, y: number) => [number, number]
}

const eachRing = (g: GeoJSON.Geometry, f: (ring: GeoJSON.Position[]) => void) => {
  if (g.type === 'Polygon') g.coordinates.forEach(f)
  else if (g.type === 'MultiPolygon') g.coordinates.forEach((poly) => poly.forEach(f))
}

/** Equirectangular projection scaled at the country's mid-latitude, fitted into ~1000 viewBox units. */
function buildMap(fc: FC): Proj {
  let lonMin = Infinity, latMin = Infinity, lonMax = -Infinity, latMax = -Infinity
  for (const f of fc.features)
    eachRing(f.geometry, (r) => r.forEach(([lon, lat]) => {
      if (lon < lonMin) lonMin = lon; if (lon > lonMax) lonMax = lon
      if (lat < latMin) latMin = lat; if (lat > latMax) latMax = lat
    }))
  const kx = Math.cos((((latMin + latMax) / 2) * Math.PI) / 180)
  const s = 1000 / Math.max((lonMax - lonMin) * kx, latMax - latMin)
  const toXY = (lon: number, lat: number): [number, number] => [(lon - lonMin) * kx * s, (latMax - lat) * s]
  const fromXY = (x: number, y: number): [number, number] => [lonMin + x / (kx * s), latMax - y / s]
  const pad = 16
  const fit: View = { x: -pad, y: -pad, w: (lonMax - lonMin) * kx * s + 2 * pad, h: (latMax - latMin) * s + 2 * pad }

  const feats: Feat[] = fc.features.map((f) => {
    let d = ''
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    eachRing(f.geometry, (r) => {
      let px = NaN, py = NaN, seg = ''
      for (let i = 0; i < r.length; i++) {
        const [x, y] = toXY(r[i][0], r[i][1])
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
        // decimate: drop points closer than ~0.6 units to the last kept one (invisible at any zoom, small DOM)
        if (i < r.length - 1 && Math.abs(x - px) + Math.abs(y - py) < 0.6) continue
        seg += `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10} `
        px = x; py = y
      }
      if (seg) d += `M${seg.trim()}Z`
    })
    return { id: f.properties.unit_id, nameEn: f.properties.name_en, nameBn: f.properties.name_bn, d, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, x0, y0, x1, y1 }
  })
  return { feats, fit, toXY, fromXY }
}

/** Country fit remembered across SPA navigations, so drilling in/out animates instead of jumping. */
let lastFit: View | null = null

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeOutQuart = (t: number) => 1 - (1 - t) ** 4
const contains = (outer: View, inner: View) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h

const clampView = (v: View, fit: View): View => {
  const w = Math.min(Math.max(v.w, fit.w * 0.04), fit.w * 1.8)
  const h = w * (fit.h / fit.w) // viewBox aspect is fixed; letterboxing does the rest
  const slack = 0.25
  return {
    w, h,
    x: Math.min(Math.max(v.x, fit.x - fit.w * slack), fit.x + fit.w - w + fit.w * slack),
    y: Math.min(Math.max(v.y, fit.y - fit.h * slack), fit.y + fit.h - h + fit.h * slack),
  }
}

/**
 * Basemap-free SVG choropleth of Bangladesh: districts/upazilas projected from the AOI GeoJSON,
 * fill = `values` on the fire ramp (absent = outline only). Fixed poster at country scale with
 * Ctrl+wheel zoom and drag pan; click selects; optional box drawing. No third-party tiles, no library.
 */
export default function BdMap({ fc, selected, onSelect, drawing, box, onBox, values, labels }: {
  fc: FC; selected?: string; onSelect: (id: string) => void; drawing: boolean; box?: Box; onBox: (b: Box) => void
  values?: Record<string, number>; labels: boolean
}) {
  const theme = useTheme()
  const p = palette()
  const max = Math.max(0, ...Object.values(values ?? {}))
  const { feats, fit, toXY, fromXY } = useMemo(() => buildMap(fc), [fc])
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<View>(() => lastFit ?? fit)
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  const [hint, setHint] = useState(false)
  const [drawBox, setDrawBox] = useState<{ a: View; b: View; km2: number } | null>(null)
  const raf = useRef(0)
  const viewRef = useRef(view)
  viewRef.current = view

  const toVB = (cx: number, cy: number): [number, number] => {
    const m = svgRef.current?.getScreenCTM()
    if (!m) return [0, 0]
    const pt = new DOMPoint(cx, cy).matrixTransform(m.inverse())
    return [pt.x, pt.y]
  }

  const animateTo = (target: View, from?: View) => {
    cancelAnimationFrame(raf.current)
    if (REDUCED || !from) { setView(target); return }
    const t0 = performance.now()
    const step = (now: number) => {
      const t = easeOutQuart(Math.min(1, (now - t0) / 420))
      setView({ x: lerp(from.x, target.x, t), y: lerp(from.y, target.y, t), w: lerp(from.w, target.w, t), h: lerp(from.h, target.h, t) })
      if (t < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }

  // Fit on fc change; animate when the extent drills in/out of the remembered country fit.
  useEffect(() => {
    const from = lastFit && (contains(lastFit, fit) || contains(fit, lastFit)) ? (viewRef.current = lastFit) : null
    animateTo(fit, from ?? undefined)
    if (contains(fit, lastFit ?? fit)) lastFit = fit
    return () => cancelAnimationFrame(raf.current)
  }, [fit])

  // Selecting a feature zooms to it (with breathing room); deselecting returns to the country poster.
  useEffect(() => {
    const f = feats.find((x) => x.id === selected)
    if (!f) return
    const bw = f.x1 - f.x0
    const w = Math.max(bw * 2.4, fit.w * 0.12) // context around the pick, clamped from losing the country
    const h = w * (fit.h / fit.w)
    animateTo(clampView({ w, h, x: f.cx - w / 2, y: f.cy - h / 2 }, fit))
  }, [selected, feats, fit])

  useEffect(() => { if (drawing) setHover(null) }, [drawing])

  const zoomAt = (cx: number, cy: number, f: number) => {
    const [px, py] = toVB(cx, cy)
    setView((v) => {
      const nv = clampView({ ...v, w: v.w / f, h: v.h / f }, fit)
      return { ...nv, x: px - (px - v.x) * (nv.w / v.w), y: py - (py - v.y) * (nv.h / v.h) } // keep the cursor point fixed
    })
  }

  // Pan (Ctrl/⌘+wheel zoom; plain wheel scrolls the page, with a hint), double-click zoom.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    let hintT = 0
    let panFrom: { cx: number; cy: number; view: View } | null = null
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); return }
      setHint(true); clearTimeout(hintT); hintT = window.setTimeout(() => setHint(false), 1200)
    }
    const down = (e: PointerEvent) => {
      if (drawing || !e.isPrimary || e.button !== 0 || e.target !== el) return // features handle their own clicks
      el.setPointerCapture(e.isPrimary ? e.pointerId : 0)
      panFrom = { cx: e.clientX, cy: e.clientY, view: viewRef.current }
    }
    const move = (e: PointerEvent) => {
      if (!panFrom) return
      const a = toVB(panFrom.cx, panFrom.cy), b = toVB(e.clientX, e.clientY)
      const v = panFrom.view
      setView(clampView({ ...v, x: v.x - (b[0] - a[0]), y: v.y - (b[1] - a[1]) }, fit))
    }
    const up = () => { panFrom = null }
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
    el.addEventListener('dblclick', (e) => zoomAt(e.clientX, e.clientY, 1.8))
    return () => {
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up)
      clearTimeout(hintT)
    }
  }, [drawing, fit]) // eslint-disable-line react-hooks/exhaustive-deps

  // Box drawing: pointer in viewBox units, released as a lon/lat Box.
  useEffect(() => {
    const el = svgRef.current
    if (!el || !drawing) return
    let start: [number, number] | null = null
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || start) return
      el.setPointerCapture(e.pointerId)
      start = toVB(e.clientX, e.clientY)
    }
    const move = (e: PointerEvent) => {
      if (!start || !e.isPrimary) return
      const end = toVB(e.clientX, e.clientY)
      const a = fromXY(...start), b = fromXY(...end)
      const km2 = boxAreaKm2([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])] as Box)
      setDrawBox({ a: { x: Math.min(start[0], end[0]), y: Math.min(start[1], end[1]), w: Math.abs(end[0] - start[0]), h: Math.abs(end[1] - start[1]) }, b: { x: e.clientX, y: e.clientY, w: 0, h: 0 }, km2 })
    }
    const up = (e: PointerEvent) => {
      if (!start || !e.isPrimary) return
      const end = toVB(e.clientX, e.clientY)
      const a = fromXY(...start), b = fromXY(...end)
      const bx: Box = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])].map((v) => Math.round(v * 1e4) / 1e4) as Box
      start = null; setDrawBox(null)
      if (boxAreaKm2(bx) >= MIN_KM2) onBox(bx)
    }
    el.style.cursor = 'crosshair'; el.style.touchAction = 'none'
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
    return () => {
      el.style.cursor = ''; el.style.touchAction = ''
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up)
    }
  }, [drawing, fromXY, onBox])

  const hovered = hover ? feats.find((f) => f.id === hover.id) : null
  const boxRect = useMemo(() => {
    if (!box) return null
    const [x0, y0] = toXY(box[0], box[3]), [x1, y1] = toXY(box[2], box[1])
    return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) }
  }, [box, toXY])
  const labelSize = Math.max(10, view.w * 0.013)

  return (
    <div ref={wrapRef} className="bd-map relative h-[440px] w-full overflow-hidden rounded-[10px] border border-line bg-bg select-none">
      <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} className="h-full w-full touch-none"
        role="group" aria-label="Bangladesh map — select an area to explore" data-theme={theme}>
        {feats.map((f) => {
          const v = values?.[f.id]
          const sel = f.id === selected
          return (
            <path key={f.id} d={f.d} className={`bd-feat${sel ? ' bd-sel map-sel' : ''}${drawing ? ' pointer-events-none' : ''}`}
              fill={v != null ? rampColor(v, max, p) : p.surface} fillOpacity={v != null ? 0.92 : 0.5}
              vectorEffect="non-scaling-stroke"
              tabIndex={drawing ? -1 : 0} role="button"
              aria-label={`${f.nameEn} · ${f.nameBn}${v != null ? ` · ${v}` : ''}`}
              aria-pressed={sel}
              onClick={() => !drawing && onSelect(f.id)}
              onKeyDown={(e) => { if (!drawing && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(f.id) } }}
              onPointerMove={(e) => {
                if (drawing) return
                const r = wrapRef.current!.getBoundingClientRect()
                setHover({ id: f.id, x: e.clientX - r.left, y: e.clientY - r.top })
              }}
              onPointerLeave={() => setHover(null)} />
          )
        })}
        {feats.map((f) => ((labels && view.w < fit.w * 0.6) || f.id === hovered?.id || f.id === selected) && (
          <text key={f.id} x={f.cx} y={f.cy} className="bd-label" fontSize={labelSize} textAnchor="middle" dominantBaseline="middle">
            {f.nameEn}
          </text>
        ))}
        {boxRect && <rect x={boxRect.x} y={boxRect.y} width={boxRect.w} height={boxRect.h} className="bd-boxrect" vectorEffect="non-scaling-stroke" />}
        {drawBox && (
          <>
            <rect x={drawBox.a.x} y={drawBox.a.y} width={drawBox.a.w} height={drawBox.a.h}
              className="bd-boxrect" strokeDasharray={drawBox.km2 >= MIN_KM2 ? undefined : '4 4'} fillOpacity={drawBox.km2 >= MIN_KM2 ? 0.12 : 0.04}
              vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {drawBox && (
        <div className="pointer-events-none absolute z-20 rounded-[4px] border border-line bg-surface px-2 py-0.5 text-xs font-semibold whitespace-nowrap shadow"
          style={{ left: Math.min(drawBox.b.x + 14, (wrapRef.current?.clientWidth ?? 0) - 200), top: drawBox.b.y + 14, color: drawBox.km2 >= MIN_KM2 ? 'var(--color-ink)' : 'var(--color-err)' }}>
          ≈ {Math.round(drawBox.km2).toLocaleString('en-US')} km²{drawBox.km2 >= MIN_KM2 ? '' : ' · too small (min 100 km²)'}
        </div>
      )}
      {hovered && hover && (
        <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[130%] rounded-[6px] border border-line bg-surface px-2 py-1 text-xs shadow"
          style={{ left: hover.x, top: hover.y }} role="tooltip">
          <b>{hovered.nameEn}</b> · {hovered.nameBn}
          {values?.[hovered.id] != null && <> · <span className="num">{values[hovered.id]}</span></>}
        </div>
      )}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-ink/30 text-sm font-medium text-on-ink transition-opacity duration-200"
        style={{ opacity: hint ? 1 : 0 }}>Hold Ctrl to zoom the map</div>
    </div>
  )
}
