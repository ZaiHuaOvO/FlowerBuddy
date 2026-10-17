import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { AppError } from '../../shared/errors'

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

const DEFAULT_OAUTH_TIMEOUT_MS = 5 * 60 * 1000
const PROFILE_TIMEOUT_MS = 20000

export interface GmailOAuthResult {
  refreshToken: string
  emailAddress: string
  historyId: string
}

export interface GmailOAuthOptions {
  clientId: string
  clientSecret: string
  openExternal: (url: string) => Promise<void>
  timeoutMs?: number | undefined
}

function htmlPage(title: string, message: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: 'Microsoft YaHei', sans-serif; padding: 40px; color: #2f2117; background: #fff8f3;">
<h1 style="font-size: 20px;">${title}</h1>
<p>${message}</p>
</body>
</html>`
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new AppError('TIMEOUT', message, { retryable: true })),
      ms
    )
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

function mapTokenError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error
  }
  const response = (error as { response?: { data?: { error?: unknown } } }).response
  const code = typeof response?.data?.error === 'string' ? response.data.error : ''
  if (code === 'invalid_client') {
    return new AppError('AUTH_REQUIRED', 'Gmail OAuth Client ID 或 Client Secret 无效')
  }
  if (code === 'redirect_uri_mismatch') {
    return new AppError('AUTH_REQUIRED', 'OAuth 客户端类型必须是“桌面应用”，并允许 127.0.0.1 回调')
  }
  if (code === 'invalid_grant') {
    return new AppError('AUTH_REQUIRED', '授权码无效或已过期，请重试')
  }
  return new AppError('NETWORK_ERROR', 'Gmail 授权请求失败，请检查网络', {
    retryable: true,
    cause: error
  })
}

/**
 * Desktop OAuth with a loopback callback on a random 127.0.0.1 port.
 * Uses PKCE and a random state value; the auth URL is opened in the system browser.
 */
export async function runGmailOAuth(options: GmailOAuthOptions): Promise<GmailOAuthResult> {
  if (!options.clientId.trim() || !options.clientSecret.trim()) {
    throw new AppError('NOT_CONFIGURED', '请先填写 Gmail OAuth Client ID 和 Client Secret')
  }

  const { CodeChallengeMethod, OAuth2Client } = await import('google-auth-library')

  const state = randomBytes(32).toString('hex')
  let settled = false
  let resolveCode: ((code: string) => void) | null = null
  let rejectCode: ((error: unknown) => void) | null = null

  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve
    rejectCode = reject
  })

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    if (url.pathname !== '/oauth2callback') {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Not found')
      return
    }

    const finish = (statusCode: number, title: string, message: string): void => {
      response.writeHead(statusCode, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        connection: 'close'
      })
      response.end(htmlPage(title, message))
    }

    if (settled) {
      finish(400, 'FlowerBuddy', '此授权请求已处理。')
      return
    }

    const error = url.searchParams.get('error')
    if (error) {
      settled = true
      finish(400, '授权未完成', '授权被取消或失败，可以关闭此页面并返回 FlowerBuddy。')
      rejectCode?.(new AppError('AUTH_REQUIRED', 'Gmail 授权被取消或失败'))
      return
    }

    if (url.searchParams.get('state') !== state) {
      settled = true
      finish(400, '授权校验失败', 'OAuth state 不匹配，请返回应用重新发起授权。')
      rejectCode?.(new AppError('AUTH_REQUIRED', 'OAuth state 校验失败，请重试'))
      return
    }

    const code = url.searchParams.get('code')
    if (!code) {
      settled = true
      finish(400, '授权未完成', '未收到授权码，请返回应用重试。')
      rejectCode?.(new AppError('AUTH_REQUIRED', '未收到 Gmail 授权码'))
      return
    }

    settled = true
    finish(200, '授权完成', '可以关闭此页面并返回 FlowerBuddy。')
    resolveCode?.(code)
  })

  const timeoutMs = options.timeoutMs ?? DEFAULT_OAUTH_TIMEOUT_MS
  const timer = setTimeout(() => {
    if (!settled) {
      settled = true
      rejectCode?.(new AppError('TIMEOUT', 'Gmail 授权超时，请重试', { retryable: true }))
    }
  }, timeoutMs)

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address() as AddressInfo
    const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`
    const oauth2Client = new OAuth2Client(options.clientId, options.clientSecret, redirectUri)
    const { codeVerifier, codeChallenge } = await oauth2Client.generateCodeVerifierAsync()
    if (!codeChallenge) {
      throw new AppError('UNKNOWN', '无法生成 PKCE 授权参数')
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [GMAIL_SCOPE],
      prompt: 'consent',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256
    })

    const parsedAuthUrl = new URL(authUrl)
    if (parsedAuthUrl.protocol !== 'https:' || parsedAuthUrl.hostname !== 'accounts.google.com') {
      throw new AppError('UNKNOWN', 'OAuth 授权地址异常')
    }

    await options.openExternal(authUrl)
    const code = await codePromise

    let tokens
    try {
      const result = await oauth2Client.getToken({ code, codeVerifier })
      tokens = result.tokens
    } catch (error) {
      throw mapTokenError(error)
    }

    const refreshToken = tokens.refresh_token
    if (!refreshToken) {
      throw new AppError('AUTH_REQUIRED', '未能获得 refresh token，请重新授权并同意离线访问')
    }

    oauth2Client.setCredentials(tokens)
    const { google } = await import('googleapis')
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    const profile = await withTimeout(
      gmail.users.getProfile({ userId: 'me' }),
      PROFILE_TIMEOUT_MS,
      '读取 Gmail 账户信息超时'
    )

    const emailAddress = profile.data.emailAddress ?? ''
    const historyId = profile.data.historyId ?? ''
    if (!emailAddress || !historyId) {
      throw new AppError('INVALID_RESPONSE', '无法读取 Gmail 账户信息')
    }

    return { refreshToken, emailAddress, historyId }
  } finally {
    clearTimeout(timer)
    server.closeAllConnections?.()
    server.close()
  }
}

export async function revokeGmailToken(options: {
  clientId: string
  clientSecret: string
  refreshToken: string
}): Promise<void> {
  try {
    const { OAuth2Client } = await import('google-auth-library')
    const client = new OAuth2Client(options.clientId, options.clientSecret)
    await client.revokeToken(options.refreshToken)
  } catch {
    // Best effort: the local refresh token is deleted regardless.
  }
}
