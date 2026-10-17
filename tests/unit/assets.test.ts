import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readPngInfo } from '../../src/main/storage/pet-assets'

function readAsset(...segments: string[]): Buffer {
  return readFileSync(resolve('assets', ...segments))
}

describe('bundled assets', () => {
  it('ships a valid 64x64 tray icon', () => {
    expect(readPngInfo(readAsset('tray-icon.png'))).toEqual({ width: 64, height: 64 })
  })

  it('ships the default pet as a valid PNG with the expected size', () => {
    const info = readPngInfo(readAsset('default-pet', 'flower.png'))
    if (!info) {
      throw new Error('default pet is not a valid PNG')
    }
    expect(info.width).toBe(512)
    expect(info.height).toBeGreaterThan(300)
    expect(info.height).toBeLessThan(512)
  })

  it('builds the application icon with every Windows size', () => {
    const buffer = readAsset('app-icon.ico')
    expect(buffer.readUInt16LE(0)).toBe(0)
    expect(buffer.readUInt16LE(2)).toBe(1)

    const count = buffer.readUInt16LE(4)
    expect(count).toBe(7)

    const dimensions = Array.from({ length: count }, (_, index) => {
      const value = buffer[6 + index * 16]
      return value === 0 ? 256 : value
    })
    expect(dimensions).toEqual([16, 24, 32, 48, 64, 128, 256])
  })
})
