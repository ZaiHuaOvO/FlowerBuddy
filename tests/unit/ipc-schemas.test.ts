import { describe, expect, it } from 'vitest'
import {
  appSettingsPatchSchema,
  bubbleDismissInputSchema,
  deepSeekKeyInputSchema,
  esaCredentialsInputSchema,
  esaDisplayRangesSchema,
  externalLinkSchema,
  menuActionSchema,
  moduleEnabledInputSchema,
  memoCardResizeInputSchema,
  memoCardIgnoreMouseInputSchema,
  memoImageBytesSchema,
  memoInputSchema,
  memoLineCompletedInputSchema,
  memoLineTasksEnabledInputSchema,
  memoLockedInputSchema,
  memoPatchSchema,
  moduleIdSchema,
  intervalReminderInputSchema,
  intervalReminderUpdateInputSchema,
  parseAppSettingsPatch,
  parseInput,
  parseModuleId,
  parsePetSettingsPatch,
  petAssetSelectionSchema,
  petImageIdSchema,
  petRenameInputSchema,
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
    expect(parseAppSettingsPatch({ moduleOrder: ['memo', 'esa'] })).toEqual({
      moduleOrder: ['memo', 'esa']
    })
    expect(parseAppSettingsPatch({ bubbleDurationMs: 1000 })).toEqual({ bubbleDurationMs: 1000 })
    expect(parseAppSettingsPatch({ bubbleSize: 'super' })).toEqual({ bubbleSize: 'super' })
    expect(parsePetSettingsPatch({ scale: 1.5 })).toEqual({ scale: 1.5 })
    expect(parseAppSettingsPatch({ bossShortcut: 'Alt+Z' })).toEqual({
      bossShortcut: 'Alt+Z'
    })
    expect(parseAppSettingsPatch({ bossShortcut: '' })).toEqual({ bossShortcut: '' })
  })

  it('rejects invalid ranges and unknown keys', () => {
    expect(() => parseAppSettingsPatch({ bubbleDurationMs: 10 })).toThrow(AppError)
    expect(() => parseAppSettingsPatch({ bubbleSize: 'huge' })).toThrow(AppError)
    expect(() => parseAppSettingsPatch({ alwaysOnTop: 'yes' })).toThrow(AppError)
    expect(() => parseAppSettingsPatch({ moduleOrder: ['unknown'] })).toThrow(AppError)
    expect(() => parseAppSettingsPatch({ unexpected: true })).toThrow(AppError)
    expect(() => parsePetSettingsPatch({ scale: 3 })).toThrow(AppError)
    expect(() => parsePetSettingsPatch({ assetId: '../x' })).toThrow(AppError)
    expect(() => parseAppSettingsPatch({ bossShortcut: 'x'.repeat(65) })).toThrow(AppError)
  })

  it('accepts only known external links', () => {
    expect(parseInput(externalLinkSchema, { link: 'author' })).toEqual({ link: 'author' })
    expect(parseInput(externalLinkSchema, { link: 'issues' })).toEqual({ link: 'issues' })
    expect(() => parseInput(externalLinkSchema, { link: 'https://example.com' })).toThrow(AppError)
    expect(() => parseInput(externalLinkSchema, { link: 'author', extra: true })).toThrow(AppError)
  })

  it('validates memo lock and card mouse-through inputs', () => {
    const id = '3f1c2a56-8b9d-4a1e-9f0c-123456789abc'
    expect(parseInput(memoLockedInputSchema, { id, locked: true })).toEqual({
      id,
      locked: true
    })
    expect(parseInput(memoCardIgnoreMouseInputSchema, { id, ignore: false })).toEqual({
      id,
      ignore: false
    })
    expect(() => parseInput(memoLockedInputSchema, { id, locked: 'yes' })).toThrow(AppError)
    expect(() => parseInput(memoCardIgnoreMouseInputSchema, { id, ignore: 1 })).toThrow(AppError)
  })

  it('validates line-task completion and the global switch', () => {
    const id = '3f1c2a56-8b9d-4a1e-9f0c-123456789abc'
    const lineId = '11111111-1111-4111-8111-111111111111'
    expect(parseInput(memoLineCompletedInputSchema, { id, lineId, completed: true })).toEqual({
      id,
      lineId,
      completed: true
    })
    expect(parseInput(memoLineTasksEnabledInputSchema, { enabled: true })).toEqual({
      enabled: true
    })
    expect(() =>
      parseInput(memoLineCompletedInputSchema, { id, lineId: 'x', completed: true })
    ).toThrow(AppError)
    expect(() => parseInput(memoLineTasksEnabledInputSchema, { enabled: 'yes' })).toThrow(AppError)
  })

  it('validates pet asset selections and image deletion ids', () => {
    const imageId = '3f1c2a56-8b9d-4a1e-9f0c-123456789abc'

    expect(parseInput(petAssetSelectionSchema, { assetId: 'preset-cat-pair' })).toEqual({
      assetId: 'preset-cat-pair'
    })
    expect(parseInput(petAssetSelectionSchema, { assetId: imageId })).toEqual({
      assetId: imageId
    })
    expect(() => parseInput(petAssetSelectionSchema, { assetId: 'preset-missing' })).toThrow(
      AppError
    )
    expect(() => parseInput(petAssetSelectionSchema, { assetId: '../x' })).toThrow(AppError)
    expect(() => parseInput(petAssetSelectionSchema, { assetId: 'default', extra: true })).toThrow(
      AppError
    )

    expect(parseInput(petImageIdSchema, { assetId: imageId })).toEqual({ assetId: imageId })
    expect(() => parseInput(petImageIdSchema, { assetId: 'default' })).toThrow(AppError)
  })

  it('validates pet image rename payloads', () => {
    const imageId = '3f1c2a56-8b9d-4a1e-9f0c-123456789abc'

    expect(parseInput(petRenameInputSchema, { assetId: imageId, name: '  小棕  ' })).toEqual({
      assetId: imageId,
      name: '小棕'
    })
    expect(parseInput(petRenameInputSchema, { assetId: imageId, name: '' })).toEqual({
      assetId: imageId,
      name: ''
    })
    expect(() => parseInput(petRenameInputSchema, { assetId: 'default', name: '小棕' })).toThrow(
      AppError
    )
    expect(() =>
      parseInput(petRenameInputSchema, { assetId: imageId, name: 'x'.repeat(21) })
    ).toThrow(AppError)
  })

  it('validates bubble dismiss ids', () => {
    const reminderId = '3f1c2a56-8b9d-4a1e-9f0c-123456789abc'
    expect(parseInput(bubbleDismissInputSchema, { id: reminderId })).toEqual({ id: reminderId })
    expect(parseInput(bubbleDismissInputSchema, { id: `interval-reminder:${reminderId}` })).toEqual(
      { id: `interval-reminder:${reminderId}` }
    )
    expect(() => parseInput(bubbleDismissInputSchema, { id: '../secret' })).toThrow(AppError)
    expect(() => parseInput(bubbleDismissInputSchema, { id: '' })).toThrow(AppError)
  })

  it('accepts only known module ids', () => {
    expect(parseModuleId('esa')).toBe('esa')
    expect(parseModuleId('website-check')).toBe('website-check')
    expect(() => parseModuleId('unknown')).toThrow(AppError)
    expect(() => parseModuleId(42)).toThrow(AppError)
  })

  it('validates module toggle payloads', () => {
    const input = parseInput(moduleEnabledInputSchema, {
      moduleId: 'memo',
      enabled: false
    })
    expect(input).toEqual({ moduleId: 'memo', enabled: false })

    expect(() => parseInput(moduleEnabledInputSchema, { moduleId: 'nope', enabled: true })).toThrow(
      AppError
    )
    expect(() =>
      parseInput(moduleEnabledInputSchema, { moduleId: 'memo', enabled: 'yes' })
    ).toThrow(AppError)
    expect(() =>
      parseInput(moduleEnabledInputSchema, { moduleId: 'memo', enabled: true, x: 1 })
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
    expect(moduleIdSchema.options).toContain('interval-reminder')
    expect(petSettingsPatchSchema.parse({ scale: 0.5 })).toEqual({ scale: 0.5 })
  })

  it('validates memo inputs and image payloads', () => {
    const input = parseInput(memoInputSchema, {
      text: '买牛奶',
      images: [{ id: '9f1c1c34-7d0c-4a18-9a94-7d1c5d2a3b11', width: 320, height: 200 }],
      reminderAt: '2026-10-20T07:30:00.000Z'
    })
    expect(input.text).toBe('买牛奶')
    expect(input.images).toHaveLength(1)

    expect(() =>
      parseInput(memoInputSchema, { text: '', images: [], reminderAt: null })
    ).not.toThrow()
    expect(() =>
      parseInput(memoInputSchema, { text: 'x', images: [], reminderAt: 'not-a-date' })
    ).toThrow(AppError)
    expect(() =>
      parseInput(memoInputSchema, {
        text: 'x',
        images: [{ id: 'not-a-uuid', width: 1, height: 1 }],
        reminderAt: null
      })
    ).toThrow(AppError)
    expect(() =>
      parseInput(memoInputSchema, { text: 'x', images: [], reminderAt: null, extra: true })
    ).toThrow(AppError)
    expect(parseInput(memoPatchSchema, { text: 'updated' })).toEqual({ text: 'updated' })
    expect(
      parseInput(memoCardResizeInputSchema, {
        id: '9f1c1c34-7d0c-4a18-9a94-7d1c5d2a3b11',
        edge: 'se'
      })
    ).toMatchObject({ edge: 'se' })
    expect(() =>
      parseInput(memoCardResizeInputSchema, {
        id: '9f1c1c34-7d0c-4a18-9a94-7d1c5d2a3b11',
        edge: 'center'
      })
    ).toThrow(AppError)
    expect(parseInput(memoImageBytesSchema, { data: new ArrayBuffer(2) })).toBeTruthy()
  })

  it('validates interval reminder inputs', () => {
    const input = parseInput(intervalReminderInputSchema, {
      name: '喝水',
      text: '该喝水啦！',
      enabled: true,
      intervalMinutes: 30,
      ranges: [{ start: '09:00', end: '12:00' }],
      randomEnabled: true,
      randomJitterMinutes: 5
    })
    expect(input).toMatchObject({ name: '喝水', intervalMinutes: 30 })
    expect(
      parseInput(intervalReminderUpdateInputSchema, {
        id: '9f1c1c34-7d0c-4a18-9a94-7d1c5d2a3b11',
        patch: { intervalMinutes: 60, ranges: [] }
      })
    ).toMatchObject({ patch: { intervalMinutes: 60 } })

    expect(() =>
      parseInput(intervalReminderInputSchema, {
        name: 'x',
        text: 'y',
        intervalMinutes: 0,
        ranges: [],
        randomEnabled: false,
        randomJitterMinutes: 0
      })
    ).toThrow(AppError)
    expect(() =>
      parseInput(intervalReminderInputSchema, {
        name: 'x',
        text: 'y',
        intervalMinutes: 30,
        ranges: [{ start: '09:00', end: '09:00' }],
        randomEnabled: false,
        randomJitterMinutes: 0
      })
    ).toThrow(AppError)
    expect(() =>
      parseInput(intervalReminderInputSchema, {
        name: 'x',
        text: 'y',
        intervalMinutes: 30,
        ranges: [{ start: '25:00', end: '26:00' }],
        randomEnabled: false,
        randomJitterMinutes: 0
      })
    ).toThrow(AppError)
    expect(() =>
      parseInput(intervalReminderInputSchema, {
        name: 'x',
        text: 'y',
        intervalMinutes: 30,
        ranges: [],
        randomEnabled: true,
        randomJitterMinutes: 121
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
    expect(parseInput(menuActionSchema, 'memo:open')).toBe('memo:open')
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

  it('validates ESA display range selections', () => {
    expect(
      parseInput(esaDisplayRangesSchema, { last24h: true, last7d: false, last30d: true })
    ).toEqual({ last24h: true, last7d: false, last30d: true })
    expect(() =>
      parseInput(esaDisplayRangesSchema, { last24h: false, last7d: false, last30d: false })
    ).toThrow(AppError)
    expect(() => parseInput(esaDisplayRangesSchema, { last24h: true })).toThrow(AppError)
  })

  it('validates refresh interval inputs', () => {
    expect(parseInput(refreshIntervalInputSchema, { moduleId: 'deepseek', minutes: null })).toEqual(
      { moduleId: 'deepseek', minutes: null }
    )
    expect(parseInput(refreshIntervalInputSchema, { moduleId: 'esa', minutes: 15 })).toEqual({
      moduleId: 'esa',
      minutes: 15
    })

    expect(() => parseInput(refreshIntervalInputSchema, { moduleId: 'memo', minutes: 15 })).toThrow(
      AppError
    )
    expect(() => parseInput(refreshIntervalInputSchema, { moduleId: 'esa', minutes: 1 })).toThrow(
      AppError
    )
    expect(() => parseInput(refreshIntervalInputSchema, { moduleId: 'esa', minutes: 61 })).toThrow(
      AppError
    )
  })

  it('accepts startup options and shortcut patches', () => {
    expect(parseAppSettingsPatch({ launchAtLogin: true, showPetOnStartup: false })).toEqual({
      launchAtLogin: true,
      showPetOnStartup: false
    })
    expect(parseAppSettingsPatch({ memoShortcut: 'Alt+Shift+M' })).toEqual({
      memoShortcut: 'Alt+Shift+M'
    })
    expect(parseAppSettingsPatch({ memoShortcut: '' })).toEqual({ memoShortcut: '' })
  })
})
