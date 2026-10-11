import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { searchPlaces, type Hit } from '../../lib/world'
import { Icon } from '../ui'

/** Type a city, country or Bangladesh district; the best matches open under the field (↑ ↓ to choose, Enter to take, Esc to clear). */
export function PlaceSearch({ entries, onPick, loading }: { entries: Hit[]; onPick: (h: Hit) => void; loading?: boolean }) {
  const id = useId()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const hits = useMemo(() => searchPlaces(entries, q, 6), [entries, q])
  const take = (h: Hit) => { onPick(h); setQ(''); setActive(0) }
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(hits.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    else if (e.key === 'Enter' && hits[active]) { e.preventDefault(); take(hits[active]) }
    else if (e.key === 'Escape') setQ('')
  }
  const open = q.trim().length > 0
  return (
    <div className="space-search">
      <label htmlFor={id} className="sr-only">Find a place</label>
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted" />
      <input id={id} type="search" autoComplete="off" spellCheck={false} placeholder={loading ? 'Loading places…' : 'Find a city or country…'}
        value={q} onChange={(e) => { setQ(e.target.value); setActive(0) }} onKeyDown={key}
        role="combobox" aria-expanded={open && hits.length > 0} aria-controls={`${id}-list`} aria-autocomplete="list" />
      {open && (
        <ul id={`${id}-list`} role="listbox" className="space-search-list">
          {hits.length ? hits.map((h, i) => (
            <li key={`${h.kind}:${h.id}`} role="option" aria-selected={i === active}>
              <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => take(h)} onMouseEnter={() => setActive(i)}>
                <span className="truncate font-medium text-ink">{h.name}</span><span className="truncate text-xs text-muted">{h.sub}</span>
              </button>
            </li>
          )) : <li className="px-3 py-2 text-sm text-muted">{loading ? 'Loading places…' : 'No place by that name'}</li>}
        </ul>
      )}
    </div>
  )
}
