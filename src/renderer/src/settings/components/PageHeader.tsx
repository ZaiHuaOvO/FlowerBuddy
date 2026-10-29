import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

interface PageHeaderProps {
  title: string
  description?: string
  meta?: ReactNode
  actions?: ReactNode
  onBack?: (() => void) | undefined
  backLabel?: string
}

export function PageHeader({
  title,
  description,
  meta,
  actions,
  onBack,
  backLabel = '返回'
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-main">
        {onBack ? (
          <button type="button" className="page-back" onClick={onBack}>
            <ArrowLeft size={13} strokeWidth={2} aria-hidden="true" />
            <span>{backLabel}</span>
          </button>
        ) : null}
        <div className="page-header-title-row">
          <h2>{title}</h2>
          {meta}
        </div>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  )
}
