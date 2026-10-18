import type { MemoImageInfo } from '../../../shared/api'

export interface MemoBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface StoredMemo {
  id: string
  text: string
  images: MemoImageInfo[]
  reminderAt: string | null
  remindedAt: string | null
  completed: boolean
  completedAt: string | null
  anchored: boolean
  bounds: MemoBounds | null
  createdAt: string
  updatedAt: string
}

export interface MemoData {
  schemaVersion: 1
  memos: StoredMemo[]
}

export const MEMO_TEXT_MAX = 20000
export const MEMO_IMAGES_MAX = 9
export const MEMO_IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const MEMO_IMAGE_MAX_DIMENSION = 4096
export const MEMO_COUNT_MAX = 500
export const MEMO_ANCHORED_MAX = 20

export function createEmptyMemoData(): MemoData {
  return { schemaVersion: 1, memos: [] }
}
