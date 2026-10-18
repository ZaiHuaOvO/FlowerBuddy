import { randomUUID } from 'node:crypto'
import type {
  ModuleActionResult,
  WebsiteCheckConfig,
  WebsiteCheckInput,
  WebsiteCheckPatch,
  WebsiteCheckResult
} from '../../../shared/api'
import { AppError } from '../../shared/errors'
import type { JsonStore } from '../../storage/json-store'
import { checkWebsiteUrl } from './website-check'
import { isHttpUrl, type WebsiteData } from './website-types'

export interface WebsiteServiceOptions {
  fetchImpl?: typeof fetch | undefined
  now?: (() => Date) | undefined
}

function clampTimeout(value: number): number {
  if (!Number.isFinite(value)) {
    return 8000
  }
  return Math.min(30000, Math.max(3000, Math.round(value)))
}

function clampPolling(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null
  }
  return Math.min(60, Math.max(1, Math.round(value)))
}

function describeWebsiteResult(result: WebsiteCheckResult): string {
  if (result.ok) {
    return `正常，${result.durationMs}ms`
  }
  const detail = result.message || '检测失败'
  return result.errorKind === 'http-error' && result.durationMs > 0
    ? `异常，${detail}，${result.durationMs}ms`
    : `异常，${detail}`
}

export class WebsiteService {
  private changeListener: (() => void) | null = null
  private readonly now: () => Date

  constructor(
    private readonly store: JsonStore<WebsiteData>,
    private readonly options: WebsiteServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date())
  }

  setChangeListener(listener: (() => void) | null): void {
    this.changeListener = listener
  }

  list(): WebsiteCheckConfig[] {
    return this.store
      .get()
      .checks.slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  create(input: WebsiteCheckInput): WebsiteCheckConfig[] {
    const name = input.name.trim().slice(0, 80)
    if (!name) {
      throw new AppError('INVALID_INPUT', '网站名称不能为空')
    }
    if (!isHttpUrl(input.url)) {
      throw new AppError('INVALID_INPUT', '仅支持 http/https URL，且不能包含账号密码')
    }

    const now = this.now().toISOString()
    const check: WebsiteCheckConfig = {
      id: randomUUID(),
      name,
      url: input.url.trim(),
      enabled: input.enabled ?? true,
      timeoutMs: clampTimeout(input.timeoutMs),
      pollingIntervalMinutes: clampPolling(input.pollingIntervalMinutes),
      lastResult: null,
      createdAt: now,
      updatedAt: now
    }
    this.store.set({
      schemaVersion: 1,
      checks: [...this.store.get().checks, check]
    })
    this.notifyChanged()
    return this.list()
  }

  update(id: string, patch: WebsiteCheckPatch): WebsiteCheckConfig[] {
    const checks = this.store.get().checks
    const index = checks.findIndex((check) => check.id === id)
    if (index === -1) {
      throw new AppError('NOT_FOUND', '未找到该网站检测配置')
    }

    const current = checks[index] as WebsiteCheckConfig
    const next: WebsiteCheckConfig = { ...current }

    if (patch.name !== undefined) {
      const name = patch.name.trim().slice(0, 80)
      if (!name) {
        throw new AppError('INVALID_INPUT', '网站名称不能为空')
      }
      next.name = name
    }
    if (patch.url !== undefined) {
      if (!isHttpUrl(patch.url)) {
        throw new AppError('INVALID_INPUT', '仅支持 http/https URL，且不能包含账号密码')
      }
      next.url = patch.url.trim()
      next.lastResult = null
    }
    if (patch.timeoutMs !== undefined) {
      next.timeoutMs = clampTimeout(patch.timeoutMs)
    }
    if (patch.pollingIntervalMinutes !== undefined) {
      next.pollingIntervalMinutes = clampPolling(patch.pollingIntervalMinutes)
    }
    if (patch.enabled !== undefined) {
      next.enabled = patch.enabled
    }
    next.updatedAt = this.now().toISOString()

    const updated = [...checks]
    updated[index] = next
    this.store.set({ schemaVersion: 1, checks: updated })
    this.notifyChanged()
    return this.list()
  }

  remove(id: string): WebsiteCheckConfig[] {
    const checks = this.store.get().checks
    const next = checks.filter((check) => check.id !== id)
    if (next.length === checks.length) {
      throw new AppError('NOT_FOUND', '未找到该网站检测配置')
    }
    this.store.set({ schemaVersion: 1, checks: next })
    this.notifyChanged()
    return this.list()
  }

  setEnabled(id: string, enabled: boolean): WebsiteCheckConfig[] {
    return this.update(id, { enabled })
  }

  flush(): void {
    this.store.flush()
  }

  async checkOne(id: string): Promise<WebsiteCheckConfig[]> {
    const config = this.list().find((entry) => entry.id === id)
    if (!config) {
      throw new AppError('NOT_FOUND', '未找到该网站检测配置')
    }
    const result = await this.runCheck(config)
    this.applyResults([{ id, result }])
    return this.list()
  }

  async checkAllEnabled(): Promise<{
    configs: WebsiteCheckConfig[]
    summary: ModuleActionResult
  }> {
    const enabled = this.list().filter((check) => check.enabled)
    if (enabled.length === 0) {
      return {
        configs: this.list(),
        summary: { state: 'empty', message: '尚未配置启用的网站检测' }
      }
    }

    const outcomes = await Promise.all(
      enabled.map(async (check) => ({
        id: check.id,
        name: check.name,
        result: await this.runCheck(check)
      }))
    )
    this.applyResults(outcomes.map((outcome) => ({ id: outcome.id, result: outcome.result })))

    const failures = outcomes.filter((outcome) => !outcome.result.ok)
    const lines: string[] = []
    const results: string[] = []
    for (const outcome of outcomes) {
      const result = describeWebsiteResult(outcome.result)
      results.push(result)
      lines.push(`${outcome.name}：${result}`)
    }

    return {
      configs: this.list(),
      summary: {
        state: failures.length > 0 ? 'error' : 'success',
        message: lines.join('\n'),
        emphasis: results
      }
    }
  }

  private async runCheck(config: WebsiteCheckConfig): Promise<WebsiteCheckResult> {
    const outcome = await checkWebsiteUrl(config.url, {
      timeoutMs: config.timeoutMs,
      fetchImpl: this.options.fetchImpl
    })
    return { ...outcome, checkedAt: this.now().toISOString() }
  }

  private applyResults(entries: Array<{ id: string; result: WebsiteCheckResult }>): void {
    const byId = new Map(entries.map((entry) => [entry.id, entry.result]))
    const now = this.now().toISOString()
    const checks = this.store.get().checks.map((check) => {
      const result = byId.get(check.id)
      return result ? { ...check, lastResult: result, updatedAt: now } : check
    })
    this.store.set({ schemaVersion: 1, checks })
  }

  private notifyChanged(): void {
    this.changeListener?.()
  }
}
