import { useEffect, useState } from 'react'

const cache = new Map<string, Promise<unknown>>()

export const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/${path}`

// Honest wait feedback: a progress cursor only when a fetch outlives 300 ms.
let pending = 0
const busy = (d: number) => {
  pending += d
  if (typeof document === 'undefined') return
  if (pending === 0) document.documentElement.classList.remove('is-loading')
  else if (d > 0) setTimeout(() => { if (pending > 0) document.documentElement.classList.add('is-loading') }, 300)
}

export function fetchJson<T>(path: string): Promise<T> {
  let p = cache.get(path)
  if (!p) {
    busy(1)
    p = fetch(dataUrl(path)).then((r) => {
      if (!r.ok) throw new Error(r.status === 404 ? `${path} was not found` : `${path}: HTTP ${r.status}`)
      // Static hosts answer a missing file with the HTML app shell: report that as missing, not as a JSON parse error.
      if (r.headers.get('content-type')?.includes('text/html')) throw new Error(`${path} was not found`)
      return r.json()
    })
    p.catch(() => cache.delete(path)).finally(() => busy(-1))
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
