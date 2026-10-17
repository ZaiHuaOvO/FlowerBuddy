import { useState } from 'react'
import type { FormEvent } from 'react'
import type { DateEventSummary } from '../../../../shared/api'
import { toMessage } from '../utils/formatters'
import { createDateForm } from '../utils/forms'
import type { DateFormState } from '../utils/forms'
import type { SettingsApi } from '../types'

interface Options {
  api: SettingsApi | undefined
  events: DateEventSummary[]
  setEvents: (events: DateEventSummary[]) => void
  flash: (message: string) => void
  setError: (message: string) => void
}

export function useDatesSettings({ api, events, setEvents, flash, setError }: Options) {
  const [form, setForm] = useState<DateFormState>(createDateForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!api) {
      return
    }
    setError('')
    try {
      const next = editingId
        ? await api.updateDateEvent(editingId, form)
        : await api.createDateEvent(form)
      setEvents(next)
      setForm(createDateForm())
      setEditingId(null)
      flash(editingId ? '已保存' : '已添加')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  function startEdit(item: DateEventSummary): void {
    setForm({
      title: item.title,
      date: item.date,
      recurrence: item.recurrence,
      category: item.category
    })
    setEditingId(item.id)
    setConfirmDeleteId(null)
  }

  function cancelEdit(): void {
    setForm(createDateForm())
    setEditingId(null)
  }

  async function toggle(id: string, enabled: boolean): Promise<void> {
    if (!api) {
      return
    }
    try {
      setEvents(await api.setDateEventEnabled(id, enabled))
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function remove(id: string): Promise<void> {
    if (!api) {
      return
    }
    try {
      setEvents(await api.deleteDateEvent(id))
      setConfirmDeleteId(null)
      if (editingId === id) {
        cancelEdit()
      }
      flash('已删除')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  return {
    events,
    form,
    setForm,
    editingId,
    confirmDeleteId,
    setConfirmDeleteId,
    submit,
    startEdit,
    cancelEdit,
    toggle,
    remove
  }
}
