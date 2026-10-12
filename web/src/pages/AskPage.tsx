import { useState, useEffect } from 'react'
import { useTitle } from '../components/ui'
import { PageHead } from '../components/plain'
import { AgentCinematicStage } from '../components/agent/AgentCinematicStage'
import { AgentNewsCanvas } from '../components/AgentNewsCanvas'
import { parseUserQuery, type AgentResolution } from '../lib/agentEngine'
import { useJson } from '../lib/data'
import { askGemini, buildSystemPrompt, type Facts } from '../lib/geminiPrompt'
import type { AskCache } from '../lib/types'

export default function AskPage() {
  useTitle('AI Agent · Just Ask')

  const [activeQuery, setActiveQuery] = useState('Is this fire season in Punjab, India unusual?')
  const [res, setRes] = useState<AgentResolution>(() => parseUserQuery('Is this fire season in Punjab, India unusual?'))

  // API & fallback state
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('kw-gemini-key') ?? '' } catch { return '' }
  })
  useEffect(() => { try { localStorage.setItem('kw-gemini-key', apiKey) } catch { /* ignore */ } }, [apiKey])
  
  const [liveAnswer, setLiveAnswer] = useState<string | null>(null)
  const [isCallingGemini, setIsCallingGemini] = useState(false)
  const askCache = useJson<AskCache>('ask.json')

  const queryGemini = (targetRes: AgentResolution, queryStr: string) => {
    if (!apiKey) return
    setIsCallingGemini(true)
    setLiveAnswer(null)

    const facts: Facts = {
      districtName: targetRes.locationName,
      fireSeasonMonths: targetRes.criticalWeeks,
      unusualDaysThisSeason: Math.round(targetRes.multiplier * 5),
      kilnSeason: null,
      currentSeason: '2026-27'
    }
    const sys = buildSystemPrompt(facts)
    askGemini(fetch, apiKey, sys, queryStr)
      .then((text) => {
        setLiveAnswer(text)
      })
      .catch((err) => {
        console.warn('Gemini query error:', err)
      })
      .finally(() => {
        setIsCallingGemini(false)
      })
  }

  // Trigger Gemini whenever query changes if key exists
  useEffect(() => {
    if (apiKey) {
      queryGemini(res, activeQuery)
    }
  }, [apiKey, activeQuery, res])

  return (
    <div className="space-y-8 max-w-none">
      {/* Page Header */}
      <PageHead title="AI Agent · Ask Kiln Watch">
        Ask natural-language questions about fire activity, 23-year historical baselines, and crop burning cycles across South Asia and the world. The agent plans its own steps, draws coordinates, harmonizes NASA sensor records, and visualizes the answer.
      </PageHead>

      {/* Flagship Flat 2D Full-Width Stage */}
      <AgentCinematicStage
        onQueryChange={(newRes, newQ) => {
          setRes(newRes)
          setActiveQuery(newQ)
        }}
      />

      {/* Historical Fire Incidents & News Context */}
      <div className="space-y-3">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
          Historical Precedents & News Context for {res.locationName}
        </h3>
        <AgentNewsCanvas res={res} />
      </div>

      {/* Satellite Evidence Synthesis */}
      <div className="rounded-[10px] border border-line bg-surface p-5 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-orbit">
            Satellite Evidence & Agronomic Synthesis
          </h4>
          <span className="font-mono text-[11px] text-muted">
            NASA FIRMS · 23-Year Baseline
          </span>
        </div>
        
        <p className="leading-relaxed text-muted">
          {res.detailsText}
        </p>

        {isCallingGemini && (
          <div className="border-t border-line pt-2 text-xs text-muted flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-orbit animate-ping" />
            <span>Consulting Gemini Earth Observation model...</span>
          </div>
        )}

        {liveAnswer && (
          <div className="mt-3 border-t border-line pt-3 text-ink">
            <span className="font-mono text-xs font-semibold text-orbit block">Live Gemini Analysis:</span>
            <p className="mt-1 leading-relaxed">{liveAnswer}</p>
          </div>
        )}
      </div>

      {/* Optional Gemini API Key Drawer */}
      <details className="text-sm border border-line rounded-[8px] p-3 bg-surface">
        <summary className="cursor-pointer font-medium text-orbit">
          Gemini API Key (Optional Live Reasoning) & Verified Offline Answers
        </summary>
        <div className="mt-3 space-y-4">
          <div className="max-w-md space-y-2">
            <label htmlFor="kw-gemini-key" className="font-semibold text-xs text-ink block">
              Gemini API Key
            </label>
            <input
              id="kw-gemini-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="field w-full text-xs"
            />
            <p className="text-[11px] text-muted">
              Key is stored only in your local browser and sent directly to Google Gemini.
            </p>
          </div>

          {askCache.data && (
            <div className="space-y-2 border-t border-line pt-3">
              <h4 className="font-mono text-xs font-bold text-muted uppercase">
                Verified Static Answers from Data Build ({askCache.data.data_build})
              </h4>
              <ul className="space-y-2">
                {askCache.data.answers.slice(0, 3).map((a, i) => (
                  <li key={i} className="rounded bg-surface-2 p-2 text-xs">
                    <b>“{a.question}”</b>
                    <p className="mt-1 text-muted">{a.answer}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </div>
  )
}
