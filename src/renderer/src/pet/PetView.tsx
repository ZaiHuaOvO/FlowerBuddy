import { useEffect, useRef, useState } from 'react'
import type { PetViewState } from '../../../shared/api'

const CLICK_MOVE_THRESHOLD = 5

function fire(operation: Promise<unknown> | undefined): void {
  void operation?.catch(() => {})
}

export default function PetView() {
  const api = window.petApi
  const [state, setState] = useState<PetViewState | null>(null)
  const [dragging, setDragging] = useState(false)
  const pointerSession = useRef<{ startX: number; startY: number; moved: boolean } | null>(null)
  const dragFrame = useRef<number | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!api) {
      return
    }
    let active = true

    void api
      .getState()
      .then((next) => {
        if (active) {
          setState(next)
        }
      })
      .catch(() => {})

    const unsubscribe = api.onStateChanged((next) => {
      setState(next)
    })

    return () => {
      active = false
      unsubscribe()
      if (dragFrame.current !== null) {
        cancelAnimationFrame(dragFrame.current)
        dragFrame.current = null
      }
    }
  }, [api])

  function playBounce(enabled: boolean): void {
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }
    const image = imageRef.current
    if (!image || typeof image.animate !== 'function') {
      return
    }
    const tokens = getComputedStyle(document.documentElement)
    const duration = Number.parseFloat(tokens.getPropertyValue('--motion-normal')) * 1000 || 240
    const easing = tokens.getPropertyValue('--ease-standard').trim() || 'ease-out'
    image.animate(
      [
        { transform: 'translateY(0)' },
        { transform: 'translateY(-9%)' },
        { transform: 'translateY(2%)' },
        { transform: 'translateY(0)' }
      ],
      { duration, easing }
    )
  }

  function handlePointerDown(event: React.PointerEvent<HTMLImageElement>): void {
    if (!api || event.button !== 0) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerSession.current = {
      startX: event.screenX,
      startY: event.screenY,
      moved: false
    }
    setDragging(true)
    fire(api.beginDrag())
  }

  function handlePointerMove(event: React.PointerEvent<HTMLImageElement>): void {
    const session = pointerSession.current
    if (!api || !session) {
      return
    }

    if (
      Math.abs(event.screenX - session.startX) > CLICK_MOVE_THRESHOLD ||
      Math.abs(event.screenY - session.startY) > CLICK_MOVE_THRESHOLD
    ) {
      session.moved = true
    }

    if (dragFrame.current === null) {
      dragFrame.current = requestAnimationFrame(() => {
        dragFrame.current = null
        fire(api.dragMove())
      })
    }
  }

  function finishPointer(event: React.PointerEvent<HTMLImageElement>, allowClick: boolean): void {
    const session = pointerSession.current
    if (!api || !session) {
      return
    }

    pointerSession.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (dragFrame.current !== null) {
      cancelAnimationFrame(dragFrame.current)
      dragFrame.current = null
    }

    fire(api.endDrag())

    if (allowClick && !session.moved) {
      playBounce(state?.bounceAnimation !== false)
      fire(api.openMenu())
    }
  }

  function handleContextMenu(event: React.MouseEvent): void {
    event.preventDefault()
    fire(window.petApi?.openMenu())
  }

  return (
    <div className="pet-root" onContextMenu={handleContextMenu}>
      {state ? (
        <img
          ref={imageRef}
          className={`pet-image${dragging ? ' dragging' : ''}`}
          src={state.asset.url}
          alt="FlowerBuddy 桌宠"
          draggable={false}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => finishPointer(event, true)}
          onPointerCancel={(event) => finishPointer(event, false)}
          onDragStart={(event) => event.preventDefault()}
        />
      ) : null}
    </div>
  )
}
