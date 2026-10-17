import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { basename, dirname } from 'node:path'
import type {
  AppSettingsPatch,
  ModuleId,
  PublicConfig,
  RefreshableModuleId
} from '../../shared/api'
import type { LoggerLike } from '../shared/logger'
import { CURRENT_CONFIG_SCHEMA_VERSION, createDefaultConfig, migrateConfig } from './config-schema'

export { CURRENT_CONFIG_SCHEMA_VERSION, createDefaultConfig }

export interface ConfigStoreOptions {
  saveDelayMs?: number
  logger?: LoggerLike
}

export class ConfigStore {
  private current: PublicConfig = createDefaultConfig()
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly saveDelayMs: number
  private readonly logger: LoggerLike | undefined
  private recoveryNotice: string | null = null

  constructor(
    private readonly filePath: string,
    options: ConfigStoreOptions = {}
  ) {
    this.saveDelayMs = options.saveDelayMs ?? 150
    this.logger = options.logger
  }

  load(): PublicConfig {
    try {
      if (!existsSync(this.filePath)) {
        this.current = createDefaultConfig()
        this.writeNow()
        return this.get()
      }

      const parsed: unknown = JSON.parse(readFileSync(this.filePath, 'utf8'))
      const result = migrateConfig(parsed)

      if (result.futureVersion) {
        const backupPath = this.backup(`future-v${result.fromVersion}`)
        this.current = createDefaultConfig()
        this.writeNow()
        this.recoveryNotice = backupPath
          ? `配置来自更高版本，无法安全读取。已备份为 ${basename(backupPath)} 并恢复默认设置。`
          : '配置来自更高版本，无法安全读取。已恢复默认设置。'
        this.logger?.warn('config file has a newer schema version; backed up and reset', {
          fromVersion: result.fromVersion,
          currentVersion: CURRENT_CONFIG_SCHEMA_VERSION
        })
        return this.get()
      }

      if (result.migrated) {
        this.backup(`v${result.fromVersion}`)
        this.current = result.config
        this.writeNow()
        this.logger?.info('config migrated', {
          fromVersion: result.fromVersion,
          toVersion: CURRENT_CONFIG_SCHEMA_VERSION
        })
        return this.get()
      }

      this.current = result.config
      return this.get()
    } catch {
      const backupPath = this.backup('corrupt')
      this.current = createDefaultConfig()
      this.writeNow()
      this.recoveryNotice = backupPath
        ? `配置文件无法读取，已备份为 ${basename(backupPath)} 并恢复默认设置。`
        : '配置文件无法读取，已恢复默认设置。'
      this.logger?.warn('config file was unreadable; backed up and reset')
      return this.get()
    }
  }

  getRecoveryNotice(): string | null {
    return this.recoveryNotice
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

  updatePet(patch: Partial<PublicConfig['pet']>): PublicConfig {
    this.current = {
      ...this.current,
      pet: { ...this.current.pet, ...patch }
    }
    this.scheduleSave()
    return this.get()
  }

  setModuleEnabled(moduleId: ModuleId, enabled: boolean): PublicConfig {
    const modules = this.current.modules
    switch (moduleId) {
      case 'dates':
        this.current = {
          ...this.current,
          modules: { ...modules, dates: { ...modules.dates, enabled } }
        }
        break
      case 'gmail':
        this.current = {
          ...this.current,
          modules: { ...modules, gmail: { ...modules.gmail, enabled } }
        }
        break
      case 'esa':
        this.current = {
          ...this.current,
          modules: { ...modules, esa: { ...modules.esa, enabled } }
        }
        break
      case 'deepseek':
        this.current = {
          ...this.current,
          modules: { ...modules, deepseek: { ...modules.deepseek, enabled } }
        }
        break
      case 'website-check':
        this.current = {
          ...this.current,
          modules: { ...modules, websiteCheck: { ...modules.websiteCheck, enabled } }
        }
        break
    }
    this.scheduleSave()
    return this.get()
  }

  isModuleEnabled(moduleId: ModuleId): boolean {
    const modules = this.current.modules
    switch (moduleId) {
      case 'dates':
        return modules.dates.enabled
      case 'gmail':
        return modules.gmail.enabled
      case 'esa':
        return modules.esa.enabled
      case 'deepseek':
        return modules.deepseek.enabled
      case 'website-check':
        return modules.websiteCheck.enabled
    }
  }

  setModuleRefreshInterval(moduleId: RefreshableModuleId, minutes: number | null): PublicConfig {
    const modules = this.current.modules
    if (moduleId === 'deepseek') {
      this.current = {
        ...this.current,
        modules: {
          ...modules,
          deepseek: { ...modules.deepseek, refreshIntervalMinutes: minutes }
        }
      }
    } else {
      this.current = {
        ...this.current,
        modules: {
          ...modules,
          esa: { ...modules.esa, refreshIntervalMinutes: minutes }
        }
      }
    }
    this.scheduleSave()
    return this.get()
  }

  setEsaSiteId(siteId: string): PublicConfig {
    this.current = {
      ...this.current,
      modules: {
        ...this.current.modules,
        esa: {
          ...this.current.modules.esa,
          siteId: siteId.trim().slice(0, 128)
        }
      }
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

  private backup(reason: string): string | null {
    try {
      if (existsSync(this.filePath)) {
        const backupPath = `${this.filePath}.${reason}-${Date.now()}.json`
        copyFileSync(this.filePath, backupPath)
        return backupPath
      }
    } catch {
      // Backup is best-effort; a bad file must never stop startup.
    }
    return null
  }
}
