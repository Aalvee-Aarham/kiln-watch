import { useEffect, useMemo, useRef, useState } from "react";
import {
  Block, Cls, MONTHS, MONTH_SHORT, Meta, Metric, Num, OBSERVERS, Region, SCALE_UNIT, SENSOR_COLOR, SENSOR_LABEL, SHORT, Scale,
  View, api, compact, diverging, downloadSvg, fmt, heat, ordinal, periodLabel, pick, textOn,
} from "./api";

const LAUNCH: Record<number, string> = { 2002: "MODIS_A", 2012: "VIIRS_SNPP", 2018: "VIIRS_NOAA20", 2024: "VIIRS_NOAA21" };

function useVmax(v: Num[]) {
  return useMemo(() => {
    const xs = v.filter((x): x is number => x !== null && x > 0).sort((a, b) => a - b);
    return xs.length ? xs[Math.floor(xs.length * 0.99)] : 1;
  }, [v]);
}
const tOf = (v: number, vmax: number) => (v <= 0 ? 0 : 0.08 + 0.92 * Math.log1p(v) / Math.log1p(vmax));

// ---------------- At a glance ----------------

export function Glance({ meta }: { meta: Meta }) {
  return (
    <section className="glance" aria-label="At a glance">
      <ul>{meta.answers.sentences.map((s) => <li key={s}>{s}</li>)}</ul>
    </section>
  );
}

// ---------------- Calendar ----------------

type CalProps = {
  block: Block; scale: Scale; cls: Cls; view: View; weekly: boolean; years: [number, number];
  selected: string | null; onOpen: (period: string) => void;
};

export function Calendar(p: CalProps) {
  const b = p.block;
  const s = pick(b, p.scale, p.cls);
  const idx = useMemo(() => new Map(b.periods.map((k, i) => [k, i])), [b]);
  const vmax = useVmax(s.v);
  const [focus, setFocus] = useState<string | null>(p.selected);
  const years = Array.from({ length: p.years[1] - p.years[0] + 1 }, (_, i) => p.years[0] + i);
  const fi = focus ? idx.get(focus) ?? null : null;
  const gp = { ...p, years, idx, vmax, focus, onFocus: setFocus };

  return (
    <div className="calendar">
      <div className="readout" aria-live="polite">
        {fi !== null ? <Readout b={b} scale={p.scale} cls={p.cls} i={fi} /> : <span className="muted">Point at or tab to a cell to read it. Click or press Enter to open what's behind it.</span>}
      </div>
      {p.weekly ? <WeekGrid {...gp} /> : <MonthTable {...gp} />}
      <Legend view={p.view} vmax={vmax} scale={p.scale} />
      {p.view === "median" && <p className="muted small">Colour and label show each period against the median of the same {p.weekly ? "week" : "month"} in all other complete years.</p>}
      {p.view === "recent" && <p className="muted small">Colour and label show each period against a recency-weighted median of the same {p.weekly ? "week" : "month"} in the other years: each year counts half as much as one 10 years newer (exponential decay, as in "optimal climate normals"), so the baseline reflects today's fire regime more than the early 2000s.</p>}
    </div>
  );
}

type GridProps = Omit<CalProps, "years"> & { years: number[]; idx: Map<string, number>; vmax: number; focus: string | null; onFocus: (k: string | null) => void };

function cellStyle(b: Block, p: GridProps, i: number) {
  const v = pick(b, p.scale, p.cls).v[i];
  if (v === null) return { cls: "nodata", bg: undefined, fg: undefined, text: "" };
  if (p.view !== "value") {
    const h = b.classes[p.cls].history;
    const r = (p.view === "recent" ? h.wratio?.[i] : h.ratio[i]) ?? null;
    return r === null ? { cls: "nohist", bg: undefined, fg: undefined, text: compact(v) } : { cls: "", bg: diverging(r), fg: "#F3EEF8", text: `×${r < 10 ? r.toFixed(1) : Math.round(r)}` };
  }
  const t = tOf(v, p.vmax);
  return { cls: "", bg: heat(t), fg: textOn(t), text: compact(v) };
}

function ariaFor(b: Block, p: GridProps, i: number) {
  const s = pick(b, p.scale, p.cls);
  const h = b.classes[p.cls].history;
  const parts = [`${periodLabel(b.periods[i])}: ${s.v[i] === null ? "no satellite observing" : `${fmt(s.v[i], 0)} ${SCALE_UNIT[p.scale]}`}`];
  if (h.rank[i] !== null) parts.push(`${ordinal(h.rank[i]!)} highest of ${h.n[i]} years`);
  if (b.partial[i]) parts.push("still in progress");
  else if (b.provisional[i]) parts.push("provisional");
  return parts.join(", ");
}

function MonthTable(p: GridProps) {
  const b = p.block;
  const s = pick(b, p.scale, p.cls);
  const ref = useRef<HTMLTableElement>(null);
  const key = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
  const typical = Array.from({ length: 12 }, (_, m) => {
    const xs = p.years.map((y) => p.idx.get(key(y, m))).filter((i): i is number => i !== undefined && !b.partial[i] && s.v[i] !== null).map((i) => s.v[i]!).sort((a, c) => a - c);
    return xs.length >= 5 ? xs[Math.floor(xs.length / 2)] : null;
  });
  const start = p.focus ?? p.selected ?? b.periods[b.periods.length - 1];
  const move = (e: React.KeyboardEvent, k: string) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p.onOpen(k); return; }
    const d = ({ ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] } as Record<string, number[]>)[e.key];
    if (!d) return;
    e.preventDefault();
    const t = (+k.slice(0, 4) + d[0]) * 12 + (+k.slice(5, 7) - 1) + d[1];
    const next = key(Math.floor(t / 12), ((t % 12) + 12) % 12);
    if (!p.idx.has(next)) return;
    p.onFocus(next);
    ref.current?.querySelector<HTMLElement>(`[data-k="${next}"]`)?.focus();
  };
  return (
    <div className="cal-wrap">
      <table className="cal" ref={ref} role="grid" aria-label="Fire activity by month and year" onMouseLeave={() => p.onFocus(p.selected)}>
        <thead><tr><th scope="col"><span className="sr">Year</span></th>{MONTH_SHORT.map((m) => <th key={m} scope="col">{m}</th>)}<th scope="col" className="ytot">Year</th></tr></thead>
        <tbody>
          {p.years.map((y) => {
            let tot = 0, partial = false, any = false;
            return (
              <tr key={y}>
                <th scope="row">{LAUNCH[y] && <i className="launch" style={{ background: SENSOR_COLOR[LAUNCH[y]] }} title={`${SENSOR_LABEL[LAUNCH[y]]} begins`} />}{y}</th>
                {MONTH_SHORT.map((_, m) => {
                  const k = key(y, m);
                  const i = p.idx.get(k);
                  if (i === undefined) { partial = true; return <td key={m} className="out" />; }
                  const c = cellStyle(b, p, i);
                  if (s.v[i] !== null) { tot += s.v[i]!; any = true; }
                  partial ||= b.partial[i];
                  const flags = [c.cls, b.partial[i] ? "partial" : b.provisional[i] ? "prov" : "", p.scale === "viirs" && s.modelled?.[i] ? "modelled" : "", k === p.selected ? "sel" : ""].join(" ");
                  return (
                    <td key={m} role="gridcell" data-k={k} tabIndex={k === start ? 0 : -1} className={flags} style={{ background: c.bg, color: c.fg }}
                      aria-label={ariaFor(b, p, i)} aria-selected={k === p.selected}
                      onMouseEnter={() => p.onFocus(k)} onFocus={() => p.onFocus(k)} onClick={() => p.onOpen(k)} onKeyDown={(e) => move(e, k)}>
                      {c.text}
                    </td>
                  );
                })}
                <td className="ytot num">{any ? compact(tot) : ""}{partial && any ? "…" : ""}</td>
              </tr>
            );
          })}
          <tr className="typical">
            <th scope="row">Median</th>
            {typical.map((v, m) => <td key={m} style={v === null || p.view !== "value" ? undefined : { background: heat(tOf(v, p.vmax)), color: textOn(tOf(v, p.vmax)) }}>{p.view !== "value" ? "" : compact(v)}</td>)}
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function WeekGrid(p: GridProps) {
  const b = p.block;
  const W = 420, L = 34, cols = 53, cw = (W - L) / cols, rh = 9;
  const H = p.years.length * rh + 16;
  const key = (y: number, c: number) => `${y}-W${String(c + 1).padStart(2, "0")}`;
  const cur = p.focus ?? p.selected ?? b.periods[b.periods.length - 1];
  const onKey = (e: React.KeyboardEvent) => {
    const i = p.idx.get(cur ?? "");
    if (i === undefined) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p.onOpen(cur!); return; }
    const d = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -52, ArrowDown: 52 } as Record<string, number>)[e.key];
    if (d) { e.preventDefault(); p.onFocus(b.periods[Math.max(0, Math.min(b.periods.length - 1, i + d))]); }
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="weekgrid" role="grid" aria-label="Fire activity by ISO week and year. Arrow keys move, Enter opens." tabIndex={0} onKeyDown={onKey} onMouseLeave={() => p.onFocus(p.selected)}>
      <defs><pattern id="nod" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#1A2536" /><line x1="0" y1="0" x2="0" y2="4" stroke="#3A4A63" strokeWidth="1.2" /></pattern></defs>
      {[1, 14, 27, 40].map((w) => <text key={w} x={L + (w - 1) * cw} y={9} className="axis">W{w}</text>)}
      {p.years.map((y, r) => (
        <g key={y} transform={`translate(0 ${13 + r * rh})`}>
          <text x={L - 4} y={rh - 2} className="axis" textAnchor="end">{y}</text>
          {Array.from({ length: cols }, (_, c) => {
            const k = key(y, c);
            const i = p.idx.get(k);
            if (i === undefined) return null;
            const st = cellStyle(b, p, i);
            const hi = k === cur || k === p.selected;
            return (
              <rect key={c} x={L + c * cw} y={0} width={cw - 0.6} height={rh - 0.8} fill={st.bg ?? "url(#nod)"} opacity={b.partial[i] ? 0.6 : 1}
                stroke={hi ? "var(--focus)" : undefined} strokeWidth={hi ? 1.2 : 0} className="cell"
                onMouseEnter={() => p.onFocus(k)} onClick={() => p.onOpen(k)}><title>{ariaFor(b, p, i)}</title></rect>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

function Readout({ b, scale, cls, i }: { b: Block; scale: Scale; cls: Cls; i: number }) {
  const s = pick(b, scale, cls);
  const h = b.classes[cls].history;
  return (
    <span>
      <b>{periodLabel(b.periods[i])}</b>{" "}
      <span className="num big-num">{fmt(s.v[i], 0)}</span>
      {s.lo[i] !== null && <span className="muted"> (95%: {fmt(s.lo[i], 0)}–{fmt(s.hi[i], 0)})</span>}
      {h.rank[i] !== null && <span className={h.pct[i]! >= 90 ? "hot" : "muted"}>, {ordinal(h.rank[i]!)} highest of {h.n[i]}{h.ratio[i] !== null ? `, ×${h.ratio[i]!.toFixed(1)} the median` : ""}</span>}
      {h.wpct?.[i] != null && <span className={h.wpct[i]! >= 90 ? "hot" : "muted"}>, {ordinal(Math.round(h.wpct[i]!))} percentile vs. recent years</span>}
      {b.partial[i] ? <span className="tag">to date</span> : b.provisional[i] && <span className="tag">provisional</span>}
      {scale === "viirs" && s.modelled?.[i] && <span className="tag">modelled</span>}
    </span>
  );
}

function Legend({ view, vmax, scale }: { view: string; vmax: number; scale: Scale }) {
  const stops = Array.from({ length: 11 }, (_, i) => i / 10);
  return (
    <div className="legend">
      <div className="ramp" style={{ background: `linear-gradient(90deg, ${stops.map((t) => (view !== "value" ? diverging(2 ** (t * 4 - 2)) : heat(0.08 + 0.92 * t))).join(",")})` }} />
      <div className="ramp-labels">
        {view !== "value" ? <><span>×¼ the {view === "recent" ? "weighted " : ""}median</span><span>{view === "recent" ? "recent-weighted median" : "median"}</span><span>×4</span></> : <><span>0</span><span>{SCALE_UNIT[scale]}, log scale</span><span>{fmt(vmax)}+</span></>}
      </div>
      <div className="keys">
        <span><i className="k-partial" /> in progress</span>
        <span><i className="k-prov" /> provisional (near-real-time data)</span>
        {scale === "viirs" && <span><i className="k-recon" /> modelled: before VIIRS</span>}
        <span><i className="k-empty" /> no satellite observing</span>
      </div>
    </div>
  );
}

// ---------------- charts ----------------

type Line = { name: string; color: string; vals: Num[]; dash?: string; wide?: boolean };

function LineChart({ x, lines, band, logY, marks, label, name, yFmt = (v: number) => fmt(v) }: {
  x: string[]; lines: Line[]; band?: { lo: Num[]; hi: Num[]; color: string }; logY?: boolean; marks?: { at: number; color: string; text: string }[];
  label: string; name: string; yFmt?: (v: number) => string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const W = 420, H = 180, L = 40, R = 8, T = 10, B = 22;
  const all = [...lines.flatMap((l) => l.vals), ...(band ? [...band.lo, ...band.hi] : [])].filter((v): v is number => v !== null && (!logY || v > 0));
  if (!all.length) return <p className="muted small">Not enough data for this chart.</p>;
  const tf = (v: number) => (logY ? Math.log10(Math.max(v, 1e-3)) : v);
  let lo = Math.min(...all.map(tf)), hi = Math.max(...all.map(tf));
  if (!logY) lo = Math.min(0, lo);
  if (hi === lo) hi = lo + 1;
  const px = (i: number) => L + (x.length > 1 ? (i / (x.length - 1)) * (W - L - R) : 0);
  const py = (v: number) => T + (1 - (tf(v) - lo) / (hi - lo)) * (H - T - B);
  const path = (vals: Num[]) => vals.map((v, i) => (v === null || (logY && v <= 0) ? null : `${px(i)},${py(v)}`)).filter(Boolean).join(" ");
  const ticks = logY ? [1, 3, 10, 30, 100, 300, 1000, 3000, 10000, 30000, 100000].filter((t) => Math.log10(t) >= lo && Math.log10(t) <= hi)
    : Array.from({ length: 4 }, (_, k) => lo + ((hi - lo) * k) / 3);
  const labelsAt = x.length > 8 ? [0, Math.floor(x.length / 3), Math.floor((2 * x.length) / 3), x.length - 1] : x.map((_, i) => i);
  let bandPath = "";
  if (band) {
    const up = band.hi.map((v, i) => (v === null ? null : `${px(i)},${py(v)}`)).filter(Boolean);
    const dn = band.lo.map((v, i) => (v === null ? null : `${px(i)},${py(logY ? Math.max(v, 1e-3) : v)}`)).filter(Boolean).reverse();
    if (up.length && dn.length) bandPath = `M${up.join("L")}L${dn.join("L")}Z`;
  }
  return (
    <figure className="fig">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={label}>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={py(t)} y2={py(t)} className="gridline" /><text x={L - 4} y={py(t) + 3} className="axis" textAnchor="end">{yFmt(t)}</text></g>)}
        {bandPath && <path d={bandPath} fill={band!.color} opacity={0.22} />}
        {marks?.map((m) => <g key={m.text}><line x1={px(m.at)} x2={px(m.at)} y1={T} y2={H - B} stroke={m.color} strokeDasharray="2 3" /><text x={px(m.at) + 3} y={T + 8} className="axis" fill={m.color}>{m.text}</text></g>)}
        {lines.map((l) => <polyline key={l.name} points={path(l.vals)} fill="none" stroke={l.color} strokeWidth={l.wide ? 2.4 : 1.5} strokeDasharray={l.dash} />)}
        {labelsAt.map((i) => <text key={i} x={px(i)} y={H - 6} className="axis" textAnchor={i === 0 ? "start" : i === x.length - 1 ? "end" : "middle"}>{x[i]}</text>)}
      </svg>
      <figcaption>
        <ul className="chart-key">{lines.map((l) => <li key={l.name}><i style={{ background: l.color }} />{l.name}</li>)}</ul>
        <button className="link small" onClick={() => downloadSvg(ref.current, name)}>Download chart (SVG)</button>
      </figcaption>
    </figure>
  );
}

// ---------------- Season ----------------

const weekMonth = (isoWeek: number) => MONTHS[new Date(Date.UTC(2021, 0, 4 + (isoWeek - 1) * 7)).getUTCMonth()];

export function SeasonView({ r }: { r: Region }) {
  const s = r.meta.season;
  if (!s) return <p className="muted">Not enough complete years with activity to describe a fire season here.</p>;
  const wk = (o: number) => ((s.fire_year_start_week - 1 + o) % 52) + 1;
  const lbl = (o: number) => `week ${wk(o)} (${weekMonth(wk(o)).slice(0, 3)})`;
  const tr = (f: "start" | "end" | "length", what: string) => {
    const t = s.trend[f];
    if (t.p === null) return `${what}: not enough years to test.`;
    const sen = t.sen_weeks_per_decade ?? 0;
    const dir = f === "length" ? (sen > 0 ? "longer" : "shorter") : sen > 0 ? "later" : "earlier";
    return t.p < 0.05 ? `${what} has moved ${fmt(Math.abs(sen), 1)} weeks per decade ${dir} (p ${t.p < 0.001 ? "< 0.001" : `= ${fmt(t.p, 3)}`}).` : `${what}: no clear shift (p = ${fmt(t.p, 2)}).`;
  };
  const typicalTotal = [...s.years.map((y) => y.total)].sort((a, b) => a - b)[Math.floor(s.years.length / 2)];
  const offsets = s.envelope.map((_, o) => `W${wk(o)}`);
  const cur = s.envelope.map((_, o) => (o < s.current.cumulative.length ? s.current.cumulative[o] : null));
  return (
    <div className="stack">
      <section>
        <h3>Critical period for vegetation fires</h3>
        {typicalTotal < 100 && <p className="warn small">A typical year here has only {fmt(typicalTotal)} vegetation hotspots on the Aqua scale, so season dates and their trends are uncertain. Most heat in this area may come from persistent sources; see the Calendar with "Kilns & static heat".</p>}
        <p>In a typical year the fire season runs from <b>{lbl(s.median.start)}</b> to <b>{lbl(s.median.end)}</b>, the weeks holding the central 80% of the year's hotspots, and peaks around <b>{lbl(s.median.peak)}</b>.</p>
        <ul className="plain small">
          <li>{tr("start", "Season start")}</li><li>{tr("end", "Season end")}</li><li>{tr("length", "Season length")}</li>
        </ul>
        {s.next_4_weeks_share_pct !== null && <p className="small">The next four weeks usually hold <b>{fmt(s.next_4_weeks_share_pct, 0)}%</b> of a year's hotspots.</p>}
        {s.year_to_date && <p className="small">This fire year so far ({s.year_to_date.weeks} weeks): {fmt(s.year_to_date.value)} hotspots, <b>{ordinal(s.year_to_date.rank)} highest of {s.year_to_date.n}</b> years over the same weeks (median {fmt(s.year_to_date.median)}).</p>}
        <p className="muted small">The fire year starts in week {s.fire_year_start_week}, the quietest time of year here, so seasons that cross 1 January are not split.</p>
      </section>
      <section>
        <h3>This year against every year since 2000</h3>
        <LineChart x={offsets} name={`${r.meta.id}-cumulative`} label="Cumulative hotspots through the fire year"
          band={{ lo: s.envelope.map((e) => e[0]), hi: s.envelope.map((e) => e[2]), color: "#ED6925" }}
          lines={[{ name: "Median year", color: "#F7D13D", vals: s.envelope.map((e) => e[1]), dash: "4 3" }, { name: `Fire year ${s.current.fire_year} so far`, color: "#56B4E9", vals: cur, wide: true }]} />
        <p className="muted small">Shaded: lowest to highest cumulative total among complete fire years. Harmonized hotspots, Aqua scale.</p>
      </section>
      <section>
        <h3>Each fire year</h3>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>Fire year</th><th>Start</th><th>Peak</th><th>End</th><th>Weeks</th><th>Hotspots</th></tr></thead>
            <tbody>{[...s.years].reverse().map((y) => (
              <tr key={y.fire_year}><td>{s.fire_year_start_week > 26 ? `${y.fire_year}–${String(y.fire_year + 1).slice(2)}` : y.fire_year}</td><td className="num">W{wk(y.start)}</td><td className="num">W{wk(y.peak)}</td><td className="num">W{wk(y.end)}</td><td className="num">{y.length}</td><td className="num">{fmt(y.total)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ---------------- Continuity ----------------

function annual(b: Block, vals: Num[]) {
  const out = new Map<number, { v: number; partial: boolean }>();
  b.periods.forEach((k, i) => {
    const y = +k.slice(0, 4);
    const cur = out.get(y) ?? { v: 0, partial: y === 2000 };
    cur.v += vals[i] ?? 0;
    cur.partial ||= b.partial[i];
    out.set(y, cur);
  });
  return out;
}

const ratio = (v: Num | undefined) => (v === null || v === undefined ? "–" : `×${v.toFixed(2)}`);
const pv = (p: Num) => (p === null ? "–" : p < 0.001 ? "<0.001" : fmt(p, 3));
function isoWeekOf(d: string) {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7));
  const y = t.getUTCFullYear();
  const w = 1 + Math.floor((t.getTime() - Date.UTC(y, 0, 1)) / 604800000);
  return `${y}-W${String(w).padStart(2, "0")}`;
}

export function Continuity({ r, cls }: { r: Region; cls: Cls }) {
  const b = r.monthly, m = r.meta;
  const series: Line[] = [
    { name: "Raw detections, all satellites", color: "#9AA8BC", dash: "4 3", vals: pick(b, "raw", cls).v },
    { name: "Aqua MODIS only (one orbit, consistent)", color: SENSOR_COLOR.MODIS_A, vals: b.classes[cls].aqua_only },
    { name: "Harmonized (all satellites, calibrated)", color: "#FCFFA4", vals: b.classes[cls].hotspots.v, wide: true },
  ];
  const yd = series.map((s) => annual(b, s.vals));
  const base = yd.map((d) => { const xs = [...d.entries()].filter(([y, v]) => y >= 2003 && y <= 2011 && !v.partial).map(([, v]) => v.v); return xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : 0; });
  const years = [...yd[2].keys()].filter((y) => y >= 2001 && !yd[2].get(y)!.partial);
  const idxLines = series.map((s, si) => ({ ...s, vals: years.map((y) => (base[si] ? (yd[si].get(y)!.v / base[si]) * 100 : null)) }));
  const cut = m.denial.snpp_cutover, wh = m.denial.snpp_withheld;
  const t2 = m.trend["2003-2020"];
  const drift = Object.entries(m.drift).filter(([, v]) => v.length > 2);
  const driftYears = [...new Set(drift.flatMap(([, v]) => v.map((q) => q[0])))].sort();
  return (
    <div className="stack">
      <section>
        <h3>Raw counts rise with every satellite; the harmonized record does not</h3>
        <LineChart x={years.map(String)} lines={idxLines} logY name={`${m.id}-continuity`} yFmt={(v) => String(Math.round(v))}
          label="Yearly totals indexed to their 2003–2011 average"
          marks={Object.entries(LAUNCH).filter(([y]) => years.includes(+y)).map(([y, s]) => ({ at: years.indexOf(+y), color: SENSOR_COLOR[s], text: SHORT[s] }))} />
        <p className="muted small">Yearly totals, each indexed to its own 2003–2011 average (= 100), log scale. A step in the raw line that the Aqua-only line does not share is the satellite fleet changing, not fire.</p>
      </section>

      {cut && (
        <section>
          <h3>Suomi-NPP ended on {cut.snpp_last_observed}</h3>
          <LineChart x={cut.periods} logY name={`${m.id}-snpp-cutover`} label="Weekly hotspots around the Suomi-NPP end" yFmt={(v) => fmt(v)}
            band={{ lo: cut.lo, hi: cut.hi, color: "#FCFFA4" }}
            marks={[{ at: Math.max(0, cut.periods.findIndex((k) => k >= isoWeekOf(cut.snpp_last_observed))), color: SENSOR_COLOR.VIIRS_SNPP, text: "S-NPP ends" }]}
            lines={[{ name: "Raw detections, all satellites", color: "#9AA8BC", vals: cut.raw_all, dash: "4 3" }, { name: "Harmonized, with 95% interval", color: "#FCFFA4", vals: cut.harmonized, wide: true }]} />
          <p className="muted small">The last Suomi-NPP detection in the data is dated {cut.snpp_last_observed}. Raw counts lose a satellite; the harmonized series continues from NOAA-20 and NOAA-21, which were calibrated onto the same scale while all three flew together. The latest week is still in progress.</p>
        </section>
      )}

      {wh && (
        <section>
          <h3>Rehearsal: the record without Suomi-NPP</h3>
          <p>Rebuilding {wh.window.join(" to ")} with Suomi-NPP withheld keeps <b>{fmt((wh.inside_interval ?? 0) * 100, 0)}%</b> of {wh.n} months within the interval of the full record, with a mean difference of {fmt(wh.mean_abs_diff_pct, 1)}%.</p>
        </section>
      )}

      <section>
        <h3>Level change at each satellite arrival</h3>
        <table className="tbl">
          <thead><tr><th>Arrival</th><th>Raw</th><th>Real change (Aqua only)</th><th>Harmonized</th><th>Left over</th></tr></thead>
          <tbody>{Object.entries(m.steps).map(([s, st]) => (
            <tr key={s}><td><i className="dot" style={{ background: SENSOR_COLOR[s] }} />{SHORT[s]} <span className="muted">{st.period}</span></td>
              <td className="num">{ratio(st.raw_all_sensors)}</td><td className="num">{ratio(st.aqua_only)}</td><td className="num">{ratio(st.harmonized)}</td>
              <td className="num strong">{ratio(st.harmonized_excess)}</td></tr>
          ))}</tbody>
        </table>
        <p className="muted small">Deseasonalized mean of the 24 months after ÷ the 24 months before. Fires really do change between years, so the Aqua-only column is the real change; "left over" is harmonized ÷ Aqua-only, and ×1.00 means no artificial step.
          {m.placebo && ` The same test at ${m.placebo.n} dates with no satellite change gives harmonized ÷ Aqua-only ratios between ${ratio(m.placebo.excess_p05)} and ${ratio(m.placebo.excess_p95)} (5th–95th percentile); a step inside that range cannot be told apart from ordinary year-to-year variation.`}
          {" "}Aqua itself drifts after about 2021, so the 2024 comparison is weaker.</p>
      </section>

      <section>
        <h3>Does harmonization keep the trend?</h3>
        <table className="tbl">
          <thead><tr><th>2003–2020</th><th>Kendall τ</th><th>p</th><th>Sen slope / yr</th></tr></thead>
          <tbody>{([["harmonized", "Harmonized"], ["aqua_only", "Aqua only"], ["raw_all_sensors", "Raw, all satellites"]] as const).map(([k, l]) => (
            <tr key={k}><td>{l}</td><td className="num">{fmt(t2[k].tau, 3)}</td><td className="num">{pv(t2[k].p)}</td><td className="num">{fmt(t2[k].sen_per_year, 1)}</td></tr>
          ))}</tbody>
        </table>
        <p className="muted small">Seasonal Mann-Kendall test on monthly values. The harmonized slope should match Aqua-only; the raw slope is inflated by new satellites. Full record {m.trend.full.harmonized.years.join("–")}: τ = {fmt(m.trend.full.harmonized.tau, 3)}, p {pv(m.trend.full.harmonized.p)}.</p>
      </section>

      {drift.length > 0 && (
        <section>
          <h3>Orbit drift signature</h3>
          <LineChart x={driftYears.map(String)} name={`${m.id}-drift`} label="Yearly detection ratios between satellites" yFmt={(v) => v.toFixed(2)}
            lines={drift.map(([k, v], j) => ({ name: k.split("/").map((s) => SHORT[s]).join(" ÷ "), color: ["#E69F00", "#CC79A7", "#009E73"][j], vals: driftYears.map((y) => v.find((q) => q[0] === y)?.[1] ?? null) }))} />
          <p className="muted small">Detections in co-observed months, per year. A ratio that is flat and then bends after about 2020 shows Terra and Aqua drifting from their crossing times, which is why the MODIS calibration stops at 2020.</p>
        </section>
      )}

      <section>
        <h3>Satellites in the record</h3>
        <Gantt sensors={m.sensors} through={m.data_through} />
      </section>
    </div>
  );
}

export function Gantt({ sensors, through }: { sensors: Meta["sensors"]; through: string }) {
  const t0 = Date.parse("2000-11-01"), t1 = Date.parse(through);
  const pct = (d: string) => ((Date.parse(d) - t0) / (t1 - t0)) * 100;
  const ended = (s: string) => (t1 - Date.parse(sensors[s].last)) / 86400000 > 3;
  return (
    <div className="gantt">
      {OBSERVERS.filter((s) => sensors[s]).map((s) => (
        <div key={s} className="gantt-row">
          <span>{SENSOR_LABEL[s]}</span>
          <div className="gantt-track"><div className="gantt-bar" style={{ left: `${pct(sensors[s].first)}%`, width: `${Math.max(0.5, pct(sensors[s].last) - pct(sensors[s].first))}%`, background: SENSOR_COLOR[s] }} title={`${sensors[s].first} to ${sensors[s].last}, ${sensors[s].days.toLocaleString()} observing days`} /></div>
          <span className="small num">{sensors[s].first.slice(0, 4)}–{ended(s) ? <b className="ended">{sensors[s].last}</b> : "now"}</span>
        </div>
      ))}
      <p className="muted small">Measured from the data: a satellite counts as observing on any day it delivered detections anywhere on Earth. Latest data {through}.</p>
    </div>
  );
}

// ---------------- Method & validation ----------------

const pc = (v: Num | undefined) => (v === null || v === undefined ? "–" : `${v > 0 ? "+" : ""}${v}%`);
const metricCells = (m: Metric) => <><td className="num">{pc(m.bias_pct)}</td><td className="num">{fmt(m.mae, 1)}</td><td className="num">{fmt(m.spearman ?? null, 2)}</td></>;

function Rows({ title, sub, rows }: { title: string; sub: string; rows: [string, Metric][] }) {
  return (
    <>
      <tr className="group"><td colSpan={4}><b>{title}</b> <span className="muted small">{sub}</span></td></tr>
      {rows.map(([l, mm], i) => <tr key={l} className={i === 0 ? "strong" : ""}><td className="indent">{l}</td>{metricCells(mm)}</tr>)}
    </>
  );
}

export function Method({ r, cls }: { r: Region; cls: Cls }) {
  const m = r.meta;
  const [dn, setDn] = useState<"D" | "N">("D");
  const [range, setRange] = useState<[string, string]>(() => [new Date(Date.parse(m.data_through) - 29 * 86400000).toISOString().slice(0, 10), m.data_through]);
  const den = m.denial.modis_ends_2016;
  const key = `${cls}_det_${dn}`;
  const fd = m.frp_distribution, fs = m.filter_sensitivity;
  const rangeOk = range[0] <= range[1] && (Date.parse(range[1]) - Date.parse(range[0])) / 86400000 <= 366;
  const dropped = Object.entries(fs.dropped_share_by_sensor_daynight).map(([k, v]) => {
    const sensor = k.slice(0, k.lastIndexOf("_"));
    return `${sensor === "MODIS" ? "MODIS" : SHORT[sensor] ?? sensor} ${k.endsWith("_D") ? "day" : "night"} ${fmt(v * 100, 1)}%`;
  });
  return (
    <div className="stack">
      <section>
        <h3>What the number means</h3>
        <p>{m.estimand.primary}</p>
        <p className="small">{m.estimand.why_aqua}</p>
        <p className="muted small">{m.estimand.not}</p>
      </section>

      <section>
        <h3>Rehearsal: what if MODIS had ended in 2016?</h3>
        <p className="small">Calibrated on {den.train.join(" to ")} only, then 2017–2020 rebuilt from VIIRS alone and compared with what Aqua actually recorded ({den.n} months).</p>
        {den.series && <LineChart x={den.series.periods} name={`${m.id}-modis-denial`} label="Aqua hotspots rebuilt from VIIRS alone vs observed"
          band={{ lo: den.series.lo, hi: den.series.hi, color: "#56B4E9" }}
          lines={[{ name: "Aqua actually observed", color: SENSOR_COLOR.MODIS_A, vals: den.series.aqua, wide: true }, { name: "Rebuilt from VIIRS only, 95% interval", color: "#56B4E9", vals: den.series.predicted, dash: "4 3" }]} />}
        <table className="tbl">
          <thead><tr><th>Method</th><th>Bias</th><th>MAE</th><th>Rank ρ</th></tr></thead>
          <tbody>
            <tr className="strong"><td>Seasonal ratios, empirical Bayes (ours)</td>{metricCells(den.ours_seasonal_eb)}</tr>
            <tr><td>Single ratio (baseline)</td>{metricCells(den.baseline_single_ratio)}</tr>
            <tr><td>No calibration</td>{metricCells(den.uncalibrated)}</tr>
          </tbody>
        </table>
        <p className="muted small">
          Before widening, the 95% intervals contained the observed value in {fmt((den.ours_seasonal_eb.interval_coverage_raw ?? 0) * 100, 0)}% of months.
          {den.interval_scale > 1 ? ` Every interval that uses VIIRS is therefore widened ×${den.interval_scale.toFixed(2)}, which gives ${fmt((den.ours_seasonal_eb.interval_coverage ?? 0) * 100, 0)}% coverage.` : " No widening was needed."}
        </p>
      </section>

      <section>
        <div className="row spread"><h3>Hold-out test for each link</h3><Seg2 value={dn} onChange={setDn} /></div>
        <p className="muted small">Calibrated on earlier years only, scored on later years the calibration never saw ({dn === "D" ? "daytime" : "night-time"} detections, monthly).</p>
        <table className="tbl">
          <thead><tr><th>Link and method</th><th>Bias</th><th>MAE</th><th>Rank ρ</th></tr></thead>
          <tbody>{m.validation[key].map((v) => (
            <Rows key={v.sensor} title={`${SHORT[v.sensor]} → ${SHORT[v.reference]}`} sub={`train ${v.train.join("–")}, test ${v.test.join("–")}, n=${v.ours_seasonal_eb.n}`}
              rows={[["Seasonal, empirical Bayes (ours)", v.ours_seasonal_eb], ["Single ratio", v.baseline_single_ratio], ["No calibration", v.uncalibrated]]} />
          ))}</tbody>
        </table>
        {m.transfer_validation && cls === "veg" && (
          <table className="tbl"><tbody>
            <Rows title="Geographic hold-out, Suomi-NPP → Aqua" sub={`all detections, test ${m.transfer_validation.test.join("–")}`}
              rows={[["Calibrated in this area", m.transfer_validation.calibrated_here], ["Transferred from the other areas", m.transfer_validation.transferred_from_other_regions]]} />
          </tbody></table>
        )}
      </section>

      {m.closure[key]?.length > 0 && (
        <section>
          <h3>Chain closure</h3>
          <table className="tbl">
            <thead><tr><th>Link</th><th>Direct</th><th>Via chain</th><th>Mismatch</th></tr></thead>
            <tbody>{m.closure[key].map((c) => <tr key={c.sensor}><td>{SHORT[c.sensor]} → {SHORT[c.reference]} <span className="muted small">{c.window.join("–")}</span></td><td className="num">{fmt(c.direct, 3)}</td><td className="num">{fmt(c.composed, 3)}</td><td className="num">{pc(c.mismatch_pct)}</td></tr>)}</tbody>
          </table>
          <p className="muted small">Each VIIRS satellite reaches the Aqua scale through a chain of links. Where a direct link also exists, the difference is treated as systematic error and added to the interval.</p>
        </section>
      )}

      <section>
        <h3>Calibration factors</h3>
        <p className="muted small">Aqua-scale hotspots per detection of each satellite, by calendar month ({dn === "D" ? "day" : "night"}). σ is the calibration error left after counting noise. How strongly each month is pulled toward the average is estimated from the data.</p>
        {m.calibration[key].map((c) => {
          const max = Math.max(...c.beta, 1e-4);
          return (
            <div key={c.sensor} className="beta">
              <span>{SHORT[c.sensor]} → {SHORT[c.reference]}</span>
              <svg viewBox="0 0 120 22" className="spark" aria-label="Monthly factors">{c.beta.map((v, i) => <rect key={i} x={i * 10} y={22 - (v / max) * 20} width={8} height={(v / max) * 20} fill={SENSOR_COLOR[c.sensor]}><title>{MONTH_SHORT[i]}: {v}</title></rect>)}</svg>
              <span className="num">×{fmt(c.pooled, 3)}</span>
              <span className="num muted">σ {fmt(Math.sqrt(c.sigma2) * 100, 0)}%</span>
              {!c.calibrated && <span className="tag">not enough overlap</span>}
            </div>
          );
        })}
      </section>

      <section>
        <h3>Does the confidence filter matter?</h3>
        <p className="small">Share of detections dropped as low confidence: {dropped.join(", ")}.</p>
        <p className="small">Keeping them would change yearly harmonized totals by {fmt(fs.annual_total_change_pct_if_unfiltered.mean, 1)}% on average (largest {fmt(fs.annual_total_change_pct_if_unfiltered.max_abs, 1)}%).</p>
        <p className="muted small">{fs.note}</p>
      </section>

      {fd.available && cls === "veg" && (
        <section>
          <h3>Fire power is kept per satellite</h3>
          <QQ fd={fd} />
          <p className="muted small">Quantiles of per-detection FRP, Aqua vs Suomi-NPP (2017–2020). Quantile mapping trained on 2012–2016 shrinks the distance W₂ from {fmt(fd.w2_raw!, 3)} to {fmt(fd.w2_mapped!, 3)}. {fd.note}</p>
        </section>
      )}

      <section>
        <h3>Processing versions in this record</h3>
        <table className="tbl"><thead><tr><th>Stream</th><th>Version</th><th>From</th><th>To</th></tr></thead>
          <tbody>{m.versions.map((v) => <tr key={v.sensor + v.version}><td>{v.sensor}</td><td>{v.version}</td><td className="num">{v.first}</td><td className="num">{v.last}</td></tr>)}</tbody></table>
        <p className="muted small">Versions ending in NRT are near-real-time; FIRMS later replaces them with standard processing, so periods containing them are marked provisional.</p>
      </section>

      <section>
        <h3>Processing steps</h3>
        <ol className="steps">{Object.entries(m.method).map(([k, v]) => <li key={k}><b>{k.replace(/_/g, " ")}</b>: {v}</li>)}</ol>
      </section>

      <section>
        <h3>Downloads</h3>
        <div className="row">
          <a className="btn" href={api.csvUrl(m.id, "month")} download>Calendar, monthly (CSV)</a>
          <a className="btn ghost" href={api.csvUrl(m.id, "week")} download>Weekly (CSV)</a>
          <a className="btn ghost" href={api.ratioTableUrl()} download>Calibration table, all areas</a>
          <button className="btn ghost" onClick={() => window.print()}>Print area brief</button>
        </div>
        <div className="row dl">
          <label className="small">From <input type="date" value={range[0]} min="2000-11-01" max={m.data_through} onChange={(e) => setRange([e.target.value, range[1]])} /></label>
          <label className="small">to <input type="date" value={range[1]} min="2000-11-01" max={m.data_through} onChange={(e) => setRange([range[0], e.target.value])} /></label>
          {rangeOk ? <a className="btn ghost" href={api.hotspotsUrl(m.id, range[0], range[1])} download>Hotspots in this range (CSV)</a> : <span className="error small">Choose a range of up to 366 days.</span>}
        </div>
        <p className="muted small">The hotspot file has one row per FIRMS detection, with satellite, processing version, static-source flag and whether it was used in the calendar.</p>
      </section>

      <section>
        <h3>Data and reproducibility</h3>
        <dl className="prov">
          <dt>Source</dt><dd>{m.provenance.source}</dd>
          <dt>Read from</dt><dd><a href="https://source.coop/portolan-mirrors/firms-catalog" target="_blank" rel="noreferrer">Portolan FIRMS mirror</a>, updated {m.provenance.mirror_updated?.slice(0, 10) ?? "unknown"}</dd>
          <dt>Data through</dt><dd>{m.data_through}</dd>
          <dt>Built</dt><dd>{m.built_at.slice(0, 16).replace("T", " ")} UTC, code {m.provenance.code_version}</dd>
          <dt>Reproduce</dt><dd><code>{m.provenance.reproduce}</code></dd>
          <dt>License</dt><dd>{m.provenance.license}</dd>
        </dl>
        <p className="muted small">{m.provenance.acknowledgement}</p>
      </section>
    </div>
  );
}

function Seg2({ value, onChange }: { value: "D" | "N"; onChange: (v: "D" | "N") => void }) {
  return <div className="seg" role="radiogroup" aria-label="Day or night">{(["D", "N"] as const).map((k) => <button key={k} role="radio" aria-checked={value === k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>{k === "D" ? "Day" : "Night"}</button>)}</div>;
}

function QQ({ fd }: { fd: Meta["frp_distribution"] }) {
  const ref = fd.q_aqua_test!, raw = fd.q_snpp_test!, mapped = fd.q_snpp_mapped!;
  const all = [...ref, ...raw, ...mapped];
  const lo = Math.min(...all), hi = Math.max(...all);
  const S = 170, P = 26;
  const t = (v: number) => P + ((v - lo) / (hi - lo || 1)) * (S - P - 6);
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="chart qq" role="img" aria-label="Quantile-quantile plot of FRP">
      <line x1={t(lo)} y1={S - t(lo)} x2={t(hi)} y2={S - t(hi)} className="gridline" />
      {raw.map((v, i) => <circle key={`r${i}`} cx={t(ref[i])} cy={S - t(v)} r={2.4} fill={SENSOR_COLOR.VIIRS_SNPP} />)}
      {mapped.map((v, i) => <circle key={`m${i}`} cx={t(ref[i])} cy={S - t(v)} r={2.4} fill="none" stroke="#FCFFA4" />)}
      <text x={S / 2} y={S - 4} className="axis" textAnchor="middle">Aqua log₁₀ FRP</text>
      <text x={8} y={S / 2} className="axis" textAnchor="middle" transform={`rotate(-90 8 ${S / 2})`}>Suomi-NPP</text>
      <g className="axis"><circle cx={P + 6} cy={12} r={2.4} fill={SENSOR_COLOR.VIIRS_SNPP} /><text x={P + 12} y={15}>raw</text><circle cx={P + 46} cy={12} r={2.4} fill="none" stroke="#FCFFA4" /><text x={P + 52} y={15}>mapped</text></g>
    </svg>
  );
}

/** Year range for the calendar, clamped to the record. */
export function useYearRange(b: Block | null): [[number, number], (r: [number, number]) => void, [number, number]] {
  const lo = b ? +b.periods[0].slice(0, 4) : 2000, hi = b ? +b.periods[b.periods.length - 1].slice(0, 4) : new Date().getFullYear();
  const [r, setR] = useState<[number, number]>([lo, hi]);
  useEffect(() => setR([lo, hi]), [lo, hi]);
  return [[Math.max(r[0], lo), Math.min(r[1], hi)], setR, [lo, hi]];
}
