import { deflateSync } from 'node:zlib'

let crcTable = null

export function crc32(buffer) {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n += 1) {
      let value = n
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
      }
      crcTable[n] = value >>> 0
    }
  }

  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

export function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y += 1) {
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

export function downsample(master, masterSize, size) {
  const output = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    const sourceY0 = Math.floor((y * masterSize) / size)
    const sourceY1 = Math.max(sourceY0 + 1, Math.floor(((y + 1) * masterSize) / size))

    for (let x = 0; x < size; x += 1) {
      const sourceX0 = Math.floor((x * masterSize) / size)
      const sourceX1 = Math.max(sourceX0 + 1, Math.floor(((x + 1) * masterSize) / size))

      let red = 0
      let green = 0
      let blue = 0
      let alpha = 0
      let count = 0

      for (let sourceY = sourceY0; sourceY < sourceY1; sourceY += 1) {
        for (let sourceX = sourceX0; sourceX < sourceX1; sourceX += 1) {
          const source = (sourceY * masterSize + sourceX) * 4
          red += master[source]
          green += master[source + 1]
          blue += master[source + 2]
          alpha += master[source + 3]
          count += 1
        }
      }

      const target = (y * size + x) * 4
      output[target] = Math.round(red / count)
      output[target + 1] = Math.round(green / count)
      output[target + 2] = Math.round(blue / count)
      output[target + 3] = Math.round(alpha / count)
    }
  }

  return output
}

/** Source-over compositing in straight alpha. Colors are 0-255, alpha 0-1. */
export function over(destination, red, green, blue, alpha = 1) {
  const sourceAlpha = Math.max(0, Math.min(1, alpha))
  const destinationAlpha = destination[3]
  const outAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha)
  if (outAlpha <= 0) {
    return [0, 0, 0, 0]
  }
  return [
    (red * sourceAlpha + destination[0] * destinationAlpha * (1 - sourceAlpha)) / outAlpha,
    (green * sourceAlpha + destination[1] * destinationAlpha * (1 - sourceAlpha)) / outAlpha,
    (blue * sourceAlpha + destination[2] * destinationAlpha * (1 - sourceAlpha)) / outAlpha,
    outAlpha
  ]
}
