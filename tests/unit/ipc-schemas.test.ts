import { describe, expect, it } from 'vitest'
import {
  appSettingsPatchSchema,
  moduleEnabledInputSchema,
  moduleIdSchema,
  parseAppSettingsPatch,
  parseInput,
  parseModuleId,
  parsePetSettingsPatch,
  petSettingsPatchSchema
} from '../../src/main/ipc/schemas'
import { AppError } from '../../src/main/shared/errors'

describe('IPC input schemas', () => {
  it('accepts valid settings patches', () => {
    expect(parseAppSettingsPatch({ alwaysOnTop: false })).toEqual({
      alwaysOnTop: false
    })
    expect(parseAppSettingsPatch({ bounceAnimation: true, bubbleDurationMs: 8000 })).toEqual({
      bounceAnimation: true,
      bubbleDurationMs: 8000
    })
    expect(parseAppSettingsPatch({})).toEqual({})
    expect(parsePetSettingsPatch({ scale: 1.5 })).toEqual({ scale: 1.5 })
  })

  it('rejects invalid ranges and unknown keys', () => {
    expect(() => parseAppSettingsPatch({ bubbleDurationMs: 10 })).toThrow(AppError)
    expect(() => parseAppSettingsPatch({ alwaysOnTop: 'yes' })).toThrow(AppError)
    expect(() => parseAppSettingsPatch({ unexpected: true })).toThrow(AppError)
    expect(() => parsePetSettingsPatch({ scale: 3 })).toThrow(AppError)
    expect(() => parsePetSettingsPatch({ assetId: '../x' })).toThrow(AppError)
  })

  it('accepts only known module ids', () => {
    expect(parseModuleId('gmail')).toBe('gmail')
    expect(parseModuleId('website-check')).toBe('website-check')
    expect(() => parseModuleId('unknown')).toThrow(AppError)
    expect(() => parseModuleId(42)).toThrow(AppError)
  })

  it('validates module toggle payloads', () => {
    const input = parseInput(moduleEnabledInputSchema, {
      moduleId: 'dates',
      enabled: false
    })
    expect(input).toEqual({ moduleId: 'dates', enabled: false })

    expect(() => parseInput(moduleEnabledInputSchema, { moduleId: 'nope', enabled: true })).toThrow(
      AppError
    )
    expect(() =>
      parseInput(moduleEnabledInputSchema, { moduleId: 'dates', enabled: 'yes' })
    ).toThrow(AppError)
    expect(() =>
      parseInput(moduleEnabledInputSchema, { moduleId: 'dates', enabled: true, x: 1 })
    ).toThrow(AppError)
  })

  it('exposes the safe error code for invalid input', () => {
    try {
      parseInput(appSettingsPatchSchema, { alwaysOnTop: 'yes' })
      throw new Error('expected validation to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      expect((error as AppError).code).toBe('INVALID_INPUT')
      expect((error as AppError).toPublic()).toEqual({
        code: 'INVALID_INPUT',
        message: '输入参数不合法',
        retryable: false
      })
    }
  })

  it('exports enum schemas used by the handlers', () => {
    expect(moduleIdSchema.options).toContain('deepseek')
    expect(petSettingsPatchSchema.parse({ scale: 0.5 })).toEqual({ scale: 0.5 })
  })
})
