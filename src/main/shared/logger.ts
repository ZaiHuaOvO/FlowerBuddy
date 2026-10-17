import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync
} from 'node:fs'
import { join } from 'node:path'

export type LogLevel = 'info' | 'warn' | 'error'

export interface LoggerOptions {
  maxFileBytes?: number
  retentionDays?: number
}

const SENSITIVE_KEY =
  /(api[-_]?key|access[-_]?key|secret|token|authorization|password|cookie|refresh[-_]?token|client[-_]?secret|body|content|subject|email)/i

const REDACTED = '[REDACTED]'

export function redactString(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, REDACTED)
    .replace(/\b(?:AKIA|LTAI)[A-Za-z0-9]{12,}\b/g, REDACTED)
    .replace(
      /((?:api[-_]?key|access[-_]?key|secret|token|password)\s*[:=]\s*)[^\s,;"']+/gi,
      `$1${REDACTED}`
    )
}

/** Recursively removes credential-like keys and values from log metadata. */
export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return '[TRUNCATED]'
  }
  if (typeof value === 'string') {
    return redactString(value)
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  ) {
    return value
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry) => redactValue(entry, depth + 1))
  }
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) }
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value).slice(0, 50)) {
      result[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactValue(entry, depth + 1)
    }
    return result
  }
  return String(value)
}

export interface LoggerLike {
  info(message: string, meta?: unknown): void
  warn(message: string, meta?: unknown): void
  error(message: string, meta?: unknown): void
}

export class Logger implements LoggerLike {
  private readonly filePath: string
  private readonly maxFileBytes: number
  private readonly retentionDays: number

  constructor(
    private readonly directory: string,
    options: LoggerOptions = {}
  ) {
    this.maxFileBytes = options.maxFileBytes ?? 2 * 1024 * 1024
    this.retentionDays = options.retentionDays ?? 7
    mkdirSync(directory, { recursive: true })
    this.filePath = join(directory, 'app.log')
    this.removeExpiredFiles()
  }

  info(message: string, meta?: unknown): void {
    this.write('info', message, meta)
  }

  warn(message: string, meta?: unknown): void {
    this.write('warn', message, meta)
  }

  error(message: string, meta?: unknown): void {
    this.write('error', message, meta)
  }

  private write(level: LogLevel, message: string, meta?: unknown): void {
    const entry: Record<string, unknown> = {
      time: new Date().toISOString(),
      level,
      message: redactString(message)
    }
    if (meta !== undefined) {
      entry.meta = redactValue(meta)
    }
    appendFileSync(this.filePath, `${JSON.stringify(entry)}\n`, 'utf8')
    this.rotateIfNeeded()
  }

  private rotateIfNeeded(): void {
    try {
      if (statSync(this.filePath).size <= this.maxFileBytes) {
        return
      }
      const backupPath = join(this.directory, 'app.1.log')
      if (existsSync(backupPath)) {
        unlinkSync(backupPath)
      }
      renameSync(this.filePath, backupPath)
    } catch {
      // Logging must never break the application.
    }
  }

  private removeExpiredFiles(): void {
    try {
      const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000
      for (const name of readdirSync(this.directory)) {
        if (!/^app(\.\d+)?\.log$/.test(name)) {
          continue
        }
        const filePath = join(this.directory, name)
        if (statSync(filePath).mtimeMs < cutoff) {
          unlinkSync(filePath)
        }
      }
    } catch {
      // Best effort cleanup.
    }
  }
}
