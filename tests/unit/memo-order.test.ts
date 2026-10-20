import { describe, expect, it } from 'vitest'
import type { MemoSummary } from '../../src/shared/api'
import { mergeMemoOrder } from '../../src/renderer/src/settings/utils/memo-order'

function memo(id: string, completed = false): MemoSummary {
  return {
    id,
    text: id,
    images: [],
    reminderAt: null,
    completed,
    completedAt: completed ? '2026-10-18T00:00:00.000Z' : null,
    anchored: false,
    locked: false,
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z'
  }
}

describe('mergeMemoOrder', () => {
  it('updates memo data without moving existing rows', () => {
    const current = [memo('a'), memo('b'), memo('c')]
    const next = [memo('c', true), memo('a'), memo('b')]

    expect(mergeMemoOrder(current, next).map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(mergeMemoOrder(current, next)[2]?.completed).toBe(true)
  })

  it('drops deleted rows and appends newly discovered ones', () => {
    const current = [memo('a'), memo('b')]
    const next = [memo('b'), memo('c')]

    expect(mergeMemoOrder(current, next).map((item) => item.id)).toEqual(['b', 'c'])
  })
})
