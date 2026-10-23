import { useMemo } from 'react'
import type { ChartDataPoint } from '../../lib/agentEngine'

/**
 * Animated Comparative Graph Canvas Overlay, drawn from the place's real monthly series (agentEngine chartData):
 * - Fades in over the zoomed map with translucent obsidian glass (map visible behind at ~15% opacity).
 * - Timeline axis: July to June, the project's season.
 * - 3200ms - 4200ms: blue typical-year line (seasons before this one) draws left-to-right, with the typical high dashed.
 * - 4200ms - 5200ms: orange this-season line draws through the months reached so far.
 * - 4800ms - 5400ms: the busiest months, from the typical year, fade in as a shaded box.
 * - 5200ms - 5800ms: the headline (computed by agentEngine) and its sources reveal in bottom left.
 */
export function AgentAnimatedChart({
  timeMs,
  locationName,
  chartData,
  criticalSpan,
  headline,
  sources
}: {
  timeMs: number
  locationName: string
  chartData: ChartDataPoint[]
  criticalSpan: [number, number] | null
  headline: string
  sources: string
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

  // Geometry in the 800x400 viewBox: 12 months from x = 80 to 720, values scaled to the largest shown.
  const xOf = (i: number) => 80 + (i * 640) / Math.max(1, chartData.length - 1)
  const yMax = Math.max(1e-9, ...chartData.flatMap((d) => [d.normal, d.normalP90, d.season]).filter((v): v is number => v !== null && v !== undefined))
  const yOf = (v: number) => 340 - (v / yMax) * 250
  const line = (key: 'normal' | 'normalP90' | 'season') => chartData
    .map((d, i) => (d[key] === null || d[key] === undefined ? null : `${xOf(i)} ${yOf(d[key] as number)}`))
    .filter(Boolean).map((pt, i) => `${i ? 'L' : 'M'} ${pt}`).join(' ')
  const normalPath = line('normal')
  const p90Path = line('normalP90')
  const normalArea = normalPath ? `${normalPath} L ${xOf(chartData.length - 1)} 340 L 80 340 Z` : ''
  const seasonPath = line('season')
  const reached = chartData.map((d, i) => ({ d, i })).filter(({ d }) => d.season !== null)
  const nodes = reached.map(({ d, i }, k) => ({ x: xOf(i), y: yOf(d.season as number), revealAt: (k + 1) / Math.max(1, reached.length) }))
  const peakNode = nodes.reduce((m, n, k) => (n.y < (nodes[m]?.y ?? Infinity) ? k : m), 0)
  const half = 320 / Math.max(1, chartData.length - 1)
  const box = criticalSpan && criticalSpan[0] <= criticalSpan[1] ? { x: xOf(criticalSpan[0]) - half, w: xOf(criticalSpan[1]) - xOf(criticalSpan[0]) + 2 * half } : null

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
          {locationName.toUpperCase()} · THIS SEASON VS TYPICAL YEAR
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
          {box && criticalOpacity > 0 && (
            <g style={{ opacity: criticalOpacity }}>
              <rect
                x={box.x}
                y="85"
                width={box.w}
                height="255"
                fill="rgba(255, 85, 0, 0.08)"
                stroke="rgba(255, 85, 0, 0.3)"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
              <text
                x={box.x + box.w / 2}
                y="318"
                textAnchor="middle"
                fill="#ff9e7d"
                fontSize="11"
                fontFamily="system-ui, sans-serif"
                fontWeight="700"
                letterSpacing="0.14em"
              >
                BUSIEST MONTHS
              </text>
            </g>
          )}

          {/* Typical-year Shaded Area & Line */}
          <g clipPath="url(#normalClip)">
            <path d={normalArea} fill="url(#normalGrad)" />
            <path d={p90Path} fill="none" stroke="#38bdf8" strokeWidth="1.2" strokeOpacity="0.6" strokeDasharray="5 4" />
            <path
              d={normalPath}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeOpacity="0.85"
            />
          </g>

          {/* Typical-year Text Label */}
          {normalProgress >= 0.95 && chartData.length > 0 && (
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
              TYPICAL YEAR (DASHED: TYPICAL HIGH)
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
                r={idx === peakNode ? 5.5 : 4.5} // Peak node slightly larger
                fill="#ffffff"
                stroke="#ff5500"
                strokeWidth={idx === peakNode ? 3 : 2}
                className="animate-scaleIn"
              />
            )
          })}

          {/* "THIS SEASON" Label */}
          {seasonProgress >= 0.85 && nodes.length > 0 && (
            <text
              x={Math.min(nodes[nodes.length - 1].x + 10, 640)}
              y={Math.max(nodes[nodes.length - 1].y - 10, 70)}
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
          <g fill="#64748b" fontSize="10" fontFamily="ui-monospace, monospace" textAnchor="middle">
            {chartData.map((d, i) => <text key={d.label} x={xOf(i)} y="365">{d.label}</text>)}
          </g>
          {chartData.length === 0 && (
            <text x="400" y="200" textAnchor="middle" fill="#94a3b8" fontSize="14" fontFamily="system-ui, sans-serif">No measured data for this place yet</text>
          )}
        </svg>
      </div>

      {/* Bottom Hero Callout & Verdict */}
      <div
        className="flex flex-col justify-end pt-2 transition-opacity duration-500"
        style={{ opacity: verdictOpacity }}
      >
        <p
          className="text-base sm:text-lg font-bold leading-snug tracking-tight text-white"
          style={{ fontFamily: 'Anek Display, Outfit, system-ui, sans-serif' }}
        >
          {headline}
        </p>

        {/* Sources attribution */}
        <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-400">
          {sources}
        </p>
      </div>
    </div>
  )
}
