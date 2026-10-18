import type { MemoCardEdge } from '../../shared/api'
import type { Rect } from './geometry'

export interface ResizeLimits {
  minWidth: number
  minHeight: number
  maxWidth: number
  maxHeight: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Custom corner resize for frameless transparent windows. */
export function computeResizedBounds(
  start: Rect,
  edge: MemoCardEdge,
  dx: number,
  dy: number,
  limits: ResizeLimits
): Rect {
  const left = edge === 'nw' || edge === 'sw'
  const top = edge === 'nw' || edge === 'ne'

  let width = start.width + (left ? -dx : dx)
  let height = start.height + (top ? -dy : dy)
  width = Math.round(clamp(width, limits.minWidth, limits.maxWidth))
  height = Math.round(clamp(height, limits.minHeight, limits.maxHeight))

  const x = left ? start.x + start.width - width : start.x
  const y = top ? start.y + start.height - height : start.y
  return { x, y, width, height }
}
