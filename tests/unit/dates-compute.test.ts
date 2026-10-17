import { describe, expect, it } from 'vitest'
import {
  daysUntil,
  formatCountdown,
  formatIsoDate,
  localDateOf,
  parseIsoDate
} from '../../src/main/modules/dates/dates-compute'

const TODAY = { year: 2026, month: 10, day: 17 }

describe('date parsing', () => {
  it('accepts valid calendar dates', () => {
    expect(parseIsoDate('2026-10-17')).toEqual({ year: 2026, month: 10, day: 17 })
    expect(parseIsoDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 })
  })

  it('rejects impossible dates', () => {
    expect(parseIsoDate('2026-02-29')).toBeNull()
    expect(parseIsoDate('2026-13-01')).toBeNull()
    expect(parseIsoDate('2026-00-10')).toBeNull()
    expect(parseIsoDate('2026-04-31')).toBeNull()
    expect(parseIsoDate('not-a-date')).toBeNull()
    expect(parseIsoDate('2026-1-1')).toBeNull()
  })

  it('formats local dates without timezone shifts', () => {
    expect(formatIsoDate(localDateOf(new Date(2026, 9, 17, 23, 30)))).toBe('2026-10-17')
    expect(formatIsoDate({ year: 2027, month: 1, day: 2 })).toBe('2027-01-02')
  })
})

describe('countdown rules', () => {
  it('handles today, tomorrow and past one-off events', () => {
    expect(daysUntil({ date: '2026-10-17', recurrence: 'none' }, TODAY)?.daysUntil).toBe(0)
    expect(daysUntil({ date: '2026-10-18', recurrence: 'none' }, TODAY)?.daysUntil).toBe(1)
    expect(daysUntil({ date: '2026-10-16', recurrence: 'none' }, TODAY)).toBeNull()
  })

  it('computes the next yearly occurrence across the year boundary', () => {
    const result = daysUntil({ date: '2020-01-02', recurrence: 'yearly' }, TODAY)
    expect(result?.occurrence).toEqual({ year: 2027, month: 1, day: 2 })
    expect(result?.daysUntil).toBeGreaterThan(0)
  })

  it('uses the current year when the yearly date is still ahead', () => {
    const result = daysUntil({ date: '2019-12-25', recurrence: 'yearly' }, TODAY)
    expect(result?.occurrence).toEqual({ year: 2026, month: 12, day: 25 })
    expect(result?.daysUntil).toBe(69)
  })

  it('treats a yearly event today as happening today', () => {
    const result = daysUntil({ date: '2011-10-17', recurrence: 'yearly' }, TODAY)
    expect(result?.occurrence).toEqual(TODAY)
    expect(result?.daysUntil).toBe(0)
  })

  it('falls back from February 29 to February 28 in non-leap years', () => {
    const result = daysUntil(
      { date: '2024-02-29', recurrence: 'yearly' },
      { year: 2026, month: 1, day: 1 }
    )
    expect(result?.occurrence).toEqual({ year: 2026, month: 2, day: 28 })
  })

  it('keeps February 29 in leap years', () => {
    const result = daysUntil(
      { date: '2020-02-29', recurrence: 'yearly' },
      { year: 2028, month: 1, day: 1 }
    )
    expect(result?.occurrence).toEqual({ year: 2028, month: 2, day: 29 })
  })

  it('counts month-end and year-end boundaries exactly', () => {
    expect(
      daysUntil({ date: '2026-12-31', recurrence: 'none' }, { year: 2026, month: 12, day: 30 })
        ?.daysUntil
    ).toBe(1)
    expect(
      daysUntil({ date: '2027-01-01', recurrence: 'none' }, { year: 2026, month: 12, day: 31 })
        ?.daysUntil
    ).toBe(1)
    expect(
      daysUntil({ date: '2026-03-01', recurrence: 'none' }, { year: 2026, month: 2, day: 28 })
        ?.daysUntil
    ).toBe(1)
  })

  it('formats countdown labels', () => {
    expect(formatCountdown(0)).toBe('今天')
    expect(formatCountdown(1)).toBe('还有 1 天')
    expect(formatCountdown(30)).toBe('还有 30 天')
    expect(formatCountdown(null)).toBe('已过去')
  })
})
