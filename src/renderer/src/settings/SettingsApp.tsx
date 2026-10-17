import { useEffect, useRef, useState } from 'react'
import type {
  AppInfo,
  AppSettingsPatch,
  ModuleId,
  ModuleStatus,
  ModuleSummary,
  PublicConfig,
  SecurityStatus
} from '../../../shared/api'
import { Button } from '../components/Button'

const BUBBLE_DURATION_OPTIONS = [3000, 5000, 8000]
const SCALE_MIN = 0.5
const SCALE_MAX = 2
const SCALE_STEP = 0.1

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

function tagTone(status: ModuleStatus): string {
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

export default function SettingsApp() {
  const api = window.settingsApi
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [modules, setModules] = useState<ModuleSummary[]>([])
  const [security, setSecurity] = useState<SecurityStatus | null>(null)
  const [startupNotice, setStartupNotice] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [scaleDraft, setScaleDraft] = useState(1)
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
      const next = await api.saveAppSettings(patch)
      setConfig(next)
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
      const next = await api.setModuleEnabled(moduleId, enabled)
      setModules(next)
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
      const next = await api.resetPetPosition()
      setConfig(next)
      flash('已重置位置')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

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
          <p>阶段 2：配置、凭据与模块管理</p>
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
      </section>

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
                  <span className={`fl-tag fl-tag-${tagTone(module.status)}`}>
                    {module.statusLabel}
                  </span>
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

      <footer className="settings-footer">
        关闭此窗口不会退出桌宠；请通过托盘菜单或快捷菜单退出。
      </footer>
    </div>
  )
}
