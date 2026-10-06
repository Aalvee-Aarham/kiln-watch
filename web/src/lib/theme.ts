// Reads the Tailwind @theme tokens so UI and charts share one palette; literal fallbacks when CSS vars are empty.
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
}

export function cssVar(name: string): string {
  const v = typeof window === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || FALLBACK[name] || '#888888'
}

export const palette = () => ({
  raw: cssVar('--color-raw'), harm: cssVar('--color-harm'), band: cssVar('--color-band'),
  split: [cssVar('--color-split-1'), cssVar('--color-split-2'), cssVar('--color-split-3')],
  kiln: cssVar('--color-kiln'), ctrl: cssVar('--color-ctrl'), ink: cssVar('--color-ink'), muted: cssVar('--color-muted'),
})
