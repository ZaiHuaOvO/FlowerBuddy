import type { WebsiteCheckErrorKind } from '../../../shared/api'
import { isHttpUrl, sanitizeUrlForDisplay } from './website-types'

export interface WebsiteCheckOutcome {
  ok: boolean
  status: number | null
  durationMs: number
  finalUrl: string
  errorKind: WebsiteCheckErrorKind
  message: string
}

export interface WebsiteCheckOptions {
  timeoutMs: number
  fetchImpl?: typeof fetch | undefined
  maxRedirects?: number | undefined
}

function classifyFetchError(error: unknown): Pick<WebsiteCheckOutcome, 'errorKind' | 'message'> {
  const cause = (error as { cause?: { code?: string } }).cause
  const code = cause?.code ?? (error as { code?: string }).code ?? ''

  switch (code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return { errorKind: 'network', message: 'DNS 解析失败' }
    case 'ECONNREFUSED':
      return { errorKind: 'network', message: '连接被拒绝' }
    case 'ECONNRESET':
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return { errorKind: 'network', message: '网络连接失败' }
    case 'CERT_HAS_EXPIRED':
      return { errorKind: 'tls', message: 'TLS 证书已过期' }
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'SELF_SIGNED_CERT_IN_CHAIN':
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
      return { errorKind: 'tls', message: 'TLS 证书校验失败' }
    case 'ERR_TLS_CERT_ALTNAME_INVALID':
      return { errorKind: 'tls', message: 'TLS 证书域名不匹配' }
    case 'UND_ERR_CONNECT_TIMEOUT':
      return { errorKind: 'timeout', message: '连接超时' }
    default:
      return { errorKind: 'network', message: '网络请求失败' }
  }
}

/**
 * Performs a local HTTP(S) check with a hard timeout and a redirect limit.
 * The response body is never read or executed.
 */
export async function checkWebsiteUrl(
  rawUrl: string,
  options: WebsiteCheckOptions
): Promise<WebsiteCheckOutcome> {
  const startedAt = Date.now()
  if (!isHttpUrl(rawUrl)) {
    return {
      ok: false,
      status: null,
      durationMs: 0,
      finalUrl: sanitizeUrlForDisplay(rawUrl),
      errorKind: 'invalid-url',
      message: '仅支持本机可访问的 HTTP(S) 地址'
    }
  }

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, options.timeoutMs)

  const fetchImpl = options.fetchImpl ?? fetch
  const maxRedirects = options.maxRedirects ?? 5

  try {
    let currentUrl = rawUrl
    let redirects = 0

    while (true) {
      const response = await fetchImpl(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'FlowerBuddy/0.1 (local availability check)' }
      })

      const location = response.headers.get('location')
      if (response.status >= 300 && response.status < 400 && location) {
        void response.body?.cancel().catch(() => {})
        redirects += 1
        if (redirects > maxRedirects) {
          return {
            ok: false,
            status: response.status,
            durationMs: Date.now() - startedAt,
            finalUrl: sanitizeUrlForDisplay(currentUrl),
            errorKind: 'network',
            message: '重定向次数过多'
          }
        }
        const nextUrl = new URL(location, currentUrl).toString()
        if (!isHttpUrl(nextUrl)) {
          return {
            ok: false,
            status: response.status,
            durationMs: Date.now() - startedAt,
            finalUrl: sanitizeUrlForDisplay(currentUrl),
            errorKind: 'invalid-url',
            message: '重定向到了非 HTTP(S) 地址'
          }
        }
        currentUrl = nextUrl
        continue
      }

      void response.body?.cancel().catch(() => {})
      const durationMs = Date.now() - startedAt
      const ok = response.status >= 200 && response.status < 400
      return {
        ok,
        status: response.status,
        durationMs,
        finalUrl: sanitizeUrlForDisplay(currentUrl),
        errorKind: ok ? 'none' : 'http-error',
        message: ok ? `从本机网络检测成功（HTTP ${response.status}）` : `HTTP ${response.status}`
      }
    }
  } catch (error) {
    const durationMs = Date.now() - startedAt
    if (
      timedOut ||
      (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'))
    ) {
      return {
        ok: false,
        status: null,
        durationMs,
        finalUrl: sanitizeUrlForDisplay(rawUrl),
        errorKind: 'timeout',
        message: `请求超时（${Math.round(options.timeoutMs / 1000)} 秒）`
      }
    }
    const classified = classifyFetchError(error)
    return {
      ok: false,
      status: null,
      durationMs,
      finalUrl: sanitizeUrlForDisplay(rawUrl),
      errorKind: classified.errorKind,
      message: classified.message
    }
  } finally {
    clearTimeout(timer)
  }
}
