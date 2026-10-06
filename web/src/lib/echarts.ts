// Tree-shaken ECharts: only what the charts use. Themes register lazily from live CSS vars (one per day/night).
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

/** Shared chart chrome: Anek tabular axes, token colours in fixed slot order, one tooltip style. Idempotent per theme. */
export function ensureChartTheme(name: string): string {
  const id = `kw-${name}`
  if (registered.has(id)) return id
  const p = palette()
  const font = '"Anek Bangla Variable", "Noto Sans Bengali", system-ui, sans-serif'
  const axisLabel = { color: p.muted, fontSize: 12, fontFamily: font }
  echarts.registerTheme(id, {
    color: [p.heat, p.orbit, p.paddy, p.jute, p.brick, p.plum],
    textStyle: { fontFamily: font, color: p.ink },
    axisPointer: { lineStyle: { color: p.muted, width: 1 }, label: { backgroundColor: p.ink, color: p.surface } },
    legend: { textStyle: { fontSize: 13, color: p.ink }, itemWidth: 14, itemHeight: 8, icon: 'roundRect', itemGap: 16 },
    title: { textStyle: { color: p.ink } },
    tooltip: {
      backgroundColor: p.surface, borderColor: p.line, borderWidth: 1, padding: [8, 10], confine: true, // never off-screen on a phone
      textStyle: { color: p.ink, fontSize: 13, fontFamily: font },
      transitionDuration: 0.12,
      extraCssText: 'box-shadow: 0 8px 24px -8px rgba(15,20,40,0.25); border-radius: 8px; font-variant-numeric: tabular-nums;',
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: p.line } }, axisTick: { show: false },
      axisLabel, splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { show: false }, axisTick: { show: false }, axisLabel,
      splitLine: { lineStyle: { color: p.line, opacity: 0.7 } },
      nameTextStyle: { color: p.muted, fontSize: 12, fontFamily: font, align: 'left' },
    },
    line: { symbol: 'none', lineStyle: { width: 2 }, emphasis: { lineStyle: { width: 2 } } },
    bar: { itemStyle: { borderRadius: [2, 2, 0, 0] } },
    animationDuration: 400,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 300,
  })
  registered.add(id)
  return id
}

export { echarts }
export type EOption = echarts.EChartsCoreOption
