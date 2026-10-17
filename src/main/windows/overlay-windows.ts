import { BrowserWindow } from 'electron'
import type { Size } from './geometry'
import { createSecureWebPreferences } from '../security/web-preferences'
import type { WindowFactoryOptions } from './pet-window'

export const MENU_SIZE: Size = { width: 236, height: 272 }
export const BUBBLE_SIZE: Size = { width: 340, height: 168 }

export function createMenuWindow(options: WindowFactoryOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: MENU_SIZE.width,
    height: MENU_SIZE.height,
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
    webPreferences: createSecureWebPreferences(options.preloadPath, 'menu')
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
