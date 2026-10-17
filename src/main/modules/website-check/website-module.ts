import type { ModuleActionResult } from '../../../shared/api'
import { AppError } from '../../shared/errors'
import type { ModuleContext, ModuleDefinition } from '../types'
import type { WebsiteService } from './website-service'

export const WEBSITE_CHECK_ALL_ACTION = 'website-check:run-all'

export class WebsiteCheckModule implements ModuleDefinition {
  readonly id = 'website-check' as const
  readonly name = '网站检测'
  readonly description = '从本机检查 HTTP(S) 可用性'
  readonly requiresCredentials = false
  readonly implemented = true
  readonly actions = [
    {
      id: WEBSITE_CHECK_ALL_ACTION,
      label: '检测网站',
      loadingMessage: '正在从本机检测网站…'
    }
  ]

  private context: ModuleContext | null = null

  constructor(private readonly service: WebsiteService) {}

  isConfigured(): boolean {
    return true
  }

  getStatus(): 'ready' {
    return 'ready'
  }

  start(context: ModuleContext): void {
    this.context = context
    this.service.setChangeListener(() => this.refreshSchedules())
    this.refreshSchedules()
  }

  stop(): void {
    this.service.setChangeListener(null)
    this.context?.scheduler.stopByOwner(this.id)
    this.context = null
  }

  refreshSchedules(): void {
    const context = this.context
    if (!context) {
      return
    }

    context.scheduler.stopByOwner(this.id)
    for (const config of this.service.list()) {
      if (!config.enabled || config.pollingIntervalMinutes === null) {
        continue
      }
      context.scheduler.start({
        id: `${this.id}:${config.id}`,
        owner: this.id,
        intervalMs: config.pollingIntervalMinutes * 60000,
        run: async () => {
          await this.service.checkOne(config.id)
        }
      })
    }
  }

  async runAction(actionId: string): Promise<ModuleActionResult> {
    if (actionId !== WEBSITE_CHECK_ALL_ACTION) {
      throw new AppError('UNKNOWN_ACTION', '未知的网站检测操作')
    }
    const { summary } = await this.service.checkAllEnabled()
    return summary
  }
}
