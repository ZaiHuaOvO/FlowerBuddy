import { describe, expect, it } from 'vitest'
import { computeResizedBounds } from '../../src/main/windows/memo-card-geometry'

const START = { x: 100, y: 100, width: 300, height: 200 }
const LIMITS = { minWidth: 180, minHeight: 120, maxWidth: 720, maxHeight: 560 }

describe('memo card resize', () => {
  it('resizes from the south-east corner', () => {
    expect(computeResizedBounds(START, 'se', 40, 30, LIMITS)).toEqual({
      x: 100,
      y: 100,
      width: 340,
      height: 230
    })
  })

  it('keeps the opposite corner fixed on north-west and north-east drags', () => {
    expect(computeResizedBounds(START, 'nw', -20, -10, LIMITS)).toEqual({
      x: 80,
      y: 90,
      width: 320,
      height: 210
    })
    expect(computeResizedBounds(START, 'ne', 20, -10, LIMITS)).toEqual({
      x: 100,
      y: 90,
      width: 320,
      height: 210
    })
    expect(computeResizedBounds(START, 'sw', -20, 10, LIMITS)).toEqual({
      x: 80,
      y: 100,
      width: 320,
      height: 210
    })
  })

  it('clamps to the configured limits', () => {
    const tooSmall = computeResizedBounds(START, 'se', -1000, -1000, LIMITS)
    expect(tooSmall.width).toBe(180)
    expect(tooSmall.height).toBe(120)

    const tooLarge = computeResizedBounds(START, 'se', 1000, 1000, LIMITS)
    expect(tooLarge.width).toBe(720)
    expect(tooLarge.height).toBe(560)

    const nwTooLarge = computeResizedBounds(START, 'nw', -1000, -1000, LIMITS)
    expect(nwTooLarge).toEqual({ x: -320, y: -260, width: 720, height: 560 })
  })
})
