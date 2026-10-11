import type { Sensor } from '../../lib/types'

// The contract between the "Seen from space" page and its two globes. The page computes everything (orbits, swaths,
// fire squares, footprints) in lib/space; an engine only draws what it is handed, so the two globes cannot disagree.

export interface LatLon { lat: number; lon: number }

/** Google Earth-style camera: look at (lat, lon) from `range_km` away, tilted from straight down, turned from north. */
export interface CameraView { lat: number; lon: number; range_km: number; tilt_deg: number; heading_deg: number }

export interface SatMark { id: Sensor; color: string; lat: number; lon: number; alt_km: number; dim: boolean }
export interface Line { id: string; color: string; width_px: number; points: LatLon[]; alt_km?: number; opacity?: number; dashed?: boolean }
/** A filled area: a small ring (footprints), or a rows × columns grid that follows Earth's curve (swaths). */
export interface Area { id: string; color: string; opacity: number; ring?: LatLon[]; grid?: LatLon[][] }
export interface Column { lat: number; lon: number; height_km: number; color: string; glow: number }
/** `max_range_km`: hide the label when the camera is further than this (ground-size notes on a far-away Earth). */
export interface Label { id: string; lat: number; lon: number; alt_km: number; text: string; color: string; kind: 'sat' | 'place' | 'size' | 'pin'; max_range_km?: number }

export type LineLayer = 'outline' | 'orbit' | 'track' | 'footprint' | 'path'
export type AreaLayer = 'swath' | 'footprint'

export interface Engine {
  kind: 'cesium' | 'globe'
  setTime(t_utc: number): void
  setSats(sats: SatMark[]): void
  setLines(layer: LineLayer, lines: Line[]): void
  setAreas(layer: AreaLayer, areas: Area[]): void
  setColumns(cols: Column[], width_km: number): void
  /** Sharp ground imagery for close views (Sentinel-2 online; the bundled Bangladesh image offline). */
  setCloseImagery(on: boolean): void
  view(): CameraView
  /** `ease`: 'inOut' for moves between stops, 'out' for the arrival from deep space (fast, then settling). */
  flyTo(v: CameraView, ms: number, ease?: 'inOut' | 'out'): void
  /** The camera range (km) at which the whole Earth spans `fraction` of the screen's shorter side. */
  fitRange(fraction: number): number
  zoomBy(factor: number): void
  /** Screen position of a point, or null when it is behind Earth or off screen. */
  project(lat: number, lon: number, alt_km: number): { x: number; y: number } | null
  onFrame(cb: () => void): () => void
  /** The reader moved the camera (drag, pinch, Ctrl + wheel): the page stops steering it. */
  onUserMove(cb: () => void): () => void
  /** A click or tap on the Earth (not a drag): where it landed. */
  onPick(cb: (p: LatLon) => void): () => void
  destroy(): void
}

export const DEFAULT_VIEW: CameraView = { lat: 18, lon: 88, range_km: 21000, tilt_deg: 0, heading_deg: 0 }
