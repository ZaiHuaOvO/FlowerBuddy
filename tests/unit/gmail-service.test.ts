import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GmailService,
  type GmailClientLike,
  type GmailServiceOptions
} from '../../src/main/modules/gmail/gmail-service'
import {
  createEmptyGmailState,
  sanitizeGmailState,
  type GmailState
} from '../../src/main/modules/gmail/types'
import {
  SECRET_GMAIL_CLIENT_ID,
  SECRET_GMAIL_CLIENT_SECRET,
  SECRET_GMAIL_REFRESH_TOKEN
} from '../../src/main/security/secret-ids'
import { SecretStore, type SafeStorageBackend } from '../../src/main/security/secret-store'
import type { LoggerLike } from '../../src/main/shared/logger'
import { JsonStore } from '../../src/main/storage/json-store'

const silentLogger: LoggerLike = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

const fakeBackend: SafeStorageBackend = {
  isAvailable: async () => true,
  encrypt: async (text) => Buffer.from(`enc:${Buffer.from(text).toString('base64')}`),
  decrypt: async (buffer) => ({
    result: Buffer.from(buffer.toString().slice(4), 'base64').toString(),
    shouldReEncrypt: false
  })
}

interface ClientHandlers {
  profile?: GmailClientLike['users']['getProfile']
  history?: GmailClientLike['users']['history']['list']
  message?: GmailClientLike['users']['messages']['get']
}

function makeClient(handlers: ClientHandlers): GmailClientLike {
  return {
    users: {
      getProfile:
        handlers.profile ??
        (async () => ({ data: { emailAddress: 'me@example.com', historyId: '200' } })),
      history: {
        list: handlers.history ?? (async () => ({ data: { history: [], historyId: '101' } }))
      },
      messages: {
        get: handlers.message ?? (async () => ({ data: { payload: { headers: [] } } }))
      }
    }
  }
}

const temporaryDirectories: string[] = []
const stores: Array<{ state: JsonStore<GmailState> }> = []

async function createService(
  client: GmailClientLike,
  state: Partial<GmailState> = {}
): Promise<{ service: GmailService; stateStore: JsonStore<GmailState> }> {
  const directory = mkdtempSync(join(tmpdir(), 'flowerbuddy-gmail-'))
  temporaryDirectories.push(directory)

  const secretStore = new SecretStore(join(directory, 'secrets.enc.json'), fakeBackend)
  secretStore.load()
  await secretStore.setMany([
    { id: SECRET_GMAIL_CLIENT_ID, value: 'client-id' },
    { id: SECRET_GMAIL_CLIENT_SECRET, value: 'client-secret' },
    { id: SECRET_GMAIL_REFRESH_TOKEN, value: 'refresh-token' }
  ])

  const stateStore = new JsonStore<GmailState>(join(directory, 'gmail-state.json'), {
    label: 'gmail-state',
    defaults: createEmptyGmailState,
    sanitize: sanitizeGmailState,
    saveDelayMs: 5000
  })
  stateStore.load()
  stateStore.set({ ...createEmptyGmailState(), ...state })
  stateStore.flush()
  stores.push({ state: stateStore })

  const options: GmailServiceOptions = {
    secretStore,
    stateStore,
    logger: silentLogger,
    openExternal: async () => {},
    clientFactory: () => client,
    now: () => new Date('2026-10-17T04:00:00.000Z'),
    requestTimeoutMs: 2000
  }
  return { service: new GmailService(options), stateStore }
}

afterEach(() => {
  for (const store of stores.splice(0)) {
    store.state.flush()
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('gmail service', () => {
  it('establishes a baseline without reporting historical mail', async () => {
    const client = makeClient({
      profile: async () => ({ data: { emailAddress: 'me@example.com', historyId: '500' } })
    })
    const { service } = await createService(client, { historyId: null })

    const outcome = await service.poll()

    expect(outcome.summary).toEqual({
      newMessages: 0,
      baselineReestablished: false
    })
    expect(outcome.messages).toHaveLength(0)
    expect(service.getState()).toMatchObject({
      emailAddress: 'me@example.com',
      historyId: '500'
    })
  })

  it('fetches metadata only, decodes headers and deduplicates ids', async () => {
    const getMessage = vi.fn(async ({ id }: { id: string }) => ({
      data: {
        id,
        payload: {
          headers: [
            { name: 'From', value: '=?UTF-8?B?5byg5LiJ?= <a@example.com>' },
            { name: 'Subject', value: '=?UTF-8?Q?Hello_World?=' },
            { name: 'Date', value: 'Fri, 17 Oct 2026 12:00:00 +0800' }
          ]
        }
      }
    }))
    const listHistory = vi.fn(async () => ({
      data: {
        history: [
          {
            messagesAdded: [
              { message: { id: 'm1' } },
              { message: { id: 'm1' } },
              { message: { id: 'm2' } }
            ]
          }
        ],
        historyId: '101'
      }
    }))

    const { service } = await createService(
      makeClient({ history: listHistory, message: getMessage }),
      { historyId: '100' }
    )

    const outcome = await service.poll()

    expect(outcome.summary.newMessages).toBe(2)
    expect(outcome.messages[0]).toMatchObject({
      id: 'm1',
      from: '张三 <a@example.com>',
      subject: 'Hello World'
    })
    expect(getMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'me',
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date']
      })
    )
    expect(service.getState().notifiedMessageIds).toEqual(['m1', 'm2'])
    expect(service.getState().historyId).toBe('101')

    await service.poll()
    expect(getMessage).toHaveBeenCalledTimes(2)
  })

  it('re-establishes the baseline when the history id is too old', async () => {
    const history = vi.fn(async () => {
      const error = new Error('not found') as Error & {
        response: { status: number }
      }
      error.response = { status: 404 }
      throw error
    })
    const profile = vi.fn(async () => ({
      data: { emailAddress: 'me@example.com', historyId: '900' }
    }))

    const { service } = await createService(makeClient({ history, profile }), {
      historyId: '100'
    })

    const outcome = await service.poll()

    expect(outcome.summary).toEqual({
      newMessages: 0,
      baselineReestablished: true
    })
    expect(outcome.messages).toHaveLength(0)
    expect(service.getState().historyId).toBe('900')
    expect(service.getState().authExpired).toBe(false)
  })

  it('marks auth expired and stops calling Gmail after 401', async () => {
    const history = vi.fn(async () => {
      const error = new Error('unauthorized') as Error & {
        response: { status: number }
      }
      error.response = { status: 401 }
      throw error
    })
    const { service } = await createService(makeClient({ history }), {
      historyId: '100'
    })

    await expect(service.poll()).rejects.toMatchObject({ code: 'AUTH_EXPIRED' })
    expect(service.getState().authExpired).toBe(true)

    await expect(service.poll()).rejects.toMatchObject({ code: 'AUTH_EXPIRED' })
    expect(history).toHaveBeenCalledTimes(1)
  })

  it('maps rate limits and network failures', async () => {
    const rateLimited = vi.fn(async () => {
      const error = new Error('quota') as Error & { response: { status: number } }
      error.response = { status: 429 }
      throw error
    })
    const first = await createService(makeClient({ history: rateLimited }), {
      historyId: '100'
    })
    await expect(first.service.poll()).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryable: true
    })

    const networkError = new TypeError('fetch failed') as TypeError & {
      cause: { code: string }
    }
    networkError.cause = { code: 'ENOTFOUND' }
    const offline = vi.fn(async () => {
      throw networkError
    })
    const second = await createService(makeClient({ history: offline }), {
      historyId: '100'
    })
    await expect(second.service.poll()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      retryable: true
    })
  })

  it('times out slow Gmail requests', async () => {
    const history = (() =>
      new Promise(() => {})) as unknown as GmailClientLike['users']['history']['list']
    const { service } = await createService(makeClient({ history }), {
      historyId: '100'
    })

    await expect(service.poll()).rejects.toMatchObject({ code: 'TIMEOUT' })
  })
})
