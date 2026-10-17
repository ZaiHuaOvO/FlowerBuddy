import { describe, expect, it } from 'vitest'
import {
  clampToVisibleArea,
  computePetWindowSize,
  defaultPetPosition,
  placeOverlay,
  resizeKeepingBottomCenter,
  type Rect
} from '../../src/main/windows/geometry'

const PRIMARY_WORK_AREA: Rect = { x: 0, y: 0, width: 1920, height: 1040 }

describe('computePetWindowSize', () => {
  it('uses a 220px base height at scale 1', () => {
    expect(computePetWindowSize(512, 512, 1)).toEqual({ width: 220, height: 220 })
  })

  it('preserves the aspect ratio of wide and tall images', () => {
    const wide = computePetWindowSize(1000, 500, 1)
    expect(wide.height).toBe(220)
    expect(wide.width).toBe(440)

    const tall = computePetWindowSize(500, 1000, 1)
    expect(tall.height).toBe(220)
    expect(tall.width).toBe(110)
  })

  it('scales with the configured factor and clamps the factor', () => {
    expect(computePetWindowSize(512, 512, 2)).toEqual({ width: 440, height: 440 })
    expect(computePetWindowSize(512, 512, 5)).toEqual({ width: 440, height: 440 })
    expect(computePetWindowSize(512, 512, 0.1)).toEqual({ width: 110, height: 110 })
  })

  it('caps extreme wide images at the maximum width', () => {
    const size = computePetWindowSize(10000, 100, 1)
    expect(size.width).toBe(700)
    expect(size.height).toBe(7)
  })

  it('caps extreme tall images at the bounds without distorting the ratio', () => {
    const size = computePetWindowSize(100, 10000, 1)
    expect(size.width).toBe(6)
    expect(size.height).toBe(600)
    expect(size.width / size.height).toBeCloseTo(0.01, 2)
  })

  it('falls back to a sane size for invalid dimensions', () => {
    expect(computePetWindowSize(0, 0, Number.NaN)).toEqual({ width: 220, height: 220 })
  })
})

describe('clampToVisibleArea', () => {
  it('leaves a window that is already visible untouched', () => {
    const bounds: Rect = { x: 100, y: 100, width: 220, height: 220 }
    expect(clampToVisibleArea(bounds, [PRIMARY_WORK_AREA])).toEqual({ x: 100, y: 100 })
  })

  it('moves a mostly off-screen window fully into the work area', () => {
    const bounds: Rect = { x: 1890, y: 1010, width: 220, height: 220 }
    expect(clampToVisibleArea(bounds, [PRIMARY_WORK_AREA])).toEqual({ x: 1700, y: 820 })
  })

  it('returns a window from a removed monitor to the nearest display', () => {
    const bounds: Rect = { x: -3000, y: 100, width: 220, height: 220 }
    const position = clampToVisibleArea(bounds, [PRIMARY_WORK_AREA])
    expect(position).toEqual({ x: 0, y: 100 })
  })

  it('handles an empty display list', () => {
    const bounds: Rect = { x: 5, y: 6, width: 10, height: 10 }
    expect(clampToVisibleArea(bounds, [])).toEqual({ x: 5, y: 6 })
  })
})

describe('position helpers', () => {
  it('places the pet at the bottom-right of the work area', () => {
    expect(defaultPetPosition(PRIMARY_WORK_AREA, { width: 220, height: 220 })).toEqual({
      x: 1676,
      y: 796
    })
  })

  it('keeps the bottom-centre anchored while resizing', () => {
    const bounds: Rect = { x: 500, y: 300, width: 220, height: 220 }
    expect(resizeKeepingBottomCenter(bounds, { width: 330, height: 330 })).toEqual({
      x: 445,
      y: 190
    })
  })
})

describe('placeOverlay', () => {
  const anchor: Rect = { x: 800, y: 500, width: 220, height: 220 }

  it('places a menu to the left of the pet', () => {
    expect(placeOverlay(anchor, { width: 236, height: 272 }, PRIMARY_WORK_AREA, 'left')).toEqual({
      x: 556,
      y: 474
    })
  })

  it('flips to the right when there is no room on the left', () => {
    const leftEdge: Rect = { x: 10, y: 500, width: 220, height: 220 }
    expect(placeOverlay(leftEdge, { width: 236, height: 272 }, PRIMARY_WORK_AREA, 'left')).toEqual({
      x: 238,
      y: 474
    })
  })

  it('places a bubble above the pet', () => {
    expect(placeOverlay(anchor, { width: 340, height: 168 }, PRIMARY_WORK_AREA, 'above')).toEqual({
      x: 740,
      y: 324
    })
  })

  it('flips below when the bubble would leave the screen', () => {
    const topEdge: Rect = { x: 800, y: 10, width: 220, height: 220 }
    expect(placeOverlay(topEdge, { width: 340, height: 168 }, PRIMARY_WORK_AREA, 'above')).toEqual({
      x: 740,
      y: 238
    })
  })

  it('clamps overlays to the work area', () => {
    const rightEdge: Rect = { x: 1800, y: 500, width: 220, height: 220 }
    expect(
      placeOverlay(rightEdge, { width: 340, height: 168 }, PRIMARY_WORK_AREA, 'right')
    ).toEqual({ x: 1452, y: 526 })
  })
})
