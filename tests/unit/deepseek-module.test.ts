import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeepSeekModule } from '../../src/main/modules/deepseek/deepseek-module'
import type { SecretReader } from '../../src/main/modules/types'
import { TaskScheduler } from '../../src/main/scheduler/task-scheduler'
import { SECRET_DEEPSEEK_API_KEY } from '../../src/main/security/secret-ids'
import type { LoggerLike } from '../../src/main/shared/logger'
import { ConfigStore } from '../../src/main/storage/config-store'
import type { DeepSeekBalance } from '../../src/shared/api'

const BALANCE: DeepSeekBalance = {
  isAvailable: true,
  balances: [
    {
      currency: 'CNY',
      totalBalance: '110.00',
      grantedBalance: '10.00',
      toppedUpBalance: '100.00'
    }
  ],
  fetchedAt: '2026-10-17T04:00:00.000Z'
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
  const directory = mkdtempSync(join(tmpdir(), 'flowerbuddy-deepseek-'))
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

describe('DeepSeek module', () => {
  it('is not configured without an API key', () => {
    const module = new DeepSeekModule({
      secretStore: secretReader({}),
      configStore: createConfigStore()
    })

    expect(module.isConfigured()).toBe(false)
    expect(module.getStatus()).toBe('not-configured')
    expect(module.actions.map((action) => action.id)).toEqual(['deepseek:balance'])
  })

  it('formats the quick bubble balance phrase without daily spend', async () => {
    const module = new DeepSeekModule({
      secretStore: secretReader({ [SECRET_DEEPSEEK_API_KEY]: 'sk-test' }),
      configStore: createConfigStore(),
      fetchBalance: async () => BALANCE
    })

    const result = await module.runAction('deepseek:balance')
    expect(result.state).toBe('success')
    expect(result.message).toBe('大鲸鱼还有 ¥110.00 的米饭可以吃喵')
    expect(result.message).not.toContain('赠送')
    expect(result.message).not.toContain('今日花费')
  })

  it('refuses to query without a stored key', async () => {
    const module = new DeepSeekModule({
      secretStore: secretReader({}),
      configStore: createConfigStore()
    })

    await expect(module.runAction('deepseek:balance')).rejects.toMatchObject({
      code: 'NOT_CONFIGURED'
    })
  })

  it('schedules auto refresh only when configured and enabled', () => {
    const configStore = createConfigStore()
    const scheduler = new TaskScheduler({ logger })
    const module = new DeepSeekModule({
      secretStore: secretReader({ [SECRET_DEEPSEEK_API_KEY]: 'sk-test' }),
      configStore,
      fetchBalance: async () => BALANCE
    })

    configStore.setModuleRefreshInterval('deepseek', 15)
    module.start({ scheduler, logger, notify: () => {} })
    expect(scheduler.getTaskIds()).toEqual(['deepseek:refresh'])

    configStore.setModuleRefreshInterval('deepseek', null)
    module.refreshSchedules()
    expect(scheduler.getTaskIds()).toEqual([])

    module.stop()
    scheduler.stopAll()
  })

  it('does not schedule refresh without a key', () => {
    const configStore = createConfigStore()
    configStore.setModuleRefreshInterval('deepseek', 15)
    const scheduler = new TaskScheduler({ logger })
    const module = new DeepSeekModule({
      secretStore: secretReader({}),
      configStore
    })

    module.start({ scheduler, logger, notify: () => {} })
    expect(scheduler.getTaskIds()).toEqual([])
    module.stop()
  })
})
