import { expect, it } from 'vitest'
import { handle } from '../src/index'
import { fakeKV } from './helpers'

it('rejects an empty body with 400', async () => {
  const env = { DATA_ORIGIN: 'https://data.test', ALLOWED_ORIGIN: 'https://aalvee-aarham.github.io', DAILY_CAP: '200', SPEND: fakeKV().kv }
  const r = await handle(new Request('https://w.test/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' } }), env)
  expect(r.status).toBe(400)
})
