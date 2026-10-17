import { describe, expect, it } from 'vitest'
import {
  categoryLabel,
  countdownLabel,
  dateStatusLabel,
  dateTone,
  formatBalanceAmount,
  formatBytes,
  formatTime,
  formatTrafficRange,
  maskEmail,
  tagTone,
  toMessage,
  todayIso,
  websiteLabel,
  websiteTone
} from '../../src/renderer/src/settings/utils/formatters'

describe('settings formatters', () => {
  it('normalizes unknown errors to messages', () => {
    expect(toMessage(new Error('boom'))).toBe('boom')
    expect(toMessage({ message: 'plain' })).toBe('plain')
    expect(toMessage('text')).toBe('text')
  })

  it('maps module status to tag tones', () => {
    expect(tagTone('ready')).toBe('success')
    expect(tagTone('auth-expired')).toBe('danger')
    expect(tagTone('not-configured')).toBe('warning')
    expect(tagTone('not-implemented')).toBe('muted')
  })

  it('formats date category and countdown labels', () => {
    expect(categoryLabel('birthday')).toBe('生日')
    expect(categoryLabel('custom')).toBe('自定义')
    expect(countdownLabel(null)).toBe('已过去')
    expect(countdownLabel(0)).toBe('今天')
    expect(countdownLabel(3)).toBe('还有 3 天')
  })

  it('derives date status and tone from enabled/upcoming state', () => {
    const base = {
      id: '1',
      title: 'Test',
      date: '2026-10-20',
      recurrence: 'yearly' as const,
      category: 'custom' as const,
      notifyDaysBefore: [0],
      enabled: true,
      createdAt: '',
      updatedAt: '',
      upcoming: true,
      daysUntil: 0,
      occurrence: '2026-10-20'
    }
    expect(dateTone(base)).toBe('warning')
    expect(dateStatusLabel(base)).toBe('今天')
    expect(dateTone({ ...base, enabled: false })).toBe('muted')
    expect(dateStatusLabel({ ...base, enabled: false })).toBe('已停用')
    expect(dateStatusLabel({ ...base, upcoming: false, daysUntil: null })).toBe('已过去')
  })

  it('formats website results', () => {
    expect(websiteTone(null)).toBe('muted')
    expect(websiteLabel(null)).toBe('尚未检测')
    expect(
      websiteLabel({
        ok: true,
        status: 200,
        durationMs: 12,
        checkedAt: '',
        errorKind: 'none',
        message: '',
        finalUrl: 'https://example.com'
      })
    ).toBe('正常 · HTTP 200 · 12ms')
    expect(
      websiteLabel({
        ok: false,
        status: 500,
        durationMs: 30,
        checkedAt: '',
        errorKind: 'http-error',
        message: 'HTTP 500',
        finalUrl: 'https://example.com'
      })
    ).toBe('HTTP 500 · 30ms')
  })

  it('formats byte sizes and masks email addresses', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1536)).toBe('1.50 KB')
    expect(formatBytes(10 * 1024 * 1024)).toBe('10.0 MB')
    expect(maskEmail('alice@example.com')).toBe('a***@example.com')
    expect(maskEmail('invalid')).toBe('invalid')
  })

  it('formats balance amounts and times defensively', () => {
    expect(formatBalanceAmount('CNY', '12.5')).toContain('12.50')
    expect(formatBalanceAmount('CNY', 'not-a-number')).toBe('CNY not-a-number')
    expect(formatTime('2026-10-17T04:03:00.000Z')).toMatch(/\d{2}:\d{2}/)
    expect(formatTime('invalid')).toBe('invalid')
    expect(formatTrafficRange('invalid', 'invalid')).toBe('')
  })

  it('produces a local ISO date', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
