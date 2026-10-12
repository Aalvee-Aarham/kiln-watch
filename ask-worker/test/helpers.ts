import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const ORIGIN = 'https://data.test'
const FIXTURES = fileURLToPath(new URL('../../web/fixtures/', import.meta.url))
const NOV_DAYS = 123 // same transformation as make_goldens.py nokiln_nov(): live series to 31 October, no fire

/** A fetch that serves one committed fixture export (or the derived nokiln_nov) from disk; 404 for missing files. */
export function fixtureFetch(dataset: 'full' | 'nokiln' | 'nokiln_nov'): typeof fetch {
  const dir = `${FIXTURES}${dataset === 'nokiln_nov' ? 'nokiln' : dataset}/data/`
  return (async (input: RequestInfo | URL) => {
    const rel = String(input).slice(ORIGIN.length + 1)
    const path = dir + rel
    if (!existsSync(path)) return new Response('not found', { status: 404 })
    let body = readFileSync(path, 'utf-8')
    if (dataset === 'nokiln_nov' && rel === 'nrt/current_season.json') {
      const nrt = JSON.parse(body)
      for (const v of Object.values(nrt.districts) as { h: number[] }[]) v.h = new Array(NOV_DAYS).fill(0)
      body = JSON.stringify(nrt)
    }
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
}

/** In-memory KV with the two methods the worker uses. */
export function fakeKV() {
  const store = new Map<string, string>()
  return {
    store,
    kv: { get: async (k: string) => store.get(k) ?? null, put: async (k: string, v: string) => { store.set(k, v) } } as unknown as KVNamespace,
  }
}

type Block = string | ['tool', string, Record<string, unknown>]
/** Scripted model, like tests/test_ask.py _client: each turn is a list of blocks, or [blocks, stop_reason]. */
export function scriptedClient(...turns: (Block[] | [Block[], string])[]) {
  const seen: Record<string, unknown>[] = []
  const create = async (params: Record<string, unknown>) => {
    seen.push(params)
    const turn = turns[Math.min(seen.length - 1, turns.length - 1)]
    const [blocks, stop] = turn.length === 2 && typeof turn[1] === 'string' && Array.isArray(turn[0]) ? (turn as [Block[], string]) : [turn as Block[], null]
    const content = blocks.map((b, i) => (typeof b === 'string' ? { type: 'text', text: b } : { type: 'tool_use', id: `t${i}`, name: b[1], input: b[2] }))
    return { content, stop_reason: stop ?? (content.some((c) => c.type === 'tool_use') ? 'tool_use' : 'end_turn') }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: { beta: { messages: { create } } } as any, seen }
}
