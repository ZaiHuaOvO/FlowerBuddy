import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { sanitizeMemoData } from '../../src/main/modules/memo/memo-data'
import { MemoService } from '../../src/main/modules/memo/memo-service'
import { createEmptyMemoData, type MemoData } from '../../src/main/modules/memo/types'
import { JsonStore } from '../../src/main/storage/json-store'

const IMAGE_A = '11111111-1111-4111-8111-111111111111'
const IMAGE_B = '22222222-2222-4222-8222-222222222222'

const temporaryDirectories: string[] = []

function createService(now: () => Date) {
  const directory = mkdtempSync(join(tmpdir(), 'flowerbuddy-memo-'))
  temporaryDirectories.push(directory)
  const removed: string[] = []
  const store = new JsonStore<MemoData>(join(directory, 'memos.json'), {
    label: 'memos',
    defaults: createEmptyMemoData,
    sanitize: sanitizeMemoData
  })
  store.load()
  const service = new MemoService(store, { remove: (id) => removed.push(id) }, now)
  return { service, removed, store }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function idOf(memos: Array<{ id: string; text: string }>, text: string): string {
  const memo = memos.find((entry) => entry.text === text)
  if (!memo) {
    throw new Error(`memo not found: ${text}`)
  }
  return memo.id
}

describe('memo service', () => {
  it('sorts reminders first, then new notes, then completed notes', () => {
    let current = new Date(2026, 9, 18, 9, 0, 0)
    const { service } = createService(() => current)

    service.create({ text: 'older', images: [], reminderAt: null })
    current = new Date(2026, 9, 18, 10, 0, 0)
    const withReminder = service.create({
      text: 'reminder',
      images: [],
      reminderAt: new Date(2026, 9, 20, 9, 0, 0).toISOString()
    })
    const reminderId = idOf(withReminder, 'reminder')
    current = new Date(2026, 9, 18, 11, 0, 0)
    const newerId = idOf(service.create({ text: 'newer', images: [], reminderAt: null }), 'newer')

    expect(service.list().map((memo) => memo.text)).toEqual(['reminder', 'newer', 'older'])

    current = new Date(2026, 9, 18, 12, 0, 0)
    service.complete(newerId)
    current = new Date(2026, 9, 18, 13, 0, 0)
    service.complete(reminderId)

    expect(service.list().map((memo) => memo.text)).toEqual(['older', 'reminder', 'newer'])
    expect(service.list()[1]?.completed).toBe(true)
    expect(service.list()[1]?.anchored).toBe(false)
  })

  it('rejects empty notes and caps text', () => {
    const { service } = createService(() => new Date(2026, 9, 18, 9, 0, 0))
    expect(() => service.create({ text: '   ', images: [], reminderAt: null })).toThrow()
    const long = 'x'.repeat(25000)
    const created = service.create({ text: long, images: [], reminderAt: null })
    expect(created[0]?.text.length).toBe(20000)
  })

  it('limits simultaneously anchored memos to 20', () => {
    const { service } = createService(() => new Date(2026, 9, 18, 9, 0, 0))
    const anchoredIds: string[] = []
    for (let index = 0; index < 20; index += 1) {
      const text = `memo ${index}`
      const id = idOf(service.create({ text, images: [], reminderAt: null }), text)
      service.setAnchored(id, true)
      anchoredIds.push(id)
    }

    const extraId = idOf(service.create({ text: 'extra', images: [], reminderAt: null }), 'extra')
    expect(() => service.setAnchored(extraId, true)).toThrow('不能超过 20 张')
    expect(service.list().filter((memo) => memo.anchored)).toHaveLength(20)

    // Re-applying the anchor state to an already anchored memo stays valid.
    service.setAnchored(anchoredIds[0] as string, true)
  })

  it('drops excess anchored state from legacy data on load', () => {
    const memos = Array.from({ length: 21 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      text: `memo ${index}`,
      images: [],
      reminderAt: null,
      remindedAt: null,
      completed: false,
      completedAt: null,
      anchored: true,
      bounds: null,
      createdAt: '2026-10-18T00:00:00.000Z',
      updatedAt: '2026-10-18T00:00:00.000Z'
    }))

    const data = sanitizeMemoData({ schemaVersion: 1, memos })
    expect(data.memos.filter((memo) => memo.anchored)).toHaveLength(20)
    expect(data.memos[20]?.anchored).toBe(false)
  })

  it('deletes images with the memo and when removed from an update', () => {
    const { service, removed } = createService(() => new Date(2026, 9, 18, 9, 0, 0))
    const created = service.create({
      text: 'with image',
      images: [{ id: IMAGE_A, width: 100, height: 80 }],
      reminderAt: null
    })
    const id = created[0]?.id as string

    service.update(id, {
      images: [{ id: IMAGE_B, width: 50, height: 40 }]
    })
    expect(removed).toEqual([IMAGE_A])

    service.remove(id)
    expect(removed).toEqual([IMAGE_A, IMAGE_B])
    expect(service.list()).toEqual([])
  })

  it('tracks due reminders once and rearms after an edit', () => {
    let current = new Date(2026, 9, 18, 9, 0, 0)
    const { service } = createService(() => current)
    const created = service.create({
      text: 'remind me',
      images: [],
      reminderAt: new Date(2026, 9, 18, 9, 5, 0).toISOString()
    })
    const id = created[0]?.id as string

    expect(service.dueReminders(current)).toEqual([])

    current = new Date(2026, 9, 18, 9, 6, 0)
    expect(service.dueReminders(current).map((memo) => memo.id)).toEqual([id])
    service.markReminded(id, current)
    expect(service.dueReminders(current)).toEqual([])

    service.update(id, {
      reminderAt: new Date(2026, 9, 18, 9, 7, 0).toISOString()
    })
    current = new Date(2026, 9, 18, 9, 8, 0)
    expect(service.dueReminders(current).map((memo) => memo.id)).toEqual([id])

    service.complete(id)
    expect(service.dueReminders(current)).toEqual([])
  })

  it('allows reopening a completed memo', () => {
    const { service } = createService(() => new Date(2026, 9, 18, 9, 0, 0))
    const id = service.create({ text: 'toggle', images: [], reminderAt: null })[0]?.id as string

    service.complete(id)
    expect(service.get(id)?.completed).toBe(true)
    expect(service.get(id)?.completedAt).not.toBeNull()

    const reopened = service.uncomplete(id)
    expect(reopened[0]?.completed).toBe(false)
    expect(reopened[0]?.completedAt).toBeNull()
    expect(service.get(id)?.completed).toBe(false)

    // Completing an already active memo is a no-op.
    const again = service.uncomplete(id)
    expect(again[0]?.completed).toBe(false)
  })

  it('anchors only active notes and keeps bounds', () => {
    const { service } = createService(() => new Date(2026, 9, 18, 9, 0, 0))
    const id = service.create({ text: 'pin me', images: [], reminderAt: null })[0]?.id as string
    const updatedAt = service.get(id)?.updatedAt

    expect(service.setAnchored(id, true)[0]?.anchored).toBe(true)
    service.updateBounds(id, { x: 10, y: 20, width: 300, height: 220 })
    expect(service.get(id)?.bounds).toEqual({ x: 10, y: 20, width: 300, height: 220 })
    expect(service.get(id)?.updatedAt).toBe(updatedAt)

    service.complete(id)
    expect(service.get(id)?.anchored).toBe(false)
    expect(() => service.setAnchored(id, true)).toThrow()
  })

  it('sanitizes stored data and drops invalid entries', () => {
    const data = sanitizeMemoData({
      memos: [
        {
          id: 'not-a-uuid',
          text: 'valid',
          images: [
            { id: IMAGE_A, width: 10, height: 10 },
            { id: IMAGE_A, width: 10, height: 10 },
            { id: 'bad', width: 1, height: 1 }
          ],
          reminderAt: 'not-a-date',
          completed: true,
          anchored: true,
          bounds: { x: 1, y: 2, width: 10, height: 10 }
        },
        { text: '   ', images: [] },
        { text: 'second', completed: false }
      ]
    })

    expect(data.memos).toHaveLength(2)
    const first = data.memos[0]
    expect(first?.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(first?.images).toHaveLength(1)
    expect(first?.reminderAt).toBeNull()
    expect(first?.completed).toBe(true)
    expect(first?.anchored).toBe(false)
    expect(first?.bounds).toEqual({ x: 1, y: 2, width: 180, height: 120 })
    expect(data.memos[1]?.text).toBe('second')
  })
})
