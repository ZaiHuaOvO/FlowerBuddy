import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { app, BrowserWindow, dialog, screen } from 'electron'
import type { OpenDialogOptions } from 'electron'
import { IPC_CHANNELS } from '../shared/api'
import type {
  AppInfo,
  AppSettingsPatch,
  BubblePayload,
  ModuleId,
  ModuleSummary,
  PetAssetInfo,
  PetSettingsPatch,
  PetViewState,
  PublicConfig,
  SecurityStatus
} from '../shared/api'
import type { ModuleManager } from './modules/module-manager'
import { PET_ASSET_SCHEME } from './protocol/pet-asset-protocol'
import type { SecretStore } from './security/secret-store'
import type { LoggerLike } from './shared/logger'
import { ConfigStore } from './storage/config-store'
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

const DEMO_ACTIONS = new Set(['demo:success', 'demo:error'])
const DEMO_DELAY_MS = 900
const REQUEST_TIMEOUT_MS = 15000
const MENU_REOPEN_GUARD_MS = 250
const FALLBACK_PET_DIMENSION = 160

export interface AppControllerOptions {
  configStore: ConfigStore
  moduleManager: ModuleManager
  secretStore: SecretStore
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
  private resultTimer: ReturnType<typeof setTimeout> | null = null
  private safetyTimer: ReturnType<typeof setTimeout> | null = null
  private hideTimer: ReturnType<typeof setTimeout> | null = null
  private lastMenuHiddenAt = 0
  private disposed = false

  constructor(private readonly options: AppControllerOptions) {
    this.asset = this.loadAsset()
  }

  async start(): Promise<void> {
    this.createPetWindow()

    this.tray = new AppTray(this.options.trayIconPath, {
      openSettings: () => this.openSettings(),
      togglePet: () => this.togglePet(),
      quit: () => this.quitApp()
    })
    this.tray.create()

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

  runMenuAction(rawActionId: unknown): void {
    if (typeof rawActionId !== 'string' || !DEMO_ACTIONS.has(rawActionId)) {
      throw new Error('UNKNOWN_ACTION')
    }
    this.hideMenu()
    void this.runDemoAction(rawActionId)
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
      if (!window.isDestroyed()) {
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

  private async runDemoAction(actionId: string): Promise<void> {
    this.clearBubbleTimers()
    const requestId = randomUUID()
    this.currentRequestId = requestId

    await this.showBubble({ state: 'loading', message: '正在处理…', requestId })
    if (this.currentRequestId !== requestId) {
      return
    }

    this.resultTimer = setTimeout(() => {
      this.resultTimer = null
      if (this.currentRequestId !== requestId) {
        return
      }
      if (this.safetyTimer !== null) {
        clearTimeout(this.safetyTimer)
        this.safetyTimer = null
      }
      const succeeded = actionId === 'demo:success'
      void this.showBubble({
        state: succeeded ? 'success' : 'error',
        message: succeeded ? '演示操作已完成' : '演示操作失败，请稍后重试',
        requestId
      })
      this.scheduleBubbleHide()
    }, DEMO_DELAY_MS)

    this.safetyTimer = setTimeout(() => {
      this.safetyTimer = null
      if (this.currentRequestId !== requestId) {
        return
      }
      if (this.resultTimer !== null) {
        clearTimeout(this.resultTimer)
        this.resultTimer = null
      }
      void this.showBubble({ state: 'error', message: '请求超时，请重试', requestId })
      this.scheduleBubbleHide()
    }, REQUEST_TIMEOUT_MS)
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
    }, this.config.app.bubbleDurationMs)
  }

  private hideBubble(): void {
    if (this.bubbleWindow && !this.bubbleWindow.isDestroyed()) {
      this.bubbleWindow.hide()
    }
  }

  private clearBubbleTimers(): void {
    if (this.resultTimer !== null) {
      clearTimeout(this.resultTimer)
      this.resultTimer = null
    }
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
