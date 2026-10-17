import { BrowserWindow } from 'electron'
import { createSecureWebPreferences } from '../security/web-preferences'
import type { Rect } from './geometry'

export interface WindowFactoryOptions {
  preloadPath: string
}

export function createPetWindow(
  options: WindowFactoryOptions & { bounds: Rect; alwaysOnTop: boolean }
): BrowserWindow {
  const window = new BrowserWindow({
    x: options.bounds.x,
    y: options.bounds.y,
    width: options.bounds.width,
    height: options.bounds.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: options.alwaysOnTop,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: createSecureWebPreferences(options.preloadPath, 'pet')
  })

  window.setMenu(null)
  window.setAlwaysOnTop(options.alwaysOnTop)
  return window
}
