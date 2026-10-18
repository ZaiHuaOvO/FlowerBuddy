import type { DeepSeekBalance, ModuleActionResult } from '../../../shared/api'
import { SECRET_DEEPSEEK_API_KEY } from '../../security/secret-ids'
import { AppError } from '../../shared/errors'
import type { ConfigStore } from '../../storage/config-store'
import type { ModuleContext, ModuleDefinition, SecretReader } from '../types'
import { fetchDeepSeekBalance } from './deepseek-service'

export const DEEPSEEK_BALANCE_ACTION = 'deepseek:balance'

export interface DeepSeekModuleOptions {
  secretStore: SecretReader
  configStore: ConfigStore
  fetchBalance?: (apiKey: string) => Promise<DeepSeekBalance>
}

export function formatBalanceResult(balance: DeepSeekBalance): ModuleActionResult {
  if (!balance.isAvailable) {
    return {
      state: 'error',
      message: '大鲸鱼现在吃不到米饭喵（账户余额不可用）'
    }
  }
  const info = balance.balances.find((entry) => entry.currency === 'CNY') ?? balance.balances[0]
  if (!info) {
    return { state: 'empty', message: '大鲸鱼没有查到米饭余额喵' }
  }
  const amount =
    info.currency === 'CNY' ? `¥${info.totalBalance}` : `${info.currency} ${info.totalBalance}`
  return {
    state: 'success',
    message: `大鲸鱼还有 ${amount} 的米饭可以吃喵`
  }
}

export class DeepSeekModule implements ModuleDefinition {
  readonly id = 'deepseek' as const
  readonly name = 'DeepSeek 余额'
  readonly description = '账户余额查询，需要 API Key'
  readonly requiresCredentials = true
  readonly implemented = true
  readonly actions = [
    {
      id: DEEPSEEK_BALANCE_ACTION,
      label: '查询余额',
      loadingMessage: '正在查询 DeepSeek 余额…'
    }
  ]

  private context: ModuleContext | null = null
  private readonly fetchBalance: (apiKey: string) => Promise<DeepSeekBalance>

  constructor(private readonly options: DeepSeekModuleOptions) {
    this.fetchBalance = options.fetchBalance ?? ((apiKey) => fetchDeepSeekBalance(apiKey))
  }

  isConfigured(): boolean {
    return this.options.secretStore.has(SECRET_DEEPSEEK_API_KEY)
  }

  getStatus(): 'ready' | 'not-configured' {
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

    const minutes = this.options.configStore.get().modules.deepseek.refreshIntervalMinutes
    if (minutes === null) {
      return
    }

    context.scheduler.start({
      id: 'deepseek:refresh',
      owner: this.id,
      intervalMs: minutes * 60000,
      run: async () => {
        await this.queryBalance()
        context.logger.info('deepseek balance refreshed')
      }
    })
  }

  async runAction(actionId: string): Promise<ModuleActionResult> {
    if (actionId !== DEEPSEEK_BALANCE_ACTION) {
      throw new AppError('UNKNOWN_ACTION', '未知的 DeepSeek 操作')
    }
    return formatBalanceResult(await this.queryBalance())
  }

  async queryBalance(): Promise<DeepSeekBalance> {
    const apiKey = await this.options.secretStore.get(SECRET_DEEPSEEK_API_KEY)
    if (!apiKey) {
      throw new AppError('NOT_CONFIGURED', '请先在设置中填写 DeepSeek API Key')
    }
    return this.fetchBalance(apiKey)
  }
}
