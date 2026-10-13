import { beforeEach, describe, expect, it } from 'vitest'
import { HISTORY_KEY, MAX_SAVED, loadHistory, saveHistory, withAnswer, type SavedAnswer } from './askHistory'

const entry = (n: number): SavedAnswer => ({ id: `id${n}`, asked_at: '2026-10-13T04:00:00Z', via: 'your-gemini-key', question: `q${n}`, answer: `a${n}`, blocked: false, tools: [] })

describe('ask history', () => {
  beforeEach(() => localStorage.clear())
  it('starts empty and round-trips through this browser', () => {
    expect(loadHistory()).toEqual([])
    saveHistory([entry(1)])
    expect(loadHistory()).toEqual([entry(1)])
  })
  it('puts the newest answer first and keeps at most MAX_SAVED', () => {
    let list: SavedAnswer[] = []
    for (let i = 0; i < MAX_SAVED + 5; i++) list = withAnswer(list, entry(i))
    expect(list).toHaveLength(MAX_SAVED)
    expect(list[0].question).toBe(`q${MAX_SAVED + 4}`)
  })
  it('ignores damaged storage instead of breaking the page', () => {
    localStorage.setItem(HISTORY_KEY, '{not json')
    expect(loadHistory()).toEqual([])
    localStorage.setItem(HISTORY_KEY, JSON.stringify([{ nope: 1 }, entry(2)]))
    expect(loadHistory()).toEqual([entry(2)])
  })
})
