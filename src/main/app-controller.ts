import { app, BrowserWindow, Notification, screen } from 'electron'
import type {
  AppInfo,
  AppSettingsPatch,
  DateEventInput,
  DateEventPatch,
  DateEventSummary,
  DeepSeekBalance,
  EsaCredentialsInput,
  EsaTraffic,
  GmailPollSummary,
  GmailSettingsPatch,
  GmailStateView,
  MenuActionSummary,
  MenuPresentation,
  ModuleId,
  ModuleSummary,
  PetSettingsPatch,
  PetViewState,
  PublicConfig,
  RefreshableModuleId,
  SecurityStatus,
  WebsiteCheckConfig,
  WebsiteCheckInput,
  WebsiteCheckPatch
} from '../shared/api'
import { ModuleActionRunner } from './actions/module-action-runner'
import type { DatesService } from './modules/dates/dates-service'
import type { DeepSeekModule } from './modules/deepseek/deepseek-module'
import type { EsaModule } from './modules/esa/esa-module'
import type { GmailModule } from './modules/gmail/gmail-module'
import type { GmailMessageSummary } from './modules/gmail/types'
import type { ModuleManager } from './modules/module-manager'
import {
  SECRET_DEEPSEEK_API_KEY,
  SECRET_ESA_ACCESS_KEY_ID,
  SECRET_ESA_ACCESS_KEY_SECRET
} from './security/secret-ids'
import type { SecretStore } from './security/secret-store'
import type { LoggerLike } from './shared/logger'
import { ConfigStore } from './storage/config-store'
import type { WebsiteService } from './modules/website-check/website-service'
import { AppTray } from './tray/tray'
import { loadView } from './windows/load-view'
import { OverlayWindowManager } from './windows/overlay-window-manager'
import { PetWindowController } from './windows/pet-window-controller'
import { createSettingsWindow } from './windows/settings-window'

export interface AppControllerOptions {
  configStore: ConfigStore
  moduleManager: ModuleManager
  secretStore: SecretStore
  datesService: DatesService
  websiteService: WebsiteService
  deepSeekModule: DeepSeekModule
  esaModule: EsaModule
  gmailModule: GmailModule
  logger: LoggerLike
  devServerUrl: string | undefined
  rendererIndexPath: string
  preloadPath: string
  appIconPath: string
  defaultPetPath: string
  trayIconPath: string
  petsDirectory: string
}

export class AppController {
  private settingsWindow: BrowserWindow | null = null
  private tray: AppTray | null = null
  private readonly pet: PetWindowController
  private readonly overlays: OverlayWindowManager
  private readonly actions: ModuleActionRunner
  private disposed = false

  constructor(private readonly options: AppControllerOptions) {
    this.overlays = new OverlayWindowManager({
      preloadPath: options.preloadPath,
      devServerUrl: options.devServerUrl,
      rendererIndexPath: options.rendererIndexPath,
      getPetBounds: () => this.pet.getBounds(),
      getMenuActionCount: () => this.getMenuActions().length
    })
    this.pet = new PetWindowController({
      configStore: options.configStore,
      preloadPath: options.preloadPath,
      devServerUrl: options.devServerUrl,
      rendererIndexPath: options.rendererIndexPath,
      defaultPetPath: options.defaultPetPath,
      petsDirectory: options.petsDirectory,
      getDialogParent: () => this.activeDialogParent(),
      onBoundsChanged: () => this.overlays.reposition()
    })
    this.actions = new ModuleActionRunner({
      moduleManager: options.moduleManager,
      presenter: this.overlays,
      getBubbleDurationMs: () => this.config.app.bubbleDurationMs,
      isPetVisible: () => !this.disposed && this.pet.isVisible()
    })
  }

  async start(): Promise<void> {
    this.applyLaunchAtLogin(this.config.app.launchAtLogin)
    this.pet.start()

    this.tray = new AppTray(this.options.trayIconPath, {
      openSettings: () => this.openSettings(),
      togglePet: () => this.togglePet(),
      quit: () => this.quitApp()
    })
    this.tray.create()
    this.tray.setPetVisible(this.pet.isVisible())

    this.options.moduleManager.start()

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
    return this.options.moduleManager.getMenuActions()
  }

  listDateEvents(): DateEventSummary[] {
    return this.options.datesService.list()
  }

  createDateEvent(input: DateEventInput): DateEventSummary[] {
    return this.options.datesService.create(input)
  }

  updateDateEvent(id: string, patch: DateEventPatch): DateEventSummary[] {
    return this.options.datesService.update(id, patch)
  }

  deleteDateEvent(id: string): DateEventSummary[] {
    return this.options.datesService.remove(id)
  }

  setDateEventEnabled(id: string, enabled: boolean): DateEventSummary[] {
    return this.options.datesService.setEnabled(id, enabled)
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

  async fetchEsaTraffic(): Promise<EsaTraffic> {
    return this.options.esaModule.queryTraffic()
  }

  setModuleRefreshInterval(moduleId: RefreshableModuleId, minutes: number | null): PublicConfig {
    const config = this.options.configStore.setModuleRefreshInterval(moduleId, minutes)
    this.options.moduleManager.refresh()
    return config
  }

  async saveGmailClient(clientId: string, clientSecret: string): Promise<ModuleSummary[]> {
    await this.options.gmailModule.saveClientCredentials(clientId, clientSecret)
    return this.options.moduleManager.refresh()
  }

  async connectGmail(): Promise<{
    modules: ModuleSummary[]
    emailAddress: string
  }> {
    const { emailAddress } = await this.options.gmailModule.connect()
    const modules = this.options.moduleManager.refresh()
    return { modules, emailAddress }
  }

  async disconnectGmail(): Promise<ModuleSummary[]> {
    await this.options.gmailModule.disconnect()
    return this.options.moduleManager.refresh()
  }

  getGmailState(): GmailStateView {
    return this.options.gmailModule.getStateView()
  }

  async checkGmailNow(): Promise<GmailPollSummary> {
    return this.options.gmailModule.checkNow()
  }

  updateGmailSettings(patch: GmailSettingsPatch): PublicConfig {
    const config = this.options.configStore.updateGmailSettings(patch)
    this.options.moduleManager.refresh()
    return config
  }

  handleGmailNewMessages(messages: GmailMessageSummary[]): void {
    const first = messages[0]
    if (!first) {
      return
    }
    const config = this.config
    if (!config.modules.gmail.enabled) {
      return
    }

    const hideSubject = config.modules.gmail.hideSubject
    const body = hideSubject
      ? messages.length === 1
        ? '收到一封新邮件'
        : `收到 ${messages.length} 封新邮件`
      : messages.length === 1
        ? `${first.from || '未知发件人'}：${first.subject || '无主题'}`
        : `收到 ${messages.length} 封新邮件（最新：${first.from || '未知发件人'}）`

    if (config.modules.gmail.notifyNewMail && Notification.isSupported()) {
      const notification = new Notification({
        title: '花伴 · 新邮件',
        body
      })
      notification.on('click', () => this.openSettings())
      notification.show()
    }

    void this.actions.showBackground(body)
    this.options.logger.info('gmail new messages', { count: messages.length })
  }

  setModuleEnabled(moduleId: ModuleId, enabled: boolean): ModuleSummary[] {
    return this.options.moduleManager.setEnabled(moduleId, enabled)
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

  handleResume(): void {
    this.options.moduleManager.handleResume()
  }

  async importPetImage(): Promise<PublicConfig | null> {
    return this.pet.importImage()
  }

  resetPetPosition(): PublicConfig {
    return this.pet.resetPosition()
  }

  async openQuickMenu(): Promise<void> {
    await this.overlays.openMenu()
  }

  runMenuAction(actionId: string): void {
    this.overlays.hideMenu(true)
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

  dismissBubble(): void {
    this.actions.dismiss()
  }

  openSettings(): void {
    this.overlays.hideMenu(true)
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.show()
      this.settingsWindow.focus()
      return
    }

    const window = createSettingsWindow({
      preloadPath: this.options.preloadPath,
      iconPath: this.options.appIconPath
    })
    this.settingsWindow = window
    window.on('closed', () => {
      this.settingsWindow = null
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
  }

  showPet(): void {
    if (!this.pet.getWindow()) {
      return
    }
    this.pet.show()
    this.tray?.setPetVisible(true)
  }

  handleSecondInstance(): void {
    this.showPet()
    this.openSettings()
  }

  beginDrag(): void {
    this.pet.beginDrag()
    this.overlays.hideMenu(true)
  }

  dragMove(): void {
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
    this.options.datesService.flush()
    this.options.websiteService.flush()
    this.options.gmailModule.flush()
  }

  dispose(): void {
    this.disposed = true
    this.options.moduleManager.stop()
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
  }

  quitApp(): void {
    app.quit()
  }
}
