import { useEffect, useRef, useState } from 'react'
import type { EsaTrafficSummary, ModuleSummary } from '../../../../shared/api'
import { toMessage } from '../utils/formatters'
import type { SettingsApi } from '../types'

interface Options {
  api: SettingsApi | undefined
  modules: ModuleSummary[]
  setModules: (modules: ModuleSummary[]) => void
  initialSiteId: string
  saveRefreshInterval: (moduleId: 'deepseek' | 'esa', value: string) => Promise<void>
  flash: (message: string) => void
  setError: (message: string) => void
}

export function useEsaSettings({
  api,
  modules,
  setModules,
  initialSiteId,
  saveRefreshInterval,
  flash,
  setError
}: Options) {
  const [keyIdDraft, setKeyIdDraft] = useState('')
  const [keySecretDraft, setKeySecretDraft] = useState('')
  const [siteIdDraft, setSiteIdDraft] = useState(initialSiteId)
  const [busy, setBusy] = useState(false)
  const [traffic, setTraffic] = useState<EsaTrafficSummary | null>(null)
  const [formError, setFormError] = useState('')
  const lastSiteId = useRef(initialSiteId)

  useEffect(() => {
    if (initialSiteId !== lastSiteId.current) {
      lastSiteId.current = initialSiteId
      setSiteIdDraft(initialSiteId)
    }
  }, [initialSiteId])

  async function saveCredentials(): Promise<boolean> {
    if (!api) {
      return false
    }
    if (!keyIdDraft.trim() || !keySecretDraft.trim() || !siteIdDraft.trim()) {
      setFormError('请填写 AccessKey ID、AccessKey Secret 和 SiteId')
      return false
    }
    setFormError('')
    setBusy(true)
    try {
      setModules(
        await api.saveEsaCredentials({
          accessKeyId: keyIdDraft,
          accessKeySecret: keySecretDraft,
          siteId: siteIdDraft
        })
      )
      setKeyIdDraft('')
      setKeySecretDraft('')
      flash('ESA 凭据已加密保存')
      setTraffic(await api.fetchEsaTraffic())
      return true
    } catch (cause) {
      setFormError(toMessage(cause))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function clearCredentials(): Promise<boolean> {
    if (!api) {
      return false
    }
    setError('')
    try {
      setModules(await api.clearEsaCredentials())
      setTraffic(null)
      flash('已清除 ESA 凭据')
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
      setTraffic(await api.fetchEsaTraffic())
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return {
    summary: modules.find((module) => module.id === 'esa'),
    keyIdDraft,
    setKeyIdDraft,
    keySecretDraft,
    setKeySecretDraft,
    siteIdDraft,
    setSiteIdDraft,
    formError,
    setFormError,
    busy,
    traffic,
    saveCredentials,
    clearCredentials,
    refresh,
    saveRefreshInterval
  }
}
