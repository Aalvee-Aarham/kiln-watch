import { useState, useEffect } from 'react'
import { IllustrativeNote, StatusMessage, useTitle, Icon, useKilnActivity } from '../components/ui'
import { PageHead } from '../components/plain'
import { AnswerCard } from '../components/AskAnswer'
import { AgentCinematicStage } from '../components/agent/AgentCinematicStage'
import { AgentNewsCanvas } from '../components/AgentNewsCanvas'
import type { AgentResolution } from '../lib/agentEngine'
import { unitAt } from '../lib/geo'
import { loadHistory, newId, saveHistory, withAnswer, type SavedAnswer } from '../lib/askHistory'
import { dataUrl, useJson } from '../lib/data'
import { ASK_ENDPOINT, askLive } from '../lib/askApi'
import { askGemini, buildSystemPrompt, districtFacts, factsResult, unsupportedNumbers } from '../lib/geminiPrompt'
import type { Calendar, FC, KilnActivity, NrtSeason } from '../lib/types'

function ApiKeyInput({ apiKey, setApiKey }: { apiKey: string, setApiKey: (k: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <details className="mt-4 text-sm" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer font-medium text-orbit">Settings: Gemini API Key (Demo Mode)</summary>
      <div className="mt-2 flex max-w-lg flex-col gap-2 rounded-[6px] border border-line p-3 shadow-sm">
        <label htmlFor="kw-gemini-key" className="font-semibold text-ink">Gemini API Key</label>
        <input id="kw-gemini-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
          placeholder="AIzaSy..." className="field w-full" />
        <p className="text-xs text-muted">Your key is saved in this browser and sent only to Google’s Gemini API, never to us.</p>
      </div>
    </details>
  )
}

function LiveChat({ apiKey, onAnswer }: { apiKey: string; onAnswer: (a: SavedAnswer) => void }) {
  const dists = useJson<FC>('aoi/districts.geojson').data
  const nrt = useJson<NrtSeason>('nrt/current_season.json').data
  const ka = useKilnActivity().data

  const [unit, setUnit] = useState('BD3026') // Dhaka
  const sortedDists = (dists?.features ?? []).map(f => ({ id: f.properties.unit_id, name: f.properties.name_en })).sort((a, b) => a.name.localeCompare(b.name))
  const selectedUnit = unit && sortedDists.length > 0 ? unit : sortedDists[0]?.id
  useEffect(() => { if (sortedDists.length > 0 && !sortedDists.find(d => d.id === unit)) setUnit(sortedDists[0].id) }, [sortedDists, unit])

  const cal = useJson<Calendar>(selectedUnit ? `calendar/${selectedUnit}.json` : null).data
  const name = sortedDists.find(d => d.id === selectedUnit)?.name ?? ''

  const [q, setQ] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const askModel = async () => {
    if (loading || !q.trim() || !cal || !nrt) return
    setLoading(true)
    setErr(null)

    try {
      const facts = districtFacts(name, selectedUnit, cal, nrt, ka)
      const sys = buildSystemPrompt(facts)

      const text = await askGemini(fetch, apiKey, sys, q)

      const bad = unsupportedNumbers(text, sys)
      // the facts the model was given are its evidence: saved as one "call", so its figures can be traced
      const result = factsResult(facts)
      onAnswer({ id: newId(), asked_at: new Date().toISOString(), via: 'your-gemini-key', question: q.trim(),
        answer: bad.length ? null : text, blocked: bad.length > 0, unsupported: bad, tools: [{ name: 'district_facts', input: { district: name }, result }] })
      setQ('')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setErr(`Could not get an answer: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel space-y-4">
      <label className="flex flex-wrap items-center gap-2 text-sm text-muted">
        District the AI answers about:
        <select className="field py-1 px-2" value={selectedUnit} onChange={e => setUnit(e.target.value)}>
          {sortedDists.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
      <div className="flex gap-2">
        <input className="field flex-1" aria-label="Your question" value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') askModel() }} placeholder={`Ask about ${name}'s fire season...`} />
        <button className="btn btn-primary bg-orbit text-surface hover:bg-orbit-soft transition-colors" onClick={askModel} disabled={loading || !q.trim()}>Ask</button>
      </div>
      {loading && <div className="text-sm text-muted flex items-center gap-2"><Icon name="spinner" className="h-4 w-4 animate-spin" />Thinking...</div>}
      {err && <StatusMessage kind="error">{err}</StatusMessage>}
    </div>
  )
}

/** Live answers from the hosted agent (plans/005): the project's own tools and numeric guard, run server-side. */
function HostedChat({ onAnswer }: { onAnswer: (a: SavedAnswer) => void }) {
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const send = async () => {
    if (loading || !q.trim()) return
    setLoading(true)
    setErr(null)
    try {
      const res = await askLive(q.trim())
      if (res?.ok) {
        onAnswer({ id: newId(), asked_at: new Date().toISOString(), via: 'hosted', question: q.trim(), answer: res.answer, blocked: res.blocked,
          reason: res.reason, unsupported: res.unsupported, tools: res.tools })
        setQ('')
      } else if (res) setErr(res.message)
    } catch { setErr('Could not reach the ask service. Try again, or use your own Gemini key in Settings.') }
    finally { setLoading(false) }
  }
  return (
    <div className="panel space-y-4">
      <div className="flex gap-2">
        <input className="field flex-1" aria-label="Your question" maxLength={500} value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send() }} placeholder="Ask about a district's fire or kiln season..." />
        <button className="btn btn-primary bg-orbit text-surface hover:bg-orbit-soft transition-colors" onClick={send} disabled={loading || !q.trim()}>Ask</button>
      </div>
      {loading && <div className="text-sm text-muted flex items-center gap-2"><Icon name="spinner" className="h-4 w-4 animate-spin" />Thinking...</div>}
      {err && <StatusMessage kind="error">{err}</StatusMessage>}
    </div>
  )
}

/** Ask Gemini about one district with facts from the export, check every number, and return the answer to save. */
async function askAboutDistrict(apiKey: string, q: string, unitId: string, name: string, nrt: NrtSeason, ka?: KilnActivity | null): Promise<SavedAnswer> {
  const cal = (await (await fetch(dataUrl(`calendar/${unitId}.json`))).json()) as Calendar
  const facts = districtFacts(name, unitId, cal, nrt, ka)
  const sys = buildSystemPrompt(facts)
  const text = await askGemini(fetch, apiKey, sys, q)
  const bad = unsupportedNumbers(text, sys)
  return { id: newId(), asked_at: new Date().toISOString(), via: 'your-gemini-key', question: q, answer: bad.length ? null : text,
    blocked: bad.length > 0, unsupported: bad, tools: [{ name: 'district_facts', input: { district: name }, result: factsResult(facts) }] }
}

const asked = (a: SavedAnswer) => {
  const when = new Date(a.asked_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return `Asked ${when}, answered by ${a.via === 'hosted' ? 'the Kiln Watch agent' : `${a.model ?? 'Gemini'} with your key`}`
}

export default function AskPage() {
  useTitle('Ask Kiln Watch')
  const [history, setHistory] = useState<SavedAnswer[]>(loadHistory)
  const dists = useJson<FC>('aoi/districts.geojson').data
  const nrt = useJson<NrtSeason>('nrt/current_season.json').data
  const ka = useKilnActivity().data
  const [stage, setStage] = useState<AgentResolution | null>(null)
  const [stageNote, setStageNote] = useState<{ kind: 'info' | 'error' | 'loading'; text: string } | null>(null)
  const save = (a: SavedAnswer) => setHistory((h) => { const next = withAnswer(h, a); saveHistory(next); return next })
  const clear = () => { saveHistory([]); setHistory([]) }

  const [apiKey, setApiKey] = useState(() => {
    // Never from a build-time env var: anything baked into the build is public on the static site.
    try { return localStorage.getItem('kw-gemini-key') ?? '' } catch { return '' }
  })
  useEffect(() => { try { localStorage.setItem('kw-gemini-key', apiKey) } catch { /* ignore */ } }, [apiKey])

  // A question asked on the stage: the stage animates its illustrative example; a checked live answer comes only from
  // real export data, so only for a Bangladesh district (matched by the place's coordinates) and only with a key.
  const onStageQuery = async (res: AgentResolution, q: string) => {
    setStage(res)
    const [lon, lat] = res.coordinates
    const unit = res.country === 'Bangladesh' && dists ? unitAt(dists, lat, lon) : undefined
    if (!unit) return setStageNote({ kind: 'info', text: `Kiln Watch has measured data only for Bangladesh districts, so there is no checked answer for ${res.locationName}. The stage above is an illustrative example.` })
    if (!apiKey) return setStageNote({ kind: 'info', text: `Add your Gemini key in Settings to get a checked answer about ${unit.name_en} from our data.` })
    if (!nrt) return setStageNote({ kind: 'info', text: 'The live season data are still loading; try again in a moment.' })
    setStageNote({ kind: 'loading', text: `Asking Gemini about ${unit.name_en}, with facts from our data...` })
    try {
      save(await askAboutDistrict(apiKey, q.trim(), unit.unit_id, unit.name_en, nrt, ka))
      setStageNote(null)
    } catch (e) {
      setStageNote({ kind: 'error', text: `Could not get an answer: ${(e as Error).message}` })
    }
  }

  return (
    <div className="space-y-8">
      <PageHead title="Ask Kiln Watch">
        Questions answered in plain words by a live AI model. The AI never works out a number: our own tested code does,
        and an answer that states any number our code did not return is blocked. Select any highlighted figure, or open “Where each figure comes from”, to see the call that returned it.
      </PageHead>

      <AgentCinematicStage onQueryChange={(res, q) => { void onStageQuery(res, q) }} />
      {stageNote && <StatusMessage kind={stageNote.kind}>{stageNote.text}</StatusMessage>}
      {stage && (
        <details className="panel text-sm">
          <summary className="cursor-pointer text-orbit">About the example above: {stage.locationName}</summary>
          <div className="mt-3 space-y-3">
            <IllustrativeNote />
            <p className="prose-measure leading-relaxed text-muted">{stage.detailsText}</p>
            <AgentNewsCanvas res={stage} />
          </div>
        </details>
      )}

      <ApiKeyInput apiKey={apiKey} setApiKey={setApiKey} />

      {apiKey ? <><h2 className="h-display text-xl">Or pick a district and ask</h2><LiveChat apiKey={apiKey} onAnswer={save} /></>
        : ASK_ENDPOINT ? <HostedChat onAnswer={save} />
          : <StatusMessage kind="info">Add your Gemini API key in Settings above to ask a question. Your questions and their answers are saved below, in this browser only.</StatusMessage>}

      <section aria-labelledby="saved-head" className="space-y-4">
        <div className="section-head">
          <h2 id="saved-head" className="h-display text-2xl">Your saved answers</h2>
          {history.length > 0 && <button type="button" className="btn btn-quiet ml-auto text-sm" onClick={clear}>Clear saved answers</button>}
        </div>
        {history.length === 0
          ? <p className="text-sm text-muted">Nothing saved yet. Each question you ask is kept here with its answer, in this browser only.</p>
          : <>
            <p className="text-sm text-muted">{history.length} {history.length === 1 ? 'answer' : 'answers'}, newest first: {history.filter((x) => !x.blocked).length} shown, {history.filter((x) => x.blocked).length} held back by the number check. Kept in this browser only.</p>
            <ul className="space-y-4">{history.map((a) => <li key={a.id}><AnswerCard a={a} meta={asked(a)} /></li>)}</ul>
          </>}
      </section>
    </div>
  )
}
