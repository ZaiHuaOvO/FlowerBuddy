import { randomUUID } from 'node:crypto'
import { BrowserWindow, screen, systemPreferences } from 'electron'
import { IPC_CHANNELS } from '../../shared/api'
import type { BubbleItem, BubblePayload, MenuPresentation } from '../../shared/api'
import {
  MENU_EXIT_MS,
  MENU_IDLE_CLOSE_MS,
  MENU_IDLE_POLL_MS,
  MENU_OPEN_ACK_TIMEOUT_MS
} from '../../shared/menu-layout'
import type { MenuLayout, Rect } from './geometry'
import { computeMenuLayout, containsPoint, placeOverlay } from './geometry'
import { loadViewAndWait } from './load-view'
import {
  BUBBLE_MAX_HEIGHT,
  BUBBLE_MIN_HEIGHT,
  BUBBLE_SIZE,
  createBubbleWindow,
  createMenuWindow
} from './overlay-windows'

type MenuState = 'idle' | 'opening' | 'open' | 'closing'

export interface OverlayWindowManagerOptions {
  preloadPath: string
  devServerUrl: string | undefined
  rendererIndexPath: string
  getPetBounds: () => Rect | null
  getMenuActionCount: () => number
  getBubbleDurationMs: () => number
  isPetVisible: () => boolean
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
  private idlePollTimer: ReturnType<typeof setInterval> | null = null
  private awaySince: number | null = null
  private menuGeneration = 0
  private bubbles: BubbleItem[] = []
  private readonly bubbleTimers = new Map<string, { remainingMs: number; lastTick: number }>()
  private bubbleTick: ReturnType<typeof setInterval> | null = null
  private bubbleHeight = BUBBLE_SIZE.height
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
      this.setMenuInteractive(true)
      this.menuWindow?.focus()
      this.startIdleWatch()
      return
    }

    if (this.menuState === 'open') {
      // Right-clicking the open menu is intentionally a no-op. The menu only
      // closes after the pointer leaves both the menu and the pet for a while.
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
    // The window stays visible between openings, so a reopen never goes
    // through the OS show transition (which reveals the cached surface from
    // the previous session first and looks like the menu loads twice).
    // Input is enabled only once the renderer has committed the fresh panel.
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
    this.setMenuInteractive(true)
    if (!window.isVisible()) {
      // First open only: show the window once. It is never hidden afterwards,
      // so later opens skip the OS show transition entirely.
      window.show()
    }
    if (!window.isFocused()) {
      window.focus()
    }
    this.menuState = 'open'
    this.startIdleWatch()
  }

  hideMenu(immediate = false): void {
    this.stopIdleWatch()
    if (this.disposed) {
      return
    }

    if (this.menuState === 'opening') {
      this.menuGeneration += 1
      this.menuState = 'idle'
      this.resolveOpenAck()
      this.setMenuInteractive(false)
      // The renderer may still commit the cancelled open; hide it explicitly.
      this.pushPresentation('close', true)
      return
    }

    const window = this.menuWindow
    if (!window || window.isDestroyed()) {
      this.menuState = 'idle'
      return
    }

    // Only an open menu needs an exit animation; calls made while it is
    // already idle must stay a no-op.
    if (this.menuState === 'idle' || !window.isVisible()) {
      this.menuState = 'idle'
      this.setMenuInteractive(false)
      return
    }
    if (this.menuState === 'closing') {
      return
    }

    this.setMenuInteractive(false)
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
    const id = payload.requestId ?? randomUUID()
    const item: BubbleItem = {
      id,
      state: payload.state,
      message: payload.message,
      persistent: payload.persistent === true,
      ...(payload.emphasis && payload.emphasis.length > 0 ? { emphasis: payload.emphasis } : {})
    }
    const index = this.bubbles.findIndex((bubble) => bubble.id === id)
    if (index >= 0) {
      const next = [...this.bubbles]
      next[index] = item
      this.bubbles = next
    } else {
      this.bubbles = [...this.bubbles, item]
    }
    this.setBubbleTimer(payload, id)

    const window = await this.ensureOverlayWindow('bubble')
    if (!window) {
      return
    }
    this.pushBubbles()
    if (this.options.isPetVisible() && !window.webContents.isLoading()) {
      this.positionBubble()
      if (!window.isVisible()) {
        window.showInactive()
      }
    }
  }

  dismissBubble(id: string): void {
    const index = this.bubbles.findIndex((bubble) => bubble.id === id)
    if (index === -1) {
      return
    }
    this.clearBubbleTimer(id)
    this.bubbles = this.bubbles.filter((bubble) => bubble.id !== id)
    if (this.bubbles.length === 0) {
      this.bubbleHeight = BUBBLE_SIZE.height
      this.hideBubble()
    }
    this.pushBubbles()
  }

  hideBubble(): void {
    if (this.bubbleWindow && !this.bubbleWindow.isDestroyed()) {
      this.bubbleWindow.hide()
    }
  }

  showBubbleStack(): void {
    const window = this.bubbleWindow
    if (!window || window.isDestroyed() || this.bubbles.length === 0) {
      return
    }
    if (!this.options.isPetVisible() || window.webContents.isLoading()) {
      return
    }
    this.positionBubble()
    if (!window.isVisible()) {
      window.showInactive()
    }
  }

  setBubbleHeight(height: number): void {
    const next = Math.round(
      Math.max(BUBBLE_MIN_HEIGHT, Math.min(Number.isFinite(height) ? height : 0, BUBBLE_MAX_HEIGHT))
    )
    if (next === this.bubbleHeight) {
      return
    }
    this.bubbleHeight = next
    if (this.bubbles.length > 0) {
      this.positionBubble()
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
    this.stopIdleWatch()
    this.resolveOpenAck()
    this.bubbleTimers.clear()
    if (this.bubbleTick !== null) {
      clearInterval(this.bubbleTick)
      this.bubbleTick = null
    }
    this.menuState = 'idle'
  }

  private get exitDelay(): number {
    return systemPreferences.getAnimationSettings().prefersReducedMotion ? 0 : MENU_EXIT_MS
  }

  private setMenuInteractive(interactive: boolean): void {
    const window = this.menuWindow
    if (!window || window.isDestroyed()) {
      return
    }
    window.setIgnoreMouseEvents(!interactive)
    if (!interactive) {
      // The window is never hidden, so it must give up focus on close or the
      // invisible overlay would keep swallowing keyboard input.
      window.blur()
    }
  }

  private finishClose(): void {
    this.cancelCloseTimer()
    this.stopIdleWatch()
    // The window stays visible (transparent and click-through) so reopening
    // it never replays the OS show transition.
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
      window.on('closed', () => {
        this.stopIdleWatch()
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
    if (view === 'menu') {
      window.setIgnoreMouseEvents(true)
    }
    return window
  }

  private startIdleWatch(): void {
    this.stopIdleWatch()
    this.awaySince = null
    this.idlePollTimer = setInterval(() => this.checkIdle(), MENU_IDLE_POLL_MS)
  }

  private stopIdleWatch(): void {
    if (this.idlePollTimer !== null) {
      clearInterval(this.idlePollTimer)
      this.idlePollTimer = null
    }
    this.awaySince = null
  }

  private checkIdle(): void {
    if (this.menuState !== 'open') {
      this.stopIdleWatch()
      return
    }
    const window = this.menuWindow
    if (!window || window.isDestroyed()) {
      this.stopIdleWatch()
      return
    }

    const cursor = screen.getCursorScreenPoint()
    const menuBounds = window.getBounds()
    const petBounds = this.options.getPetBounds()
    const nearMenu = containsPoint(menuBounds, cursor.x, cursor.y)
    const nearPet = petBounds ? containsPoint(petBounds, cursor.x, cursor.y) : false

    if (nearMenu || nearPet) {
      this.awaySince = null
      return
    }

    const now = Date.now()
    if (this.awaySince === null) {
      this.awaySince = now
      return
    }
    if (now - this.awaySince >= MENU_IDLE_CLOSE_MS) {
      this.stopIdleWatch()
      this.hideMenu()
    }
  }

  private positionBubble(): void {
    const anchor = this.options.getPetBounds()
    const bubble = this.bubbleWindow
    if (!anchor || !bubble || bubble.isDestroyed()) {
      return
    }
    const area = screen.getDisplayMatching(anchor).workArea
    const size = { width: BUBBLE_SIZE.width, height: this.bubbleHeight }
    const position = placeOverlay(anchor, size, area, 'above')
    bubble.setBounds({ ...position, ...size })
  }

  private pushBubbles(): void {
    const window = this.bubbleWindow
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) {
      return
    }
    window.webContents.send(IPC_CHANNELS.bubbleUpdate, {
      bubbles: this.bubbles.map((bubble) => ({ ...bubble }))
    })
  }

  private setBubbleTimer(payload: BubblePayload, id: string): void {
    const autoHide = payload.persistent !== true && payload.autoHide !== false
    if (!autoHide) {
      this.bubbleTimers.delete(id)
      this.stopBubbleTickIfIdle()
      return
    }
    this.bubbleTimers.set(id, {
      remainingMs: this.options.getBubbleDurationMs(),
      lastTick: Date.now()
    })
    this.startBubbleTick()
  }

  private clearBubbleTimer(id: string): void {
    this.bubbleTimers.delete(id)
    this.stopBubbleTickIfIdle()
  }

  private startBubbleTick(): void {
    if (this.bubbleTick !== null) {
      return
    }
    this.bubbleTick = setInterval(() => this.tickBubbles(), 250)
  }

  private stopBubbleTickIfIdle(): void {
    if (this.bubbleTimers.size === 0 && this.bubbleTick !== null) {
      clearInterval(this.bubbleTick)
      this.bubbleTick = null
    }
  }

  private tickBubbles(): void {
    if (this.disposed || this.bubbleTimers.size === 0) {
      this.stopBubbleTickIfIdle()
      return
    }
    const now = Date.now()
    const hovered = this.isPointerOverPetOrBubble()
    for (const [id, timer] of this.bubbleTimers) {
      const elapsed = now - timer.lastTick
      timer.lastTick = now
      if (!hovered) {
        timer.remainingMs -= elapsed
        if (timer.remainingMs <= 0) {
          this.dismissBubble(id)
        }
      }
    }
    this.stopBubbleTickIfIdle()
  }

  private isPointerOverPetOrBubble(): boolean {
    const bubble = this.bubbleWindow
    if (!bubble || bubble.isDestroyed() || !bubble.isVisible()) {
      return false
    }
    const cursor = screen.getCursorScreenPoint()
    if (containsPoint(bubble.getBounds(), cursor.x, cursor.y)) {
      return true
    }
    if (!this.options.isPetVisible()) {
      return false
    }
    const pet = this.options.getPetBounds()
    return pet ? containsPoint(pet, cursor.x, cursor.y) : false
  }
}
