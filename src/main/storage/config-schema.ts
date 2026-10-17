import { z } from 'zod'
import type { ModulesSettings, PublicConfig } from '../../shared/api'

export const CURRENT_CONFIG_SCHEMA_VERSION = 3

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function booleanField(fallback: boolean) {
  return z.boolean().catch(fallback)
}

function numberField(min: number, max: number, fallback: number) {
  return z
    .number()
    .catch(fallback)
    .transform((value) => {
      const safe = Number.isFinite(value) ? value : fallback
      return clampNumber(safe, min, max)
    })
}

function integerField(min: number, max: number, fallback: number) {
  return z
    .number()
    .catch(fallback)
    .transform((value) => {
      const safe = Number.isFinite(value) ? Math.round(value) : fallback
      return clampNumber(safe, min, max)
    })
}

function stringField(maxLength: number, fallback: string) {
  return z
    .string()
    .catch(fallback)
    .transform((value) => value.slice(0, maxLength))
}

function nullableIntervalField(min: number, max: number) {
  return z
    .union([z.number(), z.null()])
    .catch(null)
    .transform((value) => {
      if (value === null || !Number.isFinite(value)) {
        return null
      }
      return clampNumber(Math.round(value), min, max)
    })
}

const positionSchema = z
  .object({ x: z.number(), y: z.number() })
  .nullable()
  .catch(null)
  .transform((value) => {
    if (!value) {
      return null
    }
    return {
      x: Math.round(clampNumber(Number.isFinite(value.x) ? value.x : 0, -100000, 100000)),
      y: Math.round(clampNumber(Number.isFinite(value.y) ? value.y : 0, -100000, 100000))
    }
  })

const appSchema = z.object({
  alwaysOnTop: booleanField(true),
  bounceAnimation: booleanField(true),
  bubbleDurationMs: integerField(1500, 30000, 5000)
})

const petSchema = z.object({
  assetId: z
    .string()
    .regex(/^[A-Za-z0-9-]{1,64}$/)
    .catch('default'),
  scale: numberField(0.5, 2, 1),
  position: positionSchema
})

const datesModuleSchema = z.object({ enabled: booleanField(true) }).catch({ enabled: true })

const gmailModuleSchema = z
  .object({
    enabled: booleanField(false),
    pollIntervalMinutes: integerField(1, 15, 3),
    notifyNewMail: booleanField(true)
  })
  .catch({ enabled: false, pollIntervalMinutes: 3, notifyNewMail: true })

const esaModuleSchema = z
  .object({
    enabled: booleanField(false),
    siteId: stringField(128, ''),
    refreshIntervalMinutes: nullableIntervalField(5, 60)
  })
  .catch({ enabled: false, siteId: '', refreshIntervalMinutes: null })

const deepseekModuleSchema = z
  .object({
    enabled: booleanField(false),
    refreshIntervalMinutes: nullableIntervalField(5, 60)
  })
  .catch({ enabled: false, refreshIntervalMinutes: null })

const websiteCheckModuleSchema = z
  .object({
    enabled: booleanField(true),
    defaultTimeoutMs: integerField(3000, 30000, 8000)
  })
  .catch({ enabled: true, defaultTimeoutMs: 8000 })

const modulesSchema = z
  .object({
    dates: datesModuleSchema.default({ enabled: true }),
    gmail: gmailModuleSchema.default({
      enabled: false,
      pollIntervalMinutes: 3,
      notifyNewMail: true
    }),
    esa: esaModuleSchema.default({
      enabled: false,
      siteId: '',
      refreshIntervalMinutes: null
    }),
    deepseek: deepseekModuleSchema.default({
      enabled: false,
      refreshIntervalMinutes: null
    }),
    websiteCheck: websiteCheckModuleSchema.default({
      enabled: true,
      defaultTimeoutMs: 8000
    })
  })
  .catch({
    dates: { enabled: true },
    gmail: { enabled: false, pollIntervalMinutes: 3, notifyNewMail: true },
    esa: { enabled: false, siteId: '', refreshIntervalMinutes: null },
    deepseek: { enabled: false, refreshIntervalMinutes: null },
    websiteCheck: { enabled: true, defaultTimeoutMs: 8000 }
  })

const configSchema = z
  .object({
    schemaVersion: z.number().catch(CURRENT_CONFIG_SCHEMA_VERSION),
    app: appSchema.default({
      alwaysOnTop: true,
      bounceAnimation: true,
      bubbleDurationMs: 5000
    }),
    pet: petSchema.default({ assetId: 'default', scale: 1, position: null }),
    modules: modulesSchema.default({
      dates: { enabled: true },
      gmail: { enabled: false, pollIntervalMinutes: 3, notifyNewMail: true },
      esa: { enabled: false, siteId: '', refreshIntervalMinutes: null },
      deepseek: { enabled: false, refreshIntervalMinutes: null },
      websiteCheck: { enabled: true, defaultTimeoutMs: 8000 }
    })
  })
  .catch({
    schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
    app: { alwaysOnTop: true, bounceAnimation: true, bubbleDurationMs: 5000 },
    pet: { assetId: 'default', scale: 1, position: null },
    modules: {
      dates: { enabled: true },
      gmail: { enabled: false, pollIntervalMinutes: 3, notifyNewMail: true },
      esa: { enabled: false, siteId: '', refreshIntervalMinutes: null },
      deepseek: { enabled: false, refreshIntervalMinutes: null },
      websiteCheck: { enabled: true, defaultTimeoutMs: 8000 }
    }
  })

export function createDefaultModules(): ModulesSettings {
  return {
    dates: { enabled: true },
    gmail: { enabled: false, pollIntervalMinutes: 3, notifyNewMail: true },
    esa: { enabled: false, siteId: '', refreshIntervalMinutes: null },
    deepseek: { enabled: false, refreshIntervalMinutes: null },
    websiteCheck: { enabled: true, defaultTimeoutMs: 8000 }
  }
}

export function createDefaultConfig(): PublicConfig {
  return {
    schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
    app: {
      alwaysOnTop: true,
      bounceAnimation: true,
      bubbleDurationMs: 5000
    },
    pet: {
      assetId: 'default',
      scale: 1,
      position: null
    },
    modules: createDefaultModules()
  }
}

/** Repairs unknown or invalid values instead of rejecting the whole file. */
export function parseConfig(raw: unknown): PublicConfig {
  const parsed = configSchema.parse(raw ?? {})
  return { ...parsed, schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION }
}

export function readSchemaVersion(raw: unknown): number {
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const version = (raw as Record<string, unknown>).schemaVersion
    if (typeof version === 'number' && Number.isInteger(version) && version >= 0) {
      return version
    }
  }
  return 0
}

export interface ConfigMigrationResult {
  config: PublicConfig
  fromVersion: number
  migrated: boolean
  futureVersion: boolean
}

export function migrateConfig(raw: unknown): ConfigMigrationResult {
  const fromVersion = readSchemaVersion(raw)
  if (fromVersion > CURRENT_CONFIG_SCHEMA_VERSION) {
    return {
      config: createDefaultConfig(),
      fromVersion,
      migrated: false,
      futureVersion: true
    }
  }

  return {
    config: parseConfig(raw),
    fromVersion,
    migrated: fromVersion < CURRENT_CONFIG_SCHEMA_VERSION,
    futureVersion: false
  }
}
