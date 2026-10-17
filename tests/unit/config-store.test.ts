import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ConfigStore,
  createDefaultConfig,
  sanitizeAppSettingsPatch,
  sanitizeConfig,
  sanitizePetSettingsPatch
} from '../../src/main/storage/config-store'

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

describe('config store', () => {
  it('writes defaults when the file does not exist', () => {
    const directory = createTemporaryDirectory()
    const filePath = join(directory, 'config.json')

    const config = new ConfigStore(filePath).load()

    expect(config).toEqual(createDefaultConfig())
    expect(JSON.parse(readFileSync(filePath, 'utf8'))).toEqual(createDefaultConfig())
  })

  it('round-trips updated settings through disk', () => {
    const directory = createTemporaryDirectory()
    const filePath = join(directory, 'config.json')

    const store = new ConfigStore(filePath)
    store.load()
    store.updateApp({ alwaysOnTop: false, bubbleDurationMs: 8000 })
    store.updatePet({ scale: 1.5, position: { x: 100, y: 200 } })
    store.flush()

    const reloaded = new ConfigStore(filePath).load()
    expect(reloaded.app.alwaysOnTop).toBe(false)
    expect(reloaded.app.bubbleDurationMs).toBe(8000)
    expect(reloaded.pet.scale).toBe(1.5)
    expect(reloaded.pet.position).toEqual({ x: 100, y: 200 })
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
    expect(JSON.parse(readFileSync(filePath, 'utf8'))).toEqual(createDefaultConfig())
  })

  it('drops unknown fields and repairs invalid values', () => {
    const config = sanitizeConfig({
      schemaVersion: 99,
      app: { alwaysOnTop: 'yes', bounceAnimation: false, bubbleDurationMs: 999999, extra: true },
      pet: { assetId: '../escape', scale: 42, position: { x: 'left', y: 2 } },
      secrets: { apiKey: 'must-not-survive' }
    })

    expect(config.schemaVersion).toBe(1)
    expect(config.app.alwaysOnTop).toBe(true)
    expect(config.app.bounceAnimation).toBe(false)
    expect(config.app.bubbleDurationMs).toBe(30000)
    expect(config.pet.assetId).toBe('default')
    expect(config.pet.scale).toBe(2)
    expect(config.pet.position).toBeNull()
    expect(config).not.toHaveProperty('secrets')
    expect(config.app).not.toHaveProperty('extra')
  })

  it('sanitizes renderer patches at the main-process boundary', () => {
    expect(sanitizeAppSettingsPatch({ alwaysOnTop: true, bubbleDurationMs: 10 })).toEqual({
      alwaysOnTop: true,
      bubbleDurationMs: 1500
    })
    expect(sanitizeAppSettingsPatch('nope')).toEqual({})
    expect(sanitizeAppSettingsPatch({ bubbleDurationMs: 'fast' })).toEqual({})

    expect(sanitizePetSettingsPatch({ scale: 9 })).toEqual({ scale: 2 })
    expect(sanitizePetSettingsPatch({ scale: Number.NaN })).toEqual({})
    expect(sanitizePetSettingsPatch({ assetId: '../../etc/passwd' })).toEqual({})
  })
})
