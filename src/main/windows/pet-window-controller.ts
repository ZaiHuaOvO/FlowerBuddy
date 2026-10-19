import { readFileSync, statSync } from 'node:fs'
import { BrowserWindow, dialog, nativeImage, screen } from 'electron'
import type { OpenDialogOptions } from 'electron'
import { IPC_CHANNELS, MAX_PET_NAME_LENGTH, petAssetUrl } from '../../shared/api'
import type { PetAssetInfo, PetUserImage, PetViewState, PublicConfig } from '../../shared/api'
import { AppError } from '../shared/errors'
import type { ConfigStore } from '../storage/config-store'
import {
  MAX_PET_BYTES,
  MAX_PET_DIMENSION,
  PetAssetError,
  deletePetImageFile,
  importPetBuffer,
  isUserPetImageId,
  listPetImageIds,
  readPngInfo,
  resolvePetAssetPath
} from '../storage/pet-assets'
import type { Rect } from './geometry'
import {
  clampToVisibleArea,
  computePetWindowSize,
  defaultPetPosition,
  resizeKeepingBottomCenter
} from './geometry'
import { loadView } from './load-view'
import { createPetWindow } from './pet-window'

const FALLBACK_PET_DIMENSION = 160

export interface PetWindowControllerOptions {
  configStore: ConfigStore
  preloadPath: string
  devServerUrl: string | undefined
  rendererIndexPath: string
  defaultPetPath: string
  petPresetsDirectory: string
  petsDirectory: string
  getDialogParent: () => BrowserWindow | null
  onBoundsChanged: () => void
}

/** Owns the pet window, its asset, position, scale and drag behavior. */
export class PetWindowController {
  private window: BrowserWindow | null = null
  private asset: PetAssetInfo
  private dragOffset: { x: number; y: number } | null = null
  private dragMoved = false

  constructor(private readonly options: PetWindowControllerOptions) {
    this.asset = this.loadAsset()
  }

  start(): void {
    this.createWindow()
  }

  getViewState(): PetViewState {
    return {
      asset: { ...this.asset },
      bounceAnimation: this.config.app.bounceAnimation
    }
  }

  isVisible(): boolean {
    return Boolean(this.window && !this.window.isDestroyed() && this.window.isVisible())
  }

  getBounds(): Rect | null {
    if (!this.window || this.window.isDestroyed()) {
      return null
    }
    return this.window.getBounds()
  }

  getWindow(): BrowserWindow | null {
    if (!this.window || this.window.isDestroyed()) {
      return null
    }
    return this.window
  }

  updateAlwaysOnTop(enabled: boolean): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.setAlwaysOnTop(enabled)
    }
  }

  pushState(): void {
    const window = this.window
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) {
      return
    }
    if (window.webContents.isLoadingMainFrame()) {
      return
    }
    window.webContents.send(IPC_CHANNELS.petStateChanged, this.getViewState())
  }

  resize(): void {
    const window = this.window
    if (!window || window.isDestroyed()) {
      return
    }
    const size = computePetWindowSize(this.asset.width, this.asset.height, this.config.pet.scale)
    const bounds = window.getBounds()
    const desired: Rect = { ...resizeKeepingBottomCenter(bounds, size), ...size }
    const position = clampToVisibleArea(desired, this.workAreas())
    window.setBounds({ ...position, ...size })
    this.options.configStore.updatePet({ position })
    this.options.onBoundsChanged()
  }

  ensureVisible(): void {
    const window = this.window
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

  hide(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide()
    }
  }

  show(): void {
    const window = this.window
    if (!window || window.isDestroyed()) {
      return
    }
    this.ensureVisible()
    window.showInactive()
  }

  beginDrag(): void {
    const window = this.window
    if (!window || window.isDestroyed()) {
      return
    }
    const cursor = screen.getCursorScreenPoint()
    const bounds = window.getBounds()
    this.dragOffset = { x: bounds.x - cursor.x, y: bounds.y - cursor.y }
    this.dragMoved = false
  }

  dragMove(): void {
    const window = this.window
    if (!window || window.isDestroyed() || !this.dragOffset) {
      return
    }
    this.dragMoved = true
    const cursor = screen.getCursorScreenPoint()
    window.setPosition(
      Math.round(cursor.x + this.dragOffset.x),
      Math.round(cursor.y + this.dragOffset.y)
    )
  }

  endDrag(): void {
    const moved = this.dragMoved
    this.dragOffset = null
    this.dragMoved = false
    const window = this.window
    if (!window || window.isDestroyed() || !moved) {
      return
    }

    const bounds = window.getBounds()
    const position = clampToVisibleArea(bounds, this.workAreas())
    if (position.x !== bounds.x || position.y !== bounds.y) {
      window.setPosition(position.x, position.y)
    }
    this.options.configStore.updatePet({ position })
    this.options.onBoundsChanged()
  }

  resetPosition(): PublicConfig {
    const size = this.currentPetSize()
    const position = defaultPetPosition(this.primaryWorkArea(), size)
    if (this.window && !this.window.isDestroyed()) {
      this.window.setPosition(position.x, position.y)
    }
    this.options.configStore.updatePet({ position })
    this.options.onBoundsChanged()
    return this.config
  }

  async importImage(): Promise<PublicConfig | null> {
    const parent = this.options.getDialogParent()
    const dialogOptions: OpenDialogOptions = {
      title: '选择桌宠图片',
      properties: ['openFile'],
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg'] }]
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
      const pngBuffer = this.readImageAsPng(sourcePath)
      const imported = importPetBuffer(pngBuffer, this.options.petsDirectory)
      this.options.configStore.updatePet({ assetId: imported.assetId })
      this.asset = {
        assetId: imported.assetId,
        width: imported.info.width,
        height: imported.info.height,
        url: petAssetUrl(imported.assetId)
      }
      this.resize()
      this.pushState()
      return this.config
    } catch (error) {
      throw new AppError('INVALID_INPUT', this.describeImportError(error), { cause: error })
    }
  }

  selectAsset(assetId: string): PublicConfig {
    if (!this.resolvePath(assetId)) {
      throw new AppError('INVALID_INPUT', '桌宠图片不存在')
    }
    this.applyAsset(assetId)
    return this.config
  }

  listUserImages(): PetUserImage[] {
    const names = this.config.pet.names
    return listPetImageIds(this.options.petsDirectory).map((assetId) => ({
      assetId,
      name: names[assetId] ?? null
    }))
  }

  renameUserImage(assetId: string, name: string): PetUserImage[] {
    if (!isUserPetImageId(assetId) || !this.resolvePath(assetId)) {
      throw new AppError('INVALID_INPUT', '桌宠图片不存在')
    }

    const trimmed = name.trim().slice(0, MAX_PET_NAME_LENGTH)
    const names = { ...this.config.pet.names }
    if (trimmed) {
      names[assetId] = trimmed
    } else {
      delete names[assetId]
    }
    this.options.configStore.updatePet({ names })
    return this.listUserImages()
  }

  deleteUserImage(assetId: string): PublicConfig {
    if (!deletePetImageFile(assetId, this.options.petsDirectory)) {
      throw new AppError('INVALID_INPUT', '桌宠图片不存在')
    }
    const names = { ...this.config.pet.names }
    delete names[assetId]
    this.options.configStore.updatePet({ names })
    if (this.config.pet.assetId === assetId) {
      this.applyAsset('default')
    }
    return this.config
  }

  resolveAssetPath(assetId: string): string | null {
    return this.resolvePath(assetId)
  }

  private applyAsset(assetId: string): void {
    const filePath = this.resolvePath(assetId)
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
        // Keep the fallback dimensions; the image still loads through the protocol.
      }
    }

    this.options.configStore.updatePet({ assetId })
    this.asset = { assetId, width, height, url: petAssetUrl(assetId) }
    this.resize()
    this.pushState()
  }

  private resolvePath(assetId: string): string | null {
    return resolvePetAssetPath({
      assetId,
      petsDirectory: this.options.petsDirectory,
      presetsDirectory: this.options.petPresetsDirectory,
      defaultAssetPath: this.options.defaultPetPath
    })
  }

  private get config(): PublicConfig {
    return this.options.configStore.get()
  }

  private loadAsset(): PetAssetInfo {
    let assetId = this.config.pet.assetId
    let filePath = this.resolvePath(assetId)

    if (!filePath && assetId !== 'default') {
      assetId = 'default'
      this.options.configStore.updatePet({ assetId })
      filePath = this.resolvePath(assetId)
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

    return { assetId, width, height, url: petAssetUrl(assetId) }
  }

  private createWindow(): void {
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
    this.window = window
    window.on('closed', () => {
      this.window = null
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
    const window = this.window
    if (window && !window.isDestroyed()) {
      const bounds = window.getBounds()
      return { width: bounds.width, height: bounds.height }
    }
    return computePetWindowSize(this.asset.width, this.asset.height, this.config.pet.scale)
  }

  private readImageAsPng(sourcePath: string): Buffer {
    let size: number
    try {
      size = statSync(sourcePath).size
    } catch {
      throw new PetAssetError('UNREADABLE')
    }
    if (size > MAX_PET_BYTES) {
      throw new PetAssetError('TOO_LARGE')
    }

    let buffer: Buffer
    try {
      buffer = readFileSync(sourcePath)
    } catch {
      throw new PetAssetError('UNREADABLE')
    }

    if (readPngInfo(buffer)) {
      return buffer
    }

    let image
    try {
      image = nativeImage.createFromBuffer(buffer)
    } catch {
      throw new AppError('INVALID_INPUT', '图片格式不受支持，请选择 PNG 或 JPEG 图片')
    }
    if (image.isEmpty()) {
      throw new AppError('INVALID_INPUT', '图片格式不受支持，请选择 PNG 或 JPEG 图片')
    }

    const { width, height } = image.getSize()
    if (width < 1 || height < 1) {
      throw new AppError('INVALID_INPUT', '无法读取这张图片')
    }
    if (width > MAX_PET_DIMENSION || height > MAX_PET_DIMENSION) {
      throw new AppError('INVALID_INPUT', `图片尺寸不能超过 ${MAX_PET_DIMENSION} 像素`)
    }

    const png = image.toPNG()
    if (png.length === 0) {
      throw new AppError('INVALID_INPUT', '无法读取这张图片')
    }
    return png
  }

  private describeImportError(error: unknown): string {
    if (error instanceof AppError) {
      return error.message
    }
    if (error instanceof PetAssetError) {
      switch (error.code) {
        case 'NOT_PNG':
          return '图片格式不受支持，请选择 PNG 或 JPEG 图片'
        case 'TOO_LARGE':
          return '图片超过 15 MB 限制'
        case 'UNREADABLE':
          return '无法读取所选文件'
      }
    }
    return '导入图片失败'
  }

  private primaryWorkArea(): Rect {
    return screen.getPrimaryDisplay().workArea
  }

  private workAreas(): Rect[] {
    return screen.getAllDisplays().map((display) => display.workArea)
  }
}
