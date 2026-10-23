// The questions you asked on #/ask and the answers they got, kept in this browser only (never sent anywhere).
// Bounded: the newest MAX_SAVED answers are kept. Storage can be missing or blocked (private mode): then nothing is
// saved and the page still works.
import type { ToolCall } from './askTrace'

export type SavedAnswer = {
  id: string; asked_at: string; via: 'your-gemini-key' | 'hosted'; model?: string
  question: string; answer: string | null; blocked: boolean; reason?: string; unsupported?: number[]; tools: ToolCall[]
}
export const HISTORY_KEY = 'kw-ask-history'
export const MAX_SAVED = 50

export function loadHistory(): SavedAnswer[] {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => x && typeof x.question === 'string' && Array.isArray(x.tools)) : []
  } catch { return [] }
}

export function saveHistory(list: SavedAnswer[]): void {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)) } catch { /* storage blocked: keep it in memory only */ }
}

/** Newest first, at most MAX_SAVED. */
export const withAnswer = (list: SavedAnswer[], a: SavedAnswer) => [a, ...list].slice(0, MAX_SAVED)

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
