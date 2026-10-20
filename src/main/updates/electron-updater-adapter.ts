import { autoUpdater } from 'electron-updater'
import type { UpdateAdapter } from './update-service'

export type UpdateFeed =
  { provider: 'github'; owner: string; repo: string } | { provider: 'generic'; url: string }

export function createElectronUpdaterAdapter(feed: UpdateFeed): UpdateAdapter {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  autoUpdater.allowDowngrade = false
  autoUpdater.setFeedURL(feed as Parameters<typeof autoUpdater.setFeedURL>[0])

  return {
    checkForUpdates: async () => {
      await autoUpdater.checkForUpdates()
    },
    downloadUpdate: async () => {
      await autoUpdater.downloadUpdate()
    },
    quitAndInstall: () => {
      autoUpdater.quitAndInstall()
    },
    onChecking: (listener) => {
      autoUpdater.on('checking-for-update', () => listener())
    },
    onAvailable: (listener) => {
      autoUpdater.on('update-available', (info) => listener(info.version))
    },
    onNotAvailable: (listener) => {
      autoUpdater.on('update-not-available', () => listener())
    },
    onProgress: (listener) => {
      autoUpdater.on('download-progress', (progress) => listener(progress.percent))
    },
    onDownloaded: (listener) => {
      autoUpdater.on('update-downloaded', (info) => listener(info.version))
    },
    onError: (listener) => {
      autoUpdater.on('error', (error) => listener(error.message))
    }
  }
}
