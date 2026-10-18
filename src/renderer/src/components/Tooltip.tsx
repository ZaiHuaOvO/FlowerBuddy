import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type TooltipAlign = 'center' | 'left' | 'right'

/**
 * Renders the tooltip in a body portal so settings panels and modals with
 * `overflow` cannot clip it.
 */
export function useTooltip<T extends HTMLElement>(text: string, align: TooltipAlign = 'center') {
  const triggerRef = useRef<T | null>(null)
  const layerRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  const measure = useCallback(() => {
    const trigger = triggerRef.current
    const layer = layerRef.current
    if (!trigger || !layer) {
      return
    }
    const rect = trigger.getBoundingClientRect()
    const tip = layer.getBoundingClientRect()
    const margin = 8
    const gap = 6
    let left = rect.left + rect.width / 2 - tip.width / 2
    if (align === 'left') {
      left = rect.right - tip.width
    } else if (align === 'right') {
      left = rect.left
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - tip.width - margin))
    let top = rect.top - tip.height - gap
    if (top < margin) {
      top = rect.bottom + gap
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - tip.height - margin))
    setPosition({ top, left })
  }, [align])

  useEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    measure()
    const handle = (): void => measure()
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
    }
  }, [measure, open, text])

  const handlers = {
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false)
  }

  const layer = open
    ? createPortal(
        <div
          ref={layerRef}
          className="fl-tooltip"
          role="tooltip"
          style={
            position
              ? { top: position.top, left: position.left }
              : { top: 0, left: 0, visibility: 'hidden' }
          }
        >
          {text}
        </div>,
        document.body
      )
    : null

  return { triggerRef, handlers, layer }
}
