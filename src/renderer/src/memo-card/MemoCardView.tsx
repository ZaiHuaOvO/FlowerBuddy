import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Lock, LockOpen, Plus, X } from 'lucide-react'
import type { MemoCardEdge, MemoCardState } from '../../../shared/api'
import { memoImageUrl } from '../../../shared/api'
import {
  MEMO_CARD_BODY_PADDING,
  MEMO_CARD_HEADER_HEIGHT,
  MEMO_CARD_LINE_HEIGHT
} from '../../../shared/memo-layout'
import { formatReminderDateTime } from '../../../shared/memo-reminder'
import '../styles/memo-card.css'

const RESIZE_EDGES: MemoCardEdge[] = ['nw', 'ne', 'sw', 'se']

export default function MemoCardView() {
  const api = window.memoCardApi
  const memoId = new URLSearchParams(window.location.search).get('memoId') ?? ''
  const [state, setState] = useState<MemoCardState | null>(null)
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const dragFrame = useRef<number | null>(null)
  const resizeFrame = useRef<number | null>(null)
  const resizeEdge = useRef<MemoCardEdge | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const lockButtonRef = useRef<HTMLButtonElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const saveTimer = useRef<number | null>(null)
  const lastSaved = useRef('')
  const editingRef = useRef(false)
  const finishingRef = useRef(false)
  const mouseThrough = useRef(false)
  const fitSent = useRef(false)

  editingRef.current = editing

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
        setState((current) => {
          if (!current) {
            return next
          }
          return editingRef.current ? { ...next, text: current.text } : next
        })
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
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
    }
  }, [api, memoId])

  const measureContent = useCallback((): void => {
    const content = contentRef.current
    if (!api || !content) {
      return
    }
    const height = Math.ceil(
      MEMO_CARD_HEADER_HEIGHT +
        MEMO_CARD_BODY_PADDING * 2 +
        content.getBoundingClientRect().height +
        MEMO_CARD_LINE_HEIGHT +
        2
    )
    void api.fitHeight(memoId, height).catch(() => {})
  }, [api, memoId])

  useEffect(() => {
    if (!api || !state || fitSent.current) {
      return
    }
    fitSent.current = true
    let cancelled = false
    const measure = (): void => {
      if (!cancelled) {
        measureContent()
      }
    }
    void document.fonts.ready.then(() => {
      if (!cancelled) {
        requestAnimationFrame(measure)
      }
    })
    return () => {
      cancelled = true
    }
  }, [api, memoId, measureContent, state])

  useEffect(() => {
    if (!api || !state?.locked) {
      mouseThrough.current = false
      return
    }
    mouseThrough.current = true
    const onMove = (event: MouseEvent): void => {
      const button = lockButtonRef.current
      if (!button) {
        return
      }
      const rect = button.getBoundingClientRect()
      const over =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      const next = !over
      if (mouseThrough.current === next) {
        return
      }
      mouseThrough.current = next
      void api.setIgnoreMouse(memoId, next).catch(() => {})
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [api, memoId, state?.locked])

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
    if (!api || state?.locked || event.button !== 0) {
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
    if (!api || state?.locked || event.button !== 0) {
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

  function startEditing(): void {
    if (!api || !state || state.locked || editing) {
      return
    }
    setDraft(state.text)
    lastSaved.current = state.text
    setSaveState('idle')
    finishingRef.current = false
    setEditing(true)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      measureContent()
    })
  }

  async function saveDraft(next: string): Promise<boolean> {
    if (!api) {
      return false
    }
    setSaveState('saving')
    try {
      await api.updateText(memoId, next)
      lastSaved.current = next
      setState((current) => (current ? { ...current, text: next } : current))
      setSaveState('saved')
      return true
    } catch {
      setSaveState('error')
      return false
    }
  }

  function scheduleSave(next: string): void {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current)
    }
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null
      void saveDraft(next)
    }, 700)
  }

  function handleDraftChange(value: string): void {
    setDraft(value)
    setSaveState('idle')
    scheduleSave(value)
    requestAnimationFrame(measureContent)
  }

  async function finishEditing(): Promise<void> {
    if (!editingRef.current || finishingRef.current) {
      return
    }
    finishingRef.current = true
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    if (draft !== lastSaved.current) {
      const saved = await saveDraft(draft)
      if (!saved) {
        finishingRef.current = false
        return
      }
    }
    setEditing(false)
    finishingRef.current = false
    requestAnimationFrame(measureContent)
  }

  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Escape' || ((event.metaKey || event.ctrlKey) && event.key === 'Enter')) {
      event.preventDefault()
      void finishEditing()
    }
  }

  if (!api || !memoId || !state) {
    return null
  }

  const locked = state.locked

  return (
    <div
      className={`memo-card-window${dragging ? ' is-dragging' : ''}${resizing ? ' is-resizing' : ''}${locked ? ' is-locked' : ''}`}
    >
      <div
        className="memo-card-bar"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span
          className="memo-card-reminder"
          title="双击编辑正文"
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => {
            event.stopPropagation()
            startEditing()
          }}
        >
          {state.reminderAt ? formatReminderDateTime(new Date(state.reminderAt)) : '备忘'}
        </span>
        <span className="memo-card-actions">
          <button
            type="button"
            className="memo-card-action"
            aria-label="新建备忘录"
            disabled={locked || editing}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => void api.openComposer().catch(() => {})}
          >
            <Plus size={15} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button
            ref={lockButtonRef}
            type="button"
            className={`memo-card-action${locked ? ' is-locked' : ''}`}
            aria-label={locked ? '解锁卡片' : '锁定卡片'}
            aria-pressed={locked}
            disabled={editing}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => void api.setLocked(memoId, !locked).catch(() => {})}
          >
            {locked ? (
              <LockOpen size={15} strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <Lock size={15} strokeWidth={1.8} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="memo-card-action"
            aria-label="完成"
            disabled={locked || editing}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => void api.complete(memoId).catch(() => {})}
          >
            <Check size={15} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="memo-card-action"
            aria-label="关闭卡片"
            disabled={locked || editing}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => void api.unanchor(memoId).catch(() => {})}
          >
            <X size={15} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </span>
      </div>

      <div className="memo-card-body">
        <div className="memo-card-content" ref={contentRef}>
          {editing ? (
            <div className="memo-card-editor">
              <textarea
                ref={textareaRef}
                className="memo-card-textarea"
                value={draft}
                maxLength={20000}
                rows={Math.max(3, draft.split('\n').length)}
                aria-label="编辑备忘录正文"
                onChange={(event) => handleDraftChange(event.target.value)}
                onKeyDown={handleEditorKeyDown}
                onBlur={() => void finishEditing()}
              />
              <div className={`memo-card-editor-status${saveState === 'error' ? ' is-error' : ''}`}>
                <span>
                  {saveState === 'saving'
                    ? '保存中…'
                    : saveState === 'error'
                      ? '保存失败，请重试'
                      : saveState === 'saved'
                        ? '已自动保存'
                        : '编辑中…'}
                </span>
                <button
                  type="button"
                  className="memo-card-editor-done"
                  onClick={() => void finishEditing()}
                >
                  完成
                </button>
              </div>
            </div>
          ) : state.lineTasksEnabled && state.lineTasks.length > 0 ? (
            <div className="memo-card-lines">
              {state.lineTasks.map((task) => (
                <label
                  key={task.id}
                  className={`memo-card-line${task.completed ? ' is-completed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    disabled={locked}
                    onChange={() =>
                      void api.setLineCompleted(memoId, task.id, !task.completed).catch(() => {})
                    }
                  />
                  <span>{task.text}</span>
                </label>
              ))}
            </div>
          ) : state.text ? (
            <div className="memo-card-text">{state.text}</div>
          ) : null}
          {state.images.map((image) => (
            <img
              key={image.id}
              className="memo-card-image"
              src={memoImageUrl(image.id)}
              alt="备忘录图片"
              width={image.width}
              height={image.height}
              draggable={false}
            />
          ))}
          {!editing && !state.text && state.images.length === 0 ? (
            <p className="memo-card-empty">（空备忘录）</p>
          ) : null}
        </div>
      </div>

      {locked
        ? null
        : RESIZE_EDGES.map((edge) => (
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
