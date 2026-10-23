import { describe, expect, it } from 'vitest'
import spec from '../src/spec.json'
import { ask, buildRequest, geminiClient } from '../src/agent'
import { Data, harmonizationEvidence } from '../src/tools'
import { ORIGIN, fixtureFetch, scriptedClient } from './helpers'

const data = () => new Data(ORIGIN, fixtureFetch('full'))

describe('agent loop', () => {
  it('calls project functions and passes an answer that states only returned numbers', async () => {
    const pct = (await harmonizationEvidence(data())).share_of_2012_jump_removed_pct
    const { client, seen } = scriptedClient([['tool', 'harmonization_evidence', {}]], [`The correction removed ${pct}% of the 2012 jump.`])
    const out = await ask('Did the correction work?', client, data())
    expect(out.blocked).toBe(false)
    expect(out.answer).toBe(`The correction removed ${pct}% of the 2012 jump.`)
    expect(out.tools[0].name).toBe('harmonization_evidence')
    expect(seen[0]).toMatchObject({ systemInstruction: { parts: [{ text: spec.system }] }, toolConfig: { functionCallingConfig: { mode: 'AUTO' } } })
    const sent = seen[1].contents as { role: string; parts: Record<string, unknown>[] }[]
    expect(sent[sent.length - 2]).toEqual({ role: 'model', parts: [{ functionCall: { id: 't0', name: 'harmonization_evidence', args: {} } }] }) // whole turn echoed
    expect(sent[sent.length - 1].parts[0]).toEqual({ functionResponse: { id: 't0', name: 'harmonization_evidence', response: out.tools[0].result } })
  })
  it('blocks an invented number', async () => {
    const { client } = scriptedClient([['tool', 'find_area', { name: 'Dhaka' }]], ['Dhaka burns 12345 times a year.'])
    const out = await ask('How much does Dhaka burn?', client, data())
    expect(out).toMatchObject({ blocked: true, answer: null, unsupported: [12345] })
  })
  it('reports a refusal instead of filling it in', async () => {
    const { client } = scriptedClient([[], 'refusal'])
    expect(await ask('anything', client, data())).toMatchObject({ blocked: true, reason: 'refusal', answer: null, tools: [] })
  })
  it('stops after 6 model calls', async () => {
    const { client, seen } = scriptedClient([['tool', 'find_area', { name: 'Dhaka' }]])
    const out = await ask('loop', client, data())
    expect(out).toMatchObject({ blocked: true, reason: 'step limit 6' })
    expect(seen).toHaveLength(6)
  })
  it('treats inherited object names as unknown tools, not as functions', async () => {
    const { runTool } = await import('../src/tools')
    for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(await runTool(name, data(), {})).toEqual({ error: `unknown tool ${name}` })
    }
  })
  it('reports an unknown tool to the model as an error', async () => {
    const { client, seen } = scriptedClient([['tool', 'delete_everything', {}]], ['Done.'])
    const out = await ask('Clean up', client, data())
    expect(out.tools[0].result).toEqual({ error: 'unknown tool delete_everything' })
    const sent = seen[1].contents as { parts: { functionResponse?: { response: unknown } }[] }[]
    expect(sent[sent.length - 1].parts[0].functionResponse?.response).toEqual({ error: 'unknown tool delete_everything' })
  })
  it('builds exactly the request body the Python agent sends', () => {
    expect(buildRequest(spec.sample_request.contents)).toEqual(spec.sample_request.body)
  })
  it('sends the key in a header to the configured model and hides it from errors', async () => {
    const urls: string[] = [], headers: Record<string, string>[] = []
    const fake = (async (url: string, init: RequestInit) => {
      urls.push(url); headers.push(init.headers as Record<string, string>)
      return new Response('{"error":{"message":"bad key k-123"}}', { status: 403 })
    }) as unknown as typeof fetch
    await expect(geminiClient('k-123', 'gemini-3.5-flash-lite', fake)({})).rejects.toThrow('Gemini HTTP 403')
    expect(urls[0]).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent')
    expect(urls[0]).not.toContain('k-123')
    expect(headers[0]['x-goog-api-key']).toBe('k-123')
  })
  it('treats a safety block on the prompt as a refusal', async () => {
    const out = await ask('q', async () => ({ promptFeedback: { blockReason: 'SAFETY' } }), data())
    expect(out).toMatchObject({ blocked: true, reason: 'refusal' })
  })
})
