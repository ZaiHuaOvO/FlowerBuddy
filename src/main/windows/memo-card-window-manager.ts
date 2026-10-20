import { BrowserWindow, screen } from 'electron'
import type { MemoCardEdge, MemoCardState } from '../../shared/api'
import { IPC_CHANNELS } from '../../shared/api'
import type { MemoService } from '../modules/memo/memo-service'
import {
  MEMO_CARD_BODY_PADDING,
  MEMO_CARD_DEFAULT_WIDTH,
  MEMO_CARD_HEADER_HEIGHT,
  MEMO_CARD_LINE_HEIGHT,
  MEMO_CARD_MAX_HEIGHT,
  MEMO_CARD_MAX_WIDTH,
  MEMO_CARD_MIN_HEIGHT,
  MEMO_CARD_MIN_WIDTH
} from '../../shared/memo-layout'
import type { MemoBounds, StoredMemo } from '../modules/memo/types'
import { AppError } from '../shared/errors'
import type { LoggerLike } from '../shared/logger'
import type { Rect } from './geometry'
import { clampToVisibleArea } from './geometry'
import { computeResizedBounds } from './memo-card-geometry'
import { createMemoCardWindow } from './memo-card-window'
import { loadViewAndWait } from './load-view'

const RESIZE_LIMITS = {
  minWidth: MEMO_CARD_MIN_WIDTH,
  minHeight: MEMO_CARD_MIN_HEIGHT,
  maxWidth: MEMO_CARD_MAX_WIDTH,
  maxHeight: MEMO_CARD_MAX_HEIGHT
}

interface DragSession {
  offsetX: number
  offsetY: number
}

interface ResizeSession {
  edge: MemoCardEdge
  startBounds: Rect
  startX: number
  startY: number
}

interface ManagedCard {
  window: BrowserWindow
  drag: DragSession | null
  resize: ResizeSession | null
}

export interface MemoCardWindowManagerOptions {
  preloadPath: string
  devServerUrl: string | undefined
  rendererIndexPath: string
  service: MemoService
  isEnabled: () => boolean
  isLineTasksEnabled: () => boolean
  logger: LoggerLike
}

/** Owns one always-on-top card window per anchored memo. */
export class MemoCardWindowManager {
  private readonly cards = new Map<string, ManagedCard>()
  private disposed = false
  private visible = true

  constructor(private readonly options: MemoCardWindowManagerOptions) {}

  setVisible(visible: boolean): void {
    this.visible = visible
    for (const card of this.cards.values()) {
      if (card.window.isDestroyed()) {
        continue
      }
      if (visible) {
        card.window.showInactive()
      } else {
        card.window.hide()
      }
    }
  }

  sync(): void {
    if (this.disposed) {
      return
    }
    const wanted = this.options.isEnabled()
      ? this.options.service.list().filter((memo) => memo.anchored && !memo.completed)
      : []
    const wantedIds = new Set(wanted.map((memo) => memo.id))

    for (const id of [...this.cards.keys()]) {
      if (!wantedIds.has(id)) {
        this.close(id)
      }
    }
    for (const memo of wanted) {
      void this.ensureWindow(memo.id)
    }
    this.pushAll()
  }

  getState(id: string): MemoCardState {
    const memo = this.options.service.get(id)
    if (!memo) {
      throw new AppError('NOT_FOUND', '未找到该备忘录')
    }
    return toCardState(memo, this.options.isLineTasksEnabled())
  }

  beginDrag(id: string): void {
    const card = this.cards.get(id)
    if (!card || card.window.isDestroyed() || this.options.service.get(id)?.locked) {
      return
    }
    const cursor = screen.getCursorScreenPoint()
    const bounds = card.window.getBounds()
    card.drag = { offsetX: cursor.x - bounds.x, offsetY: cursor.y - bounds.y }
  }

  dragMove(id: string): void {
    const card = this.cards.get(id)
    if (!card || card.window.isDestroyed() || !card.drag || this.options.service.get(id)?.locked) {
      return
    }
    const cursor = screen.getCursorScreenPoint()
    card.window.setPosition(
      Math.round(cursor.x - card.drag.offsetX),
      Math.round(cursor.y - card.drag.offsetY)
    )
  }

  endDrag(id: string): void {
    const card = this.cards.get(id)
    if (!card || card.window.isDestroyed()) {
      return
    }
    card.drag = null
    const bounds = card.window.getBounds()
    const position = clampToVisibleArea(bounds, this.workAreas())
    card.window.setPosition(position.x, position.y)
    this.persistBounds(id, { ...position, width: bounds.width, height: bounds.height })
  }

  beginResize(id: string, edge: MemoCardEdge): void {
    const card = this.cards.get(id)
    if (!card || card.window.isDestroyed() || this.options.service.get(id)?.locked) {
      return
    }
    const cursor = screen.getCursorScreenPoint()
    card.resize = {
      edge,
      startBounds: card.window.getBounds(),
      startX: cursor.x,
      startY: cursor.y
    }
  }

  resizeMove(id: string): void {
    const card = this.cards.get(id)
    if (
      !card ||
      card.window.isDestroyed() ||
      !card.resize ||
      this.options.service.get(id)?.locked
    ) {
      return
    }
    const cursor = screen.getCursorScreenPoint()
    const next = computeResizedBounds(
      card.resize.startBounds,
      card.resize.edge,
      cursor.x - card.resize.startX,
      cursor.y - card.resize.startY,
      RESIZE_LIMITS
    )
    card.window.setBounds(next)
  }

  endResize(id: string): void {
    const card = this.cards.get(id)
    if (!card || card.window.isDestroyed()) {
      return
    }
    card.resize = null
    const bounds = card.window.getBounds()
    this.persistBounds(id, bounds)
  }

  fitHeight(id: string, height: number): void {
    const card = this.cards.get(id)
    if (!card || card.window.isDestroyed()) {
      return
    }
    const bounds = card.window.getBounds()
    const nextHeight = Math.round(
      Math.max(
        MEMO_CARD_MIN_HEIGHT,
        Math.min(Number.isFinite(height) ? height : 0, MEMO_CARD_MAX_HEIGHT)
      )
    )
    if (Math.abs(bounds.height - nextHeight) < 1) {
      return
    }
    const area = screen.getDisplayMatching(bounds).workArea
    const next = {
      x: Math.max(area.x + 8, Math.min(bounds.x, area.x + area.width - bounds.width - 8)),
      y: Math.max(area.y + 8, Math.min(bounds.y, area.y + area.height - nextHeight - 8)),
      width: bounds.width,
      height: nextHeight
    }
    card.window.setBounds(next)
    this.options.service.updateBounds(id, next)
  }

  setIgnoreMouse(id: string, ignore: boolean): void {
    const card = this.cards.get(id)
    if (!card || card.window.isDestroyed()) {
      return
    }
    const memo = this.options.service.get(id)
    if (!memo?.locked) {
      return
    }
    card.window.setIgnoreMouseEvents(ignore, { forward: true })
  }

  ensureVisible(): void {
    for (const [id, card] of this.cards) {
      if (card.window.isDestroyed()) {
        continue
      }
      const bounds = card.window.getBounds()
      const position = clampToVisibleArea(bounds, this.workAreas())
      if (position.x !== bounds.x || position.y !== bounds.y) {
        card.window.setPosition(position.x, position.y)
        this.persistBounds(id, { ...position, width: bounds.width, height: bounds.height })
      }
    }
  }

  pushAll(): void {
    for (const [id, card] of this.cards) {
      this.pushState(id, card)
    }
  }

  dispose(): void {
    this.disposed = true
    for (const id of [...this.cards.keys()]) {
      this.close(id)
    }
  }

  private async ensureWindow(id: string): Promise<void> {
    const memo = this.options.service.get(id)
    if (this.disposed || !memo || this.cards.has(id)) {
      return
    }
    const placement = this.initialBounds(memo)
    const bounds = placement.bounds
    const window = createMemoCardWindow({
      preloadPath: this.options.preloadPath,
      bounds
    })
    const card: ManagedCard = { window, drag: null, resize: null }
    this.cards.set(id, card)

    window.on('closed', () => {
      this.cards.delete(id)
    })

    if (placement.persist) {
      setTimeout(() => {
        if (!this.disposed) {
          this.options.service.updateBounds(id, bounds)
        }
      }, 0)
    }

    const loaded = await loadViewAndWait(window, {
      devServerUrl: this.options.devServerUrl,
      rendererIndexPath: this.options.rendererIndexPath,
      view: 'memo-card',
      query: { memoId: memo.id }
    })
    if (!loaded || window.isDestroyed() || this.disposed) {
      this.cards.delete(id)
      if (!window.isDestroyed()) {
        window.destroy()
      }
      this.options.logger.warn('memo card window failed to load', { memoId: memo.id })
      return
    }
    this.pushState(id, card)
    if (this.visible) {
      window.showInactive()
    }
  }

  private pushState(id: string, card: ManagedCard): void {
    if (card.window.isDestroyed() || card.window.webContents.isDestroyed()) {
      return
    }
    const memo = this.options.service.get(id)
    if (!memo) {
      return
    }
    const state: MemoCardState = {
      id: memo.id,
      text: memo.text,
      images: memo.images,
      lineTasks: memo.lineTasks,
      lineTasksEnabled: this.options.isLineTasksEnabled(),
      reminderAt: memo.reminderAt,
      locked: memo.locked
    }
    card.window.setIgnoreMouseEvents(memo.locked, { forward: true })
    card.window.webContents.send(IPC_CHANNELS.memoCardStateChanged, state)
  }

  private close(id: string): void {
    const card = this.cards.get(id)
    if (!card) {
      return
    }
    this.cards.delete(id)
    if (!card.window.isDestroyed()) {
      card.window.destroy()
    }
  }

  private persistBounds(id: string, bounds: MemoBounds): void {
    this.options.service.updateBounds(id, bounds)
  }

  private initialBounds(memo: StoredMemo): { bounds: Rect; persist: boolean } {
    const area = screen.getPrimaryDisplay().workArea
    const width = memo.bounds?.width ?? MEMO_CARD_DEFAULT_WIDTH
    const height = estimateMemoCardHeight(memo)

    if (memo.bounds) {
      const stored = {
        ...clampToVisibleArea(memo.bounds, this.workAreas()),
        width,
        height
      }
      if (!this.overlapsExisting(stored)) {
        return { bounds: stored, persist: false }
      }
    }

    return { bounds: this.findFreeSlot(area, width, height), persist: true }
  }

  private findFreeSlot(area: Rect, width: number, height: number): Rect {
    const margin = 40
    const gap = 12
    for (let column = 0; column < 8; column += 1) {
      const x = area.x + area.width - width - margin - column * (width + gap)
      if (x < area.x + margin) {
        break
      }
      for (let row = 0; row < 12; row += 1) {
        const y = area.y + margin + row * (height + gap)
        if (y + height > area.y + area.height - margin) {
          break
        }
        const candidate = { x, y, width, height }
        if (!this.overlapsExisting(candidate)) {
          return candidate
        }
      }
    }
    const fallback = { x: area.x + area.width - width - margin, y: area.y + margin, width, height }
    const position = clampToVisibleArea(fallback, this.workAreas())
    return { ...position, width, height }
  }

  private overlapsExisting(candidate: Rect): boolean {
    const padding = 8
    for (const card of this.cards.values()) {
      if (card.window.isDestroyed()) {
        continue
      }
      const other = card.window.getBounds()
      if (
        candidate.x < other.x + other.width + padding &&
        candidate.x + candidate.width + padding > other.x &&
        candidate.y < other.y + other.height + padding &&
        candidate.y + candidate.height + padding > other.y
      ) {
        return true
      }
    }
    return false
  }

  private workAreas(): Rect[] {
    return screen.getAllDisplays().map((display) => display.workArea)
  }
}

function toCardState(memo: StoredMemo, lineTasksEnabled: boolean): MemoCardState {
  return {
    id: memo.id,
    text: memo.text,
    images: memo.images,
    lineTasks: memo.lineTasks,
    lineTasksEnabled,
    reminderAt: memo.reminderAt,
    locked: memo.locked
  }
}

/** Rough first-paint height; the renderer reports the exact content height. */
function estimateMemoCardHeight(memo: StoredMemo): number {
  const contentWidth = MEMO_CARD_DEFAULT_WIDTH - 2 - MEMO_CARD_BODY_PADDING * 2
  const charsPerLine = Math.max(6, Math.floor(contentWidth / 13))
  let lines = 0
  if (memo.text.trim().length > 0) {
    for (const rawLine of memo.text.split(/\r?\n/)) {
      let units = 0
      for (const char of rawLine) {
        units += /[⺀-鿿＀-￯]/.test(char) ? 1 : 0.55
      }
      lines += Math.max(1, Math.ceil(units / charsPerLine))
    }
  }
  let height =
    MEMO_CARD_HEADER_HEIGHT + MEMO_CARD_BODY_PADDING * 2 + MEMO_CARD_LINE_HEIGHT * (lines + 1) + 2
  for (const image of memo.images) {
    if (image.width > 0) {
      const displayedWidth = Math.min(image.width, contentWidth)
      height += Math.round((image.height * displayedWidth) / image.width) + 8
    }
  }
  return Math.max(MEMO_CARD_MIN_HEIGHT, Math.min(height, MEMO_CARD_MAX_HEIGHT))
}
