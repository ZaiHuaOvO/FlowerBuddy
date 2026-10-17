import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { sanitizeDatesData } from '../../src/main/modules/dates/dates-data'
import { DatesService } from '../../src/main/modules/dates/dates-service'
import { createEmptyDatesData, type DatesData } from '../../src/main/modules/dates/types'
import { AppError } from '../../src/main/shared/errors'
import { JsonStore } from '../../src/main/storage/json-store'

const temporaryDirectories: string[] = []
const stores: Array<JsonStore<DatesData>> = []

function createService(now: Date = new Date(2026, 9, 17, 12, 0, 0)) {
  const directory = mkdtempSync(join(tmpdir(), 'flowerbuddy-dates-'))
  temporaryDirectories.push(directory)
  const store = new JsonStore<DatesData>(join(directory, 'dates.json'), {
    label: 'dates',
    defaults: createEmptyDatesData,
    sanitize: sanitizeDatesData,
    saveDelayMs: 5000
  })
  store.load()
  stores.push(store)
  return { service: new DatesService(store, () => now), store }
}

afterEach(() => {
  for (const store of stores.splice(0)) {
    store.flush()
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('dates service', () => {
  it('creates events and computes countdowns', () => {
    const { service } = createService()

    const events = service.create({
      title: '结婚纪念日',
      date: '2026-10-17',
      recurrence: 'yearly',
      category: 'anniversary'
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      title: '结婚纪念日',
      date: '2026-10-17',
      daysUntil: 0,
      occurrence: '2026-10-17',
      upcoming: true,
      enabled: true
    })
  })

  it('sorts upcoming events first, then past events', () => {
    const { service } = createService()
    service.create({
      title: '后天',
      date: '2026-10-19',
      recurrence: 'none',
      category: 'custom'
    })
    service.create({
      title: '今天',
      date: '2026-10-17',
      recurrence: 'none',
      category: 'custom'
    })
    service.create({
      title: '已过去',
      date: '2020-01-01',
      recurrence: 'none',
      category: 'custom'
    })

    const list = service.list()
    expect(list.map((event) => event.title)).toEqual(['今天', '后天', '已过去'])
    expect(service.upcoming(3).map((event) => event.title)).toEqual(['今天', '后天'])
  })

  it('updates fields and excludes disabled events from upcoming', () => {
    const { service } = createService()
    const created = service.create({
      title: '生日',
      date: '2026-10-20',
      recurrence: 'yearly',
      category: 'birthday'
    })
    const id = created[0]?.id as string

    const updated = service.update(id, { title: '妈妈生日', enabled: false })
    expect(updated[0]?.title).toBe('妈妈生日')
    expect(updated[0]?.enabled).toBe(false)
    expect(service.upcoming(3)).toHaveLength(0)

    service.setEnabled(id, true)
    expect(service.upcoming(3)).toHaveLength(1)
  })

  it('removes events and reports missing ids', () => {
    const { service } = createService()
    const created = service.create({
      title: '一次性',
      date: '2026-10-17',
      recurrence: 'none',
      category: 'custom'
    })
    const id = created[0]?.id as string

    expect(service.remove(id)).toHaveLength(0)
    expect(() => service.remove(id)).toThrow(AppError)
    expect(() => service.update(id, { title: 'x' })).toThrow(AppError)
  })

  it('rejects invalid input', () => {
    const { service } = createService()
    expect(() =>
      service.create({
        title: '   ',
        date: '2026-10-17',
        recurrence: 'none',
        category: 'custom'
      })
    ).toThrow(AppError)
    expect(() =>
      service.create({
        title: '无效日期',
        date: '2026-02-30',
        recurrence: 'none',
        category: 'custom'
      })
    ).toThrow(AppError)
  })

  it('repairs stored data and drops invalid events', () => {
    const data = sanitizeDatesData({
      schemaVersion: 1,
      events: [
        {
          id: 'not-a-uuid',
          title: '  保留  ',
          date: '2026-12-25',
          recurrence: 'yearly',
          category: 'nope',
          notifyDaysBefore: [7, 7, -1, 999, 1],
          enabled: 'yes'
        },
        { title: '坏日期', date: '2026-02-30', recurrence: 'none' },
        'garbage'
      ]
    })

    expect(data.events).toHaveLength(1)
    expect(data.events[0]).toMatchObject({
      title: '保留',
      category: 'custom',
      notifyDaysBefore: [1, 7],
      enabled: true
    })
    expect(data.events[0]?.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('computes yearly events across a year boundary', () => {
    const { service } = createService(new Date(2026, 11, 31, 12, 0, 0))
    service.create({
      title: '元旦',
      date: '2019-01-01',
      recurrence: 'yearly',
      category: 'custom'
    })
    const [event] = service.list()
    expect(event?.occurrence).toBe('2027-01-01')
    expect(event?.daysUntil).toBe(1)
  })
})
