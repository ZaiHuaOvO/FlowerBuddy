import type { ReactNode } from 'react'

export function Field({
  label,
  hint,
  error,
  children
}: {
  label: string
  hint?: string
  error?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? (
        <span className="field-error">{error}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </label>
  )
}
