import type { ModuleId } from '../../../../shared/api'

export type SettingsTab =
  'general' | 'modules' | 'memo' | 'reminder' | 'websites' | 'gmail' | 'deepseek' | 'esa'

export const CORE_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'general', label: '常规' },
  { id: 'modules', label: '功能' }
]

export const MODULE_TAB_BY_ID: Record<ModuleId, SettingsTab> = {
  memo: 'memo',
  'interval-reminder': 'reminder',
  gmail: 'gmail',
  deepseek: 'deepseek',
  esa: 'esa',
  'website-check': 'websites'
}

export const BUBBLE_SECONDS_MIN = 1
export const BUBBLE_SECONDS_MAX = 10
export const PET_SCALE_MIN = 0.5
export const PET_SCALE_MAX = 2
export const PET_SCALE_STEP = 0.1
export const TIMEOUT_OPTIONS = [3000, 5000, 8000, 15000, 30000]
export const POLLING_OPTIONS = [null, 5, 10, 15, 30]
