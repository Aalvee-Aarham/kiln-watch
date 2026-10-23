// The bounded tool-use loop of kilnwatch/ask.py ask(), on the Gemini REST API (generateContent with function calling).
// The model retrieves and explains; every number in the final answer must appear in a tool result, or it is blocked.
import spec from './spec.json'
import { unsupportedNumbers } from './guard'
import { type Data, type Result, runTool } from './tools'

type Part = { text?: string; thought?: boolean; thoughtSignature?: string; functionCall?: { id?: string; name?: string; args?: Record<string, unknown> }; functionResponse?: unknown }
type Content = { role: string; parts: Part[] }
export type GeminiReply = { candidates?: { content?: Content; finishReason?: string }[]; promptFeedback?: { blockReason?: string } }
/** Takes a generateContent request body, returns Gemini's JSON reply. geminiClient() in production; scripted in tests. */
export type Client = (body: Record<string, unknown>) => Promise<GeminiReply>
export type ToolCall = { name: string; input: Record<string, unknown>; result: Result }
export type AskResult = { question: string; answer: string | null; blocked: boolean; unsupported?: number[]; reason?: string; tools: ToolCall[] }

const REFUSALS = new Set(spec.refusals)

/** The same body as ask.py request(): instructions as systemInstruction, the model free to answer or call a tool. */
export const buildRequest = (contents: Content[]) => ({
  systemInstruction: { parts: [{ text: spec.system }] }, contents, tools: spec.tools,
  toolConfig: { functionCallingConfig: { mode: 'AUTO' } }, generationConfig: { maxOutputTokens: 4000 },
})

/** POST to Gemini with the key in a header (never the URL); failures carry the status only. */
export function geminiClient(apiKey: string, model: string = spec.model, fetchFn: typeof fetch = fetch): Client {
  return async (body) => {
    const r = await fetchFn(`${spec.gemini}/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    })
    if (!r.ok) throw Object.assign(new Error(`Gemini HTTP ${r.status}`), { status: r.status })
    return (await r.json()) as GeminiReply
  }
}

export async function ask(question: string, client: Client, data: Data): Promise<AskResult> {
  const contents: Content[] = [{ role: 'user', parts: [{ text: question }] }]
  const calls: ToolCall[] = []
  for (let step = 0; step < spec.max_steps; step++) { // hard cap on model calls per question (no unbounded loops)
    const r = await client(buildRequest(contents))
    const cand = r.candidates?.[0] ?? {}
    if (r.promptFeedback?.blockReason || REFUSALS.has(cand.finishReason ?? '')) return { question, answer: null, blocked: true, reason: 'refusal', tools: calls }
    const parts = cand.content?.parts ?? []
    const uses = parts.filter((p) => p.functionCall).map((p) => p.functionCall!)
    if (!uses.length) {
      const text = parts.filter((p) => !p.thought).map((p) => p.text ?? '').join('').trim()
      if (!text) return { question, answer: null, blocked: true, reason: `no answer (${cand.finishReason ?? null})`, tools: calls }
      const bad = unsupportedNumbers(text, calls.map((c) => JSON.stringify(c.result)).join('\n'))
      return { question, answer: bad.length ? null : text, blocked: bad.length > 0, unsupported: bad, tools: calls }
    }
    contents.push(cand.content!) // the whole model turn: Gemini 3 needs its thought signatures back
    const results: Part[] = []
    for (const u of uses) {
      const input = u.args ?? {}
      const res = await runTool(u.name ?? '', data, input)
      calls.push({ name: u.name ?? '', input, result: res })
      results.push({ functionResponse: { ...(u.id ? { id: u.id } : {}), name: u.name, response: res } })
    }
    contents.push({ role: 'user', parts: results })
  }
  return { question, answer: null, blocked: true, reason: `step limit ${spec.max_steps}`, tools: calls }
}
