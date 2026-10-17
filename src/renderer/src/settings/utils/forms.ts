import type { DateCategory, DateRecurrence } from '../../../../shared/api'
import { todayIso } from './formatters'

export interface DateFormState {
  title: string
  date: string
  recurrence: DateRecurrence
  category: DateCategory
}

export interface WebsiteFormState {
  name: string
  url: string
  timeoutMs: number
  pollingIntervalMinutes: number | null
}

export function createDateForm(): DateFormState {
  return { title: '', date: todayIso(), recurrence: 'yearly', category: 'custom' }
}

export function createWebsiteForm(): WebsiteFormState {
  return { name: '', url: '', timeoutMs: 8000, pollingIntervalMinutes: null }
}
