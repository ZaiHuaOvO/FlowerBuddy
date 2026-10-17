import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { downsample, encodePng, over } from './lib/png.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = resolve(ROOT, 'assets', 'default-pet', 'flower.png')
const MASTER_SIZE = 1024
const OUTPUT_SIZE = 512

function distance(x, y, centerX, centerY) {
  return Math.hypot(x - centerX, y - centerY)
}

function insideRotatedEllipse(u, v, centerX, centerY, radiusX, radiusY, rotation) {
  const dx = u - centerX
  const dy = v - centerY
  const cos = Math.cos(-rotation)
  const sin = Math.sin(-rotation)
  const localX = dx * cos - dy * sin
  const localY = dx * sin + dy * cos
  return (localX / radiusX) ** 2 + (localY / radiusY) ** 2 <= 1
}

function insideCapsule(u, v, x1, y1, x2, y2, radius) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSquared = dx * dx + dy * dy
  let t = ((u - x1) * dx + (v - y1) * dy) / lengthSquared
  t = Math.max(0, Math.min(1, t))
  const closestX = x1 + t * dx
  const closestY = y1 + t * dy
  return (u - closestX) ** 2 + (v - closestY) ** 2 <= radius * radius
}

function sample(u, v) {
  let color = [0, 0, 0, 0]

  if (insideCapsule(u, v, 0.5, 0.64, 0.5, 0.93, 0.028)) {
    color = over(color, 96, 171, 108)
  }
  if (insideRotatedEllipse(u, v, 0.405, 0.845, 0.1, 0.052, -0.45)) {
    color = over(color, 111, 190, 122)
  }
  if (insideRotatedEllipse(u, v, 0.595, 0.845, 0.1, 0.052, 0.45)) {
    color = over(color, 111, 190, 122)
  }

  if (distance(u, v, 0.5, 0.4) <= 0.3) {
    const t = Math.max(0, Math.min(1, (v - 0.12) / 0.56))
    color = over(color, 255, 205 - 77 * t, 215 - 55 * t)

    if (distance(u, v, 0.352, 0.472) <= 0.045 || distance(u, v, 0.648, 0.472) <= 0.045) {
      color = over(color, 255, 150, 176, 0.5)
    }
    if (distance(u, v, 0.428, 0.385) <= 0.034 || distance(u, v, 0.572, 0.385) <= 0.034) {
      color = over(color, 74, 46, 53)
    }
    if (distance(u, v, 0.44, 0.374) <= 0.011 || distance(u, v, 0.584, 0.374) <= 0.011) {
      color = over(color, 255, 255, 255, 0.9)
    }

    const dx = u - 0.5
    const dy = v - 0.418
    const smileRadius = Math.hypot(dx, dy)
    if (Math.abs(smileRadius - 0.072) <= 0.007 && dy > 0.015 && Math.abs(dx) < 0.07) {
      color = over(color, 74, 46, 53)
    }
  }

  return color
}

const master = Buffer.alloc(MASTER_SIZE * MASTER_SIZE * 4)
for (let y = 0; y < MASTER_SIZE; y += 1) {
  for (let x = 0; x < MASTER_SIZE; x += 1) {
    const [red, green, blue, alpha] = sample((x + 0.5) / MASTER_SIZE, (y + 0.5) / MASTER_SIZE)
    const offset = (y * MASTER_SIZE + x) * 4
    master[offset] = Math.round(red)
    master[offset + 1] = Math.round(green)
    master[offset + 2] = Math.round(blue)
    master[offset + 3] = Math.round(alpha * 255)
  }
}

const output = downsample(master, MASTER_SIZE, OUTPUT_SIZE)
mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, encodePng(OUTPUT_SIZE, output))

console.log(`Wrote ${OUTPUT} (${OUTPUT_SIZE} px, transparent background)`)
