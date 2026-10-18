import { randomUUID } from 'node:crypto'
import type { ReminderRange } from '../../../shared/api'
import {
  createEmptyIntervalReminderData,
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function normalizeIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value)
}

export function sanitizeRanges(raw: unknown): ReminderRange[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const ranges: ReminderRange[] = []
  for (const entry of raw.slice(0, REMINDER_RANGES_MAX)) {
    if (!isRecord(entry)) {
      continue
    }
    const start = typeof entry.start === 'string' ? entry.start : ''
    const end = typeof entry.end === 'string' ? entry.end : ''
    if (!isValidTime(start) || !isValidTime(end) || start === end) {
      continue
    }
    ranges.push({ start, end })
  }
  return ranges
}

function sanitizeStoredReminder(raw: unknown, usedIds: Set<string>): StoredIntervalReminder | null {
  if (!isRecord(raw)) {
    return null
  }
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, REMINDER_NAME_MAX) : ''
  const text = typeof raw.text === 'string' ? raw.text.trim().slice(0, REMINDER_TEXT_MAX) : ''
  if (!name || !text) {
    return null
  }

  let id = typeof raw.id === 'string' && UUID_PATTERN.test(raw.id) ? raw.id : randomUUID()
  while (usedIds.has(id)) {
    id = randomUUID()
  }
  usedIds.add(id)

  const now = new Date().toISOString()
  const createdAt = normalizeIsoTimestamp(raw.createdAt) ?? now
  const interval = Number(raw.intervalMinutes)
  const jitter = Number(raw.randomJitterMinutes)

  return {
    id,
    name,
    text,
    enabled: raw.enabled === true,
    intervalMinutes: Number.isFinite(interval)
      ? Math.round(clamp(interval, REMINDER_INTERVAL_MIN, REMINDER_INTERVAL_MAX))
      : 30,
    ranges: sanitizeRanges(raw.ranges),
    randomEnabled: raw.randomEnabled !== false,
    randomJitterMinutes: Number.isFinite(jitter)
      ? Math.round(clamp(jitter, 0, REMINDER_JITTER_MAX))
      : 5,
    lastFiredAt: normalizeIsoTimestamp(raw.lastFiredAt),
    createdAt,
    updatedAt: normalizeIsoTimestamp(raw.updatedAt) ?? createdAt
  }
}

export function sanitizeIntervalReminderData(raw: unknown): IntervalReminderData {
  if (!isRecord(raw) || !Array.isArray(raw.reminders)) {
    return createEmptyIntervalReminderData()
  }
  const usedIds = new Set<string>()
  const reminders: StoredIntervalReminder[] = []
  for (const entry of raw.reminders.slice(0, REMINDER_COUNT_MAX)) {
    const reminder = sanitizeStoredReminder(entry, usedIds)
    if (reminder) {
      reminders.push(reminder)
    }
  }
  return {
    schemaVersion: 1,
    seeded: raw.seeded === true || (Array.isArray(raw.reminders) && raw.reminders.length > 0),
    reminders
  }
}
