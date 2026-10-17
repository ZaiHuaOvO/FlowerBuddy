import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { EyeOff, Power, Settings, Sparkles } from 'lucide-react'
import type { MenuActionSummary, MenuPresentation } from '../../../shared/api'
import {
  MENU_ACTION_GAP,
  MENU_ACTION_ITEM_HEIGHT,
  MENU_ACTION_LIST_PADDING,
  MENU_EMPTY_STATE_HEIGHT,
  MENU_ENTER_DURATION_MS,
  MENU_ENTER_DURATION_STEP_MS,
  MENU_ENTER_STAGGER_MS,
  MENU_EXIT_DURATION_MS,
  MENU_EXIT_FADE_MS,
  MENU_EXIT_STAGGER_MS,
  MENU_HOVER_COLLAPSE_MS,
  MENU_ICON_COUNT,
  MENU_ICON_SIZE,
  MENU_LIST_EXIT_MS,
  MENU_ROW_HEIGHT
} from '../../../shared/menu-layout'
import '../styles/menu.css'

const LAYOUT_STYLE = {
  '--menu-icon-size': `${MENU_ICON_SIZE}px`,
  '--menu-row-height': `${MENU_ROW_HEIGHT}px`,
  '--menu-item-height': `${MENU_ACTION_ITEM_HEIGHT}px`,
  '--menu-item-gap': `${MENU_ACTION_GAP}px`,
  '--menu-list-padding': `${MENU_ACTION_LIST_PADDING}px`,
  '--menu-empty-height': `${MENU_EMPTY_STATE_HEIGHT}px`,
  '--menu-enter-duration': `${MENU_ENTER_DURATION_MS}ms`,
  '--menu-enter-step': `${MENU_ENTER_DURATION_STEP_MS}ms`,
  '--menu-enter-stagger': `${MENU_ENTER_STAGGER_MS}ms`,
  '--menu-exit-duration': `${MENU_EXIT_DURATION_MS}ms`,
  '--menu-exit-stagger': `${MENU_EXIT_STAGGER_MS}ms`,
  '--menu-exit-fade': `${MENU_EXIT_FADE_MS}ms`
} as unknown as CSSProperties

function fire(operation: Promise<unknown> | undefined): void {
  void operation?.catch(() => {})
}

export default function QuickMenu() {
  const api = window.menuApi
  const [actions, setActions] = useState<MenuActionSummary[]>([])
  const [presentation, setPresentation] = useState<MenuPresentation>({
    phase: 'close',
    placement: 'above',
    token: 0,
    instant: false
  })
  const [expanded, setExpanded] = useState(false)
  const [listClosing, setListClosing] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)
  const [labelsArmed, setLabelsArmed] = useState(false)
  const [selectedAction, setSelectedAction] = useState<'settings' | null>(null)
  const lastToken = useRef(0)
  const ackedToken = useRef(0)
  const listTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

  const clearListTimer = useCallback(() => {
    if (listTimer.current !== null) {
      clearTimeout(listTimer.current)
      listTimer.current = null
    }
  }, [])

  const clearHoverTimer = useCallback(() => {
    if (hoverTimer.current !== null) {
      clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
  }, [])

  const resetInteraction = useCallback(() => {
    clearListTimer()
    clearHoverTimer()
    setListClosing(false)
    setExpanded(false)
    setLabelsArmed(false)
    setSelectedAction(null)
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }, [clearHoverTimer, clearListTimer])

  const applyPresentation = useCallback(
    (next: MenuPresentation) => {
      setPresentation((current) => {
        if (
          current.token === next.token &&
          current.phase === next.phase &&
          current.placement === next.placement &&
          current.instant === next.instant
        ) {
          return current
        }
        return next
      })
      if (next.phase === 'open') {
        // The panel stays mounted between openings; switching the root from
        // the closing state back to open restarts the entry animation, so
        // every open plays it without remounting or reloading the content.
        setHasOpened(true)
        if (next.token !== lastToken.current) {
          lastToken.current = next.token
          resetInteraction()
        }
        return
      }
      // Close only drives the CSS exit animation; the panel stays mounted.
      setListClosing(false)
    },
    [resetInteraction]
  )

  const loadActions = useCallback(() => {
    if (!api) {
      return
    }
    void api
      .getActions()
      .then(setActions)
      .catch(() => {})
  }, [api])

  useEffect(() => {
    if (!api) {
      return
    }
    let active = true

    void api
      .ready()
      .then((next) => {
        if (active) {
          applyPresentation(next)
        }
      })
      .catch(() => {})

    const unsubscribe = api.onPresentation((next) => {
      applyPresentation(next)
    })
    window.addEventListener('focus', loadActions)
    loadActions()

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        fire(api.close())
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      active = false
      unsubscribe()
      clearListTimer()
      clearHoverTimer()
      window.removeEventListener('focus', loadActions)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [api, applyPresentation, loadActions, clearListTimer, clearHoverTimer])

  useEffect(() => {
    if (!api || presentation.phase !== 'open' || !hasOpened) {
      return
    }
    if (presentation.token === ackedToken.current) {
      return
    }
    // The main process waits for this before enabling menu input, so the
    // first interactive frame is always the freshly mounted panel.
    ackedToken.current = presentation.token
    void api.opened().catch(() => {})
  }, [api, presentation.phase, presentation.token, hasOpened])

  function openActions(): void {
    setLabelsArmed(true)
    setSelectedAction(null)
    clearHoverTimer()
    clearListTimer()
    setListClosing(false)
    setExpanded(true)
  }

  function openSettings(): void {
    setSelectedAction('settings')
    setLabelsArmed(true)
    if (api) {
      fire(api.openSettings())
    }
  }

  function collapseActions(): void {
    if (!expanded || listClosing) {
      return
    }
    setListClosing(true)
    listTimer.current = setTimeout(() => {
      listTimer.current = null
      setExpanded(false)
      setListClosing(false)
    }, MENU_LIST_EXIT_MS)
  }

  function scheduleActionsCollapse(): void {
    clearHoverTimer()
    hoverTimer.current = setTimeout(() => {
      hoverTimer.current = null
      collapseActions()
    }, MENU_HOVER_COLLAPSE_MS)
  }

  function handleToolbarKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return
    }
    event.preventDefault()
    const count = MENU_ICON_COUNT
    let index = buttonRefs.current.findIndex((button) => button === document.activeElement)
    if (index === -1) {
      index = 0
    }
    if (event.key === 'ArrowLeft') {
      index = (index + count - 1) % count
    } else if (event.key === 'ArrowRight') {
      index = (index + 1) % count
    } else if (event.key === 'Home') {
      index = 0
    } else {
      index = count - 1
    }
    buttonRefs.current[index]?.focus()
  }

  if (!api) {
    return null
  }

  const closing = presentation.phase === 'close'

  return (
    <div
      className={`menu-root${closing ? ' is-closing' : ''}${closing && presentation.instant ? ' instant-close' : ''}${labelsArmed ? ' labels-armed' : ''}`}
      data-placement={presentation.placement}
      style={LAYOUT_STYLE}
      onPointerEnter={() => {
        clearHoverTimer()
        setLabelsArmed(true)
      }}
      onPointerMove={() => {
        setLabelsArmed(true)
        clearHoverTimer()
      }}
      onPointerLeave={scheduleActionsCollapse}
      onKeyDown={() => setLabelsArmed(true)}
    >
      {hasOpened ? (
        <div className="menu-panel">
          {expanded ? (
            <>
              <div
                className={`menu-actions${listClosing ? ' is-closing' : ''}`}
                aria-label="快捷功能"
              >
                {actions.length === 0 ? (
                  <p className="menu-empty">暂无可用的快捷功能</p>
                ) : (
                  actions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className="menu-action"
                      data-action={action.id}
                      onClick={() => fire(api.runAction(action.id))}
                    >
                      {action.label}
                    </button>
                  ))
                )}
              </div>
            </>
          ) : null}
          <div className="menu-bar">
            <div
              className="menu-icon-row"
              role="toolbar"
              aria-label="桌宠快捷操作"
              onKeyDown={handleToolbarKeyDown}
            >
              <button
                ref={(node) => {
                  buttonRefs.current[0] = node
                }}
                type="button"
                className="menu-icon-button"
                aria-label="查看全部功能"
                aria-expanded={expanded}
                onPointerEnter={openActions}
                onFocus={(event) => {
                  if (event.currentTarget.matches(':focus-visible')) {
                    openActions()
                  }
                }}
                onClick={openActions}
              >
                <Sparkles size={18} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <button
                ref={(node) => {
                  buttonRefs.current[1] = node
                }}
                type="button"
                className={`menu-icon-button${selectedAction === 'settings' ? ' is-selected' : ''}`}
                aria-label="打开设置"
                onClick={openSettings}
              >
                <Settings size={18} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <button
                ref={(node) => {
                  buttonRefs.current[2] = node
                }}
                type="button"
                className="menu-icon-button"
                aria-label="隐藏桌宠"
                onClick={() => fire(api.hidePet())}
              >
                <EyeOff size={18} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <button
                ref={(node) => {
                  buttonRefs.current[3] = node
                }}
                type="button"
                className="menu-icon-button menu-icon-danger"
                aria-label="退出 花伴"
                onClick={() => fire(api.quit())}
              >
                <Power size={18} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
            <p className="menu-caption" aria-hidden="true">
              <span className="menu-caption-label">功能</span>
              <span className="menu-caption-label">设置</span>
              <span className="menu-caption-label">隐藏桌宠</span>
              <span className="menu-caption-label">退出 花伴</span>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
