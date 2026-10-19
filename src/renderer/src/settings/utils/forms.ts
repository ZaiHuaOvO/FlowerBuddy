import type { IntervalReminderSummary, ReminderRange } from '../../../../shared/api'
import {
  DEFAULT_REMINDER_INTERVAL_MINUTES,
  DEFAULT_REMINDER_JITTER_MINUTES
} from '../../../../shared/interval-reminder'

export interface WebsiteFormState {
  name: string
  url: string
  timeoutMs: number
  pollingIntervalMinutes: number | null
}

export interface ReminderFormState {
  name: string
  text: string
  intervalValue: number
  intervalUnit: 'minutes' | 'hours'
  ranges: ReminderRange[]
  randomEnabled: boolean
  randomJitterMinutes: number
}

export function createWebsiteForm(): WebsiteFormState {
  return { name: '', url: '', timeoutMs: 8000, pollingIntervalMinutes: null }
}

export function createReminderForm(reminder?: IntervalReminderSummary): ReminderFormState {
  if (!reminder) {
    return {
      name: '',
      text: '',
      intervalValue: DEFAULT_REMINDER_INTERVAL_MINUTES,
      intervalUnit: 'minutes',
      ranges: [],
      randomEnabled: true,
      randomJitterMinutes: DEFAULT_REMINDER_JITTER_MINUTES
    }
  }
  const useHours = reminder.intervalMinutes % 60 === 0 && reminder.intervalMinutes >= 60
  return {
    name: reminder.name,
    text: reminder.text,
    intervalValue: useHours ? reminder.intervalMinutes / 60 : reminder.intervalMinutes,
    intervalUnit: useHours ? 'hours' : 'minutes',
    ranges: reminder.ranges.map((range) => ({ ...range })),
    randomEnabled: reminder.randomEnabled,
    randomJitterMinutes: reminder.randomJitterMinutes
  }
}

export function formIntervalMinutes(form: ReminderFormState): number {
  const raw = form.intervalUnit === 'hours' ? form.intervalValue * 60 : form.intervalValue
  return Math.max(1, Math.min(1440, Math.round(raw)))
}
