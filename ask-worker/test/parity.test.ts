// Every TypeScript tool returns exactly what the Python tool returned for the same input (goldens from make_goldens.py).
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Data, FUNCS, runTool } from '../src/tools'
import { ORIGIN, fixtureFetch } from './helpers'

const GOLDEN = fileURLToPath(new URL('./golden/', import.meta.url))
const files = readdirSync(GOLDEN).filter((f) => f.endsWith('.json'))

describe('parity with the Python tools', () => {
  it('covers every tool the worker registers', () => {
    expect(files.map((f) => f.replace('.json', '')).sort()).toEqual(Object.keys(FUNCS).sort())
  })
  for (const f of files) {
    const cases = JSON.parse(readFileSync(GOLDEN + f, 'utf-8')) as { data: 'full' | 'nokiln' | 'nokiln_nov'; input: Record<string, unknown>; output: unknown }[]
    for (const c of cases) {
      it(`${f.replace('.json', '')} ${c.data} ${JSON.stringify(c.input)}`, async () => {
        const out = await runTool(f.replace('.json', ''), new Data(ORIGIN, fixtureFetch(c.data)), c.input)
        expect(JSON.parse(JSON.stringify(out))).toEqual(c.output)
      })
    }
  }
})
