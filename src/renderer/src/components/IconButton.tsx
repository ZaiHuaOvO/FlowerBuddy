import type { ButtonHTMLAttributes, ReactNode } from 'react'

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
  const classes = ['icon-button', 'tooltip-trigger', 'tooltip-left']
  if (tone === 'danger') {
    classes.push('icon-button-danger')
  }
  if (className) {
    classes.push(className)
  }
  return (
    <button
      {...rest}
      type="button"
      className={classes.join(' ')}
      aria-label={label}
      data-tooltip={label}
    >
      {children}
    </button>
  )
}
