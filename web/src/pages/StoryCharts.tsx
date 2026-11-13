import { useMemo } from "react";
import { Block, Meta } from "../api";

// Story visuals for the home page. story.ts animates them when their beat arrives: [data-in] blocks fade in,
// [data-draw] paths draw, [data-lit] groups pop their children in (values are seconds after the block starts).
// Every SVG element exists from the first render (story.ts wires them once); data fills the paths later.

// ---------- same fire, two cameras (an illustration, not data) ----------
// A 6 × 4 km patch: one large fire and six small ones. A square "lights up" when fire covers more than 6 % of it.
const W = 6, H = 4, THRESH = 0.06;
const BIG = { x: 2.2, y: 2.05, rx: 0.95, ry: 0.5, rot: -0.35 };
const SMALL: [number, number, number][] = [[4.3, 1.0, 0.12], [4.95, 2.9, 0.13], [3.75, 3.25, 0.11], [1.0, 0.8, 0.12], [5.35, 1.7, 0.1], [0.7, 3.3, 0.13]];
const onFire = (x: number, y: number) => {
  const c = Math.cos(BIG.rot), s = Math.sin(BIG.rot), dx = x - BIG.x, dy = y - BIG.y;
  const u = (dx * c + dy * s) / BIG.rx, v = (-dx * s + dy * c) / BIG.ry;
  return u * u + v * v <= 1 || SMALL.some(([fx, fy, r]) => (x - fx) ** 2 + (y - fy) ** 2 <= r * r);
};
function litCells(km: number) {
  const nx = Math.ceil(W / km), ny = Math.ceil(H / km), out: [number, number][] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    let hit = 0;
    for (let a = 0; a < 14; a++) for (let b = 0; b < 14; b++) hit += +onFire((i + (a + 0.5) / 14) * km, (j + (b + 0.5) / 14) * km);
    if (hit / 196 > THRESH) out.push([i, j]);
  }
  return { nx, ny, out };
}
const CAM = { modis: { km: 1, name: "MODIS", size: "1 km squares" }, viirs: { km: 0.375, name: "VIIRS", size: "375 m squares" } };

function Patch({ cam, lit }: { cam: keyof typeof CAM; lit: number }) {
  const { km, name, size } = CAM[cam];
  const { nx, ny, out } = useMemo(() => litCells(km), [km]);
  const u = 100 * km; // px per square
  return (
    <div className={`patch ${cam}`}>
      <p className="pl"><b>{name}</b>{size}</p>
      <svg viewBox="0 0 600 400" role="img" aria-label={`${name} view: ${out.length} squares light up`}>
        <defs>
          <radialGradient id="fireg"><stop offset="0" stopColor="#ffe08a" /><stop offset=".45" stopColor="#ff7a2f" /><stop offset="1" stopColor="#ff3d1f" stopOpacity="0" /></radialGradient>
          <filter id="blur"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>
        <rect width="600" height="400" className="ground" />
        <g filter="url(#blur)" className="flames">
          <ellipse cx={BIG.x * 100} cy={BIG.y * 100} rx={BIG.rx * 100} ry={BIG.ry * 100} transform={`rotate(${(BIG.rot * 180) / Math.PI} ${BIG.x * 100} ${BIG.y * 100})`} fill="url(#fireg)" />
          {SMALL.map(([x, y, r]) => <circle key={x} cx={x * 100} cy={y * 100} r={r * 160} fill="url(#fireg)" />)}
        </g>
        <g className="grid">
          {Array.from({ length: nx + 1 }, (_, i) => <line key={`x${i}`} x1={i * u} x2={i * u} y1="0" y2="400" />)}
          {Array.from({ length: ny + 1 }, (_, j) => <line key={`y${j}`} y1={j * u} y2={j * u} x1="0" x2="600" />)}
        </g>
        <g className="lit" data-lit={lit}>
          {out.map(([i, j]) => <rect key={`${i}-${j}`} x={i * u + 1} y={j * u + 1} width={u - 2} height={u - 2} />)}
        </g>
      </svg>
      <p className="pc"><b>{out.length}</b> {out.length === 1 ? "square lights up" : "squares light up"}</p>
    </div>
  );
}

/** One or two camera views of the same patch of burning ground. */
export function PixelCard({ cams }: { cams: (keyof typeof CAM)[] }) {
  return (
    <figure className={`pixcard n${cams.length}`} data-in="0.5">
      <figcaption><span>Illustration</span>The same fires, seen by {cams.length > 1 ? "both cameras" : "one camera"}</figcaption>
      <div className="patches">{cams.map((c, i) => <Patch key={c} cam={c} lit={0.4 + i * 0.8} />)}</div>
    </figure>
  );
}

// ---------- the jump: raw counts against the harmonized record, one area, per year ----------
const X0 = 60, X1 = 900, Y0 = 380, Y1 = 24;
const LAUNCH: [string, string][] = [["VIIRS_SNPP", "VIIRS arrives"], ["VIIRS_NOAA20", "NOAA-20"], ["VIIRS_NOAA21", "NOAA-21"]];

function annual(m: Block) {
  const by = new Map<number, { r: number; h: number; n: number }>();
  m.periods.forEach((p, i) => {
    if (m.partial[i]) return;
    const y = +p.slice(0, 4), o = by.get(y) ?? { r: 0, h: 0, n: 0 };
    o.r += m.raw.all_det[i] ?? 0; o.h += m.classes.veg.hotspots.v[i] ?? 0; o.n++;
    by.set(y, o);
  });
  const ys = [...by].filter(([, o]) => o.n === 12).sort((a, b) => a[0] - b[0]);
  const base = ys.filter(([y]) => y >= 2003 && y <= 2011); // MODIS-only years, both Terra and Aqua flying
  const br = base.reduce((a, [, o]) => a + o.r, 0) / base.length, bh = base.reduce((a, [, o]) => a + o.h, 0) / base.length;
  return ys.map(([y, o]) => ({ y, r: o.r / br, h: o.h / bh }));
}

export function JumpChart({ m, meta, fixBeat }: { m: Block | null; meta: Meta | null; fixBeat: number }) {
  const rows = useMemo(() => (m ? annual(m) : []), [m]);
  const ya = rows[0]?.y ?? 2001, yb = rows[rows.length - 1]?.y ?? 2025;
  const top = Math.max(2, ...rows.map((r) => r.r)) * 1.08;
  const x = (y: number) => X0 + ((y - ya) / Math.max(1, yb - ya)) * (X1 - X0), y = (v: number) => Y0 - (v / top) * (Y0 - Y1);
  const path = (k: "r" | "h") => rows.map((r, i) => `${i ? "L" : "M"}${x(r.y).toFixed(1)},${y(r[k]).toFixed(1)}`).join("");
  const ticks = [1, ...[5, 10, 15, 20].filter((t) => t < top)];
  const last = rows[rows.length - 1];
  return (
    <figure className="chartcard jumpc">
      <svg viewBox="0 0 1000 420" aria-hidden>
        {ticks.map((t) => <g key={t} className={`tick ${t === 1 ? "one" : ""}`}><line x1={X0} x2={X1} y1={y(t)} y2={y(t)} /><text x={X0 - 12} y={y(t) + 5}>×{t}</text></g>)}
        {[2005, 2010, 2015, 2020, 2025].filter((v) => v >= ya && v <= yb).map((v) => <text key={v} className="yr" x={x(v)} y={Y0 + 30}>{v}</text>)}
        {LAUNCH.map(([k, l], i) => {
          const p = meta?.steps[k]?.period, yy = p ? +p.slice(0, 4) + (+p.slice(5, 7) - 1) / 12 : 0;
          return (
            <g key={k} className={`mk ${i ? "" : "main"}`} data-in={0.9 + i * 0.15}>
              {p && <><line x1={x(yy)} x2={x(yy)} y1={Y1} y2={Y0} /><text x={x(yy) + 8} y={Y1 + 16 + i * 22}>{l}</text></>}
            </g>
          );
        })}
        <path className="ln raw" pathLength={1} d={path("r") || "M0,0"} data-draw="0.2" data-dur="1.5" />
        {/* the calibrated line belongs to the next beat (data-b), where CSS also dims the raw one */}
        <g data-b={fixBeat} data-in="0.1"><path className="ln harm" pathLength={1} d={path("h") || "M0,0"} data-draw="0" data-dur="1.5" /></g>
        <g className="end raw" data-b={fixBeat - 1} data-in="1.5">{last && <text x={x(last.y) + 10} y={y(last.r) + 5}>Raw count</text>}</g>
        <g className="end harm" data-b={fixBeat} data-in="1.3">{last && <text x={x(last.y) + 10} y={y(last.h) + 5}>Kiln Watch</text>}</g>
      </svg>
      <figcaption>{meta?.name ?? "…"} · hotspots per year · average of 2003–2011 = ×1</figcaption>
    </figure>
  );
}

// ---------- validation: MODIS switched off after 2016, rebuilt from VIIRS ----------
export function ValidateChart({ meta }: { meta: Meta | null }) {
  const s = meta?.denial.modis_ends_2016.series;
  const n = s?.periods.length ?? 0;
  const vals = s ? [...s.aqua, ...s.predicted].filter((v): v is number => v !== null) : [];
  const top = Math.max(1, ...vals) * 1.1;
  const x = (i: number) => X0 + (i / Math.max(1, n - 1)) * (X1 - X0), y = (v: number) => Y0 - (Math.min(v, top) / top) * (Y0 - Y1);
  const line = (vs: (number | null)[]) => vs.map((v, i) => (v === null ? "" : `${i && vs[i - 1] !== null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join("");
  const band = s ? `${s.hi.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v ?? 0).toFixed(1)}`).join("")}${s.lo.map((v, i) => `L${x(n - 1 - i).toFixed(1)},${y(s.lo[n - 1 - i] ?? 0).toFixed(1)}`).join("")}Z` : "M0,0";
  const years = s ? s.periods.map((p, i) => [p, i] as const).filter(([p]) => p.endsWith("-01")) : [];
  return (
    <figure className="chartcard valc">
      <svg viewBox="0 0 1000 420" aria-hidden>
        <line className="base" x1={X0} x2={X1} y1={Y0} y2={Y0} />
        {years.map(([p, i]) => <text key={p} className="yr" x={x(i)} y={Y0 + 30}>{p.slice(0, 4)}</text>)}
        <g data-in="1.8"><path className="band" d={band} /></g>
        <path className="ln truth" pathLength={1} d={(s && line(s.aqua)) || "M0,0"} data-draw="0.2" data-dur="1.3" />
        <path className="ln harm" pathLength={1} d={(s && line(s.predicted)) || "M0,0"} data-draw="0.9" data-dur="1.3" />
      </svg>
      <figcaption><span className="k truth">What MODIS really saw</span><span className="k harm">Our rebuild, from VIIRS only</span></figcaption>
    </figure>
  );
}
