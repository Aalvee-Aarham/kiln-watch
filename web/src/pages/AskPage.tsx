import { StatusMessage, useTitle } from '../components/ui'
import { PageHead } from '../components/plain'
import { useJson } from '../lib/data'
import type { AskCache } from '../lib/types'

/** Ask Kiln Watch: answers written by Claude from the project's own functions, cached for offline use (kilnwatch/ask.py). */
export default function AskPage() {
  useTitle('Ask Kiln Watch')
  const ask = useJson<AskCache>('ask.json') // optional file: written by `python -m kilnwatch ask --build-cache`
  return (
    <div className="space-y-8">
      <PageHead title="Ask Kiln Watch">
        Questions answered in plain words by Claude, an AI model from Anthropic. For each question it chooses which of our five functions to call, in up to six steps.
        The AI never works out a number: our own tested code does, and an answer that states any number our code did not return is blocked. Open “The data behind this answer” to check every figure.
      </PageHead>
      {ask.loading ? null : !ask.data ? <StatusMessage kind="info">No answers have been generated for this data build yet.
        The team creates them with <span className="code">python -m kilnwatch ask --build-cache</span>, and they are then stored here so this page works offline.</StatusMessage>
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
    </div>
  )
}
