import { BrowserWindow } from 'electron'
import type { Size } from './geometry'
import { createSecureWebPreferences } from '../security/web-preferences'
import type { WindowFactoryOptions } from './pet-window'
import { MENU_PANEL_MIN_WIDTH, menuWindowHeight } from '../../shared/menu-layout'
import { BUBBLE_WIDTH } from '../../shared/bubble-layout'

export const BUBBLE_SIZE: Size = { width: BUBBLE_WIDTH, height: 168 }
export { BUBBLE_MAX_HEIGHT, BUBBLE_MIN_HEIGHT } from '../../shared/bubble-layout'

export const DEFAULT_MENU_SIZE: Size = {
  width: MENU_PANEL_MIN_WIDTH,
  height: menuWindowHeight(false, 0)
}

export function createMenuWindow(options: WindowFactoryOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: DEFAULT_MENU_SIZE.width,
    height: DEFAULT_MENU_SIZE.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      ...createSecureWebPreferences(options.preloadPath, 'menu'),
      // The menu is hidden while Settings/another action is active; keep its
      // timers, effects and IPC acknowledgement responsive while hidden.
      backgroundThrottling: false
    }
  })

  window.setMenu(null)
  return window
}

export function createBubbleWindow(options: WindowFactoryOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: BUBBLE_SIZE.width,
    height: BUBBLE_SIZE.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: createSecureWebPreferences(options.preloadPath, 'bubble')
  })

  window.setMenu(null)
  return window
}
