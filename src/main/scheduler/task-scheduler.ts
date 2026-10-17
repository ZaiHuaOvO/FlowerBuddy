import type { LoggerLike } from '../shared/logger'

export interface ScheduledTask {
  id: string
  owner: string
  intervalMs: number
  run(signal: AbortSignal): Promise<void>
  runImmediately?: boolean
}

interface TaskState {
  task: ScheduledTask
  timer: ReturnType<typeof setTimeout> | null
  running: boolean
  controller: AbortController | null
  failures: number
  stopped: boolean
}

export interface TaskSchedulerOptions {
  logger?: LoggerLike
  maxBackoffMs?: number
}

/**
 * One timer chain per task. Runs never overlap; failures back off
 * exponentially; stopping aborts the in-flight run.
 */
export class TaskScheduler {
  private readonly tasks = new Map<string, TaskState>()
  private readonly logger: LoggerLike | undefined
  private readonly maxBackoffMs: number

  constructor(options: TaskSchedulerOptions = {}) {
    this.logger = options.logger
    this.maxBackoffMs = options.maxBackoffMs ?? 30 * 60 * 1000
  }

  start(task: ScheduledTask): void {
    if (this.tasks.has(task.id)) {
      throw new Error(`Task already scheduled: ${task.id}`)
    }
    if (!Number.isFinite(task.intervalMs) || task.intervalMs <= 0) {
      throw new Error('Task interval must be a positive number')
    }

    const state: TaskState = {
      task,
      timer: null,
      running: false,
      controller: null,
      failures: 0,
      stopped: false
    }
    this.tasks.set(task.id, state)
    this.schedule(state, task.runImmediately ? 0 : task.intervalMs)
  }

  stop(id: string): void {
    const state = this.tasks.get(id)
    if (!state) {
      return
    }
    state.stopped = true
    if (state.timer !== null) {
      clearTimeout(state.timer)
      state.timer = null
    }
    state.controller?.abort()
    this.tasks.delete(id)
  }

  stopByOwner(owner: string): void {
    for (const [id, state] of [...this.tasks.entries()]) {
      if (state.task.owner === owner) {
        this.stop(id)
      }
    }
  }

  stopAll(): void {
    for (const id of [...this.tasks.keys()]) {
      this.stop(id)
    }
  }

  isRunning(id: string): boolean {
    return this.tasks.get(id)?.running ?? false
  }

  getTaskIds(): string[] {
    return [...this.tasks.keys()].sort()
  }

  async runNow(id: string): Promise<void> {
    const state = this.tasks.get(id)
    if (!state || state.running) {
      return
    }
    if (state.timer !== null) {
      clearTimeout(state.timer)
      state.timer = null
    }
    await this.execute(state)
  }

  /** After sleep, restart intervals from now instead of replaying missed runs. */
  handleResume(): void {
    for (const state of this.tasks.values()) {
      if (state.running) {
        continue
      }
      if (state.timer !== null) {
        clearTimeout(state.timer)
        state.timer = null
      }
      this.schedule(state, state.task.intervalMs)
    }
    this.logger?.info('scheduler resumed after system sleep', { tasks: this.tasks.size })
  }

  private schedule(state: TaskState, delayMs: number): void {
    if (state.stopped) {
      return
    }
    state.timer = setTimeout(
      () => {
        state.timer = null
        void this.tick(state)
      },
      Math.max(0, delayMs)
    )
  }

  private async tick(state: TaskState): Promise<void> {
    if (state.stopped || !this.tasks.has(state.task.id)) {
      return
    }
    if (state.running) {
      this.logger?.warn('scheduled task still running; skipping this tick', {
        task: state.task.id
      })
      this.schedule(state, state.task.intervalMs)
      return
    }
    await this.execute(state)
  }

  private async execute(state: TaskState): Promise<void> {
    state.running = true
    const controller = new AbortController()
    state.controller = controller

    try {
      await state.task.run(controller.signal)
      state.failures = 0
      if (!state.stopped) {
        this.schedule(state, state.task.intervalMs)
      }
    } catch (error) {
      if (state.stopped || controller.signal.aborted) {
        return
      }
      state.failures += 1
      const delayMs = Math.min(this.maxBackoffMs, state.task.intervalMs * 2 ** state.failures)
      this.logger?.warn('scheduled task failed; backing off', {
        task: state.task.id,
        failures: state.failures,
        delayMs,
        error
      })
      if (!state.stopped) {
        this.schedule(state, delayMs)
      }
    } finally {
      state.running = false
      state.controller = null
    }
  }
}
