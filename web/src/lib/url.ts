import { useParams, useSearchParams } from 'react-router'
import { parseBox, type Box } from './box'

export type Lang = 'en' | 'bn'
export interface UrlState {
  level?: string; unitId?: string; box?: Box; boxError?: string
  mode: 'raw' | 'harm'; layout: 'cal' | 'season'; season?: string; lang: Lang; split: string
}

/** The whole view lives in the URL: route params + search params. Unknown values degrade gracefully. */
export function useUrlState(): [UrlState, (patch: Record<string, string | undefined>) => void] {
  const p = useParams()
  const [sp, setSp] = useSearchParams()
  let box: Box | undefined, boxError: string | undefined
  if (p.box) {
    const r = parseBox(p.box)
    if (typeof r === 'string') boxError = r
    else box = r
  }
  const state: UrlState = {
    level: p.level, unitId: p.unitId, box, boxError,
    mode: sp.get('mode') === 'raw' ? 'raw' : 'harm',
    layout: sp.get('layout') === 'season' ? 'season' : 'cal',
    season: sp.get('season') ?? undefined,
    lang: sp.get('lang') === 'bn' ? 'bn' : 'en',
    split: sp.get('split') ?? 'all',
  }
  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(sp)
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) next.delete(k)
      else next.set(k, v)
    }
    setSp(next, { replace: true })
  }
  return [state, set]
}
