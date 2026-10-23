import { useState, useEffect, useMemo } from 'react'
import { StatusMessage, useTitle, Icon, useKilnActivity, useMeta } from '../components/ui'
import { PageHead } from '../components/plain'
import { AnswerCard } from '../components/AskAnswer'
import { AgentCinematicStage } from '../components/agent/AgentCinematicStage'
import { AgentNewsCanvas } from '../components/AgentNewsCanvas'
import { buildResolution, EMPTY_STAGE_DATA, REGION_REGISTRY, resolveQuery, stageCells } from '../lib/agentEngine'
import { tilesForBox } from '../lib/box'
import { dayIso, seasonStart } from '../lib/days'
import { bboxOf } from '../lib/geo'
import { loadHistory, newId, saveHistory, withAnswer, type SavedAnswer } from '../lib/askHistory'
import { dataUrl, fetchJson, useJson } from '../lib/data'
import { ASK_ENDPOINT, askLive } from '../lib/askApi'
import { askGemini, buildSystemPrompt, districtFacts, factsResult, unsupportedNumbers } from '../lib/geminiPrompt'
import type { Calendar, Events, FC, GridTile, Harmonization, KilnActivity, NrtSeason } from '../lib/types'

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

/** Most map dots drawn on the stage (invariant 9: explicit maxima). */
const MAX_STAGE_CELLS = 3000

/** The Ask stage's data: everything it shows is read here from the public export and passed down. */
function useStage(question: string) {
  const dists = useJson<FC>('aoi/districts.geojson').data
  const nrtFile = useJson<NrtSeason>('nrt/current_season.json')
  const nrt = nrtFile.data
  const ka = useKilnActivity().data
  const meta = useMeta().data
  const events = useJson<Events>('events.json').data
  const harm = useJson<Harmonization>('harmonization.json').data
  const r = useMemo(() => (question ? resolveQuery(question) : null), [question])
  const unit = r?.profile?.unit.kind === 'bd' ? r.profile.unit : null
  const calFile = useJson<Calendar>(unit ? `calendar/${unit.unit_id}.json` : null)
  const cal = calFile.data
  const calFailed = calFile.error && unit ? `calendar/${unit.unit_id}.json` : '', nrtFailed = nrtFile.error ? 'nrt/current_season.json' : ''
  const feature = useMemo(() => dists?.features.find((f) => f.properties.unit_id === unit?.unit_id), [dists, unit])
  const [tiles, setTiles] = useState<{ id: string; tiles: GridTile[] } | null>(null)
  useEffect(() => {
    if (!feature) return
    let live = true
    const id = feature.properties.unit_id
    Promise.all(tilesForBox(bboxOf(feature.geometry)).map((t) => fetchJson<GridTile>(`grid/${t}.json`).catch(() => null)))
      .then((x) => { if (live) setTiles({ id, tiles: x.filter(Boolean) as GridTile[] }) })
    return () => { live = false }
  }, [feature])
  const res = useMemo(() => {
    if (!r) return null
    const also = r.profile?.alsoUnits ?? []
    return buildResolution(r, { ...EMPTY_STAGE_DATA, unitId: unit?.unit_id ?? null, unitName: feature?.properties.name_en ?? null,
      division: feature?.properties.division ?? null, cal: cal?.unit_id === unit?.unit_id ? cal ?? null : null, nrt: nrt ?? null, ka: ka ?? null,
      events: events ?? null, meta: meta ?? null, harm: harm ?? null, failed: [calFailed, nrtFailed].filter(Boolean),
      alsoNames: also.map((id) => dists?.features.find((f) => f.properties.unit_id === id)?.properties.name_en ?? id) })
  }, [r, unit, feature, cal, nrt, ka, events, meta, harm, dists, calFailed, nrtFailed])
  const dots = useMemo(() => (feature && meta && nrt && tiles?.id === feature.properties.unit_id
    ? stageCells(tiles.tiles, meta, feature.geometry, seasonStart(nrt.season), MAX_STAGE_CELLS) : null), [feature, meta, nrt, tiles])
  const caption = !r?.profile ? undefined
    : r.profile.unit.kind === 'ne' ? 'Fire dots: Bangladesh only until the South Asia calendar (Amendment 5) is agreed.'
      : dots ? `Fire detections in ${feature?.properties.name_en} since ${nrt?.day0}, to ${dayIso(dots.lastDay)} (latest grid day): ${dots.total.toLocaleString('en-US')} grid ${dots.total === 1 ? 'cell' : 'cells'} (1 km)${dots.total > dots.cells.length ? `, first ${dots.cells.length.toLocaleString('en-US')} shown` : ''}. Aqua MODIS and Suomi NPP, every fire, not only kilns. From grid/ tiles.`
        : 'Loading fire detections…'
  const bdCount = Object.values(REGION_REGISTRY).filter((p) => p.unit.kind === 'bd').length
  const others = Object.values(REGION_REGISTRY).filter((p) => p.unit.kind === 'ne')
  const coverage = `Measured: all ${dists?.features.length ?? bdCount} districts of Bangladesh. Named on the map: ${others.length} more places in ${new Set(others.map((p) => p.country)).size} countries, measured after the South Asia calendar (Amendment 5).`
  return { res, cells: dots?.cells ?? [], caption, coverage, dists, nrt, ka }
}

export default function AskPage() {
  useTitle('Ask Kiln Watch')
  const [history, setHistory] = useState<SavedAnswer[]>(loadHistory)
  const [question, setQuestion] = useState('')
  const { res: stage, cells, caption, coverage, dists, nrt, ka } = useStage(question)
  const [stageNote, setStageNote] = useState<{ kind: 'info' | 'error' | 'loading'; text: string } | null>(null)
  const save = (a: SavedAnswer) => setHistory((h) => { const next = withAnswer(h, a); saveHistory(next); return next })
  const clear = () => { saveHistory([]); setHistory([]) }

  const [apiKey, setApiKey] = useState(() => {
    // Never from a build-time env var: anything baked into the build is public on the static site.
    try { return localStorage.getItem('kw-gemini-key') ?? '' } catch { return '' }
  })
  useEffect(() => { try { localStorage.setItem('kw-gemini-key', apiKey) } catch { /* ignore */ } }, [apiKey])

  // A question asked on the stage: the stage shows the place's real data; a checked live answer comes only from
  // real export data, so only for a Bangladesh district (from the registry's unit id) and only with a key.
  const onStageQuery = async (q: string) => {
    setQuestion(q)
    const r = resolveQuery(q)
    const id = r.profile?.unit.kind === 'bd' ? r.profile.unit.unit_id : null
    const unit = id ? dists?.features.find((f) => f.properties.unit_id === id)?.properties : undefined
    const name = r.profile?.name ?? r.placeText
    if (!unit) return setStageNote({ kind: 'info', text: `Kiln Watch has measured data only for Bangladesh districts so far, so there is no checked answer for ${name || 'this question'}. The South Asia calendar (Amendment 5) will add places outside Bangladesh.` })
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

      <AgentCinematicStage res={stage} cells={cells} caption={caption} coverage={coverage} onAsk={(q) => { void onStageQuery(q) }} />
      {stageNote && <StatusMessage kind={stageNote.kind}>{stageNote.text}</StatusMessage>}
      {stage && (
        <details className="panel text-sm">
          <summary className="cursor-pointer text-orbit">About the stage above: {stage.locationName}</summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted">{stage.sources}</p>
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
