import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './ui'
import { Caution, windowLevels } from './plain'
import { EChart } from './EChart'
import { monthlyMeans, MONTHS, SEASON_MONTHS, typicalSeason } from '../lib/plain'
import { palette, useTheme } from '../lib/theme'
import type { Events, NrtSeason } from '../lib/types'

/** A typical year by month (bars), this season so far (dots, districts only), kiln months shaded, harvests marked. */
export function TypicalYear({ perDay, nrt, distId, kiln, events, name }: {
  perDay: number[]; nrt?: NrtSeason; distId: string; kiln: ReturnType<typeof typicalSeason>; events?: Events; name: string
}) {
  const theme = useTheme()
  const p = useMemo(() => palette(), [theme]) // eslint-disable-line react-hooks/exhaustive-deps
  const typical = monthlyMeans(perDay)
  const live = nrt?.districts[distId]?.h
  const nowMonths = live ? monthlyMeans(live) : null // months not reached yet have no days: null, not zero
  const kilnLv = kiln ? windowLevels(kiln.onset, kiln.end, kiln.peak) : null
  const kFirst = kilnLv ? kilnLv.findIndex((v) => v > 0) : -1, kLast = kilnLv ? 11 - [...kilnLv].reverse().findIndex((v) => v > 0) : -1
  const mon = (doy: number) => MONTHS[new Date(Date.UTC(2001, 0, doy)).getUTCMonth()].slice(0, 3)
  const harvest = (events?.harvest ?? []).map((h) => `${h.crop === 'aman' ? 'Aman' : h.crop === 'boro' ? 'Boro' : h.crop} rice harvest: ${mon(h.start_doy)}–${mon(h.end_doy)}`)
  const opt = {
    grid: { left: 44, right: 12, top: 28, bottom: 28 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: SEASON_MONTHS.map((m) => m.slice(0, 3)) },
    yAxis: { type: 'value', name: 'Fire activity' },
    series: [
      {
        name: 'Typical year', type: 'bar', data: typical, color: p.heat, barWidth: '55%',
        markArea: kFirst >= 0 ? {
          silent: true, itemStyle: { color: p.brick, opacity: 0.1 }, label: { show: true, position: 'insideTop', color: p.brick, fontSize: 11, formatter: 'kiln season' },
          data: [[{ xAxis: SEASON_MONTHS[kFirst].slice(0, 3) }, { xAxis: SEASON_MONTHS[kLast].slice(0, 3) }]]
        } : undefined
      },
      ...(nowMonths ? [{ name: `This season (${nrt!.season})`, type: 'line', data: nowMonths, color: p.ink, symbol: 'circle', symbolSize: 7, lineStyle: { width: 0 } }] : []),
    ],
  }
  return (
    <figure className="panel m-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="font-semibold">A typical year in {name}, month by month</figcaption>
        <SonifyButton data={perDay} />
      </div>
      <p className="text-sm text-muted">Bars: average fire activity in each month since 2003 (July to June).{nowMonths ? ' Dots: this season so far, for the whole district.' : ''}{kilnLv ? ' Shaded: the usual kiln season.' : ''}
        {harvest.length ? ` ${harvest.join('; ')}.` : ''}</p>
      <EChart option={opt} height={280} label={`Average fire activity by month in ${name}`} />
      <Caution>Fire activity is a count of satellite fire detections per cloud-free area, on one scale for all satellites. It is not a measure of smoke or air quality.</Caution>
    </figure>
  )
}

function SonifyButton({ data }: { data: number[] }) {
  const [playing, setPlaying] = useState(false)
  const ctxRef = useRef<AudioContext | null>(null)

  const toggle = () => {
    if (playing) {
      if (ctxRef.current) {
        ctxRef.current.close()
        ctxRef.current = null
      }
      setPlaying(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    ctxRef.current = ctx
    setPlaying(true)

    const maxVal = Math.max(...data, 0.0001)
    const step = 0.03 // 30ms per day
    const now = ctx.currentTime

    // Precise, jitter-free scheduling via AudioContext
    for (let i = 0; i < data.length; i++) {
      const val = data[i]
      const pitch = 200 + (val / maxVal) * 600
      const t = now + i * step

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.frequency.value = pitch
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.3, t + 0.01)
      gain.gain.linearRampToValueAtTime(0, t + 0.02)

      osc.start(t)
      osc.stop(t + 0.02)
    }

    setTimeout(() => {
      if (ctxRef.current === ctx) {
        setPlaying(false)
        ctx.close()
        ctxRef.current = null
      }
    }, Math.ceil((data.length * step) * 1000 + 500))
  }

  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        try { ctxRef.current.close() } catch { /* ignore */ }
      }
    }
  }, [])

  return (
    <button className="btn px-3 py-1.5 text-sm print:hidden" onClick={toggle} title="Sonify fire history (daily average)">
      <Icon name={playing ? "cross" : "replay"} />
      {playing ? "Stop Audio" : "Play Fire History"}
    </button>
  )
}
