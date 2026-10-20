import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ConfigStore,
  CURRENT_CONFIG_SCHEMA_VERSION,
  createDefaultConfig
} from '../../src/main/storage/config-store'
import { migrateConfig, parseConfig } from '../../src/main/storage/config-schema'

const temporaryDirectories: string[] = []

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'flowerbuddy-config-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

const V1_CONFIG = {
  schemaVersion: 1,
  app: { alwaysOnTop: false, bounceAnimation: false, bubbleDurationMs: 8000 },
  pet: { assetId: 'default', scale: 1.5, position: { x: 10, y: 20 } }
}

describe('config schema', () => {
  it('creates current-version defaults with startup options', () => {
    const config = createDefaultConfig()

    expect(config.schemaVersion).toBe(CURRENT_CONFIG_SCHEMA_VERSION)
    expect(config.pet.names).toEqual({})
    expect(config.app.launchAtLogin).toBe(false)
    expect(config.app.showPetOnStartup).toBe(true)
    expect(config.app.memoShortcut).toBe('Alt+A')
    expect(config.app.bossShortcut).toBe('Alt+Z')
    expect(config.modules.memo.enabled).toBe(true)
    expect(config.modules.memo.anchorNewMemos).toBe(false)
    expect(config.modules.memo.lineTasksEnabled).toBe(false)
    expect(config.modules.intervalReminder.enabled).toBe(true)
    expect(config.modules.deepseek.refreshIntervalMinutes).toBeNull()
    expect(config.modules.esa.refreshIntervalMinutes).toBeNull()
    expect(config.modules.esa.displayRanges).toEqual({
      last24h: true,
      last7d: true,
      last30d: true
    })
    expect(config.modules.websiteCheck.enabled).toBe(false)
    expect(config.modules.websiteCheck.defaultTimeoutMs).toBe(8000)
    expect(config.app.moduleOrder).toEqual(['memo', 'interval-reminder'])
  })

  it('repairs invalid values instead of rejecting the file', () => {
    const config = parseConfig({
      schemaVersion: 3,
      app: { alwaysOnTop: 'yes', bounceAnimation: false, bubbleDurationMs: 999999 },
      pet: {
        assetId: '../escape',
        scale: 42,
        position: { x: 'left', y: 2 },
        names: {
          '3f1c2a56-8b9d-4a1e-9f0c-123456789abc': '  小棕  ',
          'not-a-uuid': '无效',
          '9a8b7c6d-5e4f-4321-8765-123456789abc': 42
        }
      },
      modules: {
        esa: { siteId: 42, refreshIntervalMinutes: 999 },
        deepseek: { refreshIntervalMinutes: 'often' }
      },
      secrets: { apiKey: 'must-not-survive' }
    })

    expect(config.app.alwaysOnTop).toBe(true)
    expect(config.app.bounceAnimation).toBe(false)
    expect(config.app.bubbleDurationMs).toBe(30000)
    expect(config.pet.assetId).toBe('default')
    expect(config.pet.scale).toBe(2)
    expect(config.pet.position).toBeNull()
    expect(config.pet.names).toEqual({
      '3f1c2a56-8b9d-4a1e-9f0c-123456789abc': '小棕'
    })
    expect(config.modules.esa.siteId).toBe('')
    expect(config.modules.esa.refreshIntervalMinutes).toBe(60)
    expect(config.modules.deepseek.refreshIntervalMinutes).toBeNull()
    expect(config.app.moduleOrder).toEqual(['memo', 'interval-reminder'])
    expect(config).not.toHaveProperty('secrets')
  })

  it('migrates version 1 files by adding module defaults', () => {
    const result = migrateConfig(V1_CONFIG)

    expect(result.fromVersion).toBe(1)
    expect(result.migrated).toBe(true)
    expect(result.futureVersion).toBe(false)
    expect(result.config.schemaVersion).toBe(CURRENT_CONFIG_SCHEMA_VERSION)
    expect(result.config.app.alwaysOnTop).toBe(false)
    expect(result.config.pet.scale).toBe(1.5)
    expect(result.config.modules.memo.enabled).toBe(true)
    expect(result.config.modules.deepseek.refreshIntervalMinutes).toBeNull()
    expect(result.config.app.moduleOrder).toEqual(['memo', 'interval-reminder'])
  })

  it('migrates version 2 files by adding refresh intervals', () => {
    const result = migrateConfig({
      schemaVersion: 2,
      app: { alwaysOnTop: true, bounceAnimation: true, bubbleDurationMs: 5000 },
      pet: { assetId: 'default', scale: 1, position: null },
      modules: {
        dates: { enabled: true },
        esa: { enabled: true, siteId: 'site-1' },
        deepseek: { enabled: true },
        websiteCheck: { enabled: true, defaultTimeoutMs: 8000 }
      }
    })

    expect(result.fromVersion).toBe(2)
    expect(result.migrated).toBe(true)
    expect(result.config.schemaVersion).toBe(CURRENT_CONFIG_SCHEMA_VERSION)
    expect(result.config.modules.esa.siteId).toBe('site-1')
    expect(result.config.modules.esa.refreshIntervalMinutes).toBeNull()
    expect(result.config.modules.deepseek.refreshIntervalMinutes).toBeNull()
  })

  it('migrates v10 configs with the line-task switch disabled', () => {
    const result = migrateConfig({
      schemaVersion: 10,
      modules: { memo: { enabled: true, anchorNewMemos: true } }
    })
    expect(result.fromVersion).toBe(10)
    expect(result.migrated).toBe(true)
    expect(result.config.schemaVersion).toBe(11)
    expect(result.config.modules.memo.lineTasksEnabled).toBe(false)
    expect(result.config.modules.memo.anchorNewMemos).toBe(true)
  })

  it('migrates the dates module and resets the initial module selection for v8', () => {
    const result = migrateConfig({
      schemaVersion: 7,
      app: { moduleOrder: ['memo', 'website-check'] },
      modules: {
        memo: { enabled: false, anchorNewMemos: true },
        websiteCheck: { enabled: true, defaultTimeoutMs: 12000 }
      }
    })
    expect(result.fromVersion).toBe(7)
    expect(result.migrated).toBe(true)
    expect(result.config.modules.memo.enabled).toBe(true)
    expect(result.config.modules.memo.anchorNewMemos).toBe(true)
    expect(result.config.modules.intervalReminder.enabled).toBe(true)
    expect(result.config.modules.websiteCheck.enabled).toBe(false)
    expect(result.config.modules.websiteCheck.defaultTimeoutMs).toBe(12000)
    expect(result.config.app.moduleOrder).toEqual(['memo', 'interval-reminder'])

    const legacy = migrateConfig({
      schemaVersion: 5,
      app: { moduleOrder: ['dates', 'website-check'] },
      modules: { dates: { enabled: true } }
    })
    expect(legacy.config.modules.memo.enabled).toBe(true)
    expect(legacy.config).not.toHaveProperty('modules.dates')
  })

  it('removes the Gmail module and its order entry for v9', () => {
    const result = migrateConfig({
      schemaVersion: 8,
      app: { moduleOrder: ['memo', 'gmail', 'interval-reminder', 'esa', 'deepseek'] },
      modules: {
        gmail: { enabled: true, pollIntervalMinutes: 5, notifyNewMail: false, hideSubject: false },
        esa: { enabled: true, siteId: 'site-1' },
        deepseek: { enabled: true }
      }
    })

    expect(result.fromVersion).toBe(8)
    expect(result.migrated).toBe(true)
    expect(result.config.schemaVersion).toBe(CURRENT_CONFIG_SCHEMA_VERSION)
    expect(result.config.modules).not.toHaveProperty('gmail')
    expect(result.config.app.moduleOrder).toEqual(['memo', 'interval-reminder', 'esa', 'deepseek'])
  })

  it('flags newer schema versions instead of silently overwriting them', () => {
    const result = migrateConfig({ schemaVersion: 99 })

    expect(result.futureVersion).toBe(true)
    expect(result.fromVersion).toBe(99)
    expect(result.config).toEqual(createDefaultConfig())
  })
})

describe('config store', () => {
  it('writes defaults when the file does not exist', () => {
    const directory = createTemporaryDirectory()
    const filePath = join(directory, 'config.json')

    const config = new ConfigStore(filePath).load()

    expect(config).toEqual(createDefaultConfig())
    expect(JSON.parse(readFileSync(filePath, 'utf8'))).toEqual(createDefaultConfig())
  })

  it('migrates a version 1 file on disk and keeps a backup', () => {
    const directory = createTemporaryDirectory()
    const filePath = join(directory, 'config.json')
    writeFileSync(filePath, JSON.stringify(V1_CONFIG), 'utf8')

    const config = new ConfigStore(filePath).load()

    expect(config.schemaVersion).toBe(CURRENT_CONFIG_SCHEMA_VERSION)
    expect(config.app.alwaysOnTop).toBe(false)
    expect(config.pet.scale).toBe(1.5)
    expect(config.modules.memo.enabled).toBe(true)
    expect(readdirSync(directory).some((name) => name.startsWith('config.json.v1-'))).toBe(true)
  })

  it('round-trips app, pet and module changes through disk', () => {
    const directory = createTemporaryDirectory()
    const filePath = join(directory, 'config.json')

    const store = new ConfigStore(filePath)
    store.load()
    store.updateApp({
      alwaysOnTop: false,
      bubbleDurationMs: 8000,
      launchAtLogin: true,
      moduleOrder: ['interval-reminder', 'memo']
    })
    store.updatePet({ scale: 1.5, position: { x: 100, y: 200 } })
    store.setModuleEnabled('deepseek', true)
    store.setMemoAnchorNew(true)
    store.setMemoLineTasks(true)
    store.setModuleRefreshInterval('deepseek', 15)
    store.setEsaSiteId('site-42')
    store.setEsaDisplayRanges({ last24h: true, last7d: false, last30d: true })
    store.flush()

    const reloaded = new ConfigStore(filePath).load()
    expect(reloaded.app.alwaysOnTop).toBe(false)
    expect(reloaded.app.bubbleDurationMs).toBe(8000)
    expect(reloaded.pet.scale).toBe(1.5)
    expect(reloaded.pet.position).toEqual({ x: 100, y: 200 })
    expect(reloaded.modules.memo.enabled).toBe(true)
    expect(reloaded.modules.memo.anchorNewMemos).toBe(true)
    expect(reloaded.modules.memo.lineTasksEnabled).toBe(true)
    expect(reloaded.modules.deepseek.refreshIntervalMinutes).toBe(15)
    expect(reloaded.modules.esa.siteId).toBe('site-42')
    expect(reloaded.modules.esa.displayRanges).toEqual({
      last24h: true,
      last7d: false,
      last30d: true
    })
    expect(reloaded.app.launchAtLogin).toBe(true)
    expect(reloaded.app.moduleOrder).toEqual(['interval-reminder', 'memo', 'deepseek'])
  })

  it('backs up a version 2 file when migrating to the current version', () => {
    const directory = createTemporaryDirectory()
    const filePath = join(directory, 'config.json')
    writeFileSync(
      filePath,
      JSON.stringify({
        schemaVersion: 2,
        app: { alwaysOnTop: true, bounceAnimation: true, bubbleDurationMs: 5000 },
        pet: { assetId: 'default', scale: 1, position: null },
        modules: {
          dates: { enabled: true },
          esa: { enabled: false, siteId: 'kept-site' },
          deepseek: { enabled: false },
          websiteCheck: { enabled: true, defaultTimeoutMs: 8000 }
        }
      }),
      'utf8'
    )

    const config = new ConfigStore(filePath).load()

    expect(config.schemaVersion).toBe(CURRENT_CONFIG_SCHEMA_VERSION)
    expect(config.modules.esa.siteId).toBe('kept-site')
    expect(config.modules.deepseek.refreshIntervalMinutes).toBeNull()
    expect(readdirSync(directory).some((name) => name.startsWith('config.json.v2-'))).toBe(true)
  })

  it('migrates version 3 files by adding startup options', () => {
    const directory = createTemporaryDirectory()
    const filePath = join(directory, 'config.json')
    writeFileSync(
      filePath,
      JSON.stringify({
        schemaVersion: 3,
        app: { alwaysOnTop: true, bounceAnimation: true, bubbleDurationMs: 5000 },
        pet: { assetId: 'default', scale: 1, position: null },
        modules: {
          dates: { enabled: true },
          esa: { enabled: false, siteId: '', refreshIntervalMinutes: null },
          deepseek: { enabled: false, refreshIntervalMinutes: null },
          websiteCheck: { enabled: true, defaultTimeoutMs: 8000 }
        }
      }),
      'utf8'
    )

    const config = new ConfigStore(filePath).load()

    expect(config.schemaVersion).toBe(CURRENT_CONFIG_SCHEMA_VERSION)
    expect(config.app.launchAtLogin).toBe(false)
    expect(config.app.showPetOnStartup).toBe(true)
    expect(readdirSync(directory).some((name) => name.startsWith('config.json.v3-'))).toBe(true)
  })

  it('leaves no temporary file behind after an atomic write', () => {
    const directory = createTemporaryDirectory()
    const store = new ConfigStore(join(directory, 'config.json'))
    store.load()
    store.updateApp({ bounceAnimation: false })
    store.flush()

    expect(readdirSync(directory)).toEqual(['config.json'])
  })

  it('backs up corrupt JSON and restores defaults', () => {
    const directory = createTemporaryDirectory()
    const filePath = join(directory, 'config.json')
    writeFileSync(filePath, '{ not valid json', 'utf8')

    const config = new ConfigStore(filePath).load()

    expect(config).toEqual(createDefaultConfig())
    expect(readdirSync(directory).some((name) => name.includes('.corrupt-'))).toBe(true)
    expect(existsSync(filePath)).toBe(true)
  })

  it('exposes a recovery notice after repairing a corrupt file', () => {
    const directory = createTemporaryDirectory()
    const filePath = join(directory, 'config.json')
    writeFileSync(filePath, '{ broken', 'utf8')

    const store = new ConfigStore(filePath)
    store.load()

    expect(store.getRecoveryNotice()).toContain('配置文件无法读取')
  })

  it('backs up a future version and resets to defaults', () => {
    const directory = createTemporaryDirectory()
    const filePath = join(directory, 'config.json')
    writeFileSync(filePath, JSON.stringify({ schemaVersion: 99, app: {} }), 'utf8')

    const store = new ConfigStore(filePath)
    const config = store.load()

    expect(config).toEqual(createDefaultConfig())
    expect(readdirSync(directory).some((name) => name.includes('.future-v99-'))).toBe(true)
    expect(store.getRecoveryNotice()).toContain('更高版本')
  })

  it('rejects an empty ESA display range selection', () => {
    const directory = createTemporaryDirectory()
    const store = new ConfigStore(join(directory, 'config.json'))
    store.load()
    expect(() =>
      store.setEsaDisplayRanges({ last24h: false, last7d: false, last30d: false })
    ).toThrow()
  })

  it('reads and writes module switches by module id', () => {
    const directory = createTemporaryDirectory()
    const store = new ConfigStore(join(directory, 'config.json'))
    store.load()

    expect(store.get().app.moduleOrder).toEqual(['memo', 'interval-reminder'])
    expect(store.isModuleEnabled('deepseek')).toBe(false)
    store.setModuleEnabled('deepseek', true)
    expect(store.isModuleEnabled('deepseek')).toBe(true)
    expect(store.get().app.moduleOrder).toEqual(['memo', 'interval-reminder', 'deepseek'])
    store.setModuleEnabled('website-check', true)
    expect(store.isModuleEnabled('website-check')).toBe(true)
    expect(store.get().app.moduleOrder).toEqual([
      'memo',
      'interval-reminder',
      'deepseek',
      'website-check'
    ])
    store.setModuleEnabled('website-check', false)
    expect(store.isModuleEnabled('website-check')).toBe(false)
    expect(store.get().app.moduleOrder).toEqual(['memo', 'interval-reminder', 'deepseek'])
    expect(store.isModuleEnabled('memo')).toBe(true)
    expect(store.isModuleEnabled('interval-reminder')).toBe(true)
  })
})
