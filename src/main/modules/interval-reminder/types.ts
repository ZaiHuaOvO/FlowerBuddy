import { randomUUID } from 'node:crypto'
import type { ReminderRange } from '../../../shared/api'
import {
  DEFAULT_REMINDER_INTERVAL_MINUTES,
  DEFAULT_REMINDER_JITTER_MINUTES,
  defaultReminderRanges
} from '../../../shared/interval-reminder'

export { defaultReminderRanges }

export interface StoredIntervalReminder {
  id: string
  name: string
  text: string
  enabled: boolean
  intervalMinutes: number
  ranges: ReminderRange[]
  randomEnabled: boolean
  randomJitterMinutes: number
  lastFiredAt: string | null
  createdAt: string
  updatedAt: string
}

export interface IntervalReminderData {
  schemaVersion: 1
  seeded: boolean
  reminders: StoredIntervalReminder[]
}

export const REMINDER_NAME_MAX = 40
export const REMINDER_TEXT_MAX = 500
export const REMINDER_INTERVAL_MIN = 1
export const REMINDER_INTERVAL_MAX = 1440
export const REMINDER_JITTER_MAX = 120
export const REMINDER_RANGES_MAX = 6
export const REMINDER_COUNT_MAX = 100

export function createEmptyIntervalReminderData(): IntervalReminderData {
  return { schemaVersion: 1, seeded: false, reminders: [] }
}

export function createDefaultIntervalReminder(now: Date): StoredIntervalReminder {
  const timestamp = now.toISOString()
  return {
    id: randomUUID(),
    name: '喝水',
    text: '该喝水啦！',
    enabled: false,
    intervalMinutes: DEFAULT_REMINDER_INTERVAL_MINUTES,
    ranges: defaultReminderRanges(),
    randomEnabled: true,
    randomJitterMinutes: DEFAULT_REMINDER_JITTER_MINUTES,
    lastFiredAt: null,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}
