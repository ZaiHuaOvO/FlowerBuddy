import {
  MENU_MAX_HEIGHT,
  MENU_ROW_HEIGHT,
  menuWindowHeight,
  menuWindowWidth
} from '../../shared/menu-layout'

export interface Size {
  width: number
  height: number
}

export interface Position {
  x: number
  y: number
}

export interface Rect extends Position, Size {}

export const PET_BASE_HEIGHT = 160
export const PET_MIN_WIDTH = 40
export const PET_MAX_WIDTH = 700
export const PET_MIN_HEIGHT = 60
export const PET_MAX_HEIGHT = 600
export const DEFAULT_MARGIN = 24
export const OVERLAY_GAP = 8

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Window size for a pet image. Aspect ratio is preserved; only when the result
 * would exceed the configured bounds is the height recomputed.
 */
export function computePetWindowSize(imageWidth: number, imageHeight: number, scale: number): Size {
  const safeWidth = imageWidth > 0 ? imageWidth : 1
  const safeHeight = imageHeight > 0 ? imageHeight : 1
  const safeScale = Number.isFinite(scale) ? clampNumber(scale, 0.5, 2) : 1
  const aspect = safeWidth / safeHeight

  let height = Math.round(PET_BASE_HEIGHT * safeScale)
  height = clampNumber(height, PET_MIN_HEIGHT, PET_MAX_HEIGHT)
  let width = Math.round(height * aspect)

  if (width > PET_MAX_WIDTH) {
    width = PET_MAX_WIDTH
    height = Math.max(1, Math.round(width / aspect))
  } else if (width < PET_MIN_WIDTH) {
    width = PET_MIN_WIDTH
    height = Math.max(1, Math.round(width / aspect))
  }

  if (height > PET_MAX_HEIGHT) {
    height = PET_MAX_HEIGHT
    width = Math.max(1, Math.round(height * aspect))
  }

  return { width: Math.max(1, width), height: Math.max(1, height) }
}

function intersectionSize(bounds: Rect, area: Rect): Size {
  return {
    width: Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x),
    height: Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y)
  }
}

/** Keeps a window on a monitor, moving it into the nearest work area when needed. */
export function clampToVisibleArea(bounds: Rect, workAreas: Rect[], minVisible = 40): Position {
  if (workAreas.length === 0) {
    return { x: bounds.x, y: bounds.y }
  }

  for (const area of workAreas) {
    const overlap = intersectionSize(bounds, area)
    if (overlap.width >= minVisible && overlap.height >= minVisible) {
      return { x: bounds.x, y: bounds.y }
    }
  }

  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  let nearest = workAreas[0] as Rect
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const area of workAreas) {
    const dx = Math.max(area.x - centerX, 0, centerX - (area.x + area.width))
    const dy = Math.max(area.y - centerY, 0, centerY - (area.y + area.height))
    const distance = dx * dx + dy * dy
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = area
    }
  }

  const x = clampNumber(bounds.x, nearest.x, nearest.x + nearest.width - bounds.width)
  const y = clampNumber(bounds.y, nearest.y, nearest.y + nearest.height - bounds.height)

  return { x: Math.round(x), y: Math.round(y) }
}

export function defaultPetPosition(workArea: Rect, size: Size, margin = DEFAULT_MARGIN): Position {
  return {
    x: Math.round(workArea.x + workArea.width - size.width - margin),
    y: Math.round(workArea.y + workArea.height - size.height - margin)
  }
}

/** Resizes a window while keeping its bottom-centre fixed, so the pet appears anchored. */
export function resizeKeepingBottomCenter(bounds: Rect, size: Size): Position {
  return {
    x: Math.round(bounds.x + (bounds.width - size.width) / 2),
    y: Math.round(bounds.y + bounds.height - size.height)
  }
}

export type OverlayPlacement = 'above' | 'left' | 'right'

/** Positions an overlay next to an anchor, flipping and clamping to stay on screen. */
export function placeOverlay(
  anchor: Rect,
  overlay: Size,
  workArea: Rect,
  preferred: OverlayPlacement
): Position {
  let x = anchor.x + (anchor.width - overlay.width) / 2
  let y = anchor.y + (anchor.height - overlay.height) / 2

  if (preferred === 'above') {
    y = anchor.y - overlay.height - OVERLAY_GAP
    if (y < workArea.y) {
      y = anchor.y + anchor.height + OVERLAY_GAP
    }
  } else if (preferred === 'left') {
    x = anchor.x - overlay.width - OVERLAY_GAP
    if (x < workArea.x) {
      x = anchor.x + anchor.width + OVERLAY_GAP
    }
  } else {
    x = anchor.x + anchor.width + OVERLAY_GAP
    if (x + overlay.width > workArea.x + workArea.width) {
      x = anchor.x - overlay.width - OVERLAY_GAP
    }
  }

  return {
    x: Math.round(clampNumber(x, workArea.x, workArea.x + workArea.width - overlay.width)),
    y: Math.round(clampNumber(y, workArea.y, workArea.y + workArea.height - overlay.height))
  }
}

export type MenuPlacement = 'above' | 'below'

export interface MenuLayout extends Rect {
  placement: MenuPlacement
}

export interface MenuLayoutInput {
  expanded: boolean
  actionCount: number
}

/**
 * Menu window bounds next to the pet. The menu sits above the pet whenever the
 * icon row fits there, otherwise below; expanding never flips the side, it only
 * grows away from the pet up to the space available on that side.
 */
export function computeMenuLayout(
  anchor: Rect,
  workArea: Rect,
  input: MenuLayoutInput
): MenuLayout {
  const width = menuWindowWidth(anchor.width)
  const minimumHeight = MENU_ROW_HEIGHT
  const wantedHeight = menuWindowHeight(input.expanded, input.actionCount)

  const availableAbove = anchor.y - OVERLAY_GAP - workArea.y
  const availableBelow = workArea.y + workArea.height - (anchor.y + anchor.height) - OVERLAY_GAP

  let placement: MenuPlacement
  if (availableAbove >= minimumHeight) {
    placement = 'above'
  } else if (availableBelow >= minimumHeight) {
    placement = 'below'
  } else {
    placement = availableAbove >= availableBelow ? 'above' : 'below'
  }

  const sideSpace = Math.max(0, placement === 'above' ? availableAbove : availableBelow)
  const height = Math.max(minimumHeight, Math.min(wantedHeight, sideSpace, MENU_MAX_HEIGHT))

  const x = anchor.x + (anchor.width - width) / 2
  const y =
    placement === 'above' ? anchor.y - OVERLAY_GAP - height : anchor.y + anchor.height + OVERLAY_GAP

  return {
    x: Math.round(clampNumber(x, workArea.x, workArea.x + workArea.width - width)),
    y: Math.round(clampNumber(y, workArea.y, workArea.y + workArea.height - height)),
    width,
    height,
    placement
  }
}
