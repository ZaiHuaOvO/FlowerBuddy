import { BrowserWindow } from 'electron'
import { createSecureWebPreferences } from '../security/web-preferences'
import type { WindowFactoryOptions } from './pet-window'

export function createSettingsWindow(options: WindowFactoryOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: 780,
    height: 720,
    minWidth: 640,
    minHeight: 540,
    show: false,
    title: '花伴',
    autoHideMenuBar: true,
    backgroundColor: '#0f1419',
    ...(options.iconPath ? { icon: options.iconPath } : {}),
    webPreferences: createSecureWebPreferences(options.preloadPath, 'settings')
  })

  window.setMenu(null)
  return window
}
