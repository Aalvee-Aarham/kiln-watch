import { describe, expect, it } from 'vitest'
import { ask } from '../src/agent'
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
    expect(seen[0]).toMatchObject({ model: 'claude-opus-5-5', betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', output_config: { effort: 'low' } })
    expect(seen[0]).not.toHaveProperty('tool_choice') // forced tool choice is a 400 on Claude Opus 5.5
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
  it('reports an unknown tool to the model as an error', async () => {
    const { client, seen } = scriptedClient([['tool', 'delete_everything', {}]], ['Done.'])
    const out = await ask('Clean up', client, data())
    expect(out.tools[0].result).toEqual({ error: 'unknown tool delete_everything' })
    const msgs = seen[1].messages as { role: string; content: { is_error?: boolean }[] }[]
    expect(msgs[msgs.length - 1].content[0].is_error).toBe(true)
  })
})
