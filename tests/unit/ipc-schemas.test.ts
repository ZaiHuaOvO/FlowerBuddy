import { describe, expect, it } from 'vitest'
import {
  appSettingsPatchSchema,
  dateEventInputSchema,
  deepSeekKeyInputSchema,
  esaCredentialsInputSchema,
  gmailClientInputSchema,
  gmailSettingsPatchSchema,
  menuActionSchema,
  moduleEnabledInputSchema,
  moduleIdSchema,
  parseAppSettingsPatch,
  parseInput,
  parseModuleId,
  parsePetSettingsPatch,
  petSettingsPatchSchema,
  refreshIntervalInputSchema,
  websiteInputSchema,
  websitePatchSchema
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

  it('validates date event inputs', () => {
    const input = parseInput(dateEventInputSchema, {
      title: '结婚纪念日',
      date: '2026-10-17',
      recurrence: 'yearly',
      category: 'anniversary'
    })
    expect(input).toMatchObject({ title: '结婚纪念日', recurrence: 'yearly' })

    expect(() =>
      parseInput(dateEventInputSchema, {
        title: 'x',
        date: '2026-02-30',
        recurrence: 'none',
        category: 'custom'
      })
    ).toThrow(AppError)
    expect(() =>
      parseInput(dateEventInputSchema, {
        title: '',
        date: '2026-10-17',
        recurrence: 'none',
        category: 'custom'
      })
    ).toThrow(AppError)
    expect(() =>
      parseInput(dateEventInputSchema, {
        title: 'x',
        date: '2026-10-17',
        recurrence: 'monthly',
        category: 'custom'
      })
    ).toThrow(AppError)
  })

  it('validates website inputs', () => {
    const input = parseInput(websiteInputSchema, {
      name: '站点',
      url: 'https://example.com',
      timeoutMs: 8000,
      pollingIntervalMinutes: 10
    })
    expect(input).toMatchObject({ url: 'https://example.com', timeoutMs: 8000 })

    expect(() =>
      parseInput(websiteInputSchema, {
        name: '站点',
        url: 'ftp://example.com',
        timeoutMs: 8000,
        pollingIntervalMinutes: null
      })
    ).toThrow(AppError)
    expect(() =>
      parseInput(websiteInputSchema, {
        name: '站点',
        url: 'https://example.com',
        timeoutMs: 1000,
        pollingIntervalMinutes: null
      })
    ).toThrow(AppError)
    expect(() => parseInput(websitePatchSchema, { pollingIntervalMinutes: 90 })).toThrow(AppError)
  })

  it('accepts registry action ids and rejects malformed ones', () => {
    expect(parseInput(menuActionSchema, 'dates:upcoming')).toBe('dates:upcoming')
    expect(parseInput(menuActionSchema, 'website-check:run-all')).toBe('website-check:run-all')
    expect(() => parseInput(menuActionSchema, 'demo')).toThrow(AppError)
    expect(() => parseInput(menuActionSchema, 'Dates Upcoming')).toThrow(AppError)
  })

  it('validates DeepSeek key input', () => {
    expect(parseInput(deepSeekKeyInputSchema, { apiKey: '  sk-abc  ' })).toEqual({
      apiKey: 'sk-abc'
    })
    expect(() => parseInput(deepSeekKeyInputSchema, { apiKey: '' })).toThrow(AppError)
    expect(() => parseInput(deepSeekKeyInputSchema, { apiKey: 'x'.repeat(513) })).toThrow(AppError)
    expect(() => parseInput(deepSeekKeyInputSchema, { apiKey: 'sk-abc', extra: true })).toThrow(
      AppError
    )
  })

  it('validates ESA credentials input', () => {
    expect(
      parseInput(esaCredentialsInputSchema, {
        accessKeyId: 'id',
        accessKeySecret: 'secret',
        siteId: 'site-1'
      })
    ).toEqual({ accessKeyId: 'id', accessKeySecret: 'secret', siteId: 'site-1' })

    expect(() =>
      parseInput(esaCredentialsInputSchema, {
        accessKeyId: 'id',
        accessKeySecret: 'secret',
        siteId: ''
      })
    ).toThrow(AppError)
    expect(() =>
      parseInput(esaCredentialsInputSchema, {
        accessKeyId: 'id',
        accessKeySecret: 'secret'
      })
    ).toThrow(AppError)
  })

  it('validates refresh interval inputs', () => {
    expect(parseInput(refreshIntervalInputSchema, { moduleId: 'deepseek', minutes: null })).toEqual(
      { moduleId: 'deepseek', minutes: null }
    )
    expect(parseInput(refreshIntervalInputSchema, { moduleId: 'esa', minutes: 15 })).toEqual({
      moduleId: 'esa',
      minutes: 15
    })

    expect(() =>
      parseInput(refreshIntervalInputSchema, { moduleId: 'gmail', minutes: 15 })
    ).toThrow(AppError)
    expect(() => parseInput(refreshIntervalInputSchema, { moduleId: 'esa', minutes: 1 })).toThrow(
      AppError
    )
    expect(() => parseInput(refreshIntervalInputSchema, { moduleId: 'esa', minutes: 61 })).toThrow(
      AppError
    )
  })

  it('accepts startup options in app settings patches', () => {
    expect(parseAppSettingsPatch({ launchAtLogin: true, showPetOnStartup: false })).toEqual({
      launchAtLogin: true,
      showPetOnStartup: false
    })
  })

  it('validates Gmail client and notification settings', () => {
    expect(
      parseInput(gmailClientInputSchema, {
        clientId: 'client-id',
        clientSecret: 'client-secret'
      })
    ).toEqual({ clientId: 'client-id', clientSecret: 'client-secret' })
    expect(() => parseInput(gmailClientInputSchema, { clientId: '', clientSecret: 'x' })).toThrow(
      AppError
    )
    expect(() => parseInput(gmailClientInputSchema, { clientId: 'x' })).toThrow(AppError)

    expect(
      parseInput(gmailSettingsPatchSchema, {
        pollIntervalMinutes: 5,
        notifyNewMail: false,
        hideSubject: true
      })
    ).toEqual({
      pollIntervalMinutes: 5,
      notifyNewMail: false,
      hideSubject: true
    })
    expect(() => parseInput(gmailSettingsPatchSchema, { pollIntervalMinutes: 0 })).toThrow(AppError)
    expect(() => parseInput(gmailSettingsPatchSchema, { pollIntervalMinutes: 16 })).toThrow(
      AppError
    )
  })
})
