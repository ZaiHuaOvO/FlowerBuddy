import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sanitizeMemoData } from '../../src/main/modules/memo/memo-data'
import { MemoModule } from '../../src/main/modules/memo/memo-module'
import { MemoService } from '../../src/main/modules/memo/memo-service'
import { createEmptyMemoData, type MemoData } from '../../src/main/modules/memo/types'
import { TaskScheduler } from '../../src/main/scheduler/task-scheduler'
import type { LoggerLike } from '../../src/main/shared/logger'
import { JsonStore } from '../../src/main/storage/json-store'

const logger: LoggerLike = { info: () => {}, warn: () => {}, error: () => {} }
const temporaryDirectories: string[] = []

function createHarness() {
  const directory = mkdtempSync(join(tmpdir(), 'flowerbuddy-memo-module-'))
  temporaryDirectories.push(directory)
  const store = new JsonStore<MemoData>(join(directory, 'memos.json'), {
    label: 'memos',
    defaults: createEmptyMemoData,
    sanitize: sanitizeMemoData
  })
  store.load()
  const service = new MemoService(store, { remove: () => {} })
  const module = new MemoModule(service)
  const messages: string[] = []
  const scheduler = new TaskScheduler({ logger })
  return {
    service,
    module,
    messages,
    context: { scheduler, logger, notify: (message: string) => messages.push(message) }
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 18, 9, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('memo reminder module', () => {
  it('notifies once when a reminder becomes due', async () => {
    const { service, module, messages, context } = createHarness()
    service.create({
      text: '开会\n带上资料',
      images: [],
      reminderAt: new Date(2026, 9, 18, 9, 1, 0).toISOString()
    })

    module.start(context)
    expect(messages).toEqual([])

    await vi.advanceTimersByTimeAsync(61_000)
    expect(messages).toEqual(['备忘提醒：开会'])

    await vi.advanceTimersByTimeAsync(120_000)
    expect(messages).toEqual(['备忘提醒：开会'])
    module.stop()
  })

  it('fires overdue reminders on start and stops after module stop', async () => {
    const { service, module, messages, context } = createHarness()
    service.create({
      text: '补提醒',
      images: [],
      reminderAt: new Date(2026, 9, 18, 8, 0, 0).toISOString()
    })

    module.start(context)
    await vi.advanceTimersByTimeAsync(0)
    expect(messages).toEqual(['备忘提醒：补提醒'])

    service.create({
      text: 'later',
      images: [],
      reminderAt: new Date(2026, 9, 18, 9, 2, 0).toISOString()
    })
    module.stop()
    await vi.advanceTimersByTimeAsync(180_000)
    expect(messages).toEqual(['备忘提醒：补提醒'])
  })

  it('combines multiple due reminders into one bubble', async () => {
    const { service, module, messages, context } = createHarness()
    service.create({
      text: '第一条',
      images: [],
      reminderAt: new Date(2026, 9, 18, 8, 59, 0).toISOString()
    })
    service.create({
      text: '第二条',
      images: [],
      reminderAt: new Date(2026, 9, 18, 8, 59, 30).toISOString()
    })

    module.start(context)
    await vi.advanceTimersByTimeAsync(0)
    expect(messages).toEqual(['备忘提醒：第一条 等 2 条'])
    module.stop()
  })
})
