import type { IntervalReminderSummary } from '../../../shared/api'
import type { ModuleContext, ModuleDefinition } from '../types'
import type { IntervalReminderService } from './interval-reminder-service'
import { computeNextDue, deferToActive, isWithinRanges } from './schedule'

interface Plan {
  nextAt: number
  fingerprint: string
}

const TICK_MS = 30 * 1000

export class IntervalReminderModule implements ModuleDefinition {
  readonly id = 'interval-reminder' as const
  readonly name = '定时提醒'
  readonly description = '按间隔在桌宠气泡中重复提醒'
  readonly requiresCredentials = false
  readonly implemented = true
  readonly actions = []

  private context: ModuleContext | null = null
  private unsubscribe: (() => void) | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly plans = new Map<string, Plan>()

  constructor(
    private readonly service: IntervalReminderService,
    private readonly random: () => number = Math.random,
    private readonly now: () => number = () => Date.now(),
    private readonly tickMs = TICK_MS
  ) {}

  isConfigured(): boolean {
    return true
  }

  getStatus(): 'ready' {
    return 'ready'
  }

  start(context: ModuleContext): void {
    this.stop()
    this.context = context
    this.unsubscribe = this.service.onChange(() => this.sync())
    this.sync()
    this.timer = setInterval(() => this.tick(), this.tickMs)
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.plans.clear()
    this.context = null
  }

  handleResume(): void {
    this.sync()
    this.tick()
  }

  private sync(): void {
    const enabled = this.service.list().filter((reminder) => reminder.enabled)
    const ids = new Set(enabled.map((reminder) => reminder.id))
    for (const id of [...this.plans.keys()]) {
      if (!ids.has(id)) {
        this.plans.delete(id)
      }
    }
    const now = this.now()
    for (const reminder of enabled) {
      const fingerprint = fingerprintOf(reminder)
      const plan = this.plans.get(reminder.id)
      if (!plan || plan.fingerprint !== fingerprint) {
        this.plans.set(reminder.id, {
          nextAt: computeNextDue(now, reminder, this.random),
          fingerprint
        })
      }
    }
  }

  private tick(): void {
    const context = this.context
    if (!context) {
      return
    }
    const enabled = this.service.list().filter((reminder) => reminder.enabled)
    const now = this.now()
    for (const reminder of enabled) {
      const plan = this.plans.get(reminder.id)
      if (!plan || now < plan.nextAt) {
        continue
      }
      if (isWithinRanges(new Date(now), reminder.ranges)) {
        plan.nextAt = computeNextDue(now, reminder, this.random)
        context.notify(reminder.text, {
          persistent: true,
          id: `interval-reminder:${reminder.id}`
        })
        this.service.markFired(reminder.id, new Date(now))
      } else {
        plan.nextAt = deferToActive(now, reminder.ranges)
      }
    }
  }
}

function fingerprintOf(reminder: IntervalReminderSummary): string {
  return [
    reminder.intervalMinutes,
    reminder.randomEnabled,
    reminder.randomJitterMinutes,
    JSON.stringify(reminder.ranges)
  ].join('|')
}
