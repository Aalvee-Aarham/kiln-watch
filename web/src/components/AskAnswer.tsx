// One Ask Kiln Watch answer, saved or live: the question, whether every number was traced, the answer with each figure
// linked to the call that returned it, and the calls themselves as labelled rows (raw JSON one click further).
import { useRef, useState } from 'react'
import { Icon } from './ui'
import { areaNames, resultFields, toolTitle, traceAnswer, type ToolCall } from '../lib/askTrace'

export type Answer = { question: string; answer: string | null; blocked: boolean; reason?: string; unsupported?: number[]; tools: ToolCall[]; lang?: string }

function Status({ a }: { a: Answer }) {
  const [ok, text] = !a.blocked ? [true, a.tools.length ? 'Every number in this answer comes from our data.' : 'Answered without stating any number.']
    : a.unsupported?.length ? [false, `Not shown: the model stated ${a.unsupported.join(', ')}, which our functions did not return.`]
      : a.reason === 'refusal' ? [false, 'The model declined to answer this question.']
        : a.reason?.startsWith('step limit') ? [false, 'Stopped after 6 steps without a checked answer.']
          : [false, 'The model gave no answer.']
  return (
    <p className="flex items-start gap-1.5 text-sm" lang="en">
      <span className={ok ? 'text-ok' : 'text-err'}><Icon name={ok ? 'check' : 'cross'} className="mt-0.5 h-4 w-4" /></span>
      <span>{text}</span>
    </p>
  )
}

export function AnswerCard({ a, meta }: { a: Answer; meta?: string }) {
  const [sel, setSel] = useState<string | null>(null) // "call:path" of the figure being traced
  const [open, setOpen] = useState(false)
  const rows = useRef(new Map<string, HTMLElement>())
  const names = areaNames(a.tools)
  const fields = a.tools.map((t) => resultFields(t.result))

  const trace = (key: string) => {
    setSel(key)
    setOpen(true)
    requestAnimationFrame(() => rows.current.get(key)?.scrollIntoView({
      block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }))
  }

  return (
    <article className="panel space-y-3" lang={a.lang}>
      <h3 className="h-display text-[1.35rem] leading-snug">“{a.question}”</h3>
      {meta && <p className="text-xs text-muted" lang="en">{meta}</p>}
      <Status a={a} />
      {a.answer && (
        <p className="ours prose-measure leading-relaxed">
          {traceAnswer(a.answer, a.tools).map((s, i) => 'value' in s ? (
            <button key={i} type="button" className="trace-num" data-on={sel === `${s.call}:${s.path}` || undefined} onClick={() => trace(`${s.call}:${s.path}`)}
              aria-label={`${s.text}, from ${toolTitle(a.tools[s.call].name)}: show where`}>{s.text}</button>
          ) : <span key={i}>{s.text}</span>)}
        </p>
      )}
      {a.tools.length > 0 && (
        <details className="text-sm" lang="en" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
          <summary className="cursor-pointer text-orbit">Where each figure comes from {a.tools.every((t) => t.name === 'district_facts')
            ? '(the district facts our page computed and gave the model)'
            : `(${a.tools.length} ${a.tools.length === 1 ? 'call' : 'calls'} to our code, in order)`}</summary>
          <ol className="mt-3 space-y-4">
            {a.tools.map((t, ci) => {
              const area = typeof t.input.unit_id === 'string' ? names[t.input.unit_id] ?? t.input.unit_id : undefined
              const prov = t.result.provenance as { dataset_id?: string; source_url?: string; data_build?: string } | undefined
              const matches = t.result.matches as { unit_id: string; name_en: string; level?: string; division?: string }[] | undefined
              return (
                <li key={ci} className="trace-call">
                  <p className="font-semibold text-ink">{ci + 1}. {toolTitle(t.name)}
                    <span className="font-normal text-muted">{area ? ` for ${area}` : t.name === 'find_area' ? ` for “${String(t.input.name ?? '')}”` : ''}</span></p>
                  {'error' in t.result ? <p className="mt-1 text-err">{String(t.result.error)}</p> : (
                    <dl className="trace-rows mt-1.5">
                      {matches?.map((m) => <div key={m.unit_id} className="trace-row"><dt>{m.name_en}</dt><dd className="num">{[m.level, m.division].filter(Boolean).join(', ')} ({m.unit_id})</dd></div>)}
                      {matches?.length === 0 && <div className="trace-row"><dt>Matches</dt><dd>none</dd></div>}
                      {fields[ci].map((f) => {
                        const key = `${ci}:${f.path}`
                        return (
                          <div key={f.path} ref={(el) => { if (el) rows.current.set(key, el); else rows.current.delete(key) }} className="trace-row" data-on={sel === key || undefined}>
                            <dt>{f.label}</dt><dd className="num">{names[f.display] ? `${names[f.display]} (${f.display})` : f.display}</dd>
                          </div>
                        )
                      })}
                    </dl>
                  )}
                  {prov?.source_url && (
                    <p className="mt-1.5 text-xs text-muted">Source: <a className="underline decoration-dotted underline-offset-2 hover:text-ink" href={prov.source_url}>{prov.dataset_id ?? prov.source_url}</a>
                      {prov.data_build && <>, data build <span className="code">{prov.data_build}</span></>}</p>
                  )}
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-muted">Raw result</summary>
                    <pre className="mt-1 max-h-64 overflow-auto rounded-[6px] bg-surface-2 p-2 text-xs">{JSON.stringify(t.result, null, 1)}</pre>
                  </details>
                </li>
              )
            })}
          </ol>
        </details>
      )}
    </article>
  )
}
