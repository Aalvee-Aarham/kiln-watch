export type Facts = {
    districtName: string
    fireSeasonMonths: string
    unusualDaysThisSeason: number
    kilnSeason: string | null
    currentSeason: string
}

export function buildSystemPrompt(facts: Facts): string {
    return `You are Kiln Watch AI Agent, an autonomous geospatial intelligence assistant powered by NASA Earth observations (FIRMS MODIS, VIIRS, and Black Marble night lights).
Explain fire activity, seasonal burning patterns, agricultural residue clearing, and 23-year historical climate baselines accurately, clearly, and insightfully.

Observed Satellite Context for ${facts.districtName}:
- Location: ${facts.districtName}
- Current Season: ${facts.currentSeason}
- Baseline Burning Season: ${facts.fireSeasonMonths}
- Current Season Activity: ${facts.unusualDaysThisSeason} days observed above the 90th percentile normal
${facts.kilnSeason ? `- Brick Kilns: ${facts.kilnSeason}` : ''}

Use this satellite data as your primary evidence, and enrich your explanation with your agronomic and geospatial knowledge to explain WHY fires occur (e.g., crop rotations, harvest clearing, weather conditions, brick kiln operations). Answer directly and authoritatively in plain words.`
}

// Same rule as kilnwatch/ask.py numbers()/guard(): Bangla digits count, numbers compare by value, not as substrings.
const NUM = /(?<![\w.])-?\d[\d,]*(?:\.\d+)?/g
const toLatin = (s: string) => s.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
export const numbers = (text: string) => new Set([...toLatin(text).matchAll(NUM)].map((m) => Number(m[0].replace(/,/g, ''))))

/** Numbers stated in the answer that the context never gave (empty = the answer passes). */
export function unsupportedNumbers(answer: string, context: string): number[] {
  const allowed = numbers(context)
  return [...numbers(answer)].filter((n) => !allowed.has(n)).sort((a, b) => a - b)
}

/** Models tried in order: gemini-2.0-flash-lite is the fastest and most token/quota-efficient model on the free tier. */
export const GEMINI_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-flash'
]
export const RETIRED_MESSAGE = 'Google retired the models this page uses — the cached answers below still work.'

/** The request body: the instructions travel as system_instruction, never inside the user's turn. */
export function buildGeminiRequest(sys: string, q: string) {
  return {
    system_instruction: { parts: [{ text: sys }] },
    contents: [{ role: 'user', parts: [{ text: q }] }],
    generationConfig: {
      maxOutputTokens: 350 // Token-frugal cap to stay well within free tier limits while keeping responses concise
    },
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const extractText = (data: any): string => data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No answer returned.'

/** One answer from the first model that exists. 404 → next model; any other failure throws at once (no retry). */
export async function askGemini(fetchFn: typeof fetch, apiKey: string, sys: string, q: string, models = GEMINI_MODELS): Promise<string> {
  for (const m of models) {
    const res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, // a header, so the key never lands in URL logs
      body: JSON.stringify(buildGeminiRequest(sys, q)),
    })
    if (res.status === 404) continue
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return extractText(await res.json())
  }
  throw new Error(RETIRED_MESSAGE)
}
