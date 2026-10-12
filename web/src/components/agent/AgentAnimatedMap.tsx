import { useMemo } from 'react'
import saDay from '../../assets/basemap/south-asia_bluemarble-ng.jpg'
import type { MapFocus } from '../../lib/agentEngine'

/**
 * Animated Daytime Satellite Map Canvas
 * - Real natural-color daytime NASA Blue Marble satellite view.
 * - Smooth camera pan & zoom dynamically targeting the exact queried location (Punjab, Dhaka, Chittagong, etc.).
 * - Renders NASA FIRMS fire detection points and targeted bounding box.
 */
export function AgentAnimatedMap({
  timeMs,
  locationName = 'Punjab, India',
  mapFocus
}: {
  timeMs: number
  locationName?: string
  mapFocus?: MapFocus
}) {
  // Default to Punjab coordinates if not provided
  const focus = useMemo<MapFocus>(() => {
    if (mapFocus) return mapFocus
    return {
      centerLon: 75.34,
      centerLat: 31.14,
      targetX: 404,
      targetY: 131,
      boxX: 364,
      boxY: 108,
      boxW: 81,
      boxH: 50
    }
  }, [mapFocus])

  // Camera Zoom Interpolation (between 1600ms and 2800ms)
  const zoomFactor = useMemo(() => {
    if (timeMs < 1600) return 0
    if (timeMs >= 2800) return 1
    const p = (timeMs - 1600) / 1200
    // Smooth cubic easeInOut
    return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
  }, [timeMs])

  // Dynamic Camera ViewBox calculation:
  // Starts at full South Asia extent (0, 0, 1000, 600)
  // Zooms smoothly to center on the target entity
  const finalW = Math.min(Math.max(focus.boxW * 3.6, 260), 450)
  const finalH = finalW * 0.6
  const finalX = Math.min(Math.max(focus.targetX - finalW / 2, 0), 1000 - finalW)
  const finalY = Math.min(Math.max(focus.targetY - finalH / 2, 0), 600 - finalH)

  const curX = zoomFactor * finalX
  const curY = zoomFactor * finalY
  const curW = 1000 - zoomFactor * (1000 - finalW)
  const curH = 600 - zoomFactor * (600 - finalH)

  // Generate dynamic fire points clustered around the target bounding box
  const firePoints = useMemo(() => {
    let seed = Math.floor(focus.targetX * 100 + focus.targetY)
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }

    const points: { x: number; y: number; r: number; opacity: number }[] = []

    // 1. Hotspot cluster concentrated in the queried region
    for (let i = 0; i < 160; i++) {
      const rx = focus.boxX + rand() * focus.boxW + (rand() - 0.5) * (focus.boxW * 0.25)
      const ry = focus.boxY + rand() * focus.boxH + (rand() - 0.5) * (focus.boxH * 0.25)
      points.push({
        x: rx,
        y: ry,
        r: 1.5 + rand() * 2.2,
        opacity: 0.85 + rand() * 0.15
      })
    }

    // 2. Ambient regional fires across South Asia
    for (let i = 0; i < 120; i++) {
      const rx = 150 + rand() * 750
      const ry = 80 + rand() * 450
      points.push({
        x: rx,
        y: ry,
        r: 1.2 + rand() * 1.5,
        opacity: 0.4 + rand() * 0.35
      })
    }

    return points
  }, [focus])

  const showBox = timeMs >= 500
  const showLabel = timeMs >= 1000
  const showWatermark = timeMs >= 1200

  return (
    <div className="relative h-full w-full overflow-hidden rounded-l-[12px] bg-[#0c1424] select-none">
      {/* SVG Viewport with dynamic smooth camera zoom */}
      <svg
        viewBox={`${curX} ${curY} ${curW} ${curH}`}
        className="h-full w-full will-change-transform"
        preserveAspectRatio="xMidYMid slice"
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

        {/* 1. Daytime NASA Blue Marble Satellite Imagery */}
        <image
          href={saDay}
          xlinkHref={saDay}
          x="0"
          y="0"
          width="1000"
          height="600"
          preserveAspectRatio="none"
          className="filter contrast-[1.12] brightness-[0.95]"
        />

        {/* 2. Subtle Political Boundary Outlines */}
        <g stroke="rgba(255, 255, 255, 0.45)" strokeWidth="0.8" fill="none">
          <path d="M 220 90 L 260 120 L 310 110 L 360 85 L 420 130 L 490 145 L 560 155 L 610 200 L 670 215" />
          <path d="M 310 110 L 280 180 L 250 250 L 290 320 L 330 410 L 380 470 L 430 400 L 460 300 L 520 250" />
          <path d="M 520 250 L 560 270 L 600 240 L 610 200" />
        </g>

        {/* 3. NASA FIRMS Active Thermal Hotspots (Bright Glowing Orange) */}
        <g filter="url(#fire-glow-filter)">
          {firePoints.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={pt.r}
              fill="#ff4400"
              opacity={pt.opacity}
            />
          ))}
        </g>

        {/* 4. Dynamic Targeted Region Bounding Box */}
        {showBox && (
          <g className="transition-opacity duration-300">
            <rect
              x={focus.boxX}
              y={focus.boxY}
              width={focus.boxW}
              height={focus.boxH}
              fill="rgba(255, 68, 0, 0.12)"
              stroke="#ff4400"
              strokeWidth="1.6"
              strokeDasharray="4 2"
            />

            {/* Region Title Label */}
            {showLabel && (
              <text
                x={focus.boxX + focus.boxW / 2}
                y={Math.max(focus.boxY - 6, 14)}
                textAnchor="middle"
                fill="#ffffff"
                stroke="#ff4400"
                strokeWidth="0.5"
                fontSize="10"
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
