import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import type { z } from 'zod'
import { IPC_CHANNELS } from '../../shared/api'
import type { AppSettingsPatch, IpcResult, PetSettingsPatch } from '../../shared/api'
import type { AppController } from '../app-controller'
import { AppError, toPublicError } from '../shared/errors'
import type { LoggerLike } from '../shared/logger'
import {
  appSettingsPatchSchema,
  menuActionSchema,
  moduleEnabledInputSchema,
  parseInput,
  petSettingsPatchSchema
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
