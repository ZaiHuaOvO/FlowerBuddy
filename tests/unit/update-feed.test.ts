import { describe, expect, it } from 'vitest'
import { sanitizeUpdateUrlOverride } from '../../src/main/updates/update-feed'

describe('update feed override', () => {
  it('accepts HTTPS feeds', () => {
    expect(sanitizeUpdateUrlOverride('https://updates.example.com/feed/')).toBe(
      'https://updates.example.com/feed/'
    )
  })

  it('accepts loopback HTTP feeds for isolated testing', () => {
    expect(sanitizeUpdateUrlOverride('http://localhost:8080/feed')).toBe(
      'http://localhost:8080/feed'
    )
    expect(sanitizeUpdateUrlOverride('http://127.0.0.1:8080/feed')).toBe(
      'http://127.0.0.1:8080/feed'
    )
    expect(sanitizeUpdateUrlOverride('http://[::1]:8080/feed')).toBe('http://[::1]:8080/feed')
  })

  it('rejects remote HTTP, other protocols, malformed values and empty input', () => {
    expect(sanitizeUpdateUrlOverride('http://updates.example.com/feed')).toBeUndefined()
    expect(sanitizeUpdateUrlOverride('ftp://updates.example.com/feed')).toBeUndefined()
    expect(sanitizeUpdateUrlOverride('file:///tmp/feed')).toBeUndefined()
    expect(sanitizeUpdateUrlOverride('not a url')).toBeUndefined()
    expect(sanitizeUpdateUrlOverride('')).toBeUndefined()
    expect(sanitizeUpdateUrlOverride(undefined)).toBeUndefined()
  })
})
