import { useEffect, useRef, useState } from 'react'
import type { PetViewState } from '../../../shared/api'
import '../styles/pet.css'

const CLICK_MOVE_THRESHOLD = 5
const BOUNCE_KEYFRAMES: Keyframe[] = [
  { transform: 'scale(1, 1)', offset: 0, easing: 'cubic-bezier(0.3, 0, 0.8, 0.15)' },
  { transform: 'scale(1, 0.82)', offset: 0.2, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  { transform: 'scale(1, 1)', offset: 0.45, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' },
  { transform: 'scale(1, 0.94)', offset: 0.66, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  { transform: 'scale(1, 1)', offset: 0.84, easing: 'ease-out' },
  { transform: 'scale(1, 0.985)', offset: 0.93 },
  { transform: 'scale(1, 1)', offset: 1 }
]

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
  const bounceRef = useRef<Animation | null>(null)

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
      bounceRef.current?.cancel()
      bounceRef.current = null
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
    const duration = Number.parseFloat(tokens.getPropertyValue('--motion-pet-bounce')) * 1000 || 520
    bounceRef.current?.cancel()
    bounceRef.current = image.animate(BOUNCE_KEYFRAMES, {
      duration,
      easing: 'linear',
      fill: 'none'
    })
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
    if (!session.moved || dragFrame.current !== null) {
      return
    }

    dragFrame.current = requestAnimationFrame(() => {
      dragFrame.current = null
      fire(api.dragMove())
    })
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
          alt="花伴 桌宠"
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
