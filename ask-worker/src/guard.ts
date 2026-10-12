// Copied from web/src/lib/geminiPrompt.ts (same rule as kilnwatch/ask.py numbers()/guard()):
// Bangla digits count, numbers compare by value, not as substrings.
const NUM = /(?<![\w.])-?\d[\d,]*(?:\.\d+)?/g
const toLatin = (s: string) => s.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
export const numbers = (text: string) => new Set([...toLatin(text).matchAll(NUM)].map((m) => Number(m[0].replace(/,/g, ''))))

/** Numbers stated in the answer that the context never gave (empty = the answer passes). */
export function unsupportedNumbers(answer: string, context: string): number[] {
  const allowed = numbers(context)
  return [...numbers(answer)].filter((n) => !allowed.has(n)).sort((a, b) => a - b)
}
