import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const MAX_PET_BYTES = 15 * 1024 * 1024
const MAX_DIMENSION = 8192
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

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
  if (width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return null
  }
  return { width, height }
}

export interface ImportedPetAsset {
  assetId: string
  info: PngInfo
  filePath: string
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

/** Maps an asset id to a file on disk, refusing anything outside the known locations. */
export function resolvePetAssetPath(options: {
  assetId: string
  petsDirectory: string
  defaultAssetPath: string
}): string | null {
  if (options.assetId === 'default') {
    return existsSync(options.defaultAssetPath) ? options.defaultAssetPath : null
  }
  if (!UUID_PATTERN.test(options.assetId)) {
    return null
  }
  const filePath = join(options.petsDirectory, `${options.assetId}.png`)
  return existsSync(filePath) ? filePath : null
}
