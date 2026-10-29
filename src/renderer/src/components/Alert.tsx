import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, X, TriangleAlert } from 'lucide-react'

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

const ICONS = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert
} as const

interface AlertProps {
  tone?: AlertTone
  title?: string
  children: ReactNode
  className?: string
  onClose?: () => void
}

export function Alert({ tone = 'info', title, children, className, onClose }: AlertProps) {
  const Icon = ICONS[tone]
  return (
    <div
      className={`app-alert app-alert-${tone}${className ? ` ${className}` : ''}`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <Icon className="app-alert-icon" size={16} strokeWidth={1.8} aria-hidden="true" />
      <div className="app-alert-content">
        {title ? <p className="app-alert-title">{title}</p> : null}
        <div className="app-alert-message">{children}</div>
      </div>
      {onClose ? (
        <button type="button" className="app-alert-close" aria-label="关闭提示" onClick={onClose}>
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
