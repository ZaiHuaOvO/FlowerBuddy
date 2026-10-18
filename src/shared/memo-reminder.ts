/**
 * Best-effort natural-language reminder parsing for Chinese memo input.
 * Parsing happens locally; the resulting timestamp is what gets persisted.
 */

export interface ReminderParseResult {
  at: Date
  /** Local `YYYY-MM-DD HH:mm:ss` representation of the parsed time. */
  text: string
}

const CN_DIGITS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9
}

const WEEKDAY_INDEX: Record<string, number> = {
  一: 0,
  二: 1,
  三: 2,
  四: 3,
  五: 4,
  六: 5,
  日: 6,
  天: 6,
  '1': 0,
  '2': 1,
  '3': 2,
  '4': 3,
  '5': 4,
  '6': 5,
  '7': 6
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

export function formatReminderDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Accepts local `YYYY-MM-DD HH:mm[:ss]` as well as ISO timestamps with a zone. */
export function parseReminderDateTime(value: string): Date | null {
  const trimmed = value.trim()
  const local = /^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed)
  if (local) {
    const date = buildLocalDate(
      Number(local[1]),
      Number(local[2]) - 1,
      Number(local[3]),
      Number(local[4]),
      Number(local[5]),
      Number(local[6] ?? 0)
    )
    return date
  }
  // Only let Date.parse handle full ISO timestamps. It also accepts partial
  // dates such as "10-20 15:30" and would invent the year 2001.
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{1,2}:\d{2}/.test(trimmed)) {
    return null
  }
  const parsed = Date.parse(trimmed)
  if (!Number.isFinite(parsed)) {
    return null
  }
  // Date.parse normalizes impossible dates (2026-02-30 -> 2026-03-02).
  const isoDate = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T ])/.exec(trimmed)
  if (isoDate) {
    const valid = buildLocalDate(
      Number(isoDate[1]),
      Number(isoDate[2]) - 1,
      Number(isoDate[3]),
      0,
      0,
      0
    )
    if (!valid) {
      return null
    }
  }
  return new Date(parsed)
}

export function parseReminderInput(
  input: string,
  now: Date = new Date()
): ReminderParseResult | null {
  const trimmed = input.trim()
  const direct = parseReminderDateTime(trimmed)
  if (direct) {
    return { at: direct, text: formatReminderDateTime(direct) }
  }

  const normalized = normalizeInput(trimmed)
  if (!normalized) {
    return null
  }

  const relative = parseRelative(normalized, now)
  if (relative) {
    return { at: relative, text: formatReminderDateTime(relative) }
  }

  const time = parseTime(normalized)
  const dateParts = parseDateParts(normalized, now)

  if (!time && !dateParts) {
    return null
  }

  if (!dateParts) {
    // Time only: today when still ahead, otherwise tomorrow.
    const at = buildLocalDate(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      time?.hours ?? 9,
      time?.minutes ?? 0,
      time?.seconds ?? 0
    )
    if (!at) {
      return null
    }
    if (at.getTime() <= now.getTime()) {
      at.setDate(at.getDate() + 1)
    }
    return { at, text: formatReminderDateTime(at) }
  }

  const hours = time?.hours ?? dateParts.defaultHours
  const minutes = time?.minutes ?? 0
  const seconds = time?.seconds ?? 0
  let at = buildLocalDate(dateParts.year, dateParts.month, dateParts.day, hours, minutes, seconds)
  if (!at) {
    return null
  }
  if (at.getTime() <= now.getTime()) {
    if (dateParts.rollDaysWhenPast) {
      at = new Date(at.getTime())
      at.setDate(at.getDate() + 7)
    } else if (dateParts.rollYearWhenPast) {
      at = buildLocalDate(
        dateParts.year + 1,
        dateParts.month,
        dateParts.day,
        hours,
        minutes,
        seconds
      )
      if (!at) {
        return null
      }
    }
  }
  return { at, text: formatReminderDateTime(at) }
}

function normalizeInput(input: string): string {
  return (
    input
      .trim()
      .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
      .replace(/：/g, ':')
      // Keep the separator between two numbers (e.g. "10-20 15:30"), drop the
      // rest so "下周五 3 点" and "下 周 五" both work.
      .replace(/(?<=\D)\s+|\s+(?=\D)/g, '')
      .replace(/\s+/g, ' ')
  )
}

function buildLocalDate(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number
): Date | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 0 ||
    month > 11 ||
    day < 1 ||
    day > 31 ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null
  }
  const date = new Date(year, month, day, hours, minutes, seconds, 0)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes ||
    date.getSeconds() !== seconds
  ) {
    return null
  }
  return date
}

function parseChineseNumber(raw: string): number | null {
  if (/^\d+$/.test(raw)) {
    return Number(raw)
  }
  if (!/^[零一二两三四五六七八九十]+$/.test(raw)) {
    return null
  }
  if (!raw.includes('十')) {
    if (raw.length !== 1) {
      return null
    }
    return CN_DIGITS[raw] ?? null
  }
  const tenIndex = raw.indexOf('十')
  const tens = tenIndex === 0 ? 1 : CN_DIGITS[raw.slice(0, tenIndex)]
  const ones = tenIndex === raw.length - 1 ? 0 : CN_DIGITS[raw.slice(tenIndex + 1)]
  if (tens === undefined || ones === undefined) {
    return null
  }
  return tens * 10 + ones
}

function parseRelative(input: string, now: Date): Date | null {
  const match =
    /((?:\d+)|(?:[一二两三四五六七八九]?十[一二三四五六七八九]?|[零一二两三四五六七八九]))(秒钟?|分钟|分|小时|天|周|星期)后/.exec(
      input
    )
  if (!match) {
    return null
  }
  const amount = parseChineseNumber(match[1] as string)
  if (amount === null || amount < 0) {
    return null
  }
  const unit = match[2] as string
  const at = new Date(now.getTime())
  if (unit === '秒' || unit === '秒钟') {
    at.setSeconds(at.getSeconds() + amount)
  } else if (unit === '分钟' || unit === '分') {
    at.setMinutes(at.getMinutes() + amount)
  } else if (unit === '小时') {
    at.setHours(at.getHours() + amount)
  } else if (unit === '天') {
    at.setDate(at.getDate() + amount)
  } else {
    at.setDate(at.getDate() + amount * 7)
  }
  return at
}

interface TimeParts {
  hours: number
  minutes: number
  seconds: number
}

function parseTime(input: string): TimeParts | null {
  const colon = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(input)
  if (colon) {
    const hours = Number(colon[1])
    const minutes = Number(colon[2])
    const seconds = Number(colon[3] ?? 0)
    if (hours > 23 || minutes > 59 || seconds > 59) {
      return null
    }
    return { hours, minutes, seconds }
  }

  const point =
    /(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里|今晚|明晚|今夜|明夜)?((?:\d{1,3})|(?:[一二两三四五六七八九]?十[一二三四五六七八九]?|[零一二两三四五六七八九]))[点时](半|(?:\d{1,3})分?|(?:[一二两三四五六七八九]?十[一二三四五六七八九]?|[零一二两三四五六七八九])分?)?/.exec(
      input
    )
  if (!point) {
    return null
  }
  const period = point[1] ?? ''
  const rawHour = parseChineseNumber(point[2] as string)
  if (rawHour === null) {
    return null
  }
  const rawMinute = point[3]
  let minutes = 0
  if (rawMinute === '半') {
    minutes = 30
  } else if (rawMinute) {
    const parsed = parseChineseNumber(rawMinute.replace(/分$/, ''))
    if (parsed === null) {
      return null
    }
    minutes = parsed
  }
  if (minutes > 59) {
    return null
  }

  let hours = rawHour
  const pmPeriods = ['下午', '傍晚', '晚上', '夜里', '今晚', '明晚', '今夜', '明夜', '中午']
  const lateNightPeriods = ['晚上', '夜里', '今晚', '明晚', '今夜', '明夜']
  if (pmPeriods.includes(period)) {
    if (hours === 12) {
      hours = lateNightPeriods.includes(period) ? 0 : 12
    } else if (hours < 12) {
      hours += 12
    }
  } else if (period === '凌晨' && hours === 12) {
    hours = 0
  } else if ((period === '早上' || period === '早晨' || period === '上午') && hours === 12) {
    hours = 0
  }
  if (hours > 23) {
    return null
  }
  return { hours, minutes, seconds: 0 }
}

interface DateParts {
  year: number
  month: number
  day: number
  /** Used when the user gave a date but no time. */
  defaultHours: number
  /** Month/day without a year should move to next year once passed. */
  rollYearWhenPast: boolean
  /** Weekday references without a year roll to next week once passed. */
  rollDaysWhenPast: boolean
}

function parseDateParts(input: string, now: Date): DateParts | null {
  const absolute = /(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]?/.exec(input)
  if (absolute) {
    const year = absolute[1] ? Number(absolute[1]) : now.getFullYear()
    return {
      year,
      month: Number(absolute[2]) - 1,
      day: Number(absolute[3]),
      defaultHours: 9,
      rollYearWhenPast: !absolute[1],
      rollDaysWhenPast: false
    }
  }

  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(input)
  if (iso) {
    return {
      year: Number(iso[1]),
      month: Number(iso[2]) - 1,
      day: Number(iso[3]),
      defaultHours: 9,
      rollYearWhenPast: false,
      rollDaysWhenPast: false
    }
  }

  const numeric = /(\d{1,2})[/.-](\d{1,2})/.exec(input)
  if (numeric) {
    return {
      year: now.getFullYear(),
      month: Number(numeric[1]) - 1,
      day: Number(numeric[2]),
      defaultHours: 9,
      rollYearWhenPast: true,
      rollDaysWhenPast: false
    }
  }

  const dayOffset = parseDayWord(input)
  if (dayOffset !== null) {
    const at = new Date(now.getTime())
    at.setDate(at.getDate() + dayOffset.offset)
    return {
      year: at.getFullYear(),
      month: at.getMonth(),
      day: at.getDate(),
      defaultHours: dayOffset.defaultHours,
      rollYearWhenPast: false,
      rollDaysWhenPast: false
    }
  }

  const weekday = /(下下|下个|下|这个|本|这|上)?(?:周|星期|礼拜)([一二三四五六日天1-7])/.exec(input)
  if (weekday) {
    const target = WEEKDAY_INDEX[weekday[2] as string]
    if (target === undefined) {
      return null
    }
    const prefix = weekday[1] ?? ''
    const monday = startOfWeek(now)
    let offset = target
    if (prefix === '下') {
      offset += 7
    } else if (prefix === '下下') {
      offset += 14
    } else if (prefix === '下个') {
      offset += 7
    } else if (prefix === '上') {
      offset -= 7
    }
    const at = new Date(monday.getTime())
    at.setDate(at.getDate() + offset)
    return {
      year: at.getFullYear(),
      month: at.getMonth(),
      day: at.getDate(),
      defaultHours: 9,
      rollYearWhenPast: false,
      rollDaysWhenPast: prefix !== '上'
    }
  }

  return null
}

function parseDayWord(input: string): { offset: number; defaultHours: number } | null {
  if (input.includes('大后天')) {
    return { offset: 3, defaultHours: 9 }
  }
  if (input.includes('后天')) {
    return { offset: 2, defaultHours: 9 }
  }
  if (input.includes('明早')) {
    return { offset: 1, defaultHours: 8 }
  }
  if (input.includes('明晚') || input.includes('明天') || input.includes('明日')) {
    return { offset: 1, defaultHours: input.includes('明晚') ? 20 : 9 }
  }
  if (input.includes('今早')) {
    return { offset: 0, defaultHours: 8 }
  }
  if (input.includes('今晚') || input.includes('今天') || input.includes('今日')) {
    return { offset: 0, defaultHours: input.includes('今晚') ? 20 : 9 }
  }
  return null
}

function startOfWeek(now: Date): Date {
  const day = now.getDay()
  const sinceMonday = (day + 6) % 7
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday)
}
