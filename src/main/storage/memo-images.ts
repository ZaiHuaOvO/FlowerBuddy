import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { MemoImageInfo } from '../../shared/api'
import { MEMO_IMAGE_MAX_BYTES, MEMO_IMAGE_MAX_DIMENSION } from '../modules/memo/types'
import { readPngInfo } from './pet-assets'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export type MemoImageErrorCode = 'NOT_PNG' | 'TOO_LARGE' | 'UNREADABLE'

export class MemoImageError extends Error {
  constructor(readonly code: MemoImageErrorCode) {
    super(code)
    this.name = 'MemoImageError'
  }
}

/** Stores pasted images as normalized PNG files under a fixed directory. */
export class MemoImageStore {
  constructor(private readonly directory: string) {}

  save(data: Buffer): MemoImageInfo {
    if (data.length === 0) {
      throw new MemoImageError('UNREADABLE')
    }
    if (data.length > MEMO_IMAGE_MAX_BYTES) {
      throw new MemoImageError('TOO_LARGE')
    }
    const info = readPngInfo(data)
    if (!info || info.width > MEMO_IMAGE_MAX_DIMENSION || info.height > MEMO_IMAGE_MAX_DIMENSION) {
      throw new MemoImageError('NOT_PNG')
    }

    mkdirSync(this.directory, { recursive: true })
    const id = randomUUID()
    const filePath = join(this.directory, `${id}.png`)
    const temporaryPath = `${filePath}.tmp`
    writeFileSync(temporaryPath, data)
    renameSync(temporaryPath, filePath)
    return { id, width: info.width, height: info.height }
  }

  remove(id: string): void {
    if (!UUID_PATTERN.test(id)) {
      return
    }
    try {
      rmSync(join(this.directory, `${id}.png`), { force: true })
    } catch {
      // Best effort: a missing file must not block memo deletion.
    }
  }

  resolvePath(id: string): string | null {
    if (!UUID_PATTERN.test(id)) {
      return null
    }
    const filePath = join(this.directory, `${id}.png`)
    return existsSync(filePath) ? filePath : null
  }

  /** Deletes files no memo references anymore, e.g. abandoned drafts. */
  cleanupOrphans(referenced: Set<string>): void {
    if (!existsSync(this.directory)) {
      return
    }
    let entries: string[]
    try {
      entries = readdirSync(this.directory)
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.endsWith('.png')) {
        continue
      }
      const id = entry.slice(0, -4)
      if (!UUID_PATTERN.test(id) || referenced.has(id)) {
        continue
      }
      try {
        rmSync(join(this.directory, entry), { force: true })
      } catch {
        // Best effort.
      }
    }
  }
}
