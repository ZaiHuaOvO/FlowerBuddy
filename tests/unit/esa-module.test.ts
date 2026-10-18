import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EsaModule } from '../../src/main/modules/esa/esa-module'
import type { SecretReader } from '../../src/main/modules/types'
import { TaskScheduler } from '../../src/main/scheduler/task-scheduler'
import {
  SECRET_ESA_ACCESS_KEY_ID,
  SECRET_ESA_ACCESS_KEY_SECRET
} from '../../src/main/security/secret-ids'
import type { LoggerLike } from '../../src/main/shared/logger'
import { ConfigStore } from '../../src/main/storage/config-store'
import type { EsaTraffic } from '../../src/shared/api'

const TRAFFIC: EsaTraffic = {
  bytes: 1536,
  samplingRate: 100,
  intervalSeconds: 300,
  startTime: '2026-10-16T16:00:00.000Z',
  endTime: '2026-10-17T04:30:00.000Z',
  fetchedAt: '2026-10-17T04:30:00.000Z'
}

const logger: LoggerLike = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

function secretReader(values: Record<string, string>): SecretReader {
  return {
    has: (id) => id in values,
    get: async (id) => values[id] ?? null
  }
}

const temporaryDirectories: string[] = []
const stores: ConfigStore[] = []

function createConfigStore(): ConfigStore {
  const directory = mkdtempSync(join(tmpdir(), 'flowerbuddy-esa-'))
  temporaryDirectories.push(directory)
  const store = new ConfigStore(join(directory, 'config.json'), { saveDelayMs: 5000 })
  store.load()
  stores.push(store)
  return store
}

afterEach(() => {
  for (const store of stores.splice(0)) {
    store.flush()
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('ESA module', () => {
  it('requires both secrets and a SiteId', () => {
    const configStore = createConfigStore()
    const onlyId = new EsaModule({
      secretStore: secretReader({ [SECRET_ESA_ACCESS_KEY_ID]: 'id' }),
      configStore
    })
    expect(onlyId.isConfigured()).toBe(false)

    const bothSecrets = new EsaModule({
      secretStore: secretReader({
        [SECRET_ESA_ACCESS_KEY_ID]: 'id',
        [SECRET_ESA_ACCESS_KEY_SECRET]: 'secret'
      }),
      configStore
    })
    expect(bothSecrets.isConfigured()).toBe(false)

    configStore.setEsaSiteId('site-1')
    const configured = new EsaModule({
      secretStore: secretReader({
        [SECRET_ESA_ACCESS_KEY_ID]: 'id',
        [SECRET_ESA_ACCESS_KEY_SECRET]: 'secret'
      }),
      configStore
    })
    expect(configured.isConfigured()).toBe(true)
    expect(configured.getStatus()).toBe('ready')
  })

  it('formats today traffic with sampling caveat', async () => {
    const configStore = createConfigStore()
    configStore.setEsaSiteId('site-1')
    const module = new EsaModule({
      secretStore: secretReader({
        [SECRET_ESA_ACCESS_KEY_ID]: 'id',
        [SECRET_ESA_ACCESS_KEY_SECRET]: 'secret'
      }),
      configStore,
      fetchTraffic: async () => TRAFFIC
    })

    const result = await module.runAction('esa:traffic')
    expect(result.state).toBe('success')
    expect(result.message).toContain('1.50 KB')
    expect(result.message).toContain('采样率 100%')
    expect(result.message).toContain('不等同于精确账单')
  })

  it('refuses to query without credentials or SiteId', async () => {
    const configStore = createConfigStore()
    const module = new EsaModule({
      secretStore: secretReader({}),
      configStore
    })

    await expect(module.runAction('esa:traffic')).rejects.toMatchObject({
      code: 'NOT_CONFIGURED'
    })

    configStore.setEsaSiteId('site-1')
    const missingSecret = new EsaModule({
      secretStore: secretReader({ [SECRET_ESA_ACCESS_KEY_ID]: 'id' }),
      configStore
    })
    await expect(missingSecret.runAction('esa:traffic')).rejects.toMatchObject({
      code: 'NOT_CONFIGURED'
    })
  })

  it('schedules auto refresh only when configured with an interval', () => {
    const configStore = createConfigStore()
    configStore.setEsaSiteId('site-1')
    const scheduler = new TaskScheduler({ logger })
    const module = new EsaModule({
      secretStore: secretReader({
        [SECRET_ESA_ACCESS_KEY_ID]: 'id',
        [SECRET_ESA_ACCESS_KEY_SECRET]: 'secret'
      }),
      configStore,
      fetchTraffic: async () => TRAFFIC
    })

    configStore.setModuleRefreshInterval('esa', 10)
    module.start({ scheduler, logger, notify: () => {} })
    expect(scheduler.getTaskIds()).toEqual(['esa:refresh'])

    configStore.setModuleRefreshInterval('esa', null)
    module.refreshSchedules()
    expect(scheduler.getTaskIds()).toEqual([])

    module.stop()
    scheduler.stopAll()
  })
})
