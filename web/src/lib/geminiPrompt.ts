export type Facts = {
    districtName: string
    fireSeasonMonths: string
    unusualDaysThisSeason: number
    kilnSeason: string | null
    currentSeason: string
}

export function buildSystemPrompt(facts: Facts): string {
    return `You are Kiln Watch Assistant, a helpful and precise guide explaining satellite data for a district in Bangladesh.

Answer ONLY using the context provided below. DO NOT retrieve facts about Bangladesh or brick kilns from your general knowledge. NEVER state a specific number or date that is not present in the context below.

Context for ${facts.districtName}:
- District: ${facts.districtName}
- Current Season: ${facts.currentSeason}
- Burning Season Normal: The main fire season is usually ${facts.fireSeasonMonths}.
- Current Activity: The district has had ${facts.unusualDaysThisSeason} unusual days above the 90th percentile normal so far this season.
${facts.kilnSeason ? `- Brick Kilns: Kilns in this district typically work ${facts.kilnSeason}.` : '- Brick Kilns: No reliable night-light kiln season found for this district.'}

If asked about something not in this context, politely explain that you only have data about the fire season, unusual days, and kiln activity for this specific district based on Kiln Watch's satellite analysis.`
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

/** Models tried in order; a 404 (retired model) moves to the next. Check ids against ai.google.dev before editing. */
export const GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite']
export const RETIRED_MESSAGE = 'Google retired the models this page uses — the cached answers below still work.'

/** The request body: the instructions travel as system_instruction, never inside the user's turn. */
export function buildGeminiRequest(sys: string, q: string) {
  return {
    system_instruction: { parts: [{ text: sys }] },
    contents: [{ role: 'user', parts: [{ text: q }] }],
    generationConfig: { maxOutputTokens: 1024 }, // no temperature: deprecated on Gemini 3.x (ignored now, an error in later models)
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
