import { describe, expect, it } from 'vitest'
import {
  formatReminderDateTime,
  parseReminderDateTime,
  parseReminderInput
} from '../../src/shared/memo-reminder'

const NOW = new Date(2026, 9, 18, 10, 0, 0) // Sunday 2026-10-18 10:00 local

function expectTime(input: string, expected: Date): void {
  const result = parseReminderInput(input, NOW)
  expect(result).not.toBeNull()
  expect(result?.at.getTime()).toBe(expected.getTime())
}

describe('memo reminder parsing', () => {
  it('parses absolute date and time formats', () => {
    expectTime('2026-10-20 15:30:45', new Date(2026, 9, 20, 15, 30, 45))
    expectTime('2026-10-20T15:30', new Date(2026, 9, 20, 15, 30, 0))
    expectTime('2026年10月20日 15点30分', new Date(2026, 9, 20, 15, 30, 0))
  })

  it('parses relative day words', () => {
    expectTime('明天上午9点', new Date(2026, 9, 19, 9, 0, 0))
    expectTime('后天晚上8点', new Date(2026, 9, 20, 20, 0, 0))
    expectTime('大后天', new Date(2026, 9, 21, 9, 0, 0))
    expectTime('今天下午3点', new Date(2026, 9, 18, 15, 0, 0))
  })

  it('parses weekdays with Chinese numerals', () => {
    expectTime('下周一下午三点', new Date(2026, 9, 19, 15, 0, 0))
    expectTime('下周一 15:30', new Date(2026, 9, 19, 15, 30, 0))
    expectTime('周三', new Date(2026, 9, 21, 9, 0, 0))
    // "周一" said on Sunday refers to the upcoming Monday.
    expectTime('周一', new Date(2026, 9, 19, 9, 0, 0))
  })

  it('rolls explicit month/day dates to next year once passed', () => {
    expectTime('10月20日', new Date(2026, 9, 20, 9, 0, 0))
    expectTime('1月2日下午两点', new Date(2027, 0, 2, 14, 0, 0))
  })

  it('parses relative offsets', () => {
    expectTime('30分钟后', new Date(2026, 9, 18, 10, 30, 0))
    expectTime('两小时后', new Date(2026, 9, 18, 12, 0, 0))
    expectTime('3天后', new Date(2026, 9, 21, 10, 0, 0))
  })

  it('moves time-only input to tomorrow when today has passed', () => {
    expectTime('9点', new Date(2026, 9, 19, 9, 0, 0))
    expectTime('下午3点', new Date(2026, 9, 18, 15, 0, 0))
  })

  it('returns null for unrecognized or invalid input', () => {
    expect(parseReminderInput('', NOW)).toBeNull()
    expect(parseReminderInput('随便写写', NOW)).toBeNull()
    expect(parseReminderInput('2026-02-30', NOW)).toBeNull()
    expect(parseReminderInput('25点', NOW)).toBeNull()
  })

  it('formats and re-parses local timestamps', () => {
    const date = new Date(2026, 0, 2, 3, 4, 5)
    expect(formatReminderDateTime(date)).toBe('2026-01-02 03:04:05')
    expect(parseReminderDateTime('2026-01-02 03:04:05')?.getTime()).toBe(date.getTime())
    expect(parseReminderDateTime('2026-01-02T03:04:05')?.getTime()).toBe(date.getTime())
    expect(parseReminderDateTime('not-a-date')).toBeNull()
  })
})
