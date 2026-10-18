import { describe, expect, it } from 'vitest'
import {
  formatBalanceAmount,
  formatBytes,
  formatMemoDateTime,
  formatTime,
  formatTrafficRange,
  memoExcerpt,
  memoTitle,
  tagTone,
  toMessage,
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

  it('formats memo titles, excerpts and timestamps', () => {
    expect(memoTitle('第一行\n第二行')).toBe('第一行')
    expect(memoTitle('\n\n')).toBe('图片备忘')
    expect(memoExcerpt('第一行\n第二行\n第三行')).toBe('第二行 第三行')
    const local = new Date(2026, 9, 20, 15, 30, 5)
    expect(formatMemoDateTime(local.toISOString())).toBe('2026-10-20 15:30:05')
    expect(formatMemoDateTime('invalid')).toBe('invalid')
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

  it('formats byte sizes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1536)).toBe('1.50 KB')
    expect(formatBytes(10 * 1024 * 1024)).toBe('10.0 MB')
  })

  it('formats balance amounts and times defensively', () => {
    expect(formatBalanceAmount('CNY', '12.5')).toContain('12.50')
    expect(formatBalanceAmount('CNY', 'not-a-number')).toBe('CNY not-a-number')
    expect(formatTime('2026-10-17T04:03:00.000Z')).toMatch(/\d{2}:\d{2}/)
    expect(formatTime('invalid')).toBe('invalid')
    expect(formatTrafficRange('invalid', 'invalid')).toBe('')
  })
})
