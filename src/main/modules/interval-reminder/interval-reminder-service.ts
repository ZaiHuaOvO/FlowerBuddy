import { randomUUID } from 'node:crypto'
import type {
  IntervalReminderInput,
  IntervalReminderPatch,
  IntervalReminderSummary,
  ReminderRange
} from '../../../shared/api'
import { AppError } from '../../shared/errors'
import type { JsonStore } from '../../storage/json-store'
import { sanitizeRanges } from './reminder-data'
import {
  createDefaultIntervalReminder,
  REMINDER_COUNT_MAX,
  REMINDER_INTERVAL_MAX,
  REMINDER_INTERVAL_MIN,
  REMINDER_JITTER_MAX,
  REMINDER_NAME_MAX,
  REMINDER_RANGES_MAX,
  REMINDER_TEXT_MAX,
  type IntervalReminderData,
  type StoredIntervalReminder
} from './types'

type ChangeListener = () => void

function toSummary(reminder: StoredIntervalReminder): IntervalReminderSummary {
  return {
    id: reminder.id,
    name: reminder.name,
    text: reminder.text,
    enabled: reminder.enabled,
    intervalMinutes: reminder.intervalMinutes,
    ranges: reminder.ranges,
    randomEnabled: reminder.randomEnabled,
    randomJitterMinutes: reminder.randomJitterMinutes,
    lastFiredAt: reminder.lastFiredAt,
    createdAt: reminder.createdAt,
    updatedAt: reminder.updatedAt
  }
}

export class IntervalReminderService {
  private readonly listeners = new Set<ChangeListener>()

  constructor(
    private readonly store: JsonStore<IntervalReminderData>,
    private readonly now: () => Date = () => new Date()
  ) {
    this.ensureSeeded()
  }

  list(): IntervalReminderSummary[] {
    return this.store.get().reminders.map(toSummary)
  }

  create(input: IntervalReminderInput): IntervalReminderSummary[] {
    const reminders = this.store.get().reminders
    if (reminders.length >= REMINDER_COUNT_MAX) {
      throw new AppError('INVALID_INPUT', `提醒数量不能超过 ${REMINDER_COUNT_MAX} 条`)
    }
    const now = this.now().toISOString()
    const reminder: StoredIntervalReminder = {
      id: randomUUID(),
      name: normalizeName(input.name),
      text: normalizeText(input.text),
      enabled: input.enabled ?? true,
      intervalMinutes: normalizeInterval(input.intervalMinutes),
      ranges: normalizeRanges(input.ranges),
      randomEnabled: input.randomEnabled,
      randomJitterMinutes: normalizeJitter(input.randomJitterMinutes),
      lastFiredAt: null,
      createdAt: now,
      updatedAt: now
    }
    this.save([...reminders, reminder])
    return this.list()
  }

  update(id: string, patch: IntervalReminderPatch): IntervalReminderSummary[] {
    const reminders = this.store.get().reminders
    const index = reminders.findIndex((reminder) => reminder.id === id)
    if (index === -1) {
      throw new AppError('NOT_FOUND', '未找到该定时提醒')
    }
    const current = reminders[index] as StoredIntervalReminder
    const next: StoredIntervalReminder = { ...current }
    if (patch.name !== undefined) {
      next.name = normalizeName(patch.name)
    }
    if (patch.text !== undefined) {
      next.text = normalizeText(patch.text)
    }
    if (patch.enabled !== undefined) {
      next.enabled = patch.enabled
    }
    if (patch.intervalMinutes !== undefined) {
      next.intervalMinutes = normalizeInterval(patch.intervalMinutes)
    }
    if (patch.ranges !== undefined) {
      next.ranges = normalizeRanges(patch.ranges)
    }
    if (patch.randomEnabled !== undefined) {
      next.randomEnabled = patch.randomEnabled
    }
    if (patch.randomJitterMinutes !== undefined) {
      next.randomJitterMinutes = normalizeJitter(patch.randomJitterMinutes)
    }
    next.updatedAt = this.now().toISOString()

    const updated = [...reminders]
    updated[index] = next
    this.save(updated)
    return this.list()
  }

  remove(id: string): IntervalReminderSummary[] {
    const reminders = this.store.get().reminders
    const next = reminders.filter((reminder) => reminder.id !== id)
    if (next.length === reminders.length) {
      throw new AppError('NOT_FOUND', '未找到该定时提醒')
    }
    this.save(next)
    return this.list()
  }

  setEnabled(id: string, enabled: boolean): IntervalReminderSummary[] {
    return this.update(id, { enabled })
  }

  markFired(id: string, at: Date): void {
    const reminders = this.store.get().reminders
    const index = reminders.findIndex((reminder) => reminder.id === id)
    if (index === -1) {
      return
    }
    const updated = [...reminders]
    updated[index] = {
      ...(reminders[index] as StoredIntervalReminder),
      lastFiredAt: at.toISOString()
    }
    this.save(updated)
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

  private ensureSeeded(): void {
    const data = this.store.get()
    if (data.seeded) {
      return
    }
    this.save([createDefaultIntervalReminder(this.now())], true)
  }

  private save(reminders: StoredIntervalReminder[], seeded = true): void {
    this.store.set({ schemaVersion: 1, seeded, reminders })
    for (const listener of this.listeners) {
      listener()
    }
  }
}

function normalizeName(value: string): string {
  const name = value.trim().slice(0, REMINDER_NAME_MAX)
  if (!name) {
    throw new AppError('INVALID_INPUT', '提醒名称不能为空')
  }
  return name
}

function normalizeText(value: string): string {
  const text = value.trim().slice(0, REMINDER_TEXT_MAX)
  if (!text) {
    throw new AppError('INVALID_INPUT', '提醒文本不能为空')
  }
  return text
}

function normalizeInterval(value: number): number {
  if (!Number.isFinite(value) || value < REMINDER_INTERVAL_MIN || value > REMINDER_INTERVAL_MAX) {
    throw new AppError('INVALID_INPUT', '提醒间隔不合法')
  }
  return Math.round(value)
}

function normalizeJitter(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > REMINDER_JITTER_MAX) {
    throw new AppError('INVALID_INPUT', '随机值不合法')
  }
  return Math.round(value)
}

function normalizeRanges(ranges: ReminderRange[]): ReminderRange[] {
  if (!Array.isArray(ranges) || ranges.length > REMINDER_RANGES_MAX) {
    throw new AppError('INVALID_INPUT', '生效时间段不合法')
  }
  for (const range of ranges) {
    if (
      typeof range?.start !== 'string' ||
      typeof range?.end !== 'string' ||
      !/^([01]?\d|2[0-3]):([0-5]\d)$/.test(range.start) ||
      !/^([01]?\d|2[0-3]):([0-5]\d)$/.test(range.end) ||
      range.start === range.end
    ) {
      throw new AppError('INVALID_INPUT', '生效时间段不合法')
    }
  }
  return sanitizeRanges(ranges)
}
