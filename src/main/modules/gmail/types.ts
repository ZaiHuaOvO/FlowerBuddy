export interface GmailMessageSummary {
  id: string
  from: string
  subject: string
  date: string
}

export interface GmailState {
  schemaVersion: 1
  emailAddress: string
  historyId: string | null
  notifiedMessageIds: string[]
  authExpired: boolean
  lastCheckedAt: string | null
}

export const MAX_NOTIFIED_IDS = 200

export function createEmptyGmailState(): GmailState {
  return {
    schemaVersion: 1,
    emailAddress: '',
    historyId: null,
    notifiedMessageIds: [],
    authExpired: false,
    lastCheckedAt: null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function sanitizeGmailState(raw: unknown): GmailState {
  if (!isRecord(raw)) {
    return createEmptyGmailState()
  }

  const ids = Array.isArray(raw.notifiedMessageIds)
    ? raw.notifiedMessageIds.filter(
        (entry): entry is string => typeof entry === 'string' && entry.length <= 128
      )
    : []

  return {
    schemaVersion: 1,
    emailAddress: typeof raw.emailAddress === 'string' ? raw.emailAddress.slice(0, 320) : '',
    historyId: typeof raw.historyId === 'string' && raw.historyId.length > 0 ? raw.historyId : null,
    notifiedMessageIds: [...new Set(ids)].slice(-MAX_NOTIFIED_IDS),
    authExpired: typeof raw.authExpired === 'boolean' ? raw.authExpired : false,
    lastCheckedAt: typeof raw.lastCheckedAt === 'string' ? raw.lastCheckedAt : null
  }
}

export function sanitizeHeaderValue(value: string, maxLength: number): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, maxLength)
}
