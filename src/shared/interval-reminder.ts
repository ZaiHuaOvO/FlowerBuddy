import type { ReminderRange } from './api'

export const DEFAULT_REMINDER_INTERVAL_MINUTES = 30
export const DEFAULT_REMINDER_JITTER_MINUTES = 5

export function defaultReminderRanges(): ReminderRange[] {
  return [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '18:00' }
  ]
}
