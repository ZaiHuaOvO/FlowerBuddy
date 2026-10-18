import { useEffect, useRef, useState } from 'react'
import type { BubbleItem, BubbleStackPayload, BubbleState } from '../../../shared/api'
import { BUBBLE_MAX_HEIGHT } from '../../../shared/bubble-layout'
import '../styles/bubble.css'

const STATE_SYMBOL: Record<Exclude<BubbleState, 'loading'>, string> = {
  idle: 'i',
  success: '✓',
  empty: '–',
  error: '!'
}

function fire(operation: Promise<unknown> | undefined): void {
  void operation?.catch(() => {})
}

export default function BubbleView() {
  const api = window.bubbleApi
  const [bubbles, setBubbles] = useState<BubbleItem[]>([])
  const listRef = useRef<HTMLDivElement | null>(null)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    if (!api) {
      return
    }
    return api.onUpdate((payload: BubbleStackPayload) => setBubbles(payload.bubbles))
  }, [api])

  useEffect(() => {
    if (!api || bubbles.length === 0) {
      return
    }
    const element = listRef.current
    if (!element) {
      return
    }
    element.scrollTop = element.scrollHeight
    const report = (): void => {
      if (frame.current !== null) {
        return
      }
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        fire(api.setHeight(Math.ceil(element.getBoundingClientRect().height)))
      })
    }
    report()
    const observer = new ResizeObserver(report)
    observer.observe(element)
    return () => {
      observer.disconnect()
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current)
        frame.current = null
      }
    }
  }, [api, bubbles])

  if (!api || bubbles.length === 0) {
    return null
  }

  function dismiss(id: string): void {
    fire(api?.dismiss(id))
  }

  return (
    <div className="bubble-root">
      <div className="bubble-list" ref={listRef} style={{ maxHeight: `${BUBBLE_MAX_HEIGHT}px` }}>
        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            className={`bubble bubble-${bubble.state}`}
            role="status"
            data-state={bubble.state}
          >
            {bubble.state === 'loading' ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              <span className={`bubble-icon bubble-icon-${bubble.state}`} aria-hidden="true">
                {STATE_SYMBOL[bubble.state]}
              </span>
            )}
            <p className="bubble-text">{bubble.message}</p>
            <span className="bubble-actions">
              {bubble.persistent ? (
                <button type="button" className="bubble-ack" onClick={() => dismiss(bubble.id)}>
                  知道了
                </button>
              ) : null}
              <button
                type="button"
                className="bubble-close"
                aria-label="关闭气泡"
                data-action="bubble:dismiss"
                onClick={() => dismiss(bubble.id)}
              >
                ×
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
