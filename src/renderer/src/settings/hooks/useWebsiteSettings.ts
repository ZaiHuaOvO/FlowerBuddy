import { useState } from 'react'
import type { FormEvent } from 'react'
import type { WebsiteCheckConfig } from '../../../../shared/api'
import { toMessage } from '../utils/formatters'
import { createWebsiteForm } from '../utils/forms'
import type { WebsiteFormState } from '../utils/forms'
import type { SettingsApi } from '../types'

interface Options {
  api: SettingsApi | undefined
  websites: WebsiteCheckConfig[]
  setWebsites: (websites: WebsiteCheckConfig[]) => void
  flash: (message: string) => void
  setError: (message: string) => void
}

export function useWebsiteSettings({ api, websites, setWebsites, flash, setError }: Options) {
  const [form, setForm] = useState<WebsiteFormState>(createWebsiteForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [checkingAll, setCheckingAll] = useState(false)

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!api) {
      return
    }
    setError('')
    try {
      const next = editingId
        ? await api.updateWebsiteCheck(editingId, form)
        : await api.createWebsiteCheck(form)
      setWebsites(next)
      setForm(createWebsiteForm())
      setEditingId(null)
      flash(editingId ? '已保存' : '已添加')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  function startEdit(check: WebsiteCheckConfig): void {
    setForm({
      name: check.name,
      url: check.url,
      timeoutMs: check.timeoutMs,
      pollingIntervalMinutes: check.pollingIntervalMinutes
    })
    setEditingId(check.id)
    setConfirmDeleteId(null)
  }

  function cancelEdit(): void {
    setForm(createWebsiteForm())
    setEditingId(null)
  }

  async function toggle(id: string, enabled: boolean): Promise<void> {
    if (!api) {
      return
    }
    try {
      setWebsites(await api.setWebsiteCheckEnabled(id, enabled))
      flash('已保存')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function remove(id: string): Promise<void> {
    if (!api) {
      return
    }
    try {
      setWebsites(await api.deleteWebsiteCheck(id))
      setConfirmDeleteId(null)
      if (editingId === id) {
        cancelEdit()
      }
      flash('已删除')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function checkOne(id: string): Promise<void> {
    if (!api) {
      return
    }
    setCheckingId(id)
    setError('')
    try {
      setWebsites(await api.checkWebsite(id))
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setCheckingId(null)
    }
  }

  async function checkAll(): Promise<void> {
    if (!api) {
      return
    }
    setCheckingAll(true)
    setError('')
    try {
      setWebsites(await api.checkAllWebsites())
      flash('检测完成')
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setCheckingAll(false)
    }
  }

  return {
    websites,
    form,
    setForm,
    editingId,
    confirmDeleteId,
    setConfirmDeleteId,
    checkingId,
    checkingAll,
    submit,
    startEdit,
    cancelEdit,
    toggle,
    remove,
    checkOne,
    checkAll
  }
}
