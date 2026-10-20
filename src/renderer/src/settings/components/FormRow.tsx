import type { ReactNode } from 'react'

interface FormRowProps {
  label: ReactNode
  hint?: ReactNode
  htmlFor?: string
  children: ReactNode
  className?: string
}

export function FormRow({ label, hint, htmlFor, children, className }: FormRowProps) {
  return (
    <div className={`form-row${className ? ` ${className}` : ''}`}>
      <div className="form-row-text">
        {htmlFor ? (
          <label className="form-row-label" htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <span className="form-row-label">{label}</span>
        )}
        {hint ? <span className="form-row-hint">{hint}</span> : null}
      </div>
      <div className="form-row-control">{children}</div>
    </div>
  )
}
