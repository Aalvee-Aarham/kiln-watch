// POST /ask for the Kiln Watch site: CORS-locked, size-checked, rate-limited and spend-capped. The site never depends
// on this worker: without it, the Ask page keeps its saved answers and the bring-your-own-key chat.
import { ask, type Client, geminiClient } from './agent'
import { Data } from './tools'

export interface Env {
  GEMINI_API_KEY?: string
  DATA_ORIGIN: string
  ALLOWED_ORIGIN: string
  DAILY_CAP: string
  MODEL?: string
  SPEND: KVNamespace
}
export type Deps = { makeClient: (apiKey: string, model?: string) => Client; fetchFn: typeof fetch; now: () => number }
const DEFAULT_DEPS: Deps = { makeClient: (apiKey, model) => geminiClient(apiKey, model), fetchFn: (...a) => fetch(...a), now: () => Date.now() }
const MAX_QUESTION = 500
const PER_IP_HOURLY = 30
export const DAILY_LIMIT_MESSAGE = 'daily limit reached; the saved answers below still work'

function reply(env: Env, status: number, body: unknown, cors: boolean): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' }
  if (cors) Object.assign(headers, { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN, Vary: 'Origin' })
  return new Response(body === null ? null : JSON.stringify(body), { status, headers })
}

/** Increment a KV counter unless it already reached `max`; false = over the limit. Approximate (KV is eventually consistent). */
async function take(kv: KVNamespace, key: string, max: number, ttlSeconds: number): Promise<boolean> {
  const n = Number((await kv.get(key)) ?? 0)
  if (n >= max) return false
  await kv.put(key, String(n + 1), { expirationTtl: ttlSeconds })
  return true
}

export async function handle(req: Request, env: Env, deps: Deps = DEFAULT_DEPS): Promise<Response> {
  const origin = req.headers.get('Origin')
  if (origin !== null && origin !== env.ALLOWED_ORIGIN) return reply(env, 403, { error: 'origin not allowed' }, false)
  const cors = origin !== null
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } })
  }
  if (new URL(req.url).pathname !== '/ask') return reply(env, 404, { error: 'not found' }, cors)
  if (req.method !== 'POST') return reply(env, 405, { error: 'POST only' }, cors)
  if (!(req.headers.get('Content-Type') ?? '').includes('application/json')) return reply(env, 400, { error: 'send JSON: {"question": "..."}' }, cors)
  let question: unknown
  try { question = ((await req.json()) as { question?: unknown }).question } catch { return reply(env, 400, { error: 'body is not JSON' }, cors) }
  if (typeof question !== 'string' || !question.trim() || question.length > MAX_QUESTION) {
    return reply(env, 400, { error: `question must be text of 1 to ${MAX_QUESTION} characters` }, cors)
  }
  const cap = Number(env.DAILY_CAP)
  // fail closed: a missing or malformed cap must never mean "no cap" on the project's key
  if (!env.GEMINI_API_KEY || !Number.isInteger(cap) || cap < 1) return reply(env, 503, { error: 'ask backend unavailable' }, cors)
  const now = new Date(deps.now())
  const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (!(await take(env.SPEND, `ip:${ip}:${now.toISOString().slice(0, 13)}`, PER_IP_HOURLY, 7200))) {
    return reply(env, 429, { error: 'too many questions from this address; try again within the hour' }, cors)
  }
  if (!(await take(env.SPEND, `day:${now.toISOString().slice(0, 10)}`, cap, 172800))) {
    return reply(env, 429, { error: DAILY_LIMIT_MESSAGE }, cors)
  }
  try {
    const out = await ask(question.trim(), deps.makeClient(env.GEMINI_API_KEY, env.MODEL || undefined), new Data(env.DATA_ORIGIN, deps.fetchFn))
    console.log(`ask 200 blocked=${out.blocked} tools=${out.tools.map((t) => t.name).join(',')}`) // status and tool names only
    return reply(env, 200, out, cors)
  } catch (e) {
    console.log(`ask 503 ${(e as { status?: number }).status ?? 'error'}`) // no internal detail leaves the worker
    return reply(env, 503, { error: 'ask backend unavailable' }, cors)
  }
}

export default { fetch: (req: Request, env: Env) => handle(req, env) } satisfies ExportedHandler<Env>
