import type {
  DateCategory,
  DateEventSummary,
  ModuleStatus,
  WebsiteCheckResult
} from '../../../../shared/api'
import type { TagTone } from '../../components/tag-tone'
import { CATEGORY_OPTIONS } from './constants'

export function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message
    if (typeof message === 'string') {
      return message
    }
  }
  return String(error)
}

export function tagTone(status: ModuleStatus): TagTone {
  switch (status) {
    case 'ready':
      return 'success'
    case 'auth-expired':
      return 'danger'
    case 'not-configured':
      return 'warning'
    case 'not-implemented':
      return 'muted'
  }
}

export function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function categoryLabel(category: DateCategory): string {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? '自定义'
}

export function countdownLabel(days: number | null): string {
  if (days === null) {
    return '已过去'
  }
  return days === 0 ? '今天' : `还有 ${days} 天`
}

export function dateTone(event: DateEventSummary): TagTone {
  if (!event.enabled || !event.upcoming) {
    return 'muted'
  }
  return event.daysUntil === 0 ? 'warning' : 'success'
}

export function dateStatusLabel(event: DateEventSummary): string {
  if (!event.enabled) {
    return '已停用'
  }
  if (!event.upcoming) {
    return '已过去'
  }
  return countdownLabel(event.daysUntil)
}

export function websiteTone(result: WebsiteCheckResult | null): TagTone {
  if (!result) {
    return 'muted'
  }
  return result.ok ? 'success' : 'danger'
}

export function websiteLabel(result: WebsiteCheckResult | null): string {
  if (!result) {
    return '尚未检测'
  }
  if (result.ok) {
    return `正常 · HTTP ${result.status ?? '-'} · ${result.durationMs}ms`
  }
  if (result.errorKind === 'http-error') {
    return `${result.message} · ${result.durationMs}ms`
  }
  return result.message
}

export function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export function formatBalanceAmount(currency: string, amount: string): string {
  const value = Number(amount)
  if (!Number.isFinite(value)) {
    return `${currency} ${amount}`
  }
  try {
    return `${currency} ${new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency
    }).format(value)}`
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let value = Math.max(0, bytes)
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  const digits = index === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[index]}`
}

export function formatTrafficRange(startTime: string, endTime: string): string {
  const start = new Date(startTime)
  const end = new Date(endTime)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return ''
  }
  const date = start.toLocaleDateString('zh-CN')
  const startClock = start.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
  const endClock = end.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${date} ${startClock} 至 ${endClock}`
}

export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) {
    return email
  }
  return `${email.slice(0, 1)}***${email.slice(at)}`
}
