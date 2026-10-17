import { join } from 'node:path'
import { app, Menu, nativeTheme, powerMonitor, session } from 'electron'
import { AppController } from './app-controller'
import { registerIpcHandlers } from './ipc/register-handlers'
import { createSenderValidator } from './ipc/validate-sender'
import { ModuleManager } from './modules/module-manager'
import { createModuleRegistry } from './modules/registry'
import { handlePetAssetRequests, registerPetAssetScheme } from './protocol/pet-asset-protocol'
import { TaskScheduler } from './scheduler/task-scheduler'
import { electronSafeStorageBackend } from './security/safe-storage-backend'
import { SecretStore } from './security/secret-store'
import { Logger } from './shared/logger'
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
let appLogger: Logger | null = null

async function bootstrap(): Promise<void> {
  app.setAppUserModelId(APP_USER_MODEL_ID)
  nativeTheme.themeSource = 'light'
  Menu.setApplicationMenu(null)

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  session.defaultSession.setPermissionCheckHandler(() => false)

  const userDataPath = app.getPath('userData')
  const logger = new Logger(join(userDataPath, 'logs'))
  appLogger = logger
  logger.info('application starting', {
    version: app.getVersion(),
    packaged: app.isPackaged
  })

  const configStore = new ConfigStore(join(userDataPath, 'config.json'), { logger })
  configStore.load()

  const secretStore = new SecretStore(
    join(userDataPath, 'secrets.enc.json'),
    electronSafeStorageBackend,
    logger
  )
  secretStore.load()

  const scheduler = new TaskScheduler({ logger })
  const moduleManager = new ModuleManager({
    modules: createModuleRegistry(),
    configStore,
    scheduler,
    logger
  })

  const appController = new AppController({
    configStore,
    moduleManager,
    secretStore,
    logger,
    devServerUrl,
    rendererIndexPath,
    preloadPath,
    defaultPetPath,
    trayIconPath,
    petsDirectory: join(userDataPath, 'pets')
  })
  controller = appController

  void secretStore.isAvailable().then((available) => {
    logger.info('secret storage availability checked', { available })
  })

  handlePetAssetRequests((assetId) => appController.resolveAssetPath(assetId))
  registerIpcHandlers({
    controller: appController,
    isTrustedSender: createSenderValidator({ devServerUrl, rendererIndexPath }),
    logger
  })

  powerMonitor.on('resume', () => {
    logger.info('system resumed')
    appController.handleResume()
  })

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
    appLogger?.info('application stopping')
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
