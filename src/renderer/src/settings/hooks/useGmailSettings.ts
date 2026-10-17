import { useState } from 'react'
import type {
  GmailSettingsPatch,
  GmailStateView,
  ModuleSummary,
  PublicConfig
} from '../../../../shared/api'
import { maskEmail, toMessage } from '../utils/formatters'
import type { SettingsApi } from '../types'

interface Options {
  api: SettingsApi | undefined
  setConfig: (config: PublicConfig) => void
  modules: ModuleSummary[]
  setModules: (modules: ModuleSummary[]) => void
  gmailState: GmailStateView | null
  setGmailState: (state: GmailStateView | null) => void
  flash: (message: string) => void
  setError: (message: string) => void
}

export function useGmailSettings({
  api,
  setConfig,
  modules,
  setModules,
  gmailState,
  setGmailState,
  flash,
  setError
}: Options) {
  const [clientIdDraft, setClientIdDraft] = useState('')
  const [clientSecretDraft, setClientSecretDraft] = useState('')
  const [busy, setBusy] = useState<'idle' | 'saving' | 'connecting' | 'checking'>('idle')
  const [checkResult, setCheckResult] = useState('')

  async function saveClient(): Promise<void> {
    if (!api) {
      return
    }
    if (!clientIdDraft.trim() || !clientSecretDraft.trim()) {
      setError('请填写 Gmail OAuth Client ID 和 Client Secret')
      return
    }
    setError('')
    setBusy('saving')
    try {
      setModules(await api.saveGmailClient(clientIdDraft, clientSecretDraft))
      setClientIdDraft('')
      setClientSecretDraft('')
      setGmailState(await api.getGmailState())
      flash('Gmail 客户端配置已加密保存')
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setBusy('idle')
    }
  }

  async function connect(): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    setBusy('connecting')
    try {
      const result = await api.connectGmail()
      setModules(result.modules)
      setGmailState(await api.getGmailState())
      flash(`已连接 ${maskEmail(result.emailAddress)}`)
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setBusy('idle')
    }
  }

  async function disconnect(): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    try {
      setModules(await api.disconnectGmail())
      setGmailState(await api.getGmailState())
      setCheckResult('')
      flash('已断开 Gmail')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function checkNow(): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    setBusy('checking')
    try {
      const summary = await api.checkGmailNow()
      setGmailState(await api.getGmailState())
      setCheckResult(
        summary.baselineReestablished
          ? '已重新建立同步基线，不会提醒历史邮件'
          : summary.newMessages === 0
            ? '没有新邮件'
            : `收到 ${summary.newMessages} 封新邮件`
      )
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setBusy('idle')
    }
  }

  async function updateSettings(patch: GmailSettingsPatch): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    try {
      setConfig(await api.updateGmailSettings(patch))
      flash('已保存')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  return {
    gmailState,
    summary: modules.find((module) => module.id === 'gmail'),
    clientIdDraft,
    setClientIdDraft,
    clientSecretDraft,
    setClientSecretDraft,
    busy,
    checkResult,
    saveClient,
    connect,
    disconnect,
    checkNow,
    updateSettings
  }
}
