import { describe, expect, it } from 'vitest'
import { askGemini, buildGeminiRequest, extractText, GEMINI_MODELS, numbers, RETIRED_MESSAGE, unsupportedNumbers } from './geminiPrompt'

describe('unsupportedNumbers', () => {
  const ctx = 'Current Season: 2023-24. The district has had 7 unusual days.'
  it('passes numbers the context gave', () => expect(unsupportedNumbers('7 unusual days in 2023-24', ctx)).toEqual([]))
  it('blocks a digit that only appears inside a larger context number', () => expect(unsupportedNumbers('3 unusual days', ctx)).toEqual([3]))
  it('reads Bangla digits', () => expect(unsupportedNumbers('৯ দিন', ctx)).toEqual([9]))
  it('compares by value, ignoring thousands separators', () => expect([...numbers('1,221,809 and 0.5')]).toEqual([1221809, 0.5]))
})

const fake = (...replies: { status: number; body?: unknown }[]) => {
  const urls: string[] = []
  const fn = (async (url: string) => {
    urls.push(url)
    const r = replies[urls.length - 1]
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status })
  }) as unknown as typeof fetch
  return { fn, urls }
}
const answer = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] })

describe('gemini request', () => {
  it('sends the instructions as system_instruction, never inside the question', () => {
    expect(buildGeminiRequest('SYS', 'Q')).toEqual({
      system_instruction: { parts: [{ text: 'SYS' }] },
      contents: [{ role: 'user', parts: [{ text: 'Q' }] }],
      generationConfig: { maxOutputTokens: 1024 },
    })
  })
  it('falls back to the next model on a 404', async () => {
    const { fn, urls } = fake({ status: 404 }, { status: 200, body: answer('March is the peak.') })
    await expect(askGemini(fn, 'k', 'SYS', 'Q')).resolves.toBe('March is the peak.')
    expect(urls).toHaveLength(2)
    expect(urls[1]).toContain(GEMINI_MODELS[1])
  })
  it('says the models were retired when every model 404s', async () => {
    const { fn, urls } = fake(...GEMINI_MODELS.map(() => ({ status: 404 })))
    await expect(askGemini(fn, 'k', 'SYS', 'Q')).rejects.toThrow(RETIRED_MESSAGE)
    expect(urls).toHaveLength(GEMINI_MODELS.length)
  })
  it('does not retry other errors', async () => {
    const { fn, urls } = fake({ status: 403 })
    await expect(askGemini(fn, 'k', 'SYS', 'Q')).rejects.toThrow('API error: 403')
    expect(urls).toHaveLength(1)
  })
  it('reports an empty reply plainly', () => {
    expect(extractText({})).toBe('No answer returned.')
  })
})
