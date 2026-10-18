import type { ReminderRange } from '../../../shared/api'

export interface ReminderScheduleConfig {
  intervalMinutes: number
  ranges: ReminderRange[]
  randomEnabled: boolean
  randomJitterMinutes: number
}

const MINUTE_MS = 60 * 1000
const MIN_DELAY_MS = MINUTE_MS

function parseTimeToMinutes(value: string): number | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!match) {
    return null
  }
  return Number(match[1]) * 60 + Number(match[2])
}

function validRanges(ranges: ReminderRange[]): ReminderRange[] {
  return ranges.filter(
    (range) => parseTimeToMinutes(range.start) !== null && parseTimeToMinutes(range.end) !== null
  )
}

/** True when the moment falls inside any effective range; no ranges means always. */
export function isWithinRanges(date: Date, ranges: ReminderRange[]): boolean {
  const valid = validRanges(ranges)
  if (valid.length === 0) {
    return true
  }
  const minutes = date.getHours() * 60 + date.getMinutes()
  for (const range of valid) {
    const start = parseTimeToMinutes(range.start) as number
    const end = parseTimeToMinutes(range.end) as number
    if (start === end) {
      return true
    }
    if (start < end) {
      if (minutes >= start && minutes < end) {
        return true
      }
    } else if (minutes >= start || minutes < end) {
      return true
    }
  }
  return false
}

/** Moves a timestamp forward to the next range start when it is outside all ranges. */
export function deferToActive(timestampMs: number, ranges: ReminderRange[]): number {
  if (validRanges(ranges).length === 0) {
    return timestampMs
  }
  if (isWithinRanges(new Date(timestampMs), ranges)) {
    return timestampMs
  }

  const base = new Date(timestampMs)
  let next: number | null = null
  for (const range of validRanges(ranges)) {
    const startMinutes = parseTimeToMinutes(range.start) as number
    const candidate = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      Math.floor(startMinutes / 60),
      startMinutes % 60,
      0,
      0
    )
    if (candidate.getTime() < timestampMs) {
      candidate.setDate(candidate.getDate() + 1)
    }
    if (next === null || candidate.getTime() < next) {
      next = candidate.getTime()
    }
  }
  return next ?? timestampMs
}

export function computeNextDue(
  fromMs: number,
  config: ReminderScheduleConfig,
  random: () => number = Math.random
): number {
  const intervalMs = Math.max(1, config.intervalMinutes) * MINUTE_MS
  const jitterMs =
    config.randomEnabled && config.randomJitterMinutes > 0
      ? config.randomJitterMinutes * MINUTE_MS
      : 0
  const delta = jitterMs > 0 ? (random() * 2 - 1) * jitterMs : 0
  const delay = Math.max(MIN_DELAY_MS, intervalMs + delta)
  return deferToActive(fromMs + delay, config.ranges)
}

export { parseTimeToMinutes }
