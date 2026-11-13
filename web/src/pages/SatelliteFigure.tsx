import { useEffect, useRef } from "react";
import * as k from "../lib/iso-kit";

// "Fig 1": Aqua, the reference satellite, drawn with the Anatomy iso-kit (github.com/wheresryan22/anatomy, MIT) as a
// real machine on an integration stand that comes apart when you move across it. A simplified drawing, not to scale.
// Nothing here is a result: every statistic on the site comes from the pipeline.

type V3 = [number, number, number];
type B = [number, number, number, number, number, number]; // x0 y0 z0 x1 y1 z1
type Spec = { id: string; layer: number; b: B; to: V3; build: (K: Kit) => string };
type Kit = ReturnType<typeof kit>;

const W = 640, H = 400;
const PLATE = { x: -74, y: -62, w: 156, d: 124, r: 8 }, PLATE_H = 10, FOOT_H = 5;
const box = (p: { x: number; y: number; w: number; d: number }, z: number, h: number): B => [p.x, p.y, z, p.x + p.w, p.y + p.d, z + h];
const cyl = (cx: number, cy: number, r: number, z: number, h: number): B => [cx - r, cy - r, z, cx + r, cy + r, z + h];
const mid = (b: B): V3 => [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2];

const POSTS: [number, number][] = [[-40, -26], [40, -26], [-40, 26], [40, 26]];
const MODIS = { x: -32, y: -24, w: 64, d: 48, r: 2 };
const BUS_L = { x: -50, y: -34, w: 100, d: 68, r: 3 };
const BUS_U = { x: -46, y: -30, w: 92, d: 60, r: 3 };
const E1 = { x: -34, y: -22, w: 30, d: 20, r: 2 }, E2 = { x: 4, y: -22, w: 26, d: 20, r: 2 }, E3 = { x: -12, y: 6, w: 34, d: 18, r: 2 };
const MAST: [number, number] = [-38, 14];
const STAR = [{ x: 33, y: 8, w: 12, d: 12, r: 2 }, { x: 33, y: -20, w: 12, d: 12, r: 2 }];
const YOKE = { x: 46, y: -4, w: 32, d: 8, r: 2 };
const SEG = (i: number) => ({ x: 90 + i * 40, y: -48, w: 38, d: 96, r: 1.5 });

// kit() binds the drawing helpers to one projection
function kit(P: k.Projection) {
  return {
    P,
    at: (p: V3) => k.iso(p, P),
    S: (paths: k.SolidPaths, style?: k.SolidStyle) => k.solidSvg(paths, style),
    L: (d: string, style?: k.LineStyle) => k.lineSvg(d, style),
    D: (pts: k.Flat[], style?: { size?: number; tone?: k.Tone }) => k.dotsSvg(pts, style),
  };
}

const SPECS: Spec[] = [
  ...POSTS.map(([px, py], i): Spec => ({
    id: `post${i}`, layer: 0, b: cyl(px, py, 5.6, 0, 40), to: [0, 0, 0],
    build: ({ P, S, L }) => S(k.cylinder(px, py, 5.6, 0, 2, P, 24), { tone: "lo" })
      + S(k.cylinder(px, py, 4, 2, 36, P, 24), { tone: "mid", crease: "none" })
      + S(k.cylinder(px, py, 5.4, 38, 2, P, 24), { tone: "mid" })
      + L(k.sideArc(px, py, 4, 20, P, 12), { tone: "faint" }),
  })),
  { id: "aperture", layer: 1, b: cyl(0, 0, 13, 12, 10), to: [0, 0, 6],
    build: ({ P, S, L }) => S(k.cylinder(0, 0, 13, 12, 10, P, 40), { tone: "mid" })
      + L(k.knurl(0, 0, 13, 12.8, 21.2, 30, P), { tone: "lo" }) + L(k.sideArc(0, 0, 13, 17, P, 24), { tone: "faint" }) },
  { id: "modis", layer: 2, b: box(MODIS, 22, 18), to: [0, 0, 22],
    build: ({ P, S, L, D, at }) => {
      const out = [S(k.slabOf(MODIS, 22, 18, P, 3, 0.8), { tone: "hi", lit: true, crease: "lo" })];
      out.push(L(k.planOutline(k.insetPlan(MODIS, 3), 40, P, 3), { tone: "faint" }));
      for (let i = 0; i < 6; i++) out.push(L(k.planOutline({ x: -17 + i * 6.8, y: -10, w: 2.4, d: 20, r: 1.2 }, 40, P, 3), { tone: "lo" }));
      out.push(L(k.sideSeam(MODIS, 31, P, 3), { tone: "faint" }));
      out.push(D(k.corners(MODIS, 6).map(([x, y]) => at([x, y, 40])), { size: 0.5 }));
      return out.join("");
    } },
  { id: "bus-l", layer: 3, b: box(BUS_L, 40, 30), to: [0, 0, 38],
    build: ({ P, S, L, D, at }) => S(k.slabOf(BUS_L, 40, 30, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(BUS_L, 55, P, 4), { tone: "faint" }) })
      + L(k.planOutline(k.insetPlan(BUS_L, 3), 70, P, 4), { tone: "faint" })
      + D(k.corners(BUS_L, 5).map(([x, y]) => at([x, y, 70])), { size: 0.5 }) },
  ...[0, 1, 2].map((i): Spec => {
    const p = { x: -44 + i * 30, y: 34, w: 26, d: 1.8, r: 0.8 };
    return { id: `rad${i}`, layer: 3, b: box(p, 46, 18), to: [(i - 1) * 6, 30, 38],
      build: ({ P, S, L }) => S(k.slabOf(p, 46, 18, P, 2, 0), { tone: "lo", crease: "none" }) + [0, 1, 2, 3].map((j) => L(k.rise([p.x + 4 + j * 6, p.y + p.d], 49, 61, P), { tone: "faint" })).join("") };
  }),
  { id: "bus-u", layer: 4, b: box(BUS_U, 70, 26), to: [0, 0, 58],
    build: ({ P, S, L, D, at }) => S(k.slabOf(BUS_U, 70, 26, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(BUS_U, 83, P, 4), { tone: "faint" }) })
      + L(k.planOutline(k.insetPlan(BUS_U, 3), 96, P, 4), { tone: "faint" })
      + D(k.corners(BUS_U, 5).map(([x, y]) => at([x, y, 96])), { size: 0.5 }) },
  { id: "yoke", layer: 4, b: box(YOKE, 78, 6), to: [6, 0, 58],
    build: ({ P, S, D, at }) => S(k.slabOf(YOKE, 78, 6, P, 3, 0.4), { tone: "mid" }) + D([at([YOKE.x + 5, 0, 84]), at([YOKE.x + YOKE.w - 5, 0, 84])], { size: 0.45 }) },
  { id: "drive", layer: 4, b: cyl(82, 0, 6, 72, 18), to: [12, 0, 58],
    build: ({ P, S, L }) => S(k.cylinder(82, 0, 6, 72, 18, P, 28), { tone: "mid" }) + L(k.knurl(82, 0, 6, 73, 87, 20, P), { tone: "lo" }) + L(k.ring(82, 0, 3.4, 90, P, 20), { tone: "lo" }) },
  ...[0, 1, 2].flatMap((i): Spec[] => {
    const s = SEG(i);
    const seg: Spec = { id: `seg${i}`, layer: 4, b: box(s, 79, 3.5), to: [20 + i * 16, 0, 58],
      build: ({ P, S, L, D, at }) => {
        const out = [S(k.slabOf(s, 79, 3.5, P, 3, 0.3), { tone: "mid", crease: "lo" })];
        out.push(L(k.planOutline(k.insetPlan(s, 2), 82.5, P, 3), { tone: "faint" }));
        for (let j = 1; j < 8; j++) out.push(L(k.lineOnTop([s.x + 2, s.y + j * 12], [s.x + s.w - 2, s.y + j * 12], 82.5, P), { tone: "faint" }));
        for (let j = 1; j < 5; j++) out.push(L(k.lineOnTop([s.x + (s.w / 5) * j, s.y + 2], [s.x + (s.w / 5) * j, s.y + s.d - 2], 82.5, P), { tone: "faint" }));
        out.push(D([at([s.x + 4, s.y + 4, 82.5]), at([s.x + s.w - 4, s.y + 4, 82.5]), at([s.x + 4, s.y + s.d - 4, 82.5]), at([s.x + s.w - 4, s.y + s.d - 4, 82.5])], { size: 0.45 }));
        return out.join("");
      } };
    if (i === 2) return [seg];
    const hinge = { x: s.x + s.w, y: -44, w: 2, d: 88, r: 0.5 };
    return [seg, { id: `hinge${i}`, layer: 4, b: box(hinge, 79.4, 2.6), to: [28 + i * 16, 0, 58], build: ({ P, S }) => S(k.slabOf(hinge, 79.4, 2.6, P, 2, 0), { tone: "lo", crease: "none" }) }];
  }),
  ...[E1, E2, E3].map((e, i): Spec => ({
    id: `elec${i}`, layer: 5, b: box(e, 96, 11), to: [[-12, -10, 80], [12, -10, 80], [0, 12, 80]][i] as V3,
    build: ({ P, S, L, D, at }) => S(k.slabOf(e, 96, 11, P, 3, 0.6), { tone: "hi", crease: "lo" })
      + L(k.planOutline(k.insetPlan(e, 3), 107, P, 3), { tone: "faint" })
      + D(k.corners(e, 5).map(([x, y]) => at([x, y, 107])), { size: 0.45 })
      + S(k.cylinder(e.x + e.w - 6, e.y + e.d - 6, 1.6, 107, 2.2, P, 12), { tone: "lo", crease: "none" }),
  })),
  { id: "mast", layer: 5, b: cyl(MAST[0], MAST[1], 3, 96, 28), to: [0, 0, 98],
    build: ({ P, S, L }) => S(k.cylinder(MAST[0], MAST[1], 3, 96, 28, P, 18), { tone: "mid", crease: "none" }) + L(k.sideArc(MAST[0], MAST[1], 3, 110, P, 12), { tone: "faint" }) },
  { id: "dish", layer: 6, b: cyl(MAST[0], MAST[1], 15, 124, 11), to: [0, 0, 98],
    build: ({ P, S, L }) => S(k.cylinder(MAST[0], MAST[1], 15, 124, 2.4, P, 44), { tone: "hi", crease: "lo" })
      + L(k.ring(MAST[0], MAST[1], 11, 126.4, P, 40), { tone: "lo" }) + L(k.ring(MAST[0], MAST[1], 6, 126.4, P, 28), { tone: "faint" })
      + S(k.cylinder(MAST[0], MAST[1], 1.8, 126.4, 8.6, P, 12), { tone: "mid", crease: "none" }) },
  ...STAR.map((s, i): Spec => ({
    id: `star${i}`, layer: 5, b: box(s, 96, 18), to: [16, i ? -10 : 10, 82],
    build: ({ P, S, L, D, at }) => {
      const cx = s.x + s.w / 2, cy = s.y + s.d / 2;
      return S(k.slabOf(s, 96, 6, P, 3, 0.3), { tone: "mid" }) + S(k.cylinder(cx, cy, 4.6, 102, 12, P, 20), { tone: "lo" })
        + L(k.ring(cx, cy, 3.2, 114, P, 16), { tone: "mid" }) + D([at([cx, cy, 114])], { size: 0.5, tone: "mid" });
    },
  })),
];

const REST: V3 = [0, 0, 0];
const pts = (b: B, o: V3): V3[] => [b[0], b[3]].flatMap((x) => [b[1], b[4]].flatMap((y) => [b[2], b[5]].map((z): V3 => [x + o[0], y + o[1], z + o[2]])));
const P = k.fitProjection([
  ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
  ...SPECS.flatMap((s) => [...pts(s.b, REST), ...pts(s.b, s.to)]),
], W, H, { pad: 18, azimuth: 56, elevation: 30 });
const K = kit(P);

function stand() {
  const { S, L, D, at } = K;
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const byDepth = (a: [number, number][]) => [...a].sort((p, q) => k.depthOf([p[0], p[1], 0], P) - k.depthOf([q[0], q[1], 0], P));
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const strip = { x: -62, y: PLATE.y + PLATE.d - 15, w: 132, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  return out.join("");
}

const LABEL = "Aqua, a simplified drawing on an integration stand: a two-stage satellite bus with the MODIS instrument underneath, electronics, a dish and star trackers on top, and a three-panel solar array on one side. It comes apart as you move across it.";
const SVG = k.figureSvg({
  width: W, height: H, label: LABEL,
  body: [stand(), ...SPECS.map((s, i) => `<g data-item="${i}">${s.build(K)}</g>`)],
});
const HTML = k.plateHtml({
  fig: "Fig 1", title: "Aqua", hint: "Move across to take it apart", readout: "assembled",
  keys: [{ mark: "lit", label: "MODIS instrument: the one every other satellite is calibrated to" }, { mark: "raised", label: "Everything else carries, powers or points it" }],
  caption: "Aqua, the reference satellite of the record, on an integration stand. A simplified drawing, not to scale. The numbers on this site come from the data pipeline, not from this picture.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Aqua: arrow keys take the satellite apart" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">${SVG}</div>`,
});

const smooth = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
const KEY_OF = (s: Spec, e: number): number => {
  const o = s.to, c = mid(s.b);
  return s.layer * 1e5 + k.depthOf([c[0] + o[0] * e, c[1] + o[1] * e, c[2] + o[2] * e], P);
};

export default function SatelliteFigure() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = host.current!, stage = root.querySelector<HTMLElement>(".iso-stage")!, svg = stage.querySelector("svg")!;
    const readout = root.querySelector<HTMLElement>("[data-readout]")!;
    const items = [...svg.querySelectorAll<SVGGElement>("[data-item]")];
    const calm = matchMedia("(prefers-reduced-motion: reduce)");
    let e = 0, target = 0, touring = !calm.matches, clock = 0, last = 0, frame = 0, visible = false, idle = 0, order = "";
    const tour = (t: number) => { const p = (t % 10) / 10; return p < 0.15 ? 0 : p < 0.5 ? smooth((p - 0.15) / 0.35) : p < 0.7 ? 1 : 1 - smooth((p - 0.7) / 0.3); };
    const draw = () => {
      const x = smooth(e);
      const keyed = SPECS.map((s, i) => ({ i, key: KEY_OF(s, x) })).sort((a, b) => a.key - b.key);
      const sig = keyed.map((q) => q.i).join();
      if (sig !== order) { order = sig; for (const q of keyed) svg.appendChild(items[q.i]); }
      SPECS.forEach((s, i) => items[i].setAttribute("transform", k.translateAlong(P, [s.to[0] * x, s.to[1] * x, s.to[2] * x])));
      const text = e < 0.03 ? "assembled" : e > 0.97 ? "apart" : `apart ${Math.round(e * 100)}%`;
      if (readout.textContent !== text) readout.textContent = text;
      stage.setAttribute("aria-valuenow", String(Math.round(e * 100)));
    };
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      if (touring) { clock += dt; target = tour(clock); }
      e = calm.matches ? target : e + (target - e) * (1 - Math.exp(-dt / 0.22));
      if (Math.abs(target - e) < 0.0005) e = target;
      draw();
      frame = visible && (touring || e !== target) ? requestAnimationFrame(tick) : 0;
    };
    const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
    const steer = (v: number) => { touring = false; target = Math.min(1, Math.max(0, v)); clearTimeout(idle); idle = window.setTimeout(() => { touring = !calm.matches; clock = 0.1; run(); }, 4200); run(); };
    const io = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" });
    io.observe(stage);
    const move = (ev: PointerEvent) => { const r = svg.getBoundingClientRect(); steer(((ev.clientX - r.left) / r.width - 0.12) / 0.7); };
    const leave = () => steer(target);
    const key = (ev: KeyboardEvent) => {
      const v = ev.key === "ArrowRight" || ev.key === "ArrowUp" ? target + 0.25 : ev.key === "ArrowLeft" || ev.key === "ArrowDown" ? target - 0.25 : ev.key === "Home" ? 0 : ev.key === "End" ? 1 : null;
      if (v === null) return;
      ev.preventDefault();
      steer(v);
    };
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerleave", leave);
    stage.addEventListener("keydown", key);
    draw();
    return () => { io.disconnect(); cancelAnimationFrame(frame); clearTimeout(idle); stage.removeEventListener("pointermove", move); stage.removeEventListener("pointerleave", leave); stage.removeEventListener("keydown", key); };
  }, []);
  return (
    <div className="iso sat" data-theme="dark" ref={host}>
      <style>{k.ISO_CSS}</style>
      <div dangerouslySetInnerHTML={{ __html: HTML }} />
    </div>
  );
}
