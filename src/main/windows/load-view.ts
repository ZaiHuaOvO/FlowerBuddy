import type { BrowserWindow, Event as ElectronEvent } from 'electron'
import type { WindowView } from '../../shared/api'

export interface ViewLoadOptions {
  devServerUrl: string | undefined
  rendererIndexPath: string
  view: WindowView
  query?: Record<string, string>
}

/** Dev loads from the Vite server, packaged builds load the bundled HTML file. */
export function loadView(window: BrowserWindow, options: ViewLoadOptions): void {
  const query = { view: options.view, ...options.query }
  if (options.devServerUrl) {
    const base = options.devServerUrl.replace(/\/+$/, '')
    void window.loadURL(`${base}/?${new URLSearchParams(query).toString()}`)
    return
  }
  void window.loadFile(options.rendererIndexPath, { query })
}

/**
 * Loads a view and resolves once the first main-frame navigation settles.
 * Listeners are attached before navigation starts, so a fast load cannot be
 * missed. Returns false on failure or timeout instead of waiting forever.
 */
export function loadViewAndWait(
  window: BrowserWindow,
  options: ViewLoadOptions,
  timeoutMs = 5000
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (loaded: boolean): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      window.webContents.off('did-finish-load', onFinish)
      window.webContents.off('did-fail-load', onFail)
      resolve(loaded)
    }
    const onFinish = (): void => finish(true)
    const onFail = (
      _event: ElectronEvent,
      _errorCode: number,
      _errorDescription: string,
      _validatedUrl: string,
      isMainFrame: boolean
    ): void => {
      if (isMainFrame) {
        finish(false)
      }
    }
    const timer = setTimeout(() => finish(false), timeoutMs)

    window.webContents.on('did-finish-load', onFinish)
    window.webContents.on('did-fail-load', onFail)
    loadView(window, options)
  })
}
