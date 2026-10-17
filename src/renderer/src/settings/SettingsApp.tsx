import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type {
  AppInfo,
  AppSettingsPatch,
  DateCategory,
  DateEventSummary,
  DateRecurrence,
  DeepSeekBalance,
  EsaTraffic,
  GmailSettingsPatch,
  GmailStateView,
  ModuleId,
  ModuleStatus,
  ModuleSummary,
  PublicConfig,
  RefreshableModuleId,
  SecurityStatus,
  WebsiteCheckConfig,
  WebsiteCheckResult
} from '../../../shared/api'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Field } from '../components/Field'
import { Tag, type TagTone } from '../components/Tag'
import '../styles/settings.css'

const BUBBLE_DURATION_OPTIONS = [3000, 5000, 8000]
const SCALE_MIN = 0.5
const SCALE_MAX = 2
const SCALE_STEP = 0.1
const TIMEOUT_OPTIONS = [3000, 5000, 8000, 15000, 30000]
const POLLING_OPTIONS = [null, 5, 10, 15, 30]

type SettingsTab =
  'general' | 'modules' | 'dates' | 'websites' | 'gmail' | 'deepseek' | 'esa' | 'appearance'

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'general', label: '常规' },
  { id: 'modules', label: '功能' },
  { id: 'dates', label: '日期' },
  { id: 'websites', label: '网站' },
  { id: 'gmail', label: 'Gmail' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'esa', label: 'ESA' },
  { id: 'appearance', label: '外观' }
]

const CATEGORY_OPTIONS: Array<{ value: DateCategory; label: string }> = [
  { value: 'birthday', label: '生日' },
  { value: 'anniversary', label: '纪念日' },
  { value: 'overtime', label: '加班' },
  { value: 'custom', label: '自定义' }
]

interface DateFormState {
  title: string
  date: string
  recurrence: DateRecurrence
  category: DateCategory
}

interface WebsiteFormState {
  name: string
  url: string
  timeoutMs: number
  pollingIntervalMinutes: number | null
}

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message
    if (typeof message === 'string') {
      return message
    }
  }
  return String(error)
}

function tagTone(status: ModuleStatus): TagTone {
  switch (status) {
    case 'ready':
      return 'success'
    case 'auth-expired':
      return 'danger'
    case 'not-configured':
      return 'warning'
    case 'not-implemented':
      return 'muted'
  }
}

function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function createDateForm(): DateFormState {
  return { title: '', date: todayIso(), recurrence: 'yearly', category: 'custom' }
}

function createWebsiteForm(): WebsiteFormState {
  return { name: '', url: '', timeoutMs: 8000, pollingIntervalMinutes: null }
}

function categoryLabel(category: DateCategory): string {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? '自定义'
}

function countdownLabel(days: number | null): string {
  if (days === null) {
    return '已过去'
  }
  return days === 0 ? '今天' : `还有 ${days} 天`
}

function dateTone(event: DateEventSummary): TagTone {
  if (!event.enabled || !event.upcoming) {
    return 'muted'
  }
  return event.daysUntil === 0 ? 'warning' : 'success'
}

function dateStatusLabel(event: DateEventSummary): string {
  if (!event.enabled) {
    return '已停用'
  }
  if (!event.upcoming) {
    return '已过去'
  }
  return countdownLabel(event.daysUntil)
}

function websiteTone(result: WebsiteCheckResult | null): TagTone {
  if (!result) {
    return 'muted'
  }
  return result.ok ? 'success' : 'danger'
}

function websiteLabel(result: WebsiteCheckResult | null): string {
  if (!result) {
    return '尚未检测'
  }
  if (result.ok) {
    return `正常 · HTTP ${result.status ?? '-'} · ${result.durationMs}ms`
  }
  if (result.errorKind === 'http-error') {
    return `${result.message} · ${result.durationMs}ms`
  }
  return result.message
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function formatBalanceAmount(currency: string, amount: string): string {
  const value = Number(amount)
  if (!Number.isFinite(value)) {
    return `${currency} ${amount}`
  }
  try {
    return `${currency} ${new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency
    }).format(value)}`
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let value = Math.max(0, bytes)
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  const digits = index === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[index]}`
}

function formatTrafficRange(startTime: string, endTime: string): string {
  const start = new Date(startTime)
  const end = new Date(endTime)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return ''
  }
  const date = start.toLocaleDateString('zh-CN')
  const startClock = start.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
  const endClock = end.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${date} ${startClock} 至 ${endClock}`
}

function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) {
    return email
  }
  return `${email.slice(0, 1)}***${email.slice(at)}`
}

export default function SettingsApp() {
  const api = window.settingsApi
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [modules, setModules] = useState<ModuleSummary[]>([])
  const [security, setSecurity] = useState<SecurityStatus | null>(null)
  const [startupNotice, setStartupNotice] = useState<string | null>(null)
  const [dateEvents, setDateEvents] = useState<DateEventSummary[]>([])
  const [websites, setWebsites] = useState<WebsiteCheckConfig[]>([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [scaleDraft, setScaleDraft] = useState(1)
  const [dateForm, setDateForm] = useState<DateFormState>(createDateForm)
  const [editingDateId, setEditingDateId] = useState<string | null>(null)
  const [confirmDateDeleteId, setConfirmDateDeleteId] = useState<string | null>(null)
  const [websiteForm, setWebsiteForm] = useState<WebsiteFormState>(createWebsiteForm)
  const [editingWebsiteId, setEditingWebsiteId] = useState<string | null>(null)
  const [confirmWebsiteDeleteId, setConfirmWebsiteDeleteId] = useState<string | null>(null)
  const [checkingWebsiteId, setCheckingWebsiteId] = useState<string | null>(null)
  const [checkingAll, setCheckingAll] = useState(false)
  const [deepSeekKeyDraft, setDeepSeekKeyDraft] = useState('')
  const [deepSeekBusy, setDeepSeekBusy] = useState(false)
  const [deepSeekBalance, setDeepSeekBalance] = useState<DeepSeekBalance | null>(null)
  const [esaKeyIdDraft, setEsaKeyIdDraft] = useState('')
  const [esaKeySecretDraft, setEsaKeySecretDraft] = useState('')
  const [esaSiteIdDraft, setEsaSiteIdDraft] = useState('')
  const [esaBusy, setEsaBusy] = useState(false)
  const [esaTraffic, setEsaTraffic] = useState<EsaTraffic | null>(null)
  const [gmailClientIdDraft, setGmailClientIdDraft] = useState('')
  const [gmailClientSecretDraft, setGmailClientSecretDraft] = useState('')
  const [gmailBusy, setGmailBusy] = useState<'idle' | 'saving' | 'connecting' | 'checking'>('idle')
  const [gmailState, setGmailState] = useState<GmailStateView | null>(null)
  const [gmailCheckResult, setGmailCheckResult] = useState('')
  const scaleTimer = useRef<number | null>(null)
  const statusTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!api) {
      return
    }
    let active = true

    void api
      .getConfig()
      .then((next) => {
        if (active) {
          setConfig(next)
          setScaleDraft(next.pet.scale)
          setEsaSiteIdDraft(next.modules.esa.siteId)
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(toMessage(cause))
        }
      })

    void api
      .getAppInfo()
      .then((next) => {
        if (active) {
          setAppInfo(next)
        }
      })
      .catch(() => {})

    void api
      .getModules()
      .then((next) => {
        if (active) {
          setModules(next)
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(toMessage(cause))
        }
      })

    void api
      .getSecurityStatus()
      .then((next) => {
        if (active) {
          setSecurity(next)
        }
      })
      .catch(() => {})

    void api
      .getStartupNotice()
      .then((next) => {
        if (active) {
          setStartupNotice(next)
        }
      })
      .catch(() => {})

    void api
      .getGmailState()
      .then((next) => {
        if (active) {
          setGmailState(next)
        }
      })
      .catch(() => {})

    void api
      .listDateEvents()
      .then((next) => {
        if (active) {
          setDateEvents(next)
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(toMessage(cause))
        }
      })

    void api
      .listWebsiteChecks()
      .then((next) => {
        if (active) {
          setWebsites(next)
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(toMessage(cause))
        }
      })

    return () => {
      active = false
      if (scaleTimer.current !== null) {
        window.clearTimeout(scaleTimer.current)
        scaleTimer.current = null
      }
      if (statusTimer.current !== null) {
        window.clearTimeout(statusTimer.current)
        statusTimer.current = null
      }
    }
  }, [api])

  function flash(message: string): void {
    setStatus(message)
    if (statusTimer.current !== null) {
      window.clearTimeout(statusTimer.current)
    }
    statusTimer.current = window.setTimeout(() => {
      setStatus('')
      statusTimer.current = null
    }, 1800)
  }

  async function saveApp(patch: AppSettingsPatch): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    try {
      setConfig(await api.saveAppSettings(patch))
      flash('已保存')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function commitScale(value: number): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    try {
      const next = await api.savePetSettings({ scale: value })
      setConfig(next)
      setScaleDraft(next.pet.scale)
      flash('已保存')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  function handleScaleChange(value: number): void {
    setScaleDraft(value)
    if (scaleTimer.current !== null) {
      window.clearTimeout(scaleTimer.current)
    }
    scaleTimer.current = window.setTimeout(() => {
      scaleTimer.current = null
      void commitScale(value)
    }, 200)
  }

  function handleScaleCommit(): void {
    if (scaleTimer.current !== null) {
      window.clearTimeout(scaleTimer.current)
      scaleTimer.current = null
    }
    void commitScale(scaleDraft)
  }

  async function handleToggleModule(moduleId: ModuleId, enabled: boolean): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    try {
      setModules(await api.setModuleEnabled(moduleId, enabled))
      flash('已保存')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function handleImport(): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    try {
      const next = await api.importPetImage()
      if (next) {
        setConfig(next)
        setScaleDraft(next.pet.scale)
        flash('已导入新形象')
      }
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function handleResetPosition(): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    try {
      setConfig(await api.resetPetPosition())
      flash('已重置位置')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function handleDateSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!api) {
      return
    }
    setError('')
    try {
      const next = editingDateId
        ? await api.updateDateEvent(editingDateId, dateForm)
        : await api.createDateEvent(dateForm)
      setDateEvents(next)
      setDateForm(createDateForm())
      setEditingDateId(null)
      flash(editingDateId ? '已保存' : '已添加')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  function startEditDate(event: DateEventSummary): void {
    setDateForm({
      title: event.title,
      date: event.date,
      recurrence: event.recurrence,
      category: event.category
    })
    setEditingDateId(event.id)
    setConfirmDateDeleteId(null)
  }

  function cancelEditDate(): void {
    setDateForm(createDateForm())
    setEditingDateId(null)
  }

  async function handleDateToggle(id: string, enabled: boolean): Promise<void> {
    if (!api) {
      return
    }
    try {
      setDateEvents(await api.setDateEventEnabled(id, enabled))
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function removeDate(id: string): Promise<void> {
    if (!api) {
      return
    }
    try {
      setDateEvents(await api.deleteDateEvent(id))
      setConfirmDateDeleteId(null)
      if (editingDateId === id) {
        cancelEditDate()
      }
      flash('已删除')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function handleWebsiteSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!api) {
      return
    }
    setError('')
    try {
      const next = editingWebsiteId
        ? await api.updateWebsiteCheck(editingWebsiteId, websiteForm)
        : await api.createWebsiteCheck(websiteForm)
      setWebsites(next)
      setWebsiteForm(createWebsiteForm())
      setEditingWebsiteId(null)
      flash(editingWebsiteId ? '已保存' : '已添加')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  function startEditWebsite(check: WebsiteCheckConfig): void {
    setWebsiteForm({
      name: check.name,
      url: check.url,
      timeoutMs: check.timeoutMs,
      pollingIntervalMinutes: check.pollingIntervalMinutes
    })
    setEditingWebsiteId(check.id)
    setConfirmWebsiteDeleteId(null)
  }

  function cancelEditWebsite(): void {
    setWebsiteForm(createWebsiteForm())
    setEditingWebsiteId(null)
  }

  async function handleWebsiteToggle(id: string, enabled: boolean): Promise<void> {
    if (!api) {
      return
    }
    try {
      setWebsites(await api.setWebsiteCheckEnabled(id, enabled))
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function removeWebsite(id: string): Promise<void> {
    if (!api) {
      return
    }
    try {
      setWebsites(await api.deleteWebsiteCheck(id))
      setConfirmWebsiteDeleteId(null)
      if (editingWebsiteId === id) {
        cancelEditWebsite()
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
    setCheckingWebsiteId(id)
    setError('')
    try {
      setWebsites(await api.checkWebsite(id))
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setCheckingWebsiteId(null)
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

  async function handleSaveDeepSeekKey(): Promise<void> {
    if (!api) {
      return
    }
    if (!deepSeekKeyDraft.trim()) {
      setError('请输入 DeepSeek API Key')
      return
    }
    setError('')
    setDeepSeekBusy(true)
    try {
      setModules(await api.saveDeepSeekKey(deepSeekKeyDraft))
      setDeepSeekKeyDraft('')
      flash('DeepSeek Key 已加密保存')
      setDeepSeekBalance(await api.fetchDeepSeekBalance())
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setDeepSeekBusy(false)
    }
  }

  async function handleClearDeepSeekKey(): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    try {
      setModules(await api.clearDeepSeekKey())
      setDeepSeekBalance(null)
      flash('已清除 DeepSeek Key')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function refreshDeepSeekBalance(): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    setDeepSeekBusy(true)
    try {
      setDeepSeekBalance(await api.fetchDeepSeekBalance())
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setDeepSeekBusy(false)
    }
  }

  async function handleSaveEsaCredentials(): Promise<void> {
    if (!api) {
      return
    }
    if (!esaKeyIdDraft.trim() || !esaKeySecretDraft.trim() || !esaSiteIdDraft.trim()) {
      setError('请填写 AccessKey ID、AccessKey Secret 和 SiteId')
      return
    }
    setError('')
    setEsaBusy(true)
    try {
      setModules(
        await api.saveEsaCredentials({
          accessKeyId: esaKeyIdDraft,
          accessKeySecret: esaKeySecretDraft,
          siteId: esaSiteIdDraft
        })
      )
      setEsaKeyIdDraft('')
      setEsaKeySecretDraft('')
      flash('ESA 凭据已加密保存')
      setEsaTraffic(await api.fetchEsaTraffic())
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setEsaBusy(false)
    }
  }

  async function handleClearEsaCredentials(): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    try {
      setModules(await api.clearEsaCredentials())
      setEsaTraffic(null)
      flash('已清除 ESA 凭据')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function refreshEsaTraffic(): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    setEsaBusy(true)
    try {
      setEsaTraffic(await api.fetchEsaTraffic())
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setEsaBusy(false)
    }
  }

  async function handleRefreshInterval(
    moduleId: RefreshableModuleId,
    value: string
  ): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    try {
      setConfig(
        await api.setModuleRefreshInterval(moduleId, value === 'manual' ? null : Number(value))
      )
      flash('已保存')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function saveGmailClient(): Promise<void> {
    if (!api) {
      return
    }
    if (!gmailClientIdDraft.trim() || !gmailClientSecretDraft.trim()) {
      setError('请填写 Gmail OAuth Client ID 和 Client Secret')
      return
    }
    setError('')
    setGmailBusy('saving')
    try {
      setModules(await api.saveGmailClient(gmailClientIdDraft, gmailClientSecretDraft))
      setGmailClientIdDraft('')
      setGmailClientSecretDraft('')
      setGmailState(await api.getGmailState())
      flash('Gmail 客户端配置已加密保存')
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setGmailBusy('idle')
    }
  }

  async function connectGmail(): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    setGmailBusy('connecting')
    try {
      const result = await api.connectGmail()
      setModules(result.modules)
      setGmailState(await api.getGmailState())
      flash(`已连接 ${maskEmail(result.emailAddress)}`)
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setGmailBusy('idle')
    }
  }

  async function disconnectGmail(): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    try {
      setModules(await api.disconnectGmail())
      setGmailState(await api.getGmailState())
      setGmailCheckResult('')
      flash('已断开 Gmail')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function checkGmail(): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    setGmailBusy('checking')
    try {
      const summary = await api.checkGmailNow()
      setGmailState(await api.getGmailState())
      setGmailCheckResult(
        summary.baselineReestablished
          ? '已重新建立同步基线，不会提醒历史邮件'
          : summary.newMessages === 0
            ? '没有新邮件'
            : `收到 ${summary.newMessages} 封新邮件`
      )
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setGmailBusy('idle')
    }
  }

  async function updateGmail(patch: GmailSettingsPatch): Promise<void> {
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

  const gmailSummary = modules.find((module) => module.id === 'gmail')
  const deepSeekSummary = modules.find((module) => module.id === 'deepseek')
  const esaSummary = modules.find((module) => module.id === 'esa')

  if (!config) {
    return (
      <div className="settings-root">
        <p className="hint">正在读取配置…</p>
      </div>
    )
  }

  return (
    <div className="settings-root">
      <header className="settings-header">
        <div>
          <h1>FlowerBuddy 设置</h1>
          <p>第一版功能已完成</p>
        </div>
        {appInfo ? (
          <p className="hint settings-version">
            版本 {appInfo.version} · Electron {appInfo.electron}
          </p>
        ) : null}
      </header>

      {startupNotice || error || status ? (
        <div className="settings-banners">
          {startupNotice ? (
            <div className="fl-alert fl-alert-warning" role="status">
              <span className="fl-alert-icon" aria-hidden="true">
                !
              </span>
              <span className="fl-alert-message">{startupNotice}</span>
            </div>
          ) : null}
          {error ? (
            <div className="fl-alert fl-alert-error" role="alert">
              <span className="fl-alert-icon" aria-hidden="true">
                !
              </span>
              <span className="fl-alert-message">{error}</span>
            </div>
          ) : null}
          {status ? (
            <div className="fl-alert fl-alert-success" role="status">
              <span className="fl-alert-icon" aria-hidden="true">
                ✓
              </span>
              <span className="fl-alert-message">{status}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <nav className="settings-tabs" role="tablist" aria-label="设置分区">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={`settings-tab${activeTab === tab.id ? ' active' : ''}`}
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div role="tabpanel">
        {activeTab === 'general' ? (
          <section className="panel">
            <h2>常规</h2>
            <label className="row">
              <span>始终置顶</span>
              <input
                type="checkbox"
                checked={config.app.alwaysOnTop}
                onChange={(event) => void saveApp({ alwaysOnTop: event.target.checked })}
              />
            </label>
            <label className="row">
              <span>点击弹跳动画</span>
              <input
                type="checkbox"
                checked={config.app.bounceAnimation}
                onChange={(event) => void saveApp({ bounceAnimation: event.target.checked })}
              />
            </label>
            <label className="row">
              <span>气泡停留时长</span>
              <select
                className="fl-select"
                value={config.app.bubbleDurationMs}
                onChange={(event) => void saveApp({ bubbleDurationMs: Number(event.target.value) })}
              >
                {BUBBLE_DURATION_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value / 1000} 秒
                  </option>
                ))}
              </select>
            </label>
            <label className="row">
              <span>开机启动</span>
              <input
                type="checkbox"
                checked={config.app.launchAtLogin}
                onChange={(event) => void saveApp({ launchAtLogin: event.target.checked })}
              />
            </label>
            <label className="row">
              <span>启动时显示桌宠</span>
              <input
                type="checkbox"
                checked={config.app.showPetOnStartup}
                onChange={(event) => void saveApp({ showPetOnStartup: event.target.checked })}
              />
            </label>
          </section>
        ) : null}

        {activeTab === 'modules' ? (
          <section className="panel">
            <h2>功能管理</h2>
            {security && !security.encryptionAvailable && security.message ? (
              <div className="fl-alert fl-alert-warning module-security-alert" role="status">
                <span className="fl-alert-icon" aria-hidden="true">
                  !
                </span>
                <span className="fl-alert-message">{security.message}</span>
              </div>
            ) : null}
            <div className="module-list">
              {modules.map((module) => (
                <div className="module-card" key={module.id} data-module={module.id}>
                  <div className="module-main">
                    <div className="module-title-row">
                      <span className="module-name">{module.name}</span>
                      <Tag tone={tagTone(module.status)}>{module.statusLabel}</Tag>
                    </div>
                    <p className="hint">{module.description}</p>
                  </div>
                  <label className="module-switch">
                    <input
                      type="checkbox"
                      checked={module.enabled}
                      onChange={(event) => void handleToggleModule(module.id, event.target.checked)}
                    />
                    <span>{module.enabled ? '已启用' : '已停用'}</span>
                  </label>
                </div>
              ))}
            </div>
            <p className="hint">开关立即生效；未配置或尚未实现的模块不会发起任何后台请求。</p>
          </section>
        ) : null}

        {activeTab === 'dates' ? (
          <section className="panel">
            <h2>日期事件</h2>
            <p className="hint">
              “今天”按本机时区计算；每年重复的 2 月 29 日在非闰年按 2 月 28 日处理。
            </p>
            <form className="form-grid" onSubmit={(event) => void handleDateSubmit(event)}>
              <Field label="事件名称">
                <input
                  className="fl-input"
                  value={dateForm.title}
                  maxLength={80}
                  required
                  placeholder="例如：结婚纪念日"
                  onChange={(event) => setDateForm({ ...dateForm, title: event.target.value })}
                />
              </Field>
              <Field label="日期">
                <input
                  className="fl-input"
                  type="date"
                  value={dateForm.date}
                  required
                  onChange={(event) => setDateForm({ ...dateForm, date: event.target.value })}
                />
              </Field>
              <Field label="重复">
                <select
                  className="fl-select"
                  value={dateForm.recurrence}
                  onChange={(event) =>
                    setDateForm({
                      ...dateForm,
                      recurrence: event.target.value as DateRecurrence
                    })
                  }
                >
                  <option value="yearly">每年</option>
                  <option value="none">一次性</option>
                </select>
              </Field>
              <Field label="分类">
                <select
                  className="fl-select"
                  value={dateForm.category}
                  onChange={(event) =>
                    setDateForm({
                      ...dateForm,
                      category: event.target.value as DateCategory
                    })
                  }
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="form-actions">
                <Button variant="primary" type="submit">
                  {editingDateId ? '保存修改' : '添加事件'}
                </Button>
                {editingDateId ? (
                  <Button variant="secondary" onClick={cancelEditDate}>
                    取消
                  </Button>
                ) : null}
              </div>
            </form>

            {dateEvents.length === 0 ? (
              <EmptyState
                title="还没有日期事件"
                description="添加生日、纪念日或一次性日期，桌宠会显示最近的事件。"
              />
            ) : (
              <div className="module-list">
                {dateEvents.map((event) => (
                  <div className="module-card" key={event.id} data-date-event={event.id}>
                    <div className="module-main">
                      <div className="module-title-row">
                        <span className="module-name">{event.title}</span>
                        <Tag tone="muted">{categoryLabel(event.category)}</Tag>
                        <Tag tone={dateTone(event)}>{dateStatusLabel(event)}</Tag>
                      </div>
                      <p className="hint">
                        {event.date} · {event.recurrence === 'yearly' ? '每年' : '一次性'}
                        {event.upcoming && event.occurrence && event.occurrence !== event.date
                          ? ` · 下次 ${event.occurrence}`
                          : ''}
                      </p>
                    </div>
                    <div className="row-actions">
                      <label className="module-switch">
                        <input
                          type="checkbox"
                          checked={event.enabled}
                          onChange={(changeEvent) =>
                            void handleDateToggle(event.id, changeEvent.target.checked)
                          }
                        />
                        <span>{event.enabled ? '已启用' : '已停用'}</span>
                      </label>
                      <Button variant="secondary" onClick={() => startEditDate(event)}>
                        编辑
                      </Button>
                      {confirmDateDeleteId === event.id ? (
                        <>
                          <Button variant="danger" onClick={() => void removeDate(event.id)}>
                            确认删除
                          </Button>
                          <Button variant="ghost" onClick={() => setConfirmDateDeleteId(null)}>
                            取消
                          </Button>
                        </>
                      ) : (
                        <Button variant="ghost" onClick={() => setConfirmDateDeleteId(event.id)}>
                          删除
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {activeTab === 'websites' ? (
          <section className="panel">
            <h2>网站检测</h2>
            <p className="hint">
              检测仅从本机网络发起，只能说明本地网络能否访问，不代表全球可用性。
            </p>
            <form className="form-grid" onSubmit={(event) => void handleWebsiteSubmit(event)}>
              <Field label="名称">
                <input
                  className="fl-input"
                  value={websiteForm.name}
                  maxLength={80}
                  required
                  placeholder="例如：个人博客"
                  onChange={(event) => setWebsiteForm({ ...websiteForm, name: event.target.value })}
                />
              </Field>
              <Field label="URL">
                <input
                  className="fl-input"
                  type="url"
                  value={websiteForm.url}
                  maxLength={2048}
                  required
                  placeholder="https://example.com"
                  onChange={(event) => setWebsiteForm({ ...websiteForm, url: event.target.value })}
                />
              </Field>
              <Field label="超时">
                <select
                  className="fl-select"
                  value={websiteForm.timeoutMs}
                  onChange={(event) =>
                    setWebsiteForm({
                      ...websiteForm,
                      timeoutMs: Number(event.target.value)
                    })
                  }
                >
                  {TIMEOUT_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value / 1000} 秒
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="定时检测">
                <select
                  className="fl-select"
                  value={
                    websiteForm.pollingIntervalMinutes === null
                      ? 'manual'
                      : String(websiteForm.pollingIntervalMinutes)
                  }
                  onChange={(event) =>
                    setWebsiteForm({
                      ...websiteForm,
                      pollingIntervalMinutes:
                        event.target.value === 'manual' ? null : Number(event.target.value)
                    })
                  }
                >
                  {POLLING_OPTIONS.map((value) => (
                    <option key={value ?? 'manual'} value={value ?? 'manual'}>
                      {value === null ? '仅手动检测' : `每 ${value} 分钟`}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="form-actions">
                <Button variant="primary" type="submit">
                  {editingWebsiteId ? '保存修改' : '添加网站'}
                </Button>
                {editingWebsiteId ? (
                  <Button variant="secondary" onClick={cancelEditWebsite}>
                    取消
                  </Button>
                ) : null}
              </div>
            </form>

            <div className="website-toolbar">
              <Button
                variant="secondary"
                disabled={checkingAll || websites.length === 0}
                onClick={() => void checkAll()}
              >
                {checkingAll ? '检测中…' : '检测全部启用网站'}
              </Button>
            </div>

            {websites.length === 0 ? (
              <EmptyState
                title="还没有网站检测"
                description="添加一个 HTTP(S) 地址，即可从本机检查它的状态码、耗时和错误类型。"
              />
            ) : (
              <div className="module-list">
                {websites.map((check) => (
                  <div className="module-card" key={check.id} data-website={check.id}>
                    <div className="module-main">
                      <div className="module-title-row">
                        <span className="module-name">{check.name}</span>
                        <Tag tone={websiteTone(check.lastResult)}>
                          {websiteLabel(check.lastResult)}
                        </Tag>
                      </div>
                      <p className="website-url" title={check.url}>
                        {check.url}
                      </p>
                      <p className="hint">
                        {check.pollingIntervalMinutes === null
                          ? '仅手动检测'
                          : `每 ${check.pollingIntervalMinutes} 分钟`}
                        {check.lastResult
                          ? ` · 更新于 ${formatTime(check.lastResult.checkedAt)}`
                          : ''}
                      </p>
                    </div>
                    <div className="row-actions">
                      <label className="module-switch">
                        <input
                          type="checkbox"
                          checked={check.enabled}
                          onChange={(changeEvent) =>
                            void handleWebsiteToggle(check.id, changeEvent.target.checked)
                          }
                        />
                        <span>{check.enabled ? '已启用' : '已停用'}</span>
                      </label>
                      <Button
                        variant="secondary"
                        disabled={checkingWebsiteId === check.id}
                        onClick={() => void checkOne(check.id)}
                      >
                        {checkingWebsiteId === check.id ? '检测中…' : '检测'}
                      </Button>
                      <Button variant="ghost" onClick={() => startEditWebsite(check)}>
                        编辑
                      </Button>
                      {confirmWebsiteDeleteId === check.id ? (
                        <>
                          <Button variant="danger" onClick={() => void removeWebsite(check.id)}>
                            确认删除
                          </Button>
                          <Button variant="ghost" onClick={() => setConfirmWebsiteDeleteId(null)}>
                            取消
                          </Button>
                        </>
                      ) : (
                        <Button variant="ghost" onClick={() => setConfirmWebsiteDeleteId(check.id)}>
                          删除
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {activeTab === 'gmail' ? (
          <section className="panel">
            <div className="panel-header-row">
              <div className="module-title-row">
                <h2>Gmail 新邮件</h2>
                <Tag
                  tone={
                    gmailSummary?.status === 'auth-expired'
                      ? 'danger'
                      : gmailSummary?.configured
                        ? 'success'
                        : 'warning'
                  }
                >
                  {gmailSummary?.statusLabel ?? '未配置'}
                </Tag>
              </div>
              <label className="module-switch">
                <input
                  type="checkbox"
                  checked={gmailSummary?.enabled ?? false}
                  onChange={(event) => void handleToggleModule('gmail', event.target.checked)}
                />
                <span>{gmailSummary?.enabled ? '已启用' : '已停用'}</span>
              </label>
            </div>
            <p className="hint">
              使用 Gmail API + OAuth
              2.0，只申请只读权限；首次连接只建立同步基线，不会把历史邮件当作新邮件提醒。
            </p>
            {gmailState?.authExpired ? (
              <div className="fl-alert fl-alert-warning panel-alert" role="status">
                <span className="fl-alert-icon" aria-hidden="true">
                  !
                </span>
                <span className="fl-alert-message">Gmail 授权已失效，请重新连接。</span>
              </div>
            ) : null}
            {gmailState?.configured && gmailState.emailAddress ? (
              <p className="hint">已连接：{maskEmail(gmailState.emailAddress)}</p>
            ) : null}
            <div className="form-grid">
              <Field label="OAuth Client ID" hint="Google Cloud 中“桌面应用”类型的 OAuth 客户端">
                <input
                  className="fl-input"
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  value={gmailClientIdDraft}
                  onChange={(event) => setGmailClientIdDraft(event.target.value)}
                />
              </Field>
              <Field label="OAuth Client Secret" hint="加密保存，保存后无法读取">
                <input
                  className="fl-input"
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  value={gmailClientSecretDraft}
                  onChange={(event) => setGmailClientSecretDraft(event.target.value)}
                />
              </Field>
              <Field label="轮询间隔" hint="默认每 3 分钟，范围 1–15 分钟">
                <select
                  className="fl-select"
                  value={config.modules.gmail.pollIntervalMinutes}
                  onChange={(event) =>
                    void updateGmail({
                      pollIntervalMinutes: Number(event.target.value)
                    })
                  }
                >
                  {[1, 3, 5, 10, 15].map((minutes) => (
                    <option key={minutes} value={minutes}>
                      每 {minutes} 分钟
                    </option>
                  ))}
                </select>
              </Field>
              <div className="form-actions">
                <Button
                  variant="secondary"
                  disabled={gmailBusy !== 'idle'}
                  onClick={() => void saveGmailClient()}
                >
                  保存客户端配置
                </Button>
                <Button
                  variant="primary"
                  disabled={gmailBusy !== 'idle' || !gmailState?.clientConfigured}
                  onClick={() => void connectGmail()}
                >
                  {gmailBusy === 'connecting' ? '等待浏览器授权…' : '连接 Gmail'}
                </Button>
                <Button
                  variant="secondary"
                  disabled={gmailBusy !== 'idle' || !gmailState?.configured}
                  onClick={() => void checkGmail()}
                >
                  {gmailBusy === 'checking' ? '检查中…' : '立即检查'}
                </Button>
                <Button
                  variant="danger"
                  disabled={gmailBusy !== 'idle' || !gmailState?.configured}
                  onClick={() => void disconnectGmail()}
                >
                  断开连接
                </Button>
              </div>
            </div>
            <label className="row">
              <span>新邮件系统通知</span>
              <input
                type="checkbox"
                checked={config.modules.gmail.notifyNewMail}
                onChange={(event) => void updateGmail({ notifyNewMail: event.target.checked })}
              />
            </label>
            <label className="row">
              <span>通知中隐藏发件人与主题</span>
              <input
                type="checkbox"
                checked={config.modules.gmail.hideSubject}
                onChange={(event) => void updateGmail({ hideSubject: event.target.checked })}
              />
            </label>
            <div className="fl-alert fl-alert-info panel-alert" role="note">
              <span className="fl-alert-icon" aria-hidden="true">
                i
              </span>
              <span className="fl-alert-message">
                需要先在 Google Cloud 启用 Gmail API、配置 OAuth consent
                screen，并创建“桌面应用”OAuth 客户端。未发布的 OAuth 应用可能只允许测试用户登录。
              </span>
            </div>
            {gmailCheckResult ? (
              <div className="result-card">
                <p className="result-title">检查结果</p>
                <p className="hint">{gmailCheckResult}</p>
              </div>
            ) : null}
            {!gmailState?.configured ? (
              <EmptyState
                title="尚未连接 Gmail"
                description={
                  gmailState?.clientConfigured
                    ? '客户端配置已保存，点击“连接 Gmail”在浏览器中完成授权。'
                    : '填写 OAuth 客户端配置并保存，然后点击“连接 Gmail”在浏览器中完成授权。'
                }
              />
            ) : null}
          </section>
        ) : null}

        {activeTab === 'deepseek' ? (
          <section className="panel">
            <div className="panel-header-row">
              <div className="module-title-row">
                <h2>DeepSeek 余额</h2>
                <Tag tone={deepSeekSummary?.configured ? 'success' : 'warning'}>
                  {deepSeekSummary?.statusLabel ?? '未配置'}
                </Tag>
              </div>
              <label className="module-switch">
                <input
                  type="checkbox"
                  checked={deepSeekSummary?.enabled ?? false}
                  onChange={(event) => void handleToggleModule('deepseek', event.target.checked)}
                />
                <span>{deepSeekSummary?.enabled ? '已启用' : '已停用'}</span>
              </label>
            </div>
            <p className="hint">
              API Key 仅由主进程使用 Windows safeStorage
              加密保存，界面不会回显明文，也不会写入日志或普通配置文件。
            </p>
            <div className="form-grid">
              <Field label="API Key" hint="保存后无法读取；输入新值可覆盖">
                <input
                  className="fl-input"
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  value={deepSeekKeyDraft}
                  placeholder="sk-..."
                  onChange={(event) => setDeepSeekKeyDraft(event.target.value)}
                />
              </Field>
              <Field label="自动刷新" hint="默认仅手动刷新">
                <select
                  className="fl-select"
                  value={
                    config.modules.deepseek.refreshIntervalMinutes === null
                      ? 'manual'
                      : String(config.modules.deepseek.refreshIntervalMinutes)
                  }
                  onChange={(event) => void handleRefreshInterval('deepseek', event.target.value)}
                >
                  <option value="manual">仅手动刷新</option>
                  <option value="15">每 15 分钟</option>
                  <option value="30">每 30 分钟</option>
                  <option value="60">每 60 分钟</option>
                </select>
              </Field>
              <div className="form-actions">
                <Button
                  variant="primary"
                  disabled={deepSeekBusy}
                  onClick={() => void handleSaveDeepSeekKey()}
                >
                  {deepSeekBusy ? '处理中…' : '保存并查询余额'}
                </Button>
                <Button
                  variant="secondary"
                  disabled={deepSeekBusy || !deepSeekSummary?.configured}
                  onClick={() => void refreshDeepSeekBalance()}
                >
                  刷新余额
                </Button>
                <Button
                  variant="danger"
                  disabled={!deepSeekSummary?.configured}
                  onClick={() => void handleClearDeepSeekKey()}
                >
                  清除 Key
                </Button>
              </div>
            </div>
            <div className="fl-alert fl-alert-info panel-alert" role="note">
              <span className="fl-alert-icon" aria-hidden="true">
                i
              </span>
              <span className="fl-alert-message">
                “今日花费”当前未接入官方账号级每日消费统计；余额变化不等于消费，本应用不会用余额差额估算。
              </span>
            </div>
            {deepSeekBalance ? (
              <div className="result-card">
                <p className="result-title">
                  {deepSeekBalance.isAvailable ? '账户余额' : '账户当前不可用（余额不足或受限）'}
                </p>
                {deepSeekBalance.balances.length === 0 ? (
                  <p className="hint">接口未返回余额信息。</p>
                ) : (
                  deepSeekBalance.balances.map((info, index) => (
                    <div key={`${info.currency}-${index}`}>
                      <div className="result-row">
                        <span>{info.currency}</span>
                        <span className="result-value">
                          {formatBalanceAmount(info.currency, info.totalBalance)}
                        </span>
                      </div>
                      <p className="hint">
                        赠送 {formatBalanceAmount(info.currency, info.grantedBalance)} · 充值{' '}
                        {formatBalanceAmount(info.currency, info.toppedUpBalance)}
                      </p>
                    </div>
                  ))
                )}
                <p className="hint">更新于 {formatTime(deepSeekBalance.fetchedAt)}</p>
              </div>
            ) : (
              <EmptyState
                title="尚未查询余额"
                description={
                  deepSeekSummary?.configured
                    ? '点击“刷新余额”查询当前余额。'
                    : '保存 API Key 后即可查询余额。'
                }
              />
            )}
          </section>
        ) : null}

        {activeTab === 'esa' ? (
          <section className="panel">
            <div className="panel-header-row">
              <div className="module-title-row">
                <h2>ESA 今日流量</h2>
                <Tag tone={esaSummary?.configured ? 'success' : 'warning'}>
                  {esaSummary?.statusLabel ?? '未配置'}
                </Tag>
              </div>
              <label className="module-switch">
                <input
                  type="checkbox"
                  checked={esaSummary?.enabled ?? false}
                  onChange={(event) => void handleToggleModule('esa', event.target.checked)}
                />
                <span>{esaSummary?.enabled ? '已启用' : '已停用'}</span>
              </label>
            </div>
            <p className="hint">
              请使用只授予 ESA 只读权限（例如 esa:DescribeSiteTimeSeriesData）的 RAM
              子账号，不要使用阿里云主账号 AccessKey。清除配置会同时移除 AccessKey 与 SiteId。
            </p>
            <div className="form-grid">
              <Field label="AccessKey ID" hint="仅保存在本机加密存储">
                <input
                  className="fl-input"
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  value={esaKeyIdDraft}
                  onChange={(event) => setEsaKeyIdDraft(event.target.value)}
                />
              </Field>
              <Field label="AccessKey Secret" hint="保存后无法读取">
                <input
                  className="fl-input"
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  value={esaKeySecretDraft}
                  onChange={(event) => setEsaKeySecretDraft(event.target.value)}
                />
              </Field>
              <Field label="SiteId" hint="可在 ESA 控制台或 ListSites 接口获取">
                <input
                  className="fl-input"
                  value={esaSiteIdDraft}
                  maxLength={128}
                  onChange={(event) => setEsaSiteIdDraft(event.target.value)}
                />
              </Field>
              <Field label="自动刷新" hint="默认仅手动刷新">
                <select
                  className="fl-select"
                  value={
                    config.modules.esa.refreshIntervalMinutes === null
                      ? 'manual'
                      : String(config.modules.esa.refreshIntervalMinutes)
                  }
                  onChange={(event) => void handleRefreshInterval('esa', event.target.value)}
                >
                  <option value="manual">仅手动刷新</option>
                  <option value="10">每 10 分钟</option>
                  <option value="15">每 15 分钟</option>
                  <option value="30">每 30 分钟</option>
                </select>
              </Field>
              <div className="form-actions">
                <Button
                  variant="primary"
                  disabled={esaBusy}
                  onClick={() => void handleSaveEsaCredentials()}
                >
                  {esaBusy ? '处理中…' : '保存并查询今日流量'}
                </Button>
                <Button
                  variant="secondary"
                  disabled={esaBusy || !esaSummary?.configured}
                  onClick={() => void refreshEsaTraffic()}
                >
                  刷新流量
                </Button>
                <Button
                  variant="danger"
                  disabled={!esaSummary?.configured}
                  onClick={() => void handleClearEsaCredentials()}
                >
                  清除配置
                </Button>
              </div>
            </div>
            <div className="fl-alert fl-alert-info panel-alert" role="note">
              <span className="fl-alert-icon" aria-hidden="true">
                i
              </span>
              <span className="fl-alert-message">
                今日范围按本机时区 00:00 至当前时刻换算为
                UTC；高访问时官方数据可能采样，不能当作精确账单。
              </span>
            </div>
            {esaTraffic ? (
              <div className="result-card">
                <p className="result-title">今日累计流量</p>
                <p className="result-value result-big">{formatBytes(esaTraffic.bytes)}</p>
                <p className="hint">
                  {formatTrafficRange(esaTraffic.startTime, esaTraffic.endTime)}
                </p>
                <p className="hint">
                  {esaTraffic.samplingRate === null
                    ? '官方未提供采样率'
                    : `采样率 ${esaTraffic.samplingRate}%`}
                  ；统计可能有延迟，不等同于精确账单。
                </p>
                <p className="hint">更新于 {formatTime(esaTraffic.fetchedAt)}</p>
              </div>
            ) : (
              <EmptyState
                title="尚未查询流量"
                description={
                  esaSummary?.configured
                    ? '点击“刷新流量”查询今日累计流量。'
                    : '保存 AccessKey 与 SiteId 后即可查询。'
                }
              />
            )}
          </section>
        ) : null}

        {activeTab === 'appearance' ? (
          <section className="panel">
            <h2>外观</h2>
            <div className="appearance">
              <div className="pet-preview">
                <img src={`flowerbuddy-pet://asset/${config.pet.assetId}`} alt="当前桌宠形象" />
              </div>
              <div className="appearance-controls">
                <label className="row">
                  <span>缩放 {scaleDraft.toFixed(1)}×</span>
                  <input
                    type="range"
                    min={SCALE_MIN}
                    max={SCALE_MAX}
                    step={SCALE_STEP}
                    value={scaleDraft}
                    onChange={(event) => handleScaleChange(Number(event.target.value))}
                    onPointerUp={handleScaleCommit}
                    onKeyUp={handleScaleCommit}
                  />
                </label>
                <div className="button-row">
                  <Button variant="primary" onClick={() => void handleImport()}>
                    导入 PNG 图片
                  </Button>
                  <Button variant="secondary" onClick={() => void handleResetPosition()}>
                    重置位置
                  </Button>
                </div>
                <p className="hint">
                  支持透明 PNG，最大 15 MB；图片保存在应用用户数据目录，不会上传到任何外部服务。
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <footer className="settings-footer">
        关闭此窗口不会退出桌宠；请通过托盘菜单或快捷菜单退出。
      </footer>
    </div>
  )
}
