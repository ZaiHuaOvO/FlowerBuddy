import { z } from 'zod'
import { MAX_PET_NAME_LENGTH } from '../../shared/api'
import type { ModuleId, ModulesSettings, PublicConfig } from '../../shared/api'
import { DEFAULT_ESA_DISPLAY_RANGES } from '../../shared/esa'

export const CURRENT_CONFIG_SCHEMA_VERSION = 11

export const MODULE_ID_VALUES = [
  'memo',
  'interval-reminder',
  'esa',
  'deepseek',
  'website-check'
] as const satisfies readonly ModuleId[]

const defaultModuleOrder: ModuleId[] = ['memo', 'interval-reminder']

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

function moduleOrderField() {
  return z
    .array(z.unknown())
    .catch([])
    .transform((ids) => {
      const valid = ids.filter(
        (id): id is ModuleId =>
          typeof id === 'string' && (MODULE_ID_VALUES as readonly string[]).includes(id)
      )
      return [...new Set(valid)]
    })
}

function isModuleEnabledIn(modules: ModulesSettings, moduleId: ModuleId): boolean {
  switch (moduleId) {
    case 'memo':
      return modules.memo.enabled
    case 'interval-reminder':
      return modules.intervalReminder.enabled
    case 'esa':
      return modules.esa.enabled
    case 'deepseek':
      return modules.deepseek.enabled
    case 'website-check':
      return modules.websiteCheck.enabled
  }
}

/** Keeps only enabled ids, preserves user order, then appends newly enabled ids. */
export function normalizeModuleOrder(
  order: readonly ModuleId[],
  modules: ModulesSettings
): ModuleId[] {
  const next: ModuleId[] = []
  for (const id of order) {
    if (!next.includes(id) && isModuleEnabledIn(modules, id)) {
      next.push(id)
    }
  }
  for (const id of MODULE_ID_VALUES) {
    if (isModuleEnabledIn(modules, id) && !next.includes(id)) {
      next.push(id)
    }
  }
  return next
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
  bossShortcut: stringField(64, 'Alt+Z'),
  bounceAnimation: booleanField(true),
  bubbleDurationMs: integerField(1000, 30000, 5000),
  launchAtLogin: booleanField(false),
  memoShortcut: stringField(64, 'Alt+A'),
  moduleOrder: moduleOrderField(),
  showPetOnStartup: booleanField(true)
})

const USER_PET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function petNamesField() {
  return z
    .record(z.string(), z.unknown())
    .catch({})
    .default({})
    .transform((names) => {
      const result: Record<string, string> = {}
      for (const [assetId, name] of Object.entries(names)) {
        if (!USER_PET_ID_PATTERN.test(assetId) || typeof name !== 'string') {
          continue
        }
        const trimmed = name.trim().slice(0, MAX_PET_NAME_LENGTH)
        if (trimmed) {
          result[assetId] = trimmed
        }
      }
      return result
    })
}

const petSchema = z.object({
  assetId: z
    .string()
    .regex(/^[A-Za-z0-9-]{1,64}$/)
    .catch('default'),
  names: petNamesField(),
  scale: numberField(0.5, 2, 1),
  position: positionSchema
})

const memoModuleSchema = z
  .object({
    enabled: booleanField(true),
    anchorNewMemos: booleanField(false),
    lineTasksEnabled: booleanField(false)
  })
  .catch({ enabled: true, anchorNewMemos: false, lineTasksEnabled: false })

const intervalReminderModuleSchema = z
  .object({ enabled: booleanField(true) })
  .catch({ enabled: true })

const esaDisplayRangesSchema = z
  .object({
    last24h: booleanField(true),
    last7d: booleanField(true),
    last30d: booleanField(true)
  })
  .catch({ ...DEFAULT_ESA_DISPLAY_RANGES })
  .transform((ranges) =>
    ranges.last24h || ranges.last7d || ranges.last30d
      ? ranges
      : { last24h: true, last7d: false, last30d: false }
  )
  .default({ ...DEFAULT_ESA_DISPLAY_RANGES })

const esaModuleSchema = z
  .object({
    enabled: booleanField(false),
    siteId: stringField(128, ''),
    refreshIntervalMinutes: nullableIntervalField(5, 60),
    displayRanges: esaDisplayRangesSchema
  })
  .catch({
    enabled: false,
    siteId: '',
    refreshIntervalMinutes: null,
    displayRanges: { ...DEFAULT_ESA_DISPLAY_RANGES }
  })

const deepseekModuleSchema = z
  .object({
    enabled: booleanField(false),
    refreshIntervalMinutes: nullableIntervalField(5, 60)
  })
  .catch({ enabled: false, refreshIntervalMinutes: null })

const websiteCheckModuleSchema = z
  .object({
    enabled: booleanField(false),
    defaultTimeoutMs: integerField(3000, 30000, 8000)
  })
  .catch({ enabled: false, defaultTimeoutMs: 8000 })

const modulesSchema = z
  .object({
    memo: memoModuleSchema.default({
      enabled: true,
      anchorNewMemos: false,
      lineTasksEnabled: false
    }),
    intervalReminder: intervalReminderModuleSchema.default({ enabled: true }),
    esa: esaModuleSchema.default({
      enabled: false,
      siteId: '',
      refreshIntervalMinutes: null,
      displayRanges: { ...DEFAULT_ESA_DISPLAY_RANGES }
    }),
    deepseek: deepseekModuleSchema.default({
      enabled: false,
      refreshIntervalMinutes: null
    }),
    websiteCheck: websiteCheckModuleSchema.default({
      enabled: false,
      defaultTimeoutMs: 8000
    })
  })
  .catch({
    memo: { enabled: true, anchorNewMemos: false, lineTasksEnabled: false },
    intervalReminder: { enabled: true },
    esa: {
      enabled: false,
      siteId: '',
      refreshIntervalMinutes: null,
      displayRanges: { ...DEFAULT_ESA_DISPLAY_RANGES }
    },
    deepseek: { enabled: false, refreshIntervalMinutes: null },
    websiteCheck: { enabled: false, defaultTimeoutMs: 8000 }
  })

const configSchema = z
  .object({
    schemaVersion: z.number().catch(CURRENT_CONFIG_SCHEMA_VERSION),
    app: appSchema.default({
      alwaysOnTop: true,
      bossShortcut: 'Alt+Z',
      bounceAnimation: true,
      bubbleDurationMs: 5000,
      launchAtLogin: false,
      memoShortcut: 'Alt+A',
      moduleOrder: [...defaultModuleOrder],
      showPetOnStartup: true
    }),
    pet: petSchema.default({ assetId: 'default', names: {}, scale: 1, position: null }),
    modules: modulesSchema.default({
      memo: { enabled: true, anchorNewMemos: false, lineTasksEnabled: false },
      intervalReminder: { enabled: true },
      esa: {
        enabled: false,
        siteId: '',
        refreshIntervalMinutes: null,
        displayRanges: { ...DEFAULT_ESA_DISPLAY_RANGES }
      },
      deepseek: { enabled: false, refreshIntervalMinutes: null },
      websiteCheck: { enabled: false, defaultTimeoutMs: 8000 }
    })
  })
  .catch({
    schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
    app: {
      alwaysOnTop: true,
      bossShortcut: 'Alt+Z',
      bounceAnimation: true,
      bubbleDurationMs: 5000,
      launchAtLogin: false,
      memoShortcut: 'Alt+A',
      moduleOrder: [...defaultModuleOrder],
      showPetOnStartup: true
    },
    pet: { assetId: 'default', names: {}, scale: 1, position: null },
    modules: {
      memo: { enabled: true, anchorNewMemos: false, lineTasksEnabled: false },
      intervalReminder: { enabled: true },
      esa: {
        enabled: false,
        siteId: '',
        refreshIntervalMinutes: null,
        displayRanges: { ...DEFAULT_ESA_DISPLAY_RANGES }
      },
      deepseek: { enabled: false, refreshIntervalMinutes: null },
      websiteCheck: { enabled: false, defaultTimeoutMs: 8000 }
    }
  })

export function createDefaultModules(): ModulesSettings {
  return {
    memo: { enabled: true, anchorNewMemos: false, lineTasksEnabled: false },
    intervalReminder: { enabled: true },
    esa: {
      enabled: false,
      siteId: '',
      refreshIntervalMinutes: null,
      displayRanges: { ...DEFAULT_ESA_DISPLAY_RANGES }
    },
    deepseek: { enabled: false, refreshIntervalMinutes: null },
    websiteCheck: { enabled: false, defaultTimeoutMs: 8000 }
  }
}

export function createDefaultConfig(): PublicConfig {
  return {
    schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
    app: {
      alwaysOnTop: true,
      bossShortcut: 'Alt+Z',
      bounceAnimation: true,
      bubbleDurationMs: 5000,
      launchAtLogin: false,
      memoShortcut: 'Alt+A',
      moduleOrder: [...defaultModuleOrder],
      showPetOnStartup: true
    },
    pet: {
      assetId: 'default',
      names: {},
      scale: 1,
      position: null
    },
    modules: createDefaultModules()
  }
}

/** Repairs unknown or invalid values instead of rejecting the whole file. */
export function parseConfig(raw: unknown): PublicConfig {
  const parsed = configSchema.parse(raw ?? {})
  return {
    ...parsed,
    app: {
      ...parsed.app,
      moduleOrder: normalizeModuleOrder(parsed.app.moduleOrder, parsed.modules)
    },
    schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION
  }
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** v5 stored the memo module under `dates`; keep its enabled state and order. */
function migrateMemoModule(raw: unknown, fromVersion: number): unknown {
  if (fromVersion >= 6 || !isPlainObject(raw)) {
    return raw
  }
  const next: Record<string, unknown> = { ...raw }
  const app = isPlainObject(raw.app) ? { ...raw.app } : {}
  const modules = isPlainObject(raw.modules) ? { ...raw.modules } : {}
  const dates = isPlainObject(modules.dates) ? modules.dates : null
  if (dates && !isPlainObject(modules.memo)) {
    modules.memo = { enabled: dates.enabled !== false, anchorNewMemos: false }
  }
  delete modules.dates
  if (Array.isArray(app.moduleOrder)) {
    app.moduleOrder = app.moduleOrder.map((id) => (id === 'dates' ? 'memo' : id))
  }
  next.app = app
  next.modules = modules
  return next
}

/** v8 introduces the reminder module and the new initial module selection. */
function applyInitialModuleDefaults(raw: unknown, fromVersion: number): unknown {
  if (fromVersion >= 8 || !isPlainObject(raw)) {
    return raw
  }
  const next: Record<string, unknown> = { ...raw }
  const modules = isPlainObject(raw.modules) ? { ...raw.modules } : {}
  const setEnabled = (key: string, enabled: boolean): void => {
    const existing = isPlainObject(modules[key]) ? modules[key] : {}
    modules[key] = { ...existing, enabled }
  }
  setEnabled('memo', true)
  modules.intervalReminder = { enabled: true }
  setEnabled('esa', false)
  setEnabled('deepseek', false)
  setEnabled('websiteCheck', false)
  const app = isPlainObject(raw.app) ? { ...raw.app } : {}
  app.moduleOrder = ['memo', 'interval-reminder']
  next.modules = modules
  next.app = app
  return next
}

/** v9 removes the Gmail module and any stale id from the saved order. */
function removeGmailModule(raw: unknown, fromVersion: number): unknown {
  if (fromVersion >= 9 || !isPlainObject(raw)) {
    return raw
  }
  const next: Record<string, unknown> = { ...raw }
  const modules = isPlainObject(raw.modules) ? { ...raw.modules } : {}
  delete modules.gmail
  next.modules = modules
  const app = isPlainObject(raw.app) ? { ...raw.app } : {}
  if (Array.isArray(app.moduleOrder)) {
    app.moduleOrder = app.moduleOrder.filter((id) => id !== 'gmail')
  }
  next.app = app
  return next
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
    config: parseConfig(
      removeGmailModule(
        applyInitialModuleDefaults(migrateMemoModule(raw, fromVersion), fromVersion),
        fromVersion
      )
    ),
    fromVersion,
    migrated: fromVersion < CURRENT_CONFIG_SCHEMA_VERSION,
    futureVersion: false
  }
}
