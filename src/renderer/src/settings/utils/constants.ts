import type { DateCategory } from '../../../../shared/api'

export type SettingsTab =
  'general' | 'modules' | 'dates' | 'websites' | 'gmail' | 'deepseek' | 'esa' | 'appearance'

export const BUBBLE_DURATION_OPTIONS = [3000, 5000, 8000]
export const SCALE_MIN = 0.5
export const SCALE_MAX = 2
export const SCALE_STEP = 0.1
export const TIMEOUT_OPTIONS = [3000, 5000, 8000, 15000, 30000]
export const POLLING_OPTIONS = [null, 5, 10, 15, 30]

export const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'general', label: '常规' },
  { id: 'modules', label: '功能' },
  { id: 'dates', label: '日期' },
  { id: 'websites', label: '网站' },
  { id: 'gmail', label: 'Gmail' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'esa', label: 'ESA' },
  { id: 'appearance', label: '外观' }
]

export const CATEGORY_OPTIONS: Array<{ value: DateCategory; label: string }> = [
  { value: 'birthday', label: '生日' },
  { value: 'anniversary', label: '纪念日' },
  { value: 'overtime', label: '加班' },
  { value: 'custom', label: '自定义' }
]
