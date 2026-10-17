import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { app, BrowserWindow, dialog, Notification, screen } from 'electron'
import type { OpenDialogOptions } from 'electron'
import { IPC_CHANNELS } from '../shared/api'
import type {
  AppInfo,
  AppSettingsPatch,
  BubblePayload,
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
  ModuleId,
  ModuleSummary,
  PetAssetInfo,
  PetSettingsPatch,
  PetViewState,
  PublicConfig,
  RefreshableModuleId,
  SecurityStatus,
  WebsiteCheckConfig,
  WebsiteCheckInput,
  WebsiteCheckPatch
} from '../shared/api'
import type { DatesService } from './modules/dates/dates-service'
import type { DeepSeekModule } from './modules/deepseek/deepseek-module'
import type { EsaModule } from './modules/esa/esa-module'
import type { GmailModule } from './modules/gmail/gmail-module'
import type { GmailMessageSummary } from './modules/gmail/types'
import type { ModuleManager } from './modules/module-manager'
import { PET_ASSET_SCHEME } from './protocol/pet-asset-protocol'
import {
  SECRET_DEEPSEEK_API_KEY,
  SECRET_ESA_ACCESS_KEY_ID,
  SECRET_ESA_ACCESS_KEY_SECRET
} from './security/secret-ids'
import type { SecretStore } from './security/secret-store'
import { toPublicError } from './shared/errors'
import type { LoggerLike } from './shared/logger'
import { ConfigStore } from './storage/config-store'
import type { WebsiteService } from './modules/website-check/website-service'
import {
  PetAssetError,
  importPetFile,
  readPngInfo,
  resolvePetAssetPath
} from './storage/pet-assets'
import { AppTray } from './tray/tray'
import {
  BUBBLE_SIZE,
  MENU_SIZE,
  createBubbleWindow,
  createMenuWindow
} from './windows/overlay-windows'
import {
  type Rect,
  clampToVisibleArea,
  computePetWindowSize,
  defaultPetPosition,
  placeOverlay,
  resizeKeepingBottomCenter
} from './windows/geometry'
import { loadView, waitForLoad } from './windows/load-view'
import { createPetWindow } from './windows/pet-window'
import { createSettingsWindow } from './windows/settings-window'

const MODULE_ACTION_TIMEOUT_MS = 45000
const MENU_REOPEN_GUARD_MS = 250
const FALLBACK_PET_DIMENSION = 160

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
  defaultPetPath: string
  trayIconPath: string
  petsDirectory: string
}

export class AppController {
  private petWindow: BrowserWindow | null = null
  private settingsWindow: BrowserWindow | null = null
  private menuWindow: BrowserWindow | null = null
  private bubbleWindow: BrowserWindow | null = null
  private tray: AppTray | null = null
  private asset: PetAssetInfo
  private dragOffset: { x: number; y: number } | null = null
  private currentRequestId: string | null = null
  private safetyTimer: ReturnType<typeof setTimeout> | null = null
  private hideTimer: ReturnType<typeof setTimeout> | null = null
  private lastMenuHiddenAt = 0
  private disposed = false

  constructor(private readonly options: AppControllerOptions) {
    this.asset = this.loadAsset()
  }

  async start(): Promise<void> {
    this.applyLaunchAtLogin(this.config.app.launchAtLogin)
    this.createPetWindow()

    this.tray = new AppTray(this.options.trayIconPath, {
      openSettings: () => this.openSettings(),
      togglePet: () => this.togglePet(),
      quit: () => this.quitApp()
    })
    this.tray.create()
    this.tray.setPetVisible(this.petWindow?.isVisible() ?? false)

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
    return {
      asset: { ...this.asset },
      bounceAnimation: this.config.app.bounceAnimation
    }
  }

  updateAppSettings(patch: AppSettingsPatch): PublicConfig {
    const next = this.options.configStore.updateApp(patch)

    if (this.petWindow && !this.petWindow.isDestroyed()) {
      this.petWindow.setAlwaysOnTop(next.app.alwaysOnTop)
    }
    if (patch.launchAtLogin !== undefined) {
      this.applyLaunchAtLogin(next.app.launchAtLogin)
    }
    this.pushPetState()
    return next
  }

  updatePetSettings(patch: PetSettingsPatch): PublicConfig {
    const previous = this.config
    const next = this.options.configStore.updatePet(patch)
    if (next.pet.scale !== previous.pet.scale) {
      this.resizePetWindow()
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
        title: 'FlowerBuddy · 新邮件',
        body
      })
      notification.on('click', () => this.openSettings())
      notification.show()
    }

    void this.showBackgroundBubble(body)
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
    const parent = this.activeDialogParent()
    const dialogOptions: OpenDialogOptions = {
      title: '选择桌宠图片',
      properties: ['openFile'],
      filters: [{ name: 'PNG 图片', extensions: ['png'] }]
    }

    const result = parent
      ? await dialog.showOpenDialog(parent, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)

    if (result.canceled) {
      return null
    }
    const sourcePath = result.filePaths[0]
    if (!sourcePath) {
      return null
    }

    try {
      const imported = importPetFile(sourcePath, this.options.petsDirectory)
      this.options.configStore.updatePet({ assetId: imported.assetId })
      this.asset = {
        assetId: imported.assetId,
        width: imported.info.width,
        height: imported.info.height,
        url: this.assetUrl(imported.assetId)
      }
      this.resizePetWindow()
      this.pushPetState()
      return this.config
    } catch (error) {
      throw new Error(this.describeImportError(error), { cause: error })
    }
  }

  resetPetPosition(): PublicConfig {
    const size = this.currentPetSize()
    const position = defaultPetPosition(this.primaryWorkArea(), size)
    if (this.petWindow && !this.petWindow.isDestroyed()) {
      this.petWindow.setPosition(position.x, position.y)
    }
    this.options.configStore.updatePet({ position })
    this.repositionOverlays()
    return this.config
  }

  async openQuickMenu(): Promise<void> {
    if (this.menuWindow && !this.menuWindow.isDestroyed() && this.menuWindow.isVisible()) {
      this.hideMenu()
      return
    }
    if (Date.now() - this.lastMenuHiddenAt < MENU_REOPEN_GUARD_MS) {
      return
    }

    const window = await this.ensureMenuWindow()
    if (!window) {
      return
    }
    this.positionMenu()
    window.show()
    window.focus()
  }

  runMenuAction(actionId: string): void {
    this.hideMenu()
    void this.runModuleAction(actionId)
  }

  closeMenu(): void {
    this.hideMenu()
  }

  dismissBubble(): void {
    this.currentRequestId = null
    this.clearBubbleTimers()
    this.hideBubble()
  }

  openSettings(): void {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.show()
      this.settingsWindow.focus()
      return
    }

    const window = createSettingsWindow({ preloadPath: this.options.preloadPath })
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
    if (this.petWindow && !this.petWindow.isDestroyed()) {
      this.petWindow.hide()
    }
    this.hideMenu()
    this.hideBubble()
    this.tray?.setPetVisible(false)
  }

  togglePet(): void {
    const window = this.petWindow
    if (!window || window.isDestroyed()) {
      return
    }
    if (window.isVisible()) {
      this.hidePet()
      return
    }
    this.ensurePetVisible()
    window.showInactive()
    this.tray?.setPetVisible(true)
  }

  showPet(): void {
    const window = this.petWindow
    if (!window || window.isDestroyed()) {
      return
    }
    this.ensurePetVisible()
    window.showInactive()
    this.tray?.setPetVisible(true)
  }

  handleSecondInstance(): void {
    this.showPet()
    this.openSettings()
  }

  beginDrag(): void {
    const window = this.petWindow
    if (!window || window.isDestroyed()) {
      return
    }
    const cursor = screen.getCursorScreenPoint()
    const bounds = window.getBounds()
    this.dragOffset = { x: bounds.x - cursor.x, y: bounds.y - cursor.y }
    this.hideMenu()
  }

  dragMove(): void {
    const window = this.petWindow
    if (!window || window.isDestroyed() || !this.dragOffset) {
      return
    }
    const cursor = screen.getCursorScreenPoint()
    window.setPosition(
      Math.round(cursor.x + this.dragOffset.x),
      Math.round(cursor.y + this.dragOffset.y)
    )
  }

  endDrag(): void {
    this.dragOffset = null
    const window = this.petWindow
    if (!window || window.isDestroyed()) {
      return
    }

    const bounds = window.getBounds()
    const position = clampToVisibleArea(bounds, this.workAreas())
    if (position.x !== bounds.x || position.y !== bounds.y) {
      window.setPosition(position.x, position.y)
    }
    this.options.configStore.updatePet({ position })
    this.repositionOverlays()
  }

  resolveAssetPath(assetId: string): string | null {
    if (assetId !== this.config.pet.assetId) {
      return null
    }
    return resolvePetAssetPath({
      assetId,
      petsDirectory: this.options.petsDirectory,
      defaultAssetPath: this.options.defaultPetPath
    })
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
    this.clearBubbleTimers()
    screen.removeListener('display-added', this.onDisplaysChanged)
    screen.removeListener('display-removed', this.onDisplaysChanged)
    screen.removeListener('display-metrics-changed', this.onDisplaysChanged)
    this.tray?.destroy()
    this.tray = null
  }

  private get config(): PublicConfig {
    return this.options.configStore.get()
  }

  private loadAsset(): PetAssetInfo {
    let assetId = this.config.pet.assetId
    let filePath = resolvePetAssetPath({
      assetId,
      petsDirectory: this.options.petsDirectory,
      defaultAssetPath: this.options.defaultPetPath
    })

    if (!filePath && assetId !== 'default') {
      assetId = 'default'
      this.options.configStore.updatePet({ assetId })
      filePath = resolvePetAssetPath({
        assetId,
        petsDirectory: this.options.petsDirectory,
        defaultAssetPath: this.options.defaultPetPath
      })
    }

    let width = FALLBACK_PET_DIMENSION
    let height = FALLBACK_PET_DIMENSION
    if (filePath) {
      try {
        const info = readPngInfo(readFileSync(filePath))
        if (info) {
          width = info.width
          height = info.height
        }
      } catch {
        // Fall through to the fallback dimensions; the UI will show a missing image.
      }
    }

    return { assetId, width, height, url: this.assetUrl(assetId) }
  }

  private assetUrl(assetId: string): string {
    return `${PET_ASSET_SCHEME}://asset/${encodeURIComponent(assetId)}`
  }

  private createPetWindow(): void {
    const config = this.config
    const size = computePetWindowSize(this.asset.width, this.asset.height, config.pet.scale)
    const desired: Rect = config.pet.position
      ? { x: config.pet.position.x, y: config.pet.position.y, ...size }
      : { ...defaultPetPosition(this.primaryWorkArea(), size), ...size }
    const position = clampToVisibleArea(desired, this.workAreas())

    const window = createPetWindow({
      bounds: { ...position, ...size },
      alwaysOnTop: config.app.alwaysOnTop,
      preloadPath: this.options.preloadPath
    })
    this.petWindow = window
    window.on('closed', () => {
      this.petWindow = null
    })
    window.once('ready-to-show', () => {
      if (!window.isDestroyed() && this.config.app.showPetOnStartup) {
        window.showInactive()
      }
    })
    loadView(window, {
      devServerUrl: this.options.devServerUrl,
      rendererIndexPath: this.options.rendererIndexPath,
      view: 'pet'
    })

    if (position.x !== desired.x || position.y !== desired.y) {
      this.options.configStore.updatePet({ position })
    }
  }

  private currentPetSize(): { width: number; height: number } {
    const window = this.petWindow
    if (window && !window.isDestroyed()) {
      const bounds = window.getBounds()
      return { width: bounds.width, height: bounds.height }
    }
    return computePetWindowSize(this.asset.width, this.asset.height, this.config.pet.scale)
  }

  private resizePetWindow(): void {
    const window = this.petWindow
    if (!window || window.isDestroyed()) {
      return
    }
    const size = computePetWindowSize(this.asset.width, this.asset.height, this.config.pet.scale)
    const bounds = window.getBounds()
    const desired: Rect = { ...resizeKeepingBottomCenter(bounds, size), ...size }
    const position = clampToVisibleArea(desired, this.workAreas())
    window.setBounds({ ...position, ...size })
    this.options.configStore.updatePet({ position })
    this.repositionOverlays()
  }

  private ensurePetVisible(): void {
    const window = this.petWindow
    if (!window || window.isDestroyed()) {
      return
    }
    const bounds = window.getBounds()
    const position = clampToVisibleArea(bounds, this.workAreas())
    if (position.x !== bounds.x || position.y !== bounds.y) {
      window.setPosition(position.x, position.y)
      this.options.configStore.updatePet({ position })
    }
  }

  private ensureMenuWindow(): Promise<BrowserWindow | null> {
    return this.ensureOverlayWindow('menu')
  }

  private ensureBubbleWindow(): Promise<BrowserWindow | null> {
    return this.ensureOverlayWindow('bubble')
  }

  private async ensureOverlayWindow(view: 'menu' | 'bubble'): Promise<BrowserWindow | null> {
    const existing = view === 'menu' ? this.menuWindow : this.bubbleWindow
    if (existing && !existing.isDestroyed()) {
      return existing
    }
    if (this.disposed) {
      return null
    }

    const window =
      view === 'menu'
        ? createMenuWindow({ preloadPath: this.options.preloadPath })
        : createBubbleWindow({ preloadPath: this.options.preloadPath })

    if (view === 'menu') {
      this.menuWindow = window
      window.on('blur', () => {
        if (!window.isDestroyed()) {
          window.hide()
          this.lastMenuHiddenAt = Date.now()
        }
      })
      window.on('closed', () => {
        this.menuWindow = null
      })
    } else {
      this.bubbleWindow = window
      window.on('closed', () => {
        this.bubbleWindow = null
      })
    }

    loadView(window, {
      devServerUrl: this.options.devServerUrl,
      rendererIndexPath: this.options.rendererIndexPath,
      view
    })
    await waitForLoad(window)

    if (window.isDestroyed()) {
      return null
    }
    return window
  }

  private positionMenu(): void {
    const pet = this.petWindow
    const menu = this.menuWindow
    if (!pet || pet.isDestroyed() || !menu || menu.isDestroyed()) {
      return
    }
    const anchor = pet.getBounds()
    const area = screen.getDisplayMatching(anchor).workArea
    const position = placeOverlay(anchor, MENU_SIZE, area, 'left')
    menu.setBounds({ ...position, ...MENU_SIZE })
  }

  private positionBubble(): void {
    const pet = this.petWindow
    const bubble = this.bubbleWindow
    if (!pet || pet.isDestroyed() || !bubble || bubble.isDestroyed()) {
      return
    }
    const anchor = pet.getBounds()
    const area = screen.getDisplayMatching(anchor).workArea
    const position = placeOverlay(anchor, BUBBLE_SIZE, area, 'above')
    bubble.setBounds({ ...position, ...BUBBLE_SIZE })
  }

  private hideMenu(): void {
    if (this.menuWindow && !this.menuWindow.isDestroyed()) {
      this.menuWindow.hide()
      this.lastMenuHiddenAt = Date.now()
    }
  }

  private async runModuleAction(actionId: string): Promise<void> {
    this.clearBubbleTimers()
    const requestId = randomUUID()
    this.currentRequestId = requestId

    let loadingMessage: string
    try {
      loadingMessage = this.options.moduleManager.getAction(actionId).action.loadingMessage
    } catch (error) {
      const publicError = toPublicError(error)
      await this.showBubble({ state: 'error', message: publicError.message, requestId })
      this.scheduleBubbleHide()
      return
    }

    await this.showBubble({ state: 'loading', message: loadingMessage, requestId })
    if (this.currentRequestId !== requestId) {
      return
    }

    this.safetyTimer = setTimeout(() => {
      this.safetyTimer = null
      if (this.currentRequestId !== requestId) {
        return
      }
      this.currentRequestId = null
      void this.showBubble({
        state: 'error',
        message: '请求超时，请稍后重试',
        requestId
      })
      this.scheduleBubbleHide()
    }, MODULE_ACTION_TIMEOUT_MS)

    try {
      const result = await this.options.moduleManager.runAction(actionId)
      if (this.currentRequestId !== requestId) {
        return
      }
      if (this.safetyTimer !== null) {
        clearTimeout(this.safetyTimer)
        this.safetyTimer = null
      }
      await this.showBubble({ state: result.state, message: result.message, requestId })
      this.scheduleBubbleHide()
    } catch (error) {
      if (this.currentRequestId !== requestId) {
        return
      }
      if (this.safetyTimer !== null) {
        clearTimeout(this.safetyTimer)
        this.safetyTimer = null
      }
      const publicError = toPublicError(error)
      await this.showBubble({ state: 'error', message: publicError.message, requestId })
      this.scheduleBubbleHide()
    }
  }

  private async showBackgroundBubble(message: string): Promise<void> {
    const window = this.petWindow
    if (this.currentRequestId !== null || !window || window.isDestroyed() || !window.isVisible()) {
      return
    }
    await this.showBubble({
      state: 'success',
      message,
      requestId: randomUUID()
    })
    this.scheduleBubbleHide()
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

  private async showBubble(payload: BubblePayload): Promise<void> {
    if (this.disposed) {
      return
    }
    const window = await this.ensureBubbleWindow()
    if (!window) {
      return
    }
    this.positionBubble()
    window.webContents.send(IPC_CHANNELS.bubbleUpdate, payload)
    if (!window.isVisible()) {
      window.showInactive()
    }
  }

  private scheduleBubbleHide(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer)
    }
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null
      this.hideBubble()
      this.currentRequestId = null
    }, this.config.app.bubbleDurationMs)
  }

  private hideBubble(): void {
    if (this.bubbleWindow && !this.bubbleWindow.isDestroyed()) {
      this.bubbleWindow.hide()
    }
  }

  private clearBubbleTimers(): void {
    if (this.safetyTimer !== null) {
      clearTimeout(this.safetyTimer)
      this.safetyTimer = null
    }
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer)
      this.hideTimer = null
    }
  }

  private repositionOverlays(): void {
    if (this.menuWindow && !this.menuWindow.isDestroyed() && this.menuWindow.isVisible()) {
      this.positionMenu()
    }
    if (this.bubbleWindow && !this.bubbleWindow.isDestroyed() && this.bubbleWindow.isVisible()) {
      this.positionBubble()
    }
  }

  private pushPetState(): void {
    const window = this.petWindow
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) {
      return
    }
    if (window.webContents.isLoadingMainFrame()) {
      return
    }
    window.webContents.send(IPC_CHANNELS.petStateChanged, this.getPetViewState())
  }

  private activeDialogParent(): BrowserWindow | null {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      return this.settingsWindow
    }
    if (this.petWindow && !this.petWindow.isDestroyed()) {
      return this.petWindow
    }
    return null
  }

  private describeImportError(error: unknown): string {
    if (error instanceof PetAssetError) {
      switch (error.code) {
        case 'NOT_PNG':
          return '所选文件不是有效的 PNG 图片'
        case 'TOO_LARGE':
          return '图片超过 15 MB 限制'
        case 'UNREADABLE':
          return '无法读取所选文件'
      }
    }
    return '导入图片失败'
  }

  private onDisplaysChanged = (): void => {
    this.ensurePetVisible()
    this.repositionOverlays()
  }

  private primaryWorkArea(): Rect {
    return screen.getPrimaryDisplay().workArea
  }

  private workAreas(): Rect[] {
    return screen.getAllDisplays().map((display) => display.workArea)
  }

  quitApp(): void {
    app.quit()
  }
}
