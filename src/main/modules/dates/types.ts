import type { DateCategory, DateRecurrence } from '../../../shared/api'

export interface StoredDateEvent {
  id: string
  title: string
  date: string
  recurrence: DateRecurrence
  category: DateCategory
  notifyDaysBefore: number[]
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface DatesData {
  schemaVersion: 1
  events: StoredDateEvent[]
}

export const DATE_RECURRENCES: DateRecurrence[] = ['none', 'yearly']
export const DATE_CATEGORIES: DateCategory[] = ['birthday', 'anniversary', 'overtime', 'custom']

export const DATE_CATEGORY_LABELS: Record<DateCategory, string> = {
  birthday: '生日',
  anniversary: '纪念日',
  overtime: '加班',
  custom: '自定义'
}

export function createEmptyDatesData(): DatesData {
  return { schemaVersion: 1, events: [] }
}
