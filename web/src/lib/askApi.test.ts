import { describe, expect, it } from 'vitest'
import { askLive } from './askApi'

const reply = (status: number, body: unknown) => {
  const calls: string[] = []
  const fn = (async (url: string) => { calls.push(url); return new Response(JSON.stringify(body), { status }) }) as unknown as typeof fetch
  return { fn, calls }
}

describe('askLive', () => {
  it('is off without an endpoint and never fetches', async () => {
    const { fn, calls } = reply(200, {})
    await expect(askLive('q', '', fn)).resolves.toBeNull()
    expect(calls).toHaveLength(0)
  })
  it('surfaces a blocked answer and its unsupported numbers', async () => {
    const { fn, calls } = reply(200, { question: 'q', answer: null, blocked: true, unsupported: [42], tools: [] })
    await expect(askLive('q', 'https://ask.test/ask', fn)).resolves.toEqual({ ok: true, question: 'q', answer: null, blocked: true, unsupported: [42], tools: [] })
    expect(calls).toEqual(['https://ask.test/ask'])
  })
  it('treats a 200 that is not an answer as an error, never as an answer', async () => {
    const { fn } = reply(200, { hello: 'proxy page' })
    await expect(askLive('q', 'https://ask.test/ask', fn)).resolves.toEqual({ ok: false, status: 200, message: 'The ask service sent an unexpected reply.' })
  })
  it('turns the daily limit into a message for the page', async () => {
    const msg = 'daily limit reached; the saved answers below still work'
    const { fn } = reply(429, { error: msg })
    await expect(askLive('q', 'https://ask.test/ask', fn)).resolves.toEqual({ ok: false, status: 429, message: msg })
  })
})
