import { describe, expect, it } from 'vitest'
import {
  computeNextDue,
  deferToActive,
  isWithinRanges,
  parseTimeToMinutes
} from '../../src/main/modules/interval-reminder/schedule'

const RANGES = [
  { start: '09:00', end: '12:00' },
  { start: '13:00', end: '18:00' }
]

function at(hours: number, minutes = 0, day = 18): Date {
  return new Date(2026, 9, day, hours, minutes, 0, 0)
}

describe('interval reminder schedule', () => {
  it('checks effective ranges, including overnight ranges', () => {
    expect(isWithinRanges(at(10), RANGES)).toBe(true)
    expect(isWithinRanges(at(12), RANGES)).toBe(false)
    expect(isWithinRanges(at(12, 30), RANGES)).toBe(false)
    expect(isWithinRanges(at(13), RANGES)).toBe(true)
    expect(isWithinRanges(at(18), RANGES)).toBe(false)
    expect(isWithinRanges(at(3), [])).toBe(true)

    const overnight = [{ start: '22:00', end: '06:00' }]
    expect(isWithinRanges(at(23), overnight)).toBe(true)
    expect(isWithinRanges(at(5, 59), overnight)).toBe(true)
    expect(isWithinRanges(at(6), overnight)).toBe(false)
    expect(isWithinRanges(at(12), overnight)).toBe(false)
  })

  it('defers outside times to the next range start', () => {
    expect(deferToActive(at(8).getTime(), RANGES)).toBe(at(9).getTime())
    expect(deferToActive(at(12, 30).getTime(), RANGES)).toBe(at(13).getTime())
    expect(deferToActive(at(19).getTime(), RANGES)).toBe(at(9, 0, 19).getTime())
    expect(deferToActive(at(10).getTime(), RANGES)).toBe(at(10).getTime())
    expect(deferToActive(at(10).getTime(), [])).toBe(at(10).getTime())
    expect(deferToActive(at(7).getTime(), [{ start: '22:00', end: '06:00' }])).toBe(
      at(22).getTime()
    )
  })

  it('applies the interval and random jitter', () => {
    const base = {
      intervalMinutes: 30,
      ranges: [] as Array<{ start: string; end: string }>,
      randomEnabled: false,
      randomJitterMinutes: 5
    }
    expect(computeNextDue(at(9, 10).getTime(), base)).toBe(at(9, 40).getTime())

    const withJitter = { ...base, randomEnabled: true }
    expect(computeNextDue(at(9, 10).getTime(), withJitter, () => 0)).toBe(at(9, 35).getTime())
    expect(computeNextDue(at(9, 10).getTime(), withJitter, () => 0.5)).toBe(at(9, 40).getTime())
    const late = computeNextDue(at(9, 10).getTime(), withJitter, () => 0.999)
    expect(late).toBeGreaterThanOrEqual(at(9, 44).getTime())
    expect(late).toBeLessThanOrEqual(at(9, 45).getTime())
  })

  it('defers the computed interval when it lands outside the active window', () => {
    const config = {
      intervalMinutes: 30,
      ranges: RANGES,
      randomEnabled: false,
      randomJitterMinutes: 0
    }
    expect(computeNextDue(at(11, 50).getTime(), config)).toBe(at(13).getTime())
    expect(computeNextDue(at(21, 50).getTime(), config)).toBe(at(9, 0, 19).getTime())
  })

  it('parses HH:mm defensively', () => {
    expect(parseTimeToMinutes('09:30')).toBe(570)
    expect(parseTimeToMinutes('9:05')).toBe(545)
    expect(parseTimeToMinutes('24:00')).toBeNull()
    expect(parseTimeToMinutes('9:5')).toBeNull()
  })
})
