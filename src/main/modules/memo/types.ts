import type { MemoImageInfo, MemoLineTask } from '../../../shared/api'

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
  lineTasks: MemoLineTask[]
  reminderAt: string | null
  remindedAt: string | null
  completed: boolean
  completedAt: string | null
  anchored: boolean
  locked: boolean
  bounds: MemoBounds | null
  createdAt: string
  updatedAt: string
}

export interface MemoData {
  schemaVersion: 2
  memos: StoredMemo[]
}

export const MEMO_DATA_SCHEMA_VERSION = 2

export const MEMO_TEXT_MAX = 20000
export const MEMO_LINE_TASKS_MAX = 1000
export const MEMO_IMAGES_MAX = 9
export const MEMO_IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const MEMO_IMAGE_MAX_DIMENSION = 4096
export const MEMO_COUNT_MAX = 500
export const MEMO_ANCHORED_MAX = 20

export function createEmptyMemoData(): MemoData {
  return { schemaVersion: MEMO_DATA_SCHEMA_VERSION, memos: [] }
}
