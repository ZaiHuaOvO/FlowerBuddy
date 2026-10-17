import { describe, expect, it } from 'vitest'
import { decodeMimeHeader, extractHeader } from '../../src/main/modules/gmail/headers'
import {
  createEmptyGmailState,
  MAX_NOTIFIED_IDS,
  sanitizeGmailState
} from '../../src/main/modules/gmail/types'

describe('gmail state', () => {
  it('sanitizes and deduplicates notified message ids', () => {
    const state = sanitizeGmailState({
      emailAddress: 'me@example.com',
      historyId: '123',
      notifiedMessageIds: ['a', 'a', 'b', 42],
      authExpired: 'yes',
      lastCheckedAt: '2026-10-17T00:00:00.000Z'
    })

    expect(state).toEqual({
      schemaVersion: 1,
      emailAddress: 'me@example.com',
      historyId: '123',
      notifiedMessageIds: ['a', 'b'],
      authExpired: false,
      lastCheckedAt: '2026-10-17T00:00:00.000Z'
    })
  })

  it('keeps only the most recent notified ids', () => {
    const ids = Array.from({ length: MAX_NOTIFIED_IDS + 50 }, (_, index) => `m${index}`)
    const state = sanitizeGmailState({ notifiedMessageIds: ids })

    expect(state.notifiedMessageIds).toHaveLength(MAX_NOTIFIED_IDS)
    expect(state.notifiedMessageIds[0]).toBe('m50')
  })

  it('falls back to an empty state for invalid input', () => {
    expect(sanitizeGmailState('nope')).toEqual(createEmptyGmailState())
    expect(sanitizeGmailState(null)).toEqual(createEmptyGmailState())
  })
})

describe('mime headers', () => {
  it('decodes base64 and quoted-printable encoded words', () => {
    expect(decodeMimeHeader('=?UTF-8?B?5byg5LiJ?= <a@example.com>')).toBe('张三 <a@example.com>')
    expect(decodeMimeHeader('=?UTF-8?Q?Hello_World?=')).toBe('Hello World')
    expect(decodeMimeHeader('plain subject')).toBe('plain subject')
  })

  it('extracts headers case-insensitively', () => {
    expect(
      extractHeader(
        [
          { name: 'from', value: 'a@example.com' },
          { name: 'Subject', value: 'Hello' }
        ],
        'From'
      )
    ).toBe('a@example.com')
    expect(extractHeader(null, 'Subject')).toBe('')
  })
})
