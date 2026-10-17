import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { dirname } from 'node:path'
import type {
  AppSettings,
  AppSettingsPatch,
  PetSettings,
  PetSettingsPatch,
  PublicConfig
} from '../../shared/api'

export const CONFIG_SCHEMA_VERSION = 1
export const DEFAULT_BUBBLE_DURATION_MS = 5000
export const MIN_BUBBLE_DURATION_MS = 1500
export const MAX_BUBBLE_DURATION_MS = 30000
export const MIN_PET_SCALE = 0.5
export const MAX_PET_SCALE = 2

const ASSET_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/
const MAX_POSITION = 100000

export function createDefaultConfig(): PublicConfig {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    app: {
      alwaysOnTop: true,
      bounceAnimation: true,
      bubbleDurationMs: DEFAULT_BUBBLE_DURATION_MS
    },
    pet: {
      assetId: 'default',
      scale: 1,
      position: null
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function sanitizePosition(value: unknown): { x: number; y: number } | null {
  if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
    return null
  }
  return {
    x: Math.round(clampNumber(value.x, -MAX_POSITION, MAX_POSITION)),
    y: Math.round(clampNumber(value.y, -MAX_POSITION, MAX_POSITION))
  }
}

/** Rebuilds a config from untrusted JSON, dropping unknown or invalid fields. */
export function sanitizeConfig(raw: unknown): PublicConfig {
  const defaults = createDefaultConfig()
  if (!isRecord(raw)) {
    return defaults
  }

  const rawApp = isRecord(raw.app) ? raw.app : {}
  const rawPet = isRecord(raw.pet) ? raw.pet : {}

  const app: AppSettings = {
    alwaysOnTop:
      typeof rawApp.alwaysOnTop === 'boolean' ? rawApp.alwaysOnTop : defaults.app.alwaysOnTop,
    bounceAnimation:
      typeof rawApp.bounceAnimation === 'boolean'
        ? rawApp.bounceAnimation
        : defaults.app.bounceAnimation,
    bubbleDurationMs: isFiniteNumber(rawApp.bubbleDurationMs)
      ? Math.round(
          clampNumber(rawApp.bubbleDurationMs, MIN_BUBBLE_DURATION_MS, MAX_BUBBLE_DURATION_MS)
        )
      : defaults.app.bubbleDurationMs
  }

  const pet: PetSettings = {
    assetId:
      typeof rawPet.assetId === 'string' && ASSET_ID_PATTERN.test(rawPet.assetId)
        ? rawPet.assetId
        : defaults.pet.assetId,
    scale: isFiniteNumber(rawPet.scale)
      ? clampNumber(rawPet.scale, MIN_PET_SCALE, MAX_PET_SCALE)
      : defaults.pet.scale,
    position: sanitizePosition(rawPet.position)
  }

  return { schemaVersion: CONFIG_SCHEMA_VERSION, app, pet }
}

export function sanitizeAppSettingsPatch(raw: unknown): AppSettingsPatch {
  if (!isRecord(raw)) {
    return {}
  }

  const patch: AppSettingsPatch = {}
  if (typeof raw.alwaysOnTop === 'boolean') {
    patch.alwaysOnTop = raw.alwaysOnTop
  }
  if (typeof raw.bounceAnimation === 'boolean') {
    patch.bounceAnimation = raw.bounceAnimation
  }
  if (isFiniteNumber(raw.bubbleDurationMs)) {
    patch.bubbleDurationMs = Math.round(
      clampNumber(raw.bubbleDurationMs, MIN_BUBBLE_DURATION_MS, MAX_BUBBLE_DURATION_MS)
    )
  }
  return patch
}

export function sanitizePetSettingsPatch(raw: unknown): PetSettingsPatch {
  if (!isRecord(raw) || !isFiniteNumber(raw.scale)) {
    return {}
  }
  return { scale: clampNumber(raw.scale, MIN_PET_SCALE, MAX_PET_SCALE) }
}

/** Small JSON store with atomic writes and a short write debounce. */
export class ConfigStore {
  private current: PublicConfig = createDefaultConfig()
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly filePath: string,
    private readonly saveDelayMs = 150
  ) {}

  load(): PublicConfig {
    try {
      if (!existsSync(this.filePath)) {
        this.current = createDefaultConfig()
        this.writeNow()
        return this.get()
      }

      const parsed: unknown = JSON.parse(readFileSync(this.filePath, 'utf8'))
      this.current = sanitizeConfig(parsed)
      return this.get()
    } catch {
      this.backupCorruptFile()
      this.current = createDefaultConfig()
      this.writeNow()
      return this.get()
    }
  }

  get(): PublicConfig {
    return structuredClone(this.current)
  }

  updateApp(patch: AppSettingsPatch): PublicConfig {
    this.current = {
      ...this.current,
      app: { ...this.current.app, ...patch }
    }
    this.scheduleSave()
    return this.get()
  }

  updatePet(patch: Partial<PetSettings>): PublicConfig {
    this.current = {
      ...this.current,
      pet: { ...this.current.pet, ...patch }
    }
    this.scheduleSave()
    return this.get()
  }

  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
      this.writeNow()
    }
  }

  private scheduleSave(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
    }
    this.timer = setTimeout(() => {
      this.timer = null
      this.writeNow()
    }, this.saveDelayMs)
  }

  private writeNow(): void {
    const directory = dirname(this.filePath)
    mkdirSync(directory, { recursive: true })
    const temporaryPath = `${this.filePath}.tmp`
    writeFileSync(temporaryPath, `${JSON.stringify(this.current, null, 2)}\n`, 'utf8')
    renameSync(temporaryPath, this.filePath)
  }

  private backupCorruptFile(): void {
    try {
      if (existsSync(this.filePath)) {
        copyFileSync(this.filePath, `${this.filePath}.corrupt-${Date.now()}`)
      }
    } catch {
      // Backup is best-effort; a corrupt file must never stop startup.
    }
  }
}
