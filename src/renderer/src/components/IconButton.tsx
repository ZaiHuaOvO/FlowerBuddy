import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useTooltip } from './Tooltip'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  tone?: 'default' | 'danger'
  children: ReactNode
}

export function IconButton({
  label,
  tone = 'default',
  className,
  children,
  ...rest
}: IconButtonProps) {
  const { triggerRef, handlers, layer } = useTooltip<HTMLButtonElement>(label, 'left')
  const classes = ['icon-button']
  if (tone === 'danger') {
    classes.push('icon-button-danger')
  }
  if (className) {
    classes.push(className)
  }
  return (
    <>
      <button
        {...rest}
        ref={triggerRef}
        type="button"
        className={classes.join(' ')}
        aria-label={label}
        {...handlers}
      >
        {children}
      </button>
      {layer}
    </>
  )
}
