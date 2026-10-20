import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { app, Menu, nativeTheme, powerMonitor, session } from 'electron'
import { AppController } from './app-controller'
import { registerIpcHandlers } from './ipc/register-handlers'
import { createSenderValidator } from './ipc/validate-sender'
import { DeepSeekModule } from './modules/deepseek/deepseek-module'
import { EsaModule } from './modules/esa/esa-module'
import { IntervalReminderService } from './modules/interval-reminder/interval-reminder-service'
import { sanitizeIntervalReminderData } from './modules/interval-reminder/reminder-data'
import {
  createEmptyIntervalReminderData,
  type IntervalReminderData
} from './modules/interval-reminder/types'
import { sanitizeMemoData } from './modules/memo/memo-data'
import { MemoService } from './modules/memo/memo-service'
import { createEmptyMemoData, type MemoData } from './modules/memo/types'
import { ModuleManager } from './modules/module-manager'
import { createModuleRegistry } from './modules/registry'
import {
  createEmptyWebsiteData,
  sanitizeWebsiteData,
  type WebsiteData
} from './modules/website-check/website-types'
import { WebsiteService } from './modules/website-check/website-service'
import { registerAppSchemes } from './protocol/app-schemes'
import { handleMemoImageRequests } from './protocol/memo-image-protocol'
import { handlePetAssetRequests } from './protocol/pet-asset-protocol'
import { TaskScheduler } from './scheduler/task-scheduler'
import { electronSafeStorageBackend } from './security/safe-storage-backend'
import { SecretStore } from './security/secret-store'
import { Logger } from './shared/logger'
import { ConfigStore } from './storage/config-store'
import { JsonStore } from './storage/json-store'
import { MemoImageStore } from './storage/memo-images'
import { installNavigationGuards, resolveDevServerUrl } from './security/navigation-guards'
import { createElectronUpdaterAdapter } from './updates/electron-updater-adapter'
import { sanitizeUpdateUrlOverride } from './updates/update-feed'
import { UpdateService } from './updates/update-service'

const APP_USER_MODEL_ID = 'com.flowerbuddy.app'
const LEGACY_GMAIL_SECRET_IDS = ['gmail.clientId', 'gmail.clientSecret', 'gmail.refreshToken']

// The product is now called 花伴. Keep the original userData directory so
// existing settings, credentials, pets and logs survive the rename. An explicit
// --user-data-dir (used by tests) still wins.
if (!app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', join(app.getPath('appData'), 'FlowerBuddy'))
}

const devServerUrl = resolveDevServerUrl(app.isPackaged, process.env['ELECTRON_RENDERER_URL'])
const rendererIndexPath = join(__dirname, '../renderer/index.html')
const preloadPath = join(__dirname, '../preload/index.js')
const appRoot = app.getAppPath()
const defaultPetPath = join(appRoot, 'assets', 'default-pet', 'flower.png')
const petPresetsDirectory = join(appRoot, 'assets', 'pet-presets')
const trayIconPath = app.isPackaged
  ? join(process.resourcesPath, 'assets', 'tray-icon.png')
  : join(appRoot, 'assets', 'tray-icon.png')
const appIconPath = app.isPackaged
  ? join(process.resourcesPath, 'assets', 'app-icon.png')
  : join(appRoot, 'assets', 'app-icon.png')

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

  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() === 'window') {
      installNavigationGuards(contents, { devServerUrl, rendererIndexPath })
    }
  })

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
  void secretStore.deleteMany(LEGACY_GMAIL_SECRET_IDS).catch(() => {
    logger.warn('legacy gmail secrets could not be removed')
  })

  const scheduler = new TaskScheduler({ logger })
  const dataDirectory = join(userDataPath, 'data')

  // The dates module was replaced by memos; its old data is intentionally discarded.
  const legacyDatesPath = join(dataDirectory, 'dates.json')
  if (existsSync(legacyDatesPath)) {
    try {
      rmSync(legacyDatesPath, { force: true })
      logger.info('legacy dates data removed')
    } catch {
      logger.warn('legacy dates data could not be removed')
    }
  }

  const legacyGmailStatePath = join(dataDirectory, 'gmail-state.json')
  if (existsSync(legacyGmailStatePath)) {
    try {
      rmSync(legacyGmailStatePath, { force: true })
      logger.info('legacy gmail data removed')
    } catch {
      logger.warn('legacy gmail data could not be removed')
    }
  }

  const memoStore = new JsonStore<MemoData>(join(dataDirectory, 'memos.json'), {
    label: 'memos',
    defaults: createEmptyMemoData,
    sanitize: (raw) =>
      sanitizeMemoData(raw, {
        defaultLineTasksEnabled: configStore.get().modules.memo.lineTasksEnabled
      }),
    logger
  })
  memoStore.load()

  const websiteStore = new JsonStore<WebsiteData>(join(dataDirectory, 'website-checks.json'), {
    label: 'website-checks',
    defaults: createEmptyWebsiteData,
    sanitize: sanitizeWebsiteData,
    logger
  })
  websiteStore.load()

  const intervalReminderStore = new JsonStore<IntervalReminderData>(
    join(dataDirectory, 'interval-reminders.json'),
    {
      label: 'interval-reminders',
      defaults: createEmptyIntervalReminderData,
      sanitize: sanitizeIntervalReminderData,
      logger
    }
  )
  intervalReminderStore.load()

  const memoImageStore = new MemoImageStore(join(userDataPath, 'memo-images'))
  const memoService = new MemoService(memoStore, memoImageStore)
  memoImageStore.cleanupOrphans(memoService.referencedImageIds())
  const intervalReminderService = new IntervalReminderService(intervalReminderStore)
  const websiteService = new WebsiteService(websiteStore)
  const deepSeekModule = new DeepSeekModule({ secretStore, configStore })
  const esaModule = new EsaModule({ secretStore, configStore })

  const moduleManager = new ModuleManager({
    modules: createModuleRegistry({
      memoService,
      intervalReminderService,
      websiteService,
      deepSeekModule,
      esaModule
    }),
    configStore,
    scheduler,
    logger,
    notify: (moduleId, message, options) =>
      controller?.showModuleMessage(moduleId, message, options)
  })

  const rawUpdateUrl = process.env['FLOWERBUDDY_UPDATE_URL']
  const updateUrl = sanitizeUpdateUrlOverride(rawUpdateUrl)
  if (rawUpdateUrl && !updateUrl) {
    logger.warn('ignoring update feed override; only HTTPS or loopback HTTP is allowed')
  }
  const portable = Boolean(
    process.env['PORTABLE_EXECUTABLE_DIR'] || process.env['PORTABLE_EXECUTABLE_FILE']
  )
  const updatesSupported = app.isPackaged && process.platform === 'win32' && !portable
  const updateUnsupportedMessage = !app.isPackaged
    ? '开发环境不检查更新。'
    : process.platform !== 'win32'
      ? '当前平台不支持应用内更新。'
      : portable
        ? '便携版请手动下载新版本。'
        : ''
  const updateService = new UpdateService({
    adapter: updatesSupported
      ? createElectronUpdaterAdapter(
          updateUrl
            ? { provider: 'generic', url: updateUrl }
            : { provider: 'github', owner: 'ZaiHuaOvO', repo: 'FlowerBuddy' }
        )
      : null,
    supported: updatesSupported,
    unsupportedMessage: updateUnsupportedMessage,
    onError: (message) => logger.warn('update failed', { message })
  })

  const appController = new AppController({
    configStore,
    moduleManager,
    secretStore,
    memoService,
    memoImageStore,
    intervalReminderService,
    websiteService,
    deepSeekModule,
    esaModule,
    updateService,
    logger,
    devServerUrl,
    rendererIndexPath,
    preloadPath,
    defaultPetPath,
    petPresetsDirectory,
    trayIconPath,
    appIconPath,
    petsDirectory: join(userDataPath, 'pets')
  })
  controller = appController

  void secretStore.isAvailable().then((available) => {
    logger.info('secret storage availability checked', { available })
  })

  handlePetAssetRequests((assetId) => appController.resolveAssetPath(assetId))
  handleMemoImageRequests((imageId) => memoImageStore.resolvePath(imageId))
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
  registerAppSchemes()

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
      console.error('Failed to start 花伴', error)
      app.quit()
    })
}
