import type { DateCategory, ModuleId } from '../../../../shared/api'

export type SettingsTab =
  'general' | 'modules' | 'dates' | 'websites' | 'gmail' | 'deepseek' | 'esa'

export const CORE_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'general', label: '常规' },
  { id: 'modules', label: '功能' }
]

export const MODULE_TAB_BY_ID: Record<ModuleId, SettingsTab> = {
  dates: 'dates',
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

export const CATEGORY_OPTIONS: Array<{ value: DateCategory; label: string }> = [
  { value: 'birthday', label: '生日' },
  { value: 'anniversary', label: '纪念日' },
  { value: 'overtime', label: '加班' },
  { value: 'custom', label: '自定义' }
]
