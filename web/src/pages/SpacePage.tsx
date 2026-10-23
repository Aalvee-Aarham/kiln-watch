import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Director, GROUND_STEPS, isTimeStep, type Palette, type Scene, type Step } from '../components/space/director'
import { PlaceSearch } from '../components/space/PlaceSearch'
import { SpaceStage } from '../components/space/SpaceStage'
import { StoryCard, type ChapterMeta, type StepMeta } from '../components/space/StoryCard'
import { createStore, type Playback } from '../components/space/store'
import { DayBar, SeasonBar } from '../components/space/TimeBar'
import type { Area, CameraView, Engine, Label, LatLon, Line } from '../components/space/types'
import { Icon, SegmentedToggle, useMeta, useReducedMotion, useTitle } from '../components/ui'
import { Gloss, useQ } from '../components/plain'
import { BBOX, cellId, tilesForBox } from '../lib/box'
import { fetchJson, useJson } from '../lib/data'
import { dateToDay, dayToDate, seasonStart } from '../lib/days'
import { inGeometry, unitAt } from '../lib/geo'
import { useLang, useT } from '../lib/i18n'
import { cssVar } from '../lib/theme'
import { BIN_DEG, binOf, dailyTotals, dayPasses, monthlyCentres, rankDays, SeasonReplay, seasonFires, seasonsIn, seasonTotals, type PassFilter, type SeasonFires } from '../lib/space/fires'
import { anchorOrbit, destination, distanceKm, footprintRing, headingDeg, periodMin, pixelSize, satById, SATS, swathHalfKm } from '../lib/space/orbit'
import { centreOf, clockOffsetH, fmtLatLon, nearestCity, outlines, type Place } from '../lib/space/places'
import { BD_UTC_OFFSET_H, orbitsFor, passesFor, satLabels, seasonColumns } from '../lib/space/scenes'
import type { FC, GridTile, Sensor } from '../lib/types'
import { parseCities, type Hit } from '../lib/world'

// "Seen from space": a guided tour on a full-window globe. 1 how the satellites pass over, 2 a season of fire squares,
// 3 what one fire pixel covers on the ground. Everything drawn is computed in lib/space; fires only as 0.1° squares.

const BD = { lat: (BBOX[1] + BBOX[3]) / 2, lon: (BBOX[0] + BBOX[2]) / 2 }
const HOUR = 3_600_000
const CHAPTERS: ChapterMeta[] = [{ n: 1, title: 'Passes' }, { n: 2, title: 'Season' }, { n: 3, title: 'One pixel' }]
const STEPS: (StepMeta & { id: Step })[] = [
  { id: 'intro', chapter: 1, title: 'Five cameras circle the Earth' },
  { id: 'passes', chapter: 1, title: 'A day of passes' },
  { id: 'season', chapter: 2, title: 'A season, day by day' },
  { id: 'drift', chapter: 2, title: 'Where the burning moves' },
  { id: 'pixel', chapter: 3, title: 'One pixel on the ground' },
  { id: 'edge', chapter: 3, title: 'Wider at the edge' },
  { id: 'scale', chapter: 3, title: 'How big is a brick kiln?' },
  { id: 'square', chapter: 3, title: 'One square from chapter 2' },
]
const KILN_M = 55 // a zigzag kiln's firing structure, 48–59 m long (CSE design manual); drawn as a ruler, never at a real kiln
const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
const LIT = new Set<Sensor>(['A', 'N'])
const NAMES = Object.fromEntries(SATS.map((s) => [s.id, s.name])) as Record<Sensor, string>
/** Stops where the reader can choose any place on Earth (the season replay stays on Bangladesh's own record). */
const PICK_STEPS: Step[] = ['intro', 'passes', 'pixel', 'edge', 'scale', 'square']
const ARRIVE_MS = 4200
type CityFile = { fields: string[]; rows: (string | number | null)[][] }

const localMidnightUtc = (day: number, offset_h = BD_UTC_OFFSET_H) => dayToDate(day).getTime() - offset_h * HOUR
const fmtClock = (t: number, offset_h: number) => new Date(t + offset_h * HOUR).toISOString().slice(11, 16)
const fmtDay = (day: number) => dayToDate(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace('Sept', 'Sep')
const fmtKm = (m: number) => { const r = Math.round(m); return r >= 1000 ? `${(r / 1000).toFixed(r >= 9950 ? 0 : 1)} km` : `${r} m` }

function useGridTiles() {
  const [state, setState] = useState<{ tiles?: GridTile[]; error?: string }>({})
  useEffect(() => {
    let live = true
    Promise.all(tilesForBox(BBOX).map((t) => fetchJson<GridTile>(`grid/${t}.json`).catch(() => null)))
      .then((x) => { if (live) setState({ tiles: x.filter((t): t is GridTile => !!t) }) }, (e: Error) => live && setState({ error: e.message }))
    return () => { live = false }
  }, [])
  return state
}

/** Fill the window below the site header, and stop the page itself from scrolling (the wheel zooms the globe). */
function useFillWindow() {
  const box = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>()
  useLayoutEffect(() => {
    const fit = () => { if (box.current) setHeight(Math.max(320, window.innerHeight - box.current.getBoundingClientRect().top)) }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(document.body)
    window.addEventListener('resize', fit)
    const html = document.documentElement, prev = html.style.overflow
    html.style.overflow = 'hidden'
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); html.style.overflow = prev }
  }, [])
  return [box, height] as const
}

export default function SpacePage() {
  useTitle('Seen from space')
  const t = useT()
  const lang = useLang()
  const q = useQ()
  const reduced = useReducedMotion()
  const meta = useMeta().data
  const districts = useJson<FC>('aoi/districts.geojson')
  const { tiles, error: tilesError } = useGridTiles()
  const [box, height] = useFillWindow()
  const [engine, setEngine] = useState<Engine | null>(null)
  const [moved, setMoved] = useState(false)
  const [cardOpen, setCardOpen] = useState(true)

  // ---- the tour position lives in the URL (?step=), so any stop can be linked ----
  const [sp, setSp] = useSearchParams()
  const index = Math.max(0, STEPS.findIndex((s) => s.id === sp.get('step')))
  const step = STEPS[index].id
  const go = useCallback((i: number) => {
    const n = Math.max(0, Math.min(STEPS.length - 1, i))
    setSp((prev) => { const next = new URLSearchParams(prev); if (n) next.set('step', STEPS[n].id); else next.delete('step'); return next }, { replace: true })
    setCardOpen(true)
  }, [setSp])

  // ---- the place: anywhere on Earth for chapters 1 and 3; Bangladesh until the reader picks one ----
  const [place, setPlace] = useState<Place | null>(null)
  const needWorld = PICK_STEPS.includes(step)
  const countries = useJson<FC>(needWorld ? 'aoi/world_countries.geojson' : null)
  const cityFile = useJson<CityFile>(needWorld ? 'aoi/world_cities.json' : null)
  const cities = useMemo(() => (cityFile.data ? parseCities(cityFile.data) : []), [cityFile.data])
  const countryName = useMemo(() => new Map((countries.data?.features ?? []).map((f) => [f.properties.unit_id, f.properties.name_en])), [countries.data])
  const inBangladesh = useCallback((lat: number, lon: number) => !!districts.data && !!unitAt(districts.data, lat, lon), [districts.data])
  /** A name for a clicked point: its Bangladesh district, else the nearest city and its country, else the country, else coordinates. */
  const placeAt = useCallback((lat: number, lon: number): Place => {
    const d = districts.data ? unitAt(districts.data, lat, lon) : undefined
    if (d) return { name: `${d.name_en}, Bangladesh`, lat, lon }
    const country = countries.data?.features.find((f) => inGeometry(f.geometry, lat, lon))?.properties.name_en
    const c = nearestCity(cities, lat, lon, 60)
    return { name: c ? (country ? `${c.name}, ${country}` : c.name) : country ?? fmtLatLon(lat, lon), lat, lon }
  }, [districts.data, countries.data, cities])
  const entries = useMemo<Hit[]>(() => [
    ...(districts.data?.features ?? []).map((f) => ({ kind: 'state' as const, id: f.properties.unit_id, name: f.properties.name_en, nameBn: f.properties.name_bn, sub: 'District, Bangladesh', weight: 0.5 })),
    ...(countries.data?.features ?? []).map((f) => ({ kind: 'country' as const, id: f.properties.unit_id, name: f.properties.name_en, nameBn: f.properties.name_bn, sub: 'Country', weight: 0 })),
    ...cities.map((c, i) => ({ kind: 'city' as const, id: String(i), name: c.name, nameBn: c.nameBn, sub: countryName.get(c.adm0) ?? c.adm0, weight: 2 + c.rank / 20 })),
  ], [districts.data, countries.data, cities, countryName])
  const pickHit = (h: Hit) => {
    if (h.kind === 'city') { const c = cities[+h.id]; if (c) setPlace({ name: `${c.name}, ${h.sub}`, lat: c.lat, lon: c.lon }); return }
    const f = (h.kind === 'state' ? districts.data : countries.data)?.features.find((x) => x.properties.unit_id === h.id)
    if (f) setPlace({ name: h.kind === 'state' ? `${h.name}, Bangladesh` : h.name, ...centreOf(f.geometry) })
  }

  // ---- the animation runs outside React ----
  const store = useMemo(() => createStore<Playback>({ t: 0, playing: false, slow: false, day: 0, seasonPlaying: false }), [])
  const labels = useRef<Label[]>([])
  const director = useMemo(() => new Director(store, labels), [store])
  useEffect(() => { director.start(); return () => director.stop() }, [director])
  useEffect(() => director.setReduced(reduced), [director, reduced])
  useEffect(() => director.setEngine(engine), [director, engine])
  useEffect(() => engine?.onUserMove(() => setMoved(true)), [engine])

  // Colours: night tokens (the globe is night in both themes).
  const tokens = useRef<HTMLSpanElement>(null)
  const [pal, setPal] = useState<Palette | null>(null)
  useEffect(() => {
    const v = (n: string) => cssVar(n, tokens.current!)
    setPal({ sats: { T: v('--color-jute'), A: v('--color-orbit'), N: v('--color-plum'), J1: v('--color-paddy'), J2: v('--color-brick') },
      ramp: [2, 3, 4, 5].map((i) => v(`--color-fire-${i}`)), ink: v('--color-ink'), heat: v('--color-heat') }) // fire-1 is too dark on the globe
  }, [])

  // ---- chapter 1: one date over the chosen place; fire squares only where Kiln Watch has data (Bangladesh) ----
  const days = useMemo(() => (tiles ? rankDays(tiles, 12) : []), [tiles])
  const [pickedDay, setPickedDay] = useState<number>()
  const passDay = pickedDay ?? days[0]?.day ?? dateToDay(new Date())
  const ch1: Place = place ?? { name: 'Bangladesh', ...BD }
  const ch1InBD = !place || inBangladesh(ch1.lat, ch1.lon)
  const offsetH = clockOffsetH(ch1.lon, ch1InBD)
  const clockLabel = ch1InBD ? 'Bangladesh time' : 'local solar time'
  const fmtLocal = (x: number) => fmtClock(x, offsetH)
  const dayUtc = dayToDate(passDay).getTime(), dayStartUtc = localMidnightUtc(passDay, offsetH)
  const orbits = useMemo(() => orbitsFor(dayUtc, ch1.lat, ch1.lon), [dayUtc, ch1.lat, ch1.lon])
  const passes = useMemo(() => passesFor(orbits, dayUtc, ch1.lat, ch1.lon, offsetH), [orbits, dayUtc, ch1.lat, ch1.lon, offsetH])
  const groups = useMemo(() => (tiles && meta && ch1InBD ? dayPasses(tiles, meta, passDay) : []), [tiles, meta, passDay, ch1InBD])

  // ---- chapter 2: one season of fire squares ----
  const seasons = useMemo(() => (tiles ? seasonsIn(tiles) : []), [tiles])
  const lastDataDay = useMemo(() => { let m = 0; for (const x of tiles ?? []) for (const r of x.rows) if (r[1] > m) m = r[1]; return m }, [tiles])
  const defaultSeason = useMemo(() => [...seasons].reverse().find((s) => seasonStart(`${+s.slice(0, 4) + 1}`) - 1 <= lastDataDay) ?? seasons.at(-1), [seasons, lastDataDay])
  const [pickedSeason, setPickedSeason] = useState<string>()
  const season = pickedSeason ?? defaultSeason
  const [filter, setFilter] = useState<PassFilter>('all')
  const sf = useMemo<SeasonFires | undefined>(() => (tiles && meta && season ? seasonFires(tiles, meta, season, filter) : undefined), [tiles, meta, season, filter])
  const replay = useMemo(() => (sf ? new SeasonReplay(sf) : undefined), [sf])
  const totals = useMemo(() => (sf ? seasonTotals(sf) : undefined), [sf])
  const perDay = useMemo(() => (sf ? dailyTotals(sf) : []), [sf])
  const maxCum = useMemo(() => (totals ? Math.max(1, ...totals) : 1), [totals])
  const centres = useMemo(() => (sf ? monthlyCentres(sf) : []), [sf])
  const busyMonths = useMemo(() => {
    const n = centres.reduce((s, c) => s + (c?.n ?? 0), 0)
    return centres.map((c, m) => ({ c, m })).filter(({ c }) => c && c.n >= 0.04 * n) as { c: { lat: number; lon: number; n: number }; m: number }[]
  }, [centres])

  // ---- chapter 3: one place on the ground (default: the Bangladesh district with the most fire-days) ----
  const busiestBin = useMemo(() => (sf && totals && totals.length ? sf.bins[totals.indexOf(Math.max(...totals))] : undefined), [sf, totals])
  const defaultDistrict = useMemo(() => (districts.data && busiestBin ? unitAt(districts.data, busiestBin.lat, busiestBin.lon)?.unit_id : undefined) ?? districts.data?.features[0]?.properties.unit_id, [districts.data, busiestBin])
  const district = districts.data?.features.find((f) => f.properties.unit_id === defaultDistrict)
  const ch3: Place = place ?? (district ? { name: `${district.properties.name_en}, Bangladesh`, ...centreOf(district.geometry) } : { name: 'Bangladesh', ...BD })
  const centre = useMemo<LatLon>(() => ({ lat: ch3.lat, lon: ch3.lon }), [ch3.lat, ch3.lon])
  const ch3InBD = inBangladesh(centre.lat, centre.lon)
  const binCentre = useMemo<LatLon>(() => {
    // the published grid's 0.1° square when the place is on the grid; the same 0.1° squares (multiples of BIN_DEG) elsewhere
    try { if (meta) return binOf(meta, cellId(meta, centre.lat, centre.lon)) } catch { /* off the published grid */ }
    return { lat: (Math.floor(centre.lat / BIN_DEG) + 0.5) * BIN_DEG, lon: (Math.floor(centre.lon / BIN_DEG) + 0.5) * BIN_DEG }
  }, [meta, centre])
  const trackHeading = useMemo(() => { const o = anchorOrbit(satById('A'), dayUtc, centre.lat, centre.lon); return headingDeg(o, o.t_anchor) }, [dayUtc, centre])
  const [scan, setScan] = useState(55)

  // ---- layers that change only with the reader's choices ----
  const outline = useMemo<Line[]>(() => (districts.data ? outlines(districts.data).map((points, i) => ({ id: `d${i}`, color: '#ffffff', width_px: 1, opacity: 0.32, points })) : []), [districts.data])
  const driftCols = useMemo(() => (sf && pal ? seasonColumns(sf, sf.n_days - 1, pal.ramp, maxCum, 90).map((c) => ({ ...c, glow: 0 })) : []), [sf, pal, maxCum])
  const drift = useMemo<Line[]>(() => (pal && busyMonths.length > 1 ? [{ id: 'drift', color: pal.heat, width_px: 3, points: busyMonths.map(({ c }) => c), alt_km: 95 }] : []), [busyMonths, pal])
  const ground = useMemo(() => {
    if (!pal || !meta) return { lines: [] as Line[], areas: [] as Area[], labels: [] as Label[] }
    const { lat, lon } = centre, h = trackHeading
    const vN = pixelSize(satById('N'), 0), mN = pixelSize(satById('A'), 0)
    const vE = pixelSize(satById('N'), Math.min(scan, satById('N').max_scan_deg)), mE = pixelSize(satById('A'), Math.min(scan, satById('A').max_scan_deg))
    const modis = pal.sats.A, viirs = pal.sats.N
    const sq = (id: string, s: { scan_m: number; track_m: number }, color: string, dashed = false, fill = 0.14): [Line, Area] => {
      const ring = footprintRing(lat, lon, s.track_m, s.scan_m, h)
      return [{ id, color, width_px: dashed ? 1.5 : 2.5, points: [...ring, ring[0]], dashed, opacity: dashed ? 0.8 : 1 }, { id, color, opacity: dashed ? 0 : fill, ring }]
    }
    const top = (s: { scan_m: number; track_m: number }) => { const r = footprintRing(lat, lon, s.track_m, s.scan_m, h); return { lat: (r[0].lat + r[1].lat) / 2, lon: (r[0].lon + r[1].lon) / 2 } }
    const label = (id: string, at: LatLon, text: string, color: string): Label => ({ id, ...at, alt_km: 0, text, color, kind: 'size', max_range_km: 80 })
    const lines: Line[] = [], areas: Area[] = [], labels: Label[] = []
    const add = ([l, a]: [Line, Area]) => { lines.push(l); if (a.opacity > 0) areas.push(a) }
    if (step === 'pixel' || step === 'square') {
      add(sq('mN', mN, modis)); add(sq('vN', vN, viirs, false, 0.22))
      if (step === 'pixel') labels.push(label('lm', top(mN), `MODIS pixel · ${fmtKm(mN.scan_m)}`, modis), label('lv', top(vN), `VIIRS pixel · ${fmtKm(vN.scan_m)}`, viirs))
    }
    if (step === 'edge') {
      add(sq('mE', mE, modis)); add(sq('vE', vE, viirs, false, 0.22)); add(sq('mN', mN, modis, true)); add(sq('vN', vN, viirs, true))
      labels.push(label('lm', top(mE), `MODIS · ${fmtKm(mE.scan_m)} × ${fmtKm(mE.track_m)}`, modis), label('lv', top(vE), `VIIRS · ${fmtKm(vE.scan_m)} × ${fmtKm(vE.track_m)}`, viirs))
    }
    if (step === 'scale') {
      add(sq('vN', vN, viirs, false, 0.12))
      lines.push({ id: 'kiln', color: pal.heat, width_px: 5, points: [destination(lat, lon, 270, KILN_M / 2000), destination(lat, lon, 90, KILN_M / 2000)] })
      labels.push(label('lv', top(vN), `VIIRS pixel · ${fmtKm(vN.scan_m)}`, viirs), label('lk', destination(lat, lon, 0, 0.012), `${KILN_M} m · a kiln’s length`, pal.heat))
    }
    if (step === 'square') {
      const b = binCentre
      const ring = footprintRing(b.lat, b.lon, BIN_DEG * 111.19 * 1000, BIN_DEG * 111.19 * Math.cos((b.lat * Math.PI) / 180) * 1000, 0)
      lines.push({ id: 'bin', color: pal.ramp[2], width_px: 3, points: [...ring, ring[0]] })
      areas.push({ id: 'bin', color: pal.ramp[2], opacity: 0.1, ring })
      labels.push(label('lb', { lat: (ring[0].lat + ring[1].lat) / 2, lon: (ring[0].lon + ring[1].lon) / 2 }, 'One 0.1° square, as in chapter 2 · about 11 km', pal.ramp[2]))
    }
    return { lines, areas, labels }
  }, [pal, meta, centre, binCentre, trackHeading, scan, step])

  const staticLabels = useMemo<Label[]>(() => {
    if (!pal) return []
    if (step === 'passes' || (step === 'intro' && place)) return [{ id: 'pin', lat: ch1.lat, lon: ch1.lon, alt_km: 0, text: ch1.name, color: pal.heat, kind: 'pin' }]
    if (step === 'drift') return busyMonths.map(({ c, m }) => ({ id: `m${m}`, lat: c.lat, lon: c.lon, alt_km: 95, text: MONTHS[m], color: pal.heat, kind: 'size', max_range_km: 7000 }))
    if (GROUND_STEPS.includes(step)) return ground.labels
    return []
  }, [pal, step, busyMonths, ground.labels, place, ch1.lat, ch1.lon, ch1.name])
  // Labels the stage draws now; the director keeps satellite labels moving during the time steps.
  labels.current = isTimeStep(step) && pal ? [...satLabels(orbits, director.now, pal.sats), ...staticLabels] : staticLabels

  // ---- hand the scene to the director ----
  useEffect(() => {
    if (!pal) return
    const scene: Scene = { step, pal, focus: { lat: ch1.lat, lon: ch1.lon }, orbits, passes, groups, dayStartUtc, replay, maxCum, seasonStartUtc: sf ? localMidnightUtc(sf.day0) : dayStartUtc,
      outline, groundLines: ground.lines, groundAreas: ground.areas, drift, driftCols, staticLabels }
    director.setScene(scene)
  }, [director, step, pal, ch1.lat, ch1.lon, orbits, passes, groups, dayStartUtc, replay, maxCum, sf, outline, ground, drift, driftCols, staticLabels])

  // Card size, for the time bar's position and the camera's offset.
  const card = useRef<HTMLDivElement>(null)
  const [cardW, setCardW] = useState(0)
  const [cardH, setCardH] = useState(0)
  useLayoutEffect(() => {
    const el = card.current
    if (!el) return
    const measure = () => {
      const r = el.firstElementChild?.getBoundingClientRect(), wide = window.innerWidth >= 768
      setCardW(r && wide && cardOpen ? Math.round(r.width + 16) : 0); setCardH(r && !wide && cardOpen ? Math.round(r.height) : 0)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [cardOpen, step])

  // ---- camera: each stop has a view; on a wide screen the subject sits right of the card ----
  const viewFor = useCallback((s: Step): CameraView => {
    const v: CameraView = (() => {
      switch (s) {
        case 'intro': return { lat: Math.max(-60, Math.min(60, ch1.lat - 8)), lon: ch1.lon, range_km: engine?.fitRange(0.9) ?? 23000, tilt_deg: 0, heading_deg: 0 }
        case 'passes': return { lat: ch1.lat, lon: ch1.lon, range_km: 4600, tilt_deg: 30, heading_deg: 0 }
        case 'season': return { lat: BD.lat + 0.3, lon: BD.lon, range_km: 640, tilt_deg: 48, heading_deg: 0 }
        case 'drift': return { lat: BD.lat - 0.6, lon: BD.lon, range_km: 1150, tilt_deg: 22, heading_deg: 0 }
        case 'pixel': return { ...centre, range_km: 3.4, tilt_deg: 0, heading_deg: 0 }
        case 'edge': return { ...centre, range_km: 10.5, tilt_deg: 0, heading_deg: 0 }
        case 'scale': return { ...centre, range_km: 1.1, tilt_deg: 0, heading_deg: 0 }
        case 'square': return { ...binCentre, range_km: 26, tilt_deg: 24, heading_deg: 0 }
      }
    })()
    // Narrow screens: pull back a little on the regional views so the whole country fits the width.
    if (window.innerWidth < 768 && (s === 'passes' || s === 'season' || s === 'drift')) v.range_km *= 1.3
    if (!cardW || v.range_km > 8000) return v
    const shift = (cardW * 0.5 * v.range_km * 0.55) / (height ?? 800)   // half the card's width, in km on the ground
    return { ...v, ...destination(v.lat, v.lon, 270, shift) }
  }, [engine, ch1.lat, ch1.lon, centre, binCentre, cardW, height])
  // On load the Earth arrives from deep space: small and far, sweeping in and settling where it nearly fills the screen.
  const arrived = useRef(false), arrivingUntil = useRef(0)
  const fly = useCallback(() => {
    if (!engine) return
    const v = viewFor(step), now = performance.now()
    setMoved(false)
    if (!arrived.current) {
      arrived.current = true
      if (!reduced) {
        engine.flyTo({ lat: v.lat - 15, lon: v.lon - 75, range_km: 150_000, tilt_deg: 0, heading_deg: 0 }, 0)
        engine.flyTo(v, ARRIVE_MS, 'out')
        arrivingUntil.current = now + ARRIVE_MS
        return
      }
    }
    if (now < arrivingUntil.current) engine.flyTo(v, arrivingUntil.current - now, 'out')   // a late layout change: keep settling, same pace
    else engine.flyTo(v, reduced ? 0 : 2200)
  }, [engine, step, viewFor, reduced])
  useEffect(() => { fly() }, [fly])

  // Entering a stop sets its clock and starts its animation (not under reduced motion).
  useEffect(() => {
    if (step === 'intro') { director.seek(dayStartUtc + 9 * HOUR); if (reduced) director.pause(); else director.play() }
    else if (step === 'passes') {
      const aqua = passes.find((p) => p.sat === 'A' && p.pass === 'D')
      if (reduced && aqua) { director.seek(aqua.t_utc + 10 * 60_000); director.pause() } else { director.seek(dayStartUtc); director.play() }
    } else director.pause()
    if (step === 'season' && sf) { director.seekDay(reduced ? sf.n_days - 1 : 0); if (reduced) director.pauseSeason(); else director.playSeason() }
    else director.pauseSeason()
  }, [step, passDay, sf, ch1.lat, ch1.lon]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clicking the Earth picks a place (on the stops that can use one).
  const stepRef = useRef(step)
  stepRef.current = step
  useEffect(() => engine?.onPick((p) => { if (PICK_STEPS.includes(stepRef.current)) setPlace(placeAt(p.lat, p.lon)) }), [engine, placeAt])

  // Keyboard: ← / → move through the tour, space plays and pauses, + / − zoom.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, select, textarea, [role="slider"], [contenteditable="true"]') || e.altKey || e.ctrlKey || e.metaKey) return
      if (e.key === '+' || e.key === '=') { e.preventDefault(); engine?.zoomBy(0.65) }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); engine?.zoomBy(1 / 0.65) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1) }
      else if (e.key === ' ' && !el.closest('button, a, summary')) {
        e.preventDefault()
        const s = store.get()
        if (isTimeStep(step)) { if (s.playing) director.pause(); else director.play() }
        else if (step === 'season') { if (s.seasonPlaying) director.pauseSeason(); else director.playSeason() }
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [go, index, step, store, director, engine])

  // ---- words ----
  const tModis = periodMin(satById('A').alt_km), tViirs = periodMin(satById('N').alt_km)
  const swM = Math.round((2 * swathHalfKm(satById('A'))) / 10) * 10, swV = Math.round((2 * swathHalfKm(satById('N'))) / 10) * 10
  const byGroup = (sensor: Sensor, pass: 'D' | 'N') => groups.find((g) => g.sensor === sensor && g.pass === pass)?.total ?? 0
  const mEdge = pixelSize(satById('A'), satById('A').max_scan_deg), vEdge = pixelSize(satById('N'), satById('N').max_scan_deg)
  const mScan = pixelSize(satById('A'), Math.min(scan, 55)), vScan = pixelSize(satById('N'), Math.min(scan, 56.28))
  const binKm2 = BIN_DEG * 111.19 * BIN_DEG * 111.19 * Math.cos((centre.lat * Math.PI) / 180)
  const nameAt = (c: LatLon) => (districts.data ? unitAt(districts.data, c.lat, c.lon)?.name_en : undefined)
  const peak = busyMonths.length ? busyMonths.reduce((a, b) => (b.c.n > a.c.n ? b : a)) : undefined
  const first = busyMonths[0], lastM = busyMonths.at(-1)
  const nokiln = meta?.gate_branch === 'nokiln' || meta?.gate_branch === 'partial'
  const source = (href: string, text: string) => <a className="text-orbit underline" href={href} target="_blank" rel="noreferrer">{text}</a>
  const here = GROUND_STEPS.includes(step) ? ch3 : ch1
  const placeControl = (
    <div className="space-place">
      <div className="flex items-center gap-2">
        <span className="space-pin-dot" aria-hidden />
        <span className="min-w-0 truncate text-sm"><span className="text-muted">Place:</span> <b className="font-semibold text-ink">{here.name}</b></span>
        {place && <button type="button" className="space-icon-btn ml-auto" onClick={() => setPlace(null)} aria-label="Back to Bangladesh" title="Back to Bangladesh"><Icon name="cross" className="h-3.5 w-3.5" /></button>}
      </div>
      <PlaceSearch entries={entries} onPick={pickHit} loading={!cityFile.data || !countries.data} />
      <p className="text-xs text-muted">Or click anywhere on the globe.</p>
    </div>
  )

  const content: Record<Step, { text: ReactNode; controls?: ReactNode; more?: ReactNode }> = {
    intro: {
      text: <>These five satellites carry the fire cameras behind Kiln Watch. Each laps the Earth about 14 times a day, pole to pole, while the planet turns beneath it.</>,
      controls: placeControl,
      more: <>
        <p>Terra and Aqua carry <Gloss k="MODIS" />; Suomi NPP, NOAA-20 and NOAA-21 carry <Gloss k="VIIRS" />. One lap takes <span className="num">{tModis.toFixed(0)}</span> minutes for MODIS and <span className="num">{tViirs.toFixed(0)}</span> for VIIRS.</p>
        <p>Their orbits keep pace with the Sun, so each crosses any place at about the same local time every day, and again in the middle of the night.</p>
        <p className="text-muted">Terra (since 2020) and Aqua (since 2022) are drifting from these times as their fuel runs out; NASA plans to stop Suomi NPP science data in November 2026 ({source('https://science.nasa.gov/mission/a-train', 'NASA')}).
          The orbits here are a model of each design orbit, placed so the day pass crosses the chosen place: the right shape, speed and local times, not the exact recorded path.</p>
      </>,
    },
    passes: {
      text: ch1InBD
        ? <>Press play. Time slows each time a satellite passes over {place ? <b>{place.name}</b> : 'Bangladesh'}, and the fires it recorded that day light up as 11 km squares. Tap a dot on the bar to jump to a pass.</>
        : <>Press play. Time slows each time a satellite passes over <b>{ch1.name}</b>. Tap a dot on the bar to jump to a pass. Fire squares appear only in Bangladesh, where Kiln Watch has its own fire data.</>,
      controls: (
        <div className="space-y-3">
        {placeControl}
        <label className="space-field"><span>Day</span>
          <select value={passDay} onChange={(e) => setPickedDay(+e.target.value)} disabled={!days.length}>
            {days.map((d) => <option key={d.day} value={d.day}>{fmtDay(d.day)} · {d.cells} fire cells in Bangladesh</option>)}
          </select>
        </label>
        </div>),
      more: <>
        <p>The coloured band is the strip a camera sees in one pass: about <span className="num">{swM.toLocaleString('en')}</span> km wide for MODIS, <span className="num">{swV.toLocaleString('en')}</span> km for VIIRS.</p>
        <table className="w-full text-[13px]">
          <thead><tr><th>Satellite</th><th>Day</th><th>Night</th><th className="n">Fire cells</th></tr></thead>
          <tbody>{SATS.map((s) => {
            const d = passes.find((p) => p.sat === s.id && p.pass === 'D'), n = passes.find((p) => p.sat === s.id && p.pass === 'N')
            return <tr key={s.id} className={LIT.has(s.id) ? '' : 'text-muted'}><td>{s.name}</td><td className="num">{d ? fmtLocal(d.t_utc) : '–'}</td>
              <td className="num">{n ? fmtLocal(n.t_utc) : '–'}</td><td className="n num">{LIT.has(s.id) ? `${byGroup(s.id, 'D')} · ${byGroup(s.id, 'N')}` : 'not mapped'}</td></tr>
          })}</tbody>
        </table>
        <p className="text-muted">{ch1InBD ? 'Bangladesh time (UTC+6)' : `Local solar time at ${ch1.name} (UTC${offsetH >= 0 ? '+' : '−'}${Math.abs(offsetH)})`}, from the orbit model. Kiln Watch’s fire data covers Bangladesh and keeps Aqua and Suomi NPP only, so the other three pass without lighting anything.</p>
      </>,
    },
    season: {
      text: <>Each column is an 11 km square that grows every day a fire is seen there. Glowing squares burned in the last week.</>,
      controls: (
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-field"><span>Season</span>
            <select value={season ?? ''} onChange={(e) => setPickedSeason(e.target.value)}>{seasons.map((s) => <option key={s}>{s}</option>)}</select>
          </label>
          <div className="space-field"><span aria-hidden>Passes</span>
            <SegmentedToggle label="Passes" value={filter} onChange={setFilter} options={[['all', 'All'], ['D', 'Day'], ['N', 'Night']]} />
          </div>
        </div>),
      more: sf && <>
        <p><span className="num">{sf.total.toLocaleString('en')}</span> fire-days in {sf.season} ({filter === 'all' ? 'all passes' : filter === 'D' ? 'day passes' : 'night passes'}), across <span className="num">{sf.bins.length}</span> squares.
          A fire-day is one 1 km grid cell with fire seen on one date.</p>
        <p className="text-muted">Squares, not fire spots: no single farm or kiln can be picked out. The season replay covers Bangladesh only: it is Kiln Watch’s own fire record.</p>
      </>,
    },
    drift: {
      text: peak && first && lastM && first !== lastM
        ? <>Burning peaks in <b>{MONTHS[peak.m]}</b>. Its centre moves from {nameAt(first.c) ? <b>{nameAt(first.c)}</b> : 'the border'} in {MONTHS[first.m]} to {nameAt(lastM.c) ? <b>{nameAt(lastM.c)}</b> : 'the border'} in {MONTHS[lastM.m]}, <span className="num">{Math.round(distanceKm(first.c.lat, first.c.lon, lastM.c.lat, lastM.c.lon))}</span> km away.</>
        : <>The line joins the centre of each month’s fires through the season.</>,
      more: <>
        <p>The line joins the fire-weighted centre of every month with at least 4% of the season’s fire-days{peak && sf ? <>; {MONTHS[peak.m]} alone has {Math.round((peak.c.n / (sf.total || 1)) * 100)}%</> : ''}. The columns are the whole season.</p>
        <p className="text-muted">A centre is an average position and can sit where there was no fire: it shows the season’s drift, not a place.</p>
      </>,
    },
    pixel: {
      text: <>A fire detection is one square: <b>{fmtKm(pixelSize(satById('N'), 0).scan_m)}</b> wide for VIIRS, <b>{fmtKm(pixelSize(satById('A'), 0).scan_m)}</b> for MODIS. Everything inside it becomes one reading.</>,
      controls: placeControl,
      more: <>
        <p>{!place && busiestBin ? `It opens on ${district?.properties.name_en ?? 'a district'}, where the season above had the most fire-days. ` : ''}A small fire fills more of a small square, which is why VIIRS sees fires MODIS misses (<Link className="text-orbit underline" to={'/how' + q}>How it works</Link>).</p>
        <p className="text-muted">Online, the ground is the Sentinel-2 cloudless mosaic of 2024 (10 m). Offline, the built-in NASA image is too coarse to show fields.</p>
      </>,
    },
    edge: {
      text: <>To cover its whole strip a camera looks sideways, and the further it looks, the bigger the square. Drag to look further out.</>,
      controls: (
        <div className="space-y-3">
        <label className="space-field w-full"><span>Looking sideways <b className="num text-ink">{scan}°</b></span>
          <input type="range" className="w-full accent-[var(--color-orbit)]" min={0} max={56} step={1} value={scan} onChange={(e) => setScan(+e.target.value)} />
          <span className="num text-xs text-muted">MODIS {fmtKm(mScan.scan_m)} × {fmtKm(mScan.track_m)} · VIIRS {fmtKm(vScan.scan_m)} × {fmtKm(vScan.track_m)}</span>
        </label>
        {placeControl}
        </div>),
      more: <>
        <p>At the very edge MODIS covers <span className="num">{(mEdge.scan_m / 1000).toFixed(1)} × {(mEdge.track_m / 1000).toFixed(1)}</span> km, almost five times wider than overhead. VIIRS combines fewer samples off to the side, so it only grows to about <span className="num">{(vEdge.scan_m / 1000).toFixed(1)}</span> km.</p>
        <p className="text-muted">Sizes computed from the viewing geometry; see {source('https://www.earthdata.nasa.gov/data/tools/firms/active-fire-data-attributes-modis-viirs', 'NASA FIRMS')} on pixel size.</p>
      </>,
    },
    scale: {
      text: <>The orange ruler is <b>{KILN_M} m</b>, about a brick kiln’s length: a VIIRS square is seven kilns wide.{nokiln && <> That is one reason fire satellites could not see the kilns in our tests.</>}</>,
      controls: placeControl,
      more: <>
        <p>A kiln’s fire burns inside a closed trench, so its heat is a small, faint part of the square. {nokiln && <>The kiln pages use night lights instead (<Link className="text-orbit underline" to={'/evidence' + q}>evidence</Link>).</>}</p>
        <p className="text-muted">A typical zigzag kiln’s central structure is 48–59 m long ({source('https://www.cseindia.org/content/downloadreports/8525', 'CSE India, design manual')}). The ruler marks a length only; it is never placed at a real kiln.</p>
      </>,
    },
    square: {
      text: <>{ch3InBD ? 'One square from the season replay' : 'One 0.1° square like those in the season replay'} is about <b className="num">{Math.round(binKm2)}</b> km², room for <b className="num">{(Math.round(binKm2 / 0.375 ** 2 / 10) * 10).toLocaleString('en')}</b> VIIRS pixels. The map shows areas, never a single farm or kiln.</>,
      controls: placeControl,
      more: <p className="flex flex-wrap gap-x-3"><Link className="text-orbit underline" to={'/how' + q}>How it works</Link><Link className="text-orbit underline" to={'/sensors' + q}>The 2012 sensor switch</Link><Link className="text-orbit underline" to={'/trust' + q}>Can you trust it?</Link></p>,
    },
  }

  const about = <>
    <p className="font-semibold">About this page</p>
    <p>A guided tour in three chapters. Use <b>Next</b> or the ← → keys. Drag, or swipe with two fingers, to move the globe; pinch, use a mouse wheel, double-click or press + / − to zoom; right-drag to tilt; click a place to follow it.</p>
    <ul className="list-disc space-y-1 pl-4 text-muted">
      <li>Orbits are a model of each satellite’s design orbit: pass times are close; exact paths on past dates are not.</li>
      <li>Fires are grouped into 0.1° squares (about 11 km) of fire-days from Aqua and Suomi NPP.</li>
      <li>Imagery: NASA Blue Marble and Black Marble (GIBS); Sentinel-2 cloudless 2024 by EOX (modified Copernicus data, CC BY-NC-SA 4.0).</li>
    </ul>
  </>
  const c = content[step]

  return (
    <div ref={box} className="space-night relative w-full overflow-hidden bg-[#02040a]" style={{ height, ['--card-w' as string]: `${cardW}px`, ['--card-h' as string]: `${cardH}px` }}>
      <span ref={tokens} className="hidden" aria-hidden />
      <h1 className="sr-only">Seen from space</h1>
      <div className="absolute inset-x-0 top-0" style={{ bottom: cardH }}>
        <SpaceStage onEngine={setEngine} labels={labels} labelKey={`${step}:${ch1.name}:${ch3.name}:${season}:${filter}`} moved={moved} onRecenter={fly} />
      </div>

      <div ref={card} className="contents">
        <StoryCard chapters={CHAPTERS} steps={STEPS} index={index} onGo={go} open={cardOpen} onOpen={setCardOpen} controls={c.controls} more={c.more} about={about}>
          {lang === 'bn' && <p className="mb-1 text-xs text-muted" lang="bn">{t('englishOnly')}</p>}
          {!tiles && !tilesError ? <p className="text-muted">Loading the fire map…</p> : tilesError ? <p className="text-muted">The fire map could not load: {tilesError}</p> : c.text}
        </StoryCard>
      </div>

      {isTimeStep(step) && pal && (
        <div className="space-timebar">
          <DayBar director={director} store={store} dayStartUtc={dayStartUtc} offsetH={offsetH} clockLabel={clockLabel} passes={passes} colors={pal.sats} names={NAMES} lit={step === 'passes' ? LIT : undefined} />
        </div>
      )}
      {step === 'season' && sf && (
        <div className="space-timebar">
          <SeasonBar director={director} store={store} nDays={sf.n_days} day0Utc={dayToDate(sf.day0).getTime()} totals={perDay} season={sf.season} />
        </div>
      )}
    </div>
  )
}
