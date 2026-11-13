import { useRef, useState } from "react";
import { Num, compact, downloadSvg, fmt } from "./api";

export type ChartSeries = { name: string; values: Num[]; type: "line" | "bar" | "band"; color?: string; axis?: "right"; dash?: boolean; lo?: Num[]; hi?: Num[] };
export type ChartSpec = {
  id: string; kind: string; title: string; subtitle?: string; unit?: string; x: string[]; series: ChartSeries[];
  highlight?: number | null; markers?: { x: string; label: string }[]; note?: string | null; source?: string;
};

const W = 360, H = 190, T = 12, B = 24;

/** Animated chart for analyst answers. Every number comes from a pipeline chart spec, never from the model. */
export default function Chart({ spec, delay = 0 }: { spec: ChartSpec; delay?: number }) {
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const right = spec.series.some((s) => s.axis === "right");
  const L = 40, R = right ? 42 : 10;
  const n = spec.x.length;
  const max = (axis?: "right") => Math.max(1, ...spec.series.filter((s) => (s.axis === "right") === (axis === "right"))
    .flatMap((s) => [...s.values, ...(s.hi ?? [])]).filter((v): v is number => v !== null && Number.isFinite(v)));
  const [ml, mr] = [max() * 1.08, max("right") * 1.08];
  const bars = spec.series.filter((s) => s.type === "bar");
  const step = (W - L - R) / Math.max(1, n);
  const X = (i: number) => L + step * (i + 0.5);
  const Y = (v: number, axis?: "right") => T + (H - T - B) * (1 - v / (axis === "right" ? mr : ml));
  const path = (vals: Num[], axis?: "right") => {
    let d = "", pen = false;
    vals.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) { pen = false; return; }
      d += `${pen ? "L" : "M"}${X(i).toFixed(1)},${Y(v, axis).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const band = (s: ChartSeries) => {
    const idx = spec.x.map((_, i) => i).filter((i) => s.lo?.[i] != null && s.hi?.[i] != null);
    if (!idx.length) return "";
    return `M${idx.map((i) => `${X(i).toFixed(1)},${Y(s.hi![i]!).toFixed(1)}`).join("L")}L${[...idx].reverse().map((i) => `${X(i).toFixed(1)},${Y(s.lo![i]!).toFixed(1)}`).join("L")}Z`;
  };
  const ticks = [0, 0.5, 1];
  const every = Math.max(1, Math.ceil(n / 6));
  const move = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round((x - L) / step - 0.5);
    setHover(i >= 0 && i < n ? i : null);
  };
  const tipLeft = hover === null ? 0 : (X(hover) / W) * 100;
  return (
    <figure className="achart" style={{ animationDelay: `${delay}ms` }}>
      <figcaption>
        <b>{spec.title}</b>
        {spec.subtitle && <span>{spec.subtitle}</span>}
      </figcaption>
      <div className="achart-plot">
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={spec.title} onMouseMove={move} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={Y(ml * t)} y2={Y(ml * t)} className="gridline" />
              <text x={L - 5} y={Y(ml * t) + 3} textAnchor="end" className="axis">{compact(ml * t)}</text>
              {right && <text x={W - R + 5} y={Y(mr * t, "right") + 3} className="axis">{compact(mr * t)}</text>}
            </g>
          ))}
          {spec.markers?.map((m) => {
            const i = spec.x.indexOf(m.x);
            return i < 0 ? null : (
              <g key={m.x} className="amark">
                <line x1={X(i)} x2={X(i)} y1={T} y2={H - B} />
                <text x={X(i) + 3} y={T + 8}>{m.label}</text>
              </g>
            );
          })}
          {spec.series.map((s, k) => s.type === "band" && <path key={k} d={band(s)} fill={s.color} className="aband" />)}
          {bars.map((s, k) => s.values.map((v, i) => v === null ? null : (
            <rect key={`${k}-${i}`} className={`abar ${spec.highlight === i ? "hl" : ""}`}
              x={X(i) - (step * 0.72) / 2 + (step * 0.72 / bars.length) * k} width={Math.max(1, (step * 0.72) / bars.length - 0.6)}
              y={Y(v)} height={Math.max(0.5, H - B - Y(v))} fill={s.color}
              style={{ animationDelay: `${delay + 120 + i * Math.min(30, 600 / n)}ms` }} />
          )))}
          {spec.series.map((s, k) => s.type === "line" && (
            <path key={k} d={path(s.values, s.axis)} fill="none" stroke={s.color ?? "#fff"} strokeWidth={s.dash ? 1.3 : 2}
              strokeDasharray={s.dash ? "4 3" : undefined} className={s.dash ? "aline dash" : "aline"} pathLength={s.dash ? undefined : 1}
              style={{ animationDelay: `${delay + 200 + k * 150}ms` }} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {spec.series.map((s, k) => s.type === "line" && !s.dash && spec.highlight != null && s.values[spec.highlight] != null && (
            <circle key={`h${k}`} cx={X(spec.highlight)} cy={Y(s.values[spec.highlight]!, s.axis)} r="3.5" fill={s.color} className="adot" />
          ))}
          {spec.x.map((x, i) => (i % every === 0 || i === n - 1) && (n - 1 - i >= every / 2 || i === n - 1) && (
            <text key={i} x={X(i)} y={H - 8} textAnchor="middle" className={`axis ${spec.highlight === i ? "hl" : ""}`}>{x}</text>
          ))}
          {hover !== null && <line x1={X(hover)} x2={X(hover)} y1={T} y2={H - B} className="aguide" />}
        </svg>
        {hover !== null && (
          <div className="atip" style={{ left: `${Math.min(70, Math.max(2, tipLeft - 15))}%` }}>
            <b>{spec.x[hover]}</b>
            {spec.series.filter((s) => s.type !== "band").map((s) => (
              <span key={s.name}><i style={{ background: s.color }} />{s.name}: <b>{fmt(s.values[hover], 0)}</b></span>
            ))}
          </div>
        )}
      </div>
      <ul className="alegend">
        {spec.series.map((s) => <li key={s.name}><i className={s.type} style={{ background: s.color, borderColor: s.color }} />{s.name}</li>)}
      </ul>
      <div className="afoot">
        <span>{spec.unit}{spec.note ? ` · ${spec.note}` : ""}</span>
        <span>
          {spec.source && <code>{spec.source}</code>}
          <button className="link" onClick={() => downloadSvg(svg.current, spec.id.replace(/[^a-z0-9]+/gi, "-"))}>SVG</button>
        </span>
      </div>
    </figure>
  );
}
