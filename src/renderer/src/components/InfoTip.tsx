interface InfoTipProps {
  text: string
  align?: 'center' | 'left'
}

export function InfoTip({ text, align = 'center' }: InfoTipProps) {
  return (
    <span
      className={`info-tip tooltip-trigger${align === 'left' ? ' tooltip-left' : ''}`}
      role="img"
      tabIndex={0}
      aria-label={text}
      data-tooltip={text}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 4.4v4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.4" r="0.9" fill="currentColor" />
      </svg>
    </span>
  )
}
