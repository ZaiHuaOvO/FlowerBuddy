import type { DatesService } from './dates/dates-service'
import { DatesModule } from './dates/dates-module'
import type { DeepSeekModule } from './deepseek/deepseek-module'
import type { EsaModule } from './esa/esa-module'
import type { ModuleDefinition } from './types'
import { WebsiteCheckModule } from './website-check/website-module'
import type { WebsiteService } from './website-check/website-service'

interface PlaceholderDescriptor {
  id: ModuleDefinition['id']
  name: string
  description: string
  requiresCredentials: boolean
}

function createPlaceholderModule(descriptor: PlaceholderDescriptor): ModuleDefinition {
  const isConfigured = (): boolean => !descriptor.requiresCredentials
  return {
    ...descriptor,
    implemented: false,
    actions: [],
    isConfigured,
    getStatus: () => (isConfigured() ? 'not-implemented' : 'not-configured'),
    start: () => {},
    stop: () => {}
  }
}

export interface ModuleRegistryDependencies {
  datesService: DatesService
  websiteService: WebsiteService
  deepSeekModule: DeepSeekModule
  esaModule: EsaModule
}

/**
 * Static registry only. No code is loaded from the filesystem, so enabling a
 * module can never execute arbitrary plugin code.
 */
export function createModuleRegistry(dependencies: ModuleRegistryDependencies): ModuleDefinition[] {
  return [
    new DatesModule(dependencies.datesService),
    createPlaceholderModule({
      id: 'gmail',
      name: 'Gmail 提醒',
      description: '新邮件通知，需要 Google OAuth 授权',
      requiresCredentials: true
    }),
    dependencies.esaModule,
    dependencies.deepSeekModule,
    new WebsiteCheckModule(dependencies.websiteService)
  ]
}
