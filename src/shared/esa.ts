import type { EsaDisplayRanges, EsaTrafficRangeKey } from './api'

export interface EsaTrafficRangeDefinition {
  key: EsaTrafficRangeKey
  label: string
  durationMs: number
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export const ESA_TRAFFIC_RANGES: EsaTrafficRangeDefinition[] = [
  { key: 'last24h', label: '过去 24 小时', durationMs: DAY },
  { key: 'last7d', label: '过去 7 天', durationMs: 7 * DAY },
  { key: 'last30d', label: '过去 30 天', durationMs: 30 * DAY }
]

export const DEFAULT_ESA_DISPLAY_RANGES: EsaDisplayRanges = {
  last24h: true,
  last7d: true,
  last30d: true
}

export function selectedEsaRangeKeys(display: EsaDisplayRanges): EsaTrafficRangeKey[] {
  return ESA_TRAFFIC_RANGES.filter((range) => display[range.key]).map((range) => range.key)
}

export function hasEsaRange(display: EsaDisplayRanges): boolean {
  return display.last24h || display.last7d || display.last30d
}
