import { useState, useEffect, type ReactNode } from 'react'
import { StatusMessage, useTitle, Icon, useKilnActivity } from '../components/ui'
import { PageHead } from '../components/plain'
import { useJson } from '../lib/data'
import { buildSystemPrompt, type Facts } from '../lib/geminiPrompt'
import { busyMonths, SEASON_MONTHS, typicalSeason, whenText } from '../lib/plain'
import { seasonMean } from '../lib/calendar'
import type { AskCache, Calendar, FC, NrtSeason } from '../lib/types'

function ApiKeyInput({ apiKey, setApiKey }: { apiKey: string, setApiKey: (k: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <details className="mt-4 text-sm" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer font-medium text-orbit">Settings: Gemini API Key (Demo Mode)</summary>
      <div className="mt-2 flex max-w-lg flex-col gap-2 rounded-[6px] border border-line p-3 shadow-sm">
        <label className="font-semibold text-ink">Gemini API Key</label>
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
          placeholder="AIzaSy..." className="field w-full" />
        <p className="text-xs text-muted">Your key stays in this browser only — never sent to our server.</p>
      </div>
    </details>
  )
}

function LiveChat({ apiKey }: { apiKey: string }) {
  const dists = useJson<FC>('aoi/districts.geojson').data
  const nrt = useJson<NrtSeason>('nrt/current_season.json').data
  const ka = useKilnActivity().data

  const [unit, setUnit] = useState('21') // Default to Dhaka
  const sortedDists = (dists?.features ?? []).map(f => ({ id: f.properties.unit_id, name: f.properties.name_en })).sort((a, b) => a.name.localeCompare(b.name))
  const selectedUnit = unit && sortedDists.length > 0 ? unit : sortedDists[0]?.id
  useEffect(() => { if (sortedDists.length > 0 && !sortedDists.find(d => d.id === unit)) setUnit(sortedDists[0].id) }, [sortedDists, unit])

  const cal = useJson<Calendar>(selectedUnit ? `calendar/${selectedUnit}.json` : null).data
  const name = sortedDists.find(d => d.id === selectedUnit)?.name ?? ''

  const [q, setQ] = useState('')
  const [ans, setAns] = useState<ReactNode>(null)
  const [loading, setLoading] = useState(false)

  const askModel = async () => {
    if (!q.trim() || !cal || !nrt) return
    setLoading(true)
    setAns(null)

    try {
      const bm = busyMonths(seasonMean(cal))
      const kilnInfo = ka?.areas?.[selectedUnit] ? typicalSeason(ka.areas[selectedUnit].seasons) : null

      const facts: Facts = {
        districtName: name,
        fireSeasonMonths: bm ? `${SEASON_MONTHS[bm.first]} to ${SEASON_MONTHS[bm.last]}` : 'quiet',
        unusualDaysThisSeason: nrt.districts[selectedUnit]?.above_p90_days ?? 0,
        kilnSeason: kilnInfo ? `${whenText(kilnInfo.onset)} to ${whenText(kilnInfo.end)}` : null,
        currentSeason: nrt.season
      }
      const sys = buildSystemPrompt(facts)

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: sys + '\n\nUser Question: ' + q }] }] })
      })
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No answer returned.'

      // Guardrail: strip numbers not in context
      const contextStr = sys
      const nums = [...text.matchAll(/\b\d+(?:\.\d+)?\b/g)].map(m => m[0])
      const badNum = nums.find(n => !contextStr.includes(n))

      if (badNum) {
        setAns(<StatusMessage kind="error">Blocked: the model hallucinated the number "{badNum}" which is not in our data. We show nothing rather than an unchecked figure.</StatusMessage>)
      } else {
        setAns(text)
      }
    } catch (e: any) {
      setAns(<StatusMessage kind="error">Failed to connect: {e.message}</StatusMessage>)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        Select a district context for the AI:
        <select className="field py-1 px-2" value={selectedUnit} onChange={e => setUnit(e.target.value)}>
          {sortedDists.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <input className="field flex-1" value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') askModel() }} placeholder={`Ask about ${name}'s fire season...`} />
        <button className="btn btn-primary bg-orbit text-surface hover:bg-orbit-soft transition-colors" onClick={askModel} disabled={loading || !q.trim()}>Ask</button>
      </div>
      {loading && <div className="text-sm text-muted flex items-center gap-2"><Icon name="search" className="animate-spin" />Thinking...</div>}
      {ans && <div className="prose-measure whitespace-pre-wrap rounded-[6px] bg-surface-2 p-3 text-sm">{ans}</div>}
    </div>
  )
}

export default function AskPage() {
  useTitle('Ask Kiln Watch')
  const ask = useJson<AskCache>('ask.json')

  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('kw-gemini-key') ?? import.meta.env.VITE_GEMINI_KEY ?? '' }
    catch { return import.meta.env.VITE_GEMINI_KEY ?? '' }
  })
  useEffect(() => { try { localStorage.setItem('kw-gemini-key', apiKey) } catch { } }, [apiKey])

  return (
    <div className="space-y-8">
      <PageHead title="Ask Kiln Watch">
        Questions answered in plain words by a live AI model. The AI never works out a number: our own tested code does,
        and an answer that states any number our code did not return is blocked. Open “The data behind this answer” to check every figure.
      </PageHead>

      <ApiKeyInput apiKey={apiKey} setApiKey={setApiKey} />

      {apiKey ? (
        <LiveChat apiKey={apiKey} />
      ) : (
        <>
          <StatusMessage kind="info">Provide an API key above to chat live, or read the static cached answers below.</StatusMessage>
          {ask.loading ? null : !ask.data ? <StatusMessage kind="info">No answers have been generated for this data build yet.</StatusMessage>
            : <>
              <p className="text-sm text-muted">Answered by <span className="code">{ask.data.model}</span> on {ask.data.generated_at.slice(0, 10)} from data build <span className="code">{ask.data.data_build}</span>. Saved answers, not live: they do not change until the next data build.</p>
              <ul className="space-y-4">
                {ask.data.answers.map((a) => (
                  <li key={a.question} className="panel space-y-3" lang={a.lang}>
                    <b className="block text-lg leading-snug">“{a.question}”</b>
                    {a.answer ? <p className="ours">{a.answer}</p>
                      : <StatusMessage kind="error">Blocked: {a.reason ?? `the answer stated a number our data did not return (${(a.unsupported ?? []).join(', ')})`}. We show nothing rather than an unchecked figure.</StatusMessage>}
                    <details className="text-sm" lang="en">
                      <summary className="cursor-pointer text-orbit">The data behind this answer ({a.tools.length} {a.tools.length === 1 ? 'call' : 'calls'} to our code)</summary>
                      <ol className="mt-2 space-y-2">{a.tools.map((t, i) => (
                        <li key={i}><span className="code">{t.name}({Object.values(t.input).join(', ')})</span>
                          <pre className="mt-1 max-h-64 overflow-auto rounded-[6px] bg-surface-2 p-2 text-xs">{JSON.stringify(t.result, null, 1)}</pre></li>))}</ol>
                    </details>
                  </li>))}
              </ul>
            </>}
        </>
      )}
    </div>
  )
}
