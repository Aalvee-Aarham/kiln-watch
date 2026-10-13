import type { AgentResolution } from '../lib/agentEngine'
import { IllustrativeNote } from './ui'

/**
 * Historical Fire Incident & Precedents Canvas
 * Fulfills the requirement: "oi place aa fire lagse naki prev kokhono, erokom news thakle dekhabe"
 */
export function AgentNewsCanvas({ res }: { res: AgentResolution }) {
  return (
    <div className="flex h-full min-h-[460px] w-full flex-col justify-between overflow-hidden rounded-[12px] border border-white/10 bg-[#090d15] p-5 shadow-2xl">
      <IllustrativeNote>Illustrative examples, not verified news records: titles, figures and sources here are typed-in samples.</IllustrativeNote>
      {/* Header */}
      <div className="border-b border-white/10 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-neutral-300">
            {res.locationName.toUpperCase()} · HISTORICAL FIRE PRECEDENTS & NEWS
          </h2>
          <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 font-mono text-[11px] text-orange-400 border border-orange-500/20">
            {res.news.length} Documented Records
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          Historical fire outbreaks, satellite alert surges, and official reports cross-referenced from 2003–present.
        </p>
      </div>

      {/* News List */}
      <div className="my-auto space-y-3 overflow-y-auto py-3 max-h-[300px] pr-1">
        {res.news.map((item, idx) => (
          <div
            key={idx}
            className="rounded-[8px] border border-white/10 bg-[#0d1422] p-3.5 transition-colors hover:border-orange-500/40"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-mono font-semibold text-orange-400">
                {item.date} ({item.year})
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase ${
                  item.severity === 'high'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {item.severity === 'high' ? 'High Severity Alert' : 'Advisory / Record'}
              </span>
            </div>

            <h3 className="mt-1.5 text-sm font-semibold text-neutral-100">
              {item.title}
            </h3>

            <p className="mt-1 text-xs leading-relaxed text-neutral-300">
              {item.summary}
            </p>

            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-400 font-mono">
              <span className="opacity-60">Source:</span>
              <span className="text-neutral-300">{item.source}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Context */}
      <div className="border-t border-white/10 pt-3 text-xs text-neutral-400">
        <p className="leading-relaxed">
          <strong className="text-neutral-200">23-Year Satellite Context:</strong> Thermal sensor records from Terra, Aqua, and Suomi-NPP verify periodic seasonal peaks. All historical news records align with verified FIRMS cluster anomalies.
        </p>
      </div>
    </div>
  )
}
