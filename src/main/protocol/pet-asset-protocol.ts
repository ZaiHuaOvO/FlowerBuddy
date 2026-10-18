import { readFile } from 'node:fs/promises'
import { protocol } from 'electron'
import { PET_ASSET_SCHEME } from '../../shared/api'

/**
 * Serves pet images to the renderers. The resolver only knows the configured
 * asset and the bundled default, so arbitrary file reads are impossible.
 */
export function handlePetAssetRequests(resolveAssetPath: (assetId: string) => string | null): void {
  protocol.handle(PET_ASSET_SCHEME, async (request) => {
    const assetId = parseAssetId(request.url)
    if (!assetId) {
      return new Response('Not found', { status: 404 })
    }

    const filePath = resolveAssetPath(assetId)
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

function parseAssetId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    if (url.host !== 'asset') {
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
