import { useState } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import type { EsaDisplayRanges, ModuleId, PublicConfig } from '../../../../shared/api'
import { ESA_TRAFFIC_RANGES } from '../../../../shared/esa'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Field } from '../../components/Field'
import { IconButton } from '../../components/IconButton'
import { Tag } from '../../components/Tag'
import type { useEsaSettings } from '../hooks/useEsaSettings'
import { formatBytes, formatTime } from '../utils/formatters'

type EsaModel = ReturnType<typeof useEsaSettings>

interface Props {
  config: PublicConfig
  model: EsaModel
  mode: 'function' | 'settings'
  onToggleModule?: (moduleId: ModuleId, enabled: boolean) => void
  onSaveDisplayRanges?: (ranges: EsaDisplayRanges) => void
  onOpenSettings?: () => void
  onGoToFunction?: () => void
}

export function EsaSettingsTab({
  config,
  model,
  mode,
  onToggleModule,
  onSaveDisplayRanges,
  onOpenSettings,
  onGoToFunction
}: Props) {
  const {
    summary,
    keyIdDraft,
    setKeyIdDraft,
    keySecretDraft,
    setKeySecretDraft,
    siteIdDraft,
    setSiteIdDraft,
    busy,
    traffic,
    saveCredentials,
    clearCredentials,
    refresh,
    saveRefreshInterval
  } = model
  const [reconfiguring, setReconfiguring] = useState(false)
  const configured = summary?.configured === true
  const isFunction = mode === 'function'
  const showSetup = !isFunction && (!configured || reconfiguring)

  async function handleSave(): Promise<void> {
    if (await saveCredentials()) {
      setReconfiguring(false)
    }
  }

  async function handleClear(): Promise<void> {
    if (await clearCredentials()) {
      setReconfiguring(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-header-row">
        <div className="module-title-row">
          <h2>{isFunction ? 'ESA 流量' : 'ESA 流量设置'}</h2>
          <Tag tone={summary?.configured ? 'success' : 'warning'}>
            {summary?.statusLabel ?? '未配置'}
          </Tag>
          {isFunction && onOpenSettings ? (
            <IconButton label="打开 ESA 设置" onClick={onOpenSettings}>
              <SettingsIcon size={16} strokeWidth={1.8} aria-hidden="true" />
            </IconButton>
          ) : null}
        </div>
        {isFunction ? (
          <Button
            variant="secondary"
            disabled={busy || !summary?.configured}
            onClick={() => void refresh()}
          >
            刷新流量
          </Button>
        ) : (
          <div className="panel-header-actions">
            {onGoToFunction ? (
              <Button variant="secondary" onClick={onGoToFunction}>
                前往功能页
              </Button>
            ) : null}
            {onToggleModule ? (
              <label className="module-switch">
                <input
                  type="checkbox"
                  checked={summary?.enabled ?? false}
                  onChange={(event) => onToggleModule('esa', event.target.checked)}
                />
                <span>{summary?.enabled ? '已启用' : '已停用'}</span>
              </label>
            ) : null}
          </div>
        )}
      </div>

      {isFunction ? (
        <>
          <div className="fl-alert fl-alert-info panel-alert" role="note">
            <span className="fl-alert-icon" aria-hidden="true">
              i
            </span>
            <span className="fl-alert-message">
              数据按当前时刻向前滚动统计，可能有采样和延迟，不等同于精确账单。
            </span>
          </div>
          {traffic ? (
            <div className="result-card">
              <p className="result-title">流量概览</p>
              {traffic.ranges.map((range) => (
                <div className="result-row" key={range.key}>
                  <span>{range.label}</span>
                  <span className="result-value">{formatBytes(range.bytes)}</span>
                </div>
              ))}
              <p className="hint">更新于 {formatTime(traffic.fetchedAt)}</p>
            </div>
          ) : (
            <EmptyState
              title="尚未查询流量"
              description={
                summary?.configured ? '点击“刷新流量”查看数据。' : '保存凭据后即可查询。'
              }
            />
          )}
        </>
      ) : (
        <>
          {showSetup ? (
            <p className="hint">
              建议使用仅有 ESA 只读权限的 RAM 子账号，不要使用主账号 AccessKey。
            </p>
          ) : null}
          {showSetup ? (
            <div className="form-grid">
              <Field label="AccessKey ID" hint="仅保存在本机加密存储">
                <input
                  className="fl-input"
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  value={keyIdDraft}
                  onChange={(event) => setKeyIdDraft(event.target.value)}
                />
              </Field>
              <Field label="AccessKey Secret" hint="保存后无法读取">
                <input
                  className="fl-input"
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  value={keySecretDraft}
                  onChange={(event) => setKeySecretDraft(event.target.value)}
                />
              </Field>
              <Field label="SiteId" hint="可在 ESA 控制台获取">
                <input
                  className="fl-input"
                  value={siteIdDraft}
                  maxLength={128}
                  onChange={(event) => setSiteIdDraft(event.target.value)}
                />
              </Field>
            </div>
          ) : null}
          <div className="settings-inline-row">
            <label className="settings-inline-field">
              <span className="field-label">自动刷新</span>
              <select
                className="fl-select"
                value={
                  config.modules.esa.refreshIntervalMinutes === null
                    ? 'manual'
                    : String(config.modules.esa.refreshIntervalMinutes)
                }
                onChange={(event) => void saveRefreshInterval('esa', event.target.value)}
              >
                <option value="manual">仅手动刷新</option>
                <option value="10">每 10 分钟</option>
                <option value="15">每 15 分钟</option>
                <option value="30">每 30 分钟</option>
              </select>
            </label>
            <div className="form-actions">
              {showSetup ? (
                <Button variant="primary" disabled={busy} onClick={() => void handleSave()}>
                  {busy ? '处理中…' : '保存'}
                </Button>
              ) : null}
              <Button
                variant="danger"
                disabled={!summary?.configured}
                onClick={() => void handleClear()}
              >
                清除配置
              </Button>
              {configured ? (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setReconfiguring((value) => !value)}
                >
                  {reconfiguring ? '取消' : '重新配置'}
                </Button>
              ) : null}
            </div>
          </div>
          <div className="esa-display-ranges">
            <span className="field-label">快捷气泡显示内容</span>
            <div className="esa-range-options">
              {ESA_TRAFFIC_RANGES.map((range) => (
                <label className="esa-range-option" key={range.key}>
                  <input
                    type="checkbox"
                    checked={config.modules.esa.displayRanges[range.key]}
                    onChange={(event) =>
                      onSaveDisplayRanges?.({
                        ...config.modules.esa.displayRanges,
                        [range.key]: event.target.checked
                      })
                    }
                  />
                  <span>{range.label}</span>
                </label>
              ))}
            </div>
            <p className="hint">至少勾选一项，快捷菜单气泡会按此展示。</p>
          </div>
          <div className="fl-alert fl-alert-info panel-alert" role="note">
            <span className="fl-alert-icon" aria-hidden="true">
              i
            </span>
            <span className="fl-alert-message">
              数据按当前时刻向前滚动统计，可能有采样和延迟，不等同于精确账单。
            </span>
          </div>
        </>
      )}
    </section>
  )
}
