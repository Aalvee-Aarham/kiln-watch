import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import worldDay from '../../assets/basemap/world_bluemarble-ng.jpg'
import saDay from '../../assets/basemap/south-asia_bluemarble-ng.jpg'
import bdDay from '../../assets/basemap/bluemarble-ng_bd.jpg'
import { SOUTH_ASIA_BOX, type Box } from '../../lib/box'
import {
  boxView,
  labelPx,
  placeLabels,
  visibleCities,
  shapes,
  overlaps,
  parseCities
} from '../../lib/world'
import { useJson } from '../../lib/data'
import type { FC } from '../../lib/types'
import type { MapFocus } from '../../lib/agentEngine'

type CityFile = { fields: string[]; rows: (string | number | null)[][] }

/**
 * Animated Daytime Satellite Map Canvas
 * - True plate carrée (EPSG:4326) geometry matching WorldMap with 100% natural, un-squashed aspect ratio.
 * - Multi-layer daytime NASA Blue Marble satellite view (World 4K, South Asia 1.5K, Bangladesh 1K).
 * - Crisp vector country outlines, glowing amber South Asia boundaries, and retina city typography.
 * - Smooth camera pan & zoom dynamically targeting the exact queried location (Punjab, Dhaka, Chittagong, etc.).
 * - Renders real fire detections passed in by the page (`cells`: Kiln Watch grid cells for a Bangladesh place;
 *   `ambient`: regional detections, empty until the South Asia calendar) and the targeted bounding box.
 */
export function AgentAnimatedMap({
  timeMs,
  locationName = '',
  mapFocus,
  cells = [],
  ambient = [],
  caption
}: {
  timeMs: number
  locationName?: string
  mapFocus?: MapFocus | null
  cells?: { lat: number; lon: number }[]
  ambient?: { lat: number; lon: number }[]
  caption?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 700, h: 560 })
  const aspect = size.h / size.w

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      setSize({
        w: e.contentRect.width || 700,
        h: e.contentRect.height || 560
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Load vector boundaries and cities for crisp overlay
  const region = useJson<FC>('aoi/south_asia.geojson')
  const countries = useJson<FC>('aoi/world_countries.geojson')
  const cityFile = useJson<CityFile>('aoi/world_cities.json')

  const R = useMemo(() => shapes(region.data), [region.data])
  const C = useMemo(() => shapes(countries.data), [countries.data])
  const cities = useMemo(() => (cityFile.data ? parseCities(cityFile.data) : []), [cityFile.data])

  // Initial resting view: South Asia centered in true, un-squashed aspect ratio
  const restingView = useMemo(() => boxView(SOUTH_ASIA_BOX, aspect, 1.06), [aspect])

  // Target view centered on the queried region's coordinates and bounding box
  const targetView = useMemo(() => {
    if (!mapFocus) return null
    const bbox: Box = mapFocus.bbox || [
      mapFocus.centerLon - 2.5,
      mapFocus.centerLat - 2.0,
      mapFocus.centerLon + 2.5,
      mapFocus.centerLat + 2.0
    ]
    const pad = 1.6
    const bw = (bbox[2] - bbox[0]) * pad
    const bh = (bbox[3] - bbox[1]) * pad
    // At least 8.5 degrees across so surrounding geography and topography provide context
    const vw = Math.max(0.4, Math.max(bw, bh / aspect, 8.5))
    const cx = (bbox[0] + bbox[2]) / 2
    const cy = -(bbox[1] + bbox[3]) / 2
    return {
      x: cx - vw / 2,
      y: cy - (vw * aspect) / 2,
      w: vw,
      h: vw * aspect
    }
  }, [mapFocus, aspect])

  // Camera Zoom Interpolation (between 1600ms and 2800ms)
  const zoomFactor = useMemo(() => {
    if (!targetView) return 0
    if (timeMs < 1600) return 0
    if (timeMs >= 2800) return 1
    const p = (timeMs - 1600) / 1200
    // Smooth cubic easeInOut
    return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
  }, [timeMs, targetView])

  const currentView = useMemo(() => {
    if (!targetView || zoomFactor === 0) return restingView
    const x = restingView.x + (targetView.x - restingView.x) * zoomFactor
    const y = restingView.y + (targetView.y - restingView.y) * zoomFactor
    const w = restingView.w + (targetView.w - restingView.w) * zoomFactor
    return { x, y, w, h: w * aspect }
  }, [restingView, targetView, zoomFactor, aspect])

  // Scale factor: degrees per screen pixel
  const px = currentView.w / size.w

  // Visible boundaries and cities
  const visC = useMemo(() => C.filter((s) => overlaps(s, currentView)), [C, currentView])
  const visR = useMemo(() => R.filter((s) => overlaps(s, currentView)), [R, currentView])
  const towns = useMemo(
    () => (cities.length ? placeLabels(visibleCities(cities, currentView, 40), px) : []),
    [cities, currentView, px]
  )

  // Real detections only: one dot per grid cell (page-built, capped), plus regional ambient detections when present.
  const firePoints = useMemo(() => [
    ...ambient.map((c) => ({ lon: c.lon, lat: c.lat, rPx: 2.0, opacity: 0.6 })),
    ...cells.map((c) => ({ lon: c.lon, lat: c.lat, rPx: 2.4, opacity: 0.9 })),
  ], [cells, ambient])

  const showBox = Boolean(mapFocus) && timeMs >= 500
  const showLabel = Boolean(mapFocus && locationName) && timeMs >= 1000
  const showWatermark = timeMs >= 1200
  const targetBbox = mapFocus?.bbox

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden rounded-l-[12px] bg-[#0c1424] select-none wm-imagery"
    >
      {/* SVG Viewport with mathematically uniform 1:1 lon/lat aspect ratio */}
      <svg
        viewBox={`${currentView.x} ${currentView.y} ${currentView.w} ${currentView.h}`}
        className="h-full w-full touch-none will-change-transform"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="fire-glow-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. Global Daytime NASA Blue Marble Satellite Imagery (4096 x 2048) */}
        <image
          href={worldDay}
          x="-180"
          y="-90"
          width="360"
          height="180"
          preserveAspectRatio="none"
          className="filter contrast-[1.08] brightness-[0.98]"
          aria-hidden
        />

        {/* 2. South Asia Regional High-Definition Satellite Imagery (1520 x 1440, exact 40 px/deg) */}
        <image
          href={saDay}
          x="60"
          y="-39"
          width="38"
          height="36"
          preserveAspectRatio="none"
          className="filter contrast-[1.12] brightness-[0.96]"
          aria-hidden
        />

        {/* 3. Bangladesh Inset Ultra-High-Definition Satellite Imagery (960 x 1240, exact 200 px/deg) */}
        <image
          href={bdDay}
          x="88"
          y="-26.7"
          width="4.8"
          height="6.2"
          preserveAspectRatio="none"
          className="filter contrast-[1.12] brightness-[0.96]"
          aria-hidden
        />

        {/* 4. Global & Regional Country Outlines (Clean vector boundaries) */}
        {visC.map((s) => (
          <path
            key={s.id}
            d={s.d}
            className="wm-country"
            style={{ stroke: 'rgba(255, 255, 255, 0.45)', strokeWidth: 0.9 * px }}
            aria-hidden
          />
        ))}

        {/* 5. Glowing Amber South Asia Regional Boundary */}
        {visR.map((s) => (
          <path
            key={s.id}
            d={s.d}
            className="wm-sa"
            style={{ stroke: '#f59e0b', strokeWidth: 1.8 * px }}
            aria-hidden
          />
        ))}

        {/* 6. Major Cities with crisp vector typography */}
        {towns.map((c) => {
          const id = `${c.name}|${c.adm0}|${c.lat}`
          return (
            <g key={id} className="pointer-events-none select-none">
              <circle
                cx={c.lon}
                cy={-c.lat}
                r={(c.capital ? 3.5 : 2.5) * px}
                className={`wm-city${c.capital ? ' is-capital' : ''}`}
                style={{ strokeWidth: 1 * px }}
              />
              <text
                x={c.lon + 4.5 * px}
                y={-c.lat + 3 * px}
                fontSize={labelPx(c) * px}
                fontWeight={c.capital || c.rank <= 2 ? 600 : 400}
                className="wm-name"
                style={{ strokeWidth: 2.5 * px }}
              >
                {c.name}
              </text>
            </g>
          )
        })}

        {/* 7. NASA FIRMS Active Thermal Hotspots (Glowing Orange) */}
        <g filter="url(#fire-glow-filter)">
          {firePoints.map((pt, i) => (
            <circle
              key={i}
              cx={pt.lon}
              cy={-pt.lat}
              r={pt.rPx * px}
              fill="#ff4400"
              opacity={pt.opacity}
            />
          ))}
        </g>

        {/* 8. Targeted Region Bounding Box & Label */}
        {showBox && targetBbox && (
          <g className="transition-opacity duration-300">
            <rect
              x={targetBbox[0]}
              y={-targetBbox[3]}
              width={targetBbox[2] - targetBbox[0]}
              height={targetBbox[3] - targetBbox[1]}
              fill="rgba(255, 68, 0, 0.12)"
              stroke="#ff4400"
              strokeWidth={2.0 * px}
              strokeDasharray={`${6 * px} ${3 * px}`}
            />
            {showLabel && locationName && (
              <text
                x={(targetBbox[0] + targetBbox[2]) / 2}
                y={-targetBbox[3] - 5 * px}
                textAnchor="middle"
                fill="#ffffff"
                stroke="#ff4400"
                strokeWidth={0.5 * px}
                fontSize={Math.max(11 * px, 9 * px)}
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight="800"
                letterSpacing="0.12em"
                style={{ textShadow: '0 2px 6px rgba(0,0,0,0.95)' }}
              >
                {locationName.toUpperCase()}
              </text>
            )}
          </g>
        )}
      </svg>

      {caption && showWatermark && (
        <p className="absolute left-4 right-4 top-3 z-10 rounded bg-black/60 px-2.5 py-1 text-[11px] leading-snug text-neutral-200 backdrop-blur-sm">{caption}</p>
      )}

      {/* Canvas Watermark ("NO CODE. NO GIS. JUST ASK.") */}
      {showWatermark && (
        <div className="absolute bottom-4 left-4 z-10 transition-opacity duration-500 rounded bg-black/60 px-2.5 py-1 backdrop-blur-sm">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-300 font-semibold">
            NO CODE. NO GIS. <span className="text-[#ff5500]">JUST ASK.</span>
          </span>
        </div>
      )}
    </div>
  )
}
