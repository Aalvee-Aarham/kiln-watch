// The bounded tool-use loop of kilnwatch/ask.py ask(), on the official Anthropic SDK. The model retrieves and
// explains; every number in the final answer must appear in a tool result, or the answer is blocked.
import type {
  BetaContentBlockParam, BetaMessage, BetaMessageParam, BetaTextBlock, BetaTool, BetaToolResultBlockParam, BetaToolUseBlock,
  MessageCreateParamsNonStreaming,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'
import spec from './spec.json'
import { unsupportedNumbers } from './guard'
import { type Data, type Result, runTool } from './tools'

export type ToolCall = { name: string; input: Record<string, unknown>; result: Result }
export type AskResult = { question: string; answer: string | null; blocked: boolean; unsupported?: number[]; reason?: string; tools: ToolCall[] }
/** The slice of the SDK client the loop uses, so tests can script the model. */
export type Client = { beta: { messages: { create(p: MessageCreateParamsNonStreaming): Promise<BetaMessage> } } }

export async function ask(question: string, client: Client, data: Data, model: string = spec.model): Promise<AskResult> {
  const messages: BetaMessageParam[] = [{ role: 'user', content: question }]
  const calls: ToolCall[] = []
  for (let step = 0; step < spec.max_steps; step++) { // hard cap on model calls per question (no unbounded loops)
    const r = await client.beta.messages.create({
      model, max_tokens: 4000, system: spec.system, tools: spec.tools as BetaTool[], messages,
      output_config: { effort: 'low' }, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    })
    if (r.stop_reason === 'refusal') return { question, answer: null, blocked: true, reason: 'refusal', tools: calls }
    const uses = r.content.filter((b): b is BetaToolUseBlock => b.type === 'tool_use')
    if (!uses.length) {
      const text = r.content.filter((b): b is BetaTextBlock => b.type === 'text').map((b) => b.text).join('').trim()
      const bad = unsupportedNumbers(text, calls.map((c) => JSON.stringify(c.result)).join('\n'))
      return { question, answer: bad.length ? null : text, blocked: bad.length > 0, unsupported: bad, tools: calls }
    }
    messages.push({ role: 'assistant', content: r.content as BetaContentBlockParam[] }) // the whole turn, not just text
    const results: BetaToolResultBlockParam[] = []
    for (const u of uses) {
      const input = (u.input ?? {}) as Record<string, unknown>
      const res = await runTool(u.name, data, input)
      calls.push({ name: u.name, input, result: res })
      results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(res), ...('error' in res ? { is_error: true } : {}) })
    }
    messages.push({ role: 'user', content: results })
  }
  return { question, answer: null, blocked: true, reason: `step limit ${spec.max_steps}`, tools: calls }
}
