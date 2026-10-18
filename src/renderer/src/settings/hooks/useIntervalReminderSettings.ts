import { useState } from 'react'
import type { FormEvent } from 'react'
import type { IntervalReminderSummary, ReminderRange } from '../../../../shared/api'
import { createReminderForm, formIntervalMinutes } from '../utils/forms'
import type { ReminderFormState } from '../utils/forms'
import { toMessage } from '../utils/formatters'
import type { SettingsApi } from '../types'

interface Options {
  api: SettingsApi | undefined
  reminders: IntervalReminderSummary[]
  setReminders: (reminders: IntervalReminderSummary[]) => void
  flash: (message: string) => void
  setError: (message: string) => void
}

function isValidRange(range: ReminderRange): boolean {
  return (
    /^([01]?\d|2[0-3]):([0-5]\d)$/.test(range.start) &&
    /^([01]?\d|2[0-3]):([0-5]\d)$/.test(range.end) &&
    range.start !== range.end
  )
}

export function useIntervalReminderSettings({
  api,
  reminders,
  setReminders,
  flash,
  setError
}: Options) {
  const [form, setForm] = useState<ReminderFormState>(createReminderForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function openNew(): void {
    setForm(createReminderForm())
    setEditingId(null)
    setConfirmDeleteId(null)
    setDialogOpen(true)
  }

  function openEdit(reminder: IntervalReminderSummary): void {
    setForm(createReminderForm(reminder))
    setEditingId(reminder.id)
    setConfirmDeleteId(null)
    setDialogOpen(true)
  }

  function closeDialog(): void {
    setDialogOpen(false)
    setEditingId(null)
    setConfirmDeleteId(null)
  }

  function changeUnit(unit: 'minutes' | 'hours'): void {
    // Keep the typed number; the unit describes how to read it.
    setForm({ ...form, intervalUnit: unit })
  }

  function addRange(): void {
    if (form.ranges.length >= 6) {
      setError('最多设置 6 个生效时间段')
      return
    }
    setForm({ ...form, ranges: [...form.ranges, { start: '09:00', end: '12:00' }] })
  }

  function updateRange(index: number, patch: Partial<ReminderRange>): void {
    setForm({
      ...form,
      ranges: form.ranges.map((range, current) =>
        current === index ? { ...range, ...patch } : range
      )
    })
  }

  function removeRange(index: number): void {
    setForm({ ...form, ranges: form.ranges.filter((_, current) => current !== index) })
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!api) {
      return
    }
    setError('')
    const name = form.name.trim()
    const text = form.text.trim()
    if (!name || !text) {
      setError('提醒名称和提醒文本不能为空')
      return
    }
    if (form.ranges.some((range) => !isValidRange(range))) {
      setError('生效时间格式应为 HH:mm，且开始和结束不能相同')
      return
    }
    if (!Number.isFinite(form.randomJitterMinutes) || form.randomJitterMinutes < 0) {
      setError('随机值不能为负数')
      return
    }
    setBusy(true)
    try {
      const input = {
        name,
        text,
        intervalMinutes: formIntervalMinutes(form),
        ranges: form.ranges,
        randomEnabled: form.randomEnabled,
        randomJitterMinutes: Math.round(form.randomJitterMinutes)
      }
      const next = editingId
        ? await api.updateIntervalReminder(editingId, input)
        : await api.createIntervalReminder({ ...input, enabled: true })
      setReminders(next)
      closeDialog()
      flash(editingId ? '已保存' : '已添加提醒')
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  async function toggle(id: string, enabled: boolean): Promise<void> {
    if (!api) {
      return
    }
    try {
      setReminders(await api.setIntervalReminderEnabled(id, enabled))
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function remove(id: string): Promise<void> {
    if (!api) {
      return
    }
    try {
      setReminders(await api.deleteIntervalReminder(id))
      setConfirmDeleteId(null)
      if (editingId === id) {
        closeDialog()
      }
      flash('已删除')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  return {
    reminders,
    form,
    setForm,
    editingId,
    dialogOpen,
    confirmDeleteId,
    setConfirmDeleteId,
    busy,
    openNew,
    openEdit,
    closeDialog,
    changeUnit,
    addRange,
    updateRange,
    removeRange,
    submit,
    toggle,
    remove
  }
}
