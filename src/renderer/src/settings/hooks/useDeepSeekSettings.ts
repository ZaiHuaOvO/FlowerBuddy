import { useState } from 'react'
import type { DeepSeekBalance, ModuleSummary } from '../../../../shared/api'
import { toMessage } from '../utils/formatters'
import type { SettingsApi } from '../types'

interface Options {
  api: SettingsApi | undefined
  modules: ModuleSummary[]
  setModules: (modules: ModuleSummary[]) => void
  saveRefreshInterval: (moduleId: 'deepseek' | 'esa', value: string) => Promise<void>
  flash: (message: string) => void
  setError: (message: string) => void
}

export function useDeepSeekSettings({
  api,
  modules,
  setModules,
  saveRefreshInterval,
  flash,
  setError
}: Options) {
  const [keyDraft, setKeyDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [balance, setBalance] = useState<DeepSeekBalance | null>(null)

  async function saveKey(): Promise<boolean> {
    if (!api) {
      return false
    }
    if (!keyDraft.trim()) {
      setError('请输入 DeepSeek API Key')
      return false
    }
    setError('')
    setBusy(true)
    try {
      setModules(await api.saveDeepSeekKey(keyDraft))
      setKeyDraft('')
      flash('DeepSeek Key 已加密保存')
      setBalance(await api.fetchDeepSeekBalance())
      return true
    } catch (cause) {
      setError(toMessage(cause))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function clearKey(): Promise<boolean> {
    if (!api) {
      return false
    }
    setError('')
    try {
      setModules(await api.clearDeepSeekKey())
      setBalance(null)
      flash('已清除 DeepSeek Key')
      return true
    } catch (cause) {
      setError(toMessage(cause))
      return false
    }
  }

  async function refresh(): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    setBusy(true)
    try {
      setBalance(await api.fetchDeepSeekBalance())
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return {
    summary: modules.find((module) => module.id === 'deepseek'),
    keyDraft,
    setKeyDraft,
    busy,
    balance,
    saveKey,
    clearKey,
    refresh,
    saveRefreshInterval
  }
}
