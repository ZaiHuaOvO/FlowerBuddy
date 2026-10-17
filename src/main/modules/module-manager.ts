import type {
  MenuActionSummary,
  ModuleActionDefinition,
  ModuleActionResult,
  ModuleId,
  ModuleStatus,
  ModuleSummary
} from '../../shared/api'
import { AppError } from '../shared/errors'
import type { LoggerLike } from '../shared/logger'
import type { TaskScheduler } from '../scheduler/task-scheduler'
import type { ConfigStore } from '../storage/config-store'
import type { ModuleDefinition } from './types'

const STATUS_LABELS: Record<ModuleStatus, string> = {
  ready: '已就绪',
  'not-configured': '未配置',
  'auth-expired': '授权已失效',
  'not-implemented': '待实现'
}

export interface ModuleManagerOptions {
  modules: ModuleDefinition[]
  configStore: ConfigStore
  scheduler: TaskScheduler
  logger: LoggerLike
}

/** Owns module lifecycle: enabled && configured modules are started. */
export class ModuleManager {
  private readonly started = new Set<ModuleId>()

  constructor(private readonly options: ModuleManagerOptions) {}

  start(): void {
    for (const module of this.options.modules) {
      this.syncModule(module)
    }
    this.options.logger.info('module manager started', {
      started: [...this.started].sort(),
      modules: this.list().map((module) => ({
        id: module.id,
        enabled: module.enabled,
        status: module.status
      }))
    })
  }

  stop(): void {
    for (const module of this.options.modules) {
      if (this.started.has(module.id)) {
        this.stopModule(module)
      }
    }
    this.options.scheduler.stopAll()
  }

  setEnabled(moduleId: ModuleId, enabled: boolean): ModuleSummary[] {
    this.options.configStore.setModuleEnabled(moduleId, enabled)
    const module = this.options.modules.find((entry) => entry.id === moduleId)
    if (module) {
      this.syncModule(module)
    }
    return this.list()
  }

  list(): ModuleSummary[] {
    return this.options.modules.map((module) => {
      const enabled = this.options.configStore.isModuleEnabled(module.id)
      const configured = module.isConfigured()
      const status = module.getStatus()
      return {
        id: module.id,
        name: module.name,
        description: module.description,
        enabled,
        configured,
        implemented: module.implemented,
        status,
        statusLabel: STATUS_LABELS[status]
      }
    })
  }

  handleResume(): void {
    this.options.scheduler.handleResume()
  }

  getMenuActions(): MenuActionSummary[] {
    return this.options.modules
      .filter(
        (module) =>
          module.implemented &&
          module.isConfigured() &&
          module.actions.length > 0 &&
          this.options.configStore.isModuleEnabled(module.id)
      )
      .flatMap((module) =>
        module.actions.map((action) => ({
          id: action.id,
          label: action.label,
          moduleId: module.id
        }))
      )
  }

  getAction(actionId: string): {
    module: ModuleDefinition
    action: ModuleActionDefinition
  } {
    const module = this.options.modules.find((entry) =>
      entry.actions.some((action) => action.id === actionId)
    )
    if (!module) {
      throw new AppError('UNKNOWN_ACTION', '该功能不存在')
    }
    const action = module.actions.find((entry) => entry.id === actionId)
    if (!action) {
      throw new AppError('UNKNOWN_ACTION', '该功能不存在')
    }
    if (!module.implemented || !module.runAction) {
      throw new AppError('UNKNOWN_ACTION', '该功能尚未实现')
    }
    if (!module.isConfigured()) {
      throw new AppError('NOT_CONFIGURED', '该功能尚未配置')
    }
    if (!this.options.configStore.isModuleEnabled(module.id)) {
      throw new AppError('MODULE_DISABLED', '该功能已停用，请在设置中启用')
    }
    return { module, action }
  }

  async runAction(actionId: string): Promise<ModuleActionResult> {
    const { module, action } = this.getAction(actionId)
    if (!module.runAction) {
      throw new AppError('UNKNOWN_ACTION', '该功能尚未实现')
    }
    this.options.logger.info('module action started', {
      module: module.id,
      action: action.id
    })
    return module.runAction(actionId)
  }

  private shouldRun(module: ModuleDefinition): boolean {
    return this.options.configStore.isModuleEnabled(module.id) && module.isConfigured()
  }

  private syncModule(module: ModuleDefinition): void {
    if (this.shouldRun(module)) {
      if (!this.started.has(module.id)) {
        this.startModule(module)
      }
      return
    }
    if (this.started.has(module.id)) {
      this.stopModule(module)
    }
  }

  private startModule(module: ModuleDefinition): void {
    module.start({
      scheduler: this.options.scheduler,
      logger: this.options.logger
    })
    this.started.add(module.id)
    this.options.logger.info('module started', { module: module.id })
  }

  private stopModule(module: ModuleDefinition): void {
    module.stop()
    this.options.scheduler.stopByOwner(module.id)
    this.started.delete(module.id)
    this.options.logger.info('module stopped', { module: module.id })
  }
}
