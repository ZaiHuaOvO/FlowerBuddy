import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IntervalReminderModule } from '../../src/main/modules/interval-reminder/interval-reminder-module'
import { IntervalReminderService } from '../../src/main/modules/interval-reminder/interval-reminder-service'
import { sanitizeIntervalReminderData } from '../../src/main/modules/interval-reminder/reminder-data'
import {
  createEmptyIntervalReminderData,
  type IntervalReminderData
} from '../../src/main/modules/interval-reminder/types'
import { TaskScheduler } from '../../src/main/scheduler/task-scheduler'
import type { LoggerLike } from '../../src/main/shared/logger'
import { JsonStore } from '../../src/main/storage/json-store'

const logger: LoggerLike = { info: () => {}, warn: () => {}, error: () => {} }
const temporaryDirectories: string[] = []

function createHarness() {
  const directory = mkdtempSync(join(tmpdir(), 'flowerbuddy-interval-module-'))
  temporaryDirectories.push(directory)
  const store = new JsonStore<IntervalReminderData>(join(directory, 'interval-reminders.json'), {
    label: 'interval-reminders',
    defaults: createEmptyIntervalReminderData,
    sanitize: sanitizeIntervalReminderData
  })
  store.load()
  const service = new IntervalReminderService(store)
  const messages: Array<{ text: string; persistent: boolean; id: string | undefined }> = []
  const scheduler = new TaskScheduler({ logger })
  const context = {
    scheduler,
    logger,
    notify: (text: string, options?: { persistent?: boolean; id?: string }) => {
      messages.push({ text, persistent: options?.persistent === true, id: options?.id })
    }
  }
  return { service, messages, context }
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

describe('interval reminder module', () => {
  it('fires enabled reminders with the configured text as a persistent bubble', async () => {
    const { service, messages, context } = createHarness()
    service.create({
      name: '喝水',
      text: '该喝水啦！',
      enabled: true,
      intervalMinutes: 1,
      ranges: [],
      randomEnabled: false,
      randomJitterMinutes: 0
    })
    const module = new IntervalReminderModule(
      service,
      () => 0.5,
      () => Date.now(),
      1000
    )
    module.start(context)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(messages).toEqual([])
    await vi.advanceTimersByTimeAsync(31_000)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ text: '该喝水啦！', persistent: true })
    expect(messages[0]?.id).toMatch(/^interval-reminder:/)
    module.stop()
  })

  it('reuses the same bubble id when the same reminder fires again', async () => {
    const { service, messages, context } = createHarness()
    service.create({
      name: '喝水',
      text: '该喝水啦！',
      enabled: true,
      intervalMinutes: 1,
      ranges: [],
      randomEnabled: false,
      randomJitterMinutes: 0
    })
    const module = new IntervalReminderModule(
      service,
      () => 0.5,
      () => Date.now(),
      1000
    )
    module.start(context)

    await vi.advanceTimersByTimeAsync(61_000)
    await vi.advanceTimersByTimeAsync(61_000)

    expect(messages).toHaveLength(2)
    expect(messages[0]?.id).toBe(messages[1]?.id)
    expect(messages[0]?.id).toMatch(/^interval-reminder:/)
    module.stop()
  })

  it('does not fire disabled reminders and stops after disabling', async () => {
    const { service, messages, context } = createHarness()
    const created = service.create({
      name: '活动',
      text: '起来活动',
      enabled: false,
      intervalMinutes: 1,
      ranges: [],
      randomEnabled: false,
      randomJitterMinutes: 0
    })
    const id = created.find((item) => item.name === '活动')?.id as string
    const module = new IntervalReminderModule(
      service,
      () => 0.5,
      () => Date.now(),
      1000
    )
    module.start(context)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(messages).toEqual([])

    service.setEnabled(id, true)
    await vi.advanceTimersByTimeAsync(61_000)
    expect(messages).toHaveLength(1)

    service.setEnabled(id, false)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(messages).toHaveLength(1)
    module.stop()
  })

  it('waits for the next effective window', async () => {
    vi.setSystemTime(new Date(2026, 9, 18, 12, 30, 0))
    const { service, messages, context } = createHarness()
    service.create({
      name: '下午提醒',
      text: '下午好',
      enabled: true,
      intervalMinutes: 1,
      ranges: [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '18:00' }
      ],
      randomEnabled: false,
      randomJitterMinutes: 0
    })
    const module = new IntervalReminderModule(
      service,
      () => 0.5,
      () => Date.now(),
      60_000
    )
    module.start(context)

    // One minute after 12:30 would be outside the window, so it defers to 13:00.
    await vi.advanceTimersByTimeAsync(29 * 60_000)
    expect(messages).toEqual([])
    await vi.advanceTimersByTimeAsync(60_000)
    expect(messages).toHaveLength(1)
    module.stop()
  })
})
