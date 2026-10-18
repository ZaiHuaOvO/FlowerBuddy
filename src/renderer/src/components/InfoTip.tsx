import { useTooltip } from './Tooltip'
import type { TooltipAlign } from './Tooltip'

interface InfoTipProps {
  text: string
  /** Which side the tooltip opens toward; use 'right' near the left edge of a clipped container. */
  align?: TooltipAlign
}

export function InfoTip({ text, align = 'center' }: InfoTipProps) {
  const { triggerRef, handlers, layer } = useTooltip<HTMLSpanElement>(text, align)

  return (
    <>
      <span
        ref={triggerRef}
        className="info-tip"
        role="img"
        tabIndex={0}
        aria-label={text}
        {...handlers}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 4.4v4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="11.4" r="0.9" fill="currentColor" />
        </svg>
      </span>
      {layer}
    </>
  )
}
