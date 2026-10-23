import { useState } from 'react'
import type { AgentStep } from '../../lib/agentEngine'

/**
 * Autonomous Agent Stepper & Chat Sidebar
 * Clean, modern functional right panel:
 * - Header: • AI AGENT / IT PLANS ITS OWN STEPS
 * - User query bubble displaying active question.
 * - Sequential step checklist synced to map zoom and graph reveal; a step is ticked only when its timeline moment
 *   has passed AND its data file has loaded (`steps[i].status`), and each shows what it actually used.
 * - Instant interactive input field.
 */
export function AgentStepperPanel({
  timeMs,
  queryText = '',
  steps = [],
  coverage,
  onUserSubmit
}: {
  timeMs: number
  queryText?: string
  steps?: AgentStep[]
  coverage?: string
  onUserSubmit?: (q: string) => void
}) {
  const [inputVal, setInputVal] = useState('')

  const hasQuery = Boolean(queryText && queryText.trim())

  // Show user bubble immediately upon query dispatch
  const showChatBubble = hasQuery && timeMs >= 200

  // Steps appear at 400 / 1000 / 1800 / 2800 ms and can tick from 800 / 1600 / 2600 / 3200 ms, once loaded.
  const TIMES = [[400, 800], [1000, 1600], [1800, 2600], [2800, 3200]]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputVal.trim()) return
    onUserSubmit?.(inputVal.trim())
    setInputVal('')
  }

  return (
    <div className="flex h-full w-full flex-col justify-between rounded-r-[12px] bg-[#080d17] p-6 text-neutral-200">
      {/* Header & Steps */}
      <div className="space-y-6">
        {/* Title */}
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#ff5500] shadow-[0_0_8px_#ff5500]" />
            <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#ff5500]">
              AI AGENT
            </span>
          </div>
          <h3 className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-400">
            IT PLANS ITS OWN STEPS
          </h3>
        </div>

        {!hasQuery ? (
          <div className="rounded-[8px] border border-dashed border-white/10 bg-[#0d1424]/70 p-5 space-y-3">
            <div className="flex items-center gap-2 text-[#ff5500] font-mono text-xs font-semibold uppercase tracking-wider">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Awaiting Your Prompt</span>
            </div>
            <p className="text-xs leading-relaxed text-neutral-300">
              Type any question below or click a suggested prompt above. The stage reads Kiln Watch's own files: the area's harmonized NASA FIRMS calendar since 2003, this season's live data and its kiln seasons.
            </p>
            <div className="border-t border-white/5 pt-3">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-neutral-400 block mb-1">
                Geographic Coverage:
              </span>
              <p className="text-[11px] text-neutral-400 leading-normal">
                {coverage ?? 'Loading the list of areas…'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* User Query Bubble */}
            {showChatBubble ? (
              <div className="rounded-[8px] border border-white/5 bg-[#121926] p-3.5 text-xs sm:text-[13px] leading-relaxed text-neutral-100 shadow-sm">
                {queryText}
              </div>
            ) : (
              <div className="h-[48px]" />
            )}

            {/* Dynamic 4-Step Checklist */}
            <div className="space-y-4 font-mono text-xs">
              {steps.map((st, i) => {
                const [show, tick] = TIMES[i] ?? [0, 0]
                if (timeMs < show) return null
                const done = timeMs >= tick && st.status === 'completed'
                const waiting = timeMs >= tick && st.status !== 'completed'
                return (
                  <div key={st.id} className="flex items-start gap-3 transition-opacity duration-300">
                    <div className="mt-0.5">
                      {done ? (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#ff5500] shadow-[0_0_6px_rgba(255,85,0,0.6)]">
                          <svg className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      ) : (
                        <span className={`flex h-4 w-4 rounded-full border ${waiting ? 'border-dashed border-neutral-400' : 'border-neutral-600'}`} />
                      )}
                    </div>
                    <div>
                      <div className="font-bold tracking-wide text-neutral-100">{st.title}</div>
                      <div className="text-[11px] text-neutral-400">{st.detail}</div>
                    </div>
                  </div>
                )
              })}
          </div>
        </>
      )}
    </div>

      {/* Clean Interactive Input Bar */}
      <div className="mt-6">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Ask about Punjab, Dhaka, Chittagong..."
            className="flex-1 rounded-[6px] border border-white/10 bg-[#060911] px-3.5 py-2.5 text-xs text-neutral-200 placeholder:text-neutral-500 focus:border-[#ff5500] focus:outline-none"
          />

          <button
            type="submit"
            className="rounded-[6px] bg-[#ff5500] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-[#ff6a1a] cursor-pointer"
          >
            SEND
          </button>
        </form>
      </div>
    </div>
  )
}
