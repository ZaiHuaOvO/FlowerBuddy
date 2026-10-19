import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import type { Dirent } from 'node:fs'
import { join } from 'node:path'
import { isPetPresetId } from '../../shared/pet-presets'

export const MAX_PET_BYTES = 15 * 1024 * 1024
export const MAX_PET_DIMENSION = 8192
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const PRESET_FILES: Record<string, string> = {
  'preset-flower-cat': 'flower-cat.png',
  'preset-cat-pair': 'cat-pair.png',
  'preset-schoolgirl': 'schoolgirl.png'
}

export type PetAssetErrorCode = 'NOT_PNG' | 'TOO_LARGE' | 'UNREADABLE'

export class PetAssetError extends Error {
  constructor(readonly code: PetAssetErrorCode) {
    super(code)
    this.name = 'PetAssetError'
  }
}

export interface PngInfo {
  width: number
  height: number
}

/** Reads width/height from the IHDR chunk of a PNG buffer. Returns null when invalid. */
export function readPngInfo(buffer: Buffer): PngInfo | null {
  if (buffer.length < 33) {
    return null
  }
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return null
  }
  if (buffer.readUInt32BE(8) !== 13 || buffer.toString('ascii', 12, 16) !== 'IHDR') {
    return null
  }

  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  if (width < 1 || height < 1 || width > MAX_PET_DIMENSION || height > MAX_PET_DIMENSION) {
    return null
  }
  return { width, height }
}

export interface ImportedPetAsset {
  assetId: string
  info: PngInfo
  filePath: string
}

/** Validates a PNG buffer and copies it into the pets directory. */
export function importPetBuffer(
  buffer: Buffer,
  petsDirectory: string,
  maxBytes = MAX_PET_BYTES
): ImportedPetAsset {
  if (buffer.length > maxBytes) {
    throw new PetAssetError('TOO_LARGE')
  }

  const info = readPngInfo(buffer)
  if (!info) {
    throw new PetAssetError('NOT_PNG')
  }

  mkdirSync(petsDirectory, { recursive: true })
  const assetId = randomUUID()
  const filePath = join(petsDirectory, `${assetId}.png`)
  const temporaryPath = `${filePath}.tmp`
  writeFileSync(temporaryPath, buffer)
  renameSync(temporaryPath, filePath)

  return { assetId, info, filePath }
}

/** Validates a user-selected PNG and copies it into the pets directory. */
export function importPetFile(
  sourcePath: string,
  petsDirectory: string,
  maxBytes = MAX_PET_BYTES
): ImportedPetAsset {
  let size: number
  try {
    size = statSync(sourcePath).size
  } catch {
    throw new PetAssetError('UNREADABLE')
  }

  if (size > maxBytes) {
    throw new PetAssetError('TOO_LARGE')
  }

  let buffer: Buffer
  try {
    buffer = readFileSync(sourcePath)
  } catch {
    throw new PetAssetError('UNREADABLE')
  }

  return importPetBuffer(buffer, petsDirectory, maxBytes)
}

/** Maps an asset id to a file on disk, refusing anything outside the known locations. */
export function resolvePetAssetPath(options: {
  assetId: string
  petsDirectory: string
  presetsDirectory: string
  defaultAssetPath: string
}): string | null {
  if (options.assetId === 'default') {
    return existsSync(options.defaultAssetPath) ? options.defaultAssetPath : null
  }
  if (isPetPresetId(options.assetId)) {
    const fileName = PRESET_FILES[options.assetId]
    if (!fileName) {
      return null
    }
    const filePath = join(options.presetsDirectory, fileName)
    return existsSync(filePath) ? filePath : null
  }
  if (!UUID_PATTERN.test(options.assetId)) {
    return null
  }
  const filePath = join(options.petsDirectory, `${options.assetId}.png`)
  return existsSync(filePath) ? filePath : null
}

export function isUserPetImageId(value: string): boolean {
  return UUID_PATTERN.test(value)
}

/** Lists user-imported pet images in upload order (oldest first). */
export function listPetImageIds(petsDirectory: string): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(petsDirectory, { withFileTypes: true })
  } catch {
    return []
  }

  const images: Array<{ assetId: string; createdAt: number }> = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.png')) {
      continue
    }
    const assetId = entry.name.slice(0, -4)
    if (!UUID_PATTERN.test(assetId)) {
      continue
    }
    try {
      const stats = statSync(join(petsDirectory, entry.name))
      images.push({ assetId, createdAt: stats.mtimeMs })
    } catch {
      // Skip files that disappear between readdir and stat.
    }
  }

  return images
    .sort((a, b) => a.createdAt - b.createdAt || a.assetId.localeCompare(b.assetId))
    .map((image) => image.assetId)
}

/** Removes one user-imported pet image. Returns false when it does not exist. */
export function deletePetImageFile(assetId: string, petsDirectory: string): boolean {
  if (!UUID_PATTERN.test(assetId)) {
    return false
  }
  try {
    unlinkSync(join(petsDirectory, `${assetId}.png`))
    return true
  } catch {
    return false
  }
}
