import { describe, expect, it } from 'vitest'
import { DAILY_LIMIT_MESSAGE, type Env, handle } from '../src/index'
import { ORIGIN, fakeKV, fixtureFetch, scriptedClient } from './helpers'

const SITE = 'https://aalvee-aarham.github.io'
function setup(over: Partial<Env> = {}) {
  const { kv, store } = fakeKV()
  const env: Env = { ANTHROPIC_API_KEY: 'test-key', DATA_ORIGIN: ORIGIN, ALLOWED_ORIGIN: SITE, DAILY_CAP: '200', SPEND: kv, ...over }
  const { client, seen } = scriptedClient(['No numbers here.'])
  const deps = { makeClient: () => client, fetchFn: fixtureFetch('full'), now: () => Date.UTC(2026, 10, 10, 12) }
  return { env, deps, seen, store }
}
const post = (body: unknown, origin: string | null = SITE) => new Request('https://w.test/ask', {
  method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
  headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}), 'CF-Connecting-IP': '203.0.113.7' },
})

describe('POST /ask', () => {
  it('answers from the site origin, with CORS for that origin only', async () => {
    const { env, deps } = setup()
    const r = await handle(post({ question: 'When does Dhaka burn?' }), env, deps)
    expect(r.status).toBe(200)
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(SITE)
    expect(await r.json()).toMatchObject({ blocked: false, answer: 'No numbers here.' })
  })
  it('refuses any other origin', async () => {
    const { env, deps, seen } = setup()
    expect((await handle(post({ question: 'q' }, 'https://evil.test'), env, deps)).status).toBe(403)
    expect(seen).toHaveLength(0)
  })
  it('answers the preflight', async () => {
    const { env, deps } = setup()
    const r = await handle(new Request('https://w.test/ask', { method: 'OPTIONS', headers: { Origin: SITE } }), env, deps)
    expect(r.status).toBe(204)
    expect(r.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })
  it('rejects a question over 500 characters, an empty one and a non-string', async () => {
    const { env, deps, seen } = setup()
    for (const q of ['x'.repeat(501), '   ', 42]) expect((await handle(post({ question: q }), env, deps)).status).toBe(400)
    expect((await handle(post('not json'), env, deps)).status).toBe(400)
    expect(seen).toHaveLength(0)
  })
  it('stops at the daily cap without calling the model', async () => {
    const { env, deps, seen, store } = setup({ DAILY_CAP: '2' })
    store.set('day:2026-11-10', '2')
    const r = await handle(post({ question: 'q' }), env, deps)
    expect(r.status).toBe(429)
    expect(await r.json()).toEqual({ error: DAILY_LIMIT_MESSAGE })
    expect(seen).toHaveLength(0)
  })
  it('limits one address to 30 questions an hour', async () => {
    const { env, deps, seen, store } = setup()
    store.set('ip:203.0.113.7:2026-11-10T12', '30')
    expect((await handle(post({ question: 'q' }), env, deps)).status).toBe(429)
    expect(seen).toHaveLength(0)
  })
  it('fails closed when the daily cap is missing or not a number', async () => {
    for (const bad of [undefined, '', 'abc', '0', '2.5']) {
      const { env, deps, seen } = setup({ DAILY_CAP: bad as unknown as string })
      expect((await handle(post({ question: 'q' }), env, deps)).status).toBe(503)
      expect(seen).toHaveLength(0)
    }
  })
  it('says the backend is unavailable without a key, and hides model errors', async () => {
    const { env, deps } = setup({ ANTHROPIC_API_KEY: undefined })
    const r = await handle(post({ question: 'q' }), env, deps)
    expect(r.status).toBe(503)
    expect(await r.json()).toEqual({ error: 'ask backend unavailable' })
    const s2 = setup()
    const failing = { ...s2.deps, makeClient: () => ({ beta: { messages: { create: async () => { throw Object.assign(new Error('secret detail'), { status: 401 }) } } } }) }
    const r2 = await handle(post({ question: 'q' }), s2.env, failing)
    expect(r2.status).toBe(503)
    expect(await r2.text()).not.toContain('secret detail')
  })
})
