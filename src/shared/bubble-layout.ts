import type { BubbleSize } from './api'

export type StandardBubbleSize = Exclude<BubbleSize, 'super'>

export interface BubblePreset {
  width: number
  minHeight: number
  maxHeight: number
}

/** Window geometry shared by the main process and the bubble renderer. */
export const BUBBLE_PRESETS: Record<StandardBubbleSize, BubblePreset> = {
  small: { width: 240, minHeight: 52, maxHeight: 220 },
  medium: { width: 340, minHeight: 64, maxHeight: 560 },
  large: { width: 480, minHeight: 92, maxHeight: 720 }
}

export const DEFAULT_BUBBLE_SIZE: StandardBubbleSize = 'medium'

/** The super frame covers this share of the display work area, centred on top. */
export const SUPER_BUBBLE_WIDTH_RATIO = 0.6
export const SUPER_BUBBLE_HEIGHT_RATIO = 0.3
export const SUPER_BUBBLE_TOP_MARGIN = 24
export const SUPER_BUBBLE_MIN_WIDTH = 480
export const SUPER_BUBBLE_MIN_HEIGHT = 240
