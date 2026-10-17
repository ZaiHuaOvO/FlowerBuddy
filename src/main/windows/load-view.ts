import type { BrowserWindow } from 'electron'
import type { WindowView } from '../../shared/api'

export interface ViewLoadOptions {
  devServerUrl: string | undefined
  rendererIndexPath: string
  view: WindowView
}

/** Dev loads from the Vite server, packaged builds load the bundled HTML file. */
export function loadView(window: BrowserWindow, options: ViewLoadOptions): void {
  if (options.devServerUrl) {
    const base = options.devServerUrl.replace(/\/+$/, '')
    void window.loadURL(`${base}/?view=${options.view}`)
    return
  }
  void window.loadFile(options.rendererIndexPath, { query: { view: options.view } })
}

export function waitForLoad(window: BrowserWindow): Promise<void> {
  if (!window.webContents.isLoadingMainFrame()) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    window.webContents.once('did-finish-load', () => resolve())
  })
}
