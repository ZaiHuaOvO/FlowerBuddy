import { join } from 'node:path'
import { app, Menu, nativeTheme, session } from 'electron'
import { AppController } from './app-controller'
import { registerIpcHandlers } from './ipc/register-handlers'
import { createSenderValidator } from './ipc/validate-sender'
import { handlePetAssetRequests, registerPetAssetScheme } from './protocol/pet-asset-protocol'
import { ConfigStore } from './storage/config-store'

const APP_USER_MODEL_ID = 'com.flowerbuddy.app'
const devServerUrl = process.env['ELECTRON_RENDERER_URL']
const rendererIndexPath = join(__dirname, '../renderer/index.html')
const preloadPath = join(__dirname, '../preload/index.js')
const appRoot = app.getAppPath()
const defaultPetPath = join(appRoot, 'assets', 'default-pet', 'flower.png')
const trayIconPath = app.isPackaged
  ? join(process.resourcesPath, 'assets', 'tray-icon.png')
  : join(appRoot, 'assets', 'tray-icon.png')

let controller: AppController | null = null

async function bootstrap(): Promise<void> {
  app.setAppUserModelId(APP_USER_MODEL_ID)
  nativeTheme.themeSource = 'light'
  Menu.setApplicationMenu(null)

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  session.defaultSession.setPermissionCheckHandler(() => false)

  const userDataPath = app.getPath('userData')
  const configStore = new ConfigStore(join(userDataPath, 'config.json'))
  configStore.load()

  const appController = new AppController({
    configStore,
    devServerUrl,
    rendererIndexPath,
    preloadPath,
    defaultPetPath,
    trayIconPath,
    petsDirectory: join(userDataPath, 'pets')
  })
  controller = appController

  handlePetAssetRequests((assetId) => appController.resolveAssetPath(assetId))
  registerIpcHandlers(appController, createSenderValidator({ devServerUrl, rendererIndexPath }))
  await appController.start()
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  registerPetAssetScheme()

  app.on('second-instance', () => {
    controller?.handleSecondInstance()
  })

  app.on('before-quit', () => {
    controller?.flush()
    controller?.dispose()
  })

  // Closing every window leaves the pet running in the tray by design.
  app.on('window-all-closed', () => {})

  app
    .whenReady()
    .then(bootstrap)
    .catch((error: unknown) => {
      console.error('Failed to start FlowerBuddy', error)
      app.quit()
    })
}
