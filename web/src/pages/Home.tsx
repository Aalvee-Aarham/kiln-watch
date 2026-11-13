import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Block, Events, Meta, api } from "../api";
import { AskScreen, ConsoleData, PastAlert, Phone, WarnScreen } from "./ConsoleScreens";
import { JumpChart, PixelCard, ValidateChart } from "./StoryCharts";
import { BEATS, mountScene, SceneHandle } from "./scene";
import { mountStory, Story } from "./story";
import { Page, PageProps } from "./shared";
import "./home.css";

// Cinematic landing page: a deck of beats (story.ts) over one 3D scene (scene.ts). Beat i shows keyframe i of
// scene.ts, so the order of B below must match the KF order there.
// Every number here is read from the pipeline's meta.json files; nothing is typed in.
const B = { hero: 0, problem: 1, challenge: 2, solution: 3, impact: 4, old: 5, sharp: 6, jump: 7, fix: 8, proof: 9,
  console: 10, explore: 11, warn: 12, ask: 13, news: 14, connect: 15, go: 16 };
const LAST = BEATS - 1;
console.assert(B.go === LAST, "Home.tsx beats and scene.ts keyframes are out of step");

// scroll per beat, in screen heights: short, so the story moves quickly (story.ts glides on to whole beats)
const STEP = 0.8;

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null;
};
const fx = (v: number | null | undefined, d = 2) => (num(v) ? v.toFixed(d) : "…");

function summarize(ms: Meta[]) {
  const first = (k: string) => ms.map((m) => m.sensors[k]?.first).filter(Boolean).sort()[0];
  const through = ms.map((m) => m.data_through).sort().pop()!;
  const step = (f: "raw_all_sensors_excess" | "harmonized_excess") => median(ms.map((m) => m.steps.VIIRS_SNPP?.[f]).filter(num));
  const den = ms.map((m) => m.denial.modis_ends_2016).filter((d) => num(d?.ours_seasonal_eb.spearman));
  return {
    statics: ms.reduce((a, m) => a + m.totals.static_detections, 0),
    areas: ms.length,
    sats: new Set(ms.flatMap((m) => Object.keys(m.sensors)).filter((k) => k !== "MODIS")).size,
    since: first("MODIS"), through, snpp: first("VIIRS_SNPP"),
    raw: step("raw_all_sensors_excess"), harm: step("harmonized_excess"),
    nStep: ms.filter((m) => num(m.steps.VIIRS_SNPP?.harmonized_excess)).length,
    rho: median(den.map((d) => d.ours_seasonal_eb.spearman as number)), rhoN: den[0]?.n, rhoTest: den[0]?.test,
  };
}

const firstYear = (ms: Meta[], k: string) => ms.map((m) => m.sensors[k]?.first).filter(Boolean).sort()[0]?.slice(0, 4);

/** Big numbers count up the first time they scroll into view. */
function countUp(root: HTMLElement, scroller: HTMLElement) {
  const ctx = gsap.context(() => {
    root.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
      const v = +el.dataset.count!, dec = +(el.dataset.dec ?? 0);
      const f = (x: number) => x.toLocaleString("en", { minimumFractionDigits: dec, maximumFractionDigits: dec });
      const o = { v: 0 };
      el.textContent = f(0);
      gsap.to(o, { v, duration: 2, ease: "power3.out", onUpdate: () => { el.textContent = f(o.v); },
        scrollTrigger: { trigger: el, scroller, start: "top 90%", once: true } });
    });
  }, root);
  ScrollTrigger.refresh();
  return () => ctx.revert();
}

const Count = ({ v, dec = 0 }: { v: number | null | undefined; dec?: number }) =>
  num(v) ? <span data-count={v} data-dec={dec}>{v.toLocaleString("en", { minimumFractionDigits: dec, maximumFractionDigits: dec })}</span> : <span>…</span>;

/** Words that rise out of their own mask when their beat arrives (story.ts animates `.w > span`). Keep the word count
 *  the same between renders: story.ts wires the spans once. */
const W = ({ children }: { children: string }) => (
  <>{children.split(" ").map((w, i) => <Fragment key={i}>{i > 0 && " "}<span className="w"><span>{w}</span></span></Fragment>)}</>
);
const H = ({ lines, tag: T = "h2", cls = "", at = 0 }: { lines: string[]; tag?: "h1" | "h2"; cls?: string; at?: number }) => (
  <T className={`h3d-h ${cls}`} data-in={at}>{lines.map((l) => <span className="ln" key={l}><W>{l}</W></span>)}</T>
);

const Flame = () => (
  <svg viewBox="0 0 32 32" aria-hidden><path d="M16 4c2.2 5.4 7.5 7.6 7.5 14a7.5 7.5 0 0 1-15 0c0-3.3 2.1-5.4 3.2-7.5 1.1 3.2 2.2 4.3 4.3 4.3C15 10.5 15 7.3 16 4z" fill="#EA7329" /><path d="M16 17c1 2.2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.6 1-2.6 1.6-3.5.4 1.2.9 1.6 1.4 1.6-.4-1.2-.4-2.4 0-3.6z" fill="#F6C64F" /></svg>
);
const Arrow = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M6 18 18 6M8 6h10v10" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;

// progress bar: groups of chapters, each chapter = label + the beats it spans. Only the active group shows its labels;
// finished and upcoming groups shrink to squares. Click a chapter to jump there.
const GROUPS: [string, number[]][][] = [
  [["Problem", [B.problem]], ["Challenge", [B.challenge]], ["Solution", [B.solution]], ["Impact", [B.impact]]],
  [["Old camera", [B.old]], ["New camera", [B.sharp]], ["The jump", [B.jump]], ["The fix", [B.fix]], ["The proof", [B.proof]]],
  [["Explore", [B.console, B.explore]], ["Warn", [B.warn]], ["Ask", [B.ask]]],
  [["News", [B.news]], ["Connect", [B.connect]]],
];
const CHAPTERS = GROUPS.flatMap((g, gi) => g.map(([l, ks]) => ({ l, ks, gi })));
const GROUP_FROM = GROUPS.map((g) => g[0][1][0]);

const WHO: [string, string, Page][] = [
  ["Fire and land managers", "Is this month burning more than usual here? Checked against every year since 2000.", "warning"],
  ["Researchers", "A 2000-to-today record without the jump at each satellite launch, with uncertainty beside every number.", "method"],
  ["Journalists and NGOs", "Reports from the ground next to what the satellites saw, month by month.", "news"],
  ["Air-quality watchers", "Brick kilns, gas flares and industry kept apart from vegetation fires.", "explore"],
  ["Developers and AI agents", "The same tools over a REST API, an MCP server and n8n workflows.", "mcp"],
];

// the five satellites, in scene.ts ORBITS order
const SATS = [["Terra", "MODIS", "MODIS_T"], ["Aqua", "MODIS", "MODIS_A"], ["Suomi NPP", "VIIRS", "VIIRS_SNPP"], ["NOAA-20", "VIIRS", "VIIRS_NOAA20"], ["NOAA-21", "VIIRS", "VIIRS_NOAA21"]];

// console stage 1: a real capture of the Explorer (web/public/shots), callouts placed in % of the screen.
// Stages 2 and 3 are live animated screens (ConsoleScreens.tsx).
const EXPLORE_TAGS: [string, number, number][] = [["Every hotspot, every day", 50, 49], ["Built areas, one click", 84, 34], ["Five satellites, one timeline", 46, 93]];

export default function Home({ regions, go, openRegion }: PageProps) {
  const scroller = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), bar = useRef<HTMLDivElement>(null);
  const consoleSec = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneHandle | null>(null), story = useRef<Story | null>(null);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [events, setEvents] = useState<Events | null>(null);
  const [stage, setStage] = useState(-1); // console screen playing: 0 explore, 1 early warning, 2 analyst
  const [cdata, setCdata] = useState<ConsoleData | null>(null);
  const [area, setArea] = useState<{ meta: Meta; monthly: Block } | null>(null); // the area the story charts show
  const presets = useMemo(() => regions.filter((r) => r.preset), [regions]);

  useEffect(() => {
    const root = scroller.current!, sec = consoleSec.current!;
    // the console: one screen floats over the globe and swings between explore, warn and ask
    const frame = sec.querySelector<HTMLElement>(".frame")!, shots = sec.querySelectorAll<HTMLElement>(".frame > .scr");
    const tags = sec.querySelectorAll<HTMLElement>(".ptag"), phone = sec.querySelector<HTMLElement>(".phone")!;
    const vw = (v: number) => (innerWidth < 900 ? 0 : (innerWidth * v) / 100); // phones: no sideways swing, the screen is full width
    const pose = (b: number) => b < B.explore ? { autoAlpha: 0, rotateX: 58, rotateY: 0, x: 0, yPercent: 55, z: -500, scale: 0.8 } // waiting below
      : b > B.ask ? { autoAlpha: 0, rotateX: -16, rotateY: 0, x: 0, yPercent: -28, z: 0, scale: 1 } // gone above
      : { autoAlpha: 1, yPercent: 0, z: 0, scale: 1, ...[{ rotateX: 9, rotateY: -17, x: vw(14) }, { rotateX: 7, rotateY: 16, x: vw(-14) }, { rotateX: 4, rotateY: 12, x: vw(-12) }][b - B.explore] };
    let play: gsap.core.Tween | undefined;
    const ctx = gsap.context(() => {
      gsap.set(frame, pose(0));
      gsap.set(shots, { autoAlpha: (i) => (i ? 0 : 1) });
      gsap.set(tags, { autoAlpha: 0, y: 10 });
      gsap.set(phone, { autoAlpha: 0, yPercent: 60, rotate: 10, scale: 0.85 });
    }, sec);
    const d = 0.9; // seconds for the console screen to swing to its next pose
    const onBeat = (to: number) => {
      root.classList.toggle("fin", to === LAST);
      const st = to - B.explore;
      ctx.add(() => {
        gsap.to(frame, { ...pose(to), duration: d, ease: "power3.inOut", overwrite: true });
        shots.forEach((s, i) => i && gsap.to(s, { autoAlpha: st >= i ? 1 : 0, duration: 0.4, delay: d * 0.4, overwrite: true }));
        gsap.to(tags, { autoAlpha: st ? 0 : 1, y: st ? 10 : 0, duration: 0.4, stagger: st ? 0 : 0.12, delay: st ? 0 : d + 0.1, overwrite: true });
        gsap.to(phone, st === 1 ? { autoAlpha: 1, yPercent: 0, rotate: -6, scale: 1, duration: 0.7, ease: "back.out(1.4)", delay: d * 0.7, overwrite: true }
          : { autoAlpha: 0, yPercent: 40, rotate: 4, scale: 0.85, duration: 0.3, ease: "power2.in", overwrite: true });
      });
      play?.kill();
      setStage(-1); // the screens replay each time their beat arrives
      if (st >= 0 && st <= 2) play = gsap.delayedCall(d * 0.6, () => setStage(st));
    };
    const onPlayhead = (p: number) => {
      const b = bar.current;
      if (!b) return;
      b.classList.toggle("on", p > 0.5 && p < LAST - 0.5);
      let active = 0;
      GROUP_FROM.forEach((k, gi) => { if (p > k - 0.5) active = gi; }); // a group takes over as its first beat arrives
      CHAPTERS.forEach(({ ks, gi }, i) => {
        const el = b.children[i] as HTMLElement, f = Math.min(1, Math.max(0, (p - (ks[0] - 1)) / ks.length));
        el.style.setProperty("--f", `${f * 100}%`);
        el.classList.toggle("wide", gi === active);
      });
    };
    const st = mountStory(root, content.current!, { beats: BEATS, onBeat, onPlayhead });
    const h = mountScene(canvas.current!, root, st.ph, () => { root.classList.add("ready"); st.start(); });
    story.current = st;
    scene.current = h;
    return () => { h.dispose(); st.dispose(); play?.kill(); ctx.revert(); root.className = "h3d"; scene.current = story.current = null; };
  }, []);

  // the console demo area: the scored area with the most activity usually due in the next four weeks (real data, picked by rule)
  useEffect(() => {
    let live = true;
    api.warnings().then(async (ws) => {
      const row = ws.alerts.filter((a) => a.level !== "insufficient").sort((a, b) => (b.next_4_weeks_median ?? 0) - (a.next_4_weeks_median ?? 0))[0];
      if (!row) return;
      const [w, m] = await Promise.all([api.warning(row.region_id), api.meta(row.region_id)]);
      if (live && w.month && m.current) setCdata({ w, prior: m.current.prior, sentence: m.current.sentence });
    }).catch(() => undefined);
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    api.events().then((e) => { if (!live) return; setEvents(e); scene.current?.setEvents(e.events.filter((x) => Number.isFinite(x.lon) && Number.isFinite(x.lat))); }).catch(() => undefined);
    return () => { live = false; };
  }, []);

  useEffect(() => {
    scene.current?.setPins(presets.map((r) => ({ lon: (r.bbox[0] + r.bbox[2]) / 2, lat: (r.bbox[1] + r.bbox[3]) / 2 })));
    if (!presets.length) return;
    let live = true;
    Promise.all(presets.map((r) => api.meta(r.id).catch(() => null))).then((ms) => live && setMetas(ms.filter((m): m is Meta => !!m)));
    return () => { live = false; };
  }, [presets]);

  // under the story the page scrolls: the fixed story chrome goes, the menu hides on the way down
  useEffect(() => {
    const el = scroller.current!;
    let last = 0;
    const track = el.querySelector<HTMLElement>(".h3d-story")!;
    const on = () => {
      const y = el.scrollTop;
      el.classList.toggle("end", y > track.offsetTop + track.offsetHeight - innerHeight * 0.65);
      if (y > 2) el.classList.toggle("nav-up", y > last && y > innerHeight * 0.6);
      last = y;
    };
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, []);

  // story area, picked by rule: the built area with the most detections
  useEffect(() => {
    if (!metas.length) return;
    const top = [...metas].sort((a, b) => b.totals.detections - a.totals.detections)[0];
    let live = true;
    api.monthly(top.id).then((monthly) => live && setArea({ meta: top, monthly })).catch(() => undefined);
    return () => { live = false; };
  }, [metas]);

  // the phone's replay: the story area's latest full month that the warning rule would rate elevated (percentile ≥ 90)
  const past = useMemo<PastAlert | null>(() => {
    if (!area) return null;
    const { periods, partial, classes } = area.monthly, h = classes.veg.history;
    for (let i = periods.length - 1; i >= 0; i--) {
      const pct = h.pct[i], ratio = h.ratio[i], rank = h.rank[i], n = h.n[i], med = h.median[i];
      if (!partial[i] && pct !== null && pct >= 90 && ratio !== null && rank !== null && n !== null && (med ?? 0) >= 5)
        return { name: area.meta.name, period: periods[i], ratio, rank, n };
    }
    return null;
  }, [area]);

  const s = useMemo(() => (metas.length ? summarize(metas) : null), [metas]);
  const sm = area?.meta, snppStep = sm?.steps.VIIRS_SNPP, den = sm?.denial.modis_ends_2016;
  const y0 = s?.since?.slice(0, 4) ?? "2000", y1 = s?.snpp?.slice(0, 4) ?? "2012";
  useEffect(() => (s ? countUp(content.current!, scroller.current!) : undefined), [s]);

  return (
    <div className="h3d" ref={scroller}>{/* story.ts and the effects below toggle state classes on this node, so its className stays constant */}
      <canvas className="h3d-canvas" ref={canvas} aria-hidden />
      <div className="h3d-veil" aria-hidden />
      <div className="h3d-fade" aria-hidden />
      <div className="h3d-load" aria-hidden><span>Kiln Watch</span><i /></div>

      <header className="h3d-nav">
        <a className="brand" href="#" aria-label="Kiln Watch, back to the start" onClick={(e) => { e.preventDefault(); scroller.current?.scrollTo({ top: 0 }); story.current?.go(0); }}><Flame /><span>Kiln Watch</span></a>
        <nav aria-label="Pages">
          <button onClick={() => go("warning")}>Early warning</button>
          <button onClick={() => go("news")}>News</button>
          <button onClick={() => go("download")}>Data</button>
          <button onClick={() => go("method")}>Methodology</button>
          <button onClick={() => go("mcp")}>Connect</button>
        </nav>
        <button className="h3d-box" onClick={() => go("explore")}>Open Explorer <Arrow /></button>
      </header>

      <div className="h3d-bar" ref={bar}>
        {CHAPTERS.map(({ l, ks, gi }) => (
          <button key={l} className={gi ? "" : "wide"} aria-label={`Go to: ${l}`} onClick={() => story.current?.go(ks[0])}><span>{l}</span><i><span>{l}</span></i></button>
        ))}
      </div>
      <div className="h3d-tags" aria-hidden>
        {SATS.map(([n, inst, k]) => (
          <div key={n} data-sat className={inst === "MODIS" ? "modis" : ""}><i /><b>{n}</b><span>{inst}{firstYear(metas, k) ? ` · since ${firstYear(metas, k)}` : ""}</span></div>
        ))}
      </div>
      {/* the ring fills while a scene is still landing (story.ts); then the cue invites the next move */}
      <button className="h3d-cue" aria-label="Next scene" onClick={() => story.current?.next()}>
        <svg viewBox="0 0 36 36" aria-hidden><circle cx="18" cy="18" r="16" pathLength={1} /><path d="M12 16l6 6 6-6" /></svg>
        <span>Scroll</span>
      </button>
      <button className="h3d-cta" onClick={() => go("explore")}><span>Open the explorer</span><i><Arrow /></i></button>

      <div className="h3d-content" ref={content}>
        <section className="h3d-story" style={{ height: `${(LAST * STEP + 1) * 100}vh` }}>
          <div className="h3d-stage">
          {/* 0 · hero: the satellite drifts and scans; live NASA wildfire events glow on the globe */}
          <div className="h3d-beat hero" data-b={B.hero}>
            <div className="h3d-col">
              <p className="kicker" data-in>NASA Space Apps 2026 · Harmonization of MODIS and VIIRS Hot Spots</p>
              <H tag="h1" cls="xl" lines={["Every fire.", "One record."]} at={0.1} />
              <p className="h3d-lead big" data-in="0.6">NASA satellites have watched Earth's fires from space <em>since {y0}</em>. We turn their mismatched counts into <em>one record you can trust</em>.</p>
              <p className="firechip" data-in="0.9"><i /><b>{events?.count ?? "…"}</b> wildfires NASA is tracking right now</p>
            </div>
          </div>

          {/* 1-4 · the whole story in four sentences: problem, challenge, solution, impact */}
          <div className="h3d-beat" data-b={B.problem}>
            <div className="h3d-say">
              <p className="kicker f" data-in>The problem</p>
              <p className="st" data-in="0.1"><W>{`Satellites have counted Earth's fires since ${y0}. But`}</W> <em className="f"><W>newer cameras see more</W></em> <W>than older ones, so the numbers</W> <em className="f"><W>jump</W></em> <W>even when the fires don't.</W></p>
              <p className="h3d-legend" data-in="1.1"><span className="m"><i />Older camera · MODIS</span><span><i />Newer camera · VIIRS</span></p>
            </div>
          </div>
          <div className="h3d-beat" data-b={B.challenge}>
            <div className="h3d-say">
              <p className="kicker f" data-in>The challenge</p>
              <p className="st" data-in="0.1"><W>NASA's challenge: make old and new satellites</W> <em><W>agree</W></em><W>{`, so fire history since ${y0} can be`}</W> <em><W>compared with today.</W></em></p>
              <p className="note" data-in="1.1">NASA Space Apps 2026 · Harmonization of MODIS and VIIRS Hot Spots</p>
            </div>
          </div>
          <div className="h3d-beat" data-b={B.solution}>
            <div className="h3d-say">
              <p className="kicker" data-in>Our solution</p>
              <p className="st" data-in="0.1"><W>Kiln Watch measures how differently each satellite sees the</W> <em><W>same fires</W></em><W>, then converts all five to</W> <em><W>one scale.</W></em></p>
              <ol className="h3d-flow" data-in="1" data-lit="0.1">
                <li><b>{s?.sats ?? 5} satellites</b><span>spot the heat</span></li>
                <li><b>NASA FIRMS</b><span>shares every hotspot</span></li>
                <li className="us"><b>Kiln Watch</b><span>one scale</span></li>
                <li><b>You</b><span>map · alerts · AI</span></li>
              </ol>
            </div>
          </div>
          <div className="h3d-beat" data-b={B.impact}>
            <div className="h3d-say">
              <p className="kicker" data-in>The impact</p>
              <p className="st" data-in="0.1"><W>One trusted record for</W> <em><W>any place on Earth.</W></em> <W>Now anyone can ask: is this fire season</W> <em className="f"><W>normal?</W></em></p>
              <p className="note" data-in="1.1">For fire services, researchers, journalists, farmers and AI agents</p>
            </div>
          </div>

          {/* 5 · the older camera: Terra and Aqua assemble on the blueprint */}
          <div className="h3d-beat" data-b={B.old}>
            <div className="h3d-col narrow" data-in>
              <p className="idx">01 · The older camera</p>
              <p className="kicker">MODIS · on Terra and Aqua · since {y0}</p>
              <p className="h3d-title"><W>Sees the ground in</W> <em><W>1 km squares</W></em></p>
              <p className="h3d-line">A big fire lights a few squares. <em>Small fires can slip through.</em></p>
            </div>
            <PixelCard cams={["modis"]} />
          </div>

          {/* 6 · the sharper camera: Suomi NPP assembles */}
          <div className="h3d-beat" data-b={B.sharp}>
            <div className="h3d-col narrow" data-in>
              <p className="idx">02 · The sharper camera</p>
              <p className="kicker">VIIRS · on Suomi NPP, NOAA-20, NOAA-21 · since {y1}</p>
              <p className="h3d-title"><W>Sees</W> <em><W>375 m squares</W></em></p>
              <p className="h3d-line">The same fires on the same day: <em>far more dots</em>.</p>
            </div>
            <PixelCard cams={["modis", "viirs"]} />
          </div>

          {/* 7, 8 · the jump in the raw counts, then the calibrated record on the same chart */}
          <div className="h3d-beat h3d-plot" data-b={`${B.jump}-${B.fix}`}>
            <div className="beat" data-b={B.jump} data-in>
              <p className="idx">03 · The jump</p>
              <p className="h3d-big"><W>Counts jumped</W> <em className="f"><W>{`×${fx(snppStep?.raw_all_sensors_excess, 1)}`}</W></em></p>
              <p className="h3d-line">in {snppStep?.period.slice(0, 4) ?? y1}, more than the fires did. <em>A sharper camera had joined.</em></p>
            </div>
            <div className="beat" data-b={B.fix} data-in>
              <p className="idx">04 · The fix</p>
              <p className="h3d-big"><W>Now:</W> <em><W>{`×${fx(snppStep?.harmonized_excess)}`}</W></em></p>
              <p className="h3d-line">We measure how much more each camera sees and <em>convert</em> all five to one scale. Like converting currencies.</p>
              <p className="fine">1.00 means no jump. Median of {s?.nStep ?? "…"} areas: ×{fx(s?.raw)} raw, ×{fx(s?.harm)} calibrated.</p>
            </div>
            <div className="chartwrap" data-in="0.1"><JumpChart m={area?.monthly ?? null} meta={sm ?? null} fixBeat={B.fix} /></div>
          </div>

          {/* 9 · the proof: MODIS switched off on paper, rebuilt from VIIRS */}
          <div className="h3d-beat h3d-plot val" data-b={B.proof}>
            <div className="beat" data-in>
              <p className="idx">05 · The proof</p>
              <p className="h3d-big"><W>We</W> <em><W>tested</W></em> <W>it</W></p>
              <p className="h3d-line">We hid the older camera after 2016 and rebuilt its record from the newer one alone.</p>
            </div>
            <div className="score" data-in="1.4">
              <b>{fx(den?.ours_seasonal_eb.spearman)}</b>
              <span>match<br />1.00 = perfect</span>
              <p className="fine">Rank correlation, {den?.n ?? "…"} months {den ? `${den.test[0].slice(0, 4)}–${den.test[1].slice(0, 4)}` : ""}, {sm?.name ?? "…"}. Median of {s?.areas ?? "…"} areas: {fx(s?.rho)}.</p>
            </div>
            <div className="chartwrap" data-in="0.2"><ValidateChart meta={sm ?? null} /></div>
          </div>

          {/* 10-13 · the console: explore, warn, ask (the floating screen is driven from onBeat above) */}
          <div className="h3d-beat console" data-b={`${B.console}-${B.ask}`} ref={consoleSec}>
            <div className="c-head" data-b={B.console}>
              <p className="kicker" data-in>In your browser · no login</p>
              <H lines={["Fire record console"]} cls="xl" at={0.1} />
            </div>
            <div className="h3d-console" aria-hidden>
              <div className="frame">
                <img className="scr" src={`${import.meta.env.BASE_URL}shots/explore.jpg`} alt="" />
                <WarnScreen d={cdata} play={stage === 1} />
                <AskScreen d={cdata} play={stage === 2} />
                {EXPLORE_TAGS.map(([t, l, tp]) => <span key={t} className="ptag" style={{ left: `${l}%`, top: `${tp}%` }}><i />{t}</span>)}
                <b className="glass" />
              </div>
            </div>
            <Phone d={cdata} past={past} play={stage === 1} />
            <div className="c-say l" data-b={B.explore} data-in="0.3">
              <p className="kicker">01 · Explore</p>
              <p>Any place on Earth. <em>{y0} to today.</em> One scale.</p>
              <p className="who">For researchers and land managers</p>
            </div>
            <div className="c-say r cw" data-b={B.warn} data-in="0.3">
              <p className="kicker">02 · Early warning</p>
              <p>Burning <em className="f">more than usual</em>? Your phone hears first.</p>
              <p className="who">For fire services, NGOs and farmers. An outlook from past years, not a forecast.</p>
            </div>
            <div className="c-say r" data-b={B.ask} data-in="0.3">
              <p className="kicker">03 · AI analyst</p>
              <p>Ask in plain words. Answers from <em>real numbers</em>.</p>
              <p className="who">For anyone. It reads the data and never makes numbers up.</p>
            </div>
          </div>

          {/* 14 · news */}
          <div className="h3d-beat" data-b={B.news}>
            {/* cards exist from the start (story.ts wires [data-in] once); the live events fill them in */}
            <div className="newsfeed">
              <p className="livebar pop" data-in="0.2"><i />Live · NASA EONET <b>{events?.count ?? "…"}</b> open wildfire events</p>
              {[0, 1, 2, 3].map((i) => {
                const e = events?.events[i];
                return (
                  <a key={i} className="ncard pop" data-in={0.35 + i * 0.13} href={e?.url ?? undefined} target="_blank" rel="noreferrer">
                    <span className="src">NASA EONET · open event</span>
                    <b>{e?.title ?? "Loading the live feed…"}</b>
                    <span className="meta">{e ? `${e.date} · ${e.lat.toFixed(2)}°, ${e.lon.toFixed(2)}°` : ""}</span>
                  </a>
                );
              })}
            </div>
            <div className="h3d-col right big news-text">
              <H lines={["News,", "matched"]} cls="xl" />
              <div data-in="0.5">
                <p className="kicker under">NASA EONET · GDELT · ReliefWeb</p>
                <p className="h3d-lead">News reports sit <em>next to each month</em> of the record. No news never proves no fire.</p>
                <p className="who">For journalists and NGOs checking a claim against the satellites.</p>
                <button className="h3d-link" onClick={() => go("news")}>Open News <Arrow /></button>
              </div>
            </div>
          </div>

          {/* 15 · connect */}
          <div className="h3d-beat connect" data-b={B.connect}>
            <div className="h3d-col big">
              <H lines={["Plug in", "any agent"]} cls="xl" />
              <div data-in="0.5">
                <p className="kicker under">MCP · REST API · n8n</p>
                <p className="h3d-lead">Claude, Cursor or any AI agent asks Kiln Watch for <em>real numbers</em> instead of guessing.</p>
                <p className="who">For developers and data teams. n8n turns an alert into an email or a Slack message.</p>
                <button className="h3d-link" onClick={() => go("mcp")}>Connect <Arrow /></button>
              </div>
            </div>
            <div className="term" data-in="0.4">
              <p className="bar"><i /><i /><i /><span>claude_desktop_config.json</span></p>
              <pre>{`{
  "mcpServers": {
    "kiln-watch": {
      "command": "python",
      "args": ["-m", "kw.mcp_server"]
    }
  }
}`}</pre>
              <p className="tools"><span>tools</span>get_harmonized_calendar · get_early_warning · find_anomalies · search_fire_reports · create_alert · get_active_wildfire_events …</p>
            </div>
          </div>

          {/* 16 · the way in */}
          <div className="h3d-beat center" data-b={B.go}>
            <H lines={["Get your fire record today"]} cls="xl" at={0.2} />
            <button className="h3d-go" data-in="0.8" onClick={() => go("explore")}>Open the explorer</button>
          </div>
          </div>
        </section>

        {/* below the 3D story: opaque sections */}
        <section className="h3d-flat built">
          <div className="head" data-reveal>
            <p className="label">Built for</p>
            <h2 className="h3d-h">Whoever needs<br />a fire record<br />they can trust</h2>
          </div>
          <ul className="who-grid" data-reveal>
            {WHO.map(([t, d, pg]) => <li key={t}><button onClick={() => go(pg)}><b>{t}</b><span>{d}</span><i><Arrow /></i></button></li>)}
          </ul>
        </section>

        <section className="h3d-flat heritage">
          <p className="label">The record so far</p>
          <div className="nums" data-reveal>
            <div><b><Count v={s?.areas} /></b><span>Fire regimes built</span></div>
            <div><b><Count v={s?.rho} dec={2} /></b><span>Rank correlation with Aqua on {s?.rhoN ?? "…"} withheld months</span></div>
            <div><b><Count v={s ? s.statics / 1000 : null} />K</b><span>Kiln, flare and industry detections kept apart</span></div>
          </div>
          <p className="fine">Middle figure: median across areas of the rehearsal “what if MODIS had ended in 2016?”, where {s?.rhoTest ? `${s.rhoTest[0]} to ${s.rhoTest[1]}` : "2017 to 2020"} is rebuilt from VIIRS alone and compared with what Aqua observed. Data through {s?.through ?? "…"}.</p>
        </section>

        <section className="h3d-flat wall">
          <div className="head" data-reveal>
            <h2 className="h3d-h">Fire regimes<br />on one scale</h2>
            <p>Open a built area, or make your own: any box on Earth up to 4° × 4°. The first build reads every detection since 2000 and takes a few minutes.</p>
          </div>
          <ul className="cells" data-reveal>
            {presets.map((r) => (
              <li key={r.id}><button onClick={() => openRegion(r.id)}>
                <span className="c">{r.country}</span><b>{r.name}</b><span className="t">{r.story}</span><i><Arrow /></i>
              </button></li>
            ))}
            <li className="you"><button onClick={() => go("create")}><b>You?</b><span className="t">Build a record for any area on Earth.</span><i><Arrow /></i></button></li>
          </ul>
        </section>

        <footer className="h3d-flat h3d-foot">
          <div className="cols">
            <div className="about"><h3>Kiln Watch</h3><p>One consistent fire record,<br />2000 to today.<br />NASA Space Apps 2026.</p></div>
            <div><h3>Explore</h3><button onClick={() => go("explore")}>Explorer</button><button onClick={() => go("warning")}>Early warning</button><button onClick={() => go("news")}>News</button></div>
            <div><h3>Data</h3><button onClick={() => go("download")}>Download</button><button onClick={() => go("create")}>Create an area</button><button onClick={() => go("method")}>Methodology</button></div>
            <div><h3>Connect</h3><button onClick={() => go("mcp")}>MCP</button><button onClick={() => go("n8n")}>n8n alerts</button></div>
          </div>
          <div className="legal">
            <p>Data: NASA FIRMS (MODIS C6.1, VIIRS 375 m) via the Portolan mirror. Satellite models: NASA 3D Resources. Earth: NASA Blue Marble. Not an official NASA product.</p>
            <p>Detections are not fires and not burned area. The early warning is a climatological outlook, not a forecast.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
