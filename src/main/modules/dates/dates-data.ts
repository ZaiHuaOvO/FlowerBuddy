import { randomUUID } from 'node:crypto'
import {
  createEmptyDatesData,
  DATE_CATEGORIES,
  DATE_RECURRENCES,
  type DatesData,
  type StoredDateEvent
} from './types'
import { parseIsoDate } from './dates-compute'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function sanitizeNotifyDays(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return []
  }
  const days = value
    .filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry))
    .map((entry) => Math.round(entry))
    .filter((entry) => entry >= 0 && entry <= 365)
  return [...new Set(days)].sort((a, b) => a - b).slice(0, 10)
}

function sanitizeStoredEvent(raw: unknown, usedIds: Set<string>): StoredDateEvent | null {
  if (!isRecord(raw)) {
    return null
  }

  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 80) : ''
  const date = typeof raw.date === 'string' && parseIsoDate(raw.date) ? raw.date : null
  const recurrence = DATE_RECURRENCES.find((entry) => entry === raw.recurrence)
  if (!title || !date || !recurrence) {
    return null
  }
  const category = DATE_CATEGORIES.find((entry) => entry === raw.category) ?? 'custom'

  let id = typeof raw.id === 'string' && UUID_PATTERN.test(raw.id) ? raw.id : randomUUID()
  while (usedIds.has(id)) {
    id = randomUUID()
  }
  usedIds.add(id)

  const now = new Date().toISOString()
  return {
    id,
    title,
    date,
    recurrence,
    category,
    notifyDaysBefore: sanitizeNotifyDays(raw.notifyDaysBefore),
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now
  }
}

export function sanitizeDatesData(raw: unknown): DatesData {
  if (!isRecord(raw) || !Array.isArray(raw.events)) {
    return createEmptyDatesData()
  }

  const usedIds = new Set<string>()
  const events: StoredDateEvent[] = []
  for (const entry of raw.events.slice(0, 2000)) {
    const event = sanitizeStoredEvent(entry, usedIds)
    if (event) {
      events.push(event)
    }
  }
  return { schemaVersion: 1, events }
}
