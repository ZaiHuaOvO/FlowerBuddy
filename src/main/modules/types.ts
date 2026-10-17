import type {
  ModuleActionDefinition,
  ModuleActionResult,
  ModuleId,
  ModuleStatus
} from '../../shared/api'
import type { LoggerLike } from '../shared/logger'
import type { TaskScheduler } from '../scheduler/task-scheduler'

export interface ModuleContext {
  scheduler: TaskScheduler
  logger: LoggerLike
}

export interface ModuleDefinition {
  id: ModuleId
  name: string
  description: string
  requiresCredentials: boolean
  implemented: boolean
  actions: ModuleActionDefinition[]
  isConfigured(): boolean
  getStatus(): ModuleStatus
  start(context: ModuleContext): void
  stop(): void
  runAction?(actionId: string): Promise<ModuleActionResult>
}
