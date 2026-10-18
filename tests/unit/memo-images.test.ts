import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoImageError, MemoImageStore } from '../../src/main/storage/memo-images'
import { MEMO_IMAGE_MAX_BYTES } from '../../src/main/modules/memo/types'

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lVn2WQAAAABJRU5ErkJggg==',
  'base64'
)

const temporaryDirectories: string[] = []

function createStore(): { store: MemoImageStore; directory: string } {
  const directory = mkdtempSync(join(tmpdir(), 'flowerbuddy-memo-images-'))
  temporaryDirectories.push(directory)
  return { store: new MemoImageStore(directory), directory }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('memo image store', () => {
  it('stores valid PNG data under a UUID name', () => {
    const { store } = createStore()
    const image = store.save(PNG_1X1)

    expect(image).toMatchObject({ width: 1, height: 1 })
    expect(image.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(store.resolvePath(image.id)).not.toBeNull()
  })

  it('rejects empty, non-PNG and oversized data', () => {
    const { store } = createStore()
    expect(() => store.save(Buffer.alloc(0))).toThrow(MemoImageError)
    expect(() => store.save(Buffer.from('not a png'))).toThrow(MemoImageError)
    expect(() => store.save(Buffer.alloc(MEMO_IMAGE_MAX_BYTES + 1))).toThrow(MemoImageError)
  })

  it('refuses traversal and non-UUID ids', () => {
    const { store } = createStore()
    expect(store.resolvePath('../secret')).toBeNull()
    expect(store.resolvePath('abc')).toBeNull()
    expect(store.resolvePath('11111111-1111-4111-8111-111111111111')).toBeNull()
  })

  it('removes files and cleans orphans', () => {
    const { store, directory } = createStore()
    const keep = store.save(PNG_1X1)
    const orphan = store.save(PNG_1X1)
    writeFileSync(join(directory, 'notes.txt'), 'ignore me', 'utf8')

    store.cleanupOrphans(new Set([keep.id]))

    expect(existsSync(join(directory, `${keep.id}.png`))).toBe(true)
    expect(existsSync(join(directory, `${orphan.id}.png`))).toBe(false)
    expect(existsSync(join(directory, 'notes.txt'))).toBe(true)

    store.remove(keep.id)
    expect(existsSync(join(directory, `${keep.id}.png`))).toBe(false)
    expect(store.resolvePath(keep.id)).toBeNull()
  })
})
