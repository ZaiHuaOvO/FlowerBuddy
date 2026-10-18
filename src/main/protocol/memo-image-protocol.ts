import { readFile } from 'node:fs/promises'
import { protocol } from 'electron'
import { MEMO_IMAGE_SCHEME } from '../../shared/api'

/** Must run before app ready. */
export function registerMemoImageScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEMO_IMAGE_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true
      }
    }
  ])
}

/**
 * Serves memo images. The resolver only accepts UUID file names inside the
 * memo image directory, so arbitrary file reads are impossible.
 */
export function handleMemoImageRequests(resolvePath: (imageId: string) => string | null): void {
  protocol.handle(MEMO_IMAGE_SCHEME, async (request) => {
    const imageId = parseImageId(request.url)
    if (!imageId) {
      return new Response('Not found', { status: 404 })
    }

    const filePath = resolvePath(imageId)
    if (!filePath) {
      return new Response('Not found', { status: 404 })
    }

    try {
      const data = await readFile(filePath)
      return new Response(data, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-store'
        }
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

function parseImageId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    if (url.host !== 'image') {
      return null
    }
    const raw = url.pathname.replace(/^\/+/, '')
    if (!raw) {
      return null
    }
    const decoded = decodeURIComponent(raw)
    return decoded.length <= 64 ? decoded : null
  } catch {
    return null
  }
}
