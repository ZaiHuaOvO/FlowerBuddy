import type { WebPreferences } from 'electron'
import type { WindowView } from '../../shared/api'

/**
 * Single source of truth for the security-critical window options.
 * Renderers must never get direct Node.js or Electron access.
 */
export function createSecureWebPreferences(preloadPath: string, view: WindowView): WebPreferences {
  return {
    preload: preloadPath,
    additionalArguments: [`--fb-view=${view}`],
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
    webviewTag: false,
    navigateOnDragDrop: false,
    spellcheck: false
  }
}
