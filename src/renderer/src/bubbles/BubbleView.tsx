import { useEffect, useState } from 'react'
import type { BubblePayload, BubbleState } from '../../../shared/api'
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
  const [payload, setPayload] = useState<BubblePayload | null>(null)

  useEffect(() => {
    if (!api) {
      return
    }
    return api.onUpdate((next) => setPayload(next))
  }, [api])

  if (!payload) {
    return null
  }

  return (
    <div className="bubble-root">
      <div className={`bubble bubble-${payload.state}`} role="status" data-state={payload.state}>
        {payload.state === 'loading' ? (
          <span className="spinner" aria-hidden="true" />
        ) : (
          <span className={`bubble-icon bubble-icon-${payload.state}`} aria-hidden="true">
            {STATE_SYMBOL[payload.state]}
          </span>
        )}
        <p className="bubble-text">{payload.message}</p>
        <button
          type="button"
          className="bubble-close"
          aria-label="关闭气泡"
          data-action="bubble:dismiss"
          onClick={() => fire(api?.dismiss())}
        >
          ×
        </button>
      </div>
    </div>
  )
}
