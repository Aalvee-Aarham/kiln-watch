import { seasonMean } from './calendar'
import { busyMonths, SEASON_MONTHS, typicalSeason, whenText } from './plain'
import type { Calendar, KilnActivity, NrtSeason } from './types'

export type Facts = {
    districtName: string
    fireSeasonMonths: string
    unusualDaysThisSeason: number
    kilnSeason: string | null
    currentSeason: string
}

/** The facts the model is given about one district, all computed from the public export (never typed in). */
export function districtFacts(name: string, unitId: string, cal: Calendar, nrt: NrtSeason, ka?: KilnActivity | null): Facts {
  const bm = busyMonths(seasonMean(cal))
  const kiln = ka?.areas?.[unitId] ? typicalSeason(ka.areas[unitId].seasons) : null
  return {
    districtName: name,
    fireSeasonMonths: bm ? `${SEASON_MONTHS[bm.first]} to ${SEASON_MONTHS[bm.last]}` : 'quiet',
    unusualDaysThisSeason: nrt.districts[unitId]?.above_p90_days ?? 0,
    kilnSeason: kiln ? `${whenText(kiln.onset)} to ${whenText(kiln.end)}` : null,
    currentSeason: nrt.season,
  }
}

/** A saved answer's evidence row for these facts (snake_case keys read well as labels on the answer card). */
export const factsResult = (f: Facts) => ({ district: f.districtName, fire_season_months: f.fireSeasonMonths,
  unusual_days_this_season: f.unusualDaysThisSeason, kiln_season: f.kilnSeason, current_season: f.currentSeason })

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

/** Where each number sits in the text (same tokenizer as the guard), with its value. Bangla digits keep their positions. */
export const numberSpans = (text: string) =>
  [...toLatin(text).matchAll(NUM)].map((m) => ({ start: m.index!, end: m.index! + m[0].length, value: Number(m[0].replace(/,/g, '')) }))

/** Numbers stated in the answer that the context never gave (empty = the answer passes). */
export function unsupportedNumbers(answer: string, context: string): number[] {
  const allowed = numbers(context)
  return [...numbers(answer)].filter((n) => !allowed.has(n)).sort((a, b) => a - b)
}

/** Models tried in order; a 404 (retired model) moves to the next. The first two are GA on ai.google.dev (checked
 * 2026-10-12); the last two were added by the agent work as further fallbacks. Check ids before editing. */
export const GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash-lite']
export const RETIRED_MESSAGE = 'Google has retired the Gemini models this page uses, so live answers are unavailable for now.'

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
