import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../components/Button'

interface Props {
  value: string | null
  onSelect: (localValue: string) => void
  onClear: () => void
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
      <rect
        x="2.3"
        y="3.4"
        width="11.4"
        height="10.3"
        rx="1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M2.3 6.4h11.4M5.4 2.2v2.4M10.6 2.2v2.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

export function MemoReminderPicker({ value, onSelect, onClear }: Props) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(0)
  const [viewMonth, setViewMonth] = useState(0)
  const [selectedDay, setSelectedDay] = useState(1)
  const [hours, setHours] = useState(9)
  const [minutes, setMinutes] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  function loadValue(): void {
    const date = value ? new Date(value) : new Date()
    const valid = !Number.isNaN(date.getTime())
    const base = valid ? date : new Date()
    setViewYear(base.getFullYear())
    setViewMonth(base.getMonth())
    setSelectedDay(base.getDate())
    setHours(base.getHours())
    setMinutes(base.getMinutes())
    setSeconds(base.getSeconds())
  }

  function openPicker(): void {
    loadValue()
    setOpen(true)
  }

  useEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    const measure = (): void => {
      const trigger = triggerRef.current
      const popover = popoverRef.current
      if (!trigger || !popover) {
        return
      }
      const rect = trigger.getBoundingClientRect()
      const size = popover.getBoundingClientRect()
      const margin = 8
      const gap = 6
      let left = rect.right - size.width
      left = Math.max(margin, Math.min(left, window.innerWidth - size.width - margin))
      let top = rect.bottom + gap
      if (top + size.height > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - size.height - gap)
      }
      setPosition({ top, left })
    }
    measure()
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return
      }
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', measure)
    }
  }, [open])

  function changeMonth(delta: number): void {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
    const days = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
    setSelectedDay((day) => Math.min(day, days))
  }

  function selectToday(): void {
    const today = new Date()
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelectedDay(today.getDate())
  }

  function confirm(): void {
    onSelect(
      `${viewYear}-${pad(viewMonth + 1)}-${pad(selectedDay)}T${pad(hours)}:${pad(minutes)}:${pad(
        seconds
      )}`
    )
    setOpen(false)
  }

  const firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === viewYear && today.getMonth() === viewMonth

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="fl-button fl-button-secondary memo-picker-trigger"
        aria-label="选择提醒时间"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        <CalendarIcon />
        选择时间
      </button>

      {open
        ? createPortal(
            <div
              ref={popoverRef}
              className="memo-picker-popover"
              role="dialog"
              aria-modal="false"
              aria-label="选择提醒日期和时间"
              style={
                position
                  ? { top: position.top, left: position.left }
                  : { top: 0, left: 0, visibility: 'hidden' }
              }
            >
              <div className="memo-picker-header">
                <button
                  type="button"
                  className="memo-picker-nav"
                  aria-label="上个月"
                  onClick={() => changeMonth(-1)}
                >
                  ‹
                </button>
                <span className="memo-picker-title">
                  {viewYear} 年 {viewMonth + 1} 月
                </span>
                <button
                  type="button"
                  className="memo-picker-nav"
                  aria-label="下个月"
                  onClick={() => changeMonth(1)}
                >
                  ›
                </button>
              </div>

              <div className="memo-calendar-weekdays">
                {WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="memo-calendar-grid">
                {Array.from({ length: firstWeekday }, (_, index) => (
                  <span key={`blank-${index}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, index) => {
                  const day = index + 1
                  const selected = day === selectedDay
                  const isToday = isCurrentMonth && day === today.getDate()
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`memo-calendar-day${selected ? ' is-selected' : ''}${
                        isToday ? ' is-today' : ''
                      }`}
                      aria-pressed={selected}
                      onClick={() => setSelectedDay(day)}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>

              <div className="memo-time-row">
                <span className="memo-time-label">时间</span>
                <label className="memo-time-field">
                  <input
                    className="fl-input memo-time-input"
                    type="number"
                    min={0}
                    max={23}
                    value={hours}
                    onChange={(event) => setHours(clamp(Number(event.target.value), 0, 23))}
                  />
                  <span>时</span>
                </label>
                <label className="memo-time-field">
                  <input
                    className="fl-input memo-time-input"
                    type="number"
                    min={0}
                    max={59}
                    value={minutes}
                    onChange={(event) => setMinutes(clamp(Number(event.target.value), 0, 59))}
                  />
                  <span>分</span>
                </label>
                <label className="memo-time-field">
                  <input
                    className="fl-input memo-time-input"
                    type="number"
                    min={0}
                    max={59}
                    value={seconds}
                    onChange={(event) => setSeconds(clamp(Number(event.target.value), 0, 59))}
                  />
                  <span>秒</span>
                </label>
              </div>

              <div className="memo-picker-footer">
                <Button
                  variant="ghost"
                  onClick={() => {
                    onClear()
                    setOpen(false)
                  }}
                >
                  清除
                </Button>
                <span className="memo-picker-footer-main">
                  <Button variant="ghost" onClick={selectToday}>
                    今天
                  </Button>
                  <Button variant="secondary" onClick={() => setOpen(false)}>
                    取消
                  </Button>
                  <Button variant="primary" onClick={confirm}>
                    确定
                  </Button>
                </span>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
