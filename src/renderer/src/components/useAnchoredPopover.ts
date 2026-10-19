import { useEffect, useRef, useState } from 'react'

export interface AnchoredPopoverPosition {
  top: number
  left: number
}

interface Options {
  open: boolean
  onClose: () => void
  align?: 'left' | 'right'
}

const VIEWPORT_MARGIN = 8
const TRIGGER_GAP = 6

export function useAnchoredPopover({ open, onClose, align = 'right' }: Options) {
  const [position, setPosition] = useState<AnchoredPopoverPosition | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }

    const measure = (): void => {
      const trigger = triggerRef.current
      const popover = popoverRef.current
      if (!trigger || !popover) {
        return
      }
      const rect = trigger.getBoundingClientRect()
      const size = popover.getBoundingClientRect()
      let left = align === 'right' ? rect.right - size.width : rect.left
      left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(left, window.innerWidth - size.width - VIEWPORT_MARGIN)
      )
      let top = rect.bottom + TRIGGER_GAP
      if (top + size.height > window.innerHeight - VIEWPORT_MARGIN) {
        top = Math.max(VIEWPORT_MARGIN, rect.top - size.height - TRIGGER_GAP)
      }
      setPosition({ top, left })
    }

    measure()

    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return
      }
      onCloseRef.current()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onCloseRef.current()
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [align, open])

  return { triggerRef, popoverRef, position }
}
