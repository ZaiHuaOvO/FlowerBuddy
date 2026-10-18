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
  /** Shows a short background message (pet bubble) to the user. */
  notify: (message: string) => void
}

/** Narrow view of the main-process Secret Store used by credential modules. */
export interface SecretReader {
  has(id: string): boolean
  get(id: string): Promise<string | null>
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
  handleResume?(): void
  runAction?(actionId: string): Promise<ModuleActionResult>
}
