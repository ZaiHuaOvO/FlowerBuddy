import { BrowserWindow, screen } from 'electron'
import type { MemoCardEdge, MemoCardState } from '../../shared/api'
import { IPC_CHANNELS } from '../../shared/api'
import type { MemoService } from '../modules/memo/memo-service'
import {
  MEMO_CARD_DEFAULT_HEIGHT,
  MEMO_CARD_DEFAULT_WIDTH,
  MEMO_CARD_MAX_HEIGHT,
  MEMO_CARD_MAX_WIDTH,
  MEMO_CARD_MIN_HEIGHT,
  MEMO_CARD_MIN_WIDTH,
  type MemoBounds,
  type StoredMemo
} from '../modules/memo/types'
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
  logger: LoggerLike
}

/** Owns one always-on-top card window per anchored memo. */
export class MemoCardWindowManager {
  private readonly cards = new Map<string, ManagedCard>()
  private disposed = false

  constructor(private readonly options: MemoCardWindowManagerOptions) {}

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
    return toCardState(memo)
  }

  beginDrag(id: string): void {
    const card = this.cards.get(id)
    if (!card || card.window.isDestroyed()) {
      return
    }
    const cursor = screen.getCursorScreenPoint()
    const bounds = card.window.getBounds()
    card.drag = { offsetX: cursor.x - bounds.x, offsetY: cursor.y - bounds.y }
  }

  dragMove(id: string): void {
    const card = this.cards.get(id)
    if (!card || card.window.isDestroyed() || !card.drag) {
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
    if (!card || card.window.isDestroyed()) {
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
    if (!card || card.window.isDestroyed() || !card.resize) {
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
    const bounds = this.initialBounds(memo)
    const window = createMemoCardWindow({
      preloadPath: this.options.preloadPath,
      bounds
    })
    const card: ManagedCard = { window, drag: null, resize: null }
    this.cards.set(id, card)

    window.on('closed', () => {
      this.cards.delete(id)
    })

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
    window.showInactive()
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
      reminderAt: memo.reminderAt
    }
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

  private initialBounds(memo: StoredMemo): Rect {
    const area = screen.getPrimaryDisplay().workArea
    const width = MEMO_CARD_DEFAULT_WIDTH
    const height = MEMO_CARD_DEFAULT_HEIGHT
    const desired = memo.bounds ?? {
      x: area.x + area.width - width - 48 - this.cards.size * 24,
      y: area.y + 64 + this.cards.size * 24,
      width,
      height
    }
    const position = clampToVisibleArea(desired, this.workAreas())
    return { ...position, width: desired.width, height: desired.height }
  }

  private workAreas(): Rect[] {
    return screen.getAllDisplays().map((display) => display.workArea)
  }
}

function toCardState(memo: StoredMemo): MemoCardState {
  return {
    id: memo.id,
    text: memo.text,
    images: memo.images,
    reminderAt: memo.reminderAt
  }
}
