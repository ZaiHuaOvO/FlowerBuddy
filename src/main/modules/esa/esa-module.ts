import type { EsaTraffic, ModuleActionResult } from '../../../shared/api'
import { SECRET_ESA_ACCESS_KEY_ID, SECRET_ESA_ACCESS_KEY_SECRET } from '../../security/secret-ids'
import { AppError } from '../../shared/errors'
import type { ConfigStore } from '../../storage/config-store'
import type { ModuleContext, ModuleDefinition, SecretReader } from '../types'
import { fetchEsaTraffic, formatTrafficResult } from './esa-service'

export const ESA_TRAFFIC_ACTION = 'esa:traffic'

export interface EsaModuleOptions {
  secretStore: SecretReader
  configStore: ConfigStore
  fetchTraffic?: (input: {
    accessKeyId: string
    accessKeySecret: string
    siteId: string
  }) => Promise<EsaTraffic>
}

export class EsaModule implements ModuleDefinition {
  readonly id = 'esa' as const
  readonly name = 'ESA 流量'
  readonly description = '阿里云 ESA 今日流量，需要只读 AccessKey'
  readonly requiresCredentials = true
  readonly implemented = true
  readonly actions = [
    {
      id: ESA_TRAFFIC_ACTION,
      label: '今日流量',
      loadingMessage: '正在查询 ESA 今日流量…'
    }
  ]

  private context: ModuleContext | null = null
  private readonly fetchTraffic: NonNullable<EsaModuleOptions['fetchTraffic']>

  constructor(private readonly options: EsaModuleOptions) {
    this.fetchTraffic = options.fetchTraffic ?? ((input) => fetchEsaTraffic(input))
  }

  isConfigured(): boolean {
    return (
      this.options.secretStore.has(SECRET_ESA_ACCESS_KEY_ID) &&
      this.options.secretStore.has(SECRET_ESA_ACCESS_KEY_SECRET) &&
      this.options.configStore.get().modules.esa.siteId.trim().length > 0
    )
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

    const minutes = this.options.configStore.get().modules.esa.refreshIntervalMinutes
    if (minutes === null) {
      return
    }

    context.scheduler.start({
      id: 'esa:refresh',
      owner: this.id,
      intervalMs: minutes * 60000,
      run: async () => {
        await this.queryTraffic()
        context.logger.info('esa traffic refreshed')
      }
    })
  }

  async runAction(actionId: string): Promise<ModuleActionResult> {
    if (actionId !== ESA_TRAFFIC_ACTION) {
      throw new AppError('UNKNOWN_ACTION', '未知的 ESA 操作')
    }
    return formatTrafficResult(await this.queryTraffic())
  }

  async queryTraffic(): Promise<EsaTraffic> {
    const siteId = this.options.configStore.get().modules.esa.siteId.trim()
    const accessKeyId = await this.options.secretStore.get(SECRET_ESA_ACCESS_KEY_ID)
    const accessKeySecret = await this.options.secretStore.get(SECRET_ESA_ACCESS_KEY_SECRET)

    if (!accessKeyId || !accessKeySecret) {
      throw new AppError('NOT_CONFIGURED', '请先在设置中填写 ESA AccessKey')
    }
    if (!siteId) {
      throw new AppError('NOT_CONFIGURED', '请先在设置中填写 ESA SiteId')
    }

    return this.fetchTraffic({ accessKeyId, accessKeySecret, siteId })
  }
}
