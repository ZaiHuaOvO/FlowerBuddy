import type { DatesService } from './dates/dates-service'
import { DatesModule } from './dates/dates-module'
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
    createPlaceholderModule({
      id: 'esa',
      name: 'ESA 流量',
      description: '阿里云 ESA 今日流量，需要只读 AccessKey',
      requiresCredentials: true
    }),
    createPlaceholderModule({
      id: 'deepseek',
      name: 'DeepSeek 余额',
      description: '账户余额查询，需要 API Key',
      requiresCredentials: true
    }),
    new WebsiteCheckModule(dependencies.websiteService)
  ]
}
