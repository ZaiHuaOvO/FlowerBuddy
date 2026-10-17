/**
 * Layout and motion values shared by the main-process menu geometry and the
 * menu renderer. Keep both sides reading from here so the window bounds and
 * the painted panel cannot drift apart.
 */

export const MENU_ICON_COUNT = 4
export const MENU_ICON_SIZE = 34
export const MENU_ROW_HEIGHT = 72

export const MENU_ACTION_ITEM_HEIGHT = 34
export const MENU_ACTION_GAP = 2
export const MENU_ACTION_LIST_PADDING = 8
export const MENU_EMPTY_STATE_HEIGHT = 40

export const MENU_PANEL_MIN_WIDTH = 176
export const MENU_PANEL_MAX_WIDTH = 208
export const MENU_MAX_HEIGHT = 340

export const MENU_ENTER_DURATION_MS = 200
export const MENU_ENTER_STAGGER_MS = 45
export const MENU_ENTER_DURATION_STEP_MS = 20
export const MENU_EXIT_DURATION_MS = 130
export const MENU_EXIT_STAGGER_MS = 26
export const MENU_EXIT_FADE_MS =
  (MENU_ICON_COUNT - 1) * MENU_EXIT_STAGGER_MS + MENU_EXIT_DURATION_MS
export const MENU_EXIT_MS = MENU_EXIT_FADE_MS + 20

export const MENU_IDLE_CLOSE_MS = 800
export const MENU_IDLE_POLL_MS = 120
export const MENU_OPEN_ACK_TIMEOUT_MS = 1000
export const MENU_HOVER_COLLAPSE_MS = 180
export const MENU_LIST_EXIT_MS = 140

export function menuActionListHeight(actionCount: number): number {
  const count = Math.max(0, Math.floor(actionCount))
  if (count === 0) {
    return MENU_ACTION_LIST_PADDING * 2 + MENU_EMPTY_STATE_HEIGHT
  }
  return (
    MENU_ACTION_LIST_PADDING * 2 + count * MENU_ACTION_ITEM_HEIGHT + (count - 1) * MENU_ACTION_GAP
  )
}

export function menuContentHeight(expanded: boolean, actionCount: number): number {
  return MENU_ROW_HEIGHT + (expanded ? menuActionListHeight(actionCount) : 0)
}

export function menuWindowHeight(expanded: boolean, actionCount: number): number {
  return menuContentHeight(expanded, actionCount)
}

export function menuWindowWidth(anchorWidth: number): number {
  return Math.min(MENU_PANEL_MAX_WIDTH, Math.max(MENU_PANEL_MIN_WIDTH, Math.round(anchorWidth)))
}
