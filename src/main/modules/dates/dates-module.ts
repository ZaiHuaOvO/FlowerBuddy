import type { ModuleActionResult } from '../../../shared/api'
import { AppError } from '../../shared/errors'
import type { ModuleDefinition } from '../types'
import { formatCountdown } from './dates-compute'
import type { DatesService } from './dates-service'

export const DATES_UPCOMING_ACTION = 'dates:upcoming'

export class DatesModule implements ModuleDefinition {
  readonly id = 'dates' as const
  readonly name = '特殊日期'
  readonly description = '生日、纪念日与倒计时提醒'
  readonly requiresCredentials = false
  readonly implemented = true
  readonly actions = [
    {
      id: DATES_UPCOMING_ACTION,
      label: '最近日期',
      loadingMessage: '正在整理日期…'
    }
  ]

  constructor(private readonly service: DatesService) {}

  isConfigured(): boolean {
    return true
  }

  getStatus(): 'ready' {
    return 'ready'
  }

  start(): void {
    // Display-only module; no polling is needed.
  }

  stop(): void {
    // Nothing to cancel.
  }

  async runAction(actionId: string): Promise<ModuleActionResult> {
    if (actionId !== DATES_UPCOMING_ACTION) {
      throw new AppError('UNKNOWN_ACTION', '未知的日期操作')
    }

    const upcoming = this.service.upcoming(3)
    if (upcoming.length === 0) {
      return { state: 'empty', message: '暂无即将到来的日期事件' }
    }

    return {
      state: 'success',
      message: upcoming
        .map((event) => `${event.title} · ${formatCountdown(event.daysUntil)}`)
        .join('\n')
    }
  }
}
