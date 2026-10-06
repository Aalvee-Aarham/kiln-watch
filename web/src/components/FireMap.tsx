import { useEffect, useState } from 'react'
import { GeoJSON, MapContainer, Rectangle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { palette, rampColor, useTheme } from '../lib/theme'
import type { FC } from '../lib/types'
import { boxAreaKm2, type Box } from '../lib/box'

const MIN_KM2 = 100 // same floor as parseBox: reject at draw time, not after navigation

/**
 * Basemap-free choropleth: districts/upazilas on the page ground, fill = `values` on the fire ramp (absent = outline only).
 * Click selects; optional box drawing with pointer events (mouse, touch, pen). No third-party tiles.
 */
export default function FireMap({ fc, selected, onSelect, drawing, box, onBox, values, labels }: {
  fc: FC; selected?: string; onSelect: (id: string) => void; drawing: boolean; box?: Box; onBox: (b: Box) => void
  values?: Record<string, number>; labels: boolean
}) {
  const theme = useTheme()
  const p = palette()
  const max = Math.max(0, ...Object.values(values ?? {}))
  const fill = (id: string) => (values ? rampColor(values[id], max, p) : p.surface)
  const style = (id: string) => ({
    color: id === selected ? p.orbit : p.muted, weight: id === selected ? 2.5 : 0.6, opacity: id === selected ? 1 : 0.7,
    className: id === selected ? 'map-sel' : undefined, fillColor: fill(id), fillOpacity: values ? 0.9 : 0.5,
  })
  return (
    <MapContainer center={[23.7, 90.3]} zoom={7} minZoom={6} maxZoom={11} zoomSnap={0.5} attributionControl={false}
      className="h-[440px] w-full rounded-[10px] border border-line" scrollWheelZoom={false} keyboard>
      <GeoJSON key={fc.features.length + (selected ?? '') + theme + max + labels} data={fc as GeoJSON.GeoJsonObject}
        style={(f) => style(f?.properties.unit_id)}
        onEachFeature={(f, layer) => {
          const id = f.properties.unit_id
          const v = values?.[id]
          layer.bindTooltip(`<b>${f.properties.name_en}</b> · ${f.properties.name_bn}${v != null ? `<br/>${v}` : ''}`, { sticky: true, direction: 'top', offset: [0, -8] })
          if (labels) layer.bindTooltip(f.properties.name_en, { permanent: true, direction: 'center', className: 'map-label', interactive: false })
          layer.on('click', () => !drawing && onSelect(id))
          layer.on('mouseover', (e) => { if (id !== selected) (e.target as L.Path).setStyle({ color: p.ink, weight: 1.5, opacity: 1 }) })
          layer.on('mouseout', (e) => { if (id !== selected) (e.target as L.Path).setStyle(style(id)) })
        }} />
      {box && <Rectangle bounds={[[box[1], box[0]], [box[3], box[2]]]} pathOptions={{ color: p.orbit, weight: 2, fillOpacity: 0.08 }} />}
      {drawing && <BoxDraw onBox={onBox} color={p.orbit} />}
      <LabelZoom />
      <CtrlZoom />
    </MapContainer>
  )
}

/** District names only when zoomed in (class on the container toggles their visibility). */
function LabelZoom() {
  const map = useMap()
  useEffect(() => {
    const set = () => map.getContainer().classList.toggle('map-z8', map.getZoom() >= 8)
    set(); map.on('zoomend', set)
    return () => { map.off('zoomend', set) }
  }, [map])
  return null
}

/** Wheel scrolls the page; Ctrl/⌘ + wheel zooms the map, and a plain wheel shows how. */
function CtrlZoom() {
  const map = useMap()
  const [hint, setHint] = useState(false)
  useEffect(() => {
    const el = map.getContainer()
    let t = 0
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); map.setZoom(map.getZoom() + (e.deltaY < 0 ? 0.5 : -0.5)); return }
      setHint(true); clearTimeout(t); t = window.setTimeout(() => setHint(false), 1200)
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => { el.removeEventListener('wheel', wheel); clearTimeout(t) }
  }, [map])
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[500] grid place-items-center bg-ink/30 text-sm font-medium text-on-ink transition-opacity duration-200"
      style={{ opacity: hint ? 1 : 0 }}>Hold Ctrl to zoom the map</div>
  )
}

function BoxDraw({ onBox, color }: { onBox: (b: Box) => void; color: string }) {
  const map = useMap()
  const [label, setLabel] = useState<{ x: number; y: number; km2: number; flip: boolean } | null>(null)
  useEffect(() => {
    const el = map.getContainer()
    let start: L.LatLng | null = null
    let rect: L.Rectangle | null = null
    const toBox = (b: L.LatLngBounds): Box => [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((v) => Math.round(v * 1e4) / 1e4) as Box
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || start) return // ignore a second finger
      el.setPointerCapture(e.pointerId)
      start = map.mouseEventToLatLng(e)
    }
    const move = (e: PointerEvent) => {
      if (!start || !e.isPrimary) return
      const b = L.latLngBounds(start, map.mouseEventToLatLng(e))
      const km2 = boxAreaKm2(toBox(b))
      const ok = km2 >= MIN_KM2
      if (rect) rect.setBounds(b).setStyle({ dashArray: ok ? undefined : '4 4', fillOpacity: ok ? 0.12 : 0.04 })
      else rect = L.rectangle(b, { color, weight: 2, dashArray: '4 4', fillOpacity: 0.04 }).addTo(map)
      const pt = map.mouseEventToContainerPoint(e)
      setLabel({ x: pt.x, y: pt.y, km2, flip: pt.x > map.getSize().x - 240 }) // keep the readout inside the map
    }
    const up = (e: PointerEvent) => {
      if (!start || !e.isPrimary) return
      const b = L.latLngBounds(start, map.mouseEventToLatLng(e))
      start = null
      rect?.remove(); rect = null
      setLabel(null)
      const bx = toBox(b)
      if (boxAreaKm2(bx) >= MIN_KM2) onBox(bx)
    }
    map.dragging.disable()
    el.style.cursor = 'crosshair'
    el.style.touchAction = 'none'
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up)
      rect?.remove()
      map.dragging.enable()
      el.style.cursor = ''
      el.style.touchAction = ''
    }
  }, [map, onBox, color])
  if (!label) return null
  const ok = label.km2 >= MIN_KM2
  return (
    <div className="pointer-events-none absolute z-[600] rounded-[4px] border border-line bg-surface px-2 py-0.5 text-xs font-semibold whitespace-nowrap shadow"
      style={{ ...(label.flip ? { right: map.getSize().x - label.x + 14 } : { left: label.x + 14 }), top: label.y + 14, color: ok ? 'var(--color-ink)' : 'var(--color-err)' }}>
      ≈ {Math.round(label.km2).toLocaleString('en-US')} km²{ok ? '' : ' · too small (min 100 km²)'}
    </div>
  )
}
