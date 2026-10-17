import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebsiteService } from '../../src/main/modules/website-check/website-service'
import {
  createEmptyWebsiteData,
  sanitizeWebsiteData,
  type WebsiteData
} from '../../src/main/modules/website-check/website-types'
import { AppError } from '../../src/main/shared/errors'
import { JsonStore } from '../../src/main/storage/json-store'

const temporaryDirectories: string[] = []
const stores: Array<JsonStore<WebsiteData>> = []

function createService(fetchImpl?: typeof fetch) {
  const directory = mkdtempSync(join(tmpdir(), 'flowerbuddy-websites-'))
  temporaryDirectories.push(directory)
  const store = new JsonStore<WebsiteData>(join(directory, 'website-checks.json'), {
    label: 'website-checks',
    defaults: createEmptyWebsiteData,
    sanitize: sanitizeWebsiteData,
    saveDelayMs: 5000
  })
  store.load()
  stores.push(store)
  const now = () => new Date('2026-10-17T04:00:00.000Z')
  return {
    service: new WebsiteService(store, { fetchImpl, now }),
    store
  }
}

function responseFetch(status: number): typeof fetch {
  return (async () => new Response(null, { status })) as unknown as typeof fetch
}

afterEach(() => {
  for (const store of stores.splice(0)) {
    store.flush()
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('website service', () => {
  it('creates, updates and removes checks', () => {
    const { service } = createService()

    const created = service.create({
      name: '个人博客',
      url: 'https://example.com',
      timeoutMs: 8000,
      pollingIntervalMinutes: null
    })
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      name: '个人博客',
      enabled: true,
      timeoutMs: 8000,
      pollingIntervalMinutes: null,
      lastResult: null
    })

    const id = created[0]?.id as string
    const updated = service.update(id, { name: '博客', pollingIntervalMinutes: 10 })
    expect(updated[0]).toMatchObject({ name: '博客', pollingIntervalMinutes: 10 })

    expect(service.remove(id)).toHaveLength(0)
    expect(() => service.remove(id)).toThrow(AppError)
  })

  it('validates URL and clamps timeout values', () => {
    const { service } = createService()

    expect(() =>
      service.create({
        name: 'bad',
        url: 'ftp://example.com',
        timeoutMs: 8000,
        pollingIntervalMinutes: null
      })
    ).toThrow(AppError)

    const created = service.create({
      name: '超时',
      url: 'http://127.0.0.1:8080',
      timeoutMs: 1,
      pollingIntervalMinutes: 999
    })
    expect(created[0]?.timeoutMs).toBe(3000)
    expect(created[0]?.pollingIntervalMinutes).toBe(60)
  })

  it('stores per-URL check results', async () => {
    const { service } = createService(responseFetch(200))
    const created = service.create({
      name: '正常',
      url: 'https://example.com',
      timeoutMs: 8000,
      pollingIntervalMinutes: null
    })
    const id = created[0]?.id as string

    const checked = await service.checkOne(id)
    expect(checked[0]?.lastResult).toMatchObject({
      ok: true,
      status: 200,
      errorKind: 'none',
      checkedAt: '2026-10-17T04:00:00.000Z'
    })
  })

  it('summarizes check-all results and distinguishes failures', async () => {
    let currentUrl = ''
    const fetchImpl = (async (input: string | URL | Request) => {
      currentUrl = String(input)
      return new Response(null, {
        status: currentUrl.includes('broken') ? 404 : 200
      })
    }) as unknown as typeof fetch

    const { service } = createService(fetchImpl)
    service.create({
      name: '正常站点',
      url: 'https://ok.example',
      timeoutMs: 8000,
      pollingIntervalMinutes: null
    })
    service.create({
      name: '异常站点',
      url: 'https://broken.example',
      timeoutMs: 8000,
      pollingIntervalMinutes: null
    })

    const { summary, configs } = await service.checkAllEnabled()

    expect(summary.state).toBe('error')
    expect(summary.message).toContain('2 个网站')
    expect(summary.message).toContain('1 个正常')
    expect(summary.message).toContain('异常站点')
    expect(configs.every((check) => check.lastResult !== null)).toBe(true)
  })

  it('returns an empty summary without enabled checks', async () => {
    const { service } = createService()
    const created = service.create({
      name: '停用',
      url: 'https://example.com',
      timeoutMs: 8000,
      pollingIntervalMinutes: null,
      enabled: false
    })
    expect(created[0]?.enabled).toBe(false)

    const { summary } = await service.checkAllEnabled()
    expect(summary.state).toBe('empty')
  })

  it('notifies the listener on configuration changes but not on checks', async () => {
    const { service } = createService(responseFetch(200))
    const listener = vi.fn()
    service.setChangeListener(listener)

    const created = service.create({
      name: '站点',
      url: 'https://example.com',
      timeoutMs: 8000,
      pollingIntervalMinutes: 5
    })
    expect(listener).toHaveBeenCalledTimes(1)

    const id = created[0]?.id as string
    await service.checkOne(id)
    expect(listener).toHaveBeenCalledTimes(1)

    service.setEnabled(id, false)
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
