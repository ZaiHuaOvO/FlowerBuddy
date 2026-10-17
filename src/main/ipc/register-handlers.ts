import { app, ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS, type AppInfo } from '../../shared/api'

export type SenderValidator = (url: string | undefined) => boolean

export function registerIpcHandlers(isTrustedSender: SenderValidator): void {
  ipcMain.handle(IPC_CHANNELS.appInfo, (event: IpcMainInvokeEvent): AppInfo => {
    if (!isTrustedSender(event.senderFrame?.url)) {
      throw new Error('UNTRUSTED_SENDER')
    }

    return {
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron ?? 'unknown',
      chrome: process.versions.chrome ?? 'unknown',
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      packaged: app.isPackaged
    }
  })
}
