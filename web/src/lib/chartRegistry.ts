// Live chart instances by export name, so a section's Download menu can export a PNG without importing ECharts.
type Exportable = { getDataURL: (o: { pixelRatio: number; backgroundColor: string }) => string }
export const charts = new Map<string, Exportable>()

export function chartPng(name: string) {
  return charts.get(name)?.getDataURL({ pixelRatio: 2, backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-surface') || '#fff' })
}
