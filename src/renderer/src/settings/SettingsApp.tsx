import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type {
  AppInfo,
  AppSettingsPatch,
  EsaDisplayRanges,
  ExternalLinkId,
  IntervalReminderSummary,
  MemoSummary,
  ModuleId,
  ModuleSummary,
  PetSettingsPatch,
  PetUserImage,
  PublicConfig,
  RefreshableModuleId,
  SecurityStatus,
  SystemNavigation,
  UpdateStatus,
  WebsiteCheckConfig
} from '../../../shared/api'
import { petPresetLabel } from '../../../shared/pet-presets'
import { Alert } from '../components/Alert'
import { EmptyState } from '../components/EmptyState'
import { AboutPane } from './AboutPane'
import { MemoSettingsPane } from './sections/MemoSettingsPane'
import { MemoSettingsTab } from './tabs/MemoSettingsTab'
import { IntervalReminderSettingsTab } from './tabs/IntervalReminderSettingsTab'
import { DeepSeekSettingsTab } from './tabs/DeepSeekSettingsTab'
import { EsaSettingsTab } from './tabs/EsaSettingsTab'
import { GeneralSettingsTab } from './tabs/GeneralSettingsTab'
import { ModulesSettingsTab } from './tabs/ModulesSettingsTab'
import { WebsitesSettingsTab } from './tabs/WebsitesSettingsTab'
import { useMemoSettings } from './hooks/useMemoSettings'
import { useIntervalReminderSettings } from './hooks/useIntervalReminderSettings'
import { useDeepSeekSettings } from './hooks/useDeepSeekSettings'
import { useEsaSettings } from './hooks/useEsaSettings'
import { useWebsiteSettings } from './hooks/useWebsiteSettings'
import { CORE_TABS, SYSTEM_TABS } from './utils/constants'
import type { SettingsSection, SystemTab } from './utils/constants'
import { applySystemNavigation, DEFAULT_SYSTEM_STATE } from './utils/navigation'
import type { SystemState } from './utils/navigation'
import { mergeMemoOrder } from './utils/memo-order'
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
  const [memos, setMemos] = useState<MemoSummary[]>([])
  const [intervalReminders, setIntervalReminders] = useState<IntervalReminderSummary[]>([])
  const [websites, setWebsites] = useState<WebsiteCheckConfig[]>([])
  const [petImages, setPetImages] = useState<PetUserImage[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = '花伴'
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
      .listPetImages()
      .then((next) => {
        if (active) {
          setPetImages(next)
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
      .listMemos()
      .then((next) => {
        if (active) {
          setMemos(next)
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(toMessage(cause))
        }
      })

    void api
      .listIntervalReminders()
      .then((next) => {
        if (active) {
          setIntervalReminders(next)
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
        <SettingsHeader appInfo={appInfo} status="设置接口不可用。" isError />
      </div>
    )
  }

  if (!config) {
    return (
      <div className="settings-root">
        <SettingsHeader appInfo={appInfo} status={error} isError={Boolean(error)} />
        {error ? null : (
          <div className="settings-boot" role="status">
            <span className="app-loading-spinner" aria-hidden="true" />
            <span>正在读取配置…</span>
          </div>
        )}
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
      memos={memos}
      setMemos={setMemos}
      intervalReminders={intervalReminders}
      setIntervalReminders={setIntervalReminders}
      websites={websites}
      setWebsites={setWebsites}
      petImages={petImages}
      setPetImages={setPetImages}
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
  memos: MemoSummary[]
  setMemos: Dispatch<SetStateAction<MemoSummary[]>>
  intervalReminders: IntervalReminderSummary[]
  setIntervalReminders: (reminders: IntervalReminderSummary[]) => void
  websites: WebsiteCheckConfig[]
  setWebsites: (websites: WebsiteCheckConfig[]) => void
  petImages: PetUserImage[]
  setPetImages: Dispatch<SetStateAction<PetUserImage[]>>
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
  memos,
  setMemos,
  intervalReminders,
  setIntervalReminders,
  websites,
  setWebsites,
  petImages,
  setPetImages,
  error,
  setError
}: ContentProps) {
  const [status, setStatus] = useState('')
  const [systemState, setSystemState] = useState<SystemState>(DEFAULT_SYSTEM_STATE)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const statusTimer = useRef<number | null>(null)

  const modulesById = new Map(modules.map((module) => [module.id, module]))
  const enabledModules = config.app.moduleOrder
    .map((id) => modulesById.get(id))
    .filter((module): module is ModuleSummary => module?.enabled === true)
  for (const module of modules) {
    if (module.enabled && !enabledModules.includes(module)) {
      enabledModules.push(module)
    }
  }
  const enabledModuleIds = enabledModules.map((module) => module.id)
  const state = applySystemNavigation(systemState, { tab: systemState.tab }, enabledModuleIds)

  const enabledModuleIdsRef = useRef<ModuleId[]>(enabledModuleIds)
  enabledModuleIdsRef.current = enabledModuleIds

  useEffect(() => {
    return () => {
      if (statusTimer.current !== null) {
        window.clearTimeout(statusTimer.current)
        statusTimer.current = null
      }
    }
  }, [])

  useEffect(() => {
    void api
      .getUpdateStatus()
      .then(setUpdateStatus)
      .catch(() => {})
    return api.onUpdateStatus(setUpdateStatus)
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

  function navigate(navigation: SystemNavigation): void {
    setSystemState((current) =>
      applySystemNavigation(current, navigation, enabledModuleIdsRef.current)
    )
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

  async function savePet(patch: PetSettingsPatch): Promise<void> {
    setError('')
    try {
      setConfig(await api.savePetSettings(patch))
      flash('已保存')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function saveMemoAnchorNew(enabled: boolean): Promise<void> {
    setError('')
    try {
      setConfig(await api.setMemoAnchorNew(enabled))
      flash('已保存')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function saveMemoLineTasks(enabled: boolean): Promise<void> {
    setError('')
    try {
      setConfig(await api.setMemoLineTasks(enabled))
      flash('已保存')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function toggleModule(moduleId: ModuleId, enabled: boolean): Promise<void> {
    setError('')
    try {
      setModules(await api.setModuleEnabled(moduleId, enabled))
      setConfig(await api.getConfig())
      flash('已保存')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function reorderModules(order: ModuleId[]): Promise<void> {
    setError('')
    try {
      setConfig(await api.saveAppSettings({ moduleOrder: order }))
      flash('顺序已更新')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function importPetImage(): Promise<void> {
    setError('')
    try {
      const next = await api.importPetImage()
      if (next) {
        setConfig(next)
        setPetImages(await api.listPetImages())
        flash('已导入新形象')
      }
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function selectPetAsset(assetId: string): Promise<void> {
    setError('')
    try {
      setConfig(await api.selectPetAsset(assetId))
      flash(`已切换为${petPresetLabel(assetId) ?? '自定义形象'}`)
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function deletePetImage(assetId: string): Promise<void> {
    setError('')
    try {
      setConfig(await api.deletePetImage(assetId))
      setPetImages(await api.listPetImages())
      flash('已删除该形象')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function renamePetImage(assetId: string, name: string): Promise<void> {
    setError('')
    try {
      setPetImages(await api.renamePetImage(assetId, name))
      flash(name ? '名称已保存' : '已恢复默认名称')
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

  async function saveEsaDisplayRanges(ranges: EsaDisplayRanges): Promise<void> {
    if (!ranges.last24h && !ranges.last7d && !ranges.last30d) {
      setError('至少选择一项 ESA 流量范围')
      return
    }
    setError('')
    try {
      setConfig(await api.setEsaDisplayRanges(ranges))
      await esa.refresh()
      flash('已保存')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  function openExternal(link: ExternalLinkId): void {
    void api.openExternal(link).catch((cause: unknown) => setError(toMessage(cause)))
  }

  const [composeSignal, setComposeSignal] = useState(0)
  const modulesRef = useRef(modules)
  modulesRef.current = modules

  useEffect(() => {
    const offMemos = api.onMemosChanged(() => {
      void api
        .listMemos()
        .then((next) => setMemos((current) => mergeMemoOrder(current, next)))
        .catch((cause: unknown) => setError(toMessage(cause)))
    })
    const offComposer = api.onOpenMemoComposer(() => {
      const memoEnabled = modulesRef.current.some(
        (module) => module.id === 'memo' && module.enabled
      )
      if (!memoEnabled) {
        setSystemState((current) =>
          applySystemNavigation(
            current,
            { tab: 'settings', settingsSection: 'modules' },
            enabledModuleIdsRef.current
          )
        )
        setError('备忘录功能未启用，无法新建备忘录。')
        return
      }
      setComposeSignal((value) => value + 1)
      setSystemState((current) =>
        applySystemNavigation(
          current,
          { tab: 'function', moduleId: 'memo' },
          enabledModuleIdsRef.current
        )
      )
    })
    const offNavigate = api.onNavigate((navigation) => {
      setSystemState((current) =>
        applySystemNavigation(current, navigation, enabledModuleIdsRef.current)
      )
    })
    void api.settingsUiReady()
    return () => {
      offMemos()
      offComposer()
      offNavigate()
    }
  }, [api, setError, setMemos])

  const memo = useMemoSettings({
    api,
    memos,
    setMemos,
    flash,
    setError,
    composeSignal,
    listVisible: state.tab === 'function' && state.moduleId === 'memo',
    anchorNewMemos: config.modules.memo.anchorNewMemos,
    defaultLineTasksEnabled: config.modules.memo.lineTasksEnabled,
    onSetAnchorNew: (enabled) => void saveMemoAnchorNew(enabled),
    onSetLineTasksDefault: (enabled) => void saveMemoLineTasks(enabled)
  })
  const intervalReminderSettings = useIntervalReminderSettings({
    api,
    reminders: intervalReminders,
    setReminders: setIntervalReminders,
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

  const headerStatus = status

  function renderFunctionContent() {
    switch (state.moduleId) {
      case 'memo':
        return (
          <MemoSettingsTab
            model={memo}
            onOpenSettings={() => navigate({ tab: 'settings', settingsSection: 'memo' })}
          />
        )
      case 'interval-reminder':
        return <IntervalReminderSettingsTab model={intervalReminderSettings} />
      case 'website-check':
        return <WebsitesSettingsTab model={websiteSettings} />
      case 'deepseek':
        return (
          <DeepSeekSettingsTab
            config={config}
            model={deepSeek}
            mode="function"
            onOpenSettings={() => navigate({ tab: 'settings', settingsSection: 'deepseek' })}
          />
        )
      case 'esa':
        return (
          <EsaSettingsTab
            config={config}
            model={esa}
            mode="function"
            onOpenSettings={() => navigate({ tab: 'settings', settingsSection: 'esa' })}
          />
        )
      default:
        return <p className="hint">没有可显示的功能。</p>
    }
  }

  function renderSettingsContent() {
    switch (state.settingsSection) {
      case 'general':
        return (
          <GeneralSettingsTab
            config={config}
            userImages={petImages}
            onSave={(patch) => void saveApp(patch)}
            onSavePet={(patch) => void savePet(patch)}
            onImportImage={() => void importPetImage()}
            onSelectAsset={selectPetAsset}
            onDeleteImage={deletePetImage}
            onRenameImage={renamePetImage}
          />
        )
      case 'modules':
        return (
          <ModulesSettingsTab
            modules={[...enabledModules, ...modules.filter((module) => !module.enabled)]}
            security={security}
            onToggle={(moduleId, enabled) => void toggleModule(moduleId, enabled)}
            onReorder={(order) => void reorderModules(order)}
            onOpenSettings={(moduleId) => navigate({ tab: 'settings', settingsSection: moduleId })}
          />
        )
      case 'memo':
        return (
          <MemoSettingsPane
            memoShortcut={config.app.memoShortcut}
            anchorNewMemos={config.modules.memo.anchorNewMemos}
            lineTasksEnabled={config.modules.memo.lineTasksEnabled}
            onSaveShortcut={(accelerator) => void saveApp({ memoShortcut: accelerator })}
            onSaveAnchorNew={(enabled) => void saveMemoAnchorNew(enabled)}
            onSaveLineTasks={(enabled) => void saveMemoLineTasks(enabled)}
            onGoToFunction={() => navigate({ tab: 'function', moduleId: 'memo' })}
            onBack={() => navigate({ tab: 'settings', settingsSection: 'modules' })}
          />
        )
      case 'deepseek':
        return (
          <DeepSeekSettingsTab
            config={config}
            model={deepSeek}
            mode="settings"
            onToggleModule={(moduleId, enabled) => void toggleModule(moduleId, enabled)}
            onGoToFunction={() => navigate({ tab: 'function', moduleId: 'deepseek' })}
            onBack={() => navigate({ tab: 'settings', settingsSection: 'modules' })}
          />
        )
      case 'esa':
        return (
          <EsaSettingsTab
            config={config}
            model={esa}
            mode="settings"
            onToggleModule={(moduleId, enabled) => void toggleModule(moduleId, enabled)}
            onSaveDisplayRanges={(ranges) => void saveEsaDisplayRanges(ranges)}
            onGoToFunction={() => navigate({ tab: 'function', moduleId: 'esa' })}
            onBack={() => navigate({ tab: 'settings', settingsSection: 'modules' })}
          />
        )
      default:
        return null
    }
  }

  const topTabIds = SYSTEM_TABS.map((tab) => tab.id)
  const functionTabIds = enabledModules.map((module) => module.id)
  const settingsTabIds = CORE_TABS.map((tab) => tab.id)
  // Module settings are a sub-page of 功能管理, not a peer of 常规: the left rail
  // only ever lists the two core sections, and a module section keeps 功能管理
  // highlighted so the rail never shows an empty selection.
  const currentSettingsSection = state.settingsSection ?? 'general'
  const isModuleSection =
    currentSettingsSection !== 'general' && currentSettingsSection !== 'modules'
  const navActiveSection: SettingsSection = isModuleSection ? 'modules' : currentSettingsSection

  return (
    <div className="settings-root">
      <SettingsHeader appInfo={appInfo} status={headerStatus} />

      <nav
        className="system-top-tabs"
        role="tablist"
        aria-label="系统页面"
        onKeyDown={(event) =>
          moveTabFocus(event, topTabIds, state.tab, (id) => navigate({ tab: id as SystemTab }))
        }
      >
        {SYSTEM_TABS.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={state.tab === tab.id}
            aria-controls="system-panel"
            tabIndex={state.tab === tab.id ? 0 : -1}
            className={`system-top-tab${state.tab === tab.id ? ' active' : ''}`}
            onClick={() => navigate({ tab: tab.id })}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {error ? (
        <div className="settings-toast">
          <Alert tone="danger" onClose={() => setError('')}>
            {error}
          </Alert>
        </div>
      ) : startupNotice ? (
        <Alert tone="warning" className="settings-global-alert">
          {startupNotice}
        </Alert>
      ) : null}

      {state.tab === 'about' ? (
        <div className="settings-body">
          <section
            id="system-panel"
            className="settings-content"
            role="tabpanel"
            aria-labelledby="tab-about"
          >
            <div className="settings-content-inner">
              <AboutPane
                appInfo={appInfo}
                updateStatus={updateStatus}
                onOpenExternal={openExternal}
                onCheckForUpdates={() =>
                  void api
                    .checkForUpdates()
                    .then(setUpdateStatus)
                    .catch((cause: unknown) => setError(toMessage(cause)))
                }
                onDownloadUpdate={() =>
                  void api
                    .downloadUpdate()
                    .then(setUpdateStatus)
                    .catch((cause: unknown) => setError(toMessage(cause)))
                }
                onInstallUpdate={() =>
                  void api.installUpdate().catch((cause: unknown) => setError(toMessage(cause)))
                }
              />
            </div>
          </section>
        </div>
      ) : state.tab === 'function' ? (
        <div className="settings-body">
          <nav
            className="settings-nav"
            role="tablist"
            aria-label="功能模块"
            aria-orientation="vertical"
            onKeyDown={(event) =>
              moveTabFocus(
                event,
                functionTabIds,
                state.moduleId ?? '',
                (id) => navigate({ tab: 'function', moduleId: id as ModuleId }),
                'vertical'
              )
            }
          >
            {enabledModules.length === 0 ? (
              <p className="settings-nav-empty">暂无已启用功能。</p>
            ) : (
              enabledModules.map((module) => (
                <button
                  key={module.id}
                  id={`tab-${module.id}`}
                  type="button"
                  role="tab"
                  className={`settings-nav-item${state.moduleId === module.id ? ' active' : ''}`}
                  aria-selected={state.moduleId === module.id}
                  aria-controls="system-panel"
                  tabIndex={state.moduleId === module.id ? 0 : -1}
                  onClick={() => navigate({ tab: 'function', moduleId: module.id })}
                >
                  <span className="settings-nav-label">{module.name}</span>
                  {module.configured ? null : <span className="settings-nav-badge">未配置</span>}
                </button>
              ))
            )}
          </nav>
          <section
            id="system-panel"
            className="settings-content"
            role="tabpanel"
            aria-labelledby={`tab-${state.moduleId ?? ''}`}
          >
            <div className="settings-content-inner">
              {enabledModules.length === 0 ? (
                <EmptyState
                  title="还没有启用任何功能"
                  description="请先在“设置 → 功能管理”中启用至少一个功能。"
                />
              ) : (
                renderFunctionContent()
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="settings-body">
          <nav
            className="settings-nav"
            role="tablist"
            aria-label="设置分区"
            aria-orientation="vertical"
            onKeyDown={(event) =>
              moveTabFocus(
                event,
                settingsTabIds,
                navActiveSection,
                (id) => navigate({ tab: 'settings', settingsSection: id as SettingsSection }),
                'vertical'
              )
            }
          >
            {CORE_TABS.map((tab) => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                type="button"
                role="tab"
                className={`settings-nav-item${navActiveSection === tab.id ? ' active' : ''}`}
                aria-selected={navActiveSection === tab.id}
                aria-controls="system-panel"
                tabIndex={navActiveSection === tab.id ? 0 : -1}
                onClick={() => navigate({ tab: 'settings', settingsSection: tab.id })}
              >
                <span className="settings-nav-label">{tab.label}</span>
              </button>
            ))}
          </nav>
          <section
            id="system-panel"
            className="settings-content"
            role="tabpanel"
            aria-labelledby={`tab-${navActiveSection}`}
          >
            <div className="settings-content-inner">{renderSettingsContent()}</div>
          </section>
        </div>
      )}
    </div>
  )
}

function moveTabFocus(
  event: React.KeyboardEvent<HTMLElement>,
  ids: readonly string[],
  currentId: string,
  select: (id: string) => void,
  orientation: 'horizontal' | 'vertical' = 'horizontal'
): void {
  const previousKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
  const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'
  if (![previousKey, nextKey, 'Home', 'End'].includes(event.key) || ids.length === 0) {
    return
  }
  const currentIndex = Math.max(0, ids.indexOf(currentId))
  let nextIndex = currentIndex
  if (event.key === previousKey) {
    nextIndex = (currentIndex - 1 + ids.length) % ids.length
  } else if (event.key === nextKey) {
    nextIndex = (currentIndex + 1) % ids.length
  } else if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = ids.length - 1
  }
  const nextId = ids[nextIndex]
  if (!nextId) {
    return
  }
  event.preventDefault()
  select(nextId)
  document.getElementById(`tab-${nextId}`)?.focus()
}

interface SettingsHeaderProps {
  appInfo: AppInfo | null
  status: string
  isError?: boolean
}

function SettingsHeader({ appInfo, status, isError = false }: SettingsHeaderProps) {
  return (
    <header className="settings-header">
      <h1>
        花伴
        {appInfo ? <span className="settings-version">版本 {appInfo.version}</span> : null}
      </h1>
      {status ? (
        <p
          className={`settings-status${isError ? ' is-error' : ''}`}
          role={isError ? 'alert' : 'status'}
        >
          {status}
        </p>
      ) : null}
    </header>
  )
}
