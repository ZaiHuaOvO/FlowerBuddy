import { BrowserWindow, screen, systemPreferences } from 'electron'
import { IPC_CHANNELS } from '../../shared/api'
import type { BubblePayload, MenuPresentation } from '../../shared/api'
import {
  MENU_EXIT_MS,
  MENU_FOCUS_GUARD_MS,
  MENU_OPEN_ACK_TIMEOUT_MS,
  MENU_OPEN_DEBOUNCE_MS
} from '../../shared/menu-layout'
import type { MenuLayout, Rect } from './geometry'
import { computeMenuLayout, placeOverlay } from './geometry'
import { loadViewAndWait } from './load-view'
import { BUBBLE_SIZE, createBubbleWindow, createMenuWindow } from './overlay-windows'

type MenuState = 'idle' | 'opening' | 'open' | 'closing'

export interface OverlayWindowManagerOptions {
  preloadPath: string
  devServerUrl: string | undefined
  rendererIndexPath: string
  getPetBounds: () => Rect | null
  getMenuActionCount: () => number
}

/** Owns menu and bubble windows: creation, placement, visibility and cleanup. */
export class OverlayWindowManager {
  private menuWindow: BrowserWindow | null = null
  private bubbleWindow: BrowserWindow | null = null
  private menuState: MenuState = 'idle'
  private menuAnchor: Rect | null = null
  private menuWorkArea: Rect | null = null
  private presentation: MenuPresentation = {
    phase: 'close',
    placement: 'above',
    token: 0,
    instant: false
  }
  private closeTimer: ReturnType<typeof setTimeout> | null = null
  private openAckResolver: (() => void) | null = null
  private openAckTimer: ReturnType<typeof setTimeout> | null = null
  private shownAt = 0
  private menuGeneration = 0
  private disposed = false

  constructor(private readonly options: OverlayWindowManagerOptions) {}

  async openMenu(): Promise<void> {
    if (this.disposed || this.menuState === 'opening') {
      return
    }

    if (this.menuState === 'closing') {
      this.cancelCloseTimer()
      this.menuState = 'open'
      this.applyLayout(true, false)
      this.presentation = {
        phase: 'open',
        placement: this.presentation.placement,
        token: this.presentation.token + 1,
        instant: false
      }
      this.sendPresentation()
      this.shownAt = Date.now()
      return
    }

    if (this.menuState === 'open') {
      // Ignore a duplicate event from the same gesture, but a deliberate
      // second click after that toggles the menu closed.
      if (Date.now() - this.shownAt < MENU_OPEN_DEBOUNCE_MS) {
        return
      }
      this.hideMenu()
      return
    }

    const anchor = this.options.getPetBounds()
    if (!anchor) {
      return
    }
    const workArea = screen.getDisplayMatching(anchor).workArea
    const generation = ++this.menuGeneration

    this.menuState = 'opening'
    this.menuAnchor = anchor
    this.menuWorkArea = workArea

    const window = await this.ensureOverlayWindow('menu')
    if (
      this.disposed ||
      generation !== this.menuGeneration ||
      this.menuState !== 'opening' ||
      !window
    ) {
      if (this.menuState === 'opening') {
        this.menuState = 'idle'
      }
      return
    }

    const layout = computeMenuLayout(anchor, workArea, {
      // The window is sized once for the expanded list; expanding later only
      // toggles renderer content, so a visible window is never resized.
      expanded: true,
      actionCount: this.options.getMenuActionCount()
    })
    this.presentation = {
      phase: 'open',
      placement: layout.placement,
      token: this.presentation.token + 1,
      instant: false
    }
    window.setBounds({ x: layout.x, y: layout.y, width: layout.width, height: layout.height })
    // Send the open state while the window is still hidden and wait for the
    // renderer to confirm the fresh panel is mounted before showing it. This
    // prevents a stale frame (e.g. the previously selected Settings icon).
    this.sendPresentation()
    await this.waitForOpenAck()
    if (
      this.disposed ||
      generation !== this.menuGeneration ||
      this.menuState !== 'opening' ||
      window.isDestroyed()
    ) {
      return
    }
    window.show()
    if (!window.isFocused()) {
      window.focus()
    }
    this.menuState = 'open'
    this.shownAt = Date.now()
  }

  hideMenu(immediate = false): void {
    if (this.disposed) {
      return
    }

    if (this.menuState === 'opening') {
      this.menuGeneration += 1
      this.menuState = 'idle'
      this.resolveOpenAck()
      return
    }

    const window = this.menuWindow
    if (!window || window.isDestroyed()) {
      this.menuState = 'idle'
      return
    }

    // A hidden menu must not arm the reopen guard: a plain left click calls
    // hideMenu() before opening the menu on pointerup.
    if (this.menuState === 'idle' || !window.isVisible()) {
      this.menuState = 'idle'
      return
    }
    if (this.menuState === 'closing') {
      return
    }

    this.pushPresentation('close', immediate)
    this.menuState = 'closing'
    if (immediate) {
      this.finishClose()
      return
    }
    this.closeTimer = setTimeout(() => this.finishClose(), this.exitDelay)
  }

  getPresentation(): MenuPresentation {
    return { ...this.presentation }
  }

  acknowledgeOpen(): void {
    this.resolveOpenAck()
  }

  private waitForOpenAck(): Promise<void> {
    this.resolveOpenAck()
    return new Promise((resolve) => {
      this.openAckResolver = resolve
      this.openAckTimer = setTimeout(() => this.resolveOpenAck(), MENU_OPEN_ACK_TIMEOUT_MS)
    })
  }

  private resolveOpenAck(): void {
    if (this.openAckTimer !== null) {
      clearTimeout(this.openAckTimer)
      this.openAckTimer = null
    }
    const resolve = this.openAckResolver
    this.openAckResolver = null
    resolve?.()
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
    if (this.menuState === 'open') {
      this.applyLayout(true)
    }
    if (this.bubbleWindow && !this.bubbleWindow.isDestroyed() && this.bubbleWindow.isVisible()) {
      this.positionBubble()
    }
  }

  dispose(): void {
    this.disposed = true
    this.menuGeneration += 1
    this.cancelCloseTimer()
    this.resolveOpenAck()
    this.menuState = 'idle'
  }

  private get exitDelay(): number {
    return systemPreferences.getAnimationSettings().prefersReducedMotion ? 0 : MENU_EXIT_MS
  }

  private finishClose(): void {
    this.cancelCloseTimer()
    const window = this.menuWindow
    if (window && !window.isDestroyed()) {
      window.hide()
    }
    this.menuState = 'idle'
  }

  private cancelCloseTimer(): void {
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer)
      this.closeTimer = null
    }
  }

  private applyLayout(refreshAnchor: boolean, send = refreshAnchor): void {
    const window = this.menuWindow
    if (!window || window.isDestroyed()) {
      return
    }
    if (refreshAnchor) {
      const anchor = this.options.getPetBounds()
      if (anchor) {
        this.menuAnchor = anchor
        this.menuWorkArea = screen.getDisplayMatching(anchor).workArea
      }
    }
    const anchor = this.menuAnchor
    const workArea = this.menuWorkArea
    if (!anchor || !workArea) {
      return
    }

    const layout: MenuLayout = computeMenuLayout(anchor, workArea, {
      expanded: true,
      actionCount: this.options.getMenuActionCount()
    })
    this.presentation = { ...this.presentation, placement: layout.placement }
    window.setBounds({ x: layout.x, y: layout.y, width: layout.width, height: layout.height })
    if (send) {
      this.sendPresentation()
    }
  }

  private pushPresentation(phase: MenuPresentation['phase'], instant = false): void {
    this.presentation = { ...this.presentation, phase, instant }
    this.sendPresentation()
  }

  private sendPresentation(): void {
    const window = this.menuWindow
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) {
      return
    }
    window.webContents.send(IPC_CHANNELS.menuPresentation, this.presentation)
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
      window.on('blur', () => this.handleMenuBlur())
      window.on('closed', () => {
        this.menuWindow = null
        this.menuState = 'idle'
        this.cancelCloseTimer()
      })
    } else {
      this.bubbleWindow = window
      window.on('closed', () => {
        this.bubbleWindow = null
      })
    }

    const loaded = await loadViewAndWait(window, {
      devServerUrl: this.options.devServerUrl,
      rendererIndexPath: this.options.rendererIndexPath,
      view
    })
    if (!loaded || window.isDestroyed()) {
      if (!window.isDestroyed()) {
        window.destroy()
      }
      if (view === 'menu') {
        this.menuWindow = null
      } else {
        this.bubbleWindow = null
      }
      return null
    }
    return window
  }

  private handleMenuBlur(): void {
    if (this.menuState !== 'open') {
      return
    }
    if (Date.now() - this.shownAt < MENU_FOCUS_GUARD_MS) {
      return
    }
    this.hideMenu()
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
