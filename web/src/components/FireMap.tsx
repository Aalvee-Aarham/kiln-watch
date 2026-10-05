import { useEffect, useRef } from 'react'
import { GeoJSON, MapContainer, Rectangle, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { FC } from '../lib/types'
import { boxAreaKm2, type Box } from '../lib/box'

const color = (share: number | null) =>
  share == null ? '#e7e5e4' : share > 0.5 ? '#9a3412' : share > 0.25 ? '#ea580c' : share > 0.1 ? '#fdba74' : '#fef3c7'

/** Choropleth of units (fill = kiln-like share); click selects; optional box drawing (drag). Basemap degrades offline. */
export default function FireMap({ fc, selected, onSelect, drawing, box, onBox }: {
  fc: FC; selected?: string; onSelect: (id: string) => void; drawing: boolean; box?: Box; onBox: (b: Box) => void
}) {
  return (
    <MapContainer center={[23.7, 90.3]} zoom={7} minZoom={6} className="h-[420px] w-full rounded-md" scrollWheelZoom={false} keyboard>
      <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
      <GeoJSON key={fc.features.length + (selected ?? '')} data={fc as GeoJSON.GeoJsonObject}
        style={(f) => ({ color: f?.properties.unit_id === selected ? '#1c1917' : '#78716c', weight: f?.properties.unit_id === selected ? 3 : 0.6,
          fillColor: color(f?.properties.kiln_share ?? null), fillOpacity: 0.7 })}
        onEachFeature={(f, layer) => {
          layer.bindTooltip(`${f.properties.name_en} · ${f.properties.name_bn}`, { sticky: true })
          layer.on('click', () => !drawing && onSelect(f.properties.unit_id))
        }} />
      {box && <Rectangle bounds={[[box[1], box[0]], [box[3], box[2]]]} pathOptions={{ color: '#c2410c', weight: 2 }} />}
      {drawing && <BoxDraw onBox={onBox} />}
    </MapContainer>
  )
}

function BoxDraw({ onBox }: { onBox: (b: Box) => void }) {
  const map = useMap()
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
      else rect.current = L.rectangle(b, { color: '#c2410c', dashArray: '4' }).addTo(map)
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
  }, [map, onBox])
  return null
}
