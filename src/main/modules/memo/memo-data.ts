import { randomUUID } from 'node:crypto'
import type { MemoImageInfo } from '../../../shared/api'
import {
  createEmptyMemoData,
  MEMO_CARD_MAX_HEIGHT,
  MEMO_CARD_MAX_WIDTH,
  MEMO_CARD_MIN_HEIGHT,
  MEMO_CARD_MIN_WIDTH,
  MEMO_COUNT_MAX,
  MEMO_IMAGE_MAX_DIMENSION,
  MEMO_IMAGES_MAX,
  MEMO_TEXT_MAX,
  type MemoBounds,
  type MemoData,
  type StoredMemo
} from './types'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function normalizeIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

export function sanitizeMemoImages(raw: unknown): MemoImageInfo[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const seen = new Set<string>()
  const images: MemoImageInfo[] = []
  for (const entry of raw.slice(0, MEMO_IMAGES_MAX)) {
    if (!isRecord(entry) || !isUuid(entry.id) || seen.has(entry.id)) {
      continue
    }
    const width = Number(entry.width)
    const height = Number(entry.height)
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      continue
    }
    seen.add(entry.id)
    images.push({
      id: entry.id,
      width: Math.round(clampNumber(width, 1, MEMO_IMAGE_MAX_DIMENSION)),
      height: Math.round(clampNumber(height, 1, MEMO_IMAGE_MAX_DIMENSION))
    })
  }
  return images
}

export function sanitizeMemoBounds(raw: unknown): MemoBounds | null {
  if (!isRecord(raw)) {
    return null
  }
  const x = Number(raw.x)
  const y = Number(raw.y)
  const width = Number(raw.width)
  const height = Number(raw.height)
  if (![x, y, width, height].every((value) => Number.isFinite(value))) {
    return null
  }
  return {
    x: Math.round(clampNumber(x, -100000, 100000)),
    y: Math.round(clampNumber(y, -100000, 100000)),
    width: Math.round(clampNumber(width, MEMO_CARD_MIN_WIDTH, MEMO_CARD_MAX_WIDTH)),
    height: Math.round(clampNumber(height, MEMO_CARD_MIN_HEIGHT, MEMO_CARD_MAX_HEIGHT))
  }
}

function sanitizeStoredMemo(raw: unknown, usedIds: Set<string>): StoredMemo | null {
  if (!isRecord(raw)) {
    return null
  }

  const text = typeof raw.text === 'string' ? raw.text.slice(0, MEMO_TEXT_MAX) : ''
  const images = sanitizeMemoImages(raw.images)
  if (text.trim().length === 0 && images.length === 0) {
    return null
  }

  let id = isUuid(raw.id) ? raw.id : randomUUID()
  while (usedIds.has(id)) {
    id = randomUUID()
  }
  usedIds.add(id)

  const now = new Date().toISOString()
  const createdAt = normalizeIsoTimestamp(raw.createdAt) ?? now
  const updatedAt = normalizeIsoTimestamp(raw.updatedAt) ?? createdAt
  const completed = raw.completed === true
  const completedAt = completed ? (normalizeIsoTimestamp(raw.completedAt) ?? updatedAt) : null
  const reminderAt = normalizeIsoTimestamp(raw.reminderAt)
  const remindedAt = normalizeIsoTimestamp(raw.remindedAt)

  return {
    id,
    text,
    images,
    reminderAt,
    remindedAt,
    completed,
    completedAt,
    anchored: !completed && raw.anchored === true,
    bounds: sanitizeMemoBounds(raw.bounds),
    createdAt,
    updatedAt
  }
}

export function sanitizeMemoData(raw: unknown): MemoData {
  if (!isRecord(raw) || !Array.isArray(raw.memos)) {
    return createEmptyMemoData()
  }

  const usedIds = new Set<string>()
  const memos: StoredMemo[] = []
  for (const entry of raw.memos.slice(0, MEMO_COUNT_MAX)) {
    const memo = sanitizeStoredMemo(entry, usedIds)
    if (memo) {
      memos.push(memo)
    }
  }
  return { schemaVersion: 1, memos }
}
