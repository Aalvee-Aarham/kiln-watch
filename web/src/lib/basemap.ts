// Map background choice shared by BdMap and WorldMap: none, NASA day imagery, or NASA night lights. Remembered per viewer.
export type Layer = 'none' | 'day' | 'night'
export const LAYERS: [Layer, string, string][] = [['none', 'Map', ''], ['day', 'Satellite', 'NASA Blue Marble Next Generation via GIBS'],
  ['night', 'Night lights', 'NASA Black Marble 2016 via GIBS']]
export const readLayer = (): Layer => { try { const v = localStorage.getItem('kwBasemap'); return v === 'day' || v === 'night' ? v : 'none' } catch { return 'none' } }
export const saveLayer = (l: Layer) => { try { localStorage.setItem('kwBasemap', l) } catch { /* this page only */ } }
