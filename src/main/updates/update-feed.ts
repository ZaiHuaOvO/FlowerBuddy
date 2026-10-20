/**
 * The update feed override exists for development and mirror testing. Only
 * HTTPS feeds (or local HTTP for an isolated test server) are accepted so a
 * malformed or plain-text URL cannot silently redirect updates.
 */
export function sanitizeUpdateUrlOverride(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined
  }

  try {
    const url = new URL(raw)
    const isLoopback =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
    if (url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback)) {
      return url.toString()
    }
  } catch {
    // Fall through to the ignored result below.
  }

  return undefined
}
