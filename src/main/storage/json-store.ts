import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { dirname } from 'node:path'
import type { LoggerLike } from '../shared/logger'

export interface JsonStoreOptions<T> {
  label: string
  defaults: () => T
  /** Must never throw; repair invalid input instead. */
  sanitize: (raw: unknown) => T
  saveDelayMs?: number
  logger?: LoggerLike
}

/** JSON document store with atomic writes and corrupt-file backups. */
export class JsonStore<T> {
  private current: T
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly saveDelayMs: number

  constructor(
    private readonly filePath: string,
    private readonly options: JsonStoreOptions<T>
  ) {
    this.current = options.defaults()
    this.saveDelayMs = options.saveDelayMs ?? 150
  }

  load(): T {
    try {
      if (!existsSync(this.filePath)) {
        this.current = this.options.defaults()
        this.writeNow()
        return this.get()
      }
      const parsed: unknown = JSON.parse(readFileSync(this.filePath, 'utf8'))
      this.current = this.options.sanitize(parsed)
      return this.get()
    } catch {
      this.backup()
      this.current = this.options.defaults()
      this.writeNow()
      this.options.logger?.warn('data file was unreadable; backed up and reset', {
        label: this.options.label
      })
      return this.get()
    }
  }

  get(): T {
    return structuredClone(this.current)
  }

  set(next: T): T {
    this.current = structuredClone(next)
    this.scheduleSave()
    return this.get()
  }

  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
      this.writeNow()
    }
  }

  private scheduleSave(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
    }
    this.timer = setTimeout(() => {
      this.timer = null
      this.writeNow()
    }, this.saveDelayMs)
  }

  private writeNow(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const temporaryPath = `${this.filePath}.tmp`
    writeFileSync(temporaryPath, `${JSON.stringify(this.current, null, 2)}\n`, 'utf8')
    renameSync(temporaryPath, this.filePath)
  }

  private backup(): void {
    try {
      if (existsSync(this.filePath)) {
        copyFileSync(this.filePath, `${this.filePath}.corrupt-${Date.now()}.json`)
      }
    } catch {
      // Best effort.
    }
  }
}
