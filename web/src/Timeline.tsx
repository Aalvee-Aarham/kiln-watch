import { useEffect, useMemo, useRef } from "react";
import { Block, Cls, Meta, SENSOR_COLOR, SENSOR_LABEL, heat, pick } from "./api";

const START = { y: 2000, m: 11 };
const LANES = ["MODIS_T", "MODIS_A", "VIIRS_SNPP", "VIIRS_NOAA20", "VIIRS_NOAA21"];
const FALLBACK_START: Record<string, string> = { MODIS_T: "2000-11-01", MODIS_A: "2002-07-04", VIIRS_SNPP: "2012-01-20", VIIRS_NOAA20: "2018-04-01", VIIRS_NOAA21: "2024-01-17" };

const toIdx = (k: string) => (+k.slice(0, 4) - START.y) * 12 + (+k.slice(5, 7) - START.m);
const toKey = (i: number) => {
  const t = START.y * 12 + START.m - 1 + i;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

type Props = {
  block: Block | null; cls: Cls; sensors: Meta["sensors"] | null; month: string; lastMonth: string;
  onMonth: (m: string) => void; playing: boolean; onPlay: (v: boolean) => void;
};

export default function Timeline(p: Props) {
  const n = toIdx(p.lastMonth) + 1;
  const svg = useRef<SVGSVGElement>(null);
  const W = 1000, BAR = 34, LANE = 5;
  const x = (i: number) => (i / n) * W;

  const bars = useMemo(() => {
    if (!p.block) return null;
    const s = pick(p.block, "hotspots", p.cls).v;
    const max = Math.max(1, ...s.map((v) => v ?? 0));
    return p.block.periods.map((k, i) => ({ i: toIdx(k), v: s[i] ?? 0, t: Math.sqrt((s[i] ?? 0) / max) }));
  }, [p.block, p.cls]);

  // timelapse
  const monthRef = useRef(p.month);
  monthRef.current = p.month;
  useEffect(() => {
    if (!p.playing) return;
    const id = setInterval(() => {
      const next = toIdx(monthRef.current) + 1;
      if (next >= n) p.onPlay(false);
      else p.onMonth(toKey(next));
    }, 450);
    return () => clearInterval(id);
  }, [p.playing, n]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickAt = (clientX: number) => {
    const r = svg.current!.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.floor(((clientX - r.left) / r.width) * n)));
    p.onMonth(toKey(i));
  };
  const drag = (e: React.PointerEvent) => {
    if (e.buttons !== 1) return;
    pickAt(e.clientX);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const d = { ArrowLeft: -1, ArrowRight: 1, PageUp: -12, PageDown: 12 }[e.key];
    if (d) { e.preventDefault(); p.onMonth(toKey(Math.max(0, Math.min(n - 1, toIdx(p.month) + d)))); }
  };
  const sel = toIdx(p.month);
  const years = Array.from({ length: +p.lastMonth.slice(0, 4) - 2000 }, (_, k) => 2001 + k);
  const sensorSpan = (s: string) => {
    const a = p.sensors?.[s]?.first ?? FALLBACK_START[s];
    const b = p.sensors?.[s]?.last ?? `${p.lastMonth}-28`;
    return [toIdx(a.slice(0, 7)), toIdx(b.slice(0, 7)) + 1];
  };

  return (
    <div className="timeline">
      <div className="tl-controls">
        <button className="icon" onClick={() => p.onMonth(toKey(Math.max(0, sel - 1)))} aria-label="Previous month">‹</button>
        <button className="icon play" onClick={() => { if (sel >= n - 1) p.onMonth(toKey(0)); p.onPlay(!p.playing); }} aria-label={p.playing ? "Pause timelapse" : "Play timelapse"}>
          {p.playing ? "❚❚" : "▶"}
        </button>
        <button className="icon" onClick={() => p.onMonth(toKey(Math.min(n - 1, sel + 1)))} aria-label="Next month">›</button>
      </div>
      <svg ref={svg} viewBox={`0 0 ${W} ${BAR + LANES.length * (LANE + 2) + 16}`} preserveAspectRatio="none" className="tl-svg"
        role="slider" aria-label="Month" aria-valuetext={p.month} aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={sel} tabIndex={0}
        onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); pickAt(e.clientX); }} onPointerMove={drag} onKeyDown={onKey}>
        {bars ? bars.map((b) => b.v > 0 && <rect key={b.i} x={x(b.i)} y={BAR - b.t * BAR} width={W / n + 0.3} height={b.t * BAR} fill={heat(0.3 + 0.7 * b.t)} />)
          : <text x={W / 2} y={BAR / 2 + 4} className="axis" textAnchor="middle">Open an area to see its 26-year activity here</text>}
        {LANES.map((s, k) => {
          const [a, b] = sensorSpan(s);
          return <rect key={s} x={x(a)} y={BAR + 3 + k * (LANE + 2)} width={Math.max(0, x(b) - x(a))} height={LANE} fill={SENSOR_COLOR[s]} opacity={0.75}><title>{SENSOR_LABEL[s]}</title></rect>;
        })}
        {years.map((y) => <g key={y}>
          <line x1={x(toIdx(`${y}-01`))} x2={x(toIdx(`${y}-01`))} y1={BAR + 3} y2={BAR + LANES.length * (LANE + 2) + 3} stroke="var(--line)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
          {(y % 2 === 0 || n < 200) && <text x={x(toIdx(`${y}-01`)) + 2} y={BAR + LANES.length * (LANE + 2) + 14} className="axis tl-year">{y}</text>}
        </g>)}
        <rect x={x(sel)} y={0} width={Math.max(2, W / n)} height={BAR + LANES.length * (LANE + 2) + 3} fill="var(--focus)" opacity={0.9} />
      </svg>
      <div className="tl-legend">
        {LANES.map((s) => <span key={s}><i style={{ background: SENSOR_COLOR[s] }} />{SENSOR_LABEL[s].replace(" VIIRS", "").replace(" MODIS", "")}</span>)}
      </div>
    </div>
  );
}

export { toIdx, toKey };
