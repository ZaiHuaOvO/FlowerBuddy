import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PetAssetError,
  deletePetImageFile,
  importPetBuffer,
  importPetFile,
  listPetImageIds,
  readPngInfo,
  resolvePetAssetPath
} from '../../src/main/storage/pet-assets'

const temporaryDirectories: string[] = []

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'flowerbuddy-pets-'))
  temporaryDirectories.push(directory)
  return directory
}

function pngHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0)
  buffer.writeUInt32BE(13, 8)
  buffer.write('IHDR', 12, 'ascii')
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return buffer
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('PNG validation', () => {
  it('reads dimensions from the IHDR chunk', () => {
    expect(readPngInfo(pngHeader(512, 384))).toEqual({ width: 512, height: 384 })
  })

  it('rejects files that are not PNG', () => {
    expect(readPngInfo(Buffer.from('this is not a png file at all, definitely not'))).toBeNull()
  })

  it('rejects truncated files', () => {
    expect(readPngInfo(Buffer.from([0x89, 0x50, 0x4e]))).toBeNull()
  })

  it('rejects zero and oversized dimensions', () => {
    expect(readPngInfo(pngHeader(0, 100))).toBeNull()
    expect(readPngInfo(pngHeader(100, 0))).toBeNull()
    expect(readPngInfo(pngHeader(9000, 100))).toBeNull()
  })
})

describe('pet asset import', () => {
  it('copies a valid PNG into the pets directory with a generated id', () => {
    const directory = createTemporaryDirectory()
    const sourcePath = join(directory, 'pet.png')
    writeFileSync(sourcePath, pngHeader(300, 200))

    const petsDirectory = join(directory, 'pets')
    const imported = importPetFile(sourcePath, petsDirectory)

    expect(imported.info).toEqual({ width: 300, height: 200 })
    expect(imported.assetId).toMatch(/^[0-9a-f-]{36}$/)
    expect(existsSync(imported.filePath)).toBe(true)
    expect(imported.filePath).toBe(join(petsDirectory, `${imported.assetId}.png`))
  })

  it('rejects files that exceed the size limit', () => {
    const directory = createTemporaryDirectory()
    const sourcePath = join(directory, 'pet.png')
    writeFileSync(sourcePath, pngHeader(100, 100))

    expect(() => importPetFile(sourcePath, join(directory, 'pets'), 10)).toThrow(PetAssetError)
  })

  it('rejects non-PNG content', () => {
    const directory = createTemporaryDirectory()
    const sourcePath = join(directory, 'note.txt')
    writeFileSync(sourcePath, 'hello')

    try {
      importPetFile(sourcePath, join(directory, 'pets'))
      throw new Error('expected import to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(PetAssetError)
      expect((error as PetAssetError).code).toBe('NOT_PNG')
    }
  })

  it('reports unreadable sources', () => {
    const directory = createTemporaryDirectory()

    try {
      importPetFile(join(directory, 'missing.png'), join(directory, 'pets'))
      throw new Error('expected import to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(PetAssetError)
      expect((error as PetAssetError).code).toBe('UNREADABLE')
    }
  })
})

describe('pet image buffer import', () => {
  it('stores a converted PNG buffer', () => {
    const directory = createTemporaryDirectory()
    const petsDirectory = join(directory, 'pets')

    const imported = importPetBuffer(pngHeader(320, 240), petsDirectory)
    expect(imported.info).toEqual({ width: 320, height: 240 })
    expect(existsSync(imported.filePath)).toBe(true)
  })

  it('rejects empty, oversized and non-PNG buffers', () => {
    const directory = createTemporaryDirectory()
    const petsDirectory = join(directory, 'pets')

    expect(() => importPetBuffer(Buffer.alloc(0), petsDirectory)).toThrow(PetAssetError)
    expect(() => importPetBuffer(Buffer.from('not an image'), petsDirectory)).toThrow(PetAssetError)
    expect(() => importPetBuffer(pngHeader(10, 10), petsDirectory, 5)).toThrow(PetAssetError)
  })
})

describe('pet asset paths', () => {
  it('resolves the bundled default asset', () => {
    const directory = createTemporaryDirectory()
    const defaultAssetPath = join(directory, 'default.png')
    writeFileSync(defaultAssetPath, pngHeader(10, 10))

    expect(
      resolvePetAssetPath({
        assetId: 'default',
        petsDirectory: join(directory, 'pets'),
        presetsDirectory: join(directory, 'presets'),
        defaultAssetPath
      })
    ).toBe(defaultAssetPath)
  })

  it('resolves only well-formed user asset ids that exist', () => {
    const directory = createTemporaryDirectory()
    const petsDirectory = join(directory, 'pets')
    mkdirSync(petsDirectory, { recursive: true })
    const assetId = randomUUID()
    const filePath = join(petsDirectory, `${assetId}.png`)
    writeFileSync(filePath, pngHeader(10, 10))

    expect(
      resolvePetAssetPath({
        assetId,
        petsDirectory,
        presetsDirectory: join(directory, 'presets'),
        defaultAssetPath: ''
      })
    ).toBe(filePath)
    expect(
      resolvePetAssetPath({
        assetId: randomUUID(),
        petsDirectory,
        presetsDirectory: join(directory, 'presets'),
        defaultAssetPath: ''
      })
    ).toBeNull()
  })

  it('refuses path traversal and malformed ids', () => {
    const directory = createTemporaryDirectory()
    const petsDirectory = join(directory, 'pets')

    for (const assetId of ['../secret', '..%2Fsecret', 'CON', 'x/y', '']) {
      expect(
        resolvePetAssetPath({
          assetId,
          petsDirectory,
          presetsDirectory: join(directory, 'presets'),
          defaultAssetPath: ''
        })
      ).toBeNull()
    }
  })

  it('resolves known preset ids and refuses unknown or malformed ones', () => {
    const directory = createTemporaryDirectory()
    const presetsDirectory = join(directory, 'presets')
    mkdirSync(presetsDirectory, { recursive: true })
    const filePath = join(presetsDirectory, 'flower-cat.png')
    writeFileSync(filePath, pngHeader(10, 10))

    const resolve = (assetId: string): string | null =>
      resolvePetAssetPath({
        assetId,
        petsDirectory: join(directory, 'pets'),
        presetsDirectory,
        defaultAssetPath: ''
      })

    expect(resolve('preset-flower-cat')).toBe(filePath)
    expect(resolve('preset-unknown')).toBeNull()
    expect(resolve('preset-flower-cat/../secret')).toBeNull()
  })
})

describe('user pet image listing and deletion', () => {
  it('lists UUID png files oldest first and ignores unrelated files', () => {
    const directory = createTemporaryDirectory()
    const petsDirectory = join(directory, 'pets')
    mkdirSync(petsDirectory, { recursive: true })

    const olderId = randomUUID()
    const newerId = randomUUID()
    const olderPath = join(petsDirectory, `${olderId}.png`)
    const newerPath = join(petsDirectory, `${newerId}.png`)
    writeFileSync(olderPath, pngHeader(10, 10))
    writeFileSync(newerPath, pngHeader(10, 10))
    utimesSync(olderPath, new Date(1000), new Date(1000))
    utimesSync(newerPath, new Date(2000), new Date(2000))
    writeFileSync(join(petsDirectory, 'note.txt'), 'not a pet')
    writeFileSync(join(petsDirectory, 'not-a-uuid.png'), pngHeader(10, 10))

    expect(listPetImageIds(petsDirectory)).toEqual([olderId, newerId])
    expect(listPetImageIds(join(directory, 'missing'))).toEqual([])
  })

  it('deletes only valid user image files', () => {
    const directory = createTemporaryDirectory()
    const petsDirectory = join(directory, 'pets')
    mkdirSync(petsDirectory, { recursive: true })
    const assetId = randomUUID()
    const filePath = join(petsDirectory, `${assetId}.png`)
    writeFileSync(filePath, pngHeader(10, 10))

    expect(deletePetImageFile('../secret', petsDirectory)).toBe(false)
    expect(deletePetImageFile(assetId, petsDirectory)).toBe(true)
    expect(existsSync(filePath)).toBe(false)
    expect(deletePetImageFile(assetId, petsDirectory)).toBe(false)
  })
})
