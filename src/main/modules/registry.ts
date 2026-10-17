import type { DatesService } from './dates/dates-service'
import { DatesModule } from './dates/dates-module'
import type { DeepSeekModule } from './deepseek/deepseek-module'
import type { EsaModule } from './esa/esa-module'
import type { GmailModule } from './gmail/gmail-module'
import type { ModuleDefinition } from './types'
import { WebsiteCheckModule } from './website-check/website-module'
import type { WebsiteService } from './website-check/website-service'

export interface ModuleRegistryDependencies {
  datesService: DatesService
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
    new DatesModule(dependencies.datesService),
    dependencies.gmailModule,
    dependencies.esaModule,
    dependencies.deepSeekModule,
    new WebsiteCheckModule(dependencies.websiteService)
  ]
}
