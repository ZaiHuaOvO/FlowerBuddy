import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = resolve(ROOT, 'assets', 'app-icon.ico')
const MASTER_SIZE = 1024
const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256]

let crcTable

function crc32(buffer) {
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

function encodePng(size, rgba) {
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

function insideRoundedRect(x, y, size, margin, radius) {
  const left = margin
  const top = margin
  const right = size - margin
  const bottom = size - margin
  const nearestX = Math.min(Math.max(x, left + radius), right - radius)
  const nearestY = Math.min(Math.max(y, top + radius), bottom - radius)
  const dx = x - nearestX
  const dy = y - nearestY
  return dx * dx + dy * dy <= radius * radius
}

function insidePetal(u, v, angle) {
  const distance = 0.145
  const semiMajor = 0.168
  const semiMinor = 0.102
  const centerX = 0.5 + Math.cos(angle) * distance
  const centerY = 0.5 + Math.sin(angle) * distance
  const dx = u - centerX
  const dy = v - centerY
  const radial = dx * Math.cos(angle) + dy * Math.sin(angle)
  const tangential = -dx * Math.sin(angle) + dy * Math.cos(angle)
  return (radial / semiMajor) ** 2 + (tangential / semiMinor) ** 2 <= 1
}

function renderMaster(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const margin = size * 0.025
  const radius = size * 0.235
  const topColor = [132, 219, 184]
  const bottomColor = [56, 138, 110]
  const petalColor = [255, 250, 244]
  const centerColor = [255, 201, 77]

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4
      if (!insideRoundedRect(x + 0.5, y + 0.5, size, margin, radius)) {
        continue
      }

      const t = y / (size - 1)
      let r = topColor[0] + (bottomColor[0] - topColor[0]) * t
      let g = topColor[1] + (bottomColor[1] - topColor[1]) * t
      let b = topColor[2] + (bottomColor[2] - topColor[2]) * t

      const u = (x + 0.5) / size
      const v = (y + 0.5) / size

      let onPetal = false
      for (let petal = 0; petal < 5; petal += 1) {
        if (insidePetal(u, v, -Math.PI / 2 + (petal * Math.PI * 2) / 5)) {
          onPetal = true
          break
        }
      }
      if (onPetal) {
        ;[r, g, b] = petalColor
      }

      const dx = u - 0.5
      const dy = v - 0.5
      if (dx * dx + dy * dy <= 0.075 * 0.075) {
        ;[r, g, b] = centerColor
      }

      pixels[offset] = Math.round(r)
      pixels[offset + 1] = Math.round(g)
      pixels[offset + 2] = Math.round(b)
      pixels[offset + 3] = 255
    }
  }

  return pixels
}

function downsample(master, masterSize, size) {
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

function buildIco(frames) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(frames.length, 4)

  const directory = Buffer.alloc(16 * frames.length)
  let offset = header.length + directory.length

  frames.forEach((frame, index) => {
    const entry = index * 16
    const dimension = frame.size >= 256 ? 0 : frame.size
    directory[entry] = dimension
    directory[entry + 1] = dimension
    directory[entry + 2] = 0
    directory[entry + 3] = 0
    directory.writeUInt16LE(1, entry + 4)
    directory.writeUInt16LE(32, entry + 6)
    directory.writeUInt32LE(frame.data.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += frame.data.length
  })

  return Buffer.concat([header, directory, ...frames.map((frame) => frame.data)])
}

const master = renderMaster(MASTER_SIZE)
const frames = ICON_SIZES.map((size) => ({
  size,
  data: encodePng(size, downsample(master, MASTER_SIZE, size))
}))

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, buildIco(frames))

console.log(`Wrote ${OUTPUT} (${ICON_SIZES.join(', ')} px)`)
