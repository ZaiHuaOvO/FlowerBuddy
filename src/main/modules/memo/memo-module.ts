import type { MemoSummary } from '../../../shared/api'
import type { ModuleContext, ModuleDefinition } from '../types'
import type { MemoService } from './memo-service'

const SAFETY_INTERVAL_MS = 30000
/** Timers longer than this are re-armed so clock/date changes are picked up. */
const MAX_TIMEOUT_MS = 30 * 60 * 1000

function preview(memo: MemoSummary): string {
  const line = memo.text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0)
  if (!line) {
    return '图片备忘'
  }
  return line.length > 40 ? `${line.slice(0, 40)}…` : line
}

export class MemoModule implements ModuleDefinition {
  readonly id = 'memo' as const
  readonly name = '备忘录'
  readonly description = '随手记录备忘，支持提醒与桌面锚点'
  readonly requiresCredentials = false
  readonly implemented = true
  readonly actions = []

  private context: ModuleContext | null = null
  private unsubscribe: (() => void) | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private safetyTimer: ReturnType<typeof setInterval> | null = null

  constructor(private readonly service: MemoService) {}

  isConfigured(): boolean {
    return true
  }

  getStatus(): 'ready' {
    return 'ready'
  }

  start(context: ModuleContext): void {
    this.stop()
    this.context = context
    this.unsubscribe = this.service.onChange(() => this.arm())
    this.safetyTimer = setInterval(() => this.fire(), SAFETY_INTERVAL_MS)
    this.fire()
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.safetyTimer !== null) {
      clearInterval(this.safetyTimer)
      this.safetyTimer = null
    }
    this.context = null
  }

  handleResume(): void {
    this.fire()
  }

  private arm(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (!this.context) {
      return
    }
    if (this.service.dueReminders(new Date()).length > 0) {
      this.timer = setTimeout(() => {
        this.timer = null
        this.fire()
      }, 0)
      return
    }
    const next = this.service.nextReminderAt()
    if (next === null) {
      return
    }
    const delay = Math.max(0, next - Date.now())
    this.timer = setTimeout(
      () => {
        this.timer = null
        this.fire()
      },
      Math.min(delay, MAX_TIMEOUT_MS)
    )
  }

  private fire(): void {
    const context = this.context
    if (!context) {
      return
    }
    const now = new Date()
    const due = this.service.dueReminders(now)
    if (due.length > 0) {
      const first = due[0] as MemoSummary
      const extra = due.length > 1 ? ` 等 ${due.length} 条` : ''
      context.notify(`备忘提醒：${preview(first)}${extra}`, { persistent: true })
      for (const memo of due) {
        this.service.markReminded(memo.id, now)
      }
    }
    this.arm()
  }
}
