import { pathToFileURL } from 'node:url'
import type { WebContents } from 'electron'

export interface NavigationGuardOptions {
  devServerUrl: string | undefined
  rendererIndexPath: string
}

/** The Vite dev server is trusted only in unpackaged development runs. */
export function resolveDevServerUrl(
  isPackaged: boolean,
  rawUrl: string | undefined
): string | undefined {
  return isPackaged ? undefined : rawUrl
}

function decodePath(pathname: string): string {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return pathname
  }
}

/** Only the app's own renderer page may replace a window's top-level document. */
export function isAllowedAppNavigation(rawUrl: string, options: NavigationGuardOptions): boolean {
  try {
    const target = new URL(rawUrl)
    if (options.devServerUrl) {
      const devServer = new URL(options.devServerUrl)
      return target.origin === devServer.origin && target.pathname === '/'
    }
    if (target.protocol !== 'file:') {
      return false
    }
    const expected = pathToFileURL(options.rendererIndexPath)
    const targetPath = decodePath(target.pathname)
    const expectedPath = decodePath(expected.pathname)
    return process.platform === 'win32'
      ? targetPath.toLowerCase() === expectedPath.toLowerCase()
      : targetPath === expectedPath
  } catch {
    return false
  }
}

/**
 * Applies one policy to every app window: deny new windows and block external
 * top-level navigation or redirects. Subresource loads are unaffected.
 */
export function installNavigationGuards(
  contents: WebContents,
  options: NavigationGuardOptions
): void {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))

  contents.on('will-navigate', (details) => {
    if (details.isMainFrame && !isAllowedAppNavigation(details.url, options)) {
      details.preventDefault()
    }
  })

  contents.on('will-redirect', (details) => {
    if (details.isMainFrame && !isAllowedAppNavigation(details.url, options)) {
      details.preventDefault()
    }
  })
}
