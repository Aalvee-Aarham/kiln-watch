import { BIN_DEG, type DayPass, type SeasonReplay } from '../../lib/space/fires'
import { distanceKm, type Orbit, type Pass } from '../../lib/space/orbit'
import { orbitPaths, passColumns, satLabels, satMarks, seasonColumnsFrom, swathAreas, trackTrails, type SatColors } from '../../lib/space/scenes'
import type { Sensor } from '../../lib/types'
import type { Store, Playback } from './store'
import type { Area, Column, Engine, Label, LatLon, Line } from './types'

// Runs the globe outside React. React hands over the scene when an input changes (setScene); the director keeps the
// moving parts in step every frame, each at the rate it needs, and publishes the clock to the time bars.

export type Step = 'intro' | 'passes' | 'season' | 'drift' | 'pixel' | 'edge' | 'scale' | 'square'
export const GROUND_STEPS: Step[] = ['pixel', 'edge', 'scale', 'square']
export const isTimeStep = (s: Step) => s === 'intro' || s === 'passes'
export interface Palette { sats: SatColors; ramp: string[]; ink: string; heat: string }

export interface Scene {
  step: Step; pal: Palette
  /** The place the day replay is about: time slows while a satellite passes near it. */
  focus: LatLon
  orbits: Orbit[]; passes: Pass[]; groups: DayPass[]; dayStartUtc: number
  replay?: SeasonReplay; maxCum: number; seasonStartUtc: number
  outline: Line[]; groundLines: Line[]; groundAreas: Area[]; drift: Line[]; driftCols: Column[]
  staticLabels: Label[]
}

const HOUR = 3_600_000
const LIT = new Set<Sensor>(['A', 'N'])                       // the two satellites in the map data
const COL_KM = BIN_DEG * 111.19 * 0.72
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

export class Director {
  private engine: Engine | null = null
  private s: Scene | null = null
  private raf = 0
  private last = 0
  private t: number
  private due = { orbit: 0, trail: 0, swath: 0, cols: 0, clock: 0 }
  private litKey = ''
  private drawn = { sats: NaN, orbit: NaN, trail: NaN, swath: NaN, cols: NaN }
  private acc = 0
  private reduced = false

  constructor(readonly store: Store<Playback>, readonly labels: { current: Label[] }) { this.t = store.get().t }

  setReduced(r: boolean) { this.reduced = r }
  setEngine(e: Engine | null) { this.engine = e; this.applyStatic(); this.refresh() }
  setScene(s: Scene) { this.s = s; this.applyStatic(); this.refresh() }

  start() { if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame) } }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0 }

  // ---- controls (the time bars and the page call these) ----
  play() {
    const s = this.s
    if (s && this.t >= s.dayStartUtc + 24 * HOUR - 120_000) this.seek(s.dayStartUtc)
    this.store.set({ playing: true })
  }
  pause() { this.store.set({ playing: false }) }
  seek(t: number) { this.t = t; this.store.set({ t }); this.refresh() }
  playSeason() {
    const r = this.s?.replay
    if (r && this.store.get().day >= r.sf.n_days - 1) this.seekDay(0)
    this.store.set({ seasonPlaying: true })
  }
  pauseSeason() { this.store.set({ seasonPlaying: false }) }
  seekDay(d: number) { this.store.set({ day: d }); this.pushSeason() }

  /** Recompute everything on the next frame (after a seek, a new scene or a new engine). */
  private refresh() {
    this.due = { orbit: 0, trail: 0, swath: 0, cols: 0, clock: 0 }; this.litKey = ''
    this.drawn = { sats: NaN, orbit: NaN, trail: NaN, swath: NaN, cols: NaN }
  }
  /** Is a layer due (its interval passed) and stale (the clock moved since it was drawn)? */
  private stale(k: 'orbit' | 'trail' | 'swath' | 'cols', now: number) { return now >= this.due[k] && this.drawn[k] !== this.t }

  private applyStatic() {
    const e = this.engine, s = this.s
    if (!e || !s) return
    const ground = GROUND_STEPS.includes(s.step), season = s.step === 'season' || s.step === 'drift'
    e.setLines('outline', isTimeStep(s.step) ? [] : s.outline)
    e.setLines('footprint', ground ? s.groundLines : [])
    e.setAreas('footprint', ground ? s.groundAreas : [])
    e.setLines('path', s.step === 'drift' ? s.drift : [])
    e.setCloseImagery(ground)
    if (!isTimeStep(s.step)) {
      e.setSats([]); e.setLines('orbit', []); e.setLines('track', []); e.setAreas('swath', [])
      e.setTime((season ? s.seasonStartUtc + this.store.get().day * 24 * HOUR : s.dayStartUtc) + 12.5 * HOUR)
    }
    if (s.step === 'drift') e.setColumns(s.driftCols, COL_KM)
    else if (s.step === 'season') this.pushSeason()
    else if (!isTimeStep(s.step)) e.setColumns([], 1)
    if (s.step === 'intro') { e.setLines('track', []); e.setAreas('swath', []); e.setColumns([], 1) }
    if (s.step === 'passes') e.setLines('orbit', [])
  }

  private pushSeason() {
    const e = this.engine, s = this.s
    if (!e || !s?.replay || s.step !== 'season') return
    const day = this.store.get().day
    const r = s.replay.at(day)
    e.setColumns(seasonColumnsFrom(r.sf, r.cum, r.recent, s.pal.ramp, s.maxCum), COL_KM)
    e.setTime(s.seasonStartUtc + day * 24 * HOUR + 12.5 * HOUR)
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame)
    const dt = Math.min(100, now - this.last)
    this.last = now
    const e = this.engine, s = this.s
    if (!e || !s) return
    const st = this.store.get()

    if (isTimeStep(s.step)) {
      // Where are the satellites, and how close is the nearest to the chosen place? Time slows while one passes over.
      let near = Infinity
      const marks = satMarks(s.orbits, this.t, s.pal.sats, s.step === 'passes' ? LIT : undefined)
      for (const m of marks) near = Math.min(near, distanceKm(m.lat, m.lon, s.focus.lat, s.focus.lon))
      if (st.playing) {
        const rate = s.step === 'intro' ? 240 : this.reduced ? 600 : 90 + 3500 * smooth(1400, 4200, near)
        this.t += dt * rate
        const end = s.dayStartUtc + 24 * HOUR
        if (s.step === 'passes' && this.t >= end) { this.t = end - 60_000; this.store.set({ playing: false }) }
      }
      if (this.drawn.sats !== this.t) {
        e.setTime(this.t)
        e.setSats(s.step === 'passes' ? satMarks(s.orbits, this.t, s.pal.sats, LIT) : marks)
        this.labels.current = [...satLabels(s.orbits, this.t, s.pal.sats), ...s.staticLabels]
        this.drawn.sats = this.t
      }
      if (s.step === 'intro' && this.stale('orbit', now)) { e.setLines('orbit', orbitPaths(s.orbits, this.t, s.pal.sats)); this.due.orbit = now + 250; this.drawn.orbit = this.t }
      if (s.step === 'passes') {
        if (this.stale('trail', now)) { e.setLines('track', trackTrails(s.orbits, this.t, s.pal.sats)); this.due.trail = now + 160; this.drawn.trail = this.t }
        if (this.stale('swath', now)) { e.setAreas('swath', swathAreas(s.orbits, this.t, s.pal.sats)); this.due.swath = now + 90; this.drawn.swath = this.t }
        // fire squares: when a new pass lights up, then a few times a second while their glow fades
        const lit = s.passes.filter((p) => p.t_utc <= this.t).map((p) => p.sat + p.pass).join()
        const fading = s.passes.some((p) => p.t_utc <= this.t && this.t - p.t_utc < 3 * HOUR)
        if (lit !== this.litKey || (fading && this.stale('cols', now))) {
          e.setColumns(passColumns(s.groups, s.passes, this.t, s.pal.ramp), COL_KM)
          this.litKey = lit; this.due.cols = now + 250; this.drawn.cols = this.t
        }
      }
      if (now >= this.due.clock) { this.store.set({ t: this.t, slow: s.step === 'passes' && near < 2600 }); this.due.clock = now + 66 }
      return
    }

    if (s.step === 'season' && st.seasonPlaying && s.replay) {
      const n = s.replay.sf.n_days
      const quiet = !s.replay.sf.daily[st.day + 1]?.bin.length
      this.acc += dt
      if (this.acc >= (quiet ? 20 : 80)) {
        this.acc = 0
        const day = Math.min(n - 1, st.day + 1)
        this.store.set({ day, seasonPlaying: day < n - 1 })
        this.pushSeason()
      }
    }
  }

  get now() { return this.t }
}
