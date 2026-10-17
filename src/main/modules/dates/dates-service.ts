import { randomUUID } from 'node:crypto'
import type { DateEventInput, DateEventPatch, DateEventSummary } from '../../../shared/api'
import { AppError } from '../../shared/errors'
import type { JsonStore } from '../../storage/json-store'
import { daysUntil, formatIsoDate, localDateOf, parseIsoDate } from './dates-compute'
import { sanitizeNotifyDays } from './dates-data'
import type { DatesData, StoredDateEvent } from './types'

function clampTitle(value: string): string {
  return value.trim().slice(0, 80)
}

function sortSummaries(a: DateEventSummary, b: DateEventSummary): number {
  const rank = (summary: DateEventSummary): number =>
    summary.upcoming ? (summary.enabled ? 0 : 1) : 2
  const rankDiff = rank(a) - rank(b)
  if (rankDiff !== 0) {
    return rankDiff
  }
  if (a.upcoming && b.upcoming) {
    return (a.daysUntil ?? 0) - (b.daysUntil ?? 0)
  }
  if (!a.upcoming && !b.upcoming) {
    return b.date.localeCompare(a.date)
  }
  return a.title.localeCompare(b.title, 'zh-CN')
}

export class DatesService {
  constructor(
    private readonly store: JsonStore<DatesData>,
    private readonly now: () => Date = () => new Date()
  ) {}

  list(): DateEventSummary[] {
    const today = localDateOf(this.now())
    return this.store
      .get()
      .events.map((event) => this.toSummary(event, today))
      .sort(sortSummaries)
  }

  upcoming(limit = 3): DateEventSummary[] {
    const today = localDateOf(this.now())
    return this.store
      .get()
      .events.filter((event) => event.enabled)
      .map((event) => this.toSummary(event, today))
      .filter((summary) => summary.upcoming)
      .sort(sortSummaries)
      .slice(0, Math.max(1, limit))
  }

  create(input: DateEventInput): DateEventSummary[] {
    const title = clampTitle(input.title)
    if (!title || !parseIsoDate(input.date)) {
      throw new AppError('INVALID_INPUT', '事件名称或日期不合法')
    }

    const now = this.now().toISOString()
    const event: StoredDateEvent = {
      id: randomUUID(),
      title,
      date: input.date,
      recurrence: input.recurrence,
      category: input.category,
      notifyDaysBefore: sanitizeNotifyDays(input.notifyDaysBefore),
      enabled: true,
      createdAt: now,
      updatedAt: now
    }
    this.store.set({
      schemaVersion: 1,
      events: [...this.store.get().events, event]
    })
    return this.list()
  }

  update(id: string, patch: DateEventPatch): DateEventSummary[] {
    const events = this.store.get().events
    const index = events.findIndex((event) => event.id === id)
    if (index === -1) {
      throw new AppError('NOT_FOUND', '未找到该日期事件')
    }

    const current = events[index] as StoredDateEvent
    const next: StoredDateEvent = { ...current }

    if (patch.title !== undefined) {
      const title = clampTitle(patch.title)
      if (!title) {
        throw new AppError('INVALID_INPUT', '事件名称不能为空')
      }
      next.title = title
    }
    if (patch.date !== undefined) {
      if (!parseIsoDate(patch.date)) {
        throw new AppError('INVALID_INPUT', '日期格式不合法')
      }
      next.date = patch.date
    }
    if (patch.recurrence !== undefined) {
      next.recurrence = patch.recurrence
    }
    if (patch.category !== undefined) {
      next.category = patch.category
    }
    if (patch.notifyDaysBefore !== undefined) {
      next.notifyDaysBefore = sanitizeNotifyDays(patch.notifyDaysBefore)
    }
    if (patch.enabled !== undefined) {
      next.enabled = patch.enabled
    }
    next.updatedAt = this.now().toISOString()

    const updated = [...events]
    updated[index] = next
    this.store.set({ schemaVersion: 1, events: updated })
    return this.list()
  }

  remove(id: string): DateEventSummary[] {
    const events = this.store.get().events
    const next = events.filter((event) => event.id !== id)
    if (next.length === events.length) {
      throw new AppError('NOT_FOUND', '未找到该日期事件')
    }
    this.store.set({ schemaVersion: 1, events: next })
    return this.list()
  }

  setEnabled(id: string, enabled: boolean): DateEventSummary[] {
    return this.update(id, { enabled })
  }

  flush(): void {
    this.store.flush()
  }

  private toSummary(
    event: StoredDateEvent,
    today: ReturnType<typeof localDateOf>
  ): DateEventSummary {
    const computed = daysUntil({ date: event.date, recurrence: event.recurrence }, today)
    return {
      ...event,
      daysUntil: computed ? computed.daysUntil : null,
      occurrence: computed ? formatIsoDate(computed.occurrence) : null,
      upcoming: computed !== null && computed.daysUntil >= 0
    }
  }
}
