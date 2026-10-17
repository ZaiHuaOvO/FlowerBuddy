import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import type { z } from 'zod'
import { IPC_CHANNELS } from '../../shared/api'
import type {
  AppSettingsPatch,
  DateEventInput,
  DateEventPatch,
  GmailSettingsPatch,
  IpcResult,
  PetSettingsPatch,
  WebsiteCheckInput,
  WebsiteCheckPatch
} from '../../shared/api'
import type { AppController } from '../app-controller'
import { AppError, toPublicError } from '../shared/errors'
import type { LoggerLike } from '../shared/logger'
import {
  appSettingsPatchSchema,
  dateEventInputSchema,
  dateUpdateInputSchema,
  deepSeekKeyInputSchema,
  esaCredentialsInputSchema,
  gmailClientInputSchema,
  gmailSettingsPatchSchema,
  idEnabledInputSchema,
  idInputSchema,
  menuActionSchema,
  moduleEnabledInputSchema,
  parseInput,
  petSettingsPatchSchema,
  refreshIntervalInputSchema,
  websiteInputSchema,
  websiteUpdateInputSchema
} from './schemas'

export type SenderValidator = (url: string | undefined) => boolean

export interface IpcDependencies {
  controller: AppController
  isTrustedSender: SenderValidator
  logger: LoggerLike
}

export function registerIpcHandlers(deps: IpcDependencies): void {
  const { controller, isTrustedSender, logger } = deps

  const assertTrusted = (event: IpcMainInvokeEvent): void => {
    if (!isTrustedSender(event.senderFrame?.url)) {
      throw new AppError('UNTRUSTED_SENDER', '请求来源不受信任')
    }
  }

  const register = <TInput, TOutput>(
    channel: string,
    schema: z.ZodType<TInput> | null,
    handler: (input: TInput) => TOutput | Promise<TOutput>
  ): void => {
    ipcMain.handle(channel, async (event, raw: unknown): Promise<IpcResult<TOutput>> => {
      const requestId = randomUUID()
      try {
        assertTrusted(event)
        const input = schema ? parseInput(schema, raw) : (undefined as TInput)
        const value = await handler(input)
        return { ok: true, value }
      } catch (error) {
        const publicError = toPublicError(error)
        logger.warn('ipc request failed', {
          channel,
          code: publicError.code,
          requestId
        })
        return { ok: false, error: publicError }
      }
    })
  }

  register(IPC_CHANNELS.appInfo, null, () => controller.getAppInfo())
  register(IPC_CHANNELS.configGet, null, () => controller.getPublicConfig())
  register(IPC_CHANNELS.startupNotice, null, () => controller.getStartupNotice())

  register(IPC_CHANNELS.settingsSaveApp, appSettingsPatchSchema, (patch) =>
    controller.updateAppSettings(patch as AppSettingsPatch)
  )
  register(IPC_CHANNELS.settingsSavePet, petSettingsPatchSchema, (patch) =>
    controller.updatePetSettings(patch as PetSettingsPatch)
  )
  register(IPC_CHANNELS.settingsImportPet, null, () => controller.importPetImage())
  register(IPC_CHANNELS.settingsResetPosition, null, () => controller.resetPetPosition())

  register(IPC_CHANNELS.modulesList, null, () => controller.getModules())
  register(IPC_CHANNELS.modulesSetEnabled, moduleEnabledInputSchema, (input) =>
    controller.setModuleEnabled(input.moduleId, input.enabled)
  )
  register(IPC_CHANNELS.securityStatus, null, () => controller.getSecurityStatus())

  register(IPC_CHANNELS.datesList, null, () => controller.listDateEvents())
  register(IPC_CHANNELS.datesCreate, dateEventInputSchema, (input) =>
    controller.createDateEvent(input as DateEventInput)
  )
  register(IPC_CHANNELS.datesUpdate, dateUpdateInputSchema, (input) =>
    controller.updateDateEvent(input.id, input.patch as DateEventPatch)
  )
  register(IPC_CHANNELS.datesDelete, idInputSchema, (input) => controller.deleteDateEvent(input.id))
  register(IPC_CHANNELS.datesSetEnabled, idEnabledInputSchema, (input) =>
    controller.setDateEventEnabled(input.id, input.enabled)
  )

  register(IPC_CHANNELS.websitesList, null, () => controller.listWebsiteChecks())
  register(IPC_CHANNELS.websitesCreate, websiteInputSchema, (input) =>
    controller.createWebsiteCheck(input as WebsiteCheckInput)
  )
  register(IPC_CHANNELS.websitesUpdate, websiteUpdateInputSchema, (input) =>
    controller.updateWebsiteCheck(input.id, input.patch as WebsiteCheckPatch)
  )
  register(IPC_CHANNELS.websitesDelete, idInputSchema, (input) =>
    controller.deleteWebsiteCheck(input.id)
  )
  register(IPC_CHANNELS.websitesSetEnabled, idEnabledInputSchema, (input) =>
    controller.setWebsiteCheckEnabled(input.id, input.enabled)
  )
  register(IPC_CHANNELS.websitesCheck, idInputSchema, (input) => controller.checkWebsite(input.id))
  register(IPC_CHANNELS.websitesCheckAll, null, () => controller.checkAllWebsites())

  register(IPC_CHANNELS.deepseekSaveKey, deepSeekKeyInputSchema, (input) =>
    controller.saveDeepSeekKey(input.apiKey)
  )
  register(IPC_CHANNELS.deepseekClearKey, null, () => controller.clearDeepSeekKey())
  register(IPC_CHANNELS.deepseekBalance, null, () => controller.fetchDeepSeekBalance())

  register(IPC_CHANNELS.esaSaveCredentials, esaCredentialsInputSchema, (input) =>
    controller.saveEsaCredentials(input)
  )
  register(IPC_CHANNELS.esaClearCredentials, null, () => controller.clearEsaCredentials())
  register(IPC_CHANNELS.esaTraffic, null, () => controller.fetchEsaTraffic())

  register(IPC_CHANNELS.gmailSaveClient, gmailClientInputSchema, (input) =>
    controller.saveGmailClient(input.clientId, input.clientSecret)
  )
  register(IPC_CHANNELS.gmailConnect, null, () => controller.connectGmail())
  register(IPC_CHANNELS.gmailDisconnect, null, () => controller.disconnectGmail())
  register(IPC_CHANNELS.gmailState, null, () => controller.getGmailState())
  register(IPC_CHANNELS.gmailCheck, null, () => controller.checkGmailNow())
  register(IPC_CHANNELS.gmailSettings, gmailSettingsPatchSchema, (input) =>
    controller.updateGmailSettings(input as GmailSettingsPatch)
  )

  register(IPC_CHANNELS.moduleRefreshInterval, refreshIntervalInputSchema, (input) =>
    controller.setModuleRefreshInterval(input.moduleId, input.minutes)
  )

  register(IPC_CHANNELS.menuGetActions, null, () => controller.getMenuActions())

  register(IPC_CHANNELS.petGetState, null, () => controller.getPetViewState())
  register(IPC_CHANNELS.petBeginDrag, null, () => controller.beginDrag())
  register(IPC_CHANNELS.petDragMove, null, () => controller.dragMove())
  register(IPC_CHANNELS.petEndDrag, null, () => controller.endDrag())
  register(IPC_CHANNELS.petOpenMenu, null, () => controller.openQuickMenu())

  register(IPC_CHANNELS.menuRunAction, menuActionSchema, (actionId) => {
    controller.runMenuAction(actionId)
  })
  register(IPC_CHANNELS.menuOpenSettings, null, () => controller.openSettings())
  register(IPC_CHANNELS.menuHidePet, null, () => controller.hidePet())
  register(IPC_CHANNELS.menuQuit, null, () => controller.quitApp())
  register(IPC_CHANNELS.menuClose, null, () => controller.closeMenu())
  register(IPC_CHANNELS.bubbleDismiss, null, () => controller.dismissBubble())
}
