import type { Box } from './box'

/** World map view in degrees: x = longitude, y = −latitude (plate carrée, the same grid as NASA's EPSG:4326 images). */
export type View = { x: number; y: number; w: number; h: number }
export type City = { name: string; nameBn: string; lat: number; lon: number; rank: number; pop: number | null; adm0: string; adm1: string | null; capital: boolean }

export const MIN_W = 0.4  // ≈ 40 km across: closer than any outline here is drawn
export const MAX_W = 400  // a little more than the whole globe
export const STATES_W = 50 // states and provinces appear below this width (degrees); above it, countries are the units

/** Natural Earth city records (kilnwatch/geography.py), kept in their file order: most important first. */
export function parseCities(raw: { fields: string[]; rows: (string | number | null)[][] }): City[] {
  const i = (f: string) => raw.fields.indexOf(f)
  const [n, b, la, lo, r, p, a0, a1, c] = ['name_en', 'name_bn', 'lat', 'lon', 'rank', 'pop', 'adm0', 'adm1', 'capital'].map(i)
  return raw.rows.map((x) => ({ name: String(x[n]), nameBn: String(x[b] ?? x[n]), lat: Number(x[la]), lon: Number(x[lo]), rank: Number(x[r]),
    pop: x[p] == null ? null : Number(x[p]), adm0: String(x[a0]), adm1: x[a1] == null ? null : String(x[a1]), capital: Number(x[c]) > 0 }))
}

/** The view that shows a lon/lat box (W, S, E, N) whole, centred, in a frame of the given height/width ratio. */
export function boxView([w, s, e, n]: Box, aspect: number, pad = 1.08): View {
  const bw = (e - w) * pad, bh = (n - s) * pad
  const vw = Math.min(MAX_W, Math.max(MIN_W, bw, bh / aspect))
  return { x: (w + e) / 2 - vw / 2, y: -(s + n) / 2 - (vw * aspect) / 2, w: vw, h: vw * aspect }
}

/** Keep the zoom within limits and the centre on the globe (with a little slack beyond its edges). */
export function clampView(v: View, aspect: number): View {
  const w = Math.min(MAX_W, Math.max(MIN_W, v.w)), h = w * aspect
  const cx = Math.min(190, Math.max(-190, v.x + v.w / 2)), cy = Math.min(95, Math.max(-95, v.y + v.h / 2))
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

/** Zoom by `f` (> 1 = in) keeping the point (px, py) where it is on screen. */
export function zoomView(v: View, f: number, px: number, py: number, aspect: number): View {
  const w = Math.min(MAX_W, Math.max(MIN_W, v.w / f)), k = w / v.w
  return clampView({ x: px - (px - v.x) * k, y: py - (py - v.y) * k, w, h: w * aspect }, aspect)
}

/** The least important city rank (Natural Earth SCALERANK, 0 = most important) worth naming at this width. */
export function maxRankFor(w: number): number {
  return w > 150 ? 1 : w > 60 ? 3 : w > 25 ? 5 : w > 10 ? 7 : 10
}

const inView = (v: View, lon: number, lat: number) => lon >= v.x && lon <= v.x + v.w && -lat >= v.y && -lat <= v.y + v.h

/** Cities to draw: important enough for the zoom, inside the view, at most `cap` (bounded DOM), most important first. */
export function visibleCities(cities: City[], v: View, cap = 250): City[] {
  const max = maxRankFor(v.w), out: City[] = []
  for (const c of cities) {
    if (c.rank <= max && inView(v, c.lon, c.lat)) out.push(c)
    if (out.length >= cap) break
  }
  return out
}

/** Screen size of a city's name, in pixels: the most important cities a little larger. */
export const labelPx = (c: City) => (c.rank <= 2 ? 13 : 12)

/** Atlas-style greedy placement: cities in importance order, each named only if its label (dot included) overlaps no label
 * already placed; the rest are left out, dot and all. `always` (the picked city) is placed first. Units are degrees. */
export function placeLabels(cities: City[], degPerPx: number, always?: City): City[] {
  const boxes: [number, number, number, number][] = [], out: City[] = []
  for (const c of always ? [always, ...cities.filter((x) => x !== always)] : cities) {
    const fs = labelPx(c), w = (c.name.length * fs * 0.56 + 12) * degPerPx, h = fs * 1.25 * degPerPx
    const b: [number, number, number, number] = [c.lon - 5 * degPerPx, -c.lat - h * 0.7, c.lon - 5 * degPerPx + w, -c.lat + h * 0.3]
    if (boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue
    boxes.push(b)
    out.push(c)
  }
  return out
}

export type Hit = { kind: 'city' | 'state' | 'country'; id: string; name: string; nameBn: string; sub: string; weight?: number }

/** Up to `limit` matches for a typed name in English or Bangla, best first: exact names, then names that start with the
 * text, then names containing it; within each, lower `weight` first (countries, states, then cities by importance). */
export function searchPlaces(entries: Hit[], q: string, limit = 8): Hit[] {
  const t = q.trim().toLowerCase()
  if (t.length < 2) return []
  const scored: [number, number, Hit][] = []
  for (const e of entries) {
    const en = e.name.toLowerCase()
    const m = en === t || e.nameBn === t ? 0 : en.startsWith(t) || e.nameBn.startsWith(t) ? 1 : en.includes(t) || e.nameBn.includes(t) ? 2 : -1
    if (m >= 0) scored.push([m, e.weight ?? 0, e])
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, limit).map((x) => x[2])
}
