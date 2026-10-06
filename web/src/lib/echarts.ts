// Tree-shaken ECharts: only what the charts use. Themes register lazily from live CSS vars.
import * as echarts from 'echarts/core'
import { BarChart, HeatmapChart, LineChart, ScatterChart } from 'echarts/charts'
import {
  AriaComponent, DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent,
  MarkPointComponent, TitleComponent, TooltipComponent, VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { palette } from './theme'

echarts.use([BarChart, HeatmapChart, LineChart, ScatterChart, AriaComponent, DataZoomComponent, GridComponent, LegendComponent,
  MarkAreaComponent, MarkLineComponent, MarkPointComponent, TitleComponent, TooltipComponent, VisualMapComponent, CanvasRenderer])

const registered = new Set<string>()

/** Shared chart chrome: mono 13px axes, token colors, unified tooltip, 400ms draw-ins. Idempotent per theme. */
export function ensureChartTheme(name: string): string {
  const id = `kw-${name}`
  if (registered.has(id)) return id
  const p = palette()
  echarts.registerTheme(id, {
    color: [p.harm, p.kiln, p.veg, p.ctrl, p.unknown, p.muted],
    textStyle: { fontFamily: 'system-ui, "Noto Sans Bengali", sans-serif', color: p.ink },
    axisPointer: { lineStyle: { color: p.muted } },
    legend: { textStyle: { fontSize: 13, color: p.ink } },
    title: { textStyle: { color: p.ink } },
    tooltip: {
      backgroundColor: p.surface, borderColor: p.line, borderWidth: 1,
      textStyle: { color: p.ink, fontSize: 13 },
      extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,0.12); border-radius: 8px;',
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: p.line } }, axisTick: { lineStyle: { color: p.line } },
      axisLabel: { color: p.muted, fontSize: 12, fontFamily: '"IBM Plex Mono", monospace' },
      splitLine: { show: true, lineStyle: { color: p.line, type: 'dashed', opacity: 0.5 } },
    },
    valueAxis: {
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: p.muted, fontSize: 12, fontFamily: '"IBM Plex Mono", monospace' },
      splitLine: { lineStyle: { color: p.line, opacity: 0.6 } },
      nameTextStyle: { color: p.muted, fontSize: 11, fontFamily: '"IBM Plex Mono", monospace' },
    },
    animationDuration: 400,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 300,
  })
  registered.add(id)
  return id
}

export { echarts }
export type EOption = echarts.EChartsCoreOption
