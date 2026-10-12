import type { AskCache } from './types'

/** The hosted agent's POST /ask URL (plans/005). A public URL, never a key; unset or empty = the feature is off. */
export const ASK_ENDPOINT: string = import.meta.env.VITE_ASK_ENDPOINT ?? ''

export type AskAnswer = AskCache['answers'][number]
export type LiveReply = ({ ok: true } & Omit<AskAnswer, 'lang'>) | { ok: false; status: number; message: string }

/** Ask the hosted agent. null when no endpoint is configured; a failed request comes back as {ok: false, message}. */
export async function askLive(question: string, endpoint = ASK_ENDPOINT, fetchFn: typeof fetch = fetch): Promise<LiveReply | null> {
  if (!endpoint) return null
  const r = await fetchFn(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) return { ok: false, status: r.status, message: typeof body.error === 'string' ? body.error : `The ask service answered ${r.status}.` }
  return { ok: true, ...body }
}
