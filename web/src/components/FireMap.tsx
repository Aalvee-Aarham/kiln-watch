import { useEffect, useRef } from 'react'
import { GeoJSON, MapContainer, Rectangle, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { palette, useTheme } from '../lib/theme'
import type { FC } from '../lib/types'
import { boxAreaKm2, type Box } from '../lib/box'

const color = (share: number | null, p: ReturnType<typeof palette>) =>
  share == null ? p.cloud : share > 0.5 ? p.fire[4] : share > 0.25 ? p.fire[3] : share > 0.1 ? p.band : p.fire[0]

/** Choropleth of units (fill = kiln-like share); click selects; optional box drawing (drag). Dark basemap at night. */
export default function FireMap({ fc, selected, onSelect, drawing, box, onBox }: {
  fc: FC; selected?: string; onSelect: (id: string) => void; drawing: boolean; box?: Box; onBox: (b: Box) => void
}) {
  const theme = useTheme()
  const p = palette()
  const isNight = theme === 'night'
  return (
    <MapContainer center={[23.7, 90.3]} zoom={7} minZoom={6} className="h-[420px] w-full rounded-md border border-line" scrollWheelZoom={false} keyboard>
      <TileLayer key={theme} attribution="&copy; OpenStreetMap &copy; CARTO"
        url={isNight ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'} />
      <GeoJSON key={fc.features.length + (selected ?? '') + theme} data={fc as GeoJSON.GeoJsonObject}
        style={(f) => ({
          color: f?.properties.unit_id === selected ? p.ember : p.muted,
          weight: f?.properties.unit_id === selected ? 3 : 0.6,
          className: f?.properties.unit_id === selected ? 'map-sel' : undefined,
          fillColor: color(f?.properties.kiln_share ?? null, p), fillOpacity: 0.75,
        })}
        onEachFeature={(f, layer) => {
          layer.bindTooltip(`${f.properties.name_en} · ${f.properties.name_bn}`, { sticky: true })
          layer.on('click', () => !drawing && onSelect(f.properties.unit_id))
        }} />
      {box && <Rectangle bounds={[[box[1], box[0]], [box[3], box[2]]]} pathOptions={{ color: p.ember, weight: 2 }} />}
      {drawing && <BoxDraw onBox={onBox} />}
    </MapContainer>
  )
}

function BoxDraw({ onBox }: { onBox: (b: Box) => void }) {
  const map = useMap()
  const p = palette()
  const start = useRef<L.LatLng | null>(null)
  const rect = useRef<L.Rectangle | null>(null)
  useEffect(() => {
    map.dragging.disable()
    map.getContainer().style.cursor = 'crosshair'
    const down = (e: L.LeafletMouseEvent) => { start.current = e.latlng }
    const move = (e: L.LeafletMouseEvent) => {
      if (!start.current) return
      const b = L.latLngBounds(start.current, e.latlng)
      if (rect.current) rect.current.setBounds(b)
      else rect.current = L.rectangle(b, { color: p.ember, dashArray: '4' }).addTo(map)
    }
    const up = (e: L.LeafletMouseEvent) => {
      if (!start.current) return
      const b = L.latLngBounds(start.current, e.latlng)
      start.current = null
      rect.current?.remove()
      rect.current = null
      const bx: Box = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((v) => Math.round(v * 1e4) / 1e4) as Box
      if (boxAreaKm2(bx) > 1) onBox(bx)
    }
    map.on('mousedown', down).on('mousemove', move).on('mouseup', up)
    return () => {
      map.off('mousedown', down).off('mousemove', move).off('mouseup', up)
      map.dragging.enable()
      map.getContainer().style.cursor = ''
    }
  }, [map, onBox, p.ember])
  return null
}
