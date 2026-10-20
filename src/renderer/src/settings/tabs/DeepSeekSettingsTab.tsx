import { useState } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import type { ModuleId, PublicConfig } from '../../../../shared/api'
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
import type { useDeepSeekSettings } from '../hooks/useDeepSeekSettings'
import { formatBalanceAmount, formatTime } from '../utils/formatters'

type DeepSeekModel = ReturnType<typeof useDeepSeekSettings>

interface Props {
  config: PublicConfig
  model: DeepSeekModel
  mode: 'function' | 'settings'
  onToggleModule?: (moduleId: ModuleId, enabled: boolean) => void
  onOpenSettings?: () => void
  onGoToFunction?: () => void
}

export function DeepSeekSettingsTab({
  config,
  model,
  mode,
  onToggleModule,
  onOpenSettings,
  onGoToFunction
}: Props) {
  const {
    summary,
    keyDraft,
    setKeyDraft,
    busy,
    balance,
    saveKey,
    clearKey,
    refresh,
    saveRefreshInterval
  } = model
  const [reconfiguring, setReconfiguring] = useState(false)
  const configured = summary?.configured === true
  const isFunction = mode === 'function'
  const showSetup = !isFunction && (!configured || reconfiguring)

  async function handleSave(): Promise<void> {
    if (await saveKey()) {
      setReconfiguring(false)
    }
  }

  async function handleClear(): Promise<void> {
    if (await clearKey()) {
      setReconfiguring(false)
    }
  }

  return (
    <>
      <PageHeader
        title={isFunction ? 'DeepSeek 余额' : 'DeepSeek 余额设置'}
        description={
          isFunction
            ? '在本机查询账户余额；余额变化不等同于消费。'
            : showSetup
              ? 'API Key 仅在本机加密保存，不会回显明文。'
              : '配置自动刷新；重新配置可覆盖现有 Key。'
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
                <IconButton label="打开 DeepSeek 设置" onClick={onOpenSettings}>
                  <SettingsIcon size={16} strokeWidth={1.8} aria-hidden="true" />
                </IconButton>
              ) : null}
              <Button
                variant="secondary"
                disabled={busy || !summary?.configured}
                onClick={() => void refresh()}
              >
                刷新余额
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
                  ariaLabel="启用 DeepSeek 模块"
                  label={summary?.enabled ? '已启用' : '已停用'}
                  onChange={(enabled) => onToggleModule('deepseek', enabled)}
                />
              ) : null}
            </div>
          )
        }
      />

      {isFunction ? (
        <>
          <Alert tone="info">“今日花费”当前未接入官方统计，余额变化不等于消费。</Alert>
          <Section
            title="账户余额"
            description={balance ? `更新于 ${formatTime(balance.fetchedAt)}` : undefined}
          >
            {balance ? (
              balance.balances.length === 0 ? (
                <p className="hint">接口未返回余额信息。</p>
              ) : (
                <div className="stat-list">
                  {balance.balances.map((info, index) => (
                    <div className="stat-row" key={`${info.currency}-${index}`}>
                      <div className="stat-row-main">
                        <span className="stat-label">{info.currency}</span>
                        <span className="stat-note">
                          赠送 {formatBalanceAmount(info.currency, info.grantedBalance)} · 充值{' '}
                          {formatBalanceAmount(info.currency, info.toppedUpBalance)}
                        </span>
                      </div>
                      <span className="stat-value">
                        {formatBalanceAmount(info.currency, info.totalBalance)}
                      </span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <EmptyState
                title="尚未查询余额"
                description={
                  summary?.configured ? '点击“刷新余额”查看数据。' : '保存 API Key 后即可查询。'
                }
              />
            )}
          </Section>
        </>
      ) : (
        <>
          <Section title="连接配置">
            {showSetup ? (
              <div className="form-grid">
                <div className="form-span-2">
                  <Field label="API Key" hint="保存后无法读取；输入新值可覆盖">
                    <input
                      className="fl-input"
                      type="password"
                      autoComplete="new-password"
                      spellCheck={false}
                      value={keyDraft}
                      placeholder="sk-..."
                      onChange={(event) => setKeyDraft(event.target.value)}
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            <FormRow label="自动刷新" hint="仅在模块启用时生效">
              <select
                className="fl-select"
                value={
                  config.modules.deepseek.refreshIntervalMinutes === null
                    ? 'manual'
                    : String(config.modules.deepseek.refreshIntervalMinutes)
                }
                onChange={(event) => void saveRefreshInterval('deepseek', event.target.value)}
              >
                <option value="manual">仅手动刷新</option>
                <option value="15">每 15 分钟</option>
                <option value="30">每 30 分钟</option>
                <option value="60">每 60 分钟</option>
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
                清除 Key
              </Button>
            </div>
          </Section>

          <Alert tone="info">余额变化不等于消费，本应用不会用余额差额估算今日花费。</Alert>
        </>
      )}
    </>
  )
}
