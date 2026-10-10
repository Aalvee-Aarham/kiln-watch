import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LAYERS, readLayer, saveLayer, type Layer } from '../lib/basemap'
import { BBOX, SOUTH_ASIA_BOX, type Box } from '../lib/box'
import { boxView, clampView, labelPx, placeLabels, STATES_W, visibleCities, zoomView, type City, type View } from '../lib/world'
import type { FC } from '../lib/types'
import { Icon } from './ui'
// NASA GIBS WMS GetMap images in EPSG:4326, so each sits on this map's lon/lat grid by its corners. Bundled for offline use;
// fetched only when a background is chosen. Coarse world first, then sharper South Asia and Bangladesh on top.
import worldDay from '../assets/basemap/world_bluemarble-ng.jpg'
import worldNight from '../assets/basemap/world_black-marble-2016.jpg'
import saDay from '../assets/basemap/south-asia_bluemarble-ng.jpg'
import saNight from '../assets/basemap/south-asia_black-marble-2016.jpg'
import bdDay from '../assets/basemap/bluemarble-ng_bd.jpg'
import bdNight from '../assets/basemap/black-marble-2016_bd.jpg'

const IMAGES: [Box, string, string][] = [[[-180, -90, 180, 90], worldDay, worldNight], [SOUTH_ASIA_BOX, saDay, saNight], [BBOX, bdDay, bdNight]]
const REDUCED = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const WORLD: Box = [-180, -60, 180, 80]

export type Pick = { kind: 'state' | 'country' | 'city'; id: string }
type Shape = { id: string; name: string; d: string; x0: number; y0: number; x1: number; y1: number }

/** Path in degrees (x = lon, y = −lat) plus its bounding box, for culling to the view. */
function shapes(fc?: FC): Shape[] {
  return (fc?.features ?? []).map((f) => {
    let d = '', x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    const ring = (r: GeoJSON.Position[]) => {
      d += 'M' + r.map(([lon, lat]) => {
        if (lon < x0) x0 = lon; if (lon > x1) x1 = lon; if (-lat < y0) y0 = -lat; if (-lat > y1) y1 = -lat
        return `${lon},${-lat}`
      }).join('L') + 'Z'
    }
    const g = f.geometry
    if (g.type === 'Polygon') g.coordinates.forEach(ring)
    else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => p.forEach(ring))
    return { id: f.properties.unit_id, name: f.properties.name_en, d, x0, y0, x1, y1 }
  })
}
const overlaps = (s: Shape, v: View) => s.x1 >= v.x && s.x0 <= v.x + v.w && s.y1 >= v.y && s.y0 <= v.y + v.h

/**
 * The whole globe on a lon/lat grid: countries, states and provinces (when zoomed in), and city names that grow
 * denser as you zoom. Drag to pan; Ctrl/⌘ + wheel, double-click or the buttons to zoom. Opens on South Asia.
 */
export default function WorldMap({ countries, states, region, cities, selected, focus, transferCountries = [], onPick }: {
  countries?: FC; states?: FC; region?: FC; cities: City[]
  selected?: Pick; focus?: { box: Box; key: number }; transferCountries?: string[]; onPick: (p: Pick) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 560 })
  const aspect = size.h / size.w
  const [view, setView] = useState<View>(() => boxView(SOUTH_ASIA_BOX, 0.7))
  const viewRef = useRef(view)
  viewRef.current = view
  const [layer, setLayer] = useState<Layer>(readLayer)
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null)
  const [hint, setHint] = useState(false)
  const moved = useRef(false)
  const raf = useRef(0)
  const C = useMemo(() => shapes(countries), [countries])
  const S = useMemo(() => shapes(states), [states])
  const R = useMemo(() => shapes(region), [region])

  // The frame's real size sets the view's shape, so the map always fills it.
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width || 800, h: e.contentRect.height || 560 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => { setView((v) => clampView({ ...v, h: v.w * aspect }, aspect)) }, [aspect])

  const animateTo = (t: View) => {
    cancelAnimationFrame(raf.current)
    const from = viewRef.current
    if (REDUCED) { setView(t); return }
    const t0 = performance.now()
    const step = (now: number) => {
      const k = 1 - (1 - Math.min(1, (now - t0) / 450)) ** 4
      // interpolate the zoom geometrically so a long zoom-in feels even
      const w = from.w * (t.w / from.w) ** k
      const cx = from.x + from.w / 2 + (t.x + t.w / 2 - from.x - from.w / 2) * k, cy = from.y + from.h / 2 + (t.y + t.h / 2 - from.y - from.h / 2) * k
      setView({ x: cx - w / 2, y: cy - (w * aspect) / 2, w, h: w * aspect })
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }
  const goBox = (b: Box) => animateTo(boxView(b, aspect))
  useEffect(() => { if (focus) goBox(focus.box) }, [focus?.key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const toDeg = (cx: number, cy: number): [number, number] => {
    const r = wrapRef.current!.getBoundingClientRect(), v = viewRef.current
    return [v.x + ((cx - r.left) / r.width) * v.w, v.y + ((cy - r.top) / r.height) * v.h]
  }
  const zoomBy = (f: number, cx?: number, cy?: number) => {
    const v = viewRef.current
    const [px, py] = cx == null ? [v.x + v.w / 2, v.y + v.h / 2] : toDeg(cx, cy!)
    setView(zoomView(v, f, px, py, aspect))
  }

  // Drag anywhere to pan (a drag never counts as a click); Ctrl/⌘ + wheel zooms; plain wheel scrolls the page.
  useEffect(() => {
    const el = wrapRef.current?.querySelector('svg')
    if (!el) return
    let from: { cx: number; cy: number; v: View } | null = null, hintT = 0
    const down = (e: PointerEvent) => { if (e.button === 0 && e.isPrimary) { from = { cx: e.clientX, cy: e.clientY, v: viewRef.current }; moved.current = false } }
    const move = (e: PointerEvent) => {
      if (!from) return
      const dx = e.clientX - from.cx, dy = e.clientY - from.cy
      if (!moved.current && Math.hypot(dx, dy) < 4) return
      if (!moved.current) { moved.current = true; el.setPointerCapture(e.pointerId); document.documentElement.classList.add('is-panning') }
      const r = el.getBoundingClientRect(), v = from.v
      setView(clampView({ ...v, x: v.x - (dx / r.width) * v.w, y: v.y - (dy / r.height) * v.h }, v.h / v.w))
    }
    const up = () => { from = null; document.documentElement.classList.remove('is-panning') }
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); return }
      setHint(true); clearTimeout(hintT); hintT = window.setTimeout(() => setHint(false), 1200)
    }
    const dbl = (e: MouseEvent) => zoomBy(2, e.clientX, e.clientY)
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false }); el.addEventListener('dblclick', dbl)
    return () => {
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel); el.removeEventListener('dblclick', dbl)
      clearTimeout(hintT); document.documentElement.classList.remove('is-panning')
    }
  }, [aspect]) // eslint-disable-line react-hooks/exhaustive-deps

  const px = view.w / size.w // degrees per screen pixel: labels and dots keep their screen size at any zoom
  const showStates = view.w <= STATES_W
  const vis = { c: C.filter((s) => overlaps(s, view)), s: showStates ? S.filter((s) => overlaps(s, view)) : [], r: R.filter((s) => overlaps(s, view)) }
  const sel = selected && (selected.kind === 'state' ? S : selected.kind === 'country' ? C : []).find((s) => s.id === selected.id)
  const selCity = selected?.kind === 'city' ? cities.find((c) => `${c.name}|${c.adm0}|${c.lat}` === selected.id) : undefined
  const towns = placeLabels(visibleCities(cities, view, 600), px, selCity) // 600 candidates, thinned to what can be read
  const tip = (name: string) => (e: React.PointerEvent) => { const r = wrapRef.current!.getBoundingClientRect(); setHover({ name, x: e.clientX - r.left, y: e.clientY - r.top }) }
  const click = (p: Pick) => () => { if (!moved.current) onPick(p) }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex gap-0.5 rounded-[6px] border border-line bg-surface p-0.5" role="radiogroup" aria-label="Map background">
          {LAYERS.map(([l, label]) => <button key={l} type="button" role="radio" aria-checked={layer === l} onClick={() => { setLayer(l); saveLayer(l) }}
            className="rounded-[4px] px-2.5 py-1.5 text-muted hover:text-ink aria-checked:bg-surface-2 aria-checked:font-semibold aria-checked:text-ink">{label}</button>)}
        </div>
        <div className="flex gap-4 text-[11px] text-muted max-sm:order-3 max-sm:w-full max-sm:justify-center">
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-[2px] opacity-60" style={{ backgroundColor: 'var(--color-fire-3)' }}></span>Full analysis (Bangladesh)</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-[2px] opacity-40" style={{ backgroundColor: 'var(--color-warn)' }}></span>Kiln method tested</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-[2px] border border-line bg-surface-2 opacity-60"></span>Not yet covered</span>
        </div>
        <div className="flex items-center gap-0.5 rounded-[6px] border border-line bg-surface p-0.5" role="group" aria-label="Jump to">
          {([['South Asia', SOUTH_ASIA_BOX], ['Bangladesh', BBOX], ['World', WORLD]] as [string, Box][]).map(([l, b]) =>
            <button key={l} type="button" onClick={() => goBox(b)} className="rounded-[4px] px-2.5 py-1.5 text-muted hover:bg-surface-2 hover:text-ink">{l}</button>)}
        </div>
      </div>
      <div ref={wrapRef} className={`relative h-[min(620px,75vh)] min-h-[420px] w-full overflow-hidden rounded-[10px] border border-line bg-bg select-none ${layer !== 'none' ? 'wm-imagery' : ''}`}>
        <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="none" className="h-full w-full touch-none" role="group"
          aria-label="World map, opening on South Asia. Drag to move, use the zoom buttons, or search for a place.">
          {layer !== 'none' && IMAGES.map(([b, day, night]) => (
            <image key={b.join()} href={layer === 'day' ? day : night} x={b[0]} y={-b[3]} width={b[2] - b[0]} height={b[3] - b[1]} preserveAspectRatio="none" aria-hidden />))}
          {layer === 'none' && vis.c.map((s) => <path key={s.id} d={s.d} className="wm-land" aria-hidden />)}
          {vis.s.map((s) => (
            <path key={s.id} d={s.d} className="wm-state" onClick={click({ kind: 'state', id: s.id })} onPointerMove={tip(s.name)} onPointerLeave={() => setHover(null)} aria-hidden />))}
          {vis.c.map((s) => (
            <path key={s.id} d={s.d} className={`wm-country${showStates ? '' : ' is-pick'}`} aria-hidden
              style={layer === 'none' ? (s.id === 'BGD' ? { fill: 'var(--color-fire-3)', fillOpacity: 0.6 } : transferCountries.includes(s.id) ? { fill: 'var(--color-warn)', fillOpacity: 0.4 } : {}) : {}}
              {...(showStates ? {} : { onClick: click({ kind: 'country', id: s.id }), onPointerMove: tip(s.name), onPointerLeave: () => setHover(null) })} />))}
          {vis.r.map((s) => <path key={s.id} d={s.d} className="wm-sa" aria-hidden />)}
          {sel && <path d={sel.d} className="wm-sel" aria-hidden />}
          {towns.map((c) => {
            const id = `${c.name}|${c.adm0}|${c.lat}`, on = selCity === c
            return (
              <g key={id} onClick={click({ kind: 'city', id })} className="cursor-pointer">
                <circle cx={c.lon} cy={-c.lat} r={(c.capital ? 4 : 3) * px} className={`wm-city${c.capital ? ' is-capital' : ''}${on ? ' is-sel' : ''}`}><title>{c.name}</title></circle>
                <text x={c.lon + 6 * px} y={-c.lat + 4 * px} fontSize={labelPx(c) * px} fontWeight={c.capital || c.rank <= 2 || on ? 600 : 400}
                  className="wm-name" style={{ strokeWidth: 3 * px }}>{c.name}</text>
              </g>)
          })}
        </svg>

        <div className="absolute top-2 left-2 z-20 flex flex-col gap-1">
          <button type="button" className="btn btn-icon bg-surface shadow-sm" aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(2)}><Icon name="plus" /></button>
          <button type="button" className="btn btn-icon bg-surface shadow-sm" aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(0.5)}><Icon name="minus" /></button>
        </div>
        <p className="pointer-events-none absolute bottom-1 left-2 z-20 rounded-[4px] bg-surface/80 px-1.5 text-[11px] text-muted">
          {showStates ? 'States and provinces shown.' : 'Zoom in for states and provinces.'}{layer !== 'none' ? ` ${LAYERS.find(([l]) => l === layer)![2]}.` : ''}</p>
        {hover && <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[130%] rounded-[6px] border border-line bg-surface px-2 py-1 text-xs shadow"
          style={{ left: hover.x, top: hover.y }} role="tooltip"><b>{hover.name}</b></div>}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-ink/30 text-sm font-medium text-on-ink transition-opacity duration-200"
          style={{ opacity: hint ? 1 : 0 }}>Hold Ctrl to zoom, or use the + and − buttons</div>
      </div>
    </div>
  )
}
