import { describe, expect, it } from 'vitest'
import { REGION_REGISTRY } from './regionRegistry'
import { bboxOf } from './geo'
import type { FC } from './types'
// Committed public boundaries (COD-AB districts, Natural Earth states and countries): geography, not measurements.
import districts from '../../fixtures/nokiln/data/aoi/districts.geojson?raw'
import states from '../../fixtures/nokiln/data/aoi/world_states.geojson?raw'
import countries from '../../fixtures/nokiln/data/aoi/world_countries.geojson?raw'

const byId = new Map<string, GeoJSON.Geometry>()
for (const raw of [districts, states, countries]) for (const f of (JSON.parse(raw) as FC).features) byId.set(f.properties.unit_id, f.geometry)

describe('region registry', () => {
  it('holds no typed figures: only names, aliases, map extent and where the real data lives', () => {
    const allowed = ['key', 'name', 'country', 'stateOrDivision', 'coords', 'bbox', 'aliases', 'unit', 'alsoUnits']
    for (const p of Object.values(REGION_REGISTRY)) expect(Object.keys(p).filter((k) => !allowed.includes(k))).toEqual([])
  })
  // 0.5° (about 55 km) of slack: Natural Earth simplifies small island states (the Maldives keeps two islands).
  it('every place maps to boundaries that exist, and its centre lies inside their extent', () => {
    for (const p of Object.values(REGION_REGISTRY)) {
      const ids = p.unit.kind === 'bd' ? [p.unit.unit_id, ...(p.alsoUnits ?? [])] : p.unit.ids
      const boxes = ids.map((id) => { const g = byId.get(id); expect(g, `${p.key}: ${id}`).toBeDefined(); return bboxOf(g!) })
      const [w, s, e, n] = [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))]
      const [lon, lat] = p.coords
      expect(lon >= w - 0.5 && lon <= e + 0.5 && lat >= s - 0.5 && lat <= n + 0.5, `${p.key} centre outside its units`).toBe(true)
    }
  })
})
