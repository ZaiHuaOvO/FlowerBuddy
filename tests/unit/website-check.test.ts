import { describe, expect, it } from 'vitest'
import { checkWebsiteUrl } from '../../src/main/modules/website-check/website-check'
import {
  isHttpUrl,
  sanitizeUrlForDisplay
} from '../../src/main/modules/website-check/website-types'

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>

function fakeFetch(handler: FetchHandler): typeof fetch {
  return handler as unknown as typeof fetch
}

describe('URL validation and display', () => {
  it('accepts only http/https URLs without embedded credentials', () => {
    expect(isHttpUrl('https://example.com')).toBe(true)
    expect(isHttpUrl('http://127.0.0.1:8080/path?x=1')).toBe(true)
    expect(isHttpUrl('ftp://example.com')).toBe(false)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('https://user:pass@example.com')).toBe(false)
    expect(isHttpUrl('not a url')).toBe(false)
  })

  it('removes credentials, fragments and sensitive query parameters', () => {
    const display = sanitizeUrlForDisplay(
      'https://user:pass@example.com/path?token=abc&page=1&api_key=xyz#section'
    )
    expect(display).toBe('https://example.com/path?page=1')
    expect(display).not.toContain('user')
    expect(display).not.toContain('token')
    expect(display).not.toContain('#')
  })
})

describe('website check', () => {
  it('reports 2xx responses as success', async () => {
    const outcome = await checkWebsiteUrl('https://example.com', {
      timeoutMs: 1000,
      fetchImpl: fakeFetch(async () => new Response(null, { status: 200 }))
    })

    expect(outcome).toMatchObject({
      ok: true,
      status: 200,
      errorKind: 'none'
    })
    expect(outcome.message).toContain('从本机网络检测成功')
  })

  it('reports HTTP errors with the status code', async () => {
    const outcome = await checkWebsiteUrl('https://example.com/missing', {
      timeoutMs: 1000,
      fetchImpl: fakeFetch(async () => new Response(null, { status: 404 }))
    })

    expect(outcome).toMatchObject({
      ok: false,
      status: 404,
      errorKind: 'http-error',
      message: 'HTTP 404'
    })
  })

  it('follows redirects and records the sanitized final URL', async () => {
    const calls: string[] = []
    const outcome = await checkWebsiteUrl('https://example.com/old', {
      timeoutMs: 1000,
      fetchImpl: fakeFetch(async (url) => {
        calls.push(url)
        if (calls.length === 1) {
          return new Response(null, {
            status: 301,
            headers: { location: '/new?token=secret&page=2' }
          })
        }
        return new Response(null, { status: 200 })
      })
    })

    expect(calls).toHaveLength(2)
    expect(outcome).toMatchObject({ ok: true, status: 200 })
    expect(outcome.finalUrl).toBe('https://example.com/new?page=2')
    expect(outcome.finalUrl).not.toContain('secret')
  })

  it('stops after the redirect limit', async () => {
    const outcome = await checkWebsiteUrl('https://example.com/loop', {
      timeoutMs: 1000,
      maxRedirects: 2,
      fetchImpl: fakeFetch(
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: '/loop' }
          })
      )
    })

    expect(outcome.ok).toBe(false)
    expect(outcome.errorKind).toBe('network')
    expect(outcome.message).toContain('重定向次数过多')
  })

  it('reports timeouts', async () => {
    const outcome = await checkWebsiteUrl('https://example.com/slow', {
      timeoutMs: 20,
      fetchImpl: fakeFetch(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new Error('aborted'))
            })
          })
      )
    })

    expect(outcome.ok).toBe(false)
    expect(outcome.errorKind).toBe('timeout')
    expect(outcome.message).toContain('请求超时')
  })

  it('classifies DNS failures', async () => {
    const error = new TypeError('fetch failed') as TypeError & {
      cause?: { code: string }
    }
    error.cause = { code: 'ENOTFOUND' }

    const outcome = await checkWebsiteUrl('https://missing.invalid', {
      timeoutMs: 1000,
      fetchImpl: fakeFetch(async () => {
        throw error
      })
    })

    expect(outcome.errorKind).toBe('network')
    expect(outcome.message).toBe('DNS 解析失败')
  })

  it('classifies TLS certificate failures', async () => {
    const error = new TypeError('fetch failed') as TypeError & {
      cause?: { code: string }
    }
    error.cause = { code: 'CERT_HAS_EXPIRED' }

    const outcome = await checkWebsiteUrl('https://expired.example', {
      timeoutMs: 1000,
      fetchImpl: fakeFetch(async () => {
        throw error
      })
    })

    expect(outcome.errorKind).toBe('tls')
    expect(outcome.message).toContain('TLS')
  })

  it('rejects non-HTTP URLs without calling fetch', async () => {
    let called = false
    const outcome = await checkWebsiteUrl('file:///etc/passwd', {
      timeoutMs: 1000,
      fetchImpl: fakeFetch(async () => {
        called = true
        return new Response(null, { status: 200 })
      })
    })

    expect(called).toBe(false)
    expect(outcome.errorKind).toBe('invalid-url')
  })
})
