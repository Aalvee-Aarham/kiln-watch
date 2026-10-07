import type { FC, UnitProps } from './types'

/** Even-odd ray cast: is (lat, lon) inside this ring of [lon, lat] positions? */
function inRing(ring: GeoJSON.Position[], lat: number, lon: number): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Point in a GeoJSON Polygon or MultiPolygon (holes respected). */
export function inGeometry(g: GeoJSON.Geometry, lat: number, lon: number): boolean {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
  return polys.some(([outer, ...holes]) => inRing(outer, lat, lon) && !holes.some((h) => inRing(h, lat, lon)))
}

/** The area containing a location, if any. Runs on the device: the location is never sent anywhere. */
export const unitAt = (fc: FC, lat: number, lon: number): UnitProps | undefined =>
  fc.features.find((f) => inGeometry(f.geometry, lat, lon))?.properties

/** District id of an upazila id (BD + 4-digit district code + 4-digit upazila code); districts map to themselves. */
export const districtOf = (unitId: string) => unitId.slice(0, 6)
