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
  it('creates version 6 defaults with startup and Gmail options', () => {
    const config = createDefaultConfig()

    expect(config.schemaVersion).toBe(6)
    expect(config.app.launchAtLogin).toBe(false)
    expect(config.app.showPetOnStartup).toBe(true)
    expect(config.app.memoShortcut).toBe('Alt+A')
    expect(config.modules.memo.enabled).toBe(true)
    expect(config.modules.gmail.enabled).toBe(false)
    expect(config.modules.gmail.hideSubject).toBe(true)
    expect(config.modules.deepseek.refreshIntervalMinutes).toBeNull()
    expect(config.modules.esa.refreshIntervalMinutes).toBeNull()
    expect(config.modules.websiteCheck.enabled).toBe(true)
    expect(config.modules.websiteCheck.defaultTimeoutMs).toBe(8000)
    expect(config.app.moduleOrder).toEqual(['memo', 'website-check'])
  })

  it('repairs invalid values instead of rejecting the file', () => {
    const config = parseConfig({
      schemaVersion: 3,
      app: { alwaysOnTop: 'yes', bounceAnimation: false, bubbleDurationMs: 999999 },
      pet: { assetId: '../escape', scale: 42, position: { x: 'left', y: 2 } },
      modules: {
        gmail: { enabled: 'yes', pollIntervalMinutes: 999 },
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
    expect(config.modules.gmail.pollIntervalMinutes).toBe(15)
    expect(config.modules.gmail.notifyNewMail).toBe(true)
    expect(config.modules.esa.siteId).toBe('')
    expect(config.modules.esa.refreshIntervalMinutes).toBe(60)
    expect(config.modules.deepseek.refreshIntervalMinutes).toBeNull()
    expect(config.app.moduleOrder).toEqual(['memo', 'website-check'])
    expect(config).not.toHaveProperty('secrets')
  })

  it('migrates version 1 files by adding module defaults', () => {
    const result = migrateConfig(V1_CONFIG)

    expect(result.fromVersion).toBe(1)
    expect(result.migrated).toBe(true)
    expect(result.futureVersion).toBe(false)
    expect(result.config.schemaVersion).toBe(6)
    expect(result.config.app.alwaysOnTop).toBe(false)
    expect(result.config.pet.scale).toBe(1.5)
    expect(result.config.modules.memo.enabled).toBe(true)
    expect(result.config.modules.deepseek.refreshIntervalMinutes).toBeNull()
    expect(result.config.app.moduleOrder).toEqual(['memo', 'website-check'])
  })

  it('migrates version 2 files by adding refresh intervals', () => {
    const result = migrateConfig({
      schemaVersion: 2,
      app: { alwaysOnTop: true, bounceAnimation: true, bubbleDurationMs: 5000 },
      pet: { assetId: 'default', scale: 1, position: null },
      modules: {
        dates: { enabled: true },
        gmail: { enabled: false, pollIntervalMinutes: 3, notifyNewMail: true },
        esa: { enabled: true, siteId: 'site-1' },
        deepseek: { enabled: true },
        websiteCheck: { enabled: true, defaultTimeoutMs: 8000 }
      }
    })

    expect(result.fromVersion).toBe(2)
    expect(result.migrated).toBe(true)
    expect(result.config.schemaVersion).toBe(6)
    expect(result.config.modules.esa.siteId).toBe('site-1')
    expect(result.config.modules.esa.refreshIntervalMinutes).toBeNull()
    expect(result.config.modules.deepseek.refreshIntervalMinutes).toBeNull()
  })

  it('migrates the dates module to memo and keeps its enabled state', () => {
    const enabled = migrateConfig({
      schemaVersion: 5,
      app: { moduleOrder: ['dates', 'website-check'] },
      modules: { dates: { enabled: true } }
    })
    expect(enabled.fromVersion).toBe(5)
    expect(enabled.migrated).toBe(true)
    expect(enabled.config.modules.memo.enabled).toBe(true)
    expect(enabled.config.app.moduleOrder).toEqual(['memo', 'website-check'])
    expect(enabled.config).not.toHaveProperty('modules.dates')

    const disabled = migrateConfig({
      schemaVersion: 5,
      app: { moduleOrder: ['dates', 'website-check'] },
      modules: { dates: { enabled: false } }
    })
    expect(disabled.config.modules.memo.enabled).toBe(false)
    expect(disabled.config.app.moduleOrder).toEqual(['website-check'])
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
      moduleOrder: ['website-check', 'memo']
    })
    store.updatePet({ scale: 1.5, position: { x: 100, y: 200 } })
    store.setModuleEnabled('gmail', true)
    store.setModuleRefreshInterval('deepseek', 15)
    store.setEsaSiteId('site-42')
    store.updateGmailSettings({ pollIntervalMinutes: 5, hideSubject: false })
    store.flush()

    const reloaded = new ConfigStore(filePath).load()
    expect(reloaded.app.alwaysOnTop).toBe(false)
    expect(reloaded.app.bubbleDurationMs).toBe(8000)
    expect(reloaded.pet.scale).toBe(1.5)
    expect(reloaded.pet.position).toEqual({ x: 100, y: 200 })
    expect(reloaded.modules.gmail.enabled).toBe(true)
    expect(reloaded.modules.gmail.pollIntervalMinutes).toBe(5)
    expect(reloaded.modules.gmail.hideSubject).toBe(false)
    expect(reloaded.modules.memo.enabled).toBe(true)
    expect(reloaded.modules.deepseek.refreshIntervalMinutes).toBe(15)
    expect(reloaded.modules.esa.siteId).toBe('site-42')
    expect(reloaded.app.launchAtLogin).toBe(true)
    expect(reloaded.app.moduleOrder).toEqual(['website-check', 'memo', 'gmail'])
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
          gmail: { enabled: false, pollIntervalMinutes: 3, notifyNewMail: true },
          esa: { enabled: false, siteId: 'kept-site' },
          deepseek: { enabled: false },
          websiteCheck: { enabled: true, defaultTimeoutMs: 8000 }
        }
      }),
      'utf8'
    )

    const config = new ConfigStore(filePath).load()

    expect(config.schemaVersion).toBe(6)
    expect(config.modules.esa.siteId).toBe('kept-site')
    expect(config.modules.deepseek.refreshIntervalMinutes).toBeNull()
    expect(readdirSync(directory).some((name) => name.startsWith('config.json.v2-'))).toBe(true)
  })

  it('migrates version 3 files by adding startup and Gmail options', () => {
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
          gmail: { enabled: true, pollIntervalMinutes: 5, notifyNewMail: false },
          esa: { enabled: false, siteId: '', refreshIntervalMinutes: null },
          deepseek: { enabled: false, refreshIntervalMinutes: null },
          websiteCheck: { enabled: true, defaultTimeoutMs: 8000 }
        }
      }),
      'utf8'
    )

    const config = new ConfigStore(filePath).load()

    expect(config.schemaVersion).toBe(6)
    expect(config.app.launchAtLogin).toBe(false)
    expect(config.app.showPetOnStartup).toBe(true)
    expect(config.modules.gmail.pollIntervalMinutes).toBe(5)
    expect(config.modules.gmail.notifyNewMail).toBe(false)
    expect(config.modules.gmail.hideSubject).toBe(true)
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

  it('reads and writes module switches by module id', () => {
    const directory = createTemporaryDirectory()
    const store = new ConfigStore(join(directory, 'config.json'))
    store.load()

    expect(store.get().app.moduleOrder).toEqual(['memo', 'website-check'])
    expect(store.isModuleEnabled('deepseek')).toBe(false)
    store.setModuleEnabled('deepseek', true)
    expect(store.isModuleEnabled('deepseek')).toBe(true)
    expect(store.get().app.moduleOrder).toEqual(['memo', 'website-check', 'deepseek'])
    store.setModuleEnabled('website-check', false)
    expect(store.isModuleEnabled('website-check')).toBe(false)
    expect(store.get().app.moduleOrder).toEqual(['memo', 'deepseek'])
    expect(store.isModuleEnabled('memo')).toBe(true)
  })
})
