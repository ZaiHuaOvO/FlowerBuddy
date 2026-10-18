import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebsiteCheckModule } from '../../src/main/modules/website-check/website-module'
import { WebsiteService } from '../../src/main/modules/website-check/website-service'
import {
  createEmptyWebsiteData,
  sanitizeWebsiteData,
  type WebsiteData
} from '../../src/main/modules/website-check/website-types'
import { TaskScheduler } from '../../src/main/scheduler/task-scheduler'
import type { LoggerLike } from '../../src/main/shared/logger'
import { JsonStore } from '../../src/main/storage/json-store'

const temporaryDirectories: string[] = []
const stores: Array<JsonStore<WebsiteData>> = []

function createLogger(): LoggerLike {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

function createEnvironment() {
  const directory = mkdtempSync(join(tmpdir(), 'flowerbuddy-website-module-'))
  temporaryDirectories.push(directory)
  const store = new JsonStore<WebsiteData>(join(directory, 'website-checks.json'), {
    label: 'website-checks',
    defaults: createEmptyWebsiteData,
    sanitize: sanitizeWebsiteData,
    saveDelayMs: 5000
  })
  store.load()
  stores.push(store)

  const service = new WebsiteService(store, {
    fetchImpl: (async () => new Response(null, { status: 200 })) as unknown as typeof fetch,
    now: () => new Date('2026-10-17T04:00:00.000Z')
  })
  const scheduler = new TaskScheduler()
  const logger = createLogger()
  const module = new WebsiteCheckModule(service)
  return { module, service, scheduler, logger, store }
}

afterEach(() => {
  for (const store of stores.splice(0)) {
    store.flush()
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('website check module', () => {
  it('schedules polling checks and removes them when disabled', () => {
    const { module, service, scheduler, logger, store } = createEnvironment()
    module.start({ scheduler, logger, notify: () => {} })

    const created = service.create({
      name: '轮询站点',
      url: 'https://example.com',
      timeoutMs: 8000,
      pollingIntervalMinutes: 5
    })
    const id = created[0]?.id as string

    expect(scheduler.getTaskIds()).toEqual([`website-check:${id}`])

    service.setEnabled(id, false)
    expect(scheduler.getTaskIds()).toEqual([])

    module.stop()
    store.flush()
  })

  it('does not schedule manual-only checks', () => {
    const { module, service, scheduler, logger, store } = createEnvironment()
    module.start({ scheduler, logger, notify: () => {} })

    service.create({
      name: '手动站点',
      url: 'https://example.com',
      timeoutMs: 8000,
      pollingIntervalMinutes: null
    })

    expect(scheduler.getTaskIds()).toEqual([])

    module.stop()
    store.flush()
  })

  it('removes schedules when a check is deleted', () => {
    const { module, service, scheduler, logger, store } = createEnvironment()
    module.start({ scheduler, logger, notify: () => {} })

    const created = service.create({
      name: '删除站点',
      url: 'https://example.com',
      timeoutMs: 8000,
      pollingIntervalMinutes: 5
    })
    const id = created[0]?.id as string
    expect(scheduler.getTaskIds()).toHaveLength(1)

    service.remove(id)
    expect(scheduler.getTaskIds()).toEqual([])

    module.stop()
    store.flush()
  })

  it('stops all schedules when the module stops', () => {
    const { module, service, scheduler, logger, store } = createEnvironment()
    module.start({ scheduler, logger, notify: () => {} })
    service.create({
      name: '站点',
      url: 'https://example.com',
      timeoutMs: 8000,
      pollingIntervalMinutes: 5
    })
    expect(scheduler.getTaskIds()).toHaveLength(1)

    module.stop()
    expect(scheduler.getTaskIds()).toEqual([])

    store.flush()
  })

  it('runs all enabled checks as a menu action', async () => {
    const { module, service, scheduler, logger, store } = createEnvironment()
    module.start({ scheduler, logger, notify: () => {} })
    service.create({
      name: '站点',
      url: 'https://example.com',
      timeoutMs: 8000,
      pollingIntervalMinutes: null
    })

    const result = await module.runAction('website-check:run-all')
    expect(result.state).toBe('success')
    expect(result.message).toContain('1 个正常')

    module.stop()
    store.flush()
  })
})
