export interface GmailHeader {
  name?: string | null
  value?: string | null
}

/** Decodes RFC 2047 encoded words commonly used in Gmail headers. */
export function decodeMimeHeader(value: string): string {
  return value.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
    (_match, charset: string, encoding: string, text: string) => {
      try {
        const normalized = charset.toLowerCase()
        const isUtf8 = normalized === 'utf-8' || normalized === 'utf8' || normalized === 'us-ascii'
        if (encoding.toUpperCase() === 'B') {
          return Buffer.from(text, 'base64').toString(isUtf8 ? 'utf8' : 'latin1')
        }

        const bytes: number[] = []
        for (let index = 0; index < text.length; index += 1) {
          const char = text[index] as string
          if (char === '_') {
            bytes.push(0x20)
            continue
          }
          const hex = text.slice(index + 1, index + 3)
          if (char === '=' && /^[0-9A-Fa-f]{2}$/.test(hex)) {
            bytes.push(Number.parseInt(hex, 16))
            index += 2
            continue
          }
          bytes.push(char.charCodeAt(0) & 0xff)
        }
        return Buffer.from(bytes).toString(isUtf8 ? 'utf8' : 'latin1')
      } catch {
        return text
      }
    }
  )
}

export function extractHeader(headers: GmailHeader[] | null | undefined, name: string): string {
  const found = (headers ?? []).find(
    (header) => (header.name ?? '').toLowerCase() === name.toLowerCase()
  )
  return found?.value ?? ''
}
