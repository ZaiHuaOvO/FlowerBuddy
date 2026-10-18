import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { IntervalReminderService } from '../../src/main/modules/interval-reminder/interval-reminder-service'
import { sanitizeIntervalReminderData } from '../../src/main/modules/interval-reminder/reminder-data'
import {
  createEmptyIntervalReminderData,
  defaultReminderRanges,
  type IntervalReminderData
} from '../../src/main/modules/interval-reminder/types'
import { JsonStore } from '../../src/main/storage/json-store'

const temporaryDirectories: string[] = []

function createService(now = () => new Date(2026, 9, 18, 9, 0, 0)) {
  const directory = mkdtempSync(join(tmpdir(), 'flowerbuddy-interval-reminder-'))
  temporaryDirectories.push(directory)
  const store = new JsonStore<IntervalReminderData>(join(directory, 'interval-reminders.json'), {
    label: 'interval-reminders',
    defaults: createEmptyIntervalReminderData,
    sanitize: sanitizeIntervalReminderData
  })
  store.load()
  return { service: new IntervalReminderService(store, now), store }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('interval reminder service', () => {
  it('seeds the disabled drinking reminder once', () => {
    const { service, store } = createService()
    const reminders = service.list()

    expect(reminders).toHaveLength(1)
    expect(reminders[0]).toMatchObject({
      name: '喝水',
      text: '该喝水啦！',
      enabled: false,
      intervalMinutes: 30,
      ranges: defaultReminderRanges(),
      randomEnabled: true,
      randomJitterMinutes: 5,
      lastFiredAt: null
    })

    service.remove(reminders[0]?.id as string)
    const next = new IntervalReminderService(store)
    expect(next.list()).toEqual([])
  })

  it('creates, updates, toggles and removes reminders', () => {
    const { service } = createService()
    const created = service.create({
      name: '  站起来活动  ',
      text: '  活动一下  ',
      intervalMinutes: 60,
      ranges: [{ start: '09:00', end: '12:00' }],
      randomEnabled: true,
      randomJitterMinutes: 3
    })
    const reminder = created.find((item) => item.name === '站起来活动')
    expect(reminder).toMatchObject({
      text: '活动一下',
      enabled: true,
      intervalMinutes: 60,
      randomJitterMinutes: 3
    })

    const id = reminder?.id as string
    const updated = service.update(id, {
      intervalMinutes: 90,
      ranges: [],
      randomEnabled: false
    })
    expect(updated.find((item) => item.id === id)).toMatchObject({
      intervalMinutes: 90,
      ranges: [],
      randomEnabled: false
    })

    expect(service.setEnabled(id, false).find((item) => item.id === id)?.enabled).toBe(false)

    service.markFired(id, new Date(2026, 9, 18, 10, 0, 0))
    expect(service.list().find((item) => item.id === id)?.lastFiredAt).toBe(
      new Date(2026, 9, 18, 10, 0, 0).toISOString()
    )

    expect(service.remove(id).some((item) => item.id === id)).toBe(false)
  })

  it('rejects invalid reminder fields', () => {
    const { service } = createService()
    const base = {
      name: '测试',
      text: '文本',
      intervalMinutes: 30,
      ranges: [],
      randomEnabled: false,
      randomJitterMinutes: 0
    }
    expect(() => service.create({ ...base, name: '   ' })).toThrow()
    expect(() => service.create({ ...base, text: '' })).toThrow()
    expect(() => service.create({ ...base, intervalMinutes: 0 })).toThrow()
    expect(() => service.create({ ...base, ranges: [{ start: '09:00', end: '09:00' }] })).toThrow()
    expect(() => service.create({ ...base, ranges: [{ start: '25:00', end: '26:00' }] })).toThrow()
    expect(() => service.create({ ...base, randomJitterMinutes: -1 })).toThrow()
    expect(() => service.update('missing', { name: 'x' })).toThrow()
  })

  it('sanitizes stored reminders defensively', () => {
    const data = sanitizeIntervalReminderData({
      seeded: true,
      reminders: [
        {
          id: 'bad',
          name: '喝水',
          text: '该喝水啦！',
          enabled: 'yes',
          intervalMinutes: 5000,
          randomJitterMinutes: -5,
          randomEnabled: false,
          ranges: [
            { start: '09:00', end: '12:00' },
            { start: '09:00', end: '09:00' },
            { start: '25:00', end: '26:00' }
          ],
          lastFiredAt: 'bad'
        },
        { name: '', text: '' }
      ]
    })

    expect(data.seeded).toBe(true)
    expect(data.reminders).toHaveLength(1)
    const reminder = data.reminders[0]
    expect(reminder?.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(reminder?.enabled).toBe(false)
    expect(reminder?.intervalMinutes).toBe(1440)
    expect(reminder?.randomJitterMinutes).toBe(0)
    expect(reminder?.ranges).toEqual([{ start: '09:00', end: '12:00' }])
    expect(reminder?.lastFiredAt).toBeNull()
  })
})
