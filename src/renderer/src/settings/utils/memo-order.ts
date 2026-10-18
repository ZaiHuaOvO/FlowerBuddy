import type { MemoSummary } from '../../../../shared/api'

/** Updates memo data in place without re-sorting the visible list. */
export function mergeMemoOrder(current: MemoSummary[], next: MemoSummary[]): MemoSummary[] {
  const remaining = new Map(next.map((memo) => [memo.id, memo]))
  const merged: MemoSummary[] = []
  for (const memo of current) {
    const updated = remaining.get(memo.id)
    if (updated) {
      merged.push(updated)
      remaining.delete(memo.id)
    }
  }
  for (const memo of remaining.values()) {
    merged.push(memo)
  }
  return merged
}
