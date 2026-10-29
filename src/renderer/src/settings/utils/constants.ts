import type { BubbleSize, ModuleId } from '../../../../shared/api'

export type SystemTab = 'function' | 'settings' | 'about'

export type SettingsSection = 'general' | 'modules' | 'memo' | 'deepseek' | 'esa'

export const BUBBLE_SIZE_OPTIONS: Array<{ id: BubbleSize; label: string }> = [
  { id: 'small', label: '小' },
  { id: 'medium', label: '中' },
  { id: 'large', label: '大' },
  { id: 'super', label: '超级' }
]

export const SYSTEM_TABS: Array<{ id: SystemTab; label: string }> = [
  { id: 'function', label: '功能' },
  { id: 'settings', label: '设置' },
  { id: 'about', label: '关于' }
]

export const CORE_TABS: Array<{ id: 'general' | 'modules'; label: string }> = [
  { id: 'general', label: '常规' },
  { id: 'modules', label: '功能管理' }
]

export const SETTINGS_MODULE_IDS: ModuleId[] = ['memo', 'deepseek', 'esa']

export const BUBBLE_SECONDS_MIN = 1
export const BUBBLE_SECONDS_MAX = 10
export const PET_SCALE_MIN = 0.5
export const PET_SCALE_MAX = 2
export const PET_SCALE_STEP = 0.1
export const TIMEOUT_OPTIONS = [3000, 5000, 8000, 15000, 30000]
export const POLLING_OPTIONS = [null, 5, 10, 15, 30]
