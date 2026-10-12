import { useState } from 'react'

/**
 * Autonomous Agent Stepper & Chat Sidebar
 * Clean, modern functional right panel:
 * - Header: • AI AGENT / IT PLANS ITS OWN STEPS
 * - User query bubble displaying active question.
 * - Sequential step checklist synced to map zoom and graph reveal.
 * - Instant interactive input field.
 */
export function AgentStepperPanel({
  timeMs,
  queryText = '',
  locationName = '',
  onUserSubmit
}: {
  timeMs: number
  queryText?: string
  locationName?: string
  onUserSubmit?: (q: string) => void
}) {
  const [inputVal, setInputVal] = useState('')

  const hasQuery = Boolean(queryText && queryText.trim())

  // Show user bubble immediately upon query dispatch
  const showChatBubble = hasQuery && timeMs >= 200

  // Step 1: Draw area (Appears 400ms -> Checks 800ms)
  const showStep1 = hasQuery && timeMs >= 400
  const checkStep1 = hasQuery && timeMs >= 800

  // Step 2: Fetch NASA FIRMS (Appears 1000ms -> Checks 1600ms)
  const showStep2 = hasQuery && timeMs >= 1000
  const checkStep2 = hasQuery && timeMs >= 1600

  // Step 3: Harmonize (Appears 1800ms -> Checks 2600ms as map zooms)
  const showStep3 = hasQuery && timeMs >= 1800
  const checkStep3 = hasQuery && timeMs >= 2600

  // Step 4: Compare with 23 years (Appears 2800ms -> Checks 3200ms as graph dissolves)
  const showStep4 = hasQuery && timeMs >= 2800
  const checkStep4 = hasQuery && timeMs >= 3200

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
              Type any question below or click a suggested prompt above to analyze NASA FIRMS satellite observations, 23-year historical normals, and agricultural crop cycles.
            </p>
            <div className="border-t border-white/5 pt-3">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-neutral-400 block mb-1">
                Geographic Coverage:
              </span>
              <p className="text-[11px] text-neutral-400 leading-normal">
                All 64 districts of Bangladesh, all states of India, and Southeast Asia (Myanmar, Thailand, Vietnam, Laos, Indonesia, etc.).
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
              {/* Step 1 */}
              {showStep1 && (
                <div className="flex items-start gap-3 transition-opacity duration-300">
                  <div className="mt-0.5">
                    {checkStep1 ? (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#ff5500] shadow-[0_0_6px_rgba(255,85,0,0.6)]">
                        <svg className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    ) : (
                      <span className="flex h-4 w-4 rounded-full border border-neutral-600" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold tracking-wide text-neutral-100">Draw area</div>
                    <div className="text-[11px] text-neutral-400">{locationName}</div>
                  </div>
                </div>
              )}

          {/* Step 2 */}
          {showStep2 && (
            <div className="flex items-start gap-3 transition-opacity duration-300">
              <div className="mt-0.5">
                {checkStep2 ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#ff5500] shadow-[0_0_6px_rgba(255,85,0,0.6)]">
                    <svg className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                ) : (
                  <span className="flex h-4 w-4 rounded-full border border-neutral-600" />
                )}
              </div>
              <div>
                <div className="font-bold tracking-wide text-neutral-100">Fetch NASA FIRMS</div>
                <div className="text-[11px] text-neutral-400">MODIS + VIIRS</div>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {showStep3 && (
            <div className="flex items-start gap-3 transition-opacity duration-300">
              <div className="mt-0.5">
                {checkStep3 ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#ff5500] shadow-[0_0_6px_rgba(255,85,0,0.6)]">
                    <svg className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                ) : (
                  <span className="flex h-4 w-4 rounded-full border border-neutral-600" />
                )}
              </div>
              <div>
                <div className="font-bold tracking-wide text-neutral-100">Harmonize</div>
                <div className="text-[11px] text-neutral-400">both cameras, one record</div>
              </div>
            </div>
          )}

          {/* Step 4 */}
          {showStep4 && (
            <div className="flex items-start gap-3 transition-opacity duration-300">
              <div className="mt-0.5">
                {checkStep4 ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#ff5500] shadow-[0_0_6px_rgba(255,85,0,0.6)]">
                    <svg className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                ) : (
                  <span className="flex h-4 w-4 rounded-full border border-neutral-600" />
                )}
              </div>
              <div>
                <div className="font-bold tracking-wide text-neutral-100">Compare with 23 years</div>
                <div className="text-[11px] text-neutral-400">2003 - today</div>
              </div>
            </div>
          )}
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
