import type { ReactNode } from 'react'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  ariaLabel?: string
  disabled?: boolean
  id?: string
}

export function Toggle({ checked, onChange, label, ariaLabel, disabled, id }: ToggleProps) {
  return (
    <label className="fl-switch">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="fl-switch-track" aria-hidden="true" />
      {label ? <span className="fl-switch-label">{label}</span> : null}
    </label>
  )
}
