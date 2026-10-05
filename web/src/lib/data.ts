import { useEffect, useState } from 'react'

const cache = new Map<string, Promise<unknown>>()

export const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/${path}`

export function fetchJson<T>(path: string): Promise<T> {
  let p = cache.get(path)
  if (!p) {
    p = fetch(dataUrl(path)).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`)
      return r.json()
    })
    p.catch(() => cache.delete(path))
    cache.set(path, p)
  }
  return p as Promise<T>
}

export type Loadable<T> = { data?: T; error?: string; loading: boolean }

/** In-memory cached JSON loader; pass null to skip. */
export function useJson<T>(path: string | null): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ loading: !!path })
  useEffect(() => {
    if (!path) return setState({ loading: false })
    let live = true
    setState({ loading: true })
    fetchJson<T>(path).then(
      (data) => live && setState({ data, loading: false }),
      (e: Error) => live && setState({ error: e.message, loading: false }),
    )
    return () => { live = false }
  }, [path])
  return state
}
