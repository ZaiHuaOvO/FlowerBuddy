import { useState } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import type { EsaDisplayRanges, ModuleId, PublicConfig } from '../../../../shared/api'
import { ESA_TRAFFIC_RANGES } from '../../../../shared/esa'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Field } from '../../components/Field'
import { IconButton } from '../../components/IconButton'
import { Tag } from '../../components/Tag'
import { FormRow } from '../components/FormRow'
import { PageHeader } from '../components/PageHeader'
import { Section } from '../components/Section'
import { Toggle } from '../components/Toggle'
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
  onBack?: () => void
}

export function EsaSettingsTab({
  config,
  model,
  mode,
  onToggleModule,
  onSaveDisplayRanges,
  onOpenSettings,
  onGoToFunction,
  onBack
}: Props) {
  const {
    summary,
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
    <>
      <PageHeader
        title={isFunction ? 'ESA 流量' : 'ESA 流量设置'}
        onBack={onBack}
        backLabel="功能管理"
        description={
          isFunction
            ? '查询阿里云 ESA 最近 24 小时、7 天和 30 天的流量。'
            : '建议使用仅有 ESA 只读权限的 RAM 子账号。'
        }
        meta={
          <Tag tone={summary?.configured ? 'success' : 'warning'}>
            {summary?.statusLabel ?? '未配置'}
          </Tag>
        }
        actions={
          isFunction ? (
            <div className="page-actions-group">
              {onOpenSettings ? (
                <IconButton label="打开 ESA 设置" onClick={onOpenSettings}>
                  <SettingsIcon size={16} strokeWidth={1.8} aria-hidden="true" />
                </IconButton>
              ) : null}
              <Button
                variant="secondary"
                disabled={busy || !summary?.configured}
                onClick={() => void refresh()}
              >
                刷新流量
              </Button>
            </div>
          ) : (
            <div className="page-actions-group">
              {onGoToFunction ? (
                <Button variant="secondary" onClick={onGoToFunction}>
                  前往功能页
                </Button>
              ) : null}
              {onToggleModule ? (
                <Toggle
                  checked={summary?.enabled ?? false}
                  ariaLabel="启用 ESA 模块"
                  label={summary?.enabled ? '已启用' : '已停用'}
                  onChange={(enabled) => onToggleModule('esa', enabled)}
                />
              ) : null}
            </div>
          )
        }
      />

      {isFunction ? (
        <>
          <Alert tone="info">
            数据按当前时刻向前滚动统计，可能有采样和延迟，不等同于精确账单。
          </Alert>
          <Section
            title="流量概览"
            description={traffic ? `更新于 ${formatTime(traffic.fetchedAt)}` : undefined}
          >
            {traffic ? (
              <div className="stat-list">
                {traffic.ranges.map((range) => (
                  <div className="stat-row" key={range.key}>
                    <span className="stat-label">{range.label}</span>
                    <span className="stat-value">{formatBytes(range.bytes)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="尚未查询流量"
                description={
                  summary?.configured ? '点击“刷新流量”查看数据。' : '保存凭据后即可查询。'
                }
              />
            )}
          </Section>
        </>
      ) : (
        <>
          <Section title="连接配置">
            {showSetup ? (
              <>
                <div className="form-grid">
                  <Field label="AccessKey ID" hint="仅保存在本机加密存储">
                    <input
                      className="fl-input"
                      type="password"
                      autoComplete="new-password"
                      spellCheck={false}
                      value={keyIdDraft}
                      onChange={(event) => {
                        setKeyIdDraft(event.target.value)
                        if (formError) {
                          setFormError('')
                        }
                      }}
                    />
                  </Field>
                  <Field label="AccessKey Secret" hint="保存后无法读取">
                    <input
                      className="fl-input"
                      type="password"
                      autoComplete="new-password"
                      spellCheck={false}
                      value={keySecretDraft}
                      onChange={(event) => {
                        setKeySecretDraft(event.target.value)
                        if (formError) {
                          setFormError('')
                        }
                      }}
                    />
                  </Field>
                  <div className="form-span-2">
                    <Field label="SiteId" hint="可在 ESA 控制台获取">
                      <input
                        className="fl-input"
                        value={siteIdDraft}
                        maxLength={128}
                        onChange={(event) => {
                          setSiteIdDraft(event.target.value)
                          if (formError) {
                            setFormError('')
                          }
                        }}
                      />
                    </Field>
                  </div>
                </div>
                {formError ? (
                  <p className="field-error" role="alert">
                    {formError}
                  </p>
                ) : null}
              </>
            ) : null}

            <FormRow label="自动刷新" hint="仅在模块启用时生效">
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
            </FormRow>

            <div className="form-actions form-actions-end">
              {showSetup ? (
                <Button variant="primary" disabled={busy} onClick={() => void handleSave()}>
                  {busy ? '处理中…' : '保存'}
                </Button>
              ) : null}
              {configured ? (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setReconfiguring((value) => !value)}
                >
                  {reconfiguring ? '取消' : '重新配置'}
                </Button>
              ) : null}
              <Button
                variant="danger"
                disabled={!summary?.configured || busy}
                onClick={() => void handleClear()}
              >
                清除配置
              </Button>
            </div>
          </Section>

          <Section title="快捷气泡显示" description="至少勾选一项，快捷菜单气泡会按此展示。">
            <div className="check-options">
              {ESA_TRAFFIC_RANGES.map((range) => (
                <label className="check-option" key={range.key}>
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
          </Section>

          <Alert tone="info">
            数据按当前时刻向前滚动统计，可能有采样和延迟，不等同于精确账单。
          </Alert>
        </>
      )}
    </>
  )
}
