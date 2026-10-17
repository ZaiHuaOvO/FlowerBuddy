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
  it('creates version 2 defaults with module switches', () => {
    const config = createDefaultConfig()

    expect(config.schemaVersion).toBe(2)
    expect(config.modules.dates.enabled).toBe(true)
    expect(config.modules.gmail.enabled).toBe(false)
    expect(config.modules.websiteCheck.enabled).toBe(true)
    expect(config.modules.websiteCheck.defaultTimeoutMs).toBe(8000)
  })

  it('repairs invalid values instead of rejecting the file', () => {
    const config = parseConfig({
      schemaVersion: 2,
      app: { alwaysOnTop: 'yes', bounceAnimation: false, bubbleDurationMs: 999999 },
      pet: { assetId: '../escape', scale: 42, position: { x: 'left', y: 2 } },
      modules: { gmail: { enabled: 'yes', pollIntervalMinutes: 999 }, esa: { siteId: 42 } },
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
    expect(config).not.toHaveProperty('secrets')
  })

  it('migrates version 1 files by adding module defaults', () => {
    const result = migrateConfig(V1_CONFIG)

    expect(result.fromVersion).toBe(1)
    expect(result.migrated).toBe(true)
    expect(result.futureVersion).toBe(false)
    expect(result.config.schemaVersion).toBe(2)
    expect(result.config.app.alwaysOnTop).toBe(false)
    expect(result.config.pet.scale).toBe(1.5)
    expect(result.config.modules.dates.enabled).toBe(true)
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
    expect(config.modules.dates.enabled).toBe(true)
    expect(readdirSync(directory).some((name) => name.startsWith('config.json.v1-'))).toBe(true)
  })

  it('round-trips app, pet and module changes through disk', () => {
    const directory = createTemporaryDirectory()
    const filePath = join(directory, 'config.json')

    const store = new ConfigStore(filePath)
    store.load()
    store.updateApp({ alwaysOnTop: false, bubbleDurationMs: 8000 })
    store.updatePet({ scale: 1.5, position: { x: 100, y: 200 } })
    store.setModuleEnabled('gmail', true)
    store.flush()

    const reloaded = new ConfigStore(filePath).load()
    expect(reloaded.app.alwaysOnTop).toBe(false)
    expect(reloaded.app.bubbleDurationMs).toBe(8000)
    expect(reloaded.pet.scale).toBe(1.5)
    expect(reloaded.pet.position).toEqual({ x: 100, y: 200 })
    expect(reloaded.modules.gmail.enabled).toBe(true)
    expect(reloaded.modules.dates.enabled).toBe(true)
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

    expect(store.isModuleEnabled('deepseek')).toBe(false)
    store.setModuleEnabled('deepseek', true)
    expect(store.isModuleEnabled('deepseek')).toBe(true)
    store.setModuleEnabled('website-check', false)
    expect(store.isModuleEnabled('website-check')).toBe(false)
    expect(store.isModuleEnabled('dates')).toBe(true)
  })
})
