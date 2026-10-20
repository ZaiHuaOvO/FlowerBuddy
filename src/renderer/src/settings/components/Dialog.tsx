import { useEffect, useId, useRef } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { IconButton } from '../../components/IconButton'

interface DialogProps {
  title: string
  onClose: () => void
  children: ReactNode
  footerLeft?: ReactNode
  footerRight?: ReactNode
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void
  wide?: boolean
  closeDisabled?: boolean
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

export function Dialog({
  title,
  onClose,
  children,
  footerLeft,
  footerRight,
  onSubmit,
  wide = false,
  closeDisabled = false
}: DialogProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const node = dialogRef.current
    const focusables = (): HTMLElement[] => {
      if (!node) {
        return []
      }
      return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null
      )
    }
    const preferred = node?.querySelector<HTMLElement>('[data-autofocus]')
    const initial = preferred ?? focusables()[0]
    initial?.focus()

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') {
        return
      }
      const items = focusables()
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) {
        return
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      previous?.focus()
    }
  }, [])

  const footer = (
    <footer className="dialog-footer">
      <div className="dialog-footer-left">{footerLeft}</div>
      <div className="dialog-footer-right">{footerRight}</div>
    </footer>
  )

  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        className={`dialog${wide ? ' is-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="dialog-header">
          <h3 id={titleId}>{title}</h3>
          <IconButton label="关闭" onClick={onClose} disabled={closeDisabled}>
            <X size={16} aria-hidden="true" />
          </IconButton>
        </header>
        {onSubmit ? (
          <form className="dialog-form" onSubmit={onSubmit}>
            <div className="dialog-body">{children}</div>
            {footer}
          </form>
        ) : (
          <>
            <div className="dialog-body">{children}</div>
            {footerLeft || footerRight ? footer : null}
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
