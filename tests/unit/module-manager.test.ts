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

function createTestModule(options: {
  id: ModuleId
  configured: boolean
  schedule?: boolean
  actionIds?: string[]
}) {
  let startCalls = 0
  let stopCalls = 0
  const module: ModuleDefinition = {
    id: options.id,
    name: options.id,
    description: '',
    requiresCredentials: !options.configured,
    implemented: true,
    actions: (options.actionIds ?? []).map((id) => ({
      id,
      label: id,
      loadingMessage: '正在处理…'
    })),
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
    },
    runAction: async (actionId) => {
      if (!options.actionIds?.includes(actionId)) {
        throw new Error('not found')
      }
      return { state: 'success', message: `${options.id} ok` }
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
  const memo = createTestModule({ id: 'memo', configured: true, schedule: true })
  const esa = createTestModule({ id: 'esa', configured: false })
  const manager = new ModuleManager({
    modules: [memo.module, esa.module],
    configStore,
    scheduler,
    logger: silentLogger,
    notify: () => {}
  })
  return { directory, configStore, scheduler, manager, memo, esa }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('module manager', () => {
  it('starts only enabled and configured modules', () => {
    const { manager, scheduler, memo, esa } = createEnvironment()

    manager.start()

    expect(memo.getStartCalls()).toBe(1)
    expect(esa.getStartCalls()).toBe(0)
    expect(scheduler.getTaskIds()).toEqual(['memo:tick'])

    const summaries = manager.list()
    expect(summaries.find((module) => module.id === 'memo')).toMatchObject({
      enabled: true,
      configured: true,
      status: 'ready',
      statusLabel: '已就绪'
    })
    expect(summaries.find((module) => module.id === 'esa')).toMatchObject({
      enabled: false,
      configured: false,
      status: 'not-configured',
      statusLabel: '未配置'
    })

    manager.stop()
  })

  it('stops a module and its scheduled tasks when disabled', () => {
    const { manager, scheduler, memo, configStore } = createEnvironment()
    manager.start()

    manager.setEnabled('memo', false)

    expect(memo.getStopCalls()).toBe(1)
    expect(scheduler.getTaskIds()).toEqual([])
    expect(configStore.get().modules.memo.enabled).toBe(false)

    manager.stop()
  })

  it('restarts a module when re-enabled', () => {
    const { manager, scheduler, memo } = createEnvironment()
    manager.start()

    manager.setEnabled('memo', false)
    manager.setEnabled('memo', true)

    expect(memo.getStartCalls()).toBe(2)
    expect(scheduler.getTaskIds()).toEqual(['memo:tick'])

    manager.stop()
  })

  it('does not start an enabled but unconfigured module', () => {
    const { manager, esa } = createEnvironment()
    manager.start()

    manager.setEnabled('esa', true)

    expect(esa.getStartCalls()).toBe(0)
    manager.stop()
  })

  it('stops every module and clears the scheduler on shutdown', () => {
    const { manager, scheduler, memo } = createEnvironment()
    manager.start()

    manager.stop()

    expect(memo.getStopCalls()).toBe(1)
    expect(scheduler.getTaskIds()).toEqual([])
  })

  it('exposes actions only for enabled and configured modules', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'flowerbuddy-actions-'))
    temporaryDirectories.push(directory)
    const configStore = new ConfigStore(join(directory, 'config.json'), {
      saveDelayMs: 5000
    })
    configStore.load()
    const scheduler = new TaskScheduler({ logger: silentLogger })
    const memo = createTestModule({
      id: 'memo',
      configured: true,
      actionIds: ['memo:upcoming']
    })
    const esa = createTestModule({
      id: 'esa',
      configured: false,
      actionIds: ['esa:traffic']
    })
    const manager = new ModuleManager({
      modules: [memo.module, esa.module],
      configStore,
      scheduler,
      logger: silentLogger,
      notify: () => {}
    })
    manager.start()

    expect(manager.getMenuActions()).toEqual([
      { id: 'memo:upcoming', label: 'memo:upcoming', moduleId: 'memo' }
    ])
    await expect(manager.runAction('memo:upcoming')).resolves.toEqual({
      state: 'success',
      message: 'memo ok'
    })

    manager.setEnabled('memo', false)
    expect(manager.getMenuActions()).toEqual([])
    await expect(manager.runAction('memo:upcoming')).rejects.toMatchObject({
      code: 'MODULE_DISABLED'
    })
    await expect(manager.runAction('missing:action')).rejects.toMatchObject({
      code: 'UNKNOWN_ACTION'
    })

    manager.stop()
    configStore.flush()
  })
})
