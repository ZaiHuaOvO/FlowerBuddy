import { pathToFileURL } from 'node:url'

export interface TrustedRenderer {
  /** Set only while running against the Vite dev server. */
  devServerUrl: string | undefined
  rendererIndexPath: string
}

type SenderUrl = string | undefined

/**
 * Builds the predicate used by every IPC handler. A frame is trusted only when
 * it is our packaged index.html or a page served by the dev server.
 */
export function createSenderValidator(trusted: TrustedRenderer): (url: SenderUrl) => boolean {
  const expectedFileUrl = pathToFileURL(trusted.rendererIndexPath).href
  const devOrigin = trusted.devServerUrl ? new URL(trusted.devServerUrl).origin : undefined

  return (url: SenderUrl): boolean => {
    if (!url) {
      return false
    }

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return false
    }

    if (devOrigin && parsed.origin === devOrigin) {
      return true
    }

    if (parsed.protocol !== 'file:') {
      return false
    }

    const normalized = new URL(parsed.href)
    normalized.search = ''
    normalized.hash = ''
    return normalized.href === expectedFileUrl
  }
}
