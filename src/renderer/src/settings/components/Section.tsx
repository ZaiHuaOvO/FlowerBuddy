import type { ReactNode } from 'react'

interface SectionProps {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function Section({ title, description, actions, children, className }: SectionProps) {
  return (
    <section className={`section${className ? ` ${className}` : ''}`}>
      {title || description || actions ? (
        <header className="section-header">
          <div className="section-header-text">
            {title ? <h3>{title}</h3> : null}
            {description ? <p className="section-description">{description}</p> : null}
          </div>
          {actions ? <div className="section-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="section-body">{children}</div>
    </section>
  )
}
