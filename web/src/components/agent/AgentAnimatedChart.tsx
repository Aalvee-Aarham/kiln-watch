import { useMemo } from 'react'

/**
 * Animated Comparative Graph Canvas Overlay
 * Replicates the exact graph drawing sequence:
 * - Fades in over the zoomed map with translucent obsidian glass (map visible behind at ~15% opacity).
 * - Timeline axis: SEP, OCT, NOV, DEC.
 * - 3200ms - 4200ms: Blue 23-Year Normal bell curve draws left-to-right with shaded ribbon.
 * - 4200ms - 5200ms: Orange This Season spline draws left-to-right through 6 nodes, spiking high above normal.
 * - 4800ms - 5400ms: "CRITICAL WEEKS" shaded dashed box fades in over November.
 * - 5200ms - 5800ms: Hero verdict "Yes, 2.1× the normal for this week" reveals in bottom left.
 */
export function AgentAnimatedChart({
  timeMs,
  locationName = 'PUNJAB, INDIA',
  multiplier = 2.1
}: {
  timeMs: number
  locationName?: string
  multiplier?: number
}) {
  // Graph visibility begins at 2800ms
  const isVisible = timeMs >= 2800

  const overlayOpacity = useMemo(() => {
    if (timeMs < 2800) return 0
    if (timeMs >= 3200) return 1
    return (timeMs - 2800) / 400
  }, [timeMs])

  // Normal Curve sweep (3200ms - 4200ms)
  const normalProgress = useMemo(() => {
    if (timeMs < 3200) return 0
    if (timeMs >= 4200) return 1
    return (timeMs - 3200) / 1000
  }, [timeMs])

  // Season Curve sweep (4200ms - 5200ms)
  const seasonProgress = useMemo(() => {
    if (timeMs < 4200) return 0
    if (timeMs >= 5200) return 1
    return (timeMs - 4200) / 1000
  }, [timeMs])

  // Critical weeks box fade (4800ms - 5400ms)
  const criticalOpacity = useMemo(() => {
    if (timeMs < 4800) return 0
    if (timeMs >= 5400) return 1
    return (timeMs - 4800) / 600
  }, [timeMs])

  // Verdict text fade (5200ms - 5800ms)
  const verdictOpacity = useMemo(() => {
    if (timeMs < 5200) return 0
    if (timeMs >= 5800) return 1
    return (timeMs - 5200) / 600
  }, [timeMs])

  // Dynamic curve heights calibrated to region multiplier
  const peakY = Math.max(Math.round(340 - 155 * (multiplier / 1.3)), 55)
  const midY1 = Math.round(340 - (340 - peakY) * 0.45)
  const midY2 = Math.round(340 - (340 - peakY) * 0.62)

  // SVG Geometry definitions in 800x400 viewBox
  const normalPath = 'M 80 340 C 180 338, 260 330, 340 280 C 420 180, 500 180, 580 290 C 640 330, 680 338, 720 340'
  const normalArea = 'M 80 340 C 180 338, 260 330, 340 280 C 420 180, 500 180, 580 290 C 640 330, 680 338, 720 340 L 720 340 L 80 340 Z'

  // Spiking Spline for This Season
  const seasonPath = `M 80 335 C 180 335, 260 310, 340 ${midY1} C 390 ${midY2}, 410 ${peakY}, 440 ${peakY} C 475 ${peakY}, 500 ${midY2}, 540 ${midY2} C 580 290, 640 335, 720 338`

  // 6 Nodes along curve
  const nodes = [
    { x: 80, y: 335, revealAt: 0.05 },
    { x: 230, y: 325, revealAt: 0.22 },
    { x: 340, y: midY1, revealAt: 0.45 },
    { x: 440, y: peakY, revealAt: 0.65 }, // Peak
    { x: 540, y: midY2, revealAt: 0.82 },
    { x: 670, y: 330, revealAt: 0.95 }
  ]

  if (!isVisible) return null

  return (
    <div
      className="absolute inset-0 flex flex-col justify-between rounded-tl-[14px] lg:rounded-bl-[14px] p-6 sm:p-7 transition-opacity duration-500 select-none backdrop-blur-[6px]"
      style={{
        opacity: overlayOpacity,
        background: 'rgba(8, 12, 20, 0.86)'
      }}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-300">
          {locationName.toUpperCase()} · THIS SEASON VS 23-YEAR NORMAL
        </h2>
      </div>

      {/* Main SVG Graph Canvas */}
      <div className="relative my-auto h-[280px] w-full">
        <svg
          viewBox="0 0 800 400"
          className="h-full w-full overflow-visible"
        >
          <defs>
            {/* Soft Blue Normal Area Gradient */}
            <linearGradient id="normalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.02" />
            </linearGradient>

            {/* Glowing Orange Filter for This Season */}
            <filter id="orangeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Clip path for Normal Path sweep */}
            <clipPath id="normalClip">
              <rect x="0" y="0" width={80 + normalProgress * 680} height="400" />
            </clipPath>

            {/* Clip path for Season Path sweep */}
            <clipPath id="seasonClip">
              <rect x="0" y="0" width={80 + seasonProgress * 680} height="400" />
            </clipPath>
          </defs>

          {/* Critical Weeks Highlight Box */}
          {criticalOpacity > 0 && (
            <g style={{ opacity: criticalOpacity }}>
              <rect
                x="370"
                y="85"
                width="160"
                height="255"
                fill="rgba(255, 85, 0, 0.08)"
                stroke="rgba(255, 85, 0, 0.3)"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
              <text
                x="450"
                y="318"
                textAnchor="middle"
                fill="#ff9e7d"
                fontSize="11"
                fontFamily="system-ui, sans-serif"
                fontWeight="700"
                letterSpacing="0.14em"
              >
                CRITICAL WEEKS
              </text>
            </g>
          )}

          {/* 23-Year Normal Shaded Area & Line */}
          <g clipPath="url(#normalClip)">
            <path d={normalArea} fill="url(#normalGrad)" />
            <path
              d={normalPath}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeOpacity="0.85"
            />
          </g>

          {/* 23-Year Normal Text Label */}
          {normalProgress >= 0.95 && (
            <text
              x="90"
              y="285"
              fill="#64748b"
              fontSize="11"
              fontFamily="system-ui, sans-serif"
              fontWeight="700"
              letterSpacing="0.12em"
              className="animate-fadeIn"
            >
              23-YEAR NORMAL
            </text>
          )}

          {/* This Season Radiant Line */}
          <g clipPath="url(#seasonClip)">
            <path
              d={seasonPath}
              fill="none"
              stroke="#ff5500"
              strokeWidth="3.5"
              filter="url(#orangeGlow)"
            />
          </g>

          {/* Nodes along This Season Curve */}
          {nodes.map((nd, idx) => {
            if (seasonProgress < nd.revealAt) return null
            return (
              <circle
                key={idx}
                cx={nd.x}
                cy={nd.y}
                r={idx === 3 ? 5.5 : 4.5} // Peak node slightly larger
                fill="#ffffff"
                stroke="#ff5500"
                strokeWidth={idx === 3 ? 3 : 2}
                className="animate-scaleIn"
              />
            )
          })}

          {/* "THIS SEASON" Label */}
          {seasonProgress >= 0.85 && (
            <text
              x="575"
              y="235"
              fill="#ff6a1a"
              fontSize="11"
              fontFamily="system-ui, sans-serif"
              fontWeight="700"
              letterSpacing="0.12em"
              className="animate-fadeIn"
            >
              THIS SEASON
            </text>
          )}

          {/* Bottom Baseline Axis */}
          <line
            x1="80"
            y1="340"
            x2="720"
            y2="340"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="1"
          />

          {/* Month Labels */}
          <g fill="#64748b" fontSize="11" fontFamily="ui-monospace, monospace">
            <text x="80" y="365">SEP</text>
            <text x="240" y="365">OCT</text>
            <text x="440" y="365">NOV</text>
            <text x="680" y="365">DEC</text>
          </g>
        </svg>
      </div>

      {/* Bottom Hero Callout & Verdict */}
      <div
        className="flex flex-col justify-end pt-2 transition-opacity duration-500"
        style={{ opacity: verdictOpacity }}
      >
        <div className="flex items-baseline gap-2">
          {/* Classical serif italic "Yes," */}
          <span
            className="text-3xl sm:text-4xl italic font-normal"
            style={{
              color: '#ff9e7d',
              fontFamily: 'Playfair Display, Georgia, "Times New Roman", serif'
            }}
          >
            Yes,
          </span>
          {/* Bold display verdict */}
          <span
            className="text-2xl sm:text-3xl font-bold tracking-tight text-white"
            style={{ fontFamily: 'Anek Display, Outfit, system-ui, sans-serif' }}
          >
            {multiplier.toFixed(1)}× the normal for this week
          </span>
        </div>

        {/* Sources attribution */}
        <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-400">
          SOURCES: NASA FIRMS · MODIS · VIIRS
        </p>
      </div>
    </div>
  )
}
