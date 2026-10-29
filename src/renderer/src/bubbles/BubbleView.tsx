import { useEffect, useRef, useState } from 'react'
import type { BubbleItem, BubbleSize, BubbleStackPayload } from '../../../shared/api'
import { BUBBLE_PRESETS, DEFAULT_BUBBLE_SIZE } from '../../../shared/bubble-layout'
import '../styles/bubble.css'

interface MessageSegment {
  text: string
  emphasized: boolean
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function splitMessage(message: string, emphasis: string[] | undefined): MessageSegment[] {
  const keys = [...new Set((emphasis ?? []).filter((value) => value.length > 0))].sort(
    (a, b) => b.length - a.length
  )
  if (keys.length === 0) {
    return [{ text: message, emphasized: false }]
  }
  const pattern = new RegExp(`(${keys.map(escapeRegExp).join('|')})`, 'g')
  return message
    .split(pattern)
    .filter((text) => text.length > 0)
    .map((text) => ({ text, emphasized: keys.includes(text) }))
}

function BubbleMessage({ message, emphasis }: { message: string; emphasis: string[] | undefined }) {
  return (
    <p className="bubble-text">
      {splitMessage(message, emphasis).map((segment, index) =>
        segment.emphasized ? (
          <strong key={index} className="bubble-highlight">
            {segment.text}
          </strong>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </p>
  )
}

function fire(operation: Promise<unknown> | undefined): void {
  void operation?.catch(() => {})
}

export default function BubbleView() {
  const api = window.bubbleApi
  const [bubbles, setBubbles] = useState<BubbleItem[]>([])
  const [size, setSize] = useState<BubbleSize>(DEFAULT_BUBBLE_SIZE)
  const listRef = useRef<HTMLDivElement | null>(null)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    if (!api) {
      return
    }
    return api.onUpdate((payload: BubbleStackPayload) => {
      setBubbles(payload.bubbles)
      setSize(payload.size)
    })
  }, [api])

  useEffect(() => {
    // The super frame keeps its display-relative height, so content never resizes it.
    if (!api || bubbles.length === 0 || size === 'super') {
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
  }, [api, bubbles, size])

  if (!api || bubbles.length === 0) {
    return null
  }

  function dismiss(id: string): void {
    fire(api?.dismiss(id))
  }

  const isSuper = size === 'super'
  const preset = isSuper ? null : BUBBLE_PRESETS[size]

  return (
    <div className={`bubble-root${isSuper ? ' is-super' : ''}`}>
      <div
        className={`bubble-list bubble-list-${size}`}
        ref={listRef}
        style={preset ? { maxHeight: `${preset.maxHeight}px` } : undefined}
      >
        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            className={`bubble bubble-${bubble.state}${
              bubble.persistent ? ' bubble-persistent' : ''
            }`}
            role="status"
            data-state={bubble.state}
          >
            {bubble.state === 'loading' ? <span className="spinner" aria-hidden="true" /> : null}
            <BubbleMessage message={bubble.message} emphasis={bubble.emphasis} />
            <span className="bubble-actions">
              {bubble.persistent ? (
                <button type="button" className="bubble-ack" onClick={() => dismiss(bubble.id)}>
                  知道了喵
                </button>
              ) : (
                <button
                  type="button"
                  className="bubble-close"
                  aria-label="关闭气泡"
                  data-action="bubble:dismiss"
                  onClick={() => dismiss(bubble.id)}
                >
                  ×
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
