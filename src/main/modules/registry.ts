import type { DeepSeekModule } from './deepseek/deepseek-module'
import type { EsaModule } from './esa/esa-module'
import type { GmailModule } from './gmail/gmail-module'
import { MemoModule } from './memo/memo-module'
import type { MemoService } from './memo/memo-service'
import type { ModuleDefinition } from './types'
import { WebsiteCheckModule } from './website-check/website-module'
import type { WebsiteService } from './website-check/website-service'

export interface ModuleRegistryDependencies {
  memoService: MemoService
  websiteService: WebsiteService
  deepSeekModule: DeepSeekModule
  esaModule: EsaModule
  gmailModule: GmailModule
}

/**
 * Static registry only. No code is loaded from the filesystem, so enabling a
 * module can never execute arbitrary plugin code.
 */
export function createModuleRegistry(dependencies: ModuleRegistryDependencies): ModuleDefinition[] {
  return [
    new MemoModule(dependencies.memoService),
    dependencies.gmailModule,
    dependencies.esaModule,
    dependencies.deepSeekModule,
    new WebsiteCheckModule(dependencies.websiteService)
  ]
}
