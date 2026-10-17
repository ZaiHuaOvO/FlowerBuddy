import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ModuleManager } from '../../src/main/modules/module-manager'
import type { ModuleDefinition } from '../../src/main/modules/types'
import { TaskScheduler } from '../../src/main/scheduler/task-scheduler'
import type { LoggerLike } from '../../src/main/shared/logger'
import { ConfigStore } from '../../src/main/storage/config-store'
import type { ModuleId } from '../../src/shared/api'

const silentLogger: LoggerLike = {
  info: () => {},
  warn: () => {},
  error: () => {}
}

function createTestModule(options: { id: ModuleId; configured: boolean; schedule?: boolean }) {
  let startCalls = 0
  let stopCalls = 0
  const module: ModuleDefinition = {
    id: options.id,
    name: options.id,
    description: '',
    requiresCredentials: !options.configured,
    implemented: true,
    isConfigured: () => options.configured,
    getStatus: () => (options.configured ? 'ready' : 'not-configured'),
    start: (context) => {
      startCalls += 1
      if (options.schedule) {
        context.scheduler.start({
          id: `${options.id}:tick`,
          owner: options.id,
          intervalMs: 60000,
          run: async () => {}
        })
      }
    },
    stop: () => {
      stopCalls += 1
    }
  }
  return {
    module,
    getStartCalls: () => startCalls,
    getStopCalls: () => stopCalls
  }
}

const temporaryDirectories: string[] = []

function createEnvironment() {
  const directory = mkdtempSync(join(tmpdir(), 'flowerbuddy-modules-'))
  temporaryDirectories.push(directory)
  const configStore = new ConfigStore(join(directory, 'config.json'), {
    saveDelayMs: 5000
  })
  configStore.load()
  const scheduler = new TaskScheduler({ logger: silentLogger })
  const dates = createTestModule({ id: 'dates', configured: true, schedule: true })
  const gmail = createTestModule({ id: 'gmail', configured: false })
  const manager = new ModuleManager({
    modules: [dates.module, gmail.module],
    configStore,
    scheduler,
    logger: silentLogger
  })
  return { directory, configStore, scheduler, manager, dates, gmail }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('module manager', () => {
  it('starts only enabled and configured modules', () => {
    const { manager, scheduler, dates, gmail } = createEnvironment()

    manager.start()

    expect(dates.getStartCalls()).toBe(1)
    expect(gmail.getStartCalls()).toBe(0)
    expect(scheduler.getTaskIds()).toEqual(['dates:tick'])

    const summaries = manager.list()
    expect(summaries.find((module) => module.id === 'dates')).toMatchObject({
      enabled: true,
      configured: true,
      status: 'ready',
      statusLabel: '已就绪'
    })
    expect(summaries.find((module) => module.id === 'gmail')).toMatchObject({
      enabled: false,
      configured: false,
      status: 'not-configured',
      statusLabel: '未配置'
    })

    manager.stop()
  })

  it('stops a module and its scheduled tasks when disabled', () => {
    const { manager, scheduler, dates, configStore } = createEnvironment()
    manager.start()

    manager.setEnabled('dates', false)

    expect(dates.getStopCalls()).toBe(1)
    expect(scheduler.getTaskIds()).toEqual([])
    expect(configStore.get().modules.dates.enabled).toBe(false)

    manager.stop()
  })

  it('restarts a module when re-enabled', () => {
    const { manager, scheduler, dates } = createEnvironment()
    manager.start()

    manager.setEnabled('dates', false)
    manager.setEnabled('dates', true)

    expect(dates.getStartCalls()).toBe(2)
    expect(scheduler.getTaskIds()).toEqual(['dates:tick'])

    manager.stop()
  })

  it('does not start an enabled but unconfigured module', () => {
    const { manager, gmail } = createEnvironment()
    manager.start()

    manager.setEnabled('gmail', true)

    expect(gmail.getStartCalls()).toBe(0)
    manager.stop()
  })

  it('stops every module and clears the scheduler on shutdown', () => {
    const { manager, scheduler, dates } = createEnvironment()
    manager.start()

    manager.stop()

    expect(dates.getStopCalls()).toBe(1)
    expect(scheduler.getTaskIds()).toEqual([])
  })
})
