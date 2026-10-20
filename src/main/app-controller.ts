import { app, BrowserWindow, screen, shell } from 'electron'
import type {
  AppInfo,
  AppSettingsPatch,
  DeepSeekBalance,
  EsaCredentialsInput,
  EsaDisplayRanges,
  EsaTrafficSummary,
  ExternalLinkId,
  IntervalReminderInput,
  IntervalReminderPatch,
  IntervalReminderSummary,
  MemoCardEdge,
  MemoCardState,
  MemoImageInfo,
  MemoInput,
  MemoPatch,
  MemoSummary,
  MenuActionSummary,
  MenuPresentation,
  ModuleId,
  ModuleSummary,
  PetSettingsPatch,
  PetUserImage,
  PetViewState,
  PublicConfig,
  RefreshableModuleId,
  SecurityStatus,
  SystemNavigation,
  UpdateStatus,
  WebsiteCheckConfig,
  WebsiteCheckInput,
  WebsiteCheckPatch
} from '../shared/api'
import { EXTERNAL_LINKS, IPC_CHANNELS } from '../shared/api'
import { ModuleActionRunner } from './actions/module-action-runner'
import { MEMO_NEW_ACTION_ID, withMemoNewAction } from './actions/menu-actions'
import type { DeepSeekModule } from './modules/deepseek/deepseek-module'
import type { EsaModule } from './modules/esa/esa-module'
import type { IntervalReminderService } from './modules/interval-reminder/interval-reminder-service'
import type { MemoService } from './modules/memo/memo-service'
import type { ModuleManager } from './modules/module-manager'
import {
  SECRET_DEEPSEEK_API_KEY,
  SECRET_ESA_ACCESS_KEY_ID,
  SECRET_ESA_ACCESS_KEY_SECRET
} from './security/secret-ids'
import type { SecretStore } from './security/secret-store'
import { AppError } from './shared/errors'
import type { LoggerLike } from './shared/logger'
import { GlobalShortcutManager } from './shortcuts/global-shortcuts'
import { ConfigStore } from './storage/config-store'
import { MemoImageError, type MemoImageStore } from './storage/memo-images'
import type { WebsiteService } from './modules/website-check/website-service'
import { AppTray } from './tray/tray'
import type { UpdateService } from './updates/update-service'
import { loadView } from './windows/load-view'
import { MemoCardWindowManager } from './windows/memo-card-window-manager'
import { OverlayWindowManager } from './windows/overlay-window-manager'
import { PetWindowController } from './windows/pet-window-controller'
import { createSettingsWindow } from './windows/settings-window'

export interface AppControllerOptions {
  configStore: ConfigStore
  moduleManager: ModuleManager
  secretStore: SecretStore
  memoService: MemoService
  memoImageStore: MemoImageStore
  intervalReminderService: IntervalReminderService
  websiteService: WebsiteService
  deepSeekModule: DeepSeekModule
  esaModule: EsaModule
  updateService: UpdateService
  logger: LoggerLike
  devServerUrl: string | undefined
  rendererIndexPath: string
  preloadPath: string
  appIconPath: string
  defaultPetPath: string
  petPresetsDirectory: string
  trayIconPath: string
  petsDirectory: string
}

export class AppController {
  private settingsWindow: BrowserWindow | null = null
  private settingsReady = false
  private pendingMemoComposer = false
  private pendingNavigation: SystemNavigation | null = null
  private tray: AppTray | null = null
  private readonly pet: PetWindowController
  private readonly overlays: OverlayWindowManager
  private readonly actions: ModuleActionRunner
  private readonly memoCards: MemoCardWindowManager
  private readonly shortcuts = new GlobalShortcutManager()
  private readonly bossShortcuts = new GlobalShortcutManager()
  private bossHidden = false
  private settingsHiddenByBoss = false
  private disposed = false

  constructor(private readonly options: AppControllerOptions) {
    this.overlays = new OverlayWindowManager({
      preloadPath: options.preloadPath,
      devServerUrl: options.devServerUrl,
      rendererIndexPath: options.rendererIndexPath,
      getPetBounds: () => this.pet.getBounds(),
      getMenuActionCount: () => this.getMenuActions().length,
      getBubbleDurationMs: () => this.config.app.bubbleDurationMs,
      isPetVisible: () => !this.disposed && this.pet.isVisible()
    })
    this.pet = new PetWindowController({
      configStore: options.configStore,
      preloadPath: options.preloadPath,
      devServerUrl: options.devServerUrl,
      rendererIndexPath: options.rendererIndexPath,
      defaultPetPath: options.defaultPetPath,
      petPresetsDirectory: options.petPresetsDirectory,
      petsDirectory: options.petsDirectory,
      getDialogParent: () => this.activeDialogParent(),
      onBoundsChanged: () => this.overlays.reposition()
    })
    this.actions = new ModuleActionRunner({
      moduleManager: options.moduleManager,
      presenter: this.overlays,
      isPetVisible: () => !this.disposed && this.pet.isVisible()
    })
    this.memoCards = new MemoCardWindowManager({
      preloadPath: options.preloadPath,
      devServerUrl: options.devServerUrl,
      rendererIndexPath: options.rendererIndexPath,
      service: options.memoService,
      isEnabled: () => this.config.modules.memo.enabled,
      isLineTasksEnabled: () => this.config.modules.memo.lineTasksEnabled,
      logger: options.logger
    })
    options.memoService.onChange(() => {
      this.memoCards.sync()
      this.notifyMemosChanged()
    })
    options.updateService.onChange((status) => {
      if (this.settingsReady) {
        this.sendSettingsEvent(IPC_CHANNELS.updatesChanged, status)
      }
    })
  }

  async start(): Promise<void> {
    this.applyLaunchAtLogin(this.config.app.launchAtLogin)
    this.pet.start()

    this.tray = new AppTray(this.options.trayIconPath, {
      openSettings: () => this.openSettings(),
      unlockCards: () => this.unlockAllMemoCards(),
      togglePet: () => this.togglePet(),
      quit: () => this.quitApp()
    })
    this.tray.create()
    this.tray.setPetVisible(this.pet.isVisible())

    this.options.moduleManager.start()
    this.memoCards.sync()
    if (!this.shortcuts.register(this.config.app.memoShortcut, () => this.openMemoComposer())) {
      this.options.logger.warn('global shortcut unavailable', {
        accelerator: this.config.app.memoShortcut
      })
    }
    if (!this.bossShortcuts.register(this.config.app.bossShortcut, () => this.toggleBossMode())) {
      this.options.logger.warn('global shortcut unavailable', {
        accelerator: this.config.app.bossShortcut
      })
    }

    screen.on('display-added', this.onDisplaysChanged)
    screen.on('display-removed', this.onDisplaysChanged)
    screen.on('display-metrics-changed', this.onDisplaysChanged)
  }

  getAppInfo(): AppInfo {
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
  }

  getPublicConfig(): PublicConfig {
    return this.options.configStore.get()
  }

  getPetViewState(): PetViewState {
    return this.pet.getViewState()
  }

  updateAppSettings(patch: AppSettingsPatch): PublicConfig {
    if (patch.memoShortcut !== undefined) {
      if (!this.shortcuts.register(patch.memoShortcut, () => this.openMemoComposer())) {
        throw new AppError('INVALID_INPUT', '快捷键不可用，可能已被其他程序占用')
      }
    }
    if (patch.bossShortcut !== undefined) {
      if (!this.bossShortcuts.register(patch.bossShortcut, () => this.toggleBossMode())) {
        throw new AppError('INVALID_INPUT', '快捷键不可用，可能已被其他程序占用')
      }
    }

    const next = this.options.configStore.updateApp(patch)

    this.pet.updateAlwaysOnTop(next.app.alwaysOnTop)
    if (patch.launchAtLogin !== undefined) {
      this.applyLaunchAtLogin(next.app.launchAtLogin)
    }
    this.pet.pushState()
    return next
  }

  updatePetSettings(patch: PetSettingsPatch): PublicConfig {
    const previous = this.config
    const next = this.options.configStore.updatePet(patch)
    if (next.pet.scale !== previous.pet.scale) {
      this.pet.resize()
    }
    return next
  }

  getModules(): ModuleSummary[] {
    return this.options.moduleManager.list()
  }

  getStartupNotice(): string | null {
    return this.options.configStore.getRecoveryNotice()
  }

  getMenuActions(): MenuActionSummary[] {
    return withMemoNewAction(
      this.options.moduleManager.getMenuActions(),
      this.options.moduleManager.list()
    )
  }

  listMemos(): MemoSummary[] {
    return this.options.memoService.list()
  }

  createMemo(input: MemoInput): MemoSummary[] {
    return this.options.memoService.create(input)
  }

  updateMemo(id: string, patch: MemoPatch): MemoSummary[] {
    return this.options.memoService.update(id, patch)
  }

  deleteMemo(id: string): MemoSummary[] {
    return this.options.memoService.remove(id)
  }

  completeMemo(id: string): MemoSummary[] {
    return this.options.memoService.complete(id)
  }

  uncompleteMemo(id: string): MemoSummary[] {
    return this.options.memoService.uncomplete(id)
  }

  setMemoAnchored(id: string, anchored: boolean): MemoSummary[] {
    return this.options.memoService.setAnchored(id, anchored)
  }

  setMemoLocked(id: string, locked: boolean): MemoSummary[] {
    return this.options.memoService.setLocked(id, locked)
  }

  setMemoLineTasks(enabled: boolean): PublicConfig {
    return this.options.configStore.setMemoLineTasks(enabled)
  }

  setMemoLineCompleted(id: string, lineId: string, completed: boolean): MemoSummary[] {
    return this.options.memoService.setLineCompleted(id, lineId, completed)
  }

  unlockAllMemoCards(): void {
    this.options.memoService.unlockAll()
  }

  setMemoAnchorNew(enabled: boolean): PublicConfig {
    return this.options.configStore.setMemoAnchorNew(enabled)
  }

  listIntervalReminders(): IntervalReminderSummary[] {
    return this.options.intervalReminderService.list()
  }

  createIntervalReminder(input: IntervalReminderInput): IntervalReminderSummary[] {
    return this.options.intervalReminderService.create(input)
  }

  updateIntervalReminder(id: string, patch: IntervalReminderPatch): IntervalReminderSummary[] {
    return this.options.intervalReminderService.update(id, patch)
  }

  deleteIntervalReminder(id: string): IntervalReminderSummary[] {
    return this.options.intervalReminderService.remove(id)
  }

  setIntervalReminderEnabled(id: string, enabled: boolean): IntervalReminderSummary[] {
    return this.options.intervalReminderService.setEnabled(id, enabled)
  }

  addMemoImage(data: ArrayBuffer | Uint8Array): MemoImageInfo {
    const buffer =
      data instanceof ArrayBuffer
        ? Buffer.from(data)
        : Buffer.from(data.buffer, data.byteOffset, data.byteLength)
    try {
      return this.options.memoImageStore.save(buffer)
    } catch (error) {
      const code = error instanceof MemoImageError ? error.code : 'UNREADABLE'
      const message =
        code === 'TOO_LARGE'
          ? '图片不能超过 10MB'
          : code === 'NOT_PNG'
            ? '粘贴的图片格式不受支持'
            : '图片无法读取'
      throw new AppError('INVALID_INPUT', message, { cause: error })
    }
  }

  discardMemoImages(ids: string[]): void {
    const referenced = this.options.memoService.referencedImageIds()
    for (const id of ids) {
      if (!referenced.has(id)) {
        this.options.memoImageStore.remove(id)
      }
    }
  }

  getMemoCardState(id: string): MemoCardState {
    return this.memoCards.getState(id)
  }

  memoCardBeginDrag(id: string): void {
    this.memoCards.beginDrag(id)
  }

  memoCardDragMove(id: string): void {
    this.memoCards.dragMove(id)
  }

  memoCardEndDrag(id: string): void {
    this.memoCards.endDrag(id)
  }

  memoCardBeginResize(id: string, edge: MemoCardEdge): void {
    this.memoCards.beginResize(id, edge)
  }

  memoCardResizeMove(id: string): void {
    this.memoCards.resizeMove(id)
  }

  memoCardEndResize(id: string): void {
    this.memoCards.endResize(id)
  }

  memoCardFitHeight(id: string, height: number): void {
    this.memoCards.fitHeight(id, height)
  }

  memoCardSetIgnoreMouse(id: string, ignore: boolean): void {
    this.memoCards.setIgnoreMouse(id, ignore)
  }

  listWebsiteChecks(): WebsiteCheckConfig[] {
    return this.options.websiteService.list()
  }

  createWebsiteCheck(input: WebsiteCheckInput): WebsiteCheckConfig[] {
    return this.options.websiteService.create(input)
  }

  updateWebsiteCheck(id: string, patch: WebsiteCheckPatch): WebsiteCheckConfig[] {
    return this.options.websiteService.update(id, patch)
  }

  deleteWebsiteCheck(id: string): WebsiteCheckConfig[] {
    return this.options.websiteService.remove(id)
  }

  setWebsiteCheckEnabled(id: string, enabled: boolean): WebsiteCheckConfig[] {
    return this.options.websiteService.setEnabled(id, enabled)
  }

  async checkWebsite(id: string): Promise<WebsiteCheckConfig[]> {
    return this.options.websiteService.checkOne(id)
  }

  async checkAllWebsites(): Promise<WebsiteCheckConfig[]> {
    const { configs } = await this.options.websiteService.checkAllEnabled()
    return configs
  }

  async saveDeepSeekKey(apiKey: string): Promise<ModuleSummary[]> {
    await this.options.secretStore.set(SECRET_DEEPSEEK_API_KEY, apiKey)
    return this.options.moduleManager.refresh()
  }

  async clearDeepSeekKey(): Promise<ModuleSummary[]> {
    await this.options.secretStore.delete(SECRET_DEEPSEEK_API_KEY)
    return this.options.moduleManager.refresh()
  }

  async fetchDeepSeekBalance(): Promise<DeepSeekBalance> {
    return this.options.deepSeekModule.queryBalance()
  }

  async saveEsaCredentials(input: EsaCredentialsInput): Promise<ModuleSummary[]> {
    await this.options.secretStore.setMany([
      { id: SECRET_ESA_ACCESS_KEY_ID, value: input.accessKeyId },
      { id: SECRET_ESA_ACCESS_KEY_SECRET, value: input.accessKeySecret }
    ])
    this.options.configStore.setEsaSiteId(input.siteId)
    return this.options.moduleManager.refresh()
  }

  async clearEsaCredentials(): Promise<ModuleSummary[]> {
    await this.options.secretStore.deleteMany([
      SECRET_ESA_ACCESS_KEY_ID,
      SECRET_ESA_ACCESS_KEY_SECRET
    ])
    this.options.configStore.setEsaSiteId('')
    return this.options.moduleManager.refresh()
  }

  async fetchEsaTraffic(): Promise<EsaTrafficSummary> {
    return this.options.esaModule.queryTraffic()
  }

  setEsaDisplayRanges(ranges: EsaDisplayRanges): PublicConfig {
    return this.options.configStore.setEsaDisplayRanges(ranges)
  }

  setModuleRefreshInterval(moduleId: RefreshableModuleId, minutes: number | null): PublicConfig {
    const config = this.options.configStore.setModuleRefreshInterval(moduleId, minutes)
    this.options.moduleManager.refresh()
    return config
  }

  setModuleEnabled(moduleId: ModuleId, enabled: boolean): ModuleSummary[] {
    const modules = this.options.moduleManager.setEnabled(moduleId, enabled)
    if (moduleId === 'memo') {
      this.memoCards.sync()
    }
    return modules
  }

  showModuleMessage(
    _moduleId: ModuleId,
    message: string,
    options?: { persistent?: boolean; id?: string }
  ): void {
    if (options?.persistent) {
      void this.actions.showPersistentBackground(message, options.id)
      return
    }
    void this.actions.showBackground(message)
  }

  acknowledgeSettingsUiReady(): void {
    this.settingsReady = true
    const navigation = this.pendingNavigation
    this.pendingNavigation = null
    if (navigation) {
      // Let a dev-mode StrictMode remount finish registering its listener.
      setTimeout(() => this.sendSettingsEvent(IPC_CHANNELS.settingsNavigate, navigation), 0)
    }
    if (this.pendingMemoComposer) {
      this.pendingMemoComposer = false
      setTimeout(() => this.sendSettingsEvent(IPC_CHANNELS.settingsOpenMemoComposer), 0)
    }
  }

  openMemoComposer(): void {
    this.pendingMemoComposer = true
    const existing = this.settingsWindow
    if (existing && !existing.isDestroyed()) {
      existing.show()
      existing.focus()
      this.navigateSettings({ tab: 'function', moduleId: 'memo' })
      if (this.settingsReady) {
        this.pendingMemoComposer = false
        setTimeout(() => this.sendSettingsEvent(IPC_CHANNELS.settingsOpenMemoComposer), 0)
      }
      return
    }
    this.openSystemPage({ tab: 'function', moduleId: 'memo' })
  }

  async getSecurityStatus(): Promise<SecurityStatus> {
    const encryptionAvailable = await this.options.secretStore.isAvailable()
    return {
      encryptionAvailable,
      message: encryptionAvailable
        ? null
        : '系统安全存储当前不可用。应用不会把任何密钥以明文写入磁盘。'
    }
  }

  getUpdateStatus(): UpdateStatus {
    return this.options.updateService.getStatus()
  }

  async checkForUpdates(): Promise<UpdateStatus> {
    return this.options.updateService.check()
  }

  async downloadUpdate(): Promise<UpdateStatus> {
    return this.options.updateService.download()
  }

  installUpdate(): void {
    this.options.updateService.install()
  }

  handleResume(): void {
    this.options.moduleManager.handleResume()
  }

  async importPetImage(): Promise<PublicConfig | null> {
    return this.pet.importImage()
  }

  selectPetAsset(assetId: string): PublicConfig {
    return this.pet.selectAsset(assetId)
  }

  listPetImages(): PetUserImage[] {
    return this.pet.listUserImages()
  }

  deletePetImage(assetId: string): PublicConfig {
    return this.pet.deleteUserImage(assetId)
  }

  renamePetImage(assetId: string, name: string): PetUserImage[] {
    return this.pet.renameUserImage(assetId, name)
  }

  resetPetPosition(): PublicConfig {
    return this.pet.resetPosition()
  }

  async openQuickMenu(): Promise<void> {
    await this.overlays.openMenu()
  }

  runMenuAction(actionId: string): void {
    this.overlays.hideMenu(true)
    if (actionId === MEMO_NEW_ACTION_ID) {
      this.openMemoComposer()
      return
    }
    void this.actions.run(actionId)
  }

  closeMenu(): void {
    this.overlays.hideMenu()
  }

  getMenuPresentation(): MenuPresentation {
    return this.overlays.getPresentation()
  }

  acknowledgeMenuOpened(): void {
    this.overlays.acknowledgeOpen()
  }

  dismissBubble(id: string): void {
    this.actions.dismiss(id)
    this.overlays.dismissBubble(id)
  }

  setBubbleHeight(height: number): void {
    this.overlays.setBubbleHeight(height)
  }

  openSettings(): void {
    this.openSystemPage({ tab: 'settings', settingsSection: 'general' })
  }

  openFunctions(): void {
    this.openSystemPage({ tab: 'function' })
  }

  openExternal(link: ExternalLinkId): void {
    void shell.openExternal(EXTERNAL_LINKS[link])
  }

  private openSystemPage(navigation: SystemNavigation): void {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.show()
      this.settingsWindow.focus()
      this.navigateSettings(navigation)
      return
    }

    this.pendingNavigation = navigation
    const window = createSettingsWindow({
      preloadPath: this.options.preloadPath,
      iconPath: this.options.appIconPath
    })
    this.settingsWindow = window
    this.settingsReady = false
    window.on('closed', () => {
      this.settingsWindow = null
      this.settingsReady = false
      this.pendingMemoComposer = false
      this.pendingNavigation = null
    })
    window.once('ready-to-show', () => {
      window.show()
      window.focus()
    })
    loadView(window, {
      devServerUrl: this.options.devServerUrl,
      rendererIndexPath: this.options.rendererIndexPath,
      view: 'settings'
    })
  }

  private navigateSettings(navigation: SystemNavigation): void {
    if (this.settingsReady) {
      this.sendSettingsEvent(IPC_CHANNELS.settingsNavigate, navigation)
    } else {
      this.pendingNavigation = navigation
    }
  }

  hidePet(): void {
    this.pet.hide()
    this.overlays.hideMenu(true)
    this.overlays.hideBubble()
    this.tray?.setPetVisible(false)
  }

  togglePet(): void {
    if (!this.pet.getWindow()) {
      return
    }
    if (this.pet.isVisible()) {
      this.hidePet()
      return
    }
    this.pet.show()
    this.tray?.setPetVisible(true)
    this.overlays.showBubbleStack()
  }

  showPet(): void {
    if (!this.pet.getWindow()) {
      return
    }
    const leavingBossMode = this.bossHidden
    this.bossHidden = false
    this.pet.show()
    this.tray?.setPetVisible(true)
    this.tray?.create()
    this.overlays.showBubbleStack()
    if (leavingBossMode) {
      this.memoCards.setVisible(true)
      if (this.settingsHiddenByBoss) {
        this.settingsHiddenByBoss = false
        const settings = this.settingsWindow
        if (settings && !settings.isDestroyed()) {
          settings.show()
        }
      }
    }
  }

  private enterBossMode(): void {
    this.bossHidden = true
    const settings = this.settingsWindow
    this.settingsHiddenByBoss = Boolean(settings && !settings.isDestroyed() && settings.isVisible())
    if (this.settingsHiddenByBoss) {
      settings?.hide()
    }
    this.memoCards.setVisible(false)
    this.hidePet()
    this.tray?.destroy()
  }

  private toggleBossMode(): void {
    if (this.bossHidden) {
      this.showPet()
      return
    }
    this.enterBossMode()
  }

  handleSecondInstance(): void {
    this.showPet()
    this.openSettings()
  }

  beginDrag(): void {
    this.pet.beginDrag()
  }

  dragMove(): void {
    // A real drag moves the pet away from the menu; a plain click must not.
    this.overlays.hideMenu(true)
    this.pet.dragMove()
  }

  endDrag(): void {
    this.pet.endDrag()
  }

  resolveAssetPath(assetId: string): string | null {
    return this.pet.resolveAssetPath(assetId)
  }

  flush(): void {
    this.options.configStore.flush()
    this.options.memoService.flush()
    this.options.intervalReminderService.flush()
    this.options.websiteService.flush()
  }

  dispose(): void {
    this.disposed = true
    this.shortcuts.dispose()
    this.bossShortcuts.dispose()
    this.options.moduleManager.stop()
    this.memoCards.dispose()
    this.actions.dispose()
    this.overlays.dispose()
    screen.removeListener('display-added', this.onDisplaysChanged)
    screen.removeListener('display-removed', this.onDisplaysChanged)
    screen.removeListener('display-metrics-changed', this.onDisplaysChanged)
    this.tray?.destroy()
    this.tray = null
  }

  private get config(): PublicConfig {
    return this.options.configStore.get()
  }

  private applyLaunchAtLogin(enabled: boolean): void {
    if (!app.isPackaged) {
      return
    }
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath
    })
  }

  private activeDialogParent(): BrowserWindow | null {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      return this.settingsWindow
    }
    return this.pet.getWindow()
  }

  private onDisplaysChanged = (): void => {
    this.pet.ensureVisible()
    this.overlays.reposition()
    this.memoCards.ensureVisible()
  }

  private notifyMemosChanged(): void {
    if (this.settingsReady) {
      this.sendSettingsEvent(IPC_CHANNELS.memosChanged)
    }
  }

  private sendSettingsEvent(channel: string, payload?: unknown): void {
    const window = this.settingsWindow
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) {
      return
    }
    if (payload === undefined) {
      window.webContents.send(channel)
    } else {
      window.webContents.send(channel, payload)
    }
  }

  quitApp(): void {
    app.quit()
  }
}
