import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { downsample, encodePng } from './lib/png.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ICON_OUTPUT = resolve(ROOT, 'assets', 'app-icon.ico')
const TRAY_OUTPUT = resolve(ROOT, 'assets', 'tray-icon.png')
const MASTER_SIZE = 1024
const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256]
const TRAY_SIZE = 64

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

mkdirSync(dirname(ICON_OUTPUT), { recursive: true })
writeFileSync(ICON_OUTPUT, buildIco(frames))
writeFileSync(TRAY_OUTPUT, encodePng(TRAY_SIZE, downsample(master, MASTER_SIZE, TRAY_SIZE)))

console.log(`Wrote ${ICON_OUTPUT} (${ICON_SIZES.join(', ')} px)`)
console.log(`Wrote ${TRAY_OUTPUT} (${TRAY_SIZE} px)`)
