import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { palette, rampColor, useTheme } from '../lib/theme'
import type { FC } from '../lib/types'
import { boxAreaKm2, WORLD_BOX, type Box } from '../lib/box'
import { STATES_W } from '../lib/world'
// NASA GIBS images in EPSG:4326 (plate carrée): they line up with this map's equirectangular projection by their corners.
// Bundled, so the layers work with the network off. Without `world` only the Bangladesh image (the last) is drawn.
import { IMAGERY, LAYERS, readLayer, saveLayer, type Layer } from '../lib/basemap'
import { Icon } from './ui'

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
    const { d, x0, y0, x1, y1 } = projectPath(f.geometry, toXY, 0.6)
    return { id: f.properties.unit_id, nameEn: f.properties.name_en, nameBn: f.properties.name_bn, d, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, x0, y0, x1, y1 }
  })
  return { feats, fit, toXY, fromXY }
}

/** Map labels use the everyday name where the data carries the formal one. */
const SHORT_NAME: Record<string, string> = { CHN: 'China' }

type Anchor = { x: number; y: number; w: number; ring: [number, number][] }
type Shape = { id: string; name: string; d: string; b: [number, number, number, number]; label: Anchor }
/** Context shapes (countries, states) in this projection with bounds for culling, biggest first (they win name collisions). */
function shapesOf(fc: FC | undefined, toXY: Proj['toXY'], step: number, rename = (_id: string, name: string) => name): Shape[] {
  return (fc?.features ?? []).map((f) => {
    const { d, x0, y0, x1, y1 } = projectPath(f.geometry, toXY, step)
    return { id: f.properties.unit_id, name: rename(f.properties.unit_id, f.properties.name_en), d, b: [x0, y0, x1, y1] as Shape['b'], label: labelAnchor(f.geometry, toXY) }
  }).sort((a, b) => b.label.w - a.label.w)
}
/** Where a country's name goes: the middle of its largest piece (France on France, not between its islands), and that piece. */
function labelAnchor(g: GeoJSON.Geometry, toXY: Proj['toXY']): Anchor {
  let best: Anchor = { x: 0, y: 0, w: 0, ring: [] }, bestA = -1
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
  for (const poly of polys) {
    const ring = poly[0].map(([lon, lat]) => toXY(lon, lat))
    const xs = ring.map((q) => q[0]), ys = ring.map((q) => q[1])
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    if ((x1 - x0) * (y1 - y0) > bestA) { bestA = (x1 - x0) * (y1 - y0); best = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, ring } }
  }
  return best
}
/** Point in polygon (even-odd ray cast). */
function inside(x: number, y: number, ring: [number, number][]) {
  let c = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

/** SVG path of a (Multi)Polygon in this map's units and its bounds; points closer than `step` units to the last kept one drop. */
function projectPath(g: GeoJSON.Geometry, toXY: Proj['toXY'], step: number) {
  let d = ''
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  eachRing(g, (r) => {
    let px = NaN, py = NaN, seg = ''
    for (let i = 0; i < r.length; i++) {
      const [x, y] = toXY(r[i][0], r[i][1])
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      // decimate: at 0.6 units (districts) invisible at any zoom, small DOM
      if (i < r.length - 1 && Math.abs(x - px) + Math.abs(y - py) < step) continue
      seg += `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10} `
      px = x; py = y
    }
    if (seg) d += `M${seg.trim()}Z`
  })
  return { d, x0, y0, x1, y1 }
}

/** Country fit remembered across SPA navigations, so drilling in/out animates instead of jumping. */
let lastFit: View | null = null

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeOutQuart = (t: number) => 1 - (1 - t) ** 4
const contains = (outer: View, inner: View) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h

/** Zoom and pan limits: the country poster with some slack, or anywhere in `outer` (the world) when the map shows it. */
const clampView = (v: View, fit: View, outer?: View): View => {
  const w = Math.min(Math.max(v.w, fit.w * 0.04), outer ? Math.max(outer.w, fit.w * 1.8) : fit.w * 1.8)
  const h = w * (fit.h / fit.w) // viewBox aspect is fixed; letterboxing does the rest
  const into = (p: number, size: number, lo: number, span: number) => (size >= span ? lo + (span - size) / 2 : Math.min(Math.max(p, lo), lo + span - size))
  if (outer) return { w, h, x: into(v.x, w, outer.x, outer.w), y: into(v.y, h, outer.y, outer.h) }
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
 * Optional `pins` (count per area) draw at each area's centre — area-level, never a kiln or fire location.
 */
export default function BdMap({ fc, selected, onSelect, drawing, box, onBox, values, labels, pins, onPin, pinLabel, controls, wheelZoom, world, regions, keepClear, className = 'h-[440px] rounded-[10px] border border-line' }: {
  fc: FC; selected?: string; onSelect: (id: string) => void; drawing: boolean; box?: Box; onBox: (b: Box) => void
  values?: Record<string, number>; labels: boolean
  pins?: Record<string, number>; onPin?: (id: string) => void; pinLabel?: (id: string, n: number) => string; controls?: boolean; wheelZoom?: boolean; world?: FC; regions?: FC; keepClear?: [number, number]; className?: string
}) {
  const theme = useTheme()
  const p = palette()
  const max = Math.max(0, ...Object.values(values ?? {}))
  const { feats, fit, toXY, fromXY } = useMemo(() => buildMap(fc), [fc])
  // World context (news map): every country in this projection; the areas' outer edge is drawn bold (see the mask below).
  const countries = useMemo(() => shapesOf(world, toXY, 2, (id, name) => SHORT_NAME[id] ?? name), [world, toXY])
  // States and provinces (world_states.geojson): fainter lines and smaller names once zoomed in, like any map; Bangladesh's
  // own divisions are left out (its districts are drawn).
  const states = useMemo(() => shapesOf(regions && { ...regions, features: regions.features.filter((f) => (f.properties as { adm0?: string }).adm0 !== 'BGD') },
    toXY, 1.5), [regions, toXY])
  const unitsPerDeg = useMemo(() => toXY(1, 0)[0] - toXY(0, 0)[0], [toXY])
  const maskId = `bd-out-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const outer = useMemo(() => {
    if (!world) return undefined
    const [x0, y0] = toXY(WORLD_BOX[0], WORLD_BOX[3]), [x1, y1] = toXY(WORLD_BOX[2], WORLD_BOX[1])
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  }, [world, toXY])
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<View>(() => lastFit ?? fit)
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  const [hint, setHint] = useState(false)
  const [drawBox, setDrawBox] = useState<{ a: View; b: View; km2: number } | null>(null)
  const [layer, setLayer] = useState<Layer>(readLayer)
  const pickLayer = (l: Layer) => { setLayer(l); saveLayer(l) }
  const raf = useRef(0)
  const viewRef = useRef(view)
  viewRef.current = view

  const toVB = (cx: number, cy: number): [number, number] => {
    const m = svgRef.current?.getScreenCTM()
    if (!m) return [0, 0]
    const pt = new DOMPoint(cx, cy).matrixTransform(m.inverse())
    return [pt.x, pt.y]
  }

  const glideTarget = useRef<View | null>(null) // where wheel/button zooms are easing to; successive ticks add up
  const dragged = useRef(false) // the last press became a drag: its click must not select
  const show = (v: View) => { viewRef.current = v; setView(v) }

  const animateTo = (target: View, from?: View) => {
    cancelAnimationFrame(raf.current)
    glideTarget.current = null
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
    animateTo(clampView({ w, h, x: f.cx - w / 2, y: f.cy - h / 2 }, fit, outer), viewRef.current) // fly there, don't jump
  }, [selected, feats, fit, outer])

  useEffect(() => { if (drawing) setHover(null) }, [drawing])

  // SVG size in px, for pins only
  const [svgPx, setSvgPx] = useState({ w: 0, h: 0 })
  const hasPins = !!pins
  useEffect(() => {
    const el = svgRef.current
    if (!el || !hasPins) return
    const ro = new ResizeObserver(() => setSvgPx({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasPins])

  // --- motion: zooms glide to a target; drags follow the pointer 1:1 and coast on release ---

  /** Client point → fraction of the drawn map (the viewBox keeps the fit's aspect, centred, so this is zoom-independent). */
  const frac = (cx: number, cy: number): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect()
    const s = Math.min(r.width / fit.w, r.height / fit.h), cw = fit.w * s, ch = fit.h * s
    return [(cx - r.left - (r.width - cw) / 2) / cw, (cy - r.top - (r.height - ch) / 2) / ch]
  }
  /** Ease the view toward `target` every frame (exponential smoothing), so wheel ticks and button presses blend. */
  const glide = (target: View) => {
    cancelAnimationFrame(raf.current)
    if (REDUCED) { glideTarget.current = null; show(target); return }
    glideTarget.current = target
    let last = performance.now()
    const step = (now: number) => {
      const t = glideTarget.current
      if (!t) return
      // ~70 ms time constant, frame-rate independent; a frame stamped before the glide began moves nothing (never backwards)
      const k = 1 - Math.exp(-Math.max(0, now - last) / 70)
      last = now
      const v = viewRef.current
      const nv = { x: lerp(v.x, t.x, k), y: lerp(v.y, t.y, k), w: lerp(v.w, t.w, k), h: lerp(v.h, t.h, k) }
      const done = Math.abs(nv.w - t.w) + Math.abs(nv.x - t.x) + Math.abs(nv.y - t.y) < t.w * 2e-4
      show(done ? t : nv)
      if (done) glideTarget.current = null
      else raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }
  /** Zoom by `f` about a fraction of the map, from where the view is heading (so repeated ticks accumulate). */
  const zoomFrac = (fx: number, fy: number, f: number, now = false) => {
    if (now) { cancelAnimationFrame(raf.current); glideTarget.current = null } // pinch: follow the fingers, no easing
    const base = glideTarget.current ?? viewRef.current
    const z = clampView({ ...base, w: base.w / f, h: base.h / f }, fit, outer) // clamps the zoom level
    const target = clampView({ ...z, x: base.x + fx * (base.w - z.w), y: base.y + fy * (base.h - z.h) }, fit, outer)
    if (now) show(target)
    else glide(target)
  }
  const zoomBy = (f: number) => zoomFrac(0.5, 0.5, f) // +/- buttons
  const zoomAt = (cx: number, cy: number, f: number, now = false) => { const [fx, fy] = frac(cx, cy); zoomFrac(fx, fy, f, now) }

  // Drag anywhere to pan (a press that moves < 4 px stays a click), fling to coast, pinch (touch or touchpad) to zoom,
  // with `wheelZoom` a two-finger touchpad swipe pans and a mouse wheel zooms (else Ctrl/⌘+wheel zooms and plain wheel
  // scrolls the page, with a hint), double-click to zoom in.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    let hintT = 0
    const pts = new Map<number, { x: number; y: number }>()
    let pan: { id: number; cx: number; cy: number; f: [number, number]; view: View; moved: boolean } | null = null
    let pinch: { d0: number; p0: [number, number]; view: View } | null = null
    let samples: { t: number; x: number; y: number }[] = []
    const stop = () => { cancelAnimationFrame(raf.current); glideTarget.current = null }
    const startPan = (id: number, x: number, y: number) => {
      const v = viewRef.current
      pan = { id, cx: x, cy: y, f: frac(x, y), view: v, moved: false }
      samples = [{ t: performance.now(), x, y }]
    }
    const coast = (vx: number, vy: number) => { // px/ms → glide with friction, stopping at the map's edges
      if (REDUCED) return
      const r = svgRef.current!.getBoundingClientRect()
      const upp = fit.w / (fit.w * Math.min(r.width / fit.w, r.height / fit.h)) // viewBox units per px at fit
      let last = performance.now()
      const step = (now: number) => {
        const dt = Math.min(32, Math.max(0, now - last)); last = now
        const v = viewRef.current, s = (upp * v.w) / fit.w
        const want = { ...v, x: v.x - vx * dt * s, y: v.y - vy * dt * s }
        const nv = clampView(want, fit, outer)
        if (nv.x !== want.x) vx = 0
        if (nv.y !== want.y) vy = 0
        show(nv)
        const decay = Math.exp(-dt / 325)
        vx *= decay; vy *= decay
        if (Math.hypot(vx, vy) > 0.02) raf.current = requestAnimationFrame(step)
      }
      raf.current = requestAnimationFrame(step)
    }
    // Touchpads send wheel events too: a two-finger swipe as plain deltaX/deltaY, a pinch as Ctrl+wheel. A mouse wheel
    // sends big vertical-only steps. Anything touchpad-like marks the next 500 ms as touchpad, so one gesture stays one kind.
    let padUntil = 0
    const touchpad = (e: WheelEvent) => {
      const now = performance.now()
      if (e.deltaMode === 0 && (e.deltaX !== 0 || Math.abs(e.deltaY) < 50)) padUntil = now + 500
      return now < padUntil
    }
    const wheel = (e: WheelEvent) => {
      const line = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
      const pad = touchpad(e)
      if (e.ctrlKey || e.metaKey) { // pinch (touchpad) or Ctrl+wheel (mouse)
        e.preventDefault()
        const dy = e.deltaY * line
        if (pad) zoomAt(e.clientX, e.clientY, Math.exp(-Math.max(-50, Math.min(50, dy)) * 0.01), true) // ≈ the pinch's own scale
        else zoomAt(e.clientX, e.clientY, Math.exp(-Math.max(-300, Math.min(300, dy)) * 0.002))
        return
      }
      if (!wheelZoom) { setHint(true); clearTimeout(hintT); hintT = window.setTimeout(() => setHint(false), 1200); return }
      e.preventDefault()
      if (pad) { // two-finger swipe: move the map with the fingers, like scrolling a page
        stop()
        const r = el.getBoundingClientRect(), v = viewRef.current
        const u = v.w / (fit.w * Math.min(r.width / fit.w, r.height / fit.h)) // viewBox units per px at this zoom
        show(clampView({ ...v, x: v.x + e.deltaX * line * u, y: v.y + e.deltaY * line * u }, fit, outer))
        return
      }
      zoomAt(e.clientX, e.clientY, Math.exp(-Math.max(-300, Math.min(300, e.deltaY * line)) * 0.002)) // mouse wheel
    }
    const down = (e: PointerEvent) => {
      if (drawing || (e.pointerType === 'mouse' && e.button !== 0)) return
      stop()
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pts.size === 1) {
        dragged.current = false
        startPan(e.pointerId, e.clientX, e.clientY)
        // empty ground has no click to protect: grabbing at once (bg_cursor_plan.md §3); a feature waits for the 4 px drag
        if (e.target === el) document.documentElement.classList.add('is-panning')
      }
      else if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, v = viewRef.current, [fx, fy] = frac(mx, my)
        pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, p0: [v.x + fx * v.w, v.y + fy * v.h], view: v }
        pan = null; dragged.current = true
        for (const id of pts.keys()) { try { el.setPointerCapture(id) } catch { /* pointer already gone */ } }
      }
    }
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pinch && pts.size >= 2) {
        const [a, b] = [...pts.values()]
        const [fx, fy] = frac((a.x + b.x) / 2, (a.y + b.y) / 2)
        const v0 = pinch.view, f = Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0
        const z = clampView({ ...v0, w: v0.w / f, h: v0.h / f }, fit, outer)
        show(clampView({ ...z, x: pinch.p0[0] - fx * z.w, y: pinch.p0[1] - fy * z.h }, fit, outer)) // the pinched point stays under the fingers
        return
      }
      if (!pan || pan.id !== e.pointerId) return
      if (!pan.moved) {
        if (Math.hypot(e.clientX - pan.cx, e.clientY - pan.cy) < 4) return
        pan.moved = true; dragged.current = true
        el.setPointerCapture(e.pointerId)
        document.documentElement.classList.add('is-panning')
      }
      const [fx, fy] = frac(e.clientX, e.clientY), v = pan.view
      show(clampView({ ...v, x: v.x + (pan.f[0] - fx) * v.w, y: v.y + (pan.f[1] - fy) * v.h }, fit, outer)) // the grabbed point stays under the pointer
      const now = performance.now()
      samples.push({ t: now, x: e.clientX, y: e.clientY })
      while (samples.length > 2 && now - samples[0].t > 100) samples.shift()
    }
    const up = (e: PointerEvent) => {
      if (!pts.delete(e.pointerId)) return
      if (pinch) {
        if (pts.size < 2) pinch = null
        if (pts.size === 1) { const [[id, p]] = [...pts]; startPan(id, p.x, p.y); pan!.moved = true }
        return
      }
      if (pan?.moved && e.type === 'pointerup') {
        const a = samples[0], b = samples.at(-1)!, dt = performance.now() - a.t
        if (dt > 0 && performance.now() - b.t < 60) coast((b.x - a.x) / dt, (b.y - a.y) / dt)
      }
      pan = null
      document.documentElement.classList.remove('is-panning')
    }
    const dbl = (e: MouseEvent) => zoomAt(e.clientX, e.clientY, 2)
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
    el.addEventListener('dblclick', dbl)
    return () => {
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up)
      el.removeEventListener('dblclick', dbl)
      clearTimeout(hintT)
      cancelAnimationFrame(raf.current)
      document.documentElement.classList.remove('is-panning')
    }
  }, [drawing, fit, outer, wheelZoom]) // eslint-disable-line react-hooks/exhaustive-deps

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
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
    return () => {
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
  // pins keep a constant on-screen size: radius in px over px-per-unit (the viewBox is letterboxed, "meet")
  const ppu = svgPx.w && svgPx.h ? Math.min(svgPx.w / view.w, svgPx.h / view.h) : 0
  const pinR = (n: number) => (ppu ? (6 + 2.5 * Math.sqrt(n)) / ppu : 0)
  const labelSize = ppu ? 13 / ppu : Math.max(10, view.w * 0.013) // with pins (px known): 13 px on screen at any zoom
  // What is on screen (the viewBox is letterboxed, so wider than view), and whether states are near enough to show.
  const vis = ppu ? { L: view.x + view.w / 2 - svgPx.w / ppu / 2, T: view.y + view.h / 2 - svgPx.h / ppu / 2, R: view.x + view.w / 2 + svgPx.w / ppu / 2, B: view.y + view.h / 2 + svgPx.h / ppu / 2 } : null
  const onScreen = (b: number[]) => !vis || (b[2] >= vis.L && b[0] <= vis.R && b[3] >= vis.T && b[1] <= vis.B)
  const showStates = !!vis && (vis.R - vis.L) / unitsPerDeg <= STATES_W
  // Names, like any map: countries first (biggest first), then states; each at its largest piece's middle or, when that is
  // off screen, the spot on its own land nearest it; none overlapping another name, Bangladesh or the map's controls.
  const names = (() => {
    if (!vis || !countries.length) return []
    const { L, T, R, B } = vis, vw = R - L, vh = B - T, m = 70 / ppu, px = (n: number) => n / ppu
    const placed: [number, number, number, number][] = [[fit.x, fit.y, fit.x + fit.w, fit.y + fit.h], // Bangladesh
      [L, T, L + px(70), T + px(150)], [R - px(200), T, R, T + px(56)], // zoom buttons, background switch
      ...(keepClear ? [[R - px(keepClear[0]), B - px(keepClear[1]), R, B] as [number, number, number, number]] : [])] // the page's overlay
    const grid = Array.from({ length: 63 }, (_, i) => [L + m + ((i % 9) / 8) * (vw - 2 * m), T + m + (Math.floor(i / 9) / 6) * (vh - 2 * m)])
    const out: { id: string; name: string; x: number; y: number; state: boolean }[] = []
    const place = (list: Shape[], minPx: number, state: boolean) => {
      for (const c of list) {
        if (c.id === 'BGD' || !c.name) continue
        if (c.label.w * ppu < minPx) break // sorted by size: the rest are too small to name at this zoom
        if (!onScreen(c.b)) continue
        const hw = (c.name.length * (state ? 3.2 : 3.6) + 6) / ppu, hh = 9 / ppu
        const cands = [[c.label.x, c.label.y], ...[...grid].sort((a, b) => Math.hypot(a[0] - c.label.x, a[1] - c.label.y) - Math.hypot(b[0] - c.label.x, b[1] - c.label.y))]
        for (const q of cands) {
          if (q[0] < L + m || q[0] > R - m || q[1] < T + m || q[1] > B - m || !inside(q[0], q[1], c.label.ring)) continue
          const box: [number, number, number, number] = [q[0] - hw, q[1] - hh, q[0] + hw, q[1] + hh]
          if (placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue
          placed.push(box); out.push({ id: c.id, name: c.name, x: q[0], y: q[1], state })
          break
        }
      }
    }
    place(countries, 45, false)
    if (showStates) place(states, 70, true)
    return out
  })()
  const imgs = useMemo(() => (world ? IMAGERY : IMAGERY.slice(-1)).map(([b, day, night]) => {
    const [x0, y0] = toXY(b[0], b[3]), [x1, y1] = toXY(b[2], b[1])
    return { key: b.join(), day, night, x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  }), [world, toXY])

  return (
    <div ref={wrapRef} className={`bd-map${drawing ? ' is-drawing' : ''} relative ${className} w-full overflow-hidden bg-bg select-none`}>
      <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} className="h-full w-full touch-none"
        role="group" aria-label="Bangladesh map — select an area to explore" data-theme={theme}>
        {layer !== 'none' && imgs.map((m) => <image key={m.key} href={layer === 'day' ? m.day : m.night} x={m.x} y={m.y} width={m.w} height={m.h} preserveAspectRatio="none" aria-hidden />)}
        {layer === 'none' && countries.filter((c) => onScreen(c.b)).map((c) => <path key={c.id} d={c.d} className="bd-world" aria-hidden />)}
        {showStates && states.filter((c) => onScreen(c.b)).map((c) => <path key={c.id} d={c.d} className={`bd-state${layer !== 'none' ? ' on-imagery' : ''}`} vectorEffect="non-scaling-stroke" aria-hidden />)}
        {countries.filter((c) => onScreen(c.b)).map((c) => <path key={`b-${c.id}`} d={c.d} className={`bd-border${layer !== 'none' ? ' on-imagery' : ''}`} vectorEffect="non-scaling-stroke" aria-hidden />)}
        {outer && layer !== 'none' && <rect x={outer.x - outer.w} y={outer.y - outer.h} width={outer.w * 3} height={outer.h * 3} className="bd-veil" aria-hidden />}
        {feats.map((f) => {
          const v = values?.[f.id]
          const sel = f.id === selected
          return (
            <path key={f.id} d={f.d} className={`bd-feat${sel ? ' bd-sel map-sel' : ''}${drawing ? ' pointer-events-none' : ''}`}
              fill={v != null ? rampColor(v, max, p) : p.surface} fillOpacity={layer === 'none' ? (v != null ? 0.92 : 0.5) : world && v ? 0.85 : 0}
              vectorEffect="non-scaling-stroke"
              tabIndex={drawing ? -1 : 0} role="button"
              aria-label={`${f.nameEn} · ${f.nameBn}${v != null ? ` · ${v}` : ''}`}
              aria-pressed={sel}
              onClick={() => !drawing && !dragged.current && onSelect(f.id)}
              onKeyDown={(e) => { if (!drawing && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(f.id) } }}
              onPointerMove={(e) => {
                if (drawing) return
                const r = wrapRef.current!.getBoundingClientRect()
                setHover({ id: f.id, x: e.clientX - r.left, y: e.clientY - r.top })
              }}
              onPointerLeave={() => setHover(null)} />
          )
        })}
        {outer && <>
          {/* spotlight: everything outside the areas is dimmed, and a thin line traces their outer edge (a stroke round every
              area masked to outside all of them, so shared borders and any hairline mismatch between neighbours stay hidden) */}
          <mask id={maskId} maskUnits="userSpaceOnUse" x={outer.x - outer.w} y={outer.y - outer.h} width={outer.w * 3} height={outer.h * 3}>
            <rect x={outer.x - outer.w} y={outer.y - outer.h} width={outer.w * 3} height={outer.h * 3} fill="white" />
            {feats.map((f) => <path key={f.id} d={f.d} fill="black" />)}
          </mask>
          <g mask={`url(#${maskId})`} aria-hidden>
            <rect x={outer.x - outer.w} y={outer.y - outer.h} width={outer.w * 3} height={outer.h * 3} className={`bd-dim${layer !== 'none' ? ' on-imagery' : ''}`} />
            {feats.map((f) => <path key={f.id} d={f.d} className={`bd-home${layer !== 'none' ? ' on-imagery' : ''}`} vectorEffect="non-scaling-stroke" />)}
          </g>
          {names.map((c) => <text key={`n-${c.id}`} x={c.x} y={c.y} fontSize={(c.state ? 10.5 : 11.5) / ppu} textAnchor="middle" dominantBaseline="middle"
            className={`bd-country-name${c.state ? ' is-state' : ''}${layer !== 'none' ? ' on-imagery' : ''}`} aria-hidden>{c.name}</text>)}
          {view.w > fit.w * 1.3 && <text x={fit.x + fit.w / 2} y={fit.y - labelSize * 0.9} className="bd-label bd-home-label" fontSize={labelSize * 1.25} textAnchor="middle">Bangladesh</text>}
        </>}
        {feats.map((f) => ((labels && view.w < fit.w * 0.6) || f.id === hovered?.id || f.id === selected) && (
          // a pinned area's name sits just above its pin
          <text key={f.id} x={f.cx} y={pins?.[f.id] ? f.cy - pinR(pins[f.id]) - labelSize * 0.6 : f.cy} className="bd-label" fontSize={labelSize} textAnchor="middle" dominantBaseline="middle">
            {f.nameEn}
          </text>
        ))}
        {pins && ppu > 0 && feats.map((f) => {
          const n = pins[f.id]
          if (!n) return null
          const r = pinR(n)
          const sel = f.id === selected
          const label = pinLabel ? pinLabel(f.id, n) : `${f.nameEn} · ${n}`
          return (
            <g key={`pin-${f.id}`} className={`bd-pin${sel ? ' bd-pin-sel' : ''}${drawing ? ' pointer-events-none' : ''}`} role="button" tabIndex={drawing ? -1 : 0}
              aria-label={label} aria-pressed={sel}
              onClick={() => !drawing && !dragged.current && onPin?.(f.id)}
              onKeyDown={(e) => { if (!drawing && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPin?.(f.id) } }}>
              <title>{label}</title>
              {sel && <circle cx={f.cx} cy={f.cy} r={r * 1.7} className="bd-pin-halo" />}
              <circle cx={f.cx} cy={f.cy} r={r} vectorEffect="non-scaling-stroke" />
              {n > 1 && <text x={f.cx} y={f.cy} fontSize={r * 1.05} textAnchor="middle" dominantBaseline="central">{n}</text>}
            </g>
          )
        })}
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
      {controls && (
        <div className="absolute top-3 left-3 z-20 flex flex-col divide-y divide-line overflow-hidden rounded-[6px] border border-line bg-surface shadow-sm" role="group" aria-label="Map zoom">
          {([['plus', 'Zoom in', () => zoomBy(1.6)], ['minus', 'Zoom out', () => zoomBy(1 / 1.6)], ['area', 'Show all of Bangladesh', () => animateTo(fit, viewRef.current)]] as const).map(([icon, label, go]) => (
            <button key={icon} type="button" aria-label={label} title={label} onClick={go} className="grid h-9 w-9 place-items-center text-ink hover:bg-surface-2">
              <Icon name={icon} className="h-4 w-4" />
            </button>))}
        </div>)}
      <div className="absolute top-2 right-2 z-20 flex gap-0.5 rounded-[6px] border border-line bg-surface/90 p-0.5 text-xs shadow-sm" role="radiogroup" aria-label="Map background">
        {LAYERS.map(([l, label]) => <button key={l} type="button" role="radio" aria-checked={layer === l} onClick={() => pickLayer(l)}
          className="rounded-[4px] px-2 py-1 text-muted hover:text-ink aria-checked:bg-surface-2 aria-checked:font-semibold aria-checked:text-ink">{label}</button>)}
      </div>
      {layer !== 'none' && <p className="pointer-events-none absolute bottom-1 left-2 z-20 rounded-[4px] bg-surface/80 px-1.5 text-[11px] text-muted">{LAYERS.find(([l]) => l === layer)![2]}</p>}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-ink/30 text-sm font-medium text-on-ink transition-opacity duration-200"
        style={{ opacity: hint ? 1 : 0 }}>Hold Ctrl to zoom the map</div>
    </div>
  )
}
