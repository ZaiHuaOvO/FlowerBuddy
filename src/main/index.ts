import { join } from 'node:path'
import { app, Menu, nativeTheme, powerMonitor, session, shell } from 'electron'
import { AppController } from './app-controller'
import { registerIpcHandlers } from './ipc/register-handlers'
import { createSenderValidator } from './ipc/validate-sender'
import { sanitizeDatesData } from './modules/dates/dates-data'
import { DatesService } from './modules/dates/dates-service'
import { createEmptyDatesData, type DatesData } from './modules/dates/types'
import { DeepSeekModule } from './modules/deepseek/deepseek-module'
import { EsaModule } from './modules/esa/esa-module'
import { GmailModule } from './modules/gmail/gmail-module'
import { GmailService } from './modules/gmail/gmail-service'
import { createEmptyGmailState, sanitizeGmailState, type GmailState } from './modules/gmail/types'
import { ModuleManager } from './modules/module-manager'
import { createModuleRegistry } from './modules/registry'
import {
  createEmptyWebsiteData,
  sanitizeWebsiteData,
  type WebsiteData
} from './modules/website-check/website-types'
import { WebsiteService } from './modules/website-check/website-service'
import { handlePetAssetRequests, registerPetAssetScheme } from './protocol/pet-asset-protocol'
import { TaskScheduler } from './scheduler/task-scheduler'
import { electronSafeStorageBackend } from './security/safe-storage-backend'
import { SecretStore } from './security/secret-store'
import { Logger } from './shared/logger'
import { ConfigStore } from './storage/config-store'
import { JsonStore } from './storage/json-store'

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
  const dataDirectory = join(userDataPath, 'data')

  const datesStore = new JsonStore<DatesData>(join(dataDirectory, 'dates.json'), {
    label: 'dates',
    defaults: createEmptyDatesData,
    sanitize: sanitizeDatesData,
    logger
  })
  datesStore.load()

  const websiteStore = new JsonStore<WebsiteData>(join(dataDirectory, 'website-checks.json'), {
    label: 'website-checks',
    defaults: createEmptyWebsiteData,
    sanitize: sanitizeWebsiteData,
    logger
  })
  websiteStore.load()

  const datesService = new DatesService(datesStore)
  const websiteService = new WebsiteService(websiteStore)
  const deepSeekModule = new DeepSeekModule({ secretStore, configStore })
  const esaModule = new EsaModule({ secretStore, configStore })

  const gmailStateStore = new JsonStore<GmailState>(join(dataDirectory, 'gmail-state.json'), {
    label: 'gmail-state',
    defaults: createEmptyGmailState,
    sanitize: sanitizeGmailState,
    logger
  })
  gmailStateStore.load()
  const gmailService = new GmailService({
    secretStore,
    stateStore: gmailStateStore,
    logger,
    openExternal: (url) => shell.openExternal(url)
  })
  const gmailModule = new GmailModule({
    service: gmailService,
    pollIntervalMinutes: () => configStore.get().modules.gmail.pollIntervalMinutes
  })

  const moduleManager = new ModuleManager({
    modules: createModuleRegistry({
      datesService,
      websiteService,
      deepSeekModule,
      esaModule,
      gmailModule
    }),
    configStore,
    scheduler,
    logger
  })

  const appController = new AppController({
    configStore,
    moduleManager,
    secretStore,
    datesService,
    websiteService,
    deepSeekModule,
    esaModule,
    gmailModule,
    logger,
    devServerUrl,
    rendererIndexPath,
    preloadPath,
    defaultPetPath,
    trayIconPath,
    petsDirectory: join(userDataPath, 'pets')
  })
  controller = appController
  gmailModule.setNewMailHandler((messages) => {
    appController.handleGmailNewMessages(messages)
  })

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
