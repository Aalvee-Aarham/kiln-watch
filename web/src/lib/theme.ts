// Reads the Tailwind @theme tokens so UI and charts share one palette; literal fallbacks when CSS vars are empty.
import { useSyncExternalStore } from 'react'

const FALLBACK: Record<string, string> = {
  '--color-raw': '#9a9a9a',
  '--color-harm': '#c2410c',
  '--color-band': '#fdba74',
  '--color-split-1': '#b45309',
  '--color-split-2': '#15803d',
  '--color-split-3': '#6b7280',
  '--color-kiln': '#b45309',
  '--color-ctrl': '#2563eb',
  '--color-ink': '#1c1917',
  '--color-muted': '#78716c',
  '--color-veg': '#15803d',
  '--color-unknown': '#6b7280',
  '--color-cloud': '#cbd5e1',
  '--color-line': '#e7e5e4',
  '--color-surface': '#ffffff',
  '--color-ember': '#c2410c',
  '--color-fire-1': '#fef3c7',
  '--color-fire-2': '#fbbf24',
  '--color-fire-3': '#ea580c',
  '--color-fire-4': '#c2410c',
  '--color-fire-5': '#7c2d12',
}

export function cssVar(name: string): string {
  const v = typeof window === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || FALLBACK[name] || '#888888'
}

export const palette = () => ({
  raw: cssVar('--color-raw'), harm: cssVar('--color-harm'), band: cssVar('--color-band'),
  split: [cssVar('--color-split-1'), cssVar('--color-split-2'), cssVar('--color-split-3')],
  kiln: cssVar('--color-kiln'), ctrl: cssVar('--color-ctrl'), ink: cssVar('--color-ink'), muted: cssVar('--color-muted'),
  veg: cssVar('--color-veg'), unknown: cssVar('--color-unknown'), cloud: cssVar('--color-cloud'),
  line: cssVar('--color-line'), surface: cssVar('--color-surface'), ember: cssVar('--color-ember'),
  fire: [cssVar('--color-fire-1'), cssVar('--color-fire-2'), cssVar('--color-fire-3'), cssVar('--color-fire-4'), cssVar('--color-fire-5')],
})

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
  localStorage.setItem('kwTheme', t)
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta) }
  meta.content = t === 'night' ? '#10151f' : '#f7f5f2'
}

export function toggleTheme() {
  current = current === 'day' ? 'night' : 'day'
  apply(current)
  listeners.forEach((l) => l())
}

export function useTheme(): ThemeName {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l) },
    () => current,
    () => 'day' as const,
  )
}
