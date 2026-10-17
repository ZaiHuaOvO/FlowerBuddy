export interface LocalDate {
  year: number
  month: number
  day: number
}

export interface DateRuleInput {
  date: string
  recurrence: 'none' | 'yearly'
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseIsoDate(value: string): LocalDate | null {
  const match = ISO_DATE_PATTERN.exec(value)
  if (!match) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1) {
    return null
  }
  if (day > daysInMonth(year, month)) {
    return null
  }
  return { year, month, day }
}

export function formatIsoDate(date: LocalDate): string {
  const month = String(date.month).padStart(2, '0')
  const day = String(date.day).padStart(2, '0')
  return `${date.year}-${month}-${day}`
}

export function localDateOf(date: Date): LocalDate {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate()
  }
}

/** UTC date-only arithmetic, so DST transitions never add or drop an hour. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  const fromUtc = Date.UTC(from.year, from.month - 1, from.day)
  const toUtc = Date.UTC(to.year, to.month - 1, to.day)
  return Math.round((toUtc - fromUtc) / 86400000)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Next occurrence on or after `today`. Yearly events keep their month/day;
 * February 29 falls back to February 28 in non-leap years (documented rule).
 */
export function nextOccurrence(
  start: LocalDate,
  recurrence: 'none' | 'yearly',
  today: LocalDate
): LocalDate | null {
  if (recurrence === 'none') {
    return daysBetween(today, start) >= 0 ? start : null
  }

  for (let year = today.year; year <= today.year + 1; year += 1) {
    const day = Math.min(start.day, daysInMonth(year, start.month))
    const candidate = { year, month: start.month, day }
    if (daysBetween(today, candidate) >= 0) {
      return candidate
    }
  }
  return null
}

export function daysUntil(
  event: DateRuleInput,
  today: LocalDate
): { daysUntil: number; occurrence: LocalDate } | null {
  const start = parseIsoDate(event.date)
  if (!start) {
    return null
  }
  const occurrence = nextOccurrence(start, event.recurrence, today)
  if (!occurrence) {
    return null
  }
  return { daysUntil: daysBetween(today, occurrence), occurrence }
}

export function formatCountdown(days: number | null): string {
  if (days === null) {
    return '已过去'
  }
  if (days === 0) {
    return '今天'
  }
  return `还有 ${days} 天`
}
