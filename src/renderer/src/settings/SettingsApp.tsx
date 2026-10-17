import { useEffect, useRef, useState } from 'react'
import type {
  AppInfo,
  AppSettingsPatch,
  DateEventSummary,
  GmailStateView,
  ModuleId,
  ModuleSummary,
  PublicConfig,
  RefreshableModuleId,
  SecurityStatus,
  WebsiteCheckConfig
} from '../../../shared/api'
import { AppearanceSettingsTab } from './tabs/AppearanceSettingsTab'
import { DatesSettingsTab } from './tabs/DatesSettingsTab'
import { DeepSeekSettingsTab } from './tabs/DeepSeekSettingsTab'
import { EsaSettingsTab } from './tabs/EsaSettingsTab'
import { GeneralSettingsTab } from './tabs/GeneralSettingsTab'
import { GmailSettingsTab } from './tabs/GmailSettingsTab'
import { ModulesSettingsTab } from './tabs/ModulesSettingsTab'
import { WebsitesSettingsTab } from './tabs/WebsitesSettingsTab'
import { useAppearanceSettings } from './hooks/useAppearanceSettings'
import { useDatesSettings } from './hooks/useDatesSettings'
import { useDeepSeekSettings } from './hooks/useDeepSeekSettings'
import { useEsaSettings } from './hooks/useEsaSettings'
import { useGmailSettings } from './hooks/useGmailSettings'
import { useWebsiteSettings } from './hooks/useWebsiteSettings'
import { TABS } from './utils/constants'
import type { SettingsTab } from './utils/constants'
import { toMessage } from './utils/formatters'
import type { SettingsApi } from './types'
import '../styles/settings.css'

export default function SettingsApp() {
  const api = window.settingsApi
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [modules, setModules] = useState<ModuleSummary[]>([])
  const [security, setSecurity] = useState<SecurityStatus | null>(null)
  const [startupNotice, setStartupNotice] = useState<string | null>(null)
  const [dateEvents, setDateEvents] = useState<DateEventSummary[]>([])
  const [websites, setWebsites] = useState<WebsiteCheckConfig[]>([])
  const [gmailState, setGmailState] = useState<GmailStateView | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = '花伴 - 设置'
  }, [])

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
    }
  }, [api])

  if (!api) {
    return (
      <div className="settings-root">
        <p className="hint">设置接口不可用。</p>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="settings-root">
        <p className="hint">正在读取配置…</p>
        {error ? (
          <div className="settings-banners">
            <div className="fl-alert fl-alert-error" role="alert">
              <span className="fl-alert-icon" aria-hidden="true">
                !
              </span>
              <span className="fl-alert-message">{error}</span>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <SettingsContent
      api={api}
      config={config}
      setConfig={setConfig}
      appInfo={appInfo}
      modules={modules}
      setModules={setModules}
      security={security}
      startupNotice={startupNotice}
      dateEvents={dateEvents}
      setDateEvents={setDateEvents}
      websites={websites}
      setWebsites={setWebsites}
      gmailState={gmailState}
      setGmailState={setGmailState}
      error={error}
      setError={setError}
    />
  )
}

interface ContentProps {
  api: SettingsApi
  config: PublicConfig
  setConfig: (config: PublicConfig) => void
  appInfo: AppInfo | null
  modules: ModuleSummary[]
  setModules: (modules: ModuleSummary[]) => void
  security: SecurityStatus | null
  startupNotice: string | null
  dateEvents: DateEventSummary[]
  setDateEvents: (events: DateEventSummary[]) => void
  websites: WebsiteCheckConfig[]
  setWebsites: (websites: WebsiteCheckConfig[]) => void
  gmailState: GmailStateView | null
  setGmailState: (state: GmailStateView | null) => void
  error: string
  setError: (message: string) => void
}

function SettingsContent({
  api,
  config,
  setConfig,
  appInfo,
  modules,
  setModules,
  security,
  startupNotice,
  dateEvents,
  setDateEvents,
  websites,
  setWebsites,
  gmailState,
  setGmailState,
  error,
  setError
}: ContentProps) {
  const [status, setStatus] = useState('')
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const statusTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (statusTimer.current !== null) {
        window.clearTimeout(statusTimer.current)
        statusTimer.current = null
      }
    }
  }, [])

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
    setError('')
    try {
      setConfig(await api.saveAppSettings(patch))
      flash('已保存')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function toggleModule(moduleId: ModuleId, enabled: boolean): Promise<void> {
    setError('')
    try {
      setModules(await api.setModuleEnabled(moduleId, enabled))
      flash('已保存')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function saveRefreshInterval(moduleId: RefreshableModuleId, value: string): Promise<void> {
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

  const dates = useDatesSettings({
    api,
    events: dateEvents,
    setEvents: setDateEvents,
    flash,
    setError
  })
  const websiteSettings = useWebsiteSettings({
    api,
    websites,
    setWebsites,
    flash,
    setError
  })
  const gmail = useGmailSettings({
    api,
    setConfig,
    modules,
    setModules,
    gmailState,
    setGmailState,
    flash,
    setError
  })
  const deepSeek = useDeepSeekSettings({
    api,
    modules,
    setModules,
    saveRefreshInterval,
    flash,
    setError
  })
  const esa = useEsaSettings({
    api,
    modules,
    setModules,
    initialSiteId: config.modules.esa.siteId,
    saveRefreshInterval,
    flash,
    setError
  })
  const appearance = useAppearanceSettings({
    api,
    config,
    setConfig,
    flash,
    setError
  })
  const isFirstTab = TABS.findIndex((tab) => tab.id === activeTab) === 0

  return (
    <div className="settings-root">
      <header className="settings-header">
        <h1>
          花伴 - 设置
          {appInfo ? <span className="settings-version">版本 {appInfo.version}</span> : null}
        </h1>
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

      <div className="settings-body">
        <nav className="settings-nav" role="tablist" aria-label="设置分区">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`settings-tab-${tab.id}`}
              type="button"
              role="tab"
              className={`settings-nav-item${activeTab === tab.id ? ' active' : ''}`}
              aria-selected={activeTab === tab.id}
              aria-controls="settings-tabpanel"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <section
          id="settings-tabpanel"
          className={`settings-content${isFirstTab ? ' is-first' : ''}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${activeTab}`}
        >
          {activeTab === 'general' ? (
            <GeneralSettingsTab config={config} onSave={(patch) => void saveApp(patch)} />
          ) : null}
          {activeTab === 'modules' ? (
            <ModulesSettingsTab
              modules={modules}
              security={security}
              onToggle={(moduleId, enabled) => void toggleModule(moduleId, enabled)}
            />
          ) : null}
          {activeTab === 'dates' ? <DatesSettingsTab model={dates} /> : null}
          {activeTab === 'websites' ? <WebsitesSettingsTab model={websiteSettings} /> : null}
          {activeTab === 'gmail' ? (
            <GmailSettingsTab
              config={config}
              model={gmail}
              onToggleModule={(moduleId, enabled) => void toggleModule(moduleId, enabled)}
            />
          ) : null}
          {activeTab === 'deepseek' ? (
            <DeepSeekSettingsTab
              config={config}
              model={deepSeek}
              onToggleModule={(moduleId, enabled) => void toggleModule(moduleId, enabled)}
            />
          ) : null}
          {activeTab === 'esa' ? (
            <EsaSettingsTab
              config={config}
              model={esa}
              onToggleModule={(moduleId, enabled) => void toggleModule(moduleId, enabled)}
            />
          ) : null}
          {activeTab === 'appearance' ? (
            <AppearanceSettingsTab config={config} model={appearance} />
          ) : null}
        </section>
      </div>
    </div>
  )
}
