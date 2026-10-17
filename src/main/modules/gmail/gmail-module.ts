import type { GmailPollSummary, ModuleActionResult } from '../../../shared/api'
import { AppError } from '../../shared/errors'
import type { ModuleContext, ModuleDefinition } from '../types'
import type { GmailService } from './gmail-service'
import type { GmailMessageSummary } from './types'

export const GMAIL_CHECK_ACTION = 'gmail:check'

export interface GmailModuleOptions {
  service: GmailService
  pollIntervalMinutes: () => number
}

export class GmailModule implements ModuleDefinition {
  readonly id = 'gmail' as const
  readonly name = 'Gmail 提醒'
  readonly description = '新邮件通知，需要 Google OAuth 授权'
  readonly requiresCredentials = true
  readonly implemented = true
  readonly actions = [
    {
      id: GMAIL_CHECK_ACTION,
      label: '检查邮件',
      loadingMessage: '正在检查新邮件…'
    }
  ]

  private context: ModuleContext | null = null
  private newMailHandler: ((messages: GmailMessageSummary[]) => void) | null = null

  constructor(private readonly options: GmailModuleOptions) {}

  setNewMailHandler(handler: ((messages: GmailMessageSummary[]) => void) | null): void {
    this.newMailHandler = handler
  }

  isConfigured(): boolean {
    return this.options.service.isConfigured()
  }

  getStatus(): 'ready' | 'not-configured' | 'auth-expired' {
    const state = this.options.service.getState()
    if (state.authExpired) {
      return 'auth-expired'
    }
    return this.isConfigured() ? 'ready' : 'not-configured'
  }

  start(context: ModuleContext): void {
    this.context = context
    this.refreshSchedules()
  }

  stop(): void {
    this.context?.scheduler.stopByOwner(this.id)
    this.context = null
  }

  refreshSchedules(): void {
    const context = this.context
    if (!context) {
      return
    }
    context.scheduler.stopByOwner(this.id)
    if (!this.isConfigured()) {
      return
    }

    context.scheduler.start({
      id: 'gmail:poll',
      owner: this.id,
      intervalMs: this.options.pollIntervalMinutes() * 60000,
      run: async () => {
        try {
          const { messages } = await this.options.service.poll()
          if (messages.length > 0) {
            this.newMailHandler?.(messages)
          }
        } catch (error) {
          if (error instanceof AppError && error.code === 'AUTH_EXPIRED') {
            context.scheduler.stopByOwner(this.id)
            context.logger.warn('gmail auth expired; polling stopped')
            return
          }
          throw error
        }
      }
    })
  }

  async runAction(actionId: string): Promise<ModuleActionResult> {
    if (actionId !== GMAIL_CHECK_ACTION) {
      throw new AppError('UNKNOWN_ACTION', '未知的 Gmail 操作')
    }

    const { summary } = await this.options.service.poll()
    if (summary.baselineReestablished) {
      return {
        state: 'empty',
        message: '已重新建立 Gmail 同步基线，不会提醒历史邮件'
      }
    }
    if (summary.newMessages === 0) {
      return { state: 'empty', message: '没有新邮件' }
    }
    return {
      state: 'success',
      message:
        summary.newMessages === 1 ? '收到 1 封新邮件' : `收到 ${summary.newMessages} 封新邮件`
    }
  }

  async checkNow(): Promise<GmailPollSummary> {
    return this.options.service.checkNow()
  }

  async connect(): Promise<{ emailAddress: string }> {
    return this.options.service.connect()
  }

  async disconnect(): Promise<void> {
    return this.options.service.disconnect()
  }

  async saveClientCredentials(clientId: string, clientSecret: string): Promise<void> {
    return this.options.service.saveClientCredentials(clientId, clientSecret)
  }

  getStateView() {
    return this.options.service.getStateView()
  }

  flush(): void {
    this.options.service.flush()
  }
}
