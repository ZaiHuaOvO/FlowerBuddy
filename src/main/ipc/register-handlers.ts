import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/api'
import type { AppController } from '../app-controller'

export type SenderValidator = (url: string | undefined) => boolean

export function registerIpcHandlers(
  controller: AppController,
  isTrustedSender: SenderValidator
): void {
  const assertTrusted = (event: IpcMainInvokeEvent): void => {
    if (!isTrustedSender(event.senderFrame?.url)) {
      throw new Error('UNTRUSTED_SENDER')
    }
  }

  ipcMain.handle(IPC_CHANNELS.appInfo, (event) => {
    assertTrusted(event)
    return controller.getAppInfo()
  })

  ipcMain.handle(IPC_CHANNELS.configGet, (event) => {
    assertTrusted(event)
    return controller.getPublicConfig()
  })

  ipcMain.handle(IPC_CHANNELS.settingsSaveApp, (event, patch: unknown) => {
    assertTrusted(event)
    return controller.updateAppSettings(patch)
  })

  ipcMain.handle(IPC_CHANNELS.settingsSavePet, (event, patch: unknown) => {
    assertTrusted(event)
    return controller.updatePetSettings(patch)
  })

  ipcMain.handle(IPC_CHANNELS.settingsImportPet, (event) => {
    assertTrusted(event)
    return controller.importPetImage()
  })

  ipcMain.handle(IPC_CHANNELS.settingsResetPosition, (event) => {
    assertTrusted(event)
    return controller.resetPetPosition()
  })

  ipcMain.handle(IPC_CHANNELS.petGetState, (event) => {
    assertTrusted(event)
    return controller.getPetViewState()
  })

  ipcMain.handle(IPC_CHANNELS.petBeginDrag, (event) => {
    assertTrusted(event)
    controller.beginDrag()
  })

  ipcMain.handle(IPC_CHANNELS.petDragMove, (event) => {
    assertTrusted(event)
    controller.dragMove()
  })

  ipcMain.handle(IPC_CHANNELS.petEndDrag, (event) => {
    assertTrusted(event)
    controller.endDrag()
  })

  ipcMain.handle(IPC_CHANNELS.petOpenMenu, (event) => {
    assertTrusted(event)
    return controller.openQuickMenu()
  })

  ipcMain.handle(IPC_CHANNELS.menuRunAction, (event, actionId: unknown) => {
    assertTrusted(event)
    controller.runMenuAction(actionId)
  })

  ipcMain.handle(IPC_CHANNELS.menuOpenSettings, (event) => {
    assertTrusted(event)
    controller.openSettings()
  })

  ipcMain.handle(IPC_CHANNELS.menuHidePet, (event) => {
    assertTrusted(event)
    controller.hidePet()
  })

  ipcMain.handle(IPC_CHANNELS.menuQuit, (event) => {
    assertTrusted(event)
    controller.quitApp()
  })

  ipcMain.handle(IPC_CHANNELS.menuClose, (event) => {
    assertTrusted(event)
    controller.closeMenu()
  })

  ipcMain.handle(IPC_CHANNELS.bubbleDismiss, (event) => {
    assertTrusted(event)
    controller.dismissBubble()
  })
}
