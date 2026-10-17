import { BrowserWindow, screen } from 'electron'
import { IPC_CHANNELS } from '../../shared/api'
import type { BubblePayload } from '../../shared/api'
import type { Rect } from './geometry'
import { placeOverlay } from './geometry'
import { loadView, waitForLoad } from './load-view'
import { BUBBLE_SIZE, MENU_SIZE, createBubbleWindow, createMenuWindow } from './overlay-windows'

const MENU_REOPEN_GUARD_MS = 250

export interface OverlayWindowManagerOptions {
  preloadPath: string
  devServerUrl: string | undefined
  rendererIndexPath: string
  getPetBounds: () => Rect | null
}

/** Owns menu and bubble windows: creation, placement, visibility and cleanup. */
export class OverlayWindowManager {
  private menuWindow: BrowserWindow | null = null
  private bubbleWindow: BrowserWindow | null = null
  private lastMenuHiddenAt = 0
  private disposed = false

  constructor(private readonly options: OverlayWindowManagerOptions) {}

  async openMenu(): Promise<void> {
    if (this.menuWindow && !this.menuWindow.isDestroyed() && this.menuWindow.isVisible()) {
      this.hideMenu()
      return
    }
    if (Date.now() - this.lastMenuHiddenAt < MENU_REOPEN_GUARD_MS) {
      return
    }

    const window = await this.ensureOverlayWindow('menu')
    if (!window) {
      return
    }
    this.positionMenu()
    window.show()
    window.focus()
  }

  hideMenu(): void {
    if (this.menuWindow && !this.menuWindow.isDestroyed()) {
      this.menuWindow.hide()
      this.lastMenuHiddenAt = Date.now()
    }
  }

  async showBubble(payload: BubblePayload): Promise<void> {
    if (this.disposed) {
      return
    }
    const window = await this.ensureOverlayWindow('bubble')
    if (!window) {
      return
    }
    this.positionBubble()
    window.webContents.send(IPC_CHANNELS.bubbleUpdate, payload)
    if (!window.isVisible()) {
      window.showInactive()
    }
  }

  hideBubble(): void {
    if (this.bubbleWindow && !this.bubbleWindow.isDestroyed()) {
      this.bubbleWindow.hide()
    }
  }

  reposition(): void {
    if (this.menuWindow && !this.menuWindow.isDestroyed() && this.menuWindow.isVisible()) {
      this.positionMenu()
    }
    if (this.bubbleWindow && !this.bubbleWindow.isDestroyed() && this.bubbleWindow.isVisible()) {
      this.positionBubble()
    }
  }

  dispose(): void {
    this.disposed = true
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
    return window.isDestroyed() ? null : window
  }

  private positionMenu(): void {
    const anchor = this.options.getPetBounds()
    const menu = this.menuWindow
    if (!anchor || !menu || menu.isDestroyed()) {
      return
    }
    const area = screen.getDisplayMatching(anchor).workArea
    const position = placeOverlay(anchor, MENU_SIZE, area, 'left')
    menu.setBounds({ ...position, ...MENU_SIZE })
  }

  private positionBubble(): void {
    const anchor = this.options.getPetBounds()
    const bubble = this.bubbleWindow
    if (!anchor || !bubble || bubble.isDestroyed()) {
      return
    }
    const area = screen.getDisplayMatching(anchor).workArea
    const position = placeOverlay(anchor, BUBBLE_SIZE, area, 'above')
    bubble.setBounds({ ...position, ...BUBBLE_SIZE })
  }
}
