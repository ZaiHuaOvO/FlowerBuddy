import { BrowserWindow } from 'electron'
import { createSecureWebPreferences } from '../security/web-preferences'
import type { Rect } from './geometry'
import {
  MEMO_CARD_MAX_HEIGHT,
  MEMO_CARD_MAX_WIDTH,
  MEMO_CARD_MIN_HEIGHT,
  MEMO_CARD_MIN_WIDTH
} from '../../shared/memo-layout'

export function createMemoCardWindow(options: {
  preloadPath: string
  bounds: Rect
}): BrowserWindow {
  const window = new BrowserWindow({
    x: options.bounds.x,
    y: options.bounds.y,
    width: options.bounds.width,
    height: options.bounds.height,
    minWidth: MEMO_CARD_MIN_WIDTH,
    minHeight: MEMO_CARD_MIN_HEIGHT,
    maxWidth: MEMO_CARD_MAX_WIDTH,
    maxHeight: MEMO_CARD_MAX_HEIGHT,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: createSecureWebPreferences(options.preloadPath, 'memo-card')
  })

  window.setMenu(null)
  return window
}
