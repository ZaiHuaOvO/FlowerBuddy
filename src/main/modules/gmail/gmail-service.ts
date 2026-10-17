import type { OAuth2Client } from 'google-auth-library'
import type { GmailPollSummary, GmailStateView } from '../../../shared/api'
import {
  SECRET_GMAIL_CLIENT_ID,
  SECRET_GMAIL_CLIENT_SECRET,
  SECRET_GMAIL_REFRESH_TOKEN
} from '../../security/secret-ids'
import type { SecretStore } from '../../security/secret-store'
import { AppError } from '../../shared/errors'
import type { LoggerLike } from '../../shared/logger'
import type { JsonStore } from '../../storage/json-store'
import { revokeGmailToken, runGmailOAuth } from './gmail-auth'
import {
  createEmptyGmailState,
  MAX_NOTIFIED_IDS,
  sanitizeHeaderValue,
  type GmailMessageSummary,
  type GmailState
} from './types'
import { decodeMimeHeader, extractHeader, type GmailHeader } from './headers'

const MAX_MESSAGES_PER_POLL = 25
const DEFAULT_REQUEST_TIMEOUT_MS = 25000

interface GmailProfile {
  emailAddress?: string | null
  historyId?: string | null
}

interface GmailMessageData {
  id?: string | null
  payload?: { headers?: GmailHeader[] | null } | null
}

export interface GmailClientLike {
  users: {
    getProfile(params: { userId: string }): Promise<{ data: GmailProfile }>
    history: {
      list(params: {
        userId: string
        startHistoryId: string
        historyTypes: string[]
        maxResults: number
      }): Promise<{
        data: {
          history?: Array<{
            messagesAdded?: Array<{ message?: { id?: string | null } | null }> | null
          }> | null
          historyId?: string | null
        }
      }>
    }
    messages: {
      get(params: {
        userId: string
        id: string
        format: string
        metadataHeaders: string[]
      }): Promise<{ data: GmailMessageData }>
    }
  }
}

export type GmailClientFactory = (auth: OAuth2Client) => GmailClientLike

type AuthLibrary = typeof import('google-auth-library')
type GoogleApis = typeof import('googleapis')

let authLibraryPromise: Promise<AuthLibrary> | null = null
let googleApisPromise: Promise<GoogleApis> | null = null

function loadAuthLibrary(): Promise<AuthLibrary> {
  authLibraryPromise ??= import('google-auth-library').catch((error: unknown) => {
    authLibraryPromise = null
    throw error
  })
  return authLibraryPromise
}

function loadGoogleApis(): Promise<GoogleApis> {
  googleApisPromise ??= import('googleapis').catch((error: unknown) => {
    googleApisPromise = null
    throw error
  })
  return googleApisPromise
}

async function createDefaultGmailClient(auth: OAuth2Client): Promise<GmailClientLike> {
  const { google } = await loadGoogleApis()
  return google.gmail({ version: 'v1', auth }) as unknown as GmailClientLike
}

export interface GmailServiceOptions {
  secretStore: SecretStore
  stateStore: JsonStore<GmailState>
  logger: LoggerLike
  openExternal: (url: string) => Promise<void>
  clientFactory?: GmailClientFactory
  now?: () => Date
  requestTimeoutMs?: number
  oauthTimeoutMs?: number
}

export interface GmailPollOutcome {
  summary: GmailPollSummary
  messages: GmailMessageSummary[]
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

function errorStatus(error: unknown): number | undefined {
  const response = (error as { response?: { status?: unknown } }).response
  if (typeof response?.status === 'number') {
    return response.status
  }
  const code = (error as { code?: unknown }).code
  return typeof code === 'number' ? code : undefined
}

function errorReason(error: unknown): string {
  const response = (
    error as {
      response?: { data?: { error?: { errors?: Array<{ reason?: string }>; status?: string } } }
    }
  ).response
  const errors = response?.data?.error?.errors
  if (Array.isArray(errors) && typeof errors[0]?.reason === 'string') {
    return errors[0].reason
  }
  return response?.data?.error?.status ?? ''
}

function isNetworkError(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } }).cause
  const code = cause?.code ?? (error as { code?: string }).code ?? ''
  return [
    'ENOTFOUND',
    'EAI_AGAIN',
    'ECONNREFUSED',
    'ECONNRESET',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'UND_ERR_CONNECT_TIMEOUT'
  ].includes(code)
}

export class GmailService {
  private readonly now: () => Date
  private readonly timeoutMs: number

  constructor(private readonly options: GmailServiceOptions) {
    this.now = options.now ?? (() => new Date())
    this.timeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  }

  isConfigured(): boolean {
    return (
      this.options.secretStore.has(SECRET_GMAIL_CLIENT_ID) &&
      this.options.secretStore.has(SECRET_GMAIL_CLIENT_SECRET) &&
      this.options.secretStore.has(SECRET_GMAIL_REFRESH_TOKEN)
    )
  }

  getState(): GmailState {
    return this.options.stateStore.get()
  }

  getStateView(): GmailStateView {
    const state = this.getState()
    return {
      clientConfigured:
        this.options.secretStore.has(SECRET_GMAIL_CLIENT_ID) &&
        this.options.secretStore.has(SECRET_GMAIL_CLIENT_SECRET),
      configured: this.isConfigured(),
      emailAddress: state.emailAddress,
      authExpired: state.authExpired
    }
  }

  async saveClientCredentials(clientId: string, clientSecret: string): Promise<void> {
    await this.options.secretStore.setMany([
      { id: SECRET_GMAIL_CLIENT_ID, value: clientId },
      { id: SECRET_GMAIL_CLIENT_SECRET, value: clientSecret }
    ])
  }

  async connect(): Promise<{ emailAddress: string }> {
    const clientId = await this.options.secretStore.get(SECRET_GMAIL_CLIENT_ID)
    const clientSecret = await this.options.secretStore.get(SECRET_GMAIL_CLIENT_SECRET)
    if (!clientId || !clientSecret) {
      throw new AppError('NOT_CONFIGURED', '请先填写 Gmail OAuth Client ID 和 Client Secret')
    }

    const result = await runGmailOAuth({
      clientId,
      clientSecret,
      openExternal: this.options.openExternal,
      timeoutMs: this.options.oauthTimeoutMs
    })

    await this.options.secretStore.set(SECRET_GMAIL_REFRESH_TOKEN, result.refreshToken)
    this.persistState({
      schemaVersion: 1,
      emailAddress: result.emailAddress,
      historyId: result.historyId,
      notifiedMessageIds: [],
      authExpired: false,
      lastCheckedAt: null
    })
    return { emailAddress: result.emailAddress }
  }

  async disconnect(): Promise<void> {
    const [clientId, clientSecret, refreshToken] = await Promise.all([
      this.options.secretStore.get(SECRET_GMAIL_CLIENT_ID),
      this.options.secretStore.get(SECRET_GMAIL_CLIENT_SECRET),
      this.options.secretStore.get(SECRET_GMAIL_REFRESH_TOKEN)
    ])

    if (clientId && clientSecret && refreshToken) {
      await revokeGmailToken({ clientId, clientSecret, refreshToken })
    }
    await this.options.secretStore.delete(SECRET_GMAIL_REFRESH_TOKEN)
    this.options.stateStore.set(createEmptyGmailState())
    this.options.stateStore.flush()
  }

  async poll(): Promise<GmailPollOutcome> {
    if (!this.isConfigured()) {
      throw new AppError('NOT_CONFIGURED', 'Gmail 尚未连接')
    }

    const [clientId, clientSecret, refreshToken] = await Promise.all([
      this.options.secretStore.get(SECRET_GMAIL_CLIENT_ID),
      this.options.secretStore.get(SECRET_GMAIL_CLIENT_SECRET),
      this.options.secretStore.get(SECRET_GMAIL_REFRESH_TOKEN)
    ])
    if (!clientId || !clientSecret || !refreshToken) {
      throw new AppError('NOT_CONFIGURED', 'Gmail 尚未连接')
    }

    const state = this.getState()
    if (state.authExpired) {
      throw new AppError('AUTH_EXPIRED', 'Gmail 授权已失效，请重新连接')
    }

    const { OAuth2Client } = await loadAuthLibrary()
    const auth = new OAuth2Client(clientId, clientSecret)
    auth.setCredentials({ refresh_token: refreshToken })
    const client = this.options.clientFactory
      ? this.options.clientFactory(auth)
      : await createDefaultGmailClient(auth)

    try {
      return await withTimeout(
        this.runPoll(client, state),
        this.timeoutMs,
        '检查 Gmail 超时，请稍后重试'
      )
    } catch (error) {
      return await this.handlePollError(error, client)
    }
  }

  async checkNow(): Promise<GmailPollSummary> {
    const outcome = await this.poll()
    return outcome.summary
  }

  flush(): void {
    this.options.stateStore.flush()
  }

  private async runPoll(client: GmailClientLike, state: GmailState): Promise<GmailPollOutcome> {
    const nowIso = this.now().toISOString()

    if (!state.historyId) {
      const profile = await client.users.getProfile({ userId: 'me' })
      const historyId = profile.data.historyId ?? ''
      if (!historyId) {
        throw new AppError('INVALID_RESPONSE', 'Gmail 未返回 historyId')
      }
      this.persistState({
        ...state,
        emailAddress: profile.data.emailAddress ?? state.emailAddress,
        historyId,
        authExpired: false,
        lastCheckedAt: nowIso
      })
      return {
        summary: { newMessages: 0, baselineReestablished: false },
        messages: []
      }
    }

    const response = await client.users.history.list({
      userId: 'me',
      startHistoryId: state.historyId,
      historyTypes: ['messageAdded'],
      maxResults: 100
    })

    const ids = new Set<string>()
    for (const entry of response.data.history ?? []) {
      for (const added of entry.messagesAdded ?? []) {
        const id = added.message?.id
        if (typeof id === 'string' && id) {
          ids.add(id)
        }
      }
    }

    const known = new Set(state.notifiedMessageIds)
    const newIds = [...ids].filter((id) => !known.has(id))
    const batch = newIds.slice(0, MAX_MESSAGES_PER_POLL)
    const messages: GmailMessageSummary[] = []

    for (const id of batch) {
      try {
        const message = await client.users.messages.get({
          userId: 'me',
          id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date']
        })
        const headers = message.data.payload?.headers ?? []
        messages.push({
          id,
          from: sanitizeHeaderValue(decodeMimeHeader(extractHeader(headers, 'From')), 200),
          subject: sanitizeHeaderValue(decodeMimeHeader(extractHeader(headers, 'Subject')), 300),
          date: sanitizeHeaderValue(extractHeader(headers, 'Date'), 100)
        })
      } catch (error) {
        this.options.logger.warn('gmail message metadata unavailable', {
          status: errorStatus(error)
        })
        messages.push({ id, from: '', subject: '', date: '' })
      }
    }

    const fullyProcessed = newIds.length <= MAX_MESSAGES_PER_POLL
    this.persistState({
      ...state,
      historyId: fullyProcessed ? (response.data.historyId ?? state.historyId) : state.historyId,
      notifiedMessageIds: [...state.notifiedMessageIds, ...batch].slice(-MAX_NOTIFIED_IDS),
      authExpired: false,
      lastCheckedAt: nowIso
    })

    return {
      summary: { newMessages: messages.length, baselineReestablished: false },
      messages
    }
  }

  private async handlePollError(
    error: unknown,
    client: GmailClientLike
  ): Promise<GmailPollOutcome> {
    if (error instanceof AppError) {
      if (error.code === 'AUTH_EXPIRED') {
        this.markAuthExpired()
      }
      throw error
    }

    const status = errorStatus(error)
    const reason = errorReason(error)
    const message = error instanceof Error ? error.message : ''

    if (/invalid_grant|invalid_client/i.test(message) || status === 401) {
      this.markAuthExpired()
      throw new AppError('AUTH_EXPIRED', 'Gmail 授权已失效，请重新连接', {
        cause: error
      })
    }

    if (status === 404) {
      // historyId too old: re-baseline without notifying historical mail.
      try {
        const profile = await client.users.getProfile({ userId: 'me' })
        const historyId = profile.data.historyId ?? ''
        if (!historyId) {
          throw new Error('missing historyId')
        }
        const state = this.getState()
        this.persistState({
          ...state,
          emailAddress: profile.data.emailAddress ?? state.emailAddress,
          historyId,
          authExpired: false,
          lastCheckedAt: this.now().toISOString()
        })
        this.options.logger.info('gmail history baseline re-established')
        return {
          summary: { newMessages: 0, baselineReestablished: true },
          messages: []
        }
      } catch (recoveryError) {
        this.options.logger.warn('gmail history baseline recovery failed')
        throw new AppError(
          'REMOTE_SERVICE_ERROR',
          'Gmail 同步历史已失效，且无法重建基线，请重新连接',
          { cause: recoveryError }
        )
      }
    }

    if (status === 429) {
      throw new AppError('RATE_LIMITED', 'Gmail 请求过于频繁，请稍后重试', {
        retryable: true,
        cause: error
      })
    }

    if (status === 403) {
      if (/rateLimitExceeded|userRateLimitExceeded/i.test(reason)) {
        throw new AppError('RATE_LIMITED', 'Gmail 配额已用尽，请稍后重试', {
          retryable: true,
          cause: error
        })
      }
      throw new AppError('PERMISSION_DENIED', 'Gmail 凭据缺少读取权限', {
        cause: error
      })
    }

    if (status !== undefined && status >= 500) {
      throw new AppError('REMOTE_SERVICE_ERROR', 'Gmail 服务暂时不可用', {
        retryable: true,
        cause: error
      })
    }

    if (isNetworkError(error)) {
      throw new AppError('NETWORK_ERROR', '无法连接 Gmail 服务，请检查网络', {
        retryable: true,
        cause: error
      })
    }

    throw new AppError('REMOTE_SERVICE_ERROR', '检查 Gmail 失败，请稍后重试', {
      cause: error
    })
  }

  private markAuthExpired(): void {
    const state = this.getState()
    if (state.authExpired) {
      return
    }
    this.persistState({ ...state, authExpired: true })
  }

  private persistState(state: GmailState): void {
    this.options.stateStore.set(state)
  }
}
