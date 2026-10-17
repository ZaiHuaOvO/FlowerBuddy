import { randomUUID } from 'node:crypto'
import type {
  WebsiteCheckConfig,
  WebsiteCheckErrorKind,
  WebsiteCheckResult
} from '../../../shared/api'

export interface WebsiteData {
  schemaVersion: 1
  checks: WebsiteCheckConfig[]
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const ERROR_KINDS: WebsiteCheckErrorKind[] = [
  'none',
  'http-error',
  'timeout',
  'network',
  'tls',
  'invalid-url',
  'cancelled'
]
const SENSITIVE_PARAM =
  /^(token|access_?token|id_?token|refresh_?token|api_?key|apikey|key|secret|password|passwd|auth|session|sig|signature|code)$/i

export function createEmptyWebsiteData(): WebsiteData {
  return { schemaVersion: 1, checks: [] }
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.username === '' &&
      url.password === ''
    )
  } catch {
    return false
  }
}

/** Removes credentials, fragments and sensitive query parameters before display. */
export function sanitizeUrlForDisplay(value: string): string {
  try {
    const url = new URL(value)
    url.username = ''
    url.password = ''
    url.hash = ''
    const entries = [...url.searchParams.entries()]
    url.search = ''
    for (const [key, entryValue] of entries) {
      if (!SENSITIVE_PARAM.test(key)) {
        url.searchParams.append(key, entryValue)
      }
    }
    return url.toString()
  } catch {
    return value.slice(0, 500)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeResult(raw: unknown): WebsiteCheckResult | null {
  if (!isRecord(raw)) {
    return null
  }
  const errorKind = ERROR_KINDS.find((entry) => entry === raw.errorKind)
  if (!errorKind || typeof raw.ok !== 'boolean') {
    return null
  }
  const status =
    typeof raw.status === 'number' && Number.isFinite(raw.status) ? Math.round(raw.status) : null
  const durationMs =
    typeof raw.durationMs === 'number' && Number.isFinite(raw.durationMs)
      ? Math.max(0, Math.round(raw.durationMs))
      : 0
  const finalUrl = typeof raw.finalUrl === 'string' ? sanitizeUrlForDisplay(raw.finalUrl) : ''
  const message = typeof raw.message === 'string' ? raw.message.slice(0, 200) : ''
  const checkedAt = typeof raw.checkedAt === 'string' ? raw.checkedAt : new Date().toISOString()
  return { ok: raw.ok, status, durationMs, finalUrl, errorKind, message, checkedAt }
}

function sanitizeCheck(raw: unknown, usedIds: Set<string>): WebsiteCheckConfig | null {
  if (!isRecord(raw)) {
    return null
  }
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 80) : ''
  const url = typeof raw.url === 'string' && isHttpUrl(raw.url) ? raw.url : null
  if (!name || !url) {
    return null
  }

  let id = typeof raw.id === 'string' && UUID_PATTERN.test(raw.id) ? raw.id : randomUUID()
  while (usedIds.has(id)) {
    id = randomUUID()
  }
  usedIds.add(id)

  const now = new Date().toISOString()
  const timeoutMs =
    typeof raw.timeoutMs === 'number' && Number.isFinite(raw.timeoutMs)
      ? Math.min(30000, Math.max(3000, Math.round(raw.timeoutMs)))
      : 8000
  const pollingIntervalMinutes =
    typeof raw.pollingIntervalMinutes === 'number' && Number.isFinite(raw.pollingIntervalMinutes)
      ? Math.min(60, Math.max(1, Math.round(raw.pollingIntervalMinutes)))
      : null

  return {
    id,
    name,
    url,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    timeoutMs,
    pollingIntervalMinutes,
    lastResult: sanitizeResult(raw.lastResult),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now
  }
}

export function sanitizeWebsiteData(raw: unknown): WebsiteData {
  if (!isRecord(raw) || !Array.isArray(raw.checks)) {
    return createEmptyWebsiteData()
  }

  const usedIds = new Set<string>()
  const checks: WebsiteCheckConfig[] = []
  for (const entry of raw.checks.slice(0, 200)) {
    const check = sanitizeCheck(entry, usedIds)
    if (check) {
      checks.push(check)
    }
  }
  return { schemaVersion: 1, checks }
}
