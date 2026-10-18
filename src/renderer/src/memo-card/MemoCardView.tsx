import { useEffect, useRef, useState } from 'react'
import type { MemoCardEdge, MemoCardState } from '../../../shared/api'
import { memoImageUrl } from '../../../shared/api'
import { formatReminderDateTime } from '../../../shared/memo-reminder'
import '../styles/memo-card.css'

const RESIZE_EDGES: MemoCardEdge[] = ['nw', 'ne', 'sw', 'se']

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="m5.2 8.2 1.9 1.9 3.7-3.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function UnpinIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M9.4 1.8 14.2 6.6l-1.7.5-2.4 2.4-.3 2.1-1.1 1.1-5.4-5.4 1.1-1.1 2.1-.3L8.9 3.5zM4.7 11.3 2 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2.4 2.4 5.6 5.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export default function MemoCardView() {
  const api = window.memoCardApi
  const memoId = new URLSearchParams(window.location.search).get('memoId') ?? ''
  const [state, setState] = useState<MemoCardState | null>(null)
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const dragFrame = useRef<number | null>(null)
  const resizeFrame = useRef<number | null>(null)
  const resizeEdge = useRef<MemoCardEdge | null>(null)

  useEffect(() => {
    if (!api || !memoId) {
      return
    }
    let active = true
    void api
      .getState(memoId)
      .then((next) => {
        if (active) {
          setState(next)
        }
      })
      .catch(() => {})
    const unsubscribe = api.onStateChanged((next) => {
      if (next.id === memoId) {
        setState(next)
      }
    })
    return () => {
      active = false
      unsubscribe()
      if (dragFrame.current !== null) {
        cancelAnimationFrame(dragFrame.current)
        dragFrame.current = null
      }
      if (resizeFrame.current !== null) {
        cancelAnimationFrame(resizeFrame.current)
        resizeFrame.current = null
      }
    }
  }, [api, memoId])

  function scheduleDrag(): void {
    if (dragFrame.current !== null) {
      return
    }
    dragFrame.current = requestAnimationFrame(() => {
      dragFrame.current = null
      void api?.dragMove(memoId).catch(() => {})
    })
  }

  function scheduleResize(): void {
    if (resizeFrame.current !== null) {
      return
    }
    resizeFrame.current = requestAnimationFrame(() => {
      resizeFrame.current = null
      void api?.resizeMove(memoId).catch(() => {})
    })
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>): void {
    if (!api || event.button !== 0) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    void api.beginDrag(memoId).catch(() => {})
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>): void {
    if (!dragging || !event.currentTarget.hasPointerCapture(event.pointerId)) {
      return
    }
    scheduleDrag()
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>): void {
    if (!dragging) {
      return
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (dragFrame.current !== null) {
      cancelAnimationFrame(dragFrame.current)
      dragFrame.current = null
    }
    setDragging(false)
    void api?.endDrag(memoId).catch(() => {})
  }

  function startResize(event: React.PointerEvent<HTMLDivElement>, edge: MemoCardEdge): void {
    if (!api || event.button !== 0) {
      return
    }
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeEdge.current = edge
    setResizing(true)
    void api.beginResize(memoId, edge).catch(() => {})
  }

  function moveResize(): void {
    if (!resizing || !resizeEdge.current) {
      return
    }
    scheduleResize()
  }

  function endResize(event: React.PointerEvent<HTMLDivElement>): void {
    if (!resizing) {
      return
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (resizeFrame.current !== null) {
      cancelAnimationFrame(resizeFrame.current)
      resizeFrame.current = null
    }
    resizeEdge.current = null
    setResizing(false)
    void api?.endResize(memoId).catch(() => {})
  }

  if (!api || !memoId || !state) {
    return null
  }

  return (
    <div
      className={`memo-card-window${dragging ? ' is-dragging' : ''}${resizing ? ' is-resizing' : ''}`}
    >
      <div
        className="memo-card-bar"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="memo-card-reminder">
          {state.reminderAt ? formatReminderDateTime(new Date(state.reminderAt)) : '备忘'}
        </span>
        <span className="memo-card-actions">
          <button
            type="button"
            className="memo-card-action"
            aria-label="完成"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => void api.complete(memoId).catch(() => {})}
          >
            <CheckIcon />
          </button>
          <button
            type="button"
            className="memo-card-action"
            aria-label="取消锚点"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => void api.unanchor(memoId).catch(() => {})}
          >
            <UnpinIcon />
          </button>
        </span>
      </div>

      <div className="memo-card-body">
        {state.text ? <div className="memo-card-text">{state.text}</div> : null}
        {state.images.map((image) => (
          <img
            key={image.id}
            className="memo-card-image"
            src={memoImageUrl(image.id)}
            alt="备忘录图片"
            draggable={false}
          />
        ))}
        {!state.text && state.images.length === 0 ? (
          <p className="memo-card-empty">（空备忘录）</p>
        ) : null}
      </div>

      {RESIZE_EDGES.map((edge) => (
        <div
          key={edge}
          className={`memo-resize-handle memo-resize-${edge}`}
          onPointerDown={(event) => startResize(event, edge)}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
        />
      ))}
    </div>
  )
}
