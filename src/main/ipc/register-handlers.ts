import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import type { z } from 'zod'
import { IPC_CHANNELS } from '../../shared/api'
import type {
  AppSettingsPatch,
  IntervalReminderInput,
  IntervalReminderPatch,
  IpcResult,
  MemoInput,
  MemoPatch,
  PetSettingsPatch,
  WebsiteCheckInput,
  WebsiteCheckPatch
} from '../../shared/api'
import type { AppController } from '../app-controller'
import { AppError, toPublicError } from '../shared/errors'
import type { LoggerLike } from '../shared/logger'
import {
  appSettingsPatchSchema,
  bubbleDismissInputSchema,
  bubbleHeightInputSchema,
  deepSeekKeyInputSchema,
  esaCredentialsInputSchema,
  esaDisplayRangesSchema,
  externalLinkSchema,
  idEnabledInputSchema,
  idInputSchema,
  intervalReminderInputSchema,
  intervalReminderUpdateInputSchema,
  memoAnchorNewInputSchema,
  memoAnchoredInputSchema,
  memoCardResizeInputSchema,
  memoCardFitHeightInputSchema,
  memoDiscardImagesSchema,
  memoImageBytesSchema,
  memoInputSchema,
  memoUpdateInputSchema,
  menuActionSchema,
  moduleEnabledInputSchema,
  parseInput,
  petAssetSelectionSchema,
  petImageIdSchema,
  petRenameInputSchema,
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
  register(IPC_CHANNELS.appOpenExternal, externalLinkSchema, (input) =>
    controller.openExternal(input.link)
  )

  register(IPC_CHANNELS.settingsSaveApp, appSettingsPatchSchema, (patch) =>
    controller.updateAppSettings(patch as AppSettingsPatch)
  )
  register(IPC_CHANNELS.settingsSavePet, petSettingsPatchSchema, (patch) =>
    controller.updatePetSettings(patch as PetSettingsPatch)
  )
  register(IPC_CHANNELS.settingsImportPet, null, () => controller.importPetImage())
  register(IPC_CHANNELS.settingsListPetImages, null, () => controller.listPetImages())
  register(IPC_CHANNELS.settingsSelectPetAsset, petAssetSelectionSchema, (input) =>
    controller.selectPetAsset(input.assetId)
  )
  register(IPC_CHANNELS.settingsDeletePetImage, petImageIdSchema, (input) =>
    controller.deletePetImage(input.assetId)
  )
  register(IPC_CHANNELS.settingsRenamePetImage, petRenameInputSchema, (input) =>
    controller.renamePetImage(input.assetId, input.name)
  )
  register(IPC_CHANNELS.settingsResetPosition, null, () => controller.resetPetPosition())

  register(IPC_CHANNELS.modulesList, null, () => controller.getModules())
  register(IPC_CHANNELS.modulesSetEnabled, moduleEnabledInputSchema, (input) =>
    controller.setModuleEnabled(input.moduleId, input.enabled)
  )
  register(IPC_CHANNELS.securityStatus, null, () => controller.getSecurityStatus())

  register(IPC_CHANNELS.memosList, null, () => controller.listMemos())
  register(IPC_CHANNELS.memosCreate, memoInputSchema, (input) =>
    controller.createMemo(input as MemoInput)
  )
  register(IPC_CHANNELS.memosUpdate, memoUpdateInputSchema, (input) =>
    controller.updateMemo(input.id, input.patch as MemoPatch)
  )
  register(IPC_CHANNELS.memosDelete, idInputSchema, (input) => controller.deleteMemo(input.id))
  register(IPC_CHANNELS.memosComplete, idInputSchema, (input) => controller.completeMemo(input.id))
  register(IPC_CHANNELS.memosUncomplete, idInputSchema, (input) =>
    controller.uncompleteMemo(input.id)
  )
  register(IPC_CHANNELS.memosSetAnchored, memoAnchoredInputSchema, (input) =>
    controller.setMemoAnchored(input.id, input.anchored)
  )
  register(IPC_CHANNELS.memosAddImage, memoImageBytesSchema, (input) =>
    controller.addMemoImage(input.data)
  )
  register(IPC_CHANNELS.memosDiscardImages, memoDiscardImagesSchema, (input) =>
    controller.discardMemoImages(input.ids)
  )

  register(IPC_CHANNELS.memosSetAnchorNew, memoAnchorNewInputSchema, (input) =>
    controller.setMemoAnchorNew(input.enabled)
  )

  register(IPC_CHANNELS.intervalRemindersList, null, () => controller.listIntervalReminders())
  register(IPC_CHANNELS.intervalRemindersCreate, intervalReminderInputSchema, (input) =>
    controller.createIntervalReminder(input as IntervalReminderInput)
  )
  register(IPC_CHANNELS.intervalRemindersUpdate, intervalReminderUpdateInputSchema, (input) =>
    controller.updateIntervalReminder(input.id, input.patch as IntervalReminderPatch)
  )
  register(IPC_CHANNELS.intervalRemindersDelete, idInputSchema, (input) =>
    controller.deleteIntervalReminder(input.id)
  )
  register(IPC_CHANNELS.intervalRemindersSetEnabled, idEnabledInputSchema, (input) =>
    controller.setIntervalReminderEnabled(input.id, input.enabled)
  )

  register(IPC_CHANNELS.settingsUiReady, null, () => controller.acknowledgeSettingsUiReady())

  register(IPC_CHANNELS.memoCardGetState, idInputSchema, (input) =>
    controller.getMemoCardState(input.id)
  )
  register(IPC_CHANNELS.memoCardBeginDrag, idInputSchema, (input) =>
    controller.memoCardBeginDrag(input.id)
  )
  register(IPC_CHANNELS.memoCardDragMove, idInputSchema, (input) =>
    controller.memoCardDragMove(input.id)
  )
  register(IPC_CHANNELS.memoCardEndDrag, idInputSchema, (input) =>
    controller.memoCardEndDrag(input.id)
  )
  register(IPC_CHANNELS.memoCardBeginResize, memoCardResizeInputSchema, (input) =>
    controller.memoCardBeginResize(input.id, input.edge)
  )
  register(IPC_CHANNELS.memoCardResizeMove, idInputSchema, (input) =>
    controller.memoCardResizeMove(input.id)
  )
  register(IPC_CHANNELS.memoCardEndResize, idInputSchema, (input) =>
    controller.memoCardEndResize(input.id)
  )
  register(IPC_CHANNELS.memoCardFitHeight, memoCardFitHeightInputSchema, (input) =>
    controller.memoCardFitHeight(input.id, input.height)
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
  register(IPC_CHANNELS.esaSetDisplayRanges, esaDisplayRangesSchema, (input) =>
    controller.setEsaDisplayRanges(input)
  )

  register(IPC_CHANNELS.moduleRefreshInterval, refreshIntervalInputSchema, (input) =>
    controller.setModuleRefreshInterval(input.moduleId, input.minutes)
  )

  register(IPC_CHANNELS.menuGetActions, null, () => controller.getMenuActions())
  register(IPC_CHANNELS.menuReady, null, () => controller.getMenuPresentation())
  register(IPC_CHANNELS.menuOpened, null, () => controller.acknowledgeMenuOpened())

  register(IPC_CHANNELS.petGetState, null, () => controller.getPetViewState())
  register(IPC_CHANNELS.petBeginDrag, null, () => controller.beginDrag())
  register(IPC_CHANNELS.petDragMove, null, () => controller.dragMove())
  register(IPC_CHANNELS.petEndDrag, null, () => controller.endDrag())
  register(IPC_CHANNELS.petOpenMenu, null, () => controller.openQuickMenu())

  register(IPC_CHANNELS.menuRunAction, menuActionSchema, (actionId) => {
    controller.runMenuAction(actionId)
  })
  register(IPC_CHANNELS.menuOpenSettings, null, () => controller.openSettings())
  register(IPC_CHANNELS.menuOpenFunctions, null, () => controller.openFunctions())
  register(IPC_CHANNELS.menuHidePet, null, () => controller.hidePet())
  register(IPC_CHANNELS.menuQuit, null, () => controller.quitApp())
  register(IPC_CHANNELS.menuClose, null, () => controller.closeMenu())
  register(IPC_CHANNELS.bubbleDismiss, bubbleDismissInputSchema, (input) =>
    controller.dismissBubble(input.id)
  )
  register(IPC_CHANNELS.bubbleSetHeight, bubbleHeightInputSchema, (input) =>
    controller.setBubbleHeight(input.height)
  )
}
