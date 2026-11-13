// The home page story: a tall scroll track with one sticky stage. The scroll position drives a playhead `ph` (one
// beat per STEP of scroll) and scene.ts follows it every frame, so the 3D moves with the scroll, smoothed by Lenis.
// When the reader stops between two beats, the page glides on to the beat they were heading for (a short lock, so a
// scene is never left half-played). Text does not scrub: each beat's blocks play their reveal on a clock when the
// playhead reaches them, which keeps the type smooth whatever the scroll speed.
//
// Markup contract (Home.tsx): a container carries data-b="7" or data-b="7-8" (the beats it lives on); every
// [data-in] block inside enters when its beats arrive and leaves when they pass. data-in="0.4" delays it 0.4 s.
// Inside a block: `.w > span` words rise out of their masks, <em> gets a marker sweep, [data-draw="s"] strokes draw
// (pathLength 1), [data-lit="s"] pops its children in, `.pop` springs up like a notification.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

export type Playhead = { v: number; off: boolean }; // off: the story has scrolled away under the opaque sections
export type StoryOpts = {
  beats: number;
  /** the beat under the playhead changed */
  onBeat: (to: number, from: number) => void;
  onPlayhead: (ph: number) => void;
};
export type Story = { ph: Playhead; start: () => void; go: (to: number) => void; next: () => void; dispose: () => void };

type Block = { el: HTMLElement; a: number; b: number; at: number; tl: gsap.core.Timeline; on: boolean; out?: gsap.core.Tween };

const easeOut = (t: number) => 1 - (1 - t) ** 3;

export function mountStory(scroller: HTMLElement, content: HTMLElement, opts: StoryOpts): Story {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const last = opts.beats - 1, ph: Playhead = { v: 0, off: false };
  const track = content.querySelector<HTMLElement>(".h3d-story")!, stage = track.querySelector<HTMLElement>(".h3d-stage")!;
  const ring = scroller.querySelector<SVGElement>(".h3d-cue circle"), fade = scroller.querySelector(".h3d-fade");
  let beat = 0, started = false;

  const lenis = still ? null : new Lenis({ wrapper: scroller, content, lerp: 0.1, wheelMultiplier: 1.1 });
  const raf = (t: number) => lenis?.raf(t * 1000);
  if (lenis) { lenis.on("scroll", ScrollTrigger.update); gsap.ticker.add(raf); }
  if (import.meta.env.DEV) Object.assign(window, { gsap }); // for the headless walk-through: slow motion, lag smoothing off

  // scroll px per beat, measured from the layout (the track is LAST steps plus one screen tall)
  let step = 1;
  const measure = () => { step = Math.max(1, (track.offsetHeight - stage.offsetHeight) / last); };
  measure();
  const top = (b: number) => track.offsetTop + b * step;

  let blocks: Block[] = [];
  const ctx = gsap.context(() => {
    blocks = [...content.querySelectorAll<HTMLElement>("[data-in]")].map((el) => {
      const [a, b = a] = el.closest<HTMLElement>("[data-b]")!.dataset.b!.split("-").map(Number);
      // what this block animates itself: nested [data-in] blocks look after their own contents
      const own = <T extends Element>(q: string) => [...(el.matches(q) ? [el as Element as T] : []), ...el.querySelectorAll<T>(q)].filter((x) => x.closest("[data-in]") === el);
      const words = own<HTMLElement>(".w > span"), pop = el.classList.contains("pop"), svg = el instanceof SVGElement;
      const rest = words.length ? [...el.children].filter((c) => !c.matches(".w, em, br, [data-in]") && !c.querySelector(".w")) : [];
      const tl = gsap.timeline({ paused: true });
      tl.fromTo(el, { autoAlpha: 0, y: pop || svg || words.length ? 0 : 22, ...(pop && { scale: 0.8, x: -30, filter: "blur(8px)" }) },
        { autoAlpha: 1, y: 0, ...(pop && { scale: 1, x: 0, filter: "blur(0px)" }), duration: words.length ? 0.01 : pop ? 0.55 : 0.7, ease: pop ? "back.out(1.8)" : "power3.out" }, 0);
      if (words.length) tl.fromTo(words, { yPercent: 118 }, { yPercent: 0, duration: 0.95, ease: "expo.out", stagger: Math.min(0.07, 0.6 / words.length) }, 0);
      if (rest.length) tl.fromTo(rest, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.09 }, 0.1);
      const ems = own<HTMLElement>("em");
      if (ems.length) tl.fromTo(ems, { backgroundSize: "0% 100%" }, { backgroundSize: "100% 100%", duration: 0.7, ease: "power2.out", stagger: 0.14 }, 0.5);
      own<SVGElement>("[data-draw]").forEach((p) =>
        tl.fromTo(p, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: +(p.dataset.dur ?? 1.2), ease: "power2.inOut" }, +p.dataset.draw!));
      own<HTMLElement>("[data-lit]").forEach((g) =>
        tl.fromTo([...g.children], { autoAlpha: 0, scale: 0.2, transformOrigin: "50% 50%" }, { autoAlpha: 1, scale: 1, duration: 0.35, stagger: { amount: 0.5 }, ease: "back.out(2.2)" }, +g.dataset.lit!));
      return { el, a, b, at: parseFloat(el.dataset.in!) || 0, tl, on: false };
    });
    content.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
      gsap.from(el.children, { autoAlpha: 0, y: 44, duration: 1, ease: "power3.out", stagger: 0.07,
        scrollTrigger: { trigger: el, scroller, start: "top 85%", toggleActions: "play none none reverse" } });
    });
  }, content);

  const play = (B: Block) => {
    if (B.out?.isActive()) { B.out.kill(); gsap.set(B.el, { autoAlpha: 0 }); }
    if (still) B.tl.progress(0).progress(1); // rewind first: a timeline already at its end would not render again
    else B.tl.delay(0.05 + B.at).restart(true);
  };
  const leave = (B: Block) => {
    B.tl.pause();
    B.out = gsap.to(B.el, { autoAlpha: 0, y: B.el instanceof SVGElement ? 0 : -14, duration: still ? 0 : 0.3, ease: "power2.in" });
  };
  const setBeat = (to: number) => {
    if (to === beat) return;
    const from = beat;
    beat = to;
    for (const B of blocks) {
      const is = to >= B.a && to <= B.b;
      if (B.on && !is) leave(B); else if (!B.on && is) play(B);
      B.on = is;
    }
    scroller.dataset.beat = String(to);
    opts.onBeat(to, from);
  };

  // ---------- scroll → playhead ----------
  const scrollY = () => (lenis ? lenis.scroll : scroller.scrollTop);
  const update = () => {
    const y = scrollY() - track.offsetTop;
    ph.v = Math.min(last, Math.max(0, y / step));
    ph.off = y > last * step + innerHeight;
    opts.onPlayhead(ph.v);
    ring?.style.setProperty("stroke-dashoffset", String(1 - ph.v / last));
    if (started) setBeat(Math.round(ph.v));
  };
  if (lenis) lenis.on("scroll", update); else scroller.addEventListener("scroll", update, { passive: true });

  // ---------- glide on to a whole beat once the reader pauses between two ----------
  let dir = 1, kind: "" | "wheel" | "touch" = "", lastInput = 0, lastScroll = 0, touching = false, gliding = false;
  const glideTo = (b: number, lock = true) => {
    if (!lenis) return scroller.scrollTo({ top: top(b) });
    const dist = Math.abs(b - ph.v);
    if (dist < 0.002) return;
    gliding = true;
    lenis.scrollTo(top(b), { duration: 0.45 + 0.75 * Math.min(1, dist), easing: easeOut, lock, force: true, onComplete: () => { gliding = false; } });
  };
  const settle = () => {
    if (!lenis || gliding || !kind || ph.v >= last) return;
    const now = performance.now();
    const idle = kind === "wheel" ? now - lastInput > 300 : !touching && now - lastScroll > 120; // a real pause, not the gap between two wheel notches
    if (!idle) return;
    kind = "";
    // judge from where the scroll is heading (Lenis is still easing toward it), not where it has got to
    const v = Math.min(last, Math.max(0, (lenis.targetScroll - track.offsetTop) / step)), f = v - Math.floor(v);
    if (v >= last || f < 0.002 || f > 0.998) return;
    // a small push is enough to move on (or back): the scene completes itself
    glideTo(dir > 0 ? (f > 0.15 ? Math.ceil(v) : Math.floor(v)) : (f < 0.85 ? Math.floor(v) : Math.ceil(v)));
  };
  gsap.ticker.add(settle);
  const onWheel = (e: WheelEvent) => { if (e.deltaY) { dir = Math.sign(e.deltaY); kind = "wheel"; lastInput = performance.now(); } };
  let ty = 0;
  const onTouchStart = (e: TouchEvent) => { touching = true; ty = e.touches[0].clientY; };
  const onTouchMove = (e: TouchEvent) => { const dy = ty - e.touches[0].clientY; if (Math.abs(dy) > 4) { dir = Math.sign(dy); kind = "touch"; } };
  const onTouchEnd = () => { touching = false; };
  const onScroll = () => { lastScroll = performance.now(); };
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (e.altKey || e.ctrlKey || e.metaKey || t.closest?.("input, textarea, select") || ph.v >= last || !lenis) return;
    const space = e.key === " " && !t.closest?.("button, a");
    const d = e.key === "ArrowDown" || e.key === "PageDown" || (space && !e.shiftKey) ? 1 : e.key === "ArrowUp" || e.key === "PageUp" || (space && e.shiftKey) ? -1 : 0;
    if (!d || (d < 0 && ph.v <= 0)) return;
    e.preventDefault();
    glideTo(d > 0 ? Math.floor(ph.v + 0.01) + 1 : Math.ceil(ph.v - 0.01) - 1);
  };
  scroller.addEventListener("wheel", onWheel, { passive: true });
  scroller.addEventListener("touchstart", onTouchStart, { passive: true });
  scroller.addEventListener("touchmove", onTouchMove, { passive: true });
  scroller.addEventListener("touchend", onTouchEnd, { passive: true });
  scroller.addEventListener("scroll", onScroll, { passive: true });
  addEventListener("keydown", onKey);
  const onResize = () => { measure(); update(); };
  addEventListener("resize", onResize);

  /** The chapter bar: a near beat glides there; a far one cuts through black instead of racing past every scene. */
  const go = (to: number) => {
    to = Math.max(0, Math.min(last, to));
    if (Math.abs(to - ph.v) <= 1.5 || !lenis) return glideTo(to);
    gsap.timeline().to(fade, { autoAlpha: 1, duration: 0.25 })
      .add(() => { lenis.scrollTo(top(to), { immediate: true, force: true }); update(); })
      .to(fade, { autoAlpha: 0, duration: 0.5 }, "+=0.05");
  };

  return {
    ph,
    start() {
      if (started) return;
      started = true;
      scroller.classList.add("can");
      beat = -1;
      update();
    },
    go,
    next: () => glideTo(Math.min(last, Math.floor(ph.v + 0.01) + 1)),
    dispose() {
      scroller.removeEventListener("wheel", onWheel);
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("scroll", update);
      removeEventListener("keydown", onKey);
      removeEventListener("resize", onResize);
      gsap.ticker.remove(settle);
      blocks.forEach((B) => B.out?.kill());
      ctx.revert();
      if (lenis) { gsap.ticker.remove(raf); lenis.destroy(); }
    },
  };
}
