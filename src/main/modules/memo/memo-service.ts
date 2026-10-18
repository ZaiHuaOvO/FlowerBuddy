import { randomUUID } from 'node:crypto'
import type { MemoInput, MemoPatch, MemoSummary } from '../../../shared/api'
import { AppError } from '../../shared/errors'
import type { JsonStore } from '../../storage/json-store'
import { normalizeIsoTimestamp, sanitizeMemoBounds, sanitizeMemoImages } from './memo-data'
import {
  MEMO_COUNT_MAX,
  MEMO_TEXT_MAX,
  type MemoBounds,
  type MemoData,
  type StoredMemo
} from './types'

export interface MemoImageCleaner {
  remove(id: string): void
}

type ChangeListener = () => void

function sortMemos(a: StoredMemo, b: StoredMemo): number {
  if (a.completed !== b.completed) {
    return a.completed ? 1 : -1
  }
  if (a.completed && b.completed) {
    return (b.completedAt ?? '').localeCompare(a.completedAt ?? '')
  }
  if (a.reminderAt && b.reminderAt) {
    return a.reminderAt.localeCompare(b.reminderAt)
  }
  if (a.reminderAt) {
    return -1
  }
  if (b.reminderAt) {
    return 1
  }
  return b.createdAt.localeCompare(a.createdAt)
}

function toSummary(memo: StoredMemo): MemoSummary {
  return {
    id: memo.id,
    text: memo.text,
    images: memo.images,
    reminderAt: memo.reminderAt,
    completed: memo.completed,
    completedAt: memo.completedAt,
    anchored: memo.anchored,
    createdAt: memo.createdAt,
    updatedAt: memo.updatedAt
  }
}

export class MemoService {
  private readonly listeners = new Set<ChangeListener>()

  constructor(
    private readonly store: JsonStore<MemoData>,
    private readonly images: MemoImageCleaner,
    private readonly now: () => Date = () => new Date()
  ) {}

  list(): MemoSummary[] {
    return this.store.get().memos.slice().sort(sortMemos).map(toSummary)
  }

  get(id: string): StoredMemo | null {
    return this.store.get().memos.find((memo) => memo.id === id) ?? null
  }

  create(input: MemoInput): MemoSummary[] {
    const memos = this.store.get().memos
    if (memos.length >= MEMO_COUNT_MAX) {
      throw new AppError('INVALID_INPUT', `备忘录数量不能超过 ${MEMO_COUNT_MAX} 条`)
    }

    const text = normalizeText(input.text)
    const images = sanitizeMemoImages(input.images)
    if (text.trim().length === 0 && images.length === 0) {
      throw new AppError('INVALID_INPUT', '备忘录不能为空')
    }

    const now = this.now().toISOString()
    const memo: StoredMemo = {
      id: randomUUID(),
      text,
      images,
      reminderAt: normalizeReminder(input.reminderAt),
      remindedAt: null,
      completed: false,
      completedAt: null,
      anchored: false,
      bounds: null,
      createdAt: now,
      updatedAt: now
    }
    this.save([...memos, memo])
    return this.list()
  }

  update(id: string, patch: MemoPatch): MemoSummary[] {
    const memos = this.store.get().memos
    const index = memos.findIndex((memo) => memo.id === id)
    if (index === -1) {
      throw new AppError('NOT_FOUND', '未找到该备忘录')
    }

    const current = memos[index] as StoredMemo
    if (current.completed) {
      throw new AppError('INVALID_INPUT', '已完成的备忘录不能修改')
    }

    const next: StoredMemo = { ...current }
    if (patch.text !== undefined) {
      next.text = normalizeText(patch.text)
    }
    if (patch.images !== undefined) {
      next.images = sanitizeMemoImages(patch.images)
    }
    if (patch.reminderAt !== undefined) {
      const reminderAt = normalizeReminder(patch.reminderAt)
      if (reminderAt !== current.reminderAt) {
        next.remindedAt = null
      }
      next.reminderAt = reminderAt
    }
    if (next.text.trim().length === 0 && next.images.length === 0) {
      throw new AppError('INVALID_INPUT', '备忘录不能为空')
    }
    next.updatedAt = this.now().toISOString()

    const updated = [...memos]
    updated[index] = next
    this.save(updated)

    const kept = new Set(next.images.map((image) => image.id))
    for (const image of current.images) {
      if (!kept.has(image.id)) {
        this.images.remove(image.id)
      }
    }
    return this.list()
  }

  remove(id: string): MemoSummary[] {
    const memos = this.store.get().memos
    const target = memos.find((memo) => memo.id === id)
    if (!target) {
      throw new AppError('NOT_FOUND', '未找到该备忘录')
    }
    this.save(memos.filter((memo) => memo.id !== id))
    for (const image of target.images) {
      this.images.remove(image.id)
    }
    return this.list()
  }

  complete(id: string): MemoSummary[] {
    return this.setCompleted(id, true)
  }

  uncomplete(id: string): MemoSummary[] {
    return this.setCompleted(id, false)
  }

  private setCompleted(id: string, completed: boolean): MemoSummary[] {
    const memos = this.store.get().memos
    const index = memos.findIndex((memo) => memo.id === id)
    if (index === -1) {
      throw new AppError('NOT_FOUND', '未找到该备忘录')
    }
    const current = memos[index] as StoredMemo
    if (current.completed === completed) {
      return this.list()
    }
    const now = this.now().toISOString()
    const updated = [...memos]
    updated[index] = completed
      ? {
          ...current,
          completed: true,
          completedAt: now,
          anchored: false,
          updatedAt: now
        }
      : {
          ...current,
          completed: false,
          completedAt: null,
          updatedAt: now
        }
    this.save(updated)
    return this.list()
  }

  setAnchored(id: string, anchored: boolean): MemoSummary[] {
    const memos = this.store.get().memos
    const index = memos.findIndex((memo) => memo.id === id)
    if (index === -1) {
      throw new AppError('NOT_FOUND', '未找到该备忘录')
    }
    const current = memos[index] as StoredMemo
    if (current.completed && anchored) {
      throw new AppError('INVALID_INPUT', '已完成的备忘录不能锚定到桌面')
    }
    const updated = [...memos]
    updated[index] = { ...current, anchored }
    this.save(updated)
    return this.list()
  }

  updateBounds(id: string, bounds: MemoBounds): void {
    const memos = this.store.get().memos
    const index = memos.findIndex((memo) => memo.id === id)
    if (index === -1) {
      return
    }
    const current = memos[index] as StoredMemo
    const sanitized = sanitizeMemoBounds(bounds)
    if (!sanitized) {
      return
    }
    const updated = [...memos]
    updated[index] = { ...current, bounds: sanitized }
    this.save(updated)
  }

  markReminded(id: string, at: Date): void {
    const memos = this.store.get().memos
    const index = memos.findIndex((memo) => memo.id === id)
    if (index === -1) {
      return
    }
    const current = memos[index] as StoredMemo
    const updated = [...memos]
    updated[index] = { ...current, remindedAt: at.toISOString() }
    this.save(updated)
  }

  /** Reminders that are due and were not fired for the current reminderAt. */
  dueReminders(at: Date = this.now()): MemoSummary[] {
    const now = at.getTime()
    return this.list().filter((memo) => {
      if (memo.completed || !memo.reminderAt) {
        return false
      }
      const reminder = Date.parse(memo.reminderAt)
      if (!Number.isFinite(reminder) || reminder > now) {
        return false
      }
      const stored = this.get(memo.id)
      if (!stored || !stored.remindedAt) {
        return true
      }
      return Date.parse(stored.remindedAt) < reminder
    })
  }

  nextReminderAt(): number | null {
    const now = this.now().getTime()
    let next: number | null = null
    for (const memo of this.store.get().memos) {
      if (memo.completed || !memo.reminderAt) {
        continue
      }
      const reminder = Date.parse(memo.reminderAt)
      if (!Number.isFinite(reminder) || reminder <= now) {
        continue
      }
      if (memo.remindedAt && Date.parse(memo.remindedAt) >= reminder) {
        continue
      }
      next = next === null ? reminder : Math.min(next, reminder)
    }
    return next
  }

  referencedImageIds(): Set<string> {
    const ids = new Set<string>()
    for (const memo of this.store.get().memos) {
      for (const image of memo.images) {
        ids.add(image.id)
      }
    }
    return ids
  }

  onChange(listener: ChangeListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  flush(): void {
    this.store.flush()
  }

  private save(memos: StoredMemo[]): void {
    this.store.set({ schemaVersion: 1, memos })
    for (const listener of this.listeners) {
      listener()
    }
  }
}

function normalizeText(value: string): string {
  return value.slice(0, MEMO_TEXT_MAX)
}

function normalizeReminder(value: string | null): string | null {
  if (value === null) {
    return null
  }
  const normalized = normalizeIsoTimestamp(value)
  if (!normalized) {
    throw new AppError('INVALID_INPUT', '提醒时间不合法')
  }
  return normalized
}
