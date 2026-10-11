import { useSyncExternalStore } from 'react'

/** A tiny observable state: the animation writes it outside React; only the components that read a field re-render. */
export interface Store<T> { get(): T; set(patch: Partial<T>): void; subscribe(l: () => void): () => void }

export function createStore<T extends object>(init: T): Store<T> {
  let state = init
  const ls = new Set<() => void>()
  return {
    get: () => state,
    set(patch) {
      let changed = false
      for (const k in patch) if (!Object.is(patch[k], state[k])) { changed = true; break }
      if (!changed) return
      state = { ...state, ...patch }
      ls.forEach((l) => l())
    },
    subscribe(l) { ls.add(l); return () => { ls.delete(l) } },
  }
}

export const useStore = <T extends object, U>(s: Store<T>, pick: (v: T) => U): U =>
  useSyncExternalStore(s.subscribe, () => pick(s.get()), () => pick(s.get()))

/** What the time bars show and control. `t` is UTC ms; `day` is the day of the season (0 = 1 July). */
export interface Playback { t: number; playing: boolean; slow: boolean; day: number; seasonPlaying: boolean }
