import { useEffect, useRef, useState } from 'react'

interface ShortcutInputProps {
  value: string
  onSave: (accelerator: string) => void
}

const KEY_NAMES: Record<string, string> = {
  ' ': 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Enter: 'Enter',
  Escape: 'Escape'
}

function displayAccelerator(value: string): string {
  return value ? value.split('+').join(' + ') : '未设置'
}

function toAccelerator(event: KeyboardEvent): string | null {
  const parts: string[] = []
  if (event.ctrlKey) {
    parts.push('Ctrl')
  }
  if (event.altKey) {
    parts.push('Alt')
  }
  if (event.shiftKey) {
    parts.push('Shift')
  }
  if (event.metaKey) {
    parts.push('Meta')
  }

  const key = event.key
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    return null
  }

  let name: string | null = null
  if (/^[a-zA-Z0-9]$/.test(key)) {
    name = key.toUpperCase()
  } else if (/^F([1-9]|1[0-2])$/.test(key)) {
    name = key
  } else if (KEY_NAMES[key]) {
    name = KEY_NAMES[key] as string
  }
  if (!name || parts.length === 0) {
    return null
  }
  parts.push(name)
  return parts.join('+')
}

export function ShortcutInput({ value, onSave }: ShortcutInputProps) {
  const [recording, setRecording] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!recording) {
      return
    }
    function handleKeyDown(event: KeyboardEvent): void {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setRecording(false)
        return
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        setRecording(false)
        onSave('')
        return
      }
      const accelerator = toAccelerator(event)
      if (!accelerator) {
        return
      }
      setRecording(false)
      onSave(accelerator)
    }

    function handlePointerDown(event: PointerEvent): void {
      if (!buttonRef.current?.contains(event.target as Node)) {
        setRecording(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [onSave, recording])

  return (
    <div className="shortcut-field">
      <button
        ref={buttonRef}
        type="button"
        className={`shortcut-value${recording ? ' is-recording' : ''}`}
        aria-label="修改新建备忘录快捷键"
        onClick={() => {
          setRecording(true)
          buttonRef.current?.focus()
        }}
        onBlur={() => setRecording(false)}
      >
        {recording ? '按下组合键…' : displayAccelerator(value)}
      </button>
    </div>
  )
}
