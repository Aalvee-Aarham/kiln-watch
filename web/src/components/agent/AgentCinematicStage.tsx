import { useEffect, useRef, useState, useCallback } from 'react'
import { AgentAnimatedMap } from './AgentAnimatedMap'
import { AgentAnimatedChart } from './AgentAnimatedChart'
import { AgentStepperPanel } from './AgentStepperPanel'
import type { AgentResolution } from '../../lib/agentEngine'

const PRESET_QUERIES = [
  'Is this fire season in Punjab, India unusual?',
  'When is burning season in Rajshahi, Bangladesh?',
  'Show shifting cultivation (jhum) in Chittagong Hill Tracts',
  'Is fire in Dhaka above normal right now?',
  'How does Haryana compare to its 23-year baseline?'
]

const COMPLETE_MS = 6000

/**
 * Clean Flat 2D Full-Width AI Agent Stage
 * - Flat 2D modern glassmorphic dashboard (no 3D tilt, no macOS dots, no URL pill).
 * - True natural daytime NASA Blue Marble satellite view.
 * - Dynamic camera zoom targeting the exact queried location.
 * - Initial state is fully rendered and visible immediately.
 * - Smooth 6.0s execution sequence whenever a new resolution arrives.
 * - Draws only what the page passes in: the resolution (agentEngine, filled from the public export) and real fire
 *   detections; it never computes or invents a figure.
 */
export function AgentCinematicStage({
  res,
  cells = [],
  ambient = [],
  caption,
  coverage,
  onAsk
}: {
  res: AgentResolution | null
  cells?: { lat: number; lon: number }[]
  ambient?: { lat: number; lon: number }[]
  caption?: string
  coverage?: string
  onAsk: (query: string) => void
}) {
  const [activeQuery, setActiveQuery] = useState('')
  const [showGraph, setShowGraph] = useState(true)
  
  // Timeline state (0ms to 6000ms)
  const [timeMs, setTimeMs] = useState(0)
  const rafRef = useRef<number | null>(null)

  const runSequence = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    const startTime = performance.now()
    setTimeMs(0)

    const loop = (now: number) => {
      const elapsed = now - startTime
      if (elapsed >= COMPLETE_MS) {
        setTimeMs(COMPLETE_MS)
        rafRef.current = null
        return
      }
      setTimeMs(elapsed)
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [])

  const handleUserQuery = (q: string) => {
    setActiveQuery(q)
    setShowGraph(true)
    onAsk(q)
  }

  // Replay the timeline whenever the page delivers a new resolution (data loaded or a new question).
  useEffect(() => { if (res) runSequence() }, [res, runSequence])

  return (
    <div className="relative w-full overflow-hidden rounded-[14px] bg-[#030712] border border-white/10 shadow-2xl">
      {/* 1. Prompt Suggestions & Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-[#070c18] px-5 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-neutral-400 font-semibold mr-1">Suggested Prompts:</span>
          {PRESET_QUERIES.map((pq, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleUserQuery(pq)}
              className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-all cursor-pointer ${
                activeQuery === pq
                  ? 'border-[#ff5500] bg-[#ff5500]/20 text-orange-300 font-semibold shadow-[0_0_8px_rgba(255,85,0,0.4)]'
                  : 'border-white/10 bg-[#0d1424] text-neutral-300 hover:border-white/30 hover:text-white'
              }`}
            >
              {pq}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Map vs Graph view toggle (available after query submitted) */}
          {res && (
            <div className="flex items-center rounded border border-white/10 bg-[#0d1424] p-0.5 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setShowGraph(true)}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  showGraph ? 'bg-[#ff5500] text-black font-semibold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Graph Overlay
              </button>
              <button
                type="button"
                onClick={() => setShowGraph(false)}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  !showGraph ? 'bg-[#ff5500] text-black font-semibold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Map Only
              </button>
            </div>
          )}

          {res && (
            <button
              type="button"
              onClick={runSequence}
              className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-300 hover:text-white transition-colors cursor-pointer rounded border border-white/10 bg-[#0d1424] px-2.5 py-1"
            >
              <svg className="h-3 w-3 text-[#ff5500]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Replay Motion</span>
            </button>
          )}

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className={`h-2 w-2 rounded-full ${res?.status === 'measured' ? 'bg-emerald-400' : res?.status === 'error' ? 'bg-rose-500' : 'bg-neutral-500'}`} />
            <span className="text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
              {!res ? 'Kiln Watch data' : { measured: 'Measured data', loading: 'Loading Kiln Watch data', error: 'Could not load data', outside: 'Not measured yet', none: 'No place found' }[res.status]}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Full-Width Flat 2D Dual-Pane Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[540px] sm:min-h-[580px]">
        {/* Left Canvas (7 Cols): Daytime Satellite Map & Translucent Graph Overlay */}
        <div className="relative min-h-[460px] sm:min-h-[520px] lg:min-h-[580px] h-full w-full border-b border-white/5 lg:col-span-7 lg:border-b-0 lg:border-r overflow-hidden flex flex-col">
          {/* Daytime Satellite Map with dynamic zoom to queried region */}
          <AgentAnimatedMap
            timeMs={timeMs}
            locationName={res?.locationName}
            mapFocus={res?.mapFocus}
            cells={cells}
            ambient={ambient}
            caption={showGraph ? undefined : caption}
          />

          {/* Animated 23-Year Comparative Graph Overlay */}
          {res && showGraph && (
            <AgentAnimatedChart
              timeMs={timeMs}
              locationName={res.locationName}
              chartData={res.chartData}
              criticalSpan={res.criticalSpan}
              headline={res.headline}
              sources={res.sources}
            />
          )}
        </div>

        {/* Right Panel (5 Cols): Stepper & Chat */}
        <div className="lg:col-span-5 flex flex-col">
          <AgentStepperPanel
            timeMs={timeMs}
            queryText={activeQuery}
            steps={res?.steps}
            coverage={coverage}
            onUserSubmit={handleUserQuery}
          />
        </div>
      </div>
    </div>
  )
}
