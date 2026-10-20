import { describe, expect, it } from 'vitest'
import {
  applySystemNavigation,
  DEFAULT_SYSTEM_STATE
} from '../../src/renderer/src/settings/utils/navigation'

const enabled = ['memo', 'deepseek'] as const

describe('system navigation', () => {
  it('opens a function module', () => {
    const next = applySystemNavigation(
      DEFAULT_SYSTEM_STATE,
      { tab: 'function', moduleId: 'deepseek' },
      enabled
    )
    expect(next.tab).toBe('function')
    expect(next.moduleId).toBe('deepseek')
  })

  it('opens a settings section', () => {
    const next = applySystemNavigation(
      DEFAULT_SYSTEM_STATE,
      { tab: 'settings', settingsSection: 'deepseek' },
      enabled
    )
    expect(next.tab).toBe('settings')
    expect(next.settingsSection).toBe('deepseek')
  })

  it('falls back when the requested module is disabled', () => {
    const functionState = applySystemNavigation(
      DEFAULT_SYSTEM_STATE,
      { tab: 'function', moduleId: 'esa' },
      enabled
    )
    expect(functionState.moduleId).toBe('memo')

    const settingsState = applySystemNavigation(
      DEFAULT_SYSTEM_STATE,
      { tab: 'settings', settingsSection: 'esa' },
      enabled
    )
    expect(settingsState.settingsSection).toBe('general')
  })
})
