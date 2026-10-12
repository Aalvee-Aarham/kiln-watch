import { BBOX, SOUTH_ASIA_BOX, type Box } from './box'
// NASA GIBS WMS GetMap images in EPSG:4326, so each sits on a lon/lat map by its corners. Bundled for offline use;
// fetched only when a background is chosen. Coarse world first, then sharper South Asia and Bangladesh on top.
import worldDay from '../assets/basemap/world_bluemarble-ng.jpg'
import worldNight from '../assets/basemap/world_black-marble-2016.jpg'
import saDay from '../assets/basemap/south-asia_bluemarble-ng.jpg'
import saNight from '../assets/basemap/south-asia_black-marble-2016.jpg'
import bdDay from '../assets/basemap/bluemarble-ng_bd.jpg'
import bdNight from '../assets/basemap/black-marble-2016_bd.jpg'

// Map background choice shared by BdMap and WorldMap: none, NASA day imagery, or NASA night lights. Remembered per viewer.
export type Layer = 'none' | 'day' | 'night'
export const LAYERS: [Layer, string, string][] = [['none', 'Map', ''], ['day', 'Satellite', 'NASA Blue Marble Next Generation via GIBS'],
  ['night', 'Night lights', 'NASA Black Marble 2016 via GIBS']]
export const readLayer = (): Layer => { try { const v = localStorage.getItem('kwBasemap'); return v === 'day' || v === 'night' ? v : 'none' } catch { return 'none' } }
export const saveLayer = (l: Layer) => { try { localStorage.setItem('kwBasemap', l) } catch { /* this page only */ } }

/** [extent, day image, night image], coarse to sharp: draw in this order. */
export const IMAGERY: [Box, string, string][] = [[[-180, -90, 180, 90], worldDay, worldNight], [SOUTH_ASIA_BOX, saDay, saNight], [BBOX, bdDay, bdNight]]
