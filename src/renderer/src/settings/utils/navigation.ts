import type { ModuleId, SystemNavigation, SystemSettingsSection } from '../../../../shared/api'

export type SettingsSection = 'general' | 'modules' | 'memo' | 'deepseek' | 'esa'

export interface SystemState {
  tab: 'function' | 'settings' | 'about'
  moduleId: ModuleId
  settingsSection: SettingsSection
}

export const DEFAULT_SYSTEM_STATE: SystemState = {
  tab: 'settings',
  moduleId: 'memo',
  settingsSection: 'general'
}

export function applySystemNavigation(
  state: SystemState,
  navigation: SystemNavigation,
  enabledModuleIds: readonly ModuleId[]
): SystemState {
  const next: SystemState = { ...state, tab: navigation.tab }

  if (navigation.moduleId && enabledModuleIds.includes(navigation.moduleId)) {
    next.moduleId = navigation.moduleId
  }
  if (navigation.settingsSection) {
    next.settingsSection = normalizeSettingsSection(navigation.settingsSection, enabledModuleIds)
  }
  if (!enabledModuleIds.includes(next.moduleId) && enabledModuleIds.length > 0) {
    next.moduleId = enabledModuleIds[0] as ModuleId
  }
  return next
}

function normalizeSettingsSection(
  section: SystemSettingsSection,
  enabledModuleIds: readonly ModuleId[]
): SettingsSection {
  if (section === 'general' || section === 'modules') {
    return section
  }
  if (section === 'memo' || section === 'deepseek' || section === 'esa') {
    return enabledModuleIds.includes(section) ? section : 'general'
  }
  return 'general'
}
