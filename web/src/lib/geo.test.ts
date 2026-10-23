import { describe, expect, it } from 'vitest'
import { bboxOf } from './geo'

describe('bboxOf', () => {
  it('a unit square is [0, 0, 1, 1]; two polygons give their union box', () => {
    expect(bboxOf({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] })).toEqual([0, 0, 1, 1])
    expect(bboxOf({ type: 'MultiPolygon', coordinates: [
      [[[0, 0], [1, 0], [1, 1], [0, 0]]], [[[3, -2], [4, -2], [4, 5], [3, -2]]],
    ] })).toEqual([0, -2, 4, 5])
  })
})
