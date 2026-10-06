// Reads the Tailwind @theme tokens so UI and charts share one palette; literal fallbacks (day values) when CSS vars are empty.
import { useSyncExternalStore } from 'react'

const FALLBACK: Record<string, string> = {
  '--color-heat': '#dd5400',
  '--color-orbit': '#3a58c3',
  '--color-paddy': '#c48400',
  '--color-jute': '#00876d',
  '--color-brick': '#9a2929',
  '--color-plum': '#9c4297',
  '--color-raw': '#8a919c',
  '--color-band': '#cdd3ec',
  '--color-cloud': '#cfd9e1',
  '--color-ink': '#182233',
  '--color-muted': '#5a6472',
  '--color-line': '#d9dfe3',
  '--color-surface': '#fbfeff',
  '--color-surface-2': '#f0f4f7',
  '--color-bg': '#f3f7f9',
  '--color-fire-1': '#eec469',
  '--color-fire-2': '#ed9316',
  '--color-fire-3': '#e05a00',
  '--color-fire-4': '#b62b0d',
  '--color-fire-5': '#79191b',
}

export function cssVar(name: string): string {
  const v = typeof window === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || FALLBACK[name] || '#888888'
}

export const palette = () => ({
  heat: cssVar('--color-heat'), orbit: cssVar('--color-orbit'), paddy: cssVar('--color-paddy'), jute: cssVar('--color-jute'),
  brick: cssVar('--color-brick'), plum: cssVar('--color-plum'),
  raw: cssVar('--color-raw'), band: cssVar('--color-band'), cloud: cssVar('--color-cloud'),
  ink: cssVar('--color-ink'), muted: cssVar('--color-muted'), line: cssVar('--color-line'),
  surface: cssVar('--color-surface'), surface2: cssVar('--color-surface-2'), bg: cssVar('--color-bg'),
  fire: [cssVar('--color-fire-1'), cssVar('--color-fire-2'), cssVar('--color-fire-3'), cssVar('--color-fire-4'), cssVar('--color-fire-5')],
})
export type Palette = ReturnType<typeof palette>
type Slot = 'paddy' | 'jute' | 'brick' | 'plum'

/** Colour follows the split key, never its position: a rebuild under another gate branch never repaints survivors. */
export const SPLIT_SLOT: Record<string, Slot> = { aman: 'paddy', boro: 'jute', veg: 'jute', vegetation: 'jute', kiln: 'brick', other: 'plum', unknown: 'plum' }
const SPARE: Slot[] = ['brick', 'jute', 'plum', 'paddy']
export const splitColor = (key: string, p: Palette, k = 0) => p[SPLIT_SLOT[key] ?? SPARE[k % SPARE.length]]

/** Split keys whose slot sits in the validator's CVD warning band at night: they carry a decal as secondary encoding. */
export const needsPattern = (key: string) => SPLIT_SLOT[key] === 'plum'

/** Fire-ramp step for a choropleth value: absent/zero = neutral plate (not "low fire"), else 5 equal steps of max. */
export function rampColor(v: number | null | undefined, max: number, p: Palette): string {
  if (v == null || !(v > 0) || !(max > 0)) return p.surface2
  return p.fire[Math.min(4, Math.floor((v / max) * 5 - 1e-9))]
}

export type ThemeName = 'day' | 'night'

// Module store (useSyncExternalStore) so every EChart re-themes on toggle.
function initialTheme(): ThemeName {
  if (typeof document === 'undefined') return 'day'
  const attr = document.documentElement.dataset.theme
  if (attr === 'night' || attr === 'day') return attr
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'night' : 'day'
}
let current: ThemeName = initialTheme()
const listeners = new Set<() => void>()

function apply(t: ThemeName) {
  document.documentElement.dataset.theme = t
  try { localStorage.setItem('kwTheme', t) } catch { /* private mode: theme still applies for this page */ }
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta) }
  meta.content = t === 'night' ? '#0e1321' : '#f3f7f9'
}

/** Flip the theme; with an origin (the toggle's centre) it reveals as a circle via View Transitions where supported. */
export function toggleTheme(origin?: { x: number; y: number }) {
  const flip = () => {
    current = current === 'day' ? 'night' : 'day'
    apply(current)
    listeners.forEach((l) => l())
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  if (!origin || reduced || !doc.startViewTransition) return flip()
  document.documentElement.style.setProperty('--vt-x', `${origin.x}px`)
  document.documentElement.style.setProperty('--vt-y', `${origin.y}px`)
  doc.startViewTransition(flip)
}

export function useTheme(): ThemeName {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l) },
    () => current,
    () => 'day' as const,
  )
}
