import { useEffect, useRef } from 'react'
import { echarts, ensureChartTheme, type EOption } from '../lib/echarts'
import { charts } from '../lib/chartRegistry'
import { useTheme } from '../lib/theme'
import { usePatterns, useReducedMotion } from './ui'

/** ECharts host: ARIA on, resizes with its container, re-themes on toggle, decals only when patterns are on. */
export function EChart({ option, height = 320, label, exportName, measure, onClick }: {
  option: EOption; height?: number; label: string; exportName?: string; measure?: boolean
  onClick?: (p: { value?: unknown; dataIndex: number; seriesType?: string }) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<ReturnType<typeof echarts.init>>(null)
  const click = useRef(onClick)
  useEffect(() => { click.current = onClick })
  const theme = useTheme()
  const themeId = ensureChartTheme(theme)
  const reduced = useReducedMotion()
  const decals = usePatterns()
  useEffect(() => {
    if (!el.current) return
    const c = echarts.init(el.current, themeId)
    chart.current = c
    if (exportName) charts.set(exportName, c)
    c.on('click', (p) => click.current?.(p as never))
    const ro = new ResizeObserver(() => { if (!c.isDisposed()) c.resize() })
    ro.observe(el.current)
    return () => { ro.disconnect(); if (exportName && charts.get(exportName) === c) charts.delete(exportName); if (chart.current === c) chart.current = null; c.dispose() }
  }, [themeId, exportName])
  useEffect(() => {
    chart.current?.setOption({ aria: { enabled: true, decal: { show: decals } }, animation: !reduced, ...option }, true)
  }, [option, themeId, reduced, decals])
  return <div ref={el} role="img" aria-label={label} style={{ height }} className={`w-full ${measure ? 'measure' : ''}`} />
}

